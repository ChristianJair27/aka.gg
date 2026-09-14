// ATAK.GG — Dashboard de torneo (extraído del componente único original).
// Sin cambios de comportamiento.

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { axiosInstance } from '@/lib/axios';
import { qk } from '@/hooks/queries/keys';
import { toast } from 'sonner';
import { Users, Calendar, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { Button, StatusChip, TeamBadge } from '@/components/tournament/ui';
import { Tip } from '@/components/ui/Tip';
import { TournamentMatchStats } from '@/components/TournamentMatchStats';
import { discoveryToast } from '@/hooks/useTournamentDiscovery';
import type { BracketMatch } from '@/hooks/queries/tournaments';
import { RED, Card } from './shared';

export type MatchStatusFilter = 'all' | 'pending' | 'ready' | 'active' | 'complete';
export const MATCH_STATUS_PILLS: { key: MatchStatusFilter; label: string }[] = [
  { key: 'all', label: 'Todas' },
  { key: 'pending', label: 'Pendientes' },
  { key: 'ready', label: 'Listas' },
  { key: 'active', label: 'En juego' },
  { key: 'complete', label: 'Finalizadas' },
];

export function LobbyStatus({ id, matchId }: { id: string; matchId: string }) {
  const { data } = useQuery({
    queryKey: ['tournament-lobby', id, matchId],
    queryFn: async () => (await axiosInstance.get(`/api/tournaments/${id}/matches/${matchId}/lobby`)).data,
    refetchInterval: 30_000,
    staleTime: 20_000,
    retry: false,
  });
  if (!data?.hasCode) return null;
  const full = data.joined >= data.expected;
  return (
    <Tip label={
      data.gameStarted ? 'La partida ya empezó'
        : data.draftStarted ? 'Los equipos están en la fase de selección'
        : `Jugadores dentro del lobby de Riot: ${data.joined} de ${data.expected}`
    }>
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 700,
      padding: '4px 10px', borderRadius: 999,
      color: data.gameStarted ? 'var(--td-green)' : full ? 'var(--td-green)' : 'var(--td-text-2)',
      border: `1px solid ${full || data.gameStarted ? 'rgba(47,191,138,0.4)' : 'var(--td-border)'}`,
      background: full || data.gameStarted ? 'rgba(47,191,138,0.08)' : 'rgba(255,255,255,0.03)',
    }}>
      <Users size={11} />
      {data.gameStarted ? 'EN PARTIDA'
        : data.draftStarted ? 'EN DRAFT'
        : `Lobby ${data.joined}/${data.expected}`}
    </span>
    </Tip>
  );
}

