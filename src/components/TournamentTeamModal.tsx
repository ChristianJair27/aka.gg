// TournamentTeamModal — ficha de análisis de un equipo inscrito.
// Todo se calcula en el front con datos que ya servimos: el bracket (partidas
// del equipo → winrate juntos, racha, mapas) y las stats globales por jugador
// (KDA, daño, visión, pool de campeones). Cero endpoints nuevos.
import { CSSProperties, ReactNode, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  X, Users, Swords, BarChart3, ArrowUpRight, Crown, Eye, Coins, Target, Flame,
} from 'lucide-react';
import { useBracket, type BracketMatch, type Registration } from '@/hooks/queries/tournaments';
import { useTournamentGlobalStats } from '@/hooks/useTournamentGlobalStats';
import type { PlayerAggregate } from '@/types/tournament-global-stats';
import { StatusChip, TeamBadge, ProgressBar } from '@/components/tournament/ui';
import { useProfileIcons, iconFor } from '@/hooks/useProfileIcons';
import { dd } from '@/lib/dataDragon';

const RED = 'var(--td-red)';

const norm = (s: string) => (s || '').toLowerCase().replace(/\s+/g, '');

/** riotId "Nombre#TAG" ←→ aggregate {summonerName, tagLine}. */
function aggregateFor(riotId: string | undefined, players: PlayerAggregate[]): PlayerAggregate | null {
  if (!riotId) return null;
  const [name = '', tag = ''] = riotId.split('#');
  return (
    players.find((p) => norm(p.summonerName) === norm(name) && (!tag || norm(p.tagLine) === norm(tag))) ??
    players.find((p) => norm(p.summonerName) === norm(name)) ??
    null
  );
}

interface StandingRow {
  name: string; wins: number; losses: number; winratePct: number;
  streak: { count: number; type: 'W' | 'L' } | null; points: number; position: number;
}

export interface TournamentTeamModalProps {
  tournamentId: string;
  region: string;
  reg: Registration;
  standing: StandingRow | null;
  onClose: () => void;
}

