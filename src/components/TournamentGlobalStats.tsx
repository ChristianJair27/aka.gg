// src/components/TournamentGlobalStats.tsx — Aggregated tournament-wide stats view
import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartTooltip, ResponsiveContainer, Cell,
} from 'recharts';
import {
  Trophy, Sword, Coins, Eye, Star,
  ChevronUp, ChevronDown, Zap, Activity, Users, RefreshCw, Skull, Search, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { dd, fmtNumber } from '@/lib/dataDragon';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Tip } from '@/components/ui/Tip';
import { FilterPills, Button } from '@/components/tournament/ui';
import { PlayerTeamCommand } from '@/components/tournament/PlayerTeamCommand';
import { StatsCharts, type TeamStanding } from '@/components/tournament/StatsCharts';
import { PlayerCompare } from '@/components/tournament/PlayerCompare';
import { formatKda } from '@/components/tournament/PlayerRadarCard';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { HAS_PLAYER_RADAR } from '@/hooks/useTournamentDiscovery';
import { SharePodiumButton, type PodiumEntry } from '@/components/tournament/SharePodiumCard';
import { PlayerAvatar, riotIdOf } from '@/components/tournament/PlayerAvatar';
import { tierValue } from '@/lib/ranks';
import { MiniBar, Ring, Dots, KdaSplit, TierEmblem, PentaBadge } from '@/components/tournament/MicroViz';
import { StatsCoachmarks } from '@/components/tournament/StatsCoachmarks';
import { useProfileIcons, iconFor } from '@/hooks/useProfileIcons';
import type { TournamentGlobalStats, PlayerAggregate, GlobalSortKey } from '@/types/tournament-global-stats';

// Etiqueta para jugadores cuyo Riot ID no casa con ningún roster inscrito.
export const NO_TEAM = 'Sin equipo';

/** Clave normalizada "nombre#tag" (minúsculas, sin espacios) para cruzar
 *  jugadores de stats con rosters. Exportada para que StatsTab construya el
 *  mapa con la misma regla. */
export function playerKey(name: string, tag?: string | null): string {
  const n = (s: string) => s.toLowerCase().replace(/\s+/g, '');
  return `${n(name || '')}#${n(tag || '')}`;
}

// ─── Mini image helper ────────────────────────────────────────────────────────