export function MatchRow({ id, m, open, onToggle, inlineStats = true, onSeeRound, isOwner }: {
  id: string; m: BracketMatch;
  /** Abierta la controla PartidasTab: solo una serie a la vez. */
  open: boolean;
  onToggle: () => void;
  /** false en móvil: el detalle va en el cajón, no dentro de la fila. */
  inlineStats?: boolean;
  onSeeRound?: () => void;
  isOwner?: boolean;
}) {
  const hasStats = m.matchStatus !== 'pending';
  // Primera vez que alguien despliega una serie: se explica qué hay dentro.
  const toggleOpen = () => {
    if (!open) discoveryToast('match-expand', () => toast.message('Compara daño, oro y visión entre equipos'));
    onToggle();
  };
  const qc = useQueryClient();
  const refresh = () => {
    qc.invalidateQueries({ queryKey: qk.bracket(id) });
    qc.invalidateQueries({ queryKey: qk.tournamentBoard(id) });
  };

  // ── P0 admin: horario, W.O., desvincular juego ──
  const [schedDraft, setSchedDraft] = useState(() =>
    m.scheduledAt ? new Date(m.scheduledAt).toISOString().slice(0, 16) : ''
  );
  const [busy, setBusy] = useState(false);
  const call = async (fn: () => Promise<any>, okMsg: string) => {
    if (busy) return;
    setBusy(true);
    try { await fn(); toast.success(okMsg); refresh(); }
    catch (e: any) { toast.error(e?.response?.data?.error ?? 'No se pudo guardar'); }
    finally { setBusy(false); }
  };
  const saveSchedule = () => call(
    () => axiosInstance.patch(`/api/tournaments/${id}/matches/${m.id}`, {
      scheduledAt: schedDraft ? new Date(schedDraft).toISOString() : null,
    }),
    schedDraft ? 'Horario guardado — se avisa en el calendario y el correo del código' : 'Horario eliminado',
  );
  const declareForfeit = (winner: string) => {
    if (!window.confirm(`¿Declarar W.O.? ${winner} gana porque el rival no se presentó.`)) return;
    call(() => axiosInstance.post(`/api/tournaments/${id}/matches/${m.id}/forfeit`, { winner }), `W.O. — gana ${winner}`);
  };
  const unlinkGame = (gameId: number) => {
    if (!window.confirm(`¿Desvincular el juego ${gameId} de esta serie? Se borran sus stats y se recalcula el marcador.`)) return;
    call(() => axiosInstance.post(`/api/tournaments/${id}/matches/${m.id}/unlink-game`, { gameId }), 'Juego desvinculado');
  };
  const statusChip =
    m.matchStatus === 'complete' ? <StatusChip kind="pos" dot={false}>FINALIZADO</StatusChip>
    : m.matchStatus === 'active' ? <StatusChip kind="live">EN JUEGO</StatusChip>
    : m.matchStatus === 'ready' ? <StatusChip kind="registration" dot={false}>LISTO</StatusChip>
    : <StatusChip kind="dim" dot={false}>PENDIENTE</StatusChip>;

  // Serie del enfrentamiento (BO3/BO5), estampada por el backend
  const seriesTo = Number((m as any).seriesTo) || 1;
  const boLabel = seriesTo > 1 ? `BO${seriesTo * 2 - 1}` : null;

  const teamName = (name: string | null, won: boolean) => (
    <span style={{
      fontSize: 14.5, fontWeight: won ? 800 : 600,
      color: won ? '#fff' : m.winner ? 'var(--td-muted)' : 'var(--td-text-2)',
      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    }}>
      {name}
    </span>
  );

  return (
    // data-td-match: ancla para el resalte de `?match=` (muestras del descubrimiento).
    <div data-td-match={m.id}>
    <Card accent={m.matchStatus === 'active' ? 'rgba(59,130,246,0.35)' : undefined} style={{ padding: '16px 18px' }}>
      <button
        onClick={hasStats ? toggleOpen : undefined}
        aria-expanded={open}
        className="td-match-head"
        style={{
          display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left',
          background: 'transparent', border: 'none', padding: 0,
          cursor: hasStats ? 'pointer' : 'default', color: 'inherit',
        }}
      >
        <div className="td-match-teams">
          <span className="td-match-team" style={{ justifyContent: 'flex-end' }}>
            {teamName(m.team1, m.winner === m.team1)}
            <TeamBadge name={m.team1 ?? undefined} size={34} />
          </span>
          {/* Marcador central grande — lo primero que buscas en un partido */}
          <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <span className="td-num" style={{ fontSize: 24, fontWeight: 800, color: 'var(--td-text)', whiteSpace: 'nowrap', lineHeight: 1 }}>
              <span style={{ color: m.winner === m.team1 ? '#fff' : 'var(--td-text-2)' }}>{m.score1 ?? '–'}</span>
              <span style={{ color: RED, margin: '0 10px', fontSize: 14, fontWeight: 700 }}>–</span>
              <span style={{ color: m.winner === m.team2 ? '#fff' : 'var(--td-text-2)' }}>{m.score2 ?? '–'}</span>
            </span>
            {boLabel && (
              <span className="td-num" style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '0.1em', color: '#c8aa6e' }}
                title={`Serie al mejor de ${seriesTo * 2 - 1} — gana quien llegue a ${seriesTo}`}>
                {boLabel}
              </span>
            )}
          </span>
          <span className="td-match-team">
            <TeamBadge name={m.team2 ?? undefined} size={34} />
            {teamName(m.team2, m.winner === m.team2)}
          </span>
        </div>
        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          {statusChip}
          {hasStats && (
            <Tip label="Ver scoreboard de la serie">
              <span style={{ display: 'inline-flex' }}>
                {open ? <ChevronUp size={16} color="var(--td-muted)" /> : <ChevronDown size={16} color="var(--td-muted)" />}
              </span>
            </Tip>
          )}
        </span>
      </button>

      {/* Chips informativos: horario oficial · W.O. · resultado sin atribuir */}
      {(m.scheduledAt || m.forfeit || m.needsManualResult) && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
          {m.scheduledAt && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 700,
              padding: '4px 10px', borderRadius: 999, color: '#c8aa6e',
              border: '1px solid rgba(200,170,110,0.35)', background: 'rgba(200,170,110,0.08)',
            }}>
              <Calendar size={11} />
              {new Date(m.scheduledAt).toLocaleString('es-MX', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          {m.forfeit && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 700,
              padding: '4px 10px', borderRadius: 999, color: 'var(--td-muted)',
              border: '1px solid var(--td-border)', background: 'rgba(255,255,255,0.03)',
            }}>
              W.O. — rival no se presentó
            </span>
          )}
          {m.needsManualResult && m.matchStatus !== 'complete' && (
            // Tono atenuado: para el espectador no es un error, es un trámite
            // del organizador. La acción sigue en el panel de abajo.
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 600,
              padding: '4px 10px', borderRadius: 999, color: 'var(--td-text-2)',
              border: '1px solid var(--td-border)', background: 'rgba(255,255,255,0.03)',
            }}>
              <AlertTriangle size={11} color="var(--td-amber)" />
              Ganador pendiente de atribución
            </span>
          )}
        </div>
      )}

      {/* P0 herramientas del organizador */}
      {isOwner && (
        <div style={{
          display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center',
          marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--td-border)',
        }}>
          <span className="td-over" style={{ letterSpacing: '1px' }}>ADMIN</span>
          {m.matchStatus === 'active' && <LobbyStatus id={id} matchId={m.id} />}
          <input
            type="datetime-local" value={schedDraft}
            onChange={(e) => setSchedDraft(e.target.value)}
            style={{
              height: 32, padding: '0 10px', fontSize: 12, colorScheme: 'dark',
              background: 'rgba(0,0,0,0.35)', border: '1px solid var(--td-border)',
              borderRadius: 8, color: '#fff', outline: 'none',
            }}
          />
          <Button variant="secondary" disabled={busy} onClick={saveSchedule}>
            {m.scheduledAt ? 'CAMBIAR HORARIO' : 'FIJAR HORARIO'}
          </Button>
          {m.matchStatus !== 'complete' && m.team1 && m.team2 && (
            <>
              <Button variant="secondary" disabled={busy} onClick={() => declareForfeit(m.team1!)}>
                W.O. → {m.team1}
              </Button>
              <Button variant="secondary" disabled={busy} onClick={() => declareForfeit(m.team2!)}>
                W.O. → {m.team2}
              </Button>
            </>
          )}
          {(m.games ?? []).map((g, i) => (
            <span key={g.gameId} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5,
              padding: '4px 8px', borderRadius: 8, color: 'var(--td-text-2)',
              border: '1px solid var(--td-border)', background: 'rgba(0,0,0,0.25)',
            }}>
              J{i + 1} · {g.winner ?? (g.ambiguous ? 'sin atribuir' : '—')}
              <button
                onClick={() => unlinkGame(g.gameId)} disabled={busy}
                title={`Desvincular juego ${g.gameId}`}
                style={{ background: 'none', border: 'none', color: '#ff5a64', cursor: 'pointer', padding: 0, display: 'inline-flex' }}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}

      <AnimatePresence initial={false}>
        {open && hasStats && inlineStats && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <TournamentMatchStats
              tournamentId={id} match={m} isActive
              onSeeRound={onSeeRound}
              liveHref={`/tournaments/${id}/live?match=${m.id}`}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
    </div>
  );
}

// ── STATS GLOBALES DEL TORNEO ────────────────────────────────────────────────
