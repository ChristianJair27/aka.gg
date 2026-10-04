// src/components/MatchStatsDetail.tsx — Vista completa de las estadísticas de una partida.
// Marcador de retransmisión (azul vs rojo) + scoreboard por equipo + pestañas de
// daño / oro / objetivos + destacados. Sistema "Arena": ver
// design-system/atak-gg/MASTER.md y src/styles/pages/match.css.
import { useState, useEffect, useRef, useMemo, type CSSProperties, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Swords, Eye, AlertTriangle, Hexagon, Loader2, Zap, Trophy } from 'lucide-react';
import { dd, spellIcon, keystoneIcon, runePathIcon, fmtDuration, fmtNumber } from '@/lib/dataDragon';
import { lol, LANE_LABELS, normalizeLane } from '@/lib/lolAssets';
import { ChampIcon, RoleIcon, DragonIcon, StatIcon, UiIcon, stagger } from '@/components/arena/primitives';
import { StatusChip, ProgressBar, FilterPills, SectionHead } from '@/components/tournament/ui';
import { Slot, Kda, InlineState } from '@/components/match/parts';
import type { MatchStatsResponse, ParticipantStats, TeamObjectives } from '@/types/riot-match';
import '@/styles/pages/match.css';

type Side = 'blue' | 'red';
const SIDE_COLOR: Record<Side, string> = { blue: 'var(--td-live, #3b82f6)', red: 'var(--td-red)' };
const DMG_COLORS = { physical: 'var(--td-amber)', magic: 'var(--td-live, #3b82f6)', true: '#f5f5f6' };

// ─── Confeti de fin de partida (colores de marca) ─────────────────────────────

function Confetti() {
  const pieces = useMemo(() => {
    const colors = ['#e8323c', '#ff4b57', '#c8aa6e', '#f0d891', '#f5f5f6'];
    return Array.from({ length: 48 }, (_, i) => ({
      id: i,
      color: colors[i % colors.length],
      left: `${Math.random() * 100}%`,
      delay: `${Math.random() * 2}s`,
      duration: `${2 + Math.random() * 2}s`,
      size: 6 + Math.random() * 8,
      round: Math.random() > 0.5,
    }));
  }, []);

  return (
    <div className="mx-confetti" aria-hidden>
      {pieces.map((p) => (
        <i key={p.id} style={{
          left: p.left, width: p.size, height: p.size, backgroundColor: p.color,
          borderRadius: p.round ? '50%' : 2, animationDuration: p.duration, animationDelay: p.delay,
        }} />
      ))}
    </div>
  );
}

// ─── Piezas de fila ───────────────────────────────────────────────────────────

function MultikillBadge({ p }: { p: ParticipantStats }) {
  if (p.pentaKills > 0)  return <StatusChip kind="gold" dot={false}>Pentakill</StatusChip>;
  if (p.quadraKills > 0) return <StatusChip kind="gold" dot={false}>Quadra</StatusChip>;
  if (p.tripleKills > 0) return <StatusChip kind="dim" dot={false}>Triple</StatusChip>;
  if (p.doubleKills > 0) return <StatusChip kind="dim" dot={false}>Doble</StatusChip>;
  return null;
}

const positionOf = (p: ParticipantStats) => p.teamPosition || (p as any).role || '';

