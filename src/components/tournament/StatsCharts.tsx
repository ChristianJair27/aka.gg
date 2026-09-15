// ATAK.GG — Gráficos agregados del torneo ("Más gráficos").
//
// Todo sale de datos que ya servimos: PlayerAggregate (pool de campeones,
// winrate, multikills) y la clasificación del dashboard (19 equipos). Cero
// campos inventados, cero endpoints nuevos.
import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell, LabelList,
} from 'recharts';
import { Swords, Trophy, Users, Flame } from 'lucide-react';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { AvatarTick } from '@/components/TournamentGlobalStats';
import { SectionHead } from '@/components/tournament/ui';
import { Tip } from '@/components/ui/Tip';
import { dd } from '@/lib/dataDragon';
import type { PlayerAggregate } from '@/types/tournament-global-stats';

const RED = '#e1242e';
const WIN = '#2fbf8a';
const GOLD = '#c8aa6e';
const LOSS = '#ff5a64';

const AXIS = { fill: 'rgba(255,255,255,0.45)', fontSize: 10 };
const GRID = { strokeDasharray: '2 6', stroke: 'rgba(255,255,255,0.05)' };
/** Pista de fondo tras cada barra: se lee el 100% aunque el valor sea bajo. */
const TRACK = { fill: 'rgba(255,255,255,0.035)', radius: 8 } as any;
const CURSOR = { fill: 'rgba(255,255,255,0.04)' };

/** Gradientes SVG reutilizados por todos los gráficos (nada de rellenos planos). */
function Gradients() {
  const g = (id: string, c: string, dir: 'h' | 'v') => (
    <linearGradient key={id} id={id} x1="0" y1={dir === 'v' ? '1' : '0'} x2={dir === 'h' ? '1' : '0'} y2="0">
      <stop offset="0%" stopColor={c} stopOpacity={0.5} />
      <stop offset="100%" stopColor={c} stopOpacity={1} />
    </linearGradient>
  );
  return (
    <defs>
      {g('td-g-red-h', RED, 'h')}{g('td-g-win-h', WIN, 'h')}{g('td-g-gold-h', GOLD, 'h')}{g('td-g-loss-h', LOSS, 'h')}
      {g('td-g-red-v', RED, 'v')}{g('td-g-win-v', WIN, 'v')}{g('td-g-gold-v', GOLD, 'v')}
      {g('td-g-dim-v', 'rgba(255,255,255,0.6)', 'v')}
    </defs>
  );
}

/** WR con tan pocas partidas no dice nada: piso del gráfico de winrate. */
const WR_CHART_MIN_GAMES = 3;

export interface TeamStanding {
  name: string; wins: number; losses: number; winratePct: number; color?: string;
}

// ── 1. Campeones más pickeados ───────────────────────────────────────────────
function ChampionPicks({ players }: { players: PlayerAggregate[] }) {
  const data = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of players) for (const c of p.championPool) counts.set(c, (counts.get(c) ?? 0) + 1);
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([champion, jugadores]) => ({ champion, jugadores }));
  }, [players]);

  const config: ChartConfig = { jugadores: { label: 'Jugadores', color: RED } };
  if (!data.length) return null;

  return (
    <div className="td-panel td-chart-card">
      <SectionHead icon={<Swords size={14} color={RED} />} title="CAMPEONES MÁS PICKEADOS"
        right={<Tip label="Cuántos jugadores distintos lo han usado en el torneo"><span className="td-over">JUGADORES</span></Tip>} />
      <ChartContainer config={config} className="aspect-auto h-[260px] w-full">
        <BarChart data={data} layout="vertical" margin={{ left: 6, right: 28, top: 4, bottom: 4 }}>
          <Gradients />
          <CartesianGrid {...GRID} horizontal={false} />
          <XAxis type="number" tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} />
          <YAxis type="category" dataKey="champion" tick={AXIS} axisLine={false} tickLine={false} width={78} />
          <ChartTooltip cursor={CURSOR} content={<ChartTooltipContent indicator="line" />} />
          <Bar dataKey="jugadores" radius={[0, 8, 8, 0]} fill="url(#td-g-red-h)" background={TRACK}>
            <LabelList dataKey="jugadores" position="right" fill="rgba(255,255,255,0.55)" fontSize={10} />
          </Bar>
        </BarChart>
      </ChartContainer>
      <div className="td-chart-strip">
        {data.slice(0, 8).map((d) => (
          <Tip key={d.champion} label={`${d.champion} · ${d.jugadores} jugadores`}>
            <img src={dd.champion(d.champion)} alt={d.champion} loading="lazy"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }} />
          </Tip>
        ))}
      </div>
    </div>
  );
}

