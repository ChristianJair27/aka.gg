// TournamentTeamModal — ficha de análisis de un equipo inscrito.
// Todo se calcula en el front con datos que ya servimos: el bracket (partidas
// del equipo → winrate juntos, racha, mapas) y las stats globales por jugador
// (KDA, daño, visión, pool de campeones). Cero endpoints nuevos.
import { CSSProperties, ReactNode, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  X, Users, Swords, BarChart3, ArrowUpRight, Crown, Eye, Target, Flame, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { useBracket, type BracketMatch, type Registration } from '@/hooks/queries/tournaments';
import { discoveryToast } from '@/hooks/useTournamentDiscovery';
import { PlayerRadarCard } from '@/components/tournament/PlayerRadarCard';
import { useTournamentGlobalStats } from '@/hooks/useTournamentGlobalStats';
import type { PlayerAggregate } from '@/types/tournament-global-stats';
import { StatusChip, TeamBadge, ProgressBar } from '@/components/tournament/ui';
import { useProfileIcons, iconFor } from '@/hooks/useProfileIcons';
import { dd } from '@/lib/dataDragon';
// De primitives y no del barril: el barril arrastra Champion3D (three.js).
import { StatIcon, UiIcon } from '@/components/arena/primitives';
import '@/styles/pages/tournament-forms.css';

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
      {icon && <span className="td-ico" style={{ width: 32, height: 32 }}>{icon}</span>}
      <div style={{ minWidth: 0 }}>
        <div className="td-over" style={{ marginBottom: 3 }}>{label}</div>
        <div className="td-tile-value" style={{ color }}>{value}</div>
        {sub && <div style={{ fontSize: 12.5, color: 'var(--td-text-2)', marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  );
}

function MiniStat({ label, value, color = 'var(--td-text)' }: { label: string; value: ReactNode; color?: string }) {
  return (
    <div className="td-sub" style={{ padding: '10px 12px', minWidth: 0 }}>
      <div className="td-over" style={{ marginBottom: 3 }}>{label}</div>
      <div className="td-num" style={{ fontSize: 16, fontWeight: 700, color }}>{value}</div>
    </div>
  );
}

const kdaColor = (k: number) => (k >= 4 ? 'var(--td-gold-bright)' : k >= 2.5 ? 'var(--td-green)' : 'var(--td-text)');

// ── Modal ────────────────────────────────────────────────────────────────────
export function TournamentTeamModal({ tournamentId, region, reg, standing, onClose }: TournamentTeamModalProps) {
  const { data: br } = useBracket(tournamentId);
  const { data: gs } = useTournamentGlobalStats({ tournamentId });

  // Primera vez que se abre el análisis de un equipo (desde Equipos, desde la
  // clasificación o por enlace): se dice qué contiene. Solo una vez por navegador.
  useEffect(() => {
    discoveryToast('team-modal', () =>
      toast.success('Stats del equipo: WR, plantilla y rendimiento por jugador'));
  }, []);

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
                <h2 className="ax-h3" style={{ color: 'var(--td-text)', overflowWrap: 'anywhere' }}>{reg.teamName}</h2>
                {standing && (
                  <span className="td-num" style={{ fontSize: 14, fontWeight: 700, color: standing.position === 1 ? 'var(--td-gold-bright)' : 'var(--td-text-2)' }}>
                    #{standing.position} · {standing.points} pts
                  </span>
                )}
                {reg.checkedIn
                  ? <StatusChip kind="pos" dot={false}>LISTO</StatusChip>
                  : <StatusChip kind="dim" dot={false}>SIN CHECK-IN</StatusChip>}
              </div>
              <div style={{ fontSize: 13.5, color: 'var(--td-text-2)', marginTop: 3 }}>
                Capitán · {reg.captainRiotId || '—'}
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Cerrar"
              className="tf-iconbtn"
            >
              <X size={18} />
            </button>
          </div>

          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* ── KPIs del equipo (juntos, en este torneo) ── */}
            <div className="td-team-kpis">
              <Kpi
                label="WINRATE JUNTOS"
                icon={<Target size={16} />}
                value={wrTogether != null ? `${wrTogether}%` : '—'}
                color={wrTogether == null ? 'var(--td-muted)' : wrTogether >= 50 ? 'var(--td-green)' : 'var(--td-neg)'}
                sub={done.length ? `${seriesWins}W – ${done.length - seriesWins}L en series` : 'sin partidas aún'}
              />
              <Kpi
                label="MAPAS"
                icon={<Swords size={16} />}
                value={done.length ? `${mapsFor} – ${mapsAgainst}` : '—'}
                sub="ganados – perdidos"
              />
              <Kpi
                label="KDA EQUIPO"
                icon={<BarChart3 size={16} />}
                value={teamAgg ? teamAgg.kda.toFixed(2) : '—'}
                color={teamAgg ? kdaColor(teamAgg.kda) : 'var(--td-muted)'}
                sub={teamAgg ? `${teamAgg.kills} kills totales` : 'sin datos'}
              />
              <Kpi
                label="RACHA"
                icon={<Flame size={16} />}
                value={standing?.streak ? `${standing.streak.count}${standing.streak.type}` : '—'}
                color={standing?.streak?.type === 'W' ? 'var(--td-green)' : standing?.streak?.type === 'L' ? 'var(--td-neg)' : 'var(--td-muted)'}
                sub={standing?.streak?.type === 'W' ? 'victorias seguidas' : standing?.streak?.type === 'L' ? 'derrotas seguidas' : 'sin racha'}
              />
            </div>

            {/* ── Análisis del equipo ── */}
            {teamAgg && (
              <div className="td-sub" style={{ padding: '14px 16px' }}>
                <div className="td-over" style={{ marginBottom: 10 }}>ANÁLISIS DEL EQUIPO</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 18px', alignItems: 'center' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 14, color: 'var(--td-text-2)' }}>
                    <Crown size={15} color="var(--td-gold-bright)" aria-hidden />
                    Carry: <strong style={{ color: 'var(--td-text)' }}>{teamAgg.best.summonerName}</strong>
                    <span className="td-num" style={{ color: kdaColor(teamAgg.best.avgKda) }}>{teamAgg.best.avgKda.toFixed(2)} KDA</span>
                  </span>
                  {/* Iconos del propio juego para daño y oro: son los que el jugador ya conoce. */}
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 14, color: 'var(--td-text-2)' }}>
                    <StatIcon stat="attack_damage" size={16} /> {teamAgg.dpm} daño/min medio
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 14, color: 'var(--td-text-2)' }}>
                    <UiIcon name="gold" size={16} /> {teamAgg.gpm} oro/min
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 14, color: 'var(--td-text-2)' }}>
                    <Eye size={15} color="var(--td-muted)" aria-hidden /> {teamAgg.vpm} visión/min
                  </span>
                  {teamAgg.multikills > 0 && (
                    <span style={{ fontSize: 14, color: 'var(--td-text-2)', display: 'inline-flex', alignItems: 'center', gap: 6 }}><Zap size={15} color="var(--td-muted)" aria-hidden />{teamAgg.multikills} multikills</span>
                  )}
                </div>
                {teamAgg.pool.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
                    <span className="td-over" style={{ marginRight: 3 }}>POOL</span>
                    {teamAgg.pool.slice(0, 12).map((c) => (
                      <img key={c} src={dd.champion(c)} alt={c} title={c} loading="lazy" width={28} height={28}
                        style={{ width: 28, height: 28, borderRadius: 'var(--td-r-chip)', objectFit: 'cover' }}
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                    ))}
                    {teamAgg.pool.length > 12 && (
                      <span className="td-num" style={{ fontSize: 13, color: 'var(--td-text-2)' }}>+{teamAgg.pool.length - 12}</span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── Roster + detalle del jugador ── */}
            <div className="td-team-cols tf-team-cols">
              <div>
                <div className="td-over" style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 7 }}>
                  <Users size={14} aria-hidden /> ROSTER · CLIC PARA ANALIZAR
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {roster.map((r, i) => {
                    const active = sel?.key === r.key;
                    return (
                      <button
                        key={r.key || i}
                        onClick={() => setSelected(r.key)}
                        aria-pressed={active}
                        className="td-sub"
                        style={{
                          display: 'flex', alignItems: 'center', gap: 11, padding: '8px 12px', minHeight: 52,
                          cursor: 'pointer', textAlign: 'left', width: '100%',
                          borderColor: active ? 'var(--td-red)' : undefined,
                          background: active ? 'var(--td-red-wash)' : undefined,
                          transition: 'border-color .15s, background .15s',
                        }}
                      >
                        {(() => {
                          // Prioridad: icono de invocador de LoL → main champ → monograma
                          const pIcon = iconFor(iconMap, r.riotId);
                          if (pIcon) {
                            return (
                              <img src={dd.profileIcon(pIcon)} alt="" loading="lazy"
                                style={{ width: 34, height: 34, borderRadius: 'var(--td-r-ctl)', objectFit: 'cover', flexShrink: 0, boxShadow: '0 0 0 1px var(--td-border-hov)' }}
                                onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }} />
                            );
                          }
                          if (r.agg?.mostPlayedChamp) {
                            return (
                              <img src={dd.champion(r.agg.mostPlayedChamp)} alt="" loading="lazy"
                                style={{ width: 34, height: 34, borderRadius: 'var(--td-r-ctl)', objectFit: 'cover', flexShrink: 0 }}
                                onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }} />
                            );
                          }
                          return <TeamBadge name={r.display} size={34} />;
                        })()}
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{
                            fontSize: 14.5, fontWeight: 600,
                            color: r.pending ? 'var(--td-muted)' : 'var(--td-text)',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {r.display}
                          </div>
                          <div style={{ fontSize: 12.5, color: 'var(--td-text-2)' }}>
                            {r.agg
                              ? `${r.agg.gamesPlayed} PJ · ${r.agg.winrate}% WR`
                              : r.pending ? 'invitación pendiente' : 'sin partidas en el torneo'}
                          </div>
                        </div>
                        {r.agg && (
                          <span className="td-num" style={{ fontSize: 15, fontWeight: 700, color: kdaColor(r.agg.avgKda), flexShrink: 0 }}>
                            {r.agg.avgKda.toFixed(2)}
                          </span>
                        )}
                      </button>
                    );
                  })}
                  {!roster.length && (
                    <div style={{ padding: 16, fontSize: 14, color: 'var(--td-text-2)', textAlign: 'center' }}>
                      Sin jugadores registrados
                    </div>
                  )}
                </div>
              </div>

              {/* Detalle del jugador seleccionado */}
              <div>
                <div className="td-over" style={{ marginBottom: 8 }}>ANÁLISIS DEL JUGADOR</div>
                {sel && selAgg ? (
                  <div className="td-sub" style={{ padding: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                      <img src={dd.champion(selAgg.mostPlayedChamp || 'Garen')} alt="" loading="lazy" width={46} height={46}
                        style={{ width: 46, height: 46, borderRadius: 'var(--td-r-ctl)', objectFit: 'cover' }}
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }} />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--td-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {sel.display}
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--td-text-2)' }}>
                          {selAgg.gamesPlayed} partidas · main {selAgg.mostPlayedChamp}
                        </div>
                      </div>
                      <span title="KDA" style={{ fontFamily: 'var(--td-font-display)', fontSize: 30, fontWeight: 700, lineHeight: 1, fontVariantNumeric: 'tabular-nums', color: kdaColor(selAgg.avgKda) }}>
                        {selAgg.avgKda.toFixed(2)}
                      </span>
                    </div>

                    {/* Winrate */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 13 }}>
                      <span className="td-over" style={{ flexShrink: 0 }}>WR</span>
                      <div style={{ flex: 1 }}><ProgressBar kind="wr" pct={selAgg.winrate} height={6} /></div>
                      <span className="td-num" style={{
                        fontSize: 14, fontWeight: 700, flexShrink: 0,
                        color: selAgg.winrate >= 50 ? 'var(--td-green)' : 'var(--td-neg)',
                      }}>
                        {selAgg.winrate}% · {selAgg.wins}W {selAgg.losses}L
                      </span>
                    </div>

                    <div className="td-team-ministats">
                      <MiniStat label="K / D / A" value={`${selAgg.totalKills} / ${selAgg.totalDeaths} / ${selAgg.totalAssists}`} />
                      <MiniStat label="DAÑO/MIN" value={Math.round(selAgg.avgDamagePerMin)} />
                      <MiniStat label="ORO/MIN" value={Math.round(selAgg.avgGoldPerMin)} />
                      <MiniStat label="CS/MIN" value={selAgg.avgCsPerMin.toFixed(1)} />
                      <MiniStat label="VISIÓN/MIN" value={selAgg.avgVisionPerMin.toFixed(2)} />
                      <MiniStat
                        label="MULTIKILLS"
                        value={
                          selAgg.pentaKills > 0 ? `${selAgg.pentaKills} PENTA` :
                          selAgg.quadraKills > 0 ? `${selAgg.quadraKills} QUADRA` :
                          selAgg.tripleKills > 0 ? `${selAgg.tripleKills} TRIPLE` :
                          selAgg.doubleKills > 0 ? `${selAgg.doubleKills} DOBLE` : '—'
                        }
                        color={selAgg.pentaKills > 0 ? 'var(--td-gold-bright)' : 'var(--td-text)'}
                      />
                    </div>

                    {selAgg.championPool.length > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 14, flexWrap: 'wrap' }}>
                        <span className="td-over" style={{ marginRight: 3 }}>CAMPEONES</span>
                        {selAgg.championPool.slice(0, 8).map((c) => (
                          <img key={c} src={dd.champion(c)} alt={c} title={c} loading="lazy" width={28} height={28}
                            style={{ width: 28, height: 28, borderRadius: 'var(--td-r-chip)', objectFit: 'cover' }}
                            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                        ))}
                      </div>
                    )}

                    {profileHref && (
                      <a
                        href={profileHref}
                        target="_blank" rel="noopener noreferrer"
                        className="ax-link"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 10, minHeight: 44, fontSize: 14.5 }}
                      >
                        Perfil completo en ATAK <ArrowUpRight size={16} aria-hidden />
                      </a>
                    )}
                  </div>
                ) : (
                  <div className="td-sub" style={{ padding: 22, textAlign: 'center', fontSize: 14, color: 'var(--td-text-2)' }}>
                    {sel
                      ? gs
                        ? 'Sin stats de torneo'
                        : 'Cargando estadísticas del torneo…'
                      : 'Selecciona un jugador del roster'}
                  </div>
                )}

                {/* Radar del jugador contra el promedio del torneo */}
                {sel && selAgg && gs?.players?.length ? (
                  <div style={{ marginTop: 12 }}>
                    <PlayerRadarCard player={selAgg} cohort={gs.players} compact
                      profileIconId={iconFor(iconMap, sel.riotId)}
                      team={reg.teamName} tournamentId={tournamentId} />
                  </div>
                ) : null}
              </div>
            </div>

            {/* ── Historial de partidas del equipo ── */}
            <div>
              <div className="td-over" style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 7 }}>
                <Swords size={14} aria-hidden /> PARTIDAS DEL EQUIPO
              </div>
              {!teamMatches.length ? (
                <div className="td-sub" style={{ padding: 18, textAlign: 'center', fontSize: 14, color: 'var(--td-text-2)' }}>
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
                      <div key={m.id} className="td-sub" style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '8px 13px', minHeight: 46 }}>
                        <span className="ax-pos" style={{
                          flexShrink: 0,
                          background: won ? 'color-mix(in srgb, var(--td-green) 16%, transparent)' : lost ? 'color-mix(in srgb, var(--td-neg) 16%, transparent)' : 'var(--td-sunken)',
                          color: won ? 'var(--td-green)' : lost ? 'var(--td-neg)' : 'var(--td-muted)',
                        }}>
                          {won ? 'W' : lost ? 'L' : '·'}
                        </span>
                        <TeamBadge name={rivalName ?? undefined} size={26} />
                        <span style={{ flex: 1, minWidth: 0, fontSize: 14.5, fontWeight: 600, color: 'var(--td-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          vs {rivalName ?? 'Por definir'}
                        </span>
                        <span style={{ fontSize: 12.5, color: 'var(--td-text-2)', flexShrink: 0 }}>{rlabel(m)}</span>
                        <span className="td-num" style={{ fontSize: 15, fontWeight: 700, color: 'var(--td-text)', flexShrink: 0, minWidth: 48, textAlign: 'right' }}>
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