// ── Piezas pequeñas ──────────────────────────────────────────────────────────
function Kpi({ label, value, sub, color = '#fff', icon }: {
  label: string; value: ReactNode; sub?: ReactNode; color?: string; icon?: ReactNode;
}) {
  return (
    <div className="td-sub" style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
      {icon && <span className="td-ico" style={{ width: 30, height: 30, borderRadius: 9 }}>{icon}</span>}
      <div style={{ minWidth: 0 }}>
        <div className="td-over" style={{ marginBottom: 3 }}>{label}</div>
        <div className="td-num" style={{ fontSize: 18, fontWeight: 700, color, lineHeight: 1.1, whiteSpace: 'nowrap' }}>{value}</div>
        {sub && <div style={{ fontSize: 10.5, color: 'var(--td-muted)', marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  );
}

function MiniStat({ label, value, color = 'var(--td-text)' }: { label: string; value: ReactNode; color?: string }) {
  return (
    <div className="td-sub" style={{ padding: '9px 11px' }}>
      <div className="td-over" style={{ fontSize: 8.5, marginBottom: 3 }}>{label}</div>
      <div className="td-num" style={{ fontSize: 14.5, fontWeight: 700, color }}>{value}</div>
    </div>
  );
}

const kdaColor = (k: number) => (k >= 4 ? '#fde047' : k >= 2.5 ? 'var(--td-green)' : 'var(--td-text)');

// ── Modal ────────────────────────────────────────────────────────────────────
export function TournamentTeamModal({ tournamentId, region, reg, standing, onClose }: TournamentTeamModalProps) {
  const { data: br } = useBracket(tournamentId);
  const { data: gs } = useTournamentGlobalStats({ tournamentId });

  const [selected, setSelected] = useState<string | null>(null);

  // Esc para cerrar + bloquear el scroll del fondo mientras está abierto.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  const allPlayers = gs?.players ?? [];

  // Iconos de perfil de LoL del roster (misma caché que la vista de equipos).
  const { data: iconMap } = useProfileIcons(
    `team-${tournamentId}-${reg.teamName}`,
    (reg.players ?? []).map((p) => p.riotId || '').filter(Boolean),
    region || 'la1',
  );

  // Partidas del equipo en el torneo (series completadas).
  const teamMatches = useMemo(() => {
    const list = (br?.bracket ?? []) as BracketMatch[];
    return list
      .filter((m) => (m.team1 === reg.teamName || m.team2 === reg.teamName) && m.team1 !== 'BYE' && m.team2 !== 'BYE')
      .sort((a, b) => a.round - b.round);
  }, [br, reg.teamName]);

  const done = teamMatches.filter((m) => m.matchStatus === 'complete');
  const seriesWins = done.filter((m) => m.winner === reg.teamName).length;
  const mapsFor = done.reduce((acc, m) => acc + (m.team1 === reg.teamName ? (m.score1 ?? 0) : (m.score2 ?? 0)), 0);
  const mapsAgainst = done.reduce((acc, m) => acc + (m.team1 === reg.teamName ? (m.score2 ?? 0) : (m.score1 ?? 0)), 0);
  const wrTogether = standing ? Math.round(standing.winratePct) : done.length ? Math.round((seriesWins / done.length) * 100) : null;

  // Stats por jugador del roster (solo los que ya jugaron en el torneo).
  const roster = useMemo(
    () => (reg.players ?? []).map((p) => ({
      key: p.riotId || p.name,
      riotId: p.riotId || '',
      display: p.riotId || p.name,
      pending: p.inviteStatus === 'pending',
      agg: aggregateFor(p.riotId, allPlayers),
    })),
    [reg.players, allPlayers],
  );
  const withStats = roster.filter((r) => r.agg);

  // Agregado del equipo a partir de sus jugadores con datos.
  const teamAgg = useMemo(() => {
    if (!withStats.length) return null;
    const aggs = withStats.map((r) => r.agg!) as PlayerAggregate[];
    const sum = (f: (a: PlayerAggregate) => number) => aggs.reduce((acc, a) => acc + f(a), 0);
    const k = sum((a) => a.totalKills), d = sum((a) => a.totalDeaths), as = sum((a) => a.totalAssists);
    const pool = new Map<string, number>();
    for (const a of aggs) for (const c of a.championPool) pool.set(c, (pool.get(c) ?? 0) + 1);
    return {
      kda: d > 0 ? (k + as) / d : k + as,
      kills: k,
      dpm: Math.round(sum((a) => a.avgDamagePerMin) / aggs.length),
      vpm: (sum((a) => a.avgVisionPerMin) / aggs.length).toFixed(2),
      gpm: Math.round(sum((a) => a.avgGoldPerMin) / aggs.length),
      cspm: (sum((a) => a.avgCsPerMin) / aggs.length).toFixed(1),
      multikills: sum((a) => a.pentaKills * 3 + a.quadraKills * 2 + a.tripleKills),
      pool: [...pool.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c),
      best: [...aggs].sort((a, b) => b.avgKda - a.avgKda)[0],
    };
  }, [withStats]);

  const sel = selected
    ? roster.find((r) => r.key === selected)
    : withStats[0] ?? roster[0] ?? null;
  const selAgg = sel?.agg ?? null;

  const profileHref = sel?.riotId
    ? `/stats/${(region || 'la1').toLowerCase()}/${encodeURIComponent(sel.riotId)}`
    : null;

  const rlabel = (m: BracketMatch) => {
    if (br?.bracketType === 'round_robin') return `Jornada ${m.round}`;
    if (br?.bracketType === 'swiss') return `Ronda ${m.round}`;
    return `Ronda ${m.round}`;
  };

  const overlay: CSSProperties = {
    position: 'fixed', inset: 0, zIndex: 90,
    background: 'rgba(5,5,7,0.78)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4vh 16px',
  };

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="ov"
        style={overlay}
        className="td-root"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <motion.div
          role="dialog" aria-modal aria-label={`Equipo ${reg.teamName}`}
          className="td-panel"
          initial={{ opacity: 0, y: 22, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 14, scale: 0.99 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          style={{
            position: 'relative',
            width: 'min(900px, 100%)', maxHeight: 'min(88vh, 960px)', overflow: 'auto',
            padding: 0, background: 'var(--td-card)',
            boxShadow: '0 -10px 44px rgba(232,50,60,0.10), 0 24px 70px rgba(0,0,0,0.6)',
          }}
        >
          {/* Filo vivo: hairline crimson→oro que recorre el borde superior.
              CSS puro — el detalle premium sin el costo del láser WebGL. */}
          <div className="td-modal-edge" aria-hidden />
          {/* ── Cabecera ── */}
          <div style={{
            position: 'sticky', top: 0, zIndex: 2,
            display: 'flex', alignItems: 'center', gap: 13, padding: '16px 20px',
            background: 'var(--td-card)', borderBottom: '1px solid var(--td-border)',
          }}>
            <TeamBadge name={reg.teamName} size={42} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 17, fontWeight: 800, color: 'var(--td-text)' }}>{reg.teamName}</span>
                {standing && (
                  <span className="td-num" style={{ fontSize: 12, fontWeight: 700, color: standing.position === 1 ? '#fde047' : 'var(--td-text-2)' }}>
                    #{standing.position} · {standing.points} pts
                  </span>
                )}
                {reg.checkedIn
                  ? <StatusChip kind="pos" dot={false}>LISTO</StatusChip>
                  : <StatusChip kind="dim" dot={false}>SIN CHECK-IN</StatusChip>}
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--td-muted)', marginTop: 2 }}>
                Capitán · {reg.captainRiotId || '—'}
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Cerrar"
              className="td-ico"
              style={{ cursor: 'pointer', border: 'none', color: 'var(--td-text-2)' }}
            >
              <X size={16} />
            </button>
          </div>

          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* ── KPIs del equipo (juntos, en este torneo) ── */}
            <div className="td-team-kpis">
              <Kpi
                label="WINRATE JUNTOS"
                icon={<Target size={15} />}
                value={wrTogether != null ? `${wrTogether}%` : '—'}
                color={wrTogether == null ? 'var(--td-muted)' : wrTogether >= 50 ? 'var(--td-green)' : 'var(--td-neg)'}
                sub={done.length ? `${seriesWins}W – ${done.length - seriesWins}L en series` : 'sin partidas aún'}
              />
              <Kpi
                label="MAPAS"
                icon={<Swords size={15} />}
                value={done.length ? `${mapsFor} – ${mapsAgainst}` : '—'}
                sub="ganados – perdidos"
              />
              <Kpi
                label="KDA EQUIPO"
                icon={<BarChart3 size={15} />}
                value={teamAgg ? teamAgg.kda.toFixed(2) : '—'}
                color={teamAgg ? kdaColor(teamAgg.kda) : 'var(--td-muted)'}
                sub={teamAgg ? `${teamAgg.kills} kills totales` : 'sin datos'}
              />
              <Kpi
                label="RACHA"
                icon={<Flame size={15} />}
                value={standing?.streak ? `${standing.streak.count}${standing.streak.type}` : '—'}
                color={standing?.streak?.type === 'W' ? 'var(--td-green)' : standing?.streak?.type === 'L' ? 'var(--td-neg)' : 'var(--td-muted)'}
                sub={standing?.streak?.type === 'W' ? 'victorias seguidas' : standing?.streak?.type === 'L' ? 'derrotas seguidas' : 'sin racha'}
              />
            </div>

            {/* ── Análisis del equipo ── */}
            {teamAgg && (
              <div className="td-sub" style={{ padding: '13px 15px' }}>
                <div className="td-over" style={{ marginBottom: 9 }}>ANÁLISIS DEL EQUIPO</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: 'var(--td-text-2)' }}>
                    <Crown size={13} color="#fde047" />
                    Carry: <strong style={{ color: 'var(--td-text)' }}>{teamAgg.best.summonerName}</strong>
                    <span className="td-num" style={{ color: kdaColor(teamAgg.best.avgKda) }}>{teamAgg.best.avgKda.toFixed(2)} KDA</span>
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--td-text-2)' }}>
                    <Flame size={13} color={RED as string} /> {teamAgg.dpm} daño/min medio
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--td-text-2)' }}>
                    <Coins size={13} color="#fde047" /> {teamAgg.gpm} oro/min
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--td-text-2)' }}>
                    <Eye size={13} color="#60a5fa" /> {teamAgg.vpm} visión/min
                  </span>
                  {teamAgg.multikills > 0 && (
                    <span style={{ fontSize: 12.5, color: 'var(--td-text-2)' }}>⚡ {teamAgg.multikills} multikills</span>
                  )}
                </div>
                {teamAgg.pool.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 11, flexWrap: 'wrap' }}>
                    <span className="td-over" style={{ marginRight: 3 }}>POOL</span>
                    {teamAgg.pool.slice(0, 12).map((c) => (
                      <img key={c} src={dd.champion(c)} alt={c} title={c} loading="lazy"
                        style={{ width: 26, height: 26, borderRadius: 7, objectFit: 'cover' }}
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                    ))}
                    {teamAgg.pool.length > 12 && (
                      <span style={{ fontSize: 11, color: 'var(--td-muted)' }}>+{teamAgg.pool.length - 12}</span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── Roster + detalle del jugador ── */}
            <div className="td-team-cols">
              <div>
                <div className="td-over" style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Users size={11} /> ROSTER · CLIC PARA ANALIZAR
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {roster.map((r, i) => {
                    const active = sel?.key === r.key;
                    return (
                      <button
                        key={r.key || i}
                        onClick={() => setSelected(r.key)}
                        className="td-sub"
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
                          cursor: 'pointer', textAlign: 'left', width: '100%',
                          borderColor: active ? 'var(--td-red-glow)' : undefined,
                          background: active ? 'rgba(232,50,60,0.07)' : undefined,
                          transition: 'border-color .15s, background .15s',
                        }}
                      >
                        {(() => {
                          // Prioridad: icono de invocador de LoL → main champ → monograma
                          const pIcon = iconFor(iconMap, r.riotId);
                          if (pIcon) {
                            return (
                              <img src={dd.profileIcon(pIcon)} alt="" loading="lazy"
                                style={{ width: 30, height: 30, borderRadius: 8, objectFit: 'cover', flexShrink: 0, boxShadow: '0 0 0 1px var(--td-border-hov)' }}
                                onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }} />
                            );
                          }
                          if (r.agg?.mostPlayedChamp) {
                            return (
                              <img src={dd.champion(r.agg.mostPlayedChamp)} alt="" loading="lazy"
                                style={{ width: 30, height: 30, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }}
                                onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }} />
                            );
                          }
                          return <TeamBadge name={r.display} size={30} />;
                        })()}
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{
                            fontSize: 12.5, fontWeight: 600,
                            color: r.pending ? 'var(--td-muted)' : 'var(--td-text)',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {r.display}
                          </div>
                          <div style={{ fontSize: 10.5, color: 'var(--td-muted)' }}>
                            {r.agg
                              ? `${r.agg.gamesPlayed} PJ · ${r.agg.winrate}% WR`
                              : r.pending ? 'invitación pendiente' : 'sin partidas en el torneo'}
                          </div>
                        </div>
                        {r.agg && (
                          <span className="td-num" style={{ fontSize: 12.5, fontWeight: 700, color: kdaColor(r.agg.avgKda), flexShrink: 0 }}>
                            {r.agg.avgKda.toFixed(2)}
                          </span>
                        )}
                      </button>
                    );
                  })}
                  {!roster.length && (
                    <div style={{ padding: 16, fontSize: 12.5, color: 'var(--td-muted)', textAlign: 'center' }}>
                      Sin jugadores registrados
                    </div>
                  )}
                </div>
              </div>

              {/* Detalle del jugador seleccionado */}
              <div>
                <div className="td-over" style={{ marginBottom: 8 }}>ANÁLISIS DEL JUGADOR</div>
                {sel && selAgg ? (
                  <div className="td-sub" style={{ padding: 15 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 13 }}>
                      <img src={dd.champion(selAgg.mostPlayedChamp || 'Garen')} alt="" loading="lazy"
                        style={{ width: 44, height: 44, borderRadius: 11, objectFit: 'cover' }}
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }} />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--td-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {sel.display}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--td-muted)' }}>
                          {selAgg.gamesPlayed} partidas · main {selAgg.mostPlayedChamp}
                        </div>
                      </div>
                      <span className="td-num" style={{ fontSize: 21, fontWeight: 800, color: kdaColor(selAgg.avgKda) }}>
                        {selAgg.avgKda.toFixed(2)}
                      </span>
                    </div>

                    {/* Winrate */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 13 }}>
                      <span className="td-over" style={{ flexShrink: 0 }}>WR</span>
                      <div style={{ flex: 1 }}><ProgressBar kind="wr" pct={selAgg.winrate} height={5} /></div>
                      <span className="td-num" style={{
                        fontSize: 12.5, fontWeight: 700, flexShrink: 0,
                        color: selAgg.winrate >= 50 ? 'var(--td-green)' : 'var(--td-neg)',
                      }}>
                        {selAgg.winrate}% · {selAgg.wins}W {selAgg.losses}L
                      </span>
                    </div>

                    <div className="td-team-ministats">
                      <MiniStat label="K / D / A" value={`${selAgg.totalKills} / ${selAgg.totalDeaths} / ${selAgg.totalAssists}`} />
                      <MiniStat label="DAÑO/MIN" value={Math.round(selAgg.avgDamagePerMin)} color="#f87171" />
                      <MiniStat label="ORO/MIN" value={Math.round(selAgg.avgGoldPerMin)} color="#fde047" />
                      <MiniStat label="CS/MIN" value={selAgg.avgCsPerMin.toFixed(1)} />
                      <MiniStat label="VISIÓN/MIN" value={selAgg.avgVisionPerMin.toFixed(2)} color="#60a5fa" />
                      <MiniStat
                        label="MULTIKILLS"
                        value={
                          selAgg.pentaKills > 0 ? `${selAgg.pentaKills} PENTA` :
                          selAgg.quadraKills > 0 ? `${selAgg.quadraKills} QUADRA` :
                          selAgg.tripleKills > 0 ? `${selAgg.tripleKills} TRIPLE` :
                          selAgg.doubleKills > 0 ? `${selAgg.doubleKills} DOBLE` : '—'
                        }
                        color={selAgg.pentaKills > 0 ? '#fde047' : 'var(--td-text)'}
                      />
                    </div>

                    {selAgg.championPool.length > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 13, flexWrap: 'wrap' }}>
                        <span className="td-over" style={{ marginRight: 3 }}>CAMPEONES</span>
                        {selAgg.championPool.slice(0, 8).map((c) => (
                          <img key={c} src={dd.champion(c)} alt={c} title={c} loading="lazy"
                            style={{ width: 26, height: 26, borderRadius: 7, objectFit: 'cover' }}
                            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                        ))}
                      </div>
                    )}

                    {profileHref && (
                      <a
                        href={profileHref}
                        target="_blank" rel="noopener noreferrer"
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 14,
                          fontSize: 12.5, fontWeight: 700, color: RED as string, textDecoration: 'none',
                        }}
                      >
                        Perfil completo en ATAK <ArrowUpRight size={14} />
                      </a>
                    )}
                  </div>
                ) : (
                  <div className="td-sub" style={{ padding: 22, textAlign: 'center', fontSize: 12.5, color: 'var(--td-muted)' }}>
                    {sel
                      ? gs
                        ? 'Este jugador aún no tiene partidas en el torneo. Las stats aparecen al completarse su primera partida.'
                        : 'Cargando estadísticas del torneo…'
                      : 'Selecciona un jugador del roster'}
                  </div>
                )}
              </div>
            </div>

            {/* ── Historial de partidas del equipo ── */}
            <div>
              <div className="td-over" style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Swords size={11} /> PARTIDAS DEL EQUIPO
              </div>
              {!teamMatches.length ? (
                <div className="td-sub" style={{ padding: 18, textAlign: 'center', fontSize: 12.5, color: 'var(--td-muted)' }}>
                  Aún no tiene partidas asignadas — aparecen al generarse el bracket
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {teamMatches.map((m) => {
                    const rivalName = m.team1 === reg.teamName ? m.team2 : m.team1;
                    const myScore = m.team1 === reg.teamName ? m.score1 : m.score2;
                    const theirScore = m.team1 === reg.teamName ? m.score2 : m.score1;
                    const won = m.matchStatus === 'complete' && m.winner === reg.teamName;
                    const lost = m.matchStatus === 'complete' && !!m.winner && m.winner !== reg.teamName;
                    return (
                      <div key={m.id} className="td-sub" style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 13px' }}>
                        <span className="td-num" style={{
                          width: 26, height: 26, borderRadius: 8, flexShrink: 0,
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 11.5, fontWeight: 800,
                          background: won ? 'rgba(74,222,128,0.13)' : lost ? 'rgba(232,50,60,0.13)' : 'var(--td-sunken)',
                          color: won ? 'var(--td-green)' : lost ? 'var(--td-neg)' : 'var(--td-muted)',
                        }}>
                          {won ? 'W' : lost ? 'L' : '·'}
                        </span>
                        <TeamBadge name={rivalName ?? undefined} size={24} />
                        <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 600, color: 'var(--td-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          vs {rivalName ?? 'Por definir'}
                        </span>
                        <span style={{ fontSize: 10.5, color: 'var(--td-muted)', flexShrink: 0 }}>{rlabel(m)}</span>
                        <span className="td-num" style={{ fontSize: 13, fontWeight: 700, color: 'var(--td-text)', flexShrink: 0, minWidth: 44, textAlign: 'right' }}>
                          {m.matchStatus === 'complete' ? `${myScore ?? 0} – ${theirScore ?? 0}`
                            : m.matchStatus === 'active' ? 'JUGANDO' : '—'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}

export default TournamentTeamModal;