function ImgSlot({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [err, setErr] = useState(false);
  if (err || !src) return <div className={cn('bg-white/5 border border-white/10', className)} />;
  return <img src={src} alt={alt} className={cn('object-cover', className)} onError={() => setErr(true)} loading="lazy" />;
}

function ChampIcon({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const cls = { sm: 'w-8 h-8 rounded-lg', md: 'w-10 h-10 rounded-xl', lg: 'w-16 h-16 rounded-2xl' }[size];
  return <ImgSlot src={dd.champion(name || 'Garen')} alt={name} className={cn(cls, 'border border-white/10')} />;
}

// ─── Podium ───────────────────────────────────────────────────────────────────

const PODIUM_CATS: { key: GlobalSortKey; label: string; fmt: (v: number) => string; icon: React.ReactNode }[] = [
  { key: 'avgKda',          label: 'KDA',      fmt: v => v.toFixed(2),              icon: <Sword    className="h-3 w-3" /> },
  { key: 'totalKills',      label: 'Kills',    fmt: v => String(v),                 icon: <Skull    className="h-3 w-3" /> },
  { key: 'avgGoldPerMin',   label: 'Oro/min',  fmt: v => fmtNumber(v),              icon: <Coins    className="h-3 w-3" /> },
  { key: 'avgDamagePerMin', label: 'Daño/min', fmt: v => fmtNumber(Math.round(v)),  icon: <Zap      className="h-3 w-3" /> },
  { key: 'avgCsPerMin',     label: 'CS/min',   fmt: v => v.toFixed(1),              icon: <Activity className="h-3 w-3" /> },
  { key: 'avgVisionPerMin', label: 'Visión',   fmt: v => v.toFixed(2),              icon: <Eye      className="h-3 w-3" /> },
];

function Podium({ players, sortKey, onPick, iconOf }: {
  players: PlayerAggregate[]; sortKey: GlobalSortKey; onPick?: (p: PlayerAggregate) => void;
  iconOf?: (p: PlayerAggregate) => number | null;
}) {
  const cat = PODIUM_CATS.find(c => c.key === sortKey)!;
  const top3 = [...players].sort((a, b) => (b[sortKey] as number) - (a[sortKey] as number)).slice(0, 3);
  if (top3.length === 0) return null;

  // Display order: [2nd, 1st, 3rd] for classic podium layout
  const displayOrder = [top3[1], top3[0], top3[2]].filter(Boolean);

  const platformH: Record<number, number> = { 1: 96, 2: 68, 3: 52 };
  const rankOf = (p: PlayerAggregate) => top3.indexOf(p) + 1;

  return (
    <div className="flex items-end justify-center gap-4 py-2">
      {displayOrder.map(p => {
        const rank = rankOf(p);
        const h    = platformH[rank] ?? 52;
        // El KDA del podio se recorta al mostrarlo: hay valores reales de 54
        // (pocas muertes) que se leen como error. El Tip da el dato exacto.
        const kda  = formatKda(p);
        const isKda = sortKey === 'avgKda';
        const val  = isKda ? kda.text : cat.fmt(p[sortKey] as number);

        const medalBg  = rank === 1 ? 'bg-yellow-400'   : rank === 2 ? 'bg-gray-300'    : 'bg-amber-700';
        const ringCls  = rank === 1 ? 'ring-yellow-400/50' : rank === 2 ? 'ring-white/20' : 'ring-amber-700/30';
        const platBg   = rank === 1 ? 'bg-yellow-500/15 border-yellow-500/30'
                       : rank === 2 ? 'bg-white/10 border-white/20'
                       :              'bg-amber-800/15 border-amber-700/30';
        const valColor = rank === 1 ? 'text-yellow-300' : 'text-white/60';
        const scale    = rank === 1 ? 'scale-110' : '';

        return (
          <motion.div
            key={p.summonerName}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: (3 - rank) * 0.08 }}
            className="flex flex-col items-center gap-2"
          >
            <Tip label={isKda ? kda.tip : `${p.summonerName} · ${cat.label} ${cat.fmt(p[sortKey] as number)}`}>
            <div className={cn('flex flex-col items-center gap-1.5 transition-transform cursor-pointer', scale)}
              role="button" tabIndex={0}
              onClick={() => onPick?.(p)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick?.(p); } }}
            >
              <span className={cn('w-6 h-6 rounded-full flex items-center justify-center text-xs font-black text-black', medalBg)}>
                {rank}
              </span>
              <div className={cn('rounded-xl overflow-hidden ring-2 shrink-0', ringCls, rank === 1 ? 'w-14 h-14' : 'w-10 h-10')}>
                <PlayerAvatar riotId={riotIdOf(p)} profileIconId={iconOf?.(p)} mostPlayedChamp={p.mostPlayedChamp}
                  size={rank === 1 ? 64 : 40} ring={false} />
              </div>
              <div className="text-center max-w-[90px]">
                <p className={cn('font-bold text-white truncate', rank === 1 ? 'text-sm' : 'text-xs')}>
                  {p.summonerName}
                </p>
                <p className={cn('font-black', rank === 1 ? 'text-lg' : 'text-sm',
                  isKda && kda.extreme ? 'text-[#c8aa6e]' : valColor)}>{val}</p>
              </div>
            </div>
            </Tip>
            <div
              className={cn('w-20 rounded-t-lg border flex items-center justify-center', platBg)}
              style={{ height: h }}
            >
              <span className={cn('text-2xl font-black', rank === 1 ? 'text-yellow-400/60' : 'text-white/20')}>
                #{rank}
              </span>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

// ─── Sortable table ───────────────────────────────────────────────────────────

type SortDir = 'desc' | 'asc';

// `tip`: nombre completo en español de cada columna abreviada.
const TABLE_COLS: { key: GlobalSortKey | 'player' | 'rank' | 'tier'; label: string; sortable: boolean; tip?: string }[] = [
  { key: 'rank',            label: '#',         sortable: true,  tip: 'Posición en el torneo por puntuación 0-100 (promedio de los 8 ejes del radar). Solo con 3+ partidas.' },
  { key: 'player',          label: 'Jugador',   sortable: false, tip: 'Jugador y campeones que ha usado' },
  { key: 'tier',            label: 'Rango',     sortable: true,  tip: 'Rango solo/dúo actual en LoL' },
  { key: 'gamesPlayed',     label: 'PJ',        sortable: true,  tip: 'Partidas jugadas' },
  { key: 'winrate',         label: 'WR%',       sortable: true,  tip: 'Porcentaje de victorias' },
  { key: 'avgKda',          label: 'KDA',       sortable: true,  tip: 'KDA medio (kills + asistencias) / muertes' },
  { key: 'totalKills',      label: 'K / D / A', sortable: true,  tip: 'Kills, muertes y asistencias totales (barra proporcional). Ordena por kills.' },
  { key: 'avgGoldPerMin',   label: 'G/min',     sortable: true,  tip: 'Oro por minuto' },
  { key: 'avgDamagePerMin', label: 'Dmg/min',   sortable: true,  tip: 'Daño a campeones por minuto' },
  { key: 'avgCsPerMin',     label: 'CS/min',    sortable: true,  tip: 'Súbditos por minuto' },
  { key: 'avgVisionPerMin', label: 'Vis/min',   sortable: true,  tip: 'Puntuación de visión por minuto' },
  { key: 'pentaKills',      label: 'Pentas',    sortable: true,  tip: 'Pentakills conseguidas' },
];

function SortableTable({ players, marked, onMark, onPick, iconOf }: {
  iconOf?: (p: PlayerAggregate) => number | null;
  players: PlayerAggregate[];
  /** Fila resaltada ("nombre#tag"): ayuda a seguir a un jugador entre 100+ filas. */
  marked: string | null;
  onMark: (key: string | null) => void;
  /** Click en la fila → radar del jugador. */
  onPick?: (p: PlayerAggregate) => void;
}) {
  type TableSortKey = GlobalSortKey | 'rank' | 'tier';
  // Por defecto, posición en el torneo (#1 arriba). Los sin rank (<3 PJ) al final.
  const [sortKey, setSortKey] = useState<TableSortKey>('rank');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  // Techos de la lista visible: las barras se leen relativas a quien más tiene.
  const maxOf = useMemo(() => ({
    gold: Math.max(1, ...players.map(p => p.avgGoldPerMin)),
    dmg: Math.max(1, ...players.map(p => p.avgDamagePerMin)),
    cs: Math.max(1, ...players.map(p => p.avgCsPerMin)),
    vis: Math.max(1, ...players.map(p => p.avgVisionPerMin)),
    games: Math.max(1, ...players.map(p => p.gamesPlayed)),
  }), [players]);

  const sorted = useMemo(() => {
    const mult = sortDir === 'desc' ? -1 : 1;
    const val = (p: PlayerAggregate): number =>
      sortKey === 'rank' ? (p.rank ?? Number.POSITIVE_INFINITY)
      : sortKey === 'tier' ? -tierValue(p.soloTier, p.soloDivision, p.soloLp)
      : (p[sortKey] as number);
    return [...players].sort((a, b) => {
      const av = val(a), bv = val(b);
      if (av === bv) return 0;
      if (!Number.isFinite(av)) return 1;
      if (!Number.isFinite(bv)) return -1;
      return mult * (av - bv);
    });
  }, [players, sortKey, sortDir]);

  const onSort = (key: TableSortKey) => {
    if (key === sortKey) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortKey(key); setSortDir(key === 'rank' || key === 'tier' ? 'asc' : 'desc'); }
  };

  // 108+ filas en LQC: alto acotado (ScrollArea) + thead pegajoso vía CSS
  // (.td-stats-scroll en tournament-dashboard.css). Sin virtualización: 100-200
  // filas de texto plano no la necesitan.
  return (
    <ScrollArea className="td-stats-scroll rounded-2xl">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-white/[0.08]">
            {TABLE_COLS.map(col => (
              <th
                key={col.key}
                onClick={col.sortable ? () => onSort(col.key as TableSortKey) : undefined}
                className={cn(
                  'px-3 py-2.5 text-[10px] uppercase tracking-wider whitespace-nowrap select-none',
                  col.key === 'player' ? 'text-left' : 'text-center',
                  col.sortable ? 'cursor-pointer hover:text-white transition-colors' : '',
                  sortKey === col.key ? 'text-white' : 'text-white/25',
                )}
              >
                <Tip label={col.tip ?? col.label}>
                <span className={cn('flex items-center gap-0.5', col.key !== 'player' && 'justify-center')}>
                  {col.label}
                  {col.sortable && sortKey === col.key && (
                    sortDir === 'desc'
                      ? <ChevronDown className="h-3 w-3" />
                      : <ChevronUp   className="h-3 w-3" />
                  )}
                </span>
                </Tip>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((p, i) => {
            const rowKey = `${p.summonerName}#${p.tagLine}`;
            const isMarked = marked === rowKey;
            return (
            <tr
              key={rowKey}
              data-td-player-row={i === 0 ? '' : undefined}
              onClick={() => { onMark(isMarked ? null : rowKey); onPick?.(p); }}
              className={cn(
                'border-b border-white/[0.04] transition-colors cursor-pointer',
                isMarked ? 'bg-red-500/[0.10]' : 'hover:bg-white/[0.03]',
              )}
            >
              {/* Posición en el torneo */}
              <td className={cn('px-3 py-2.5 text-center', isMarked && 'border-l-2 border-l-[#e8323c]')}>
                {p.rank ? (
                  <Ring value={p.score ?? 0} size={34} stroke={3} label={String(p.rank)}
                    color={p.rank === 1 ? '#c8aa6e' : p.rank === 2 ? '#e5e7eb' : p.rank === 3 ? '#d9a066' : '#e1242e'}
                    tip={`Puesto ${p.rank} · ${p.score} pts de 100`} />
                ) : (
                  <Tip label="Sin posición: menos de 3 partidas"><span className="text-xs text-white/20">—</span></Tip>
                )}
              </td>
              {/* Player + champ pool */}
              <td className="px-3 py-2.5 min-w-[150px]">
                <Tip label={HAS_PLAYER_RADAR ? 'Click para ver radar / comparar' : 'Click para resaltar / comparar'}>
                  <div className="flex items-center gap-2">
                    <PlayerAvatar riotId={riotIdOf(p)} profileIconId={iconOf?.(p)} mostPlayedChamp={p.mostPlayedChamp} size={32} />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-white truncate max-w-[110px]">{p.summonerName}</p>
                      <p className="text-[9px] text-white/25 truncate max-w-[110px]">
                        {p.championPool.slice(0, 4).join(' · ')}
                      </p>
                    </div>
                  </div>
                </Tip>
              </td>
              {/* Rango solo/dúo */}
              <td className="px-3 py-2.5 text-center">
                <TierEmblem tier={p.soloTier} division={p.soloDivision} lp={p.soloLp} size={54} />
              </td>
              <td className="px-3 py-2.5 text-center">
                <Dots count={p.gamesPlayed} max={Math.min(10, maxOf.games)} color="#e5e7eb" tip={`${p.gamesPlayed} partidas jugadas`} />
              </td>
              {/* WR: porcentaje + barra de progreso (patrón "completion") */}
              <td className="px-3 py-2.5 text-center">
                <MiniBar value={p.winrate} max={100} label={`${p.winrate}%`}
                  color={p.winrate >= 60 ? '#2fbf8a' : p.winrate >= 50 ? '#e5e7eb' : '#ff5a64'}
                  tip={`${p.wins} victorias · ${p.losses} derrotas`} />
              </td>
              <td className="px-3 py-2.5 text-center">
                <MiniBar value={Math.min(10, p.avgKda)} max={10} label={formatKda(p).text}
                  color={p.avgKda >= 4 ? '#fde047' : p.avgKda >= 2.5 ? '#e5e7eb' : 'rgba(255,255,255,0.5)'}
                  tip={formatKda(p).tip} />
              </td>
              <td className="px-3 py-2.5 text-center"><KdaSplit k={p.totalKills} d={p.totalDeaths} a={p.totalAssists} /></td>
              <td className="px-3 py-2.5 text-center">
                <MiniBar value={p.avgGoldPerMin} max={maxOf.gold} color="#eab308" label={fmtNumber(Math.round(p.avgGoldPerMin))} tip={`${p.avgGoldPerMin.toFixed(1)} oro por minuto`} />
              </td>
              <td className="px-3 py-2.5 text-center">
                <MiniBar value={p.avgDamagePerMin} max={maxOf.dmg} color="#f97316" label={fmtNumber(Math.round(p.avgDamagePerMin))} tip={`${p.avgDamagePerMin.toFixed(1)} daño a campeones por minuto`} />
              </td>
              <td className="px-3 py-2.5 text-center">
                <MiniBar value={p.avgCsPerMin} max={maxOf.cs} color="#e5e7eb" label={p.avgCsPerMin.toFixed(1)} tip={`${p.avgCsPerMin.toFixed(1)} súbditos por minuto`} />
              </td>
              <td className="px-3 py-2.5 text-center">
                <MiniBar value={p.avgVisionPerMin} max={maxOf.vis} color="#22d3ee" label={p.avgVisionPerMin.toFixed(2)} tip={`${p.avgVisionPerMin.toFixed(2)} puntos de visión por minuto`} />
              </td>
              <td className="px-3 py-2.5 text-center"><PentaBadge count={p.pentaKills} /></td>
            </tr>
            );
          })}
        </tbody>
      </table>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}

// ─── Charts ───────────────────────────────────────────────────────────────────

const CHART_STYLE = { background: 'transparent', fontSize: 10, fill: 'rgba(255,255,255,0.4)' };

/** Tick del eje Y con avatar de 16px + nombre (SVG puro; sin librerías). */
export function AvatarTick({ x, y, payload, avatarUrl }: {
  x?: number; y?: number; payload?: { value: string }; avatarUrl?: (name: string) => string | null;
}) {
  const name = String(payload?.value ?? '');
  const src = avatarUrl?.(name) ?? null;
  const size = 16;
  const tx = (x ?? 0) - 6;
  const ty = y ?? 0;
  return (
    <g transform={`translate(${tx},${ty})`}>
      {src && (
        <>
          <clipPath id={`td-tick-${name.replace(/[^a-z0-9]/gi, '')}`}>
            <rect x={-size} y={-size / 2} width={size} height={size} rx={5} />
          </clipPath>
          <image href={src} x={-size} y={-size / 2} width={size} height={size}
            clipPath={`url(#td-tick-${name.replace(/[^a-z0-9]/gi, '')})`} preserveAspectRatio="xMidYMid slice" />
        </>
      )}
      <text x={src ? -size - 6 : 0} y={0} dy={3.5} textAnchor="end" fill="rgba(255,255,255,0.55)" fontSize={9.5}>
        {name.length > 11 ? `${name.slice(0, 10)}…` : name}
      </text>
    </g>
  );
}

type ChartMetric = 'avgDamagePerMin' | 'avgGoldPerMin' | 'avgKda';
const CHART_LABELS: Record<ChartMetric, { label: string; color: string }> = {
  avgDamagePerMin: { label: 'Daño/min',     color: '#f97316' },
  avgGoldPerMin:   { label: 'Oro/min',      color: '#eab308' },
  avgKda:          { label: 'KDA Promedio', color: '#22c55e' },
};

function TopPlayersChart({ players, avatarUrl }: { players: PlayerAggregate[]; avatarUrl?: (name: string) => string | null }) {
  const [metric, setMetric] = useState<ChartMetric>('avgDamagePerMin');

  const data = useMemo(() =>
    [...players]
      .sort((a, b) => (b[metric] as number) - (a[metric] as number))
      .slice(0, 8)
      .map(p => ({
        name:  p.summonerName,
        value: Math.round((p[metric] as number) * 10) / 10,
      })),
    [players, metric]
  );

  const { label, color } = CHART_LABELS[metric];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-white/40 uppercase tracking-widest">Top 8 Jugadores</p>
        <div className="flex gap-1">
          {(Object.entries(CHART_LABELS) as [ChartMetric, typeof CHART_LABELS[ChartMetric]][]).map(([k, v]) => (
            <button
              key={k}
              onClick={() => setMetric(k)}
              className={cn(
                'px-2 py-1 rounded-lg text-[10px] font-semibold transition-all',
                metric === k ? 'bg-white text-black' : 'bg-white/[0.04] text-white/40 hover:bg-white/[0.08] hover:text-white/70',
              )}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={metric} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={data} layout="vertical" margin={{ left: 70, right: 28 }}>
              <defs>
                <linearGradient id="td-top8-grad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor={color} stopOpacity={0.55} />
                  <stop offset="100%" stopColor={color} stopOpacity={1} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="2 6" stroke="rgba(255,255,255,0.05)" horizontal={false} />
              <XAxis type="number" tick={CHART_STYLE} axisLine={false} tickLine={false} tickFormatter={v => fmtNumber(v)} />
              <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} width={avatarUrl ? 92 : 66}
                tick={(props: any) => <AvatarTick {...props} avatarUrl={avatarUrl} />} />
              <RechartTooltip
                contentStyle={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
                labelStyle={{ color: 'white', fontSize: 11 }}
                itemStyle={{ color: 'rgba(255,255,255,0.7)', fontSize: 10 }}
                formatter={(v: number) => [fmtNumber(v), label]}
              />
              <Bar dataKey="value" name={label} radius={[0, 8, 8, 0]} background={{ fill: 'rgba(255,255,255,0.035)', radius: 8 } as any}>
                {data.map((_, i) => <Cell key={i} fill="url(#td-top8-grad)" />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

interface Props {
  data: TournamentGlobalStats;
  loading?: boolean;
  onRefresh?: () => void;
  /** Equipo por jugador, clave = playerKey(nombre, tag) y, como respaldo,
   *  playerKey(nombre). Lo construye StatsTab cruzando el roster inscrito; los
   *  jugadores sin cruce se agrupan como "Sin equipo" (nunca se descartan). */
  teamBySummoner?: Record<string, string>;
  /** Clasificación del torneo (19 equipos en LQC) para el gráfico de WR por equipo. */
  standings?: TeamStanding[];
  /** Nombre del torneo, para la tarjeta compartible del podio. */
  tournamentName?: string;
  /** Logo del torneo servido desde /public, para la tarjeta compartible. */
  logoUrl?: string;
  /** Plataforma de Riot del torneo ('la1'…) para resolver iconos de perfil. */
  region?: string;
}

/** ≤720px: el radar se abre en cajón; en escritorio, como panel en el flujo. */
function useIsNarrow(): boolean {
  const [narrow, setNarrow] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 720px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 720px)');
    const on = () => setNarrow(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return narrow;
}

type MinGames = 'all' | '1' | '3' | '5';
const MIN_GAMES: { key: MinGames; label: string }[] = [
  { key: 'all', label: 'Todos' }, { key: '1', label: '≥1' }, { key: '3', label: '≥3' }, { key: '5', label: '≥5' },
];

export function TournamentGlobalStats({ data, loading, onRefresh, teamBySummoner, standings, tournamentName, logoUrl, region }: Props) {
  const [podiumCat, setPodiumCat] = useState<GlobalSortKey>('avgKda');
  // Jugador abierto en el radar (fila de la tabla o podio).
  const [picked, setPicked] = useState<PlayerAggregate | null>(null);
  const narrow = useIsNarrow();

  const { players: allPlayers, matchesCompleted } = data;

  // Iconos de perfil de TODOS los jugadores en una sola llamada batch (108 en
  // LQC). La persona se identifica por su icono de perfil; el campeón más
  // jugado queda como respaldo dentro de PlayerAvatar.
  const allRiotIds = useMemo(() => allPlayers.map(riotIdOf), [allPlayers]);
  const { data: iconMap } = useProfileIcons(`stats-${data.tournamentId}`, allRiotIds, region || 'la1');
  const iconOf = (p: PlayerAggregate) => iconFor(iconMap, riotIdOf(p));
  const avatarUrlOf = (summonerName: string): string | null => {
    const p = allPlayers.find((x) => x.summonerName === summonerName);
    const id = p ? iconOf(p) : null;
    return id ? dd.profileIcon(id) : p?.mostPlayedChamp ? dd.champion(p.mostPlayedChamp) : null;
  };

  // ── Filtros (cliente): búsqueda, mín. partidas, equipo ──
  const [q, setQ] = useState('');
  const [minGames, setMinGames] = useState<MinGames>('all');
  const [team, setTeam] = useState<string | null>(null);
  // Jugador resaltado en la tabla (seguirlo entre 100+ filas al reordenar).
  const [marked, setMarked] = useState<string | null>(null);

  const teamOf = (p: PlayerAggregate): string | null => {
    if (!teamBySummoner) return null;
    return teamBySummoner[playerKey(p.summonerName, p.tagLine)]
      ?? teamBySummoner[playerKey(p.summonerName)]
      ?? null;
  };

  const teams = useMemo(() => {
    if (!teamBySummoner) return [] as string[];
    const set = new Set<string>();
    let orphan = false;
    for (const p of allPlayers) { const t = teamOf(p); if (t) set.add(t); else orphan = true; }
    const list = [...set].sort((a, b) => a.localeCompare(b));
    return orphan ? [...list, NO_TEAM] : list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allPlayers, teamBySummoner]);

  const players = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const min = minGames === 'all' ? 0 : Number(minGames);
    return allPlayers.filter(p => {
      if (p.gamesPlayed < min) return false;
      if (team) { const t = teamOf(p) ?? NO_TEAM; if (t !== team) return false; }
      if (needle) {
        const hay = `${p.summonerName} ${p.tagLine} ${teamOf(p) ?? ''}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allPlayers, q, minGames, team, teamBySummoner]);

  const hasFilters = q.trim() !== '' || minGames !== 'all' || team !== null;
  const clearFilters = () => { setQ(''); setMinGames('all'); setTeam(null); };

  const mostPlayedChamp = useMemo(() => {
    const counts = new Map<string, number>();
    players.forEach(p => {
      p.championPool.forEach(c => counts.set(c, (counts.get(c) ?? 0) + 1));
    });
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  }, [players]);

  if (matchesCompleted === 0) {
    return (
      <div className="td-panel py-20 text-center">
        <Trophy className="h-14 w-14 mx-auto mb-4 text-white/10" />
        <p className="text-white/30 text-sm">Aún no hay partidas completadas en este torneo</p>
        <p className="text-xs text-white/15 mt-1">Los stats globales aparecerán cuando termine la primera partida</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* Summary cards — patrón vision: cuadrado de icono con degradado */}
      <div className="grid grid-cols-3 gap-3">
        <div className="td-panel p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(135deg, #c8aa6e, #785a28)', boxShadow: '0 8px 22px rgba(200,170,110,0.28)' }}>
            <Trophy className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-[10px] text-white/30 uppercase tracking-wider">Partidas</p>
            <p className="text-xl font-black text-white">{matchesCompleted}</p>
          </div>
        </div>
        <div className="td-panel p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(135deg, #e1242e, #7d1017)', boxShadow: '0 8px 22px rgba(225,36,46,0.35)' }}>
            <Users className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-[10px] text-white/30 uppercase tracking-wider">Jugadores</p>
            <p className="text-xl font-black text-white">
              {players.length}
              {hasFilters && <span className="text-xs font-semibold text-white/30"> / {allPlayers.length}</span>}
            </p>
          </div>
        </div>
        <div className="td-panel p-4 flex items-center gap-3">
          {mostPlayedChamp && (
            <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0 border border-white/10">
              <ImgSlot src={dd.champion(mostPlayedChamp)} alt={mostPlayedChamp} className="w-10 h-10" />
            </div>
          )}
          {!mostPlayedChamp && (
            <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 shrink-0">
              <Star className="h-4 w-4 text-purple-400" />
            </div>
          )}
          <div className="min-w-0">
            <p className="text-[10px] text-white/30 uppercase tracking-wider">Más jugado</p>
            <p className="text-sm font-bold text-white truncate">{mostPlayedChamp ?? '—'}</p>
          </div>
        </div>
      </div>

      {/* Barra de filtros: la misma lista filtrada alimenta podio, gráfica y tabla */}
      <StatsCoachmarks playerCount={allPlayers.length} />
      <div className="td-panel td-filterbar">
        <div className="td-filterbar-row">
          <div className="td-search-wrap" data-td-search>
            <Search size={14} />
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Buscar jugador…"
              aria-label="Buscar jugador"
              className="td-search"
            />
            {q && (
              <button type="button" className="td-search-clear" aria-label="Limpiar búsqueda" onClick={() => setQ('')}>
                <X size={12} />
              </button>
            )}
          </div>
          <PlayerTeamCommand
            players={allPlayers.map(p => ({ name: p.summonerName, tag: p.tagLine, team: teamOf(p) }))}
            teams={teams}
            onPickPlayer={name => setQ(name)}
            onPickTeam={t => setTeam(t)}
          />
          {team && (
            <span className="td-chip-x">
              <Users size={12} /> {team}
              <button type="button" aria-label="Quitar filtro de equipo" onClick={() => setTeam(null)}><X size={11} /></button>
            </span>
          )}
        </div>
        <div className="td-filterbar-row">
          <Tip label="Mínimo de partidas jugadas en el torneo">
            <span className="td-filter-label td-over">Mín. partidas</span>
          </Tip>
          <FilterPills<MinGames> items={MIN_GAMES} value={minGames} onChange={setMinGames} />
          {hasFilters && (
            <span style={{ marginLeft: 'auto' }}>
              <Button variant="ghost" onClick={clearFilters}>Quitar filtros</Button>
            </span>
          )}
        </div>
      </div>

      {players.length === 0 && (
        <div className="td-panel td-filter-empty">
          <Users className="h-8 w-8 text-white/15" />
          <p className="text-sm text-white/40">Ningún jugador coincide con los filtros</p>
          <Button variant="secondary" onClick={clearFilters}>Quitar filtros</Button>
        </div>
      )}

      {/* Radar del jugador elegido: cajón en móvil, panel en escritorio */}
      {picked && !narrow && (
        <PlayerCompare
          player={picked}
          cohort={allPlayers}
          teamOf={(p) => teamOf(p)}
          iconOf={iconOf}
          onClose={() => setPicked(null)}
        />
      )}
      {narrow && (
        <Drawer open={!!picked} onOpenChange={(o) => { if (!o) setPicked(null); }}>
          <DrawerContent className="td-root border-white/10 bg-[#0c0b10] max-h-[92vh] overflow-y-auto">
            {picked && (
              <div style={{ padding: '8px 14px 22px' }}>
                <PlayerCompare
                  player={picked}
                  cohort={allPlayers}
                  teamOf={(p) => teamOf(p)}
          iconOf={iconOf}
                  onClose={() => setPicked(null)}
                />
              </div>
            )}
          </DrawerContent>
        </Drawer>
      )}

      {/* Podium */}
      {players.length > 0 && <div className="td-panel p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <p className="text-xs text-white/40 uppercase tracking-widest font-bold">
            <span className="inline-flex items-center gap-1.5"><Trophy className="h-4 w-4" aria-hidden />Top 3 — {PODIUM_CATS.find(c => c.key === podiumCat)?.label}</span>
          </p>
          <SharePodiumButton data={{
            tournamentId: data.tournamentId,
            tournamentName: tournamentName ?? data.tournamentId.toUpperCase(),
            subtitle: 'Liga Queretana',
            category: PODIUM_CATS.find(c => c.key === podiumCat)?.label ?? '',
            logoUrl,
            // Mismo orden y mismo formato que el podio en pantalla, incluido el
            // recorte del KDA extremo (formatKda) — no se comparte un 54 crudo.
            entries: (() => {
              const cat = PODIUM_CATS.find(c => c.key === podiumCat)!;
              return [...players]
                .sort((a, b) => (b[podiumCat] as number) - (a[podiumCat] as number))
                .slice(0, 3)
                .map((p, i) => ({
                  rank: (i + 1) as 1 | 2 | 3,
                  player: p,
                  value: podiumCat === 'avgKda' ? formatKda(p).text : cat.fmt(p[podiumCat] as number),
                })) as PodiumEntry[];
            })(),
          }} />
          <div className="flex flex-wrap gap-1">
            {PODIUM_CATS.map(cat => (
              <button
                key={cat.key}
                onClick={() => setPodiumCat(cat.key)}
                className={cn(
                  'flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold transition-all',
                  podiumCat === cat.key
                    ? 'bg-white text-black'
                    : 'bg-white/[0.04] text-white/40 hover:bg-white/[0.08] hover:text-white/70',
                )}
              >
                {cat.icon}{cat.label}
              </button>
            ))}
          </div>
        </div>
        <AnimatePresence mode="wait">
          <motion.div
            key={podiumCat}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            <Podium players={players} sortKey={podiumCat} onPick={setPicked} iconOf={iconOf} />
          </motion.div>
        </AnimatePresence>
      </div>}

      {/* Chart */}
      {players.length > 0 && <div className="td-panel p-5">
        <TopPlayersChart players={players} avatarUrl={avatarUrlOf} />
      </div>}

      {/* Sortable table */}
      {players.length > 0 && <div className="td-panel p-5">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/[0.05]">
          <p className="text-xs text-white/50 uppercase tracking-widest font-bold">Tabla completa</p>
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs text-white/40
                hover:text-white hover:bg-white/[0.06] transition-all"
            >
              <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} />
              Actualizar
            </button>
          )}
        </div>
        <SortableTable players={players} marked={marked} onMark={setMarked} onPick={setPicked} iconOf={iconOf} />
      </div>}

      {/* Más gráficos: agregados del torneo (campeones, WR, equipos, multikills) */}
      {players.length > 0 && (
        <div>
          <div className="td-over" style={{ margin: '4px 2px 10px', letterSpacing: '2px' }}>MÁS GRÁFICOS</div>
          <StatsCharts
            players={players}
            standings={standings}
            minGames={minGames === 'all' ? 0 : Number(minGames)}
            avatarUrl={avatarUrlOf}
          />
        </div>
      )}
    </div>
  );
}