// ── 2. Mejor WR% ─────────────────────────────────────────────────────────────
function BestWinrate({ players, minGames, avatarUrl }: {
  players: PlayerAggregate[]; minGames: number; avatarUrl?: (name: string) => string | null;
}) {
  // Si el filtro de la barra no impone mínimo, el gráfico aplica el suyo: un
  // 100% de una sola partida taparía a quien gana 8 de 10.
  const floor = Math.max(minGames, WR_CHART_MIN_GAMES);
  const data = useMemo(() => players
    .filter((p) => p.gamesPlayed >= floor)
    .sort((a, b) => b.winrate - a.winrate || b.gamesPlayed - a.gamesPlayed)
    .slice(0, 8)
    .map((p) => ({ jugador: p.summonerName, wr: p.winrate, pj: p.gamesPlayed })),
    [players, floor]);

  const config: ChartConfig = { wr: { label: 'WR%', color: WIN } };
  if (!data.length) return null;

  return (
    <div className="td-panel td-chart-card">
      <SectionHead icon={<Trophy size={14} color={WIN} />} title="MEJOR WR%"
        right={<Tip label={`Solo jugadores con ${floor} o más partidas`}><span className="td-over">≥{floor} PJ</span></Tip>} />
      <ChartContainer config={config} className="aspect-auto h-[260px] w-full">
        <BarChart data={data} layout="vertical" margin={{ left: 6, right: 34, top: 4, bottom: 4 }}>
          <Gradients />
          <CartesianGrid {...GRID} horizontal={false} />
          <XAxis type="number" domain={[0, 100]} tick={AXIS} axisLine={false} tickLine={false} unit="%" />
          <YAxis type="category" dataKey="jugador" axisLine={false} tickLine={false} width={avatarUrl ? 108 : 86}
            tick={(props: any) => <AvatarTick {...props} avatarUrl={avatarUrl} />} />
          <ChartTooltip cursor={CURSOR}
            content={<ChartTooltipContent indicator="line"
              formatter={(v: any, _n: any, item: any) => [`${v}% · ${item?.payload?.pj} PJ`, 'WR']} />} />
          <Bar dataKey="wr" radius={[0, 8, 8, 0]} fill="url(#td-g-win-h)" background={TRACK}>
            <LabelList dataKey="pj" position="right" fill="rgba(255,255,255,0.45)" fontSize={9.5}
              formatter={(v: number) => `${v} PJ`} />
          </Bar>
        </BarChart>
      </ChartContainer>
    </div>
  );
}

// ── 3. WR por equipo ─────────────────────────────────────────────────────────
function TeamWinrate({ standings }: { standings: TeamStanding[] }) {
  const data = useMemo(() => [...standings]
    .filter((s) => s.wins + s.losses > 0)
    .sort((a, b) => b.winratePct - a.winratePct)
    .map((s) => ({ equipo: s.name, wr: Math.round(s.winratePct), record: `${s.wins}-${s.losses}` })),
    [standings]);

  const config: ChartConfig = { wr: { label: 'WR%', color: GOLD } };
  if (!data.length) return null;

  return (
    <div className="td-panel td-chart-card td-chart-card--wide">
      <SectionHead icon={<Users size={14} color={GOLD} />} title="WR POR EQUIPO"
        right={<Tip label="Series ganadas sobre series jugadas"><span className="td-over">{data.length} EQUIPOS</span></Tip>} />
      <ChartContainer config={config} className="aspect-auto h-[300px] w-full">
        <BarChart data={data} layout="vertical" margin={{ left: 6, right: 40, top: 4, bottom: 4 }}>
          <Gradients />
          <CartesianGrid {...GRID} horizontal={false} />
          <XAxis type="number" domain={[0, 100]} tick={AXIS} axisLine={false} tickLine={false} unit="%" />
          <YAxis type="category" dataKey="equipo" tick={{ ...AXIS, fontSize: 9.5 }} axisLine={false} tickLine={false} width={118} />
          <ChartTooltip cursor={CURSOR}
            content={<ChartTooltipContent indicator="line"
              formatter={(v: any, _n: any, item: any) => [`${v}% · ${item?.payload?.record}`, 'WR']} />} />
          <Bar dataKey="wr" radius={[0, 8, 8, 0]} background={TRACK}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.wr >= 60 ? 'url(#td-g-win-h)' : d.wr >= 40 ? 'url(#td-g-gold-h)' : 'url(#td-g-loss-h)'} />
            ))}
            <LabelList dataKey="record" position="right" fill="rgba(255,255,255,0.45)" fontSize={9.5} />
          </Bar>
        </BarChart>
      </ChartContainer>
    </div>
  );
}

