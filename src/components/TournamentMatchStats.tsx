// src/components/TournamentMatchStats.tsx
// Auto-polls stats after each tournament match is played
import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import axiosInstance from '@/lib/axios';
import { Swords, RefreshCw, Eye, Zap } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { MatchStatsDetail } from '@/components/MatchStatsDetail';
import type { MatchStatsResponse } from '@/types/riot-match';

// Mismo payload que MatchStatsDetail (blueTeam/redTeam + objetivos + team1Side).
interface MatchParticipant {
  summonerName: string; tagLine?: string; championName: string; champLevel: number;
  teamId: number; win: boolean;
  kills: number; deaths: number; assists: number; kda: number;
  cs: number; csPerMin: number; goldEarned: number;
  totalDamageDealt: number; visionScore: number;
  wardsPlaced: number; wardsKilled: number;
  items: number[]; pentaKills: number;
}
interface MatchStats {
  matchId: string; gameDuration: number; gameMode: string;
  blueTeam: MatchParticipant[]; redTeam: MatchParticipant[];
  winner: 'blue' | 'red';
  /** Lado de team1 en este juego: en una serie cambian de lado entre juegos. */
  team1Side?: 'blue' | 'red' | null;
  /** Serie Bo3/Bo5: TODOS los juegos en orden (el top-level es el último). */
  games?: (Omit<MatchStats, 'games'> & { gameNumber?: number })[];
}

interface BracketMatch {
  id: string; team1: string | null; team2: string | null;
  winner: string | null; code: string | null;
  matchStatus: string; gameId?: number; score1?: number; score2?: number;
}

interface TournamentMatchStatsProps {
  tournamentId: string;
  match: BracketMatch;
  isActive: boolean;
  /** Salida del estado "spectator pendiente": filtrar Partidas por esta ronda. */
  onSeeRound?: () => void;
  /** Enlace a la página en vivo de esta serie. */
  liveHref?: string;
}

