// src/pages/TournamentLivePage.tsx — Torneo en vivo: cada serie como un marcador de retransmisión
// (sistema "Arena": design-system/atak-gg/MASTER.md · src/styles/pages/match.css).
import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { motion, AnimatePresence } from 'framer-motion';
import { axiosInstance } from '@/lib/axios';
import {
  ArrowLeft, Wifi, WifiOff, RefreshCw, Trophy,
  Clock, Swords, Crown, AlertCircle,
  Flame, ChevronRight, Copy, Check, Zap, BarChart3,
} from 'lucide-react';
import { ArenaPage, SplashBackdrop, ChampIcon, RoleIcon, StatIcon, UiIcon } from '@/components/arena/primitives';
import { Button, StatusChip, SectionHead, ProgressBar, TeamBadge } from '@/components/tournament/ui';
import { BanTile, Slot, Kda } from '@/components/match/parts';
import { lol } from '@/lib/lolAssets';
import '@/styles/pages/match.css';

/** Fase del torneo en español (el payload la trae en inglés). */
const PHASE_ES: Record<string, string> = {
  registration: 'Inscripciones',
  checkin: 'Check-in',
  active: 'En curso',
  complete: 'Finalizado',
  cancelled: 'Cancelado',
};

// ─── Constants ───────────────────────────────────────────────────────────────
const FALLBACK_VER = '14.24.1';
// Single source of truth for the API origin — mirror the axios client so the
// SSE EventSource never diverges from the rest of the app's requests.
const API_BASE = (axiosInstance.defaults.baseURL as string) || 'http://localhost:4000';

const SPELL_KEYS: Record<number, string> = {
  1:'SummonerBoost', 3:'SummonerExhaust', 4:'SummonerFlash',
  6:'SummonerHaste', 7:'SummonerHeal', 11:'SummonerSmite',
  12:'SummonerTeleport', 13:'SummonerMana', 14:'SummonerDot',
  21:'SummonerBarrier', 32:'SummonerSnowball',
};

// ─── Types ────────────────────────────────────────────────────────────────────
interface LiveParticipant {
  summonerName: string; riotId: string | null;
  championId: number; spell1Id: number; spell2Id: number; teamId: number;
}
interface LiveMatch {
  matchId: string; round: number; matchNumber: number;
  team1: string | null; team2: string | null;
  score1: number; score2: number; matchStatus: string;
  code: string | null; isLive: boolean;
  gameId: number | null; gameLength: number;
  blueTeam: LiveParticipant[]; redTeam: LiveParticipant[];
  bannedChampions: Array<{ championId: number; teamId: number; pickTurn: number }>;
}
type ViewerAccess = 'owner' | 'participant' | 'public';

interface LiveData {
  tournamentId: string; tournamentName: string;
  phase: string; region: string;
  logoUrl?: string; bannerUrl?: string;
  viewerAccess?: ViewerAccess;
  matches: LiveMatch[]; timestamp?: number;
}

// ─── DDragon helpers ──────────────────────────────────────────────────────────
function champIcon(name: string, ver: string) {
  return `https://ddragon.leagueoflegends.com/cdn/${ver}/img/champion/${name}.png`;
}
function spellIcon(id: number, ver: string) {
  const key = SPELL_KEYS[id] ?? 'SummonerFlash';
  return `https://ddragon.leagueoflegends.com/cdn/${ver}/img/spell/${key}.png`;
}

function fmtTime(s: number) {
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}
function roundLabel(round: number, total: number) {
  const d = total - round;
  if (d === 0) return 'Gran final';
  if (d === 1) return 'Semifinal';
  if (d === 2) return 'Cuartos';
  return `Ronda ${round}`;
}

// ─── Live timer ───────────────────────────────────────────────────────────────
function LiveTimer({ initial }: { initial: number }) {
  const [secs, setSecs] = useState(initial);
  useEffect(() => {
    const id = setInterval(() => setSecs(s => s + 1), 1000);
    return () => clearInterval(id);
  }, []);
  return <span>{fmtTime(secs)}</span>;
}

// ─── Campeón elegido (arte vertical, cinco por lado) ──────────────────────────
function ChampCard({
  participant, champMap, version,
}: {
  participant: LiveParticipant;
  champMap: Map<number, string>;
  version: string;
  side: 'blue' | 'red';
}) {
  const champName = champMap.get(participant.championId);
  const [imgErr, setImgErr] = useState(false);

  return (
    <div className="mx-pick" title={champName ? `${participant.summonerName} · ${champName}` : participant.summonerName}>
      {champName && !imgErr ? (
        <img
          className="mx-pick-art"
          src={lol.loading(champName)}
          alt={champName}
          onError={() => setImgErr(true)}
          loading="lazy"
          decoding="async"
        />
      ) : (
        <span className="mx-pick-none" aria-hidden>?</span>
      )}

      {/* Arriba: hechizos de invocador */}
      <div className="mx-pick-top">
        {[participant.spell1Id, participant.spell2Id].map((sid, i) => (
          <img key={i} src={spellIcon(sid, version)} alt="" loading="lazy"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        ))}
      </div>

      {/* Abajo: jugador y campeón */}
      <div className="mx-pick-bottom">
        <div className="mx-pick-name">{participant.summonerName}</div>
        {champName && <div className="mx-pick-champ">{champName}</div>}
      </div>
    </div>
  );
}

