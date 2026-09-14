// ATAK.GG — Radar de un jugador contra el promedio del torneo.
//
// Tarjeta de dos zonas: identidad + pool de campeones a la izquierda, radar de
// 8 ejes a la derecha. Cristal ATAK, sin cromo de otras ligas.
//
// ── Normalización (lee esto antes de tocar los ejes) ─────────────────────────
// Cada eje se lleva a 0–100 comparando SIEMPRE contra la misma cohorte (por
// defecto, quien tenga ≥3 partidas: 81 jugadores en LQC 2026). El método es
// idéntico para el jugador y para "Promedio LQC", así que las dos siluetas son
// comparables.
//
//   1. Se winsoriza la métrica a [p05, p95] de la cohorte. Esto es obligatorio:
//      el KDA real de futaba#kıss es 54 (9 kills, 2 muertes, 99 asistencias en
//      4 partidas) mientras la mediana es 2.6 y el p95 es 7.6. Sin winsorizar,
//      ese único dato aplasta el eje de KDA y las demás siluetas quedan pegadas
//      al centro. Winsorizar recorta el valor pintado, NO el dato: la tabla y
//      el tooltip siguen mostrando 54.
//   2. Se mapea linealmente a 0–100 dentro de ese rango.
//   3. "Supervivencia" se invierte: menos muertes por partida ⇒ más puntuación.
//
// El radar nunca inventa campos: todo sale de PlayerAggregate tal cual lo sirve
// el backend (participación y supervivencia son derivadas, y se marcan como
// proxy en su Tip).
import { useMemo } from 'react';
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend,
} from 'recharts';
import { cn } from '@/lib/utils';
import { dd } from '@/lib/dataDragon';
import { ChartContainer, ChartTooltip, type ChartConfig } from '@/components/ui/chart';
import { Tip } from '@/components/ui/Tip';
import type { PlayerAggregate } from '@/types/tournament-global-stats';

const RED = '#e1242e';
const WIN = '#2fbf8a';
const GOLD = '#c8aa6e';
const MUTED = '#9ca3af';

/** Partidas mínimas para entrar en la cohorte de referencia. */
export const RADAR_MIN_GAMES = 3;
/** Tope de KDA que se PINTA (el valor real se sigue mostrando en texto). */
export const KDA_DISPLAY_MAX = 20;

// ── Ejes ─────────────────────────────────────────────────────────────────────
type AxisKey =
  | 'kda' | 'winrate' | 'damage' | 'gold' | 'cs' | 'vision' | 'participation' | 'survival';

type AxisDef = {
  key: AxisKey;
  label: string;
  /** Valor crudo del jugador (mismo que se muestra en el tooltip). */
  raw: (p: PlayerAggregate) => number;
  /** Formato del valor crudo. */
  fmt: (v: number) => string;
  /** true = menos es mejor (se invierte al normalizar). */
  invert?: boolean;
  tip?: string;
};

export const RADAR_AXES: AxisDef[] = [
  { key: 'kda', label: 'KDA', raw: (p) => p.avgKda, fmt: (v) => v.toFixed(2),
    tip: 'KDA medio (K+A)/D — el radar recorta los extremos para que la escala se lea' },
  { key: 'winrate', label: 'WR%', raw: (p) => p.winrate, fmt: (v) => `${Math.round(v)}%` },
  { key: 'damage', label: 'Daño/min', raw: (p) => p.avgDamagePerMin, fmt: (v) => Math.round(v).toLocaleString('es-MX') },
  { key: 'gold', label: 'Oro/min', raw: (p) => p.avgGoldPerMin, fmt: (v) => Math.round(v).toLocaleString('es-MX') },
  { key: 'cs', label: 'CS/min', raw: (p) => p.avgCsPerMin, fmt: (v) => v.toFixed(1) },
  { key: 'vision', label: 'Visión/min', raw: (p) => p.avgVisionPerMin, fmt: (v) => v.toFixed(2) },
  { key: 'participation', label: 'Participación',
    raw: (p) => (p.totalKills + p.totalAssists) / Math.max(1, p.gamesPlayed), fmt: (v) => v.toFixed(1),
    tip: 'Kills+asistencias por partida (proxy)' },
  { key: 'survival', label: 'Supervivencia',
    raw: (p) => p.totalDeaths / Math.max(1, p.gamesPlayed), fmt: (v) => `${v.toFixed(1)} muertes`,
    invert: true, tip: 'Menos muertes por partida = más supervivencia' },
];