function ParticipantRow({
  p, maxDmg, isMvp, isMe, side,
}: { p: ParticipantStats; maxDmg: number; isMvp: boolean; isMe: boolean; side: Side }) {
  const kdaVal = p.deaths === 0 ? (p.kills + p.assists).toFixed(1) : ((p.kills + p.assists) / p.deaths).toFixed(2);
  const dmgPct = maxDmg > 0 ? Math.round((p.totalDamageDealt / maxDmg) * 100) : 0;
  const pos = positionOf(p);
  const lane = normalizeLane(pos);

  return (
    <tr data-me={isMe ? 'true' : undefined}>
      {/* Jugador */}
      <td>
        <div className="mx-player">
          <span className="mx-champ">
            <ChampIcon src={dd.champion(p.championName)} name={p.championName} size={40} />
            {p.champLevel != null && <span className="mx-lvl">{p.champLevel}</span>}
          </span>
          <div style={{ minWidth: 0 }}>
            <div className="mx-pname">
              <b title={p.summonerName || 'Invocador'}>{p.summonerName || 'Invocador'}</b>
              {isMvp && <StatusChip kind="gold" dot={false}>MVP</StatusChip>}
              {p.firstBloodKill && <StatusChip kind="dim" dot={false}>1.ª sangre</StatusChip>}
              <MultikillBadge p={p} />
            </div>
            <div className="mx-psub">
              {pos && lane !== 'fill' && <RoleIcon lane={pos} size={14} />}
              <span>{p.championName}{pos && lane !== 'fill' ? ` · ${LANE_LABELS[lane]}` : ''}</span>
            </div>
          </div>
        </div>
      </td>
      {/* Hechizos + runas */}
      <td>
        <div className="mx-loadout">
          <div className="mx-loadout-col">
            <Slot src={spellIcon(p.summoner1Id)} size={22} />
            <Slot src={spellIcon(p.summoner2Id)} size={22} />
          </div>
          <div className="mx-loadout-col">
            <Slot src={keystoneIcon(p.perks.keystoneId)} size={26} round />
            <Slot src={runePathIcon(p.perks.secondaryStyleId)} size={17} round />
          </div>
        </div>
      </td>
      {/* KDA */}
      <td className="mx-c">
        <Kda k={p.kills} d={p.deaths} a={p.assists} />
        <span className="mx-sub">{kdaVal} KDA</span>
      </td>
      {/* CS */}
      <td className="mx-c">
        <span className="td-num" style={{ fontWeight: 700 }}>{p.cs}</span>
        <span className="mx-sub">{p.csPerMin}/min</span>
      </td>
      {/* Daño */}
      <td>
        <div className="mx-dmg">
          <span className="mx-dmg-num">{fmtNumber(p.totalDamageDealt)}</span>
          <ProgressBar pct={dmgPct} kind={side === 'blue' ? SIDE_COLOR.blue : 'red'} height={5} />
          <div className="mx-split" style={{ width: `${dmgPct}%` }}
            title={`Físico ${fmtNumber(p.physicalDamage)} · Mágico ${fmtNumber(p.magicDamage)} · Verdadero ${fmtNumber(p.trueDamage)}`}>
            <i style={{ flex: p.physicalDamage || 0, background: DMG_COLORS.physical }} />
            <i style={{ flex: p.magicDamage || 0, background: DMG_COLORS.magic }} />
            <i style={{ flex: p.trueDamage || 0, background: DMG_COLORS.true }} />
          </div>
        </div>
      </td>
      {/* Oro */}
      <td className="mx-c"><span className="mx-gold">{fmtNumber(p.goldEarned)}</span></td>
      {/* Visión */}
      <td className="mx-c">
        <span className="td-num" style={{ fontWeight: 700 }}>{p.visionScore}</span>
        <span className="mx-sub" title="Centinelas colocados / destruidos">{p.wardsPlaced} col. · {p.wardsKilled} destr.</span>
      </td>
      {/* Objetos */}
      <td>
        <div className="mx-items">
          {Array.from({ length: 7 }, (_, i) => p.items[i] || 0).map((id, i) => (
            <Slot key={i} src={id ? dd.item(id) : ''} size={28} alt={id ? `Objeto ${id}` : ''} />
          ))}
        </div>
      </td>
    </tr>
  );
}

// ─── Tabla de equipo ──────────────────────────────────────────────────────────

const Th = ({ icon, children, center }: { icon?: ReactNode; children: ReactNode; center?: boolean }) => (
  <th style={center ? { textAlign: 'center' } : undefined}><span>{icon}{children}</span></th>
);