// ─── Bloqueo ──────────────────────────────────────────────────────────────────
function BanChip({ championId, champMap, version }: { championId: number; champMap: Map<number,string>; version: string }) {
  const name = champMap.get(championId);
  return <BanTile src={name ? champIcon(name, version) : null} name={name} />;
}

// ─── Copiar código de torneo ──────────────────────────────────────────────────
function CopyCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button type="button" onClick={copy} className="mx-code" title="Copiar código de torneo">
      {copied ? <Check size={14} style={{ color: 'var(--td-green)' }} /> : <Copy size={14} />}
      <span>{code}</span>
    </button>
  );
}

// ─── Post-game stats ──────────────────────────────────────────────────────────
interface StatPlayer {
  summonerName: string; tagLine?: string; championName: string; champLevel: number;
  teamId: number; win: boolean;
  kills: number; deaths: number; assists: number; kda: number;
  cs: number; csPerMin: number; goldEarned: number; totalDamageDealt: number;
  visionScore: number; items: number[];
  pentaKills: number; quadraKills: number; tripleKills: number; firstBloodKill: boolean;
}
interface MatchStats {
  matchId: string; gameDuration: number; gameMode: string;
  blueTeam: StatPlayer[]; redTeam: StatPlayer[];
  winner: 'blue' | 'red';
}