// ── 4. Multikills del torneo ─────────────────────────────────────────────────
function Multikills({ players }: { players: PlayerAggregate[] }) {
  const data = useMemo(() => {
    const t = players.reduce((a, p) => ({
      penta: a.penta + p.pentaKills, quadra: a.quadra + p.quadraKills,
      triple: a.triple + p.tripleKills, double: a.double + p.doubleKills,
    }), { penta: 0, quadra: 0, triple: 0, double: 0 });
    return [
      { tipo: 'Dobles', total: t.double, color: 'url(#td-g-dim-v)' },
      { tipo: 'Triples', total: t.triple, color: 'url(#td-g-win-v)' },
      { tipo: 'Cuádruples', total: t.quadra, color: 'url(#td-g-gold-v)' },
      { tipo: 'Pentas', total: t.penta, color: 'url(#td-g-red-v)' },
    ];
  }, [players]);

  const config: ChartConfig = { total: { label: 'Total', color: RED } };
  const totalAll = data.reduce((a, d) => a + d.total, 0);
  if (!totalAll) return null;

  return (
    <div className="td-panel td-chart-card">
      <SectionHead icon={<Flame size={14} color={GOLD} />} title="MULTIKILLS DEL TORNEO"
        right={<Tip label="Suma de todas las partidas registradas"><span className="td-over">{totalAll} TOTAL</span></Tip>} />
      <ChartContainer config={config} className="aspect-auto h-[220px] w-full">
        <BarChart data={data} margin={{ left: 0, right: 8, top: 14, bottom: 4 }}>
          <Gradients />
          <CartesianGrid {...GRID} vertical={false} />
          <XAxis dataKey="tipo" tick={AXIS} axisLine={false} tickLine={false} />
          <YAxis tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} width={34} />
          <ChartTooltip cursor={CURSOR} content={<ChartTooltipContent indicator="line" />} />
          <Bar dataKey="total" radius={[10, 10, 0, 0]} background={{ ...TRACK, radius: [10, 10, 0, 0] }}>
            {data.map((d, i) => <Cell key={i} fill={d.color} />)}
            <LabelList dataKey="total" position="top" fill="rgba(255,255,255,0.55)" fontSize={10} />
          </Bar>
        </BarChart>
      </ChartContainer>
    </div>
  );
}

/** Sección completa. `players` ya viene filtrado por la barra de Estadísticas. */
export function StatsCharts({ players, standings, minGames, avatarUrl }: {
  players: PlayerAggregate[];
  standings?: TeamStanding[];
  /** Mínimo de partidas activo en la barra de filtros (0 = "Todos"). */
  minGames: number;
  /** Avatar (icono de perfil o campeón) por nombre, para los ticks del eje. */
  avatarUrl?: (name: string) => string | null;
}) {
  return (
    <div className="td-charts-grid">
      <ChampionPicks players={players} />
      <BestWinrate players={players} minGames={minGames} avatarUrl={avatarUrl} />
      {standings?.length ? <TeamWinrate standings={standings} /> : null}
      <Multikills players={players} />
    </div>
  );
}

export default StatsCharts;