// ── Estadística de apoyo ─────────────────────────────────────────────────────
function quantile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const i = (sorted.length - 1) * p;
  const lo = Math.floor(i), hi = Math.ceil(i);
  return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
}

type AxisScale = { lo: number; hi: number; avg: number };

/** Rango winsorizado [p05, p95] + media de la cohorte, por eje. */
export function buildScales(cohort: PlayerAggregate[]): Record<AxisKey, AxisScale> {
  const out = {} as Record<AxisKey, AxisScale>;
  for (const ax of RADAR_AXES) {
    const vals = cohort.map(ax.raw).filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
    const lo = quantile(vals, 0.05);
    const hi = quantile(vals, 0.95);
    const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    out[ax.key] = { lo, hi: hi > lo ? hi : lo + 1, avg };
  }
  return out;
}

/** Valor crudo → 0–100 winsorizado (e invertido si menos es mejor). */
function normalize(value: number, scale: AxisScale, invert?: boolean): number {
  const clamped = Math.min(scale.hi, Math.max(scale.lo, value));
  const pct = ((clamped - scale.lo) / (scale.hi - scale.lo)) * 100;
  return Math.round(invert ? 100 - pct : pct);
}

/**
 * KDA para mostrar: por encima de KDA_DISPLAY_MAX se marca como extremo.
 * Devuelve también el texto exacto para el Tip, con el desglose K/D/A.
 */
export function formatKda(p: Pick<PlayerAggregate, 'avgKda' | 'totalKills' | 'totalDeaths' | 'totalAssists'>) {
  const exact = p.avgKda.toFixed(2);
  const detail = `${exact} (${p.totalKills}/${p.totalDeaths}/${p.totalAssists})`;
  if (p.avgKda <= KDA_DISPLAY_MAX) return { text: exact, extreme: false, detail, tip: detail };
  return {
    text: `${KDA_DISPLAY_MAX}+`,
    extreme: true,
    detail,
    tip: `${detail} — KDA extremo por pocas muertes (K+A)/D`,
  };
}

// ── Tarjeta ──────────────────────────────────────────────────────────────────
export interface PlayerRadarCardProps {
  player: PlayerAggregate;
  /** Cohorte de referencia. Se filtra a ≥ RADAR_MIN_GAMES internamente. */
  cohort: PlayerAggregate[];
  /** Segundo jugador para superponer (comparación). */
  compare?: PlayerAggregate | null;
  /** Versión estrecha para el modal de equipo. */
  compact?: boolean;
}