function fmtDuration(s: number) {
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}
function fmtNum(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

function StatRow({ p, version, maxDmg, side }: { p: StatPlayer; version: string; maxDmg: number; side: 'blue' | 'red' }) {
  const champImg = `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${p.championName}.png`;
  const itemImg  = (id: number) => `https://ddragon.leagueoflegends.com/cdn/${version}/img/item/${id}.png`;
  const position = (p as any).teamPosition as string | undefined;

  return (
    <tr data-fb={p.firstBloodKill ? 'true' : undefined}>
      {/* Jugador */}
      <td>
        <div className="mx-player">
          <span className="mx-champ">
            <ChampIcon src={champImg} name={p.championName} size={36} />
            <span className="mx-lvl">{p.champLevel}</span>
          </span>
          <div style={{ minWidth: 0 }}>
            <div className="mx-pname">
              <b title={p.summonerName}>{p.summonerName}</b>
              {p.pentaKills > 0 && <StatusChip kind="gold" dot={false}>Penta</StatusChip>}
              {!p.pentaKills && p.quadraKills > 0 && <StatusChip kind="gold" dot={false}>Quadra</StatusChip>}
              {!p.pentaKills && !p.quadraKills && p.tripleKills > 0 && <StatusChip kind="dim" dot={false}>Triple</StatusChip>}
            </div>
            <div className="mx-psub">
              {position && <RoleIcon lane={position} size={13} />}
              <span>{p.championName}{p.firstBloodKill ? ' · 1.ª sangre' : ''}</span>
            </div>
          </div>
        </div>
      </td>
      {/* KDA */}
      <td className="mx-c">
        <Kda k={p.kills} d={p.deaths} a={p.assists} />
        <span className="mx-sub">{p.kda.toFixed(2)} KDA</span>
      </td>
      {/* Daño */}
      <td>
        <div className="mx-dmg" style={{ minWidth: 0 }}>
          <span className="mx-dmg-num">{fmtNum(p.totalDamageDealt)}</span>
          <ProgressBar pct={maxDmg > 0 ? (p.totalDamageDealt / maxDmg) * 100 : 0}
            kind={side === 'blue' ? 'var(--td-live, #3b82f6)' : 'red'} height={5} />
        </div>
      </td>
      {/* CS */}
      <td className="mx-c">
        <span className="td-num" style={{ fontWeight: 700 }}>{p.cs}</span>
        <span className="mx-sub">{p.csPerMin}/min</span>
      </td>
      {/* Oro */}
      <td className="mx-c"><span className="mx-gold">{fmtNum(p.goldEarned)}</span></td>
      {/* Objetos */}
      <td>
        <div className="mx-items">
          {Array.from({ length: 7 }, (_, i) => p.items[i] || 0).map((itemId, i) => (
            <Slot key={i} src={itemId > 0 ? itemImg(itemId) : ''} size={26} />
          ))}
        </div>
      </td>
    </tr>
  );
}

function PostGameStats({ stats, version }: { stats: MatchStats; version: string }) {
  const blueWon = stats.winner === 'blue';
  const maxDmg = Math.max(...[...stats.blueTeam, ...stats.redTeam].map(p => p.totalDamageDealt), 1);

  const teamBlock = (players: StatPlayer[], side: 'blue' | 'red', won: boolean) => (
    <div className="mx-post-team" data-side={side}>
      <div className="mx-team-head">
        <span className="mx-team-name">{side === 'blue' ? 'Lado azul' : 'Lado rojo'}</span>
        {won
          ? <StatusChip kind="pos" dot={false}><Trophy size={12} aria-hidden /> Victoria</StatusChip>
          : <StatusChip kind="warn" dot={false}>Derrota</StatusChip>}
        <div className="mx-team-totals">
          <span title="Asesinatos del equipo"><UiIcon name="score" size={18} />{players.reduce((a, p) => a + p.kills, 0)}</span>
          <span title="Oro del equipo"><UiIcon name="gold" size={18} />{fmtNum(players.reduce((a, p) => a + p.goldEarned, 0))}</span>
        </div>
      </div>
      <div className="ax-table-scroll">
        <table className="ax-table mx-table">
          <colgroup>
            <col className="mx-col-player" /><col style={{ width: 116 }} /><col /><col style={{ width: 92 }} />
            <col style={{ width: 84 }} /><col style={{ width: 232 }} />
          </colgroup>
          <thead>
            <tr>
              <th><span>Jugador</span></th>
              <th style={{ textAlign: 'center' }}><span><UiIcon name="score" size={16} />K / D / A</span></th>
              <th><span><StatIcon stat="attack_damage" size={13} />Daño</span></th>
              <th style={{ textAlign: 'center' }}><span><UiIcon name="minion" size={16} />CS</span></th>
              <th style={{ textAlign: 'center' }}><span><UiIcon name="gold" size={16} />Oro</span></th>
              <th><span><UiIcon name="items" size={16} />Objetos</span></th>
            </tr>
          </thead>
          <tbody>
            {players.map((p, i) => <StatRow key={i} p={p} version={version} maxDmg={maxDmg} side={side} />)}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="mx-post">
      <div className="mx-series-row" style={{ borderTop: 'none' }}>
        <span className="td-over" style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
          <BarChart3 size={13} aria-hidden /> Stats finales
        </span>
        <span className="mx-series-tools">
          <span className="mx-bug-fact"><Clock size={14} aria-hidden /><b>{fmtDuration(stats.gameDuration)}</b></span>
          <span className="mx-bug-fact">{stats.gameMode}</span>
          <span className="mx-mono">{stats.matchId}</span>
        </span>
      </div>
      {teamBlock(stats.blueTeam, 'blue', blueWon)}
      {teamBlock(stats.redTeam, 'red', !blueWon)}
    </div>
  );
}

// ─── Tarjeta de serie — marcador de retransmisión ─────────────────────────────
function MatchCard({
  match, champMap, version, totalRounds, tournamentId, canViewCodes,
}: {
  match: LiveMatch; champMap: Map<number, string>; version: string; totalRounds: number; tournamentId: string;
  canViewCodes: boolean;
}) {
  const [stats,           setStats]           = useState<MatchStats | null>(null);
  const [statsLoading,    setStatsLoading]    = useState(false);
  const [statsError,      setStatsError]      = useState('');
  const [statsOpen,       setStatsOpen]       = useState(false);
  const [manualGameId,    setManualGameId]    = useState('');
  const [showGameIdInput, setShowGameIdInput] = useState(false);
  // Refs separados: si el auto-detect falla, NO debe bloquear la carga de
  // stats cuando el gameId llegue después por SSE (antes un solo ref lo hacía).
  const autoLoadedRef  = useRef(false);
  const detectTriedRef = useRef(false);

  const loadStats = async () => {
    setStatsLoading(true);
    setStatsError('');
    try {
      const { data } = await axiosInstance.get<MatchStats>(
        `/api/tournaments/${tournamentId}/matches/${match.matchId}/stats`
      );
      setStats(data);
      setStatsOpen(true);
    } catch (e: any) {
      setStatsError(e?.response?.data?.error ?? 'No se encontraron stats');
    } finally {
      setStatsLoading(false);
    }
  };

  const detectAndLoadStats = async () => {
    setStatsLoading(true);
    setStatsError('');
    try {
      await axiosInstance.post(
        `/api/tournaments/${tournamentId}/matches/${match.matchId}/auto-detect-game`
      );
      await loadStats();
    } catch (e: any) {
      const msg = e?.response?.data?.error ?? 'No se encontró la partida. Ingresa el Game ID manualmente.';
      setStatsError(msg);
      setShowGameIdInput(true);
      setStatsLoading(false);
    }
  };

  const linkManualGameId = async () => {
    const gid = manualGameId.trim();
    if (!gid || isNaN(Number(gid))) return;
    setStatsLoading(true);
    setStatsError('');
    try {
      await axiosInstance.post(
        `/api/tournaments/${tournamentId}/matches/${match.matchId}/link-gameid`,
        { gameId: Number(gid) }
      );
      await loadStats();
      setShowGameIdInput(false);
    } catch (e: any) {
      setStatsError(e?.response?.data?.error ?? 'Error al vincular Game ID');
      setStatsLoading(false);
    }
  };

  // Auto-load: if gameId is already linked, fetch stats immediately on mount
  useEffect(() => {
    if (match.gameId && !match.isLive &&
        (match.matchStatus === 'active' || match.matchStatus === 'complete') &&
        !stats && !autoLoadedRef.current) {
      autoLoadedRef.current = true;
      loadStats();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match.gameId]);

  // Auto-detect: when a match that had a code becomes non-live, try to detect
  useEffect(() => {
    if (!match.isLive && match.matchStatus === 'active' && match.code &&
        !match.gameId && !stats && !detectTriedRef.current) {
      detectTriedRef.current = true;
      detectAndLoadStats();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match.isLive]);

  const blueBans = match.bannedChampions.filter(b => b.teamId === 100);
  const redBans  = match.bannedChampions.filter(b => b.teamId === 200);
  const hasGame  = match.blueTeam.length > 0 || match.redTeam.length > 0;
  const statsRow = !match.isLive && (match.matchStatus === 'active' || match.matchStatus === 'complete');

  return (
    // data-live-match: ancla del enlace `?match=` que llega desde el dashboard.
    <article data-live-match={match.matchId} className="mx-bug ax-rise" data-live={match.isLive ? 'true' : undefined}
      aria-label={`${match.team1 ?? 'Por definir'} contra ${match.team2 ?? 'Por definir'}`}>

      {/* ── Cabecera: ronda, estado, reloj y código ─────────────────────────── */}
      <div className="mx-bug-top">
        <span className="td-over">{roundLabel(match.round, totalRounds)} · P{match.matchNumber}</span>
        {match.isLive && <StatusChip kind="live">En vivo</StatusChip>}
        {match.matchStatus === 'ready' && !match.isLive && (
          <StatusChip kind="gold" dot={false}><Zap size={12} aria-hidden /> Código listo</StatusChip>
        )}
        {match.matchStatus === 'active' && !match.isLive && <StatusChip kind="registration">Serie en curso</StatusChip>}
        {match.matchStatus === 'complete' && !match.isLive && <StatusChip kind="finished" dot={false}>Finalizada</StatusChip>}
        <span className="mx-spacer" />
        {match.isLive && (
          <span className="mx-timer" title="Tiempo de partida">
            <Clock size={16} aria-hidden />
            <LiveTimer initial={match.gameLength} />
          </span>
        )}
        {canViewCodes && match.code && <CopyCode code={match.code} />}
      </div>

      {/* ── Marcador de la serie ────────────────────────────────────────────── */}
      <div className="mx-bug-main">
        <div className="mx-side" data-side="blue">
          <span className="td-over mx-side-tag">Lado azul</span>
          <span className="mx-side-team">
            <TeamBadge name={match.team1 ?? undefined} size={40} />
            <span className="mx-side-name">{match.team1 ?? 'Por definir'}</span>
          </span>
        </div>
        <div className="mx-score">
          <div className="mx-score-nums" data-size="md" aria-label={`Marcador de la serie: ${match.score1} a ${match.score2}`}>
            <span>{match.score1}</span>
            <span className="mx-score-sep" aria-hidden />
            <span>{match.score2}</span>
          </div>
        </div>
        <div className="mx-side" data-side="red">
          <span className="td-over mx-side-tag">Lado rojo</span>
          <span className="mx-side-team">
            <TeamBadge name={match.team2 ?? undefined} size={40} />
            <span className="mx-side-name">{match.team2 ?? 'Por definir'}</span>
          </span>
        </div>
      </div>

      {/* ── Composiciones ───────────────────────────────────────────────────── */}
      {hasGame ? (
        <div className="mx-draft">
          <div className="mx-draft-side" data-side="blue">
            {match.blueTeam.slice(0, 5).map((p, i) => (
              <ChampCard key={i} participant={p} champMap={champMap} version={version} side="blue" />
            ))}
          </div>
          <span className="mx-draft-vs" aria-hidden>VS</span>
          <div className="mx-draft-side" data-side="red">
            {match.redTeam.slice(0, 5).map((p, i) => (
              <ChampCard key={i} participant={p} champMap={champMap} version={version} side="red" />
            ))}
          </div>
        </div>
      ) : (
        /* Sin datos de spectator: se explica el porqué, sin spinner eterno */
        <div className="mx-state" style={{ borderTop: '1px solid var(--td-border)', padding: '34px 20px' }}>
          <Swords size={32} aria-hidden />
          <h3>
            {match.matchStatus === 'ready'
              ? 'Partida lista — esperando el lobby'
              : match.matchStatus === 'active'
              ? 'Ronda activa — spectator pendiente'
              : 'Esperando que empiece la partida…'}
          </h3>
          {match.matchStatus === 'active' && (
            <p>
              La serie está en curso. El marcador en vivo aparecerá cuando el Spectator Companion
              esté conectado.
            </p>
          )}
          {canViewCodes && match.code && (
            <p className="mx-mono" style={{ marginTop: 8 }}>Código: <span style={{ color: 'var(--td-text-2)' }}>{match.code}</span></p>
          )}
          {!canViewCodes && (match.matchStatus === 'ready' || match.matchStatus === 'active') && (
            <p style={{ marginTop: 8, fontSize: 13.5, color: 'var(--td-muted)' }}>Código disponible solo para jugadores inscritos</p>
          )}
        </div>
      )}

      {/* ── Bloqueos ────────────────────────────────────────────────────────── */}
      {(blueBans.length > 0 || redBans.length > 0) && (
        <div className="mx-series-row">
          <div className="mx-bans">
            <span className="td-over">Bloqueos</span>
            <div className="mx-bans-list">
              {blueBans.map((b, i) => (
                <BanChip key={i} championId={b.championId} champMap={champMap} version={version} />
              ))}
            </div>
          </div>
          <div className="mx-bans">
            <div className="mx-bans-list">
              {redBans.map((b, i) => (
                <BanChip key={i} championId={b.championId} champMap={champMap} version={version} />
              ))}
            </div>
            <span className="td-over">Bloqueos</span>
          </div>
        </div>
      )}

      {/* ── Espectador / stats ──────────────────────────────────────────────── */}
      {match.isLive && match.gameId && (
        <div className="mx-series-row" data-tone="live">
          <span className="mx-bug-fact">
            <Flame size={14} aria-hidden style={{ color: 'var(--td-red-hover)' }} />
            Game ID <b>{match.gameId}</b>
          </span>
          <code className="mx-mono">spectator.leagueoflegends.com/{match.gameId}</code>
        </div>
      )}

      {/* Fila de stats — series activas o terminadas que no están en vivo */}
      {statsRow && (
        <div className="mx-series-row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
          <div className="mx-series-tools" style={{ justifyContent: 'space-between' }}>
            <div className="mx-series-tools">
              <Button
                variant="secondary"
                onClick={stats ? () => setStatsOpen(o => !o) : detectAndLoadStats}
                disabled={statsLoading}
                icon={statsLoading ? <RefreshCw size={15} className="mx-spin" /> : <BarChart3 size={15} />}
              >
                {statsLoading ? 'Buscando…' : stats ? `${statsOpen ? 'Ocultar' : 'Ver'} stats` : 'Detectar stats'}
              </Button>
              {match.gameId && <span className="mx-mono">ID {match.gameId}</span>}
              {!match.gameId && !showGameIdInput && (
                <button type="button" onClick={() => setShowGameIdInput(true)} className="mx-textbtn" data-underline="true">
                  Ingresar Game ID
                </button>
              )}
            </div>
            {statsError && !showGameIdInput && (
              <span className="td-error" role="alert">{statsError}</span>
            )}
          </div>

          {/* Game ID manual */}
          {showGameIdInput && (
            <div className="mx-series-tools">
              <input
                type="text"
                inputMode="numeric"
                aria-label="Game ID del cliente de LoL"
                placeholder="Game ID del cliente LoL (ej: 1723716463)"
                value={manualGameId}
                onChange={e => setManualGameId(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && linkManualGameId()}
                className="td-input"
              />
              <Button
                variant="secondary"
                onClick={linkManualGameId}
                disabled={statsLoading || !manualGameId.trim()}
                icon={statsLoading ? <RefreshCw size={15} className="mx-spin" /> : <BarChart3 size={15} />}
              >
                Vincular
              </Button>
              <button type="button" onClick={() => setShowGameIdInput(false)} className="mx-textbtn">
                Cancelar
              </button>
              {statsError && (
                <span className="td-error" role="alert">{statsError}</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Stats de fin de partida ─────────────────────────────────────────── */}
      <AnimatePresence>
        {statsOpen && stats && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <PostGameStats stats={stats} version={version} />
          </motion.div>
        )}
      </AnimatePresence>
    </article>
  );
}

// ─── Bracket (lateral) ────────────────────────────────────────────────────────
function BracketSidebar({ matches, total }: { matches: LiveMatch[]; total: number }) {
  const rounds = [...new Set(matches.map(m => m.round))].sort((a, b) => a - b);
  return (
    <div>
      {rounds.map(r => (
        <div key={r} className="mx-bround">
          <span className="td-over">{roundLabel(r, total)}</span>
          {matches.filter(m => m.round === r).map(m => (
            <div key={m.matchId} className="mx-brow"
              data-state={m.isLive ? 'live' : m.matchStatus === 'complete' ? 'complete' : undefined}>
              {m.isLive && <span className="mx-dot td-dot-pulse" style={{ ['--c' as string]: 'var(--td-red)' }} aria-hidden />}
              <span>{m.team1 ?? 'Por definir'}</span>
              <i>vs</i>
              <span>{m.team2 ?? 'Por definir'}</span>
              {(m.score1 > 0 || m.score2 > 0) && <b>{m.score1}–{m.score2}</b>}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function TournamentLivePage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData]           = useState<LiveData | null>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [connected, setConnected] = useState(false);  // SSE connected
  const [lastRefresh, setLastRefresh] = useState(Date.now());
  const [countdown, setCountdown] = useState(15);
  const [ddVersion, setDdVersion] = useState(FALLBACK_VER);
  const [champMap, setChampMap]   = useState<Map<number, string>>(new Map());

  const esRef     = useRef<EventSource | null>(null);

  // ── Fetch DDragon version + champion map ────────────────────────────────────
  useEffect(() => {
    fetch('https://ddragon.leagueoflegends.com/api/versions.json')
      .then(r => r.json())
      .then(async (versions: string[]) => {
        const ver = versions[0] ?? FALLBACK_VER;
        setDdVersion(ver);
        const champData = await fetch(
          `https://ddragon.leagueoflegends.com/cdn/${ver}/data/en_US/champion.json`
        ).then(r => r.json());
        const map = new Map<number, string>();
        Object.values(champData.data as Record<string, any>).forEach(c => {
          map.set(Number(c.key), c.id);
        });
        setChampMap(map);
      })
      .catch(() => {});
  }, []);

  // ── Polling fallback ────────────────────────────────────────────────────────
  const fetchFallback = useCallback(async () => {
    if (!id) return;
    try {
      const { data: d } = await axiosInstance.get<LiveData>(`/api/tournaments/${id}/live-matches`);
      setData(d);
      setError('');
    } catch (e: any) {
      setError(e?.response?.data?.error ?? 'Error al cargar datos');
    } finally {
      setLoading(false);
      setLastRefresh(Date.now());
      setCountdown(15);
    }
  }, [id]);

  const canViewCodes = data?.viewerAccess === 'owner' || data?.viewerAccess === 'participant';

  // ── SSE connection ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return;

    const token = localStorage.getItem('access_token');
    const url = token
      ? `${API_BASE}/api/tournaments/${id}/live-stream?token=${encodeURIComponent(token)}`
      : `${API_BASE}/api/tournaments/${id}/live-stream`;
    const es   = new EventSource(url);
    esRef.current = es;

    es.onmessage = (event) => {
      try {
        const parsed: LiveData = JSON.parse(event.data);
        if ('error' in parsed) {
          setError((parsed as any).error);
        } else {
          setData(parsed);
          setError('');
          setLastRefresh(Date.now());
          setCountdown(15);
        }
      } catch {}
      setLoading(false);
    };

    // Mientras SSE esté caído: polling REAL cada 15s (antes se hacía un solo
    // fetch y los datos quedaban congelados con un countdown decorativo).
    // No cerramos el EventSource: el navegador reintenta la conexión solo, y
    // cuando vuelve (onopen) detenemos el polling.
    let poll: ReturnType<typeof setInterval> | null = null;
    const stopPoll = () => { if (poll) { clearInterval(poll); poll = null; } };
    es.onopen = () => { setConnected(true); setLoading(false); stopPoll(); };

    es.onerror = () => {
      setConnected(false);
      if (!poll) {
        fetchFallback();
        poll = setInterval(fetchFallback, 15_000);
      }
    };

    return () => { es.close(); esRef.current = null; stopPoll(); };
  }, [id, fetchFallback]);

  // ── Countdown ticker (visual only) ─────────────────────────────────────────
  useEffect(() => {
    const tick = setInterval(() => setCountdown(c => Math.max(0, c - 1)), 1000);
    return () => clearInterval(tick);
  }, []);

  const liveMatches    = (data?.matches ?? []).filter(m => m.isLive);
  const pendingMatches = (data?.matches ?? []).filter(m => !m.isLive);
  const totalRounds    = data?.matches?.length ? Math.max(...data.matches.map(m => m.round)) : 1;

  // `?match=` — llegada desde el dashboard ("Abrir página en vivo" / ESPECTAR):
  // se enfoca esa serie. Si no está en el payload se avisa en vez de dejar al
  // espectador buscándola entre las demás.
  const [search] = useSearchParams();
  const focusMatch = search.get('match');
  const focusedOnce = useRef(false);
  useEffect(() => {
    if (!focusMatch || !data || focusedOnce.current) return;
    focusedOnce.current = true;
    const found = (data.matches ?? []).some(m => m.matchId === focusMatch);
    if (!found) { toast.info('Partida no encontrada'); return; }
    const el = document.querySelector(`[data-live-match="${focusMatch}"]`);
    if (!el) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
    el.classList.add('td-pulse-hint');
    window.setTimeout(() => el.classList.remove('td-pulse-hint'), 1200);
  }, [focusMatch, data]);

  // Título del cartel: la última palabra va en crimson (igual que el héroe del torneo).
  const nameWords = (data?.tournamentName ?? '').trim().split(/\s+/).filter(Boolean);
  const nameLead = nameWords.slice(0, -1).join(' ');
  const nameTail = nameWords[nameWords.length - 1] ?? '';

  return (
    <ArenaPage
      width="wide"
      backdrop={<SplashBackdrop src={data?.bannerUrl || undefined} map="summoners-rift" opacity={data?.bannerUrl ? 0.4 : 0.9} position="50% 40%" />}
    >
      {/* ── Volver ─────────────────────────────────────────────────────────── */}
      <Link to={`/tournaments/${id}`} className="mx-back">
        <ArrowLeft size={16} aria-hidden /> Volver al torneo
      </Link>

      {/* ── Cabecera ───────────────────────────────────────────────────────── */}
      {data && (
        <header className="ax-hero mx-thero ax-rise" style={{ marginTop: 6 }}>
          <div className="ax-hero-art" aria-hidden>
            <div className="ax-hero-slab" />
            <div className="ax-hero-hatch" />
            <div className="ax-sweep" />
          </div>

          <div className="ax-hero-body">
            <div className="ax-hero-main">
              <div className="mx-thero-id">
                <div className="mx-thero-logo">
                  {data.logoUrl
                    ? <img src={data.logoUrl} alt="" />
                    : <Trophy size={30} aria-hidden />}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div className="ax-eyebrow">
                    {/* Estado de la conexión */}
                    {connected
                      ? <StatusChip kind="live"><Wifi size={12} aria-hidden /> Transmisión en vivo</StatusChip>
                      : <StatusChip kind="dim" dot={false}><WifiOff size={12} aria-hidden /> Modo polling</StatusChip>}
                    <span className="td-over">{data.region.toUpperCase()}</span>
                    <span className="td-over">{PHASE_ES[data.phase] ?? data.phase}</span>
                  </div>
                  <h1 className="ax-title">{nameLead && `${nameLead} `}<em>{nameTail}</em></h1>
                  <p className="ax-meta">
                    {liveMatches.length} partida{liveMatches.length !== 1 ? 's' : ''} en vivo
                    <i aria-hidden>/</i>
                    <span className="td-num">Actualización en {countdown}s</span>
                  </p>
                </div>
              </div>
            </div>

            <div className="ax-hero-actions">
              <Button variant="secondary" full onClick={() => { setLoading(true); fetchFallback(); }}
                icon={<RefreshCw size={15} className={loading ? 'mx-spin' : undefined} />}>
                Actualizar
              </Button>
            </div>
          </div>

          <dl className="ax-bug" style={{ ['--cols' as string]: 4, margin: 0 }}>
            <div className="ax-bug-cell" data-accent={liveMatches.length > 0 ? 'red' : undefined}>
              <dt className="td-over">En vivo</dt>
              <dd className="ax-bug-value" style={{ marginLeft: 0 }}>{liveMatches.length}</dd>
            </div>
            <div className="ax-bug-cell">
              <dt className="td-over">Próximas</dt>
              <dd className="ax-bug-value" style={{ marginLeft: 0 }}>{pendingMatches.length}</dd>
            </div>
            <div className="ax-bug-cell">
              <dt className="td-over">Fase</dt>
              <dd className="ax-bug-value" style={{ marginLeft: 0 }}>{PHASE_ES[data.phase] ?? data.phase}</dd>
            </div>
            <div className="ax-bug-cell">
              <dt className="td-over">Última actualización</dt>
              <dd className="ax-bug-value" style={{ marginLeft: 0 }}>{new Date(lastRefresh).toLocaleTimeString()}</dd>
            </div>
          </dl>
        </header>
      )}

      {/* ── Estados ────────────────────────────────────────────────────────── */}
      {/* Esqueleto con la forma de las tarjetas de partida: la página no salta
          al llegar los datos (CONVENTIONS: nada de spinner a nivel de panel). */}
      {loading && !data && (
        <div className="mx-series-list" style={{ marginTop: 18 }} aria-busy="true" aria-label="Cargando partidas">
          {[0, 1].map((i) => (
            <div key={i} className="td-panel mx-skel">
              <div className="mx-skel-row">
                <Skeleton variant="line" width={130} height={13} />
                <Skeleton variant="line" width={70} height={11} />
              </div>
              <div className="mx-skel-picks">
                {Array.from({ length: 5 }).map((_, k) => (
                  <Skeleton key={`b${k}`} variant="block" width={58} height={72} style={{ borderRadius: 6, flexShrink: 0 }} />
                ))}
                <Skeleton variant="line" width={28} height={22} style={{ flexShrink: 0 }} />
                {Array.from({ length: 5 }).map((_, k) => (
                  <Skeleton key={`r${k}`} variant="block" width={58} height={72} style={{ borderRadius: 6, flexShrink: 0 }} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {error && !data && (
        <div className="ax-empty" style={{ marginTop: 18 }} role="alert">
          <AlertCircle size={44} aria-hidden style={{ color: 'var(--td-neg)' }} />
          <h3>No se pudo cargar el torneo en vivo</h3>
          <p style={{ margin: 0 }}>{error}</p>
          <div className="mx-empty-actions">
            <Button variant="primary" icon={<RefreshCw size={15} />} onClick={fetchFallback}>Reintentar</Button>
            <Link to={`/tournaments/${id}`} className="td-btn td-btn--secondary">Volver al torneo</Link>
          </div>
        </div>
      )}

      {/* ── Contenido ──────────────────────────────────────────────────────── */}
      {data && (
        <div className="mx-live-layout">

          {/* Series */}
          <main className="mx-live-main">

            {/* En vivo */}
            {liveMatches.length > 0 && (
              <section>
                <SectionHead size="lg" icon={<Flame size={18} />} title={`Partidas en vivo (${liveMatches.length})`} />
                <div className="mx-series-list">
                  {liveMatches.map(m => (
                    <MatchCard key={m.matchId} match={m} champMap={champMap} version={ddVersion} totalRounds={totalRounds} tournamentId={id ?? ''} canViewCodes={canViewCodes} />
                  ))}
                </div>
              </section>
            )}

            {/* Próximas */}
            {pendingMatches.length > 0 && (
              <section>
                <SectionHead icon={<ChevronRight size={16} />} title={`Próximas partidas (${pendingMatches.length})`} />
                <div className="mx-series-list">
                  {pendingMatches.map(m => (
                    <MatchCard key={m.matchId} match={m} champMap={champMap} version={ddVersion} totalRounds={totalRounds} tournamentId={id ?? ''} canViewCodes={canViewCodes} />
                  ))}
                </div>
              </section>
            )}

            {liveMatches.length === 0 && pendingMatches.length === 0 && (
              <div className="ax-empty">
                <Swords size={44} aria-hidden style={{ color: 'var(--td-muted)' }} />
                <h3>No hay partidas activas</h3>
                <p style={{ margin: 0 }}>
                  {data.phase === 'registration' && 'El torneo aún está en fase de registro.'}
                  {data.phase === 'checkin'      && 'En fase de check-in.'}
                  {data.phase === 'complete'     && 'El torneo ha finalizado.'}
                  {data.phase === 'active'       && 'Esperando inicio de partidas…'}
                </p>
                <div className="mx-empty-actions">
                  <Link to={`/tournaments/${id}`} className="td-btn td-btn--secondary">
                    <ArrowLeft size={15} aria-hidden /> Volver al torneo
                  </Link>
                </div>
              </div>
            )}
          </main>

          {/* Lateral */}
          <aside className="mx-live-side">

            {/* Bracket */}
            {data.matches.length > 0 && (
              <div className="td-panel" style={{ padding: 16 }}>
                <SectionHead icon={<Crown size={15} />} title="Bracket" />
                <BracketSidebar matches={data.matches} total={totalRounds} />
              </div>
            )}

            {/* Leyenda */}
            <div className="td-panel" style={{ padding: 16 }}>
              <SectionHead title="Estado" />
              <ul className="mx-legend-list">
                {[
                  { c: 'var(--td-red)',   label: 'En vivo — partida activa' },
                  { c: 'var(--td-gold)',  label: 'Lista — código asignado' },
                  { c: 'var(--td-muted)', label: 'Pendiente' },
                ].map(({ c, label }) => (
                  <li key={label}>
                    <span className="mx-dot" style={{ ['--c' as string]: c }} aria-hidden />
                    {label}
                  </li>
                ))}
              </ul>
            </div>

            {/* Última actualización */}
            <p className="mx-note" style={{ margin: 0, textAlign: 'center' }}>
              Última actualización · <span className="td-num">{new Date(lastRefresh).toLocaleTimeString()}</span><br />
              Spectator API · se actualiza cada 15 s
            </p>
          </aside>
        </div>
      )}
    </ArenaPage>
  );
}