export function TournamentMatchStats({ tournamentId, match, isActive, onSeeRound, liveHref }: TournamentMatchStatsProps) {
  const [stats, setStats]       = useState<MatchStats | null>(null);
  const [loading, setLoading]   = useState(false);
  const [polling, setPolling]   = useState(false);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);
  const [error, setError]       = useState<string | null>(null);
  // Serie Bo3/Bo5: juego seleccionado (null = el último jugado)
  const [gameIdx, setGameIdx]   = useState<number | null>(null);
  // Replays (.rofl) guardados en ATAK.GG para los juegos de esta serie (los sube el companion).
  const [replays, setReplays] = useState<Record<number, string>>({});
  useEffect(() => {
    let alive = true;
    axiosInstance.get(`/api/replays/tournament/${tournamentId}`)
      .then(({ data }) => { if (!alive) return; const m: Record<number, string> = {}; for (const r of data?.replays ?? []) if (r.matchId === match.id) m[r.gameId] = r.url; setReplays(m); })
      .catch(() => { /* sin replays aún */ });
    return () => { alive = false; };
  }, [tournamentId, match.id, stats?.games?.length, stats?.matchId]);

  const fetchStats = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const { data } = await axiosInstance.get(`/api/tournaments/${tournamentId}/matches/${match.id}/stats`);
      setStats(data);
      setError(null);
      setPolling(false); // Tenemos datos, detener polling
    } catch (err: any) {
      // 404 = aún no hay gameId, seguir polling en silencio
      if (err?.response?.status !== 404) {
        setError(err?.response?.data?.error ?? err?.message ?? 'Error al obtener stats');
      }
    } finally {
      if (!silent) setLoading(false);
      setLastCheck(new Date());
    }
  }, [tournamentId, match.id]);

  // Auto-poll cada 30s cuando el partido está activo y no tenemos stats.
  // También partidos 'complete' sin gameId: el backend puede auto-detectarlo
  // vía código de torneo o recuperarlo del historial del roster.
  useEffect(() => {
    if (!isActive || stats || match.matchStatus === 'pending') return;
    if (!match.gameId && match.matchStatus !== 'active' && match.matchStatus !== 'complete') return;

    setPolling(true);
    const interval = setInterval(() => fetchStats(true), 30_000);
    fetchStats(true);
    return () => { clearInterval(interval); setPolling(false); };
  }, [isActive, match.matchStatus, match.gameId, stats, fetchStats]);

  if (!match.team1 || !match.team2 || match.matchStatus === 'pending') return null;

  // Vista actual: en series Bo3/Bo5 muestra el juego elegido (default: último)
  const games = stats?.games?.length ? stats.games : null;
  const view: MatchStats | null = stats
    ? (games ? { ...games[gameIdx ?? games.length - 1], games: undefined } as MatchStats : stats)
    : null;

  // Ganador de un juego por NOMBRE de equipo: el lado ganador se traduce con
  // team1Side (sin él se asume team1 = azul, como antes).
  const winnerOf = (g: { winner: 'blue' | 'red'; team1Side?: 'blue' | 'red' | null }) =>
    g.winner === (g.team1Side ?? 'blue') ? match.team1 : match.team2;

  return (
    <div className="mt-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <Zap className="h-4 w-4 text-purple-400" />
          <span className="text-gray-300">Stats del partido</span>
          {polling && (
            <span className="flex items-center gap-1 text-xs text-yellow-400 animate-pulse">
              <RefreshCw className="h-3 w-3 animate-spin" />actualizando...
            </span>
          )}
          {lastCheck && !polling && (
            <span className="text-xs text-gray-600">
              · {lastCheck.toLocaleTimeString('es-MX', { hour:'2-digit', minute:'2-digit' })}
            </span>
          )}
        </div>
        <Button
          size="sm" variant="ghost"
          onClick={() => fetchStats()}
          disabled={loading}
          className="h-7 text-xs text-gray-400 hover:text-white"
        >
          <RefreshCw className={`h-3 w-3 mr-1 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>

      {/* Esqueleto con la forma del scoreboard: dos columnas de 5 jugadores. */}
      {loading && !stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3" aria-busy="true" aria-label="Cargando scoreboard">
          {[0, 1].map((side) => (
            <div key={side} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3">
              <Skeleton variant="line" width="42%" height={11} />
              <div className="mt-3 space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Skeleton variant="block" width={28} height={28} style={{ borderRadius: 8 }} />
                    <div className="flex-1 min-w-0">
                      <Skeleton variant="line" width="60%" height={9} />
                      <div className="mt-1"><Skeleton variant="line" width="35%" height={8} /></div>
                    </div>
                    <Skeleton variant="line" width={46} height={10} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {error && !stats && !loading && (
        <div className="text-center py-6 text-xs bg-red-950/20 rounded-xl border border-red-800/30">
          <p className="text-red-300">{error}</p>
          <button
            onClick={() => fetchStats()}
            className="mt-2 px-3 py-1 rounded-lg text-red-200 border border-red-700/40 hover:bg-red-900/30 transition"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Serie en curso sin datos todavía: se dice por qué y qué hacer, en vez
          de dejar un spinner eterno o un marcador falso a 0-0. */}
      {!stats && !loading && match.matchStatus === 'active' && (
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-5 text-center">
          <Swords className="h-6 w-6 mx-auto mb-2 text-white/20" />
          <p className="text-sm font-semibold text-white/70">Ronda activa — spectator pendiente</p>
          <p className="mt-1 text-xs text-white/40 max-w-md mx-auto leading-relaxed">
            La serie está en curso. El marcador en vivo aparecerá cuando el Spectator Companion
            esté conectado; las stats completas se guardan al terminar cada partida.
          </p>
          {match.code && (
            <p className="mt-2 text-[11px] text-purple-300/80">
              Código activo: <span className="font-mono">{match.code}</span>
            </p>
          )}
          {(onSeeRound || liveHref) && (
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
              {onSeeRound && (
                <button type="button" onClick={onSeeRound}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold text-white/80
                    border border-white/[0.14] hover:border-white/30 hover:text-white transition">
                  Ver Partidas de la ronda
                </button>
              )}
              {liveHref && (
                <a href={liveHref}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold text-[#e1242e]
                    border border-[#e1242e]/40 hover:bg-[#e1242e]/10 transition">
                  Abrir página en vivo
                </a>
              )}
            </div>
          )}
        </div>
      )}

      {view && (
        <>
          {/* Serie Bo3/Bo5: selector de juego + marcador global */}
          {games && games.length > 1 && (
            <div className="flex flex-wrap items-center justify-center gap-2 py-2">
              <span className="text-[10px] uppercase tracking-[0.18em] text-gray-500 mr-1">
                Serie {match.score1 ?? 0}–{match.score2 ?? 0}
              </span>
              {games.map((g, i) => {
                const active = (gameIdx ?? games.length - 1) === i;
                const winnerName = winnerOf(g);
                return (
                  <button
                    key={i}
                    onClick={() => setGameIdx(i)}
                    className={`flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-bold transition-all ${
                      active
                        ? 'bg-red-600 text-white shadow-[0_4px_14px_rgba(225,36,46,0.35)]'
                        : 'bg-white/[0.04] text-gray-400 border border-white/[0.08] hover:text-white hover:border-white/20'
                    }`}
                    title={`Ganó ${winnerName}`}
                  >
                    Juego {g.gameNumber ?? i + 1}
                    <span className={`max-w-[9rem] truncate font-semibold ${active ? 'text-white/85' : 'text-gray-500'}`}>
                      · {winnerName}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {(() => {
            const g: any = games ? games[gameIdx ?? games.length - 1] : stats;
            const gid = Number(String(g?.matchId || '').split('_')[1]) || Number(match.gameId);
            const url = gid ? replays[gid] : undefined;
            return url ? (
              <div className="flex justify-center -mt-1 mb-2">
                <a href={url} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-bold bg-white/[0.04] text-gray-300 border border-white/[0.08] hover:text-white hover:border-white/20"
                  title="Archivo .rofl: ábrelo con el cliente de League (mismo parche) para ver la repetición">
                  <Eye className="h-3.5 w-3.5" /> Descargar replay
                </a>
              </div>
            ) : null;
          })()}

          <MatchStatsDetail
            key={view.matchId}
            stats={view as unknown as MatchStatsResponse}
            loading={false}
            bracketMatchId={match.id}
            gameId={Number(String(view.matchId || '').split('_')[1]) || match.gameId || 1}
            team1={match.team1}
            team2={match.team2}
            celebrate={false}
          />
        </>
      )}
    </div>
  );
}