export function PlayerRadarCard({ player, cohort, compare, compact }: PlayerRadarCardProps) {
  const ref = useMemo(() => {
    const eligible = cohort.filter((p) => p.gamesPlayed >= RADAR_MIN_GAMES);
    return eligible.length >= 5 ? eligible : cohort;
  }, [cohort]);

  const scales = useMemo(() => buildScales(ref), [ref]);

  const data = useMemo(() => RADAR_AXES.map((ax) => {
    const sc = scales[ax.key];
    const row: Record<string, string | number> = {
      axis: ax.label,
      jugador: normalize(ax.raw(player), sc, ax.invert),
      promedio: normalize(sc.avg, sc, ax.invert),
      jugadorRaw: ax.fmt(ax.raw(player)),
      promedioRaw: ax.fmt(sc.avg),
    };
    if (compare) {
      row.rival = normalize(ax.raw(compare), sc, ax.invert);
      row.rivalRaw = ax.fmt(ax.raw(compare));
    }
    return row;
  }), [player, compare, scales]);

  const config: ChartConfig = {
    jugador: { label: player.summonerName, color: RED },
    promedio: { label: 'Promedio LQC', color: MUTED },
    ...(compare ? { rival: { label: compare.summonerName, color: GOLD } } : {}),
  };

  if (player.gamesPlayed < 1) {
    return (
      <div className="td-panel td-radar-empty">Sin suficientes partidas para el radar</div>
    );
  }

  const kda = formatKda(player);

  return (
    <div className={cn('td-panel td-radar-card', compact && 'td-radar-card--compact')}>
      {/* Identidad + pool de campeones */}
      <div className="td-radar-id">
        <div className="td-radar-id-head">
          <img
            src={dd.champion(player.mostPlayedChamp || 'Garen')}
            alt={player.mostPlayedChamp}
            loading="lazy"
            className="td-radar-champ"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }}
          />
          <div style={{ minWidth: 0 }}>
            <div className="td-radar-name" title={`${player.summonerName}#${player.tagLine}`}>
              {player.summonerName}
              <span className="td-radar-tag">#{player.tagLine}</span>
            </div>
            <div className="td-radar-sub">{player.mostPlayedChamp || '—'}</div>
          </div>
        </div>

        <div className="td-radar-kpis">
          <div className="td-sub td-radar-kpi">
            <span className="td-over">PJ</span>
            <span className="td-num">{player.gamesPlayed}</span>
          </div>
          <div className="td-sub td-radar-kpi">
            <span className="td-over">W-L</span>
            <span className="td-num" style={{ color: player.winrate >= 50 ? WIN : '#ff5a64' }}>
              {player.wins}-{player.losses}
            </span>
          </div>
          <Tip label={kda.tip}>
            <div className="td-sub td-radar-kpi">
              <span className="td-over">KDA</span>
              <span className="td-num" style={{ color: kda.extreme ? GOLD : 'var(--td-text)' }}>{kda.text}</span>
            </div>
          </Tip>
        </div>

        <Tip label="Kills / Muertes / Asistencias en todo el torneo">
          <div className="td-radar-kda-line td-num">
            {player.totalKills} / <span style={{ color: '#ff5a64' }}>{player.totalDeaths}</span> / {player.totalAssists}
          </div>
        </Tip>

        {player.championPool.length > 0 && (
          <div className="td-radar-pool">
            <div className="td-over" style={{ marginBottom: 6 }}>CAMPEONES</div>
            <div className="td-radar-pool-icons">
              {player.championPool.slice(0, 6).map((c) => (
                <Tip key={c} label={c}>
                  <img
                    src={dd.champion(c)} alt={c} loading="lazy"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }}
                  />
                </Tip>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Radar */}
      <div className="td-radar-chart">
        <ChartContainer config={config} className="aspect-square w-full max-h-[340px]">
          <RadarChart data={data} outerRadius="72%">
            <PolarGrid stroke="rgba(255,255,255,0.10)" />
            <PolarAngleAxis dataKey="axis" tick={{ fill: 'rgba(255,255,255,0.55)', fontSize: 10.5 }} />
            <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
            <ChartTooltip
              content={({ active, payload, label }: any) => {
                if (!active || !payload?.length) return null;
                const row = payload[0].payload;
                return (
                  <div className="td-radar-tip">
                    <div className="td-radar-tip-title">{label}</div>
                    <div><span style={{ color: RED }}>■</span> {player.summonerName}: <strong>{row.jugadorRaw}</strong></div>
                    {compare && <div><span style={{ color: GOLD }}>■</span> {compare.summonerName}: <strong>{row.rivalRaw}</strong></div>}
                    <div><span style={{ color: MUTED }}>■</span> Promedio LQC: <strong>{row.promedioRaw}</strong></div>
                  </div>
                );
              }}
            />
            <Radar
              name="Promedio LQC" dataKey="promedio"
              stroke={MUTED} strokeWidth={1} fill={MUTED} fillOpacity={0.10}
            />
            {compare && (
              <Radar
                name={compare.summonerName} dataKey="rival"
                stroke={GOLD} strokeWidth={2} fill={GOLD} fillOpacity={0.16}
              />
            )}
            <Radar
              name={player.summonerName} dataKey="jugador"
              stroke={RED} strokeWidth={2} fill={RED} fillOpacity={0.28}
              dot={{ r: 2.5, fill: WIN, stroke: 'none' }}
            />
            <Legend
              wrapperStyle={{ fontSize: 11, paddingTop: 6 }}
              iconType="circle" iconSize={8}
            />
          </RadarChart>
        </ChartContainer>
        <p className="td-radar-foot">
          0–100 comparado con los {ref.length} jugadores de ≥{RADAR_MIN_GAMES} partidas. Los extremos se recortan
          al percentil 95 para que la escala se lea; los valores reales están en el tooltip.
        </p>
      </div>
    </div>
  );
}

export default PlayerRadarCard;