function TeamTable({
  participants, side, teamName, highlightPuuid,
}: { participants: ParticipantStats[]; side: Side; teamName?: string; highlightPuuid?: string }) {
  const maxDmg = Math.max(...participants.map(p => p.totalDamageDealt), 1);
  const totalKills  = participants.reduce((s, p) => s + p.kills, 0);
  const totalGold   = participants.reduce((s, p) => s + p.goldEarned, 0);
  const totalDmg    = participants.reduce((s, p) => s + p.totalDamageDealt, 0);
  const winBadge    = participants[0]?.win;
  const mvp         = [...participants].sort((a, b) =>
    (b.kills + b.assists - b.deaths) - (a.kills + a.assists - a.deaths)
  )[0];

  return (
    <section className="td-panel mx-team" data-side={side}>
      <header className="mx-team-head">
        <span className="mx-team-name">{teamName ?? (side === 'blue' ? 'Equipo Azul' : 'Equipo Rojo')}</span>
        {winBadge
          ? <StatusChip kind="pos" dot={false}><Trophy size={12} aria-hidden /> Victoria</StatusChip>
          : <StatusChip kind="warn" dot={false}>Derrota</StatusChip>}
        <div className="mx-team-totals">
          <span title="Asesinatos del equipo"><UiIcon name="score" size={18} />{totalKills}</span>
          <span title="Oro del equipo"><UiIcon name="gold" size={18} />{fmtNumber(totalGold)}</span>
          <span title="Daño a campeones del equipo"><StatIcon stat="attack_damage" size={15} />{fmtNumber(totalDmg)}</span>
          {mvp && <span style={{ color: 'var(--td-gold-bright)' }}>MVP · {mvp.summonerName}</span>}
        </div>
      </header>

      <div className="ax-table-scroll">
        <table className="ax-table mx-table">
          <colgroup>
            <col className="mx-col-player" /><col style={{ width: 96 }} /><col style={{ width: 116 }} />
            <col style={{ width: 92 }} /><col /><col style={{ width: 92 }} />
            <col style={{ width: 132 }} /><col style={{ width: 252 }} />
          </colgroup>
          <thead>
            <tr>
              <Th>Jugador</Th>
              <Th icon={<UiIcon name="spells" size={16} />}>Hechizos</Th>
              <Th center icon={<UiIcon name="score" size={16} />}>KDA</Th>
              <Th center icon={<UiIcon name="minion" size={16} />}>CS</Th>
              <Th icon={<StatIcon stat="attack_damage" size={13} />}>Daño</Th>
              <Th center icon={<UiIcon name="gold" size={16} />}>Oro</Th>
              <Th center icon={<Eye size={13} aria-hidden />}>Visión</Th>
              <Th icon={<UiIcon name="items" size={16} />}>Objetos</Th>
            </tr>
          </thead>
          <tbody>
            {participants.map((p, i) => (
              <ParticipantRow key={i} p={p} maxDmg={maxDmg} isMvp={p === mvp} side={side}
                isMe={Boolean(highlightPuuid) && (p as any).puuid === highlightPuuid} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ─── Barras: daño y oro ───────────────────────────────────────────────────────

function BarRow({ p, index, pct, segments, value }: {
  p: ParticipantStats; index: number; pct: number; segments: { v: number; color: string }[]; value: string;
}) {
  return (
    <div className="mx-bar-row">
      <ChampIcon src={dd.champion(p.championName)} name={p.championName} size={30} />
      <span className="mx-bar-name" title={p.summonerName || p.championName}>{p.summonerName || p.championName}</span>
      <div className="mx-bar-track">
        <div className="mx-bar-fill" style={{ width: `${pct}%`, ...stagger(index) }}>
          {segments.map((s, i) => <i key={i} style={{ flex: s.v || 0, background: s.color }} />)}
        </div>
      </div>
      <span className="mx-bar-val">{value}</span>
    </div>
  );
}

function TeamBars({ blueTeam, redTeam, blueName, redName, render }: {
  blueTeam: ParticipantStats[]; redTeam: ParticipantStats[]; blueName: string; redName: string;
  render: (p: ParticipantStats, index: number, side: Side) => ReactNode;
}) {
  return (
    <div className="mx-bars">
      <div className="td-over mx-bars-label" data-side="blue">{blueName}</div>
      {blueTeam.map((p, i) => render(p, i, 'blue'))}
      <div className="td-over mx-bars-label" data-side="red">{redName}</div>
      {redTeam.map((p, i) => render(p, i + blueTeam.length, 'red'))}
    </div>
  );
}

function DamageChart({ blueTeam, redTeam, blueName, redName }: {
  blueTeam: ParticipantStats[]; redTeam: ParticipantStats[]; blueName: string; redName: string;
}) {
  const max = Math.max(...[...blueTeam, ...redTeam].map(p => p.totalDamageDealt), 1);
  return (
    <div className="td-panel ax-card">
      <SectionHead icon={<StatIcon stat="attack_damage" size={15} />} title="Daño a campeones" />
      <TeamBars blueTeam={blueTeam} redTeam={redTeam} blueName={blueName} redName={redName}
        render={(p, i) => (
          <BarRow key={i} p={p} index={i} pct={(p.totalDamageDealt / max) * 100} value={fmtNumber(p.totalDamageDealt)}
            segments={[
              { v: p.physicalDamage, color: DMG_COLORS.physical },
              { v: p.magicDamage, color: DMG_COLORS.magic },
              { v: p.trueDamage, color: DMG_COLORS.true },
            ]} />
        )} />
      <div className="mx-legend">
        <span><i style={{ background: DMG_COLORS.physical }} />Físico</span>
        <span><i style={{ background: DMG_COLORS.magic }} />Mágico</span>
        <span><i style={{ background: DMG_COLORS.true }} />Verdadero</span>
      </div>
    </div>
  );
}

function GoldChart({ blueTeam, redTeam, blueName, redName }: {
  blueTeam: ParticipantStats[]; redTeam: ParticipantStats[]; blueName: string; redName: string;
}) {
  const max = Math.max(...[...blueTeam, ...redTeam].map(p => p.goldEarned), 1);
  return (
    <div className="td-panel ax-card">
      <SectionHead icon={<UiIcon name="gold" size={18} />} title="Oro ganado" />
      <TeamBars blueTeam={blueTeam} redTeam={redTeam} blueName={blueName} redName={redName}
        render={(p, i, side) => (
          <BarRow key={i} p={p} index={i} pct={(p.goldEarned / max) * 100} value={fmtNumber(p.goldEarned)}
            segments={[{ v: 1, color: SIDE_COLOR[side] }]} />
        )} />
    </div>
  );
}

// ─── Objetivos ────────────────────────────────────────────────────────────────

type Objective = { key: string; label: string; short: string; icon: ReactNode; blue: number; red: number };

function objectivesOf(blue: TeamObjectives, red: TeamObjectives): Objective[] {
  return [
    { key: 'dragon', label: 'Dragones', short: 'Dragones', icon: <DragonIcon dragon="elder" size={30} />, blue: blue.dragonKills, red: red.dragonKills },
    { key: 'baron', label: 'Barón Nashor', short: 'Barón', icon: <UiIcon name="nashor" size={30} />, blue: blue.baronKills, red: red.baronKills },
    { key: 'tower', label: 'Torres', short: 'Torres', icon: <UiIcon name="tower" size={30} />, blue: blue.towerKills, red: red.towerKills },
    { key: 'herald', label: 'Heraldo de la Grieta', short: 'Heraldo', icon: <UiIcon name="rift_herald" size={30} />, blue: blue.riftHeraldKills, red: red.riftHeraldKills },
    { key: 'inhib', label: 'Inhibidores', short: 'Inhib.', icon: <Hexagon size={22} aria-hidden />, blue: blue.inhibitorKills, red: red.inhibitorKills },
  ];
}

function ObjectivesChart({ blue, red }: { blue: TeamObjectives; red: TeamObjectives }) {
  const objectives = objectivesOf(blue, red);
  const firsts: { label: string; side: Side | null }[] = [
    { label: 'Primera torre', side: blue.firstTower ? 'blue' : red.firstTower ? 'red' : null },
    { label: 'Primer dragón', side: blue.firstDragon ? 'blue' : red.firstDragon ? 'red' : null },
    { label: 'Primer Barón', side: blue.firstBaron ? 'blue' : red.firstBaron ? 'red' : null },
  ];

  return (
    <div className="td-panel ax-card">
      <SectionHead icon={<UiIcon name="tower" size={18} />} title="Objetivos" />
      <div className="mx-tug">
        {objectives.map(o => {
          const empty = o.blue === 0 && o.red === 0;
          const total = o.blue + o.red || 1;
          const bluePct = empty ? 50 : Math.round((o.blue / total) * 100);
          return (
            <div key={o.key}>
              <div className="mx-tug-head">
                <b data-side="blue">{o.blue}</b>
                <span className="mx-tug-label"><span className="mx-obj-ico">{o.icon}</span>{o.label}</span>
                <b data-side="red">{o.red}</b>
              </div>
              <div className="mx-tug-bar" data-empty={empty ? 'true' : undefined}>
                <i data-side="blue" style={{ width: `${bluePct}%` }} />
                <i data-side="red" style={{ width: `${100 - bluePct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
      <div className="mx-legend">
        {firsts.map(f => (
          <span key={f.label} data-side={f.side ?? undefined}>
            <i style={{ background: f.side ? SIDE_COLOR[f.side] : 'var(--td-sunken-2)' }} />
            {f.label}: <b style={{ color: f.side ? 'var(--side-text)' : 'var(--td-muted)', fontWeight: 700 }}>
              {f.side === 'blue' ? 'Azul' : f.side === 'red' ? 'Rojo' : '—'}
            </b>
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Partida en curso (aún sin stats) ─────────────────────────────────────────

function InProgressView({ bracketMatchId }: { bracketMatchId: string }) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <InlineState icon={<Zap size={34} aria-hidden style={{ color: 'var(--td-green)' }} />} title="Partida en curso">
      <p className="mx-mono">{bracketMatchId}</p>
      <span className="mx-empty-note">
        <Clock size={14} aria-hidden />
        <span className="td-num">Actualizando en {35 - (seconds % 35)} s</span>
      </span>
      <p style={{ marginTop: 10, fontSize: 13.5, color: 'var(--td-muted)' }}>
        Las estadísticas aparecerán automáticamente al finalizar.
      </p>
    </InlineState>
  );
}

// ─── Sin gameId ───────────────────────────────────────────────────────────────

function NoGameView() {
  return (
    <InlineState icon={<Swords size={34} aria-hidden />} title="Sin partida vinculada">
      <p>Activa el partido y el sistema detectará el gameId automáticamente.</p>
    </InlineState>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

interface MatchStatsDetailProps {
  stats: MatchStatsResponse | null;
  loading: boolean;
  error?: string | null;
  bracketMatchId: string;
  gameId?: number;
  team1?: string | null;
  team2?: string | null;
  /** Nombre legible de la cola ("Solo/Dúo"); si falta se muestra el gameMode. */
  queueLabel?: string;
  /** puuid del jugador enfocado: se resalta su fila y su retrato. */
  highlightPuuid?: string;
}

type StatsTab = 'tabla' | 'daño' | 'oro' | 'objetivos';
const TABS_STATS: { key: StatsTab; label: string }[] = [
  { key: 'tabla',    label: 'Tabla' },
  { key: 'daño',     label: 'Daño' },
  { key: 'oro',      label: 'Oro' },
  { key: 'objetivos', label: 'Objetivos' },
];

const fmtDate = (ts?: number) => {
  if (!ts) return null;
  try {
    return new Date(ts).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return null; }
};

function Faces({ team, side, highlightPuuid }: { team: ParticipantStats[]; side: Side; highlightPuuid?: string }) {
  return (
    <div className="mx-faces" data-side={side}>
      {team.map((p, i) => (
        <img key={i} className="mx-face" src={dd.champion(p.championName)} alt={p.championName}
          title={`${p.summonerName || 'Invocador'} · ${p.championName}`} loading="lazy" decoding="async"
          data-me={highlightPuuid && (p as any).puuid === highlightPuuid ? 'true' : undefined}
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }} />
      ))}
    </div>
  );
}

export function MatchStatsDetail({
  stats, loading, error, bracketMatchId, gameId, team1, team2, queueLabel, highlightPuuid,
}: MatchStatsDetailProps) {
  const [tab, setTab] = useState<StatsTab>('tabla');
  const [showConfetti, setShowConfetti] = useState(false);
  const confettiShown = useRef(false);

  useEffect(() => {
    if (stats?.isComplete && !confettiShown.current) {
      confettiShown.current = true;
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 4000);
    }
  }, [stats?.isComplete]);

  const wrap = (node: ReactNode) => <div className="td-root mx-embed">{node}</div>;

  if (!gameId) return wrap(<NoGameView />);
  if (loading && !stats) {
    return wrap(
      <InlineState icon={<Loader2 size={30} aria-hidden className="mx-spin" />} title="Cargando estadísticas">
        <p>Obteniendo los datos de la partida desde Riot…</p>
      </InlineState>,
    );
  }
  if (error && !stats) {
    return wrap(
      <InlineState icon={<AlertTriangle size={32} aria-hidden style={{ color: 'var(--td-amber)' }} />} title="No se pudo cargar">
        <p>{error}</p>
      </InlineState>,
    );
  }
  if (!stats) {
    return wrap(<InProgressView bracketMatchId={bracketMatchId} />);
  }

  const { blueTeam, redTeam, blueObjectives, redObjectives, gameDuration, gameMode, winner, isComplete } = stats;

  const blueTeamName = team1 ?? 'Equipo Azul';
  const redTeamName  = team2 ?? 'Equipo Rojo';
  const blueKills = blueTeam.reduce((s, p) => s + p.kills, 0);
  const redKills  = redTeam.reduce((s, p) => s + p.kills, 0);
  const objectives = objectivesOf(blueObjectives, redObjectives);
  const playedOn = fmtDate(stats.gameStartTimestamp);
  const everyone = [...blueTeam, ...redTeam];

  const highlights = [
    { label: 'Mayor daño',   p: [...everyone].sort((a, b) => b.totalDamageDealt - a.totalDamageDealt)[0], value: (p: ParticipantStats) => fmtNumber(p.totalDamageDealt) },
    { label: 'Mayor KDA',    p: [...everyone].sort((a, b) => b.kda - a.kda)[0],                           value: (p: ParticipantStats) => (Number.isFinite(p.kda) ? p.kda.toFixed(2) : 'Perfecto') },
    { label: 'Más oro',      p: [...everyone].sort((a, b) => b.goldEarned - a.goldEarned)[0],             value: (p: ParticipantStats) => fmtNumber(p.goldEarned) },
    { label: 'Mejor visión', p: [...everyone].sort((a, b) => b.visionScore - a.visionScore)[0],           value: (p: ParticipantStats) => String(p.visionScore) },
  ];

  const sideHead = (side: Side, name: string) => {
    const generic = name === (side === 'blue' ? 'Equipo Azul' : 'Equipo Rojo');
    return (
      <div className="mx-side" data-side={side} data-lost={winner && winner !== side ? 'true' : undefined}>
        {!generic && <span className="td-over mx-side-tag">{side === 'blue' ? 'Lado azul' : 'Lado rojo'}</span>}
        <span className="mx-side-name">{name}</span>
        {winner && (
          <span className="mx-result" data-win={winner === side}>{winner === side ? 'Victoria' : 'Derrota'}</span>
        )}
      </div>
    );
  };

  return (
    <div className="td-root mx-embed">
      {showConfetti && <Confetti />}

      {/* Marcador */}
      <section className="mx-bug ax-rise" data-live={!isComplete ? 'true' : undefined} aria-label="Marcador de la partida">
        <div className="mx-bug-top">
          {isComplete
            ? <StatusChip kind="finished" dot={false}>Finalizada</StatusChip>
            : <StatusChip kind="live">En vivo</StatusChip>}
          <span className="mx-bug-fact">{queueLabel || gameMode}</span>
          <span className="mx-bug-fact"><Clock size={14} aria-hidden /><b>{fmtDuration(gameDuration)}</b></span>
          <span className="mx-spacer" />
          {playedOn && <span className="mx-bug-fact">{playedOn}</span>}
        </div>

        <div className="mx-bug-main">
          {sideHead('blue', blueTeamName)}
          <div className="mx-score">
            <div className="mx-score-nums" aria-label={`${blueKills} asesinatos del lado azul, ${redKills} del lado rojo`}>
              <span data-dim={winner === 'red' ? 'true' : undefined}>{blueKills}</span>
              <span className="mx-score-sep" aria-hidden />
              <span data-dim={winner === 'blue' ? 'true' : undefined}>{redKills}</span>
            </div>
            <span className="td-over">Asesinatos</span>
          </div>
          {sideHead('red', redTeamName)}

          <div className="mx-faces-row">
            <Faces team={blueTeam} side="blue" highlightPuuid={highlightPuuid} />
            <Faces team={redTeam} side="red" highlightPuuid={highlightPuuid} />
          </div>
        </div>

        <dl className="mx-objs">
          {objectives.map(o => (
            <div key={o.key} className="mx-obj" title={o.label}>
              <dt>
                <span className="mx-obj-ico">{o.icon}</span>
                <span className="td-over">{o.short}</span>
              </dt>
              <dd>
                <span data-side="blue">{o.blue}</span><i aria-hidden>–</i><span data-side="red">{o.red}</span>
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Pestañas */}
      <div className="mx-tabs">
        <FilterPills items={TABS_STATS} value={tab} onChange={(k) => setTab(k as StatsTab)} ariaLabel="Vista de estadísticas" />
      </div>

      <AnimatePresence mode="wait">
        {tab === 'tabla' && (
          <motion.div key="tabla" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
            <TeamTable participants={blueTeam} side="blue" teamName={blueTeamName} highlightPuuid={highlightPuuid} />
            <TeamTable participants={redTeam}  side="red"  teamName={redTeamName}  highlightPuuid={highlightPuuid} />
          </motion.div>
        )}

        {tab === 'daño' && (
          <motion.div key="damage" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
            <DamageChart blueTeam={blueTeam} redTeam={redTeam} blueName={blueTeamName} redName={redTeamName} />
          </motion.div>
        )}

        {tab === 'oro' && (
          <motion.div key="gold" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
            <GoldChart blueTeam={blueTeam} redTeam={redTeam} blueName={blueTeamName} redName={redTeamName} />
          </motion.div>
        )}

        {tab === 'objetivos' && (
          <motion.div key="objectives" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
            <ObjectivesChart blue={blueObjectives} red={redObjectives} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Destacados */}
      {isComplete && (
        <section className="mx-block" style={{ marginTop: 32 }}>
          <SectionHead icon={<Trophy size={16} />} title="Destacados de la partida" />
          <div className="ax-grid mx-hl-grid" style={{ ['--cols' as string]: 4 } as CSSProperties}>
            {highlights.map(({ label, p, value }, i) => p && (
              <article key={label} className="ax-artcard mx-hl ax-rise" style={stagger(i)}>
                <img className="ax-artcard-img" src={lol.splash(p.championName)} alt="" loading="lazy" decoding="async"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                <span className="td-over">{label}</span>
                <span className="mx-hl-value">{value(p)}</span>
                <span className="mx-hl-who">
                  <ChampIcon src={dd.champion(p.championName)} name={p.championName} size={24} />
                  <span>{p.summonerName || p.championName}</span>
                </span>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
