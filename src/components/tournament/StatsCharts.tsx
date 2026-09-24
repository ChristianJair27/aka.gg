// ATAK.GG — Gráficos agregados del torneo ("Más gráficos").
//
// Todo sale de datos que ya servimos: PlayerAggregate (pool de campeones,
// winrate, multikills) y la clasificación del dashboard. Cero campos
// inventados, cero endpoints nuevos.
//
// Por qué ya no usa Recharts. Había dos fallos, los dos de la librería y no
// de los datos:
//   1. Las barras no se pintaban. Los degradados vivían en un componente
//      propio <Gradients/> dentro del <BarChart>, y Recharts 2 descarta en
//      silencio cualquier hijo que no sea una etiqueta SVG cruda o uno de sus
//      componentes. Los <defs> nunca llegaban al DOM y cada `fill="url(#…)"`
//      apuntaba a nada: se veía la pista gris y el número, sin barra.
//   2. Solo salía una etiqueta de cada dos. El eje Y mide cada texto y oculta
//      el siguiente si choca; con 19 equipos en 300px no cabían todos.
//
// Estos datos son RANKINGS: la persona lee el nombre, luego el valor, luego
// compara. Eso es una lista con barras, no un plano cartesiano. En HTML cada
// fila tiene su etiqueta siempre, el icono va al lado del nombre sin trucos
// de SVG y el alto crece con las filas en vez de apretarlas.
import { useMemo } from 'react';
import { Flame, Swords, Trophy, Users } from 'lucide-react';
import { SectionHead } from '@/components/tournament/ui';
import { Tip } from '@/components/ui/Tip';
import { dd } from '@/lib/dataDragon';
import type { PlayerAggregate } from '@/types/tournament-global-stats';

const RED = '#e1242e';
const WIN = '#2fbf8a';
const GOLD = '#c8aa6e';
const LOSS = '#ff5a64';

/** WR con tan pocas partidas no dice nada: piso del gráfico de winrate. */
const WR_CHART_MIN_GAMES = 3;

export interface TeamStanding {
  name: string; wins: number; losses: number; winratePct: number;
  color?: string; mono?: string; position?: number;
}

// ── Piezas compartidas ───────────────────────────────────────────────────────

/** Icono cuadrado de 22px con respaldo: si la imagen falla queda la inicial. */
export function RowIcon({ src, label, round }: { src?: string | null; label: string; round?: boolean }) {
  return (
    <span className="td-rank-icon" data-round={round ? 'true' : undefined}>
      <span aria-hidden>{label.slice(0, 1).toUpperCase()}</span>
      {src && (
        <img src={src} alt="" loading="lazy"
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
      )}
    </span>
  );
}

/**
 * Barra de magnitud: crece desde la izquierda, extremo redondeado, y la pista
 * es el mismo tono muy tenue, así el 100% se lee aunque el valor sea bajo.
 */
export function RankBar({ pct, color }: { pct: number; color: string }) {
  const w = Math.max(0, Math.min(100, pct));
  return (
    <span className="td-rank-track" style={{ background: `${color}14` }}>
      <span className="td-rank-fill" style={{ width: `${w}%`, background: color }} />
    </span>
  );
}

// ── 1. Campeones más pickeados ───────────────────────────────────────────────
function ChampionPicks({ players }: { players: PlayerAggregate[] }) {
  const data = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of players) for (const c of p.championPool) counts.set(c, (counts.get(c) ?? 0) + 1);
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 10)
      .map(([champion, jugadores]) => ({ champion, jugadores }));
  }, [players]);

  if (!data.length) return null;
  const max = data[0].jugadores;

  return (
    <div className="td-panel td-chart-card">
      <SectionHead icon={<Swords size={14} color={RED} />} title="CAMPEONES MÁS PICKEADOS"
        right={<Tip label="Cuántos jugadores distintos lo han usado en el torneo"><span className="td-over">JUGADORES</span></Tip>} />
      <ol className="td-rank-list">
        {data.map((d, i) => (
          <Tip key={d.champion} label={`${d.champion}: lo jugaron ${d.jugadores} jugadores distintos`}>
            <li className="td-rank-row">
              <span className="td-rank-pos td-num">{i + 1}</span>
              <RowIcon src={dd.champion(d.champion)} label={d.champion} />
              <span className="td-rank-name">{d.champion}</span>
              <RankBar pct={(d.jugadores / max) * 100} color={RED} />
              <span className="td-rank-val td-num">{d.jugadores}</span>
            </li>
          </Tip>
        ))}
      </ol>
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
    .slice(0, 10),
    [players, floor]);

  if (!data.length) return null;

  return (
    <div className="td-panel td-chart-card">
      <SectionHead icon={<Trophy size={14} color={WIN} />} title="MEJOR WR%"
        right={<Tip label={`Solo jugadores con ${floor} o más partidas`}><span className="td-over">≥{floor} PJ</span></Tip>} />
      <ol className="td-rank-list">
        {data.map((p, i) => {
          const wins = p.wins ?? Math.round((p.winrate / 100) * p.gamesPlayed);
          const losses = p.losses ?? p.gamesPlayed - wins;
          return (
            <Tip key={`${p.summonerName}#${p.tagLine ?? ''}`}
              label={`${p.summonerName}: ${wins} victorias y ${losses} derrotas en ${p.gamesPlayed} partidas`}>
              <li className="td-rank-row">
                <span className="td-rank-pos td-num">{i + 1}</span>
                <RowIcon src={avatarUrl?.(p.summonerName)} label={p.summonerName} round />
                <span className="td-rank-name">{p.summonerName}</span>
                <RankBar pct={p.winrate} color={WIN} />
                <span className="td-rank-val td-num">
                  {Math.round(p.winrate)}%
                  <small>{wins}-{losses}</small>
                </span>
              </li>
            </Tip>
          );
        })}
      </ol>
    </div>
  );
}

// ── 3. WR por equipo ─────────────────────────────────────────────────────────
//
// Aquí el dato tiene polaridad: por encima del 50% ganas más de lo que pierdes.
// Por eso la barra es divergente y nace en la línea central: los equipos con
// balance positivo crecen a la derecha en verde, los negativos a la izquierda
// en rojo. La dirección nunca depende solo del color (el par verde/rojo es
// difícil para daltónicos): la posición respecto al centro y el marcador
// escrito cuentan lo mismo sin él.
function TeamWinrate({ standings }: { standings: TeamStanding[] }) {
  // Orden por WR, que es lo que mide la gráfica. La clasificación oficial
  // aplica desempates y metía equipos 2-1 por debajo de otros 2-2: correcto en
  // la tabla de posiciones, confuso en una gráfica titulada "WR por equipo".
  const data = useMemo(() => [...standings]
    .filter((s) => s.wins + s.losses > 0)
    .sort((a, b) =>
      b.winratePct - a.winratePct
      || b.wins - a.wins
      || (a.position ?? 99) - (b.position ?? 99)
      || a.name.localeCompare(b.name)),
    [standings]);

  if (!data.length) return null;

  // Dos columnas en pantallas anchas: 19 filas en una sola ocupaban media
  // pantalla de alto. Se lee de arriba abajo en la izquierda y sigue en la
  // derecha; la posición numerada deja claro el orden.
  const mid = Math.ceil(data.length / 2);
  const cols = [data.slice(0, mid), data.slice(mid)].filter((c) => c.length);

  return (
    <div className="td-panel td-chart-card td-chart-card--wide">
      <SectionHead icon={<Users size={14} color={GOLD} />} title="WR POR EQUIPO"
        right={<Tip label="Series ganadas sobre series jugadas. La línea central es el 50%."><span className="td-over">{data.length} EQUIPOS</span></Tip>} />

      <div className="td-team-cols">
        {cols.map((col, ci) => (
          <div key={ci}>
            {/* Escala alineada con la columna de barras de las filas. */}
            <div className="td-rank-row td-rank-row--team td-div-scale" aria-hidden>
              <span /><span /><span />
              <span className="td-div-scale-ticks"><span>0%</span><span>50%</span><span>100%</span></span>
              <span />
            </div>
            <ol className="td-rank-list">
              {col.map((s, i) => {
                const rank = ci * mid + i + 1;
                const wr = Math.round(s.winratePct);
                const delta = wr - 50;                    // -50..+50
                const up = delta > 0;
                const color = up ? WIN : LOSS;
                return (
                  <Tip key={s.name} label={`${s.name}: ${s.wins} series ganadas y ${s.losses} perdidas (${wr}%)`}>
                    <li className="td-rank-row td-rank-row--team">
                      <span className="td-rank-pos td-num">{rank}</span>
                      <span className="td-team-mono" style={{ borderColor: s.color || 'rgba(255,255,255,0.18)' }}>
                        {(s.mono || s.name).slice(0, 3).toUpperCase()}
                      </span>
                      <span className="td-rank-name">{s.name}</span>
                      <span className="td-div-track">
                        <span className="td-div-mid" />
                        {delta === 0 ? (
                          <span className="td-div-even" />
                        ) : (
                          // Media pista = 50 puntos de WR, así que el ancho en %
                          // de la pista entera es exactamente |WR - 50|.
                          <span className="td-div-fill" data-dir={up ? 'up' : 'down'}
                            style={{ width: `${Math.abs(delta)}%`, background: color }} />
                        )}
                      </span>
                      <span className="td-rank-val td-num">
                        {s.wins}-{s.losses}
                        <small>{wr}%</small>
                      </span>
                    </li>
                  </Tip>
                );
              })}
            </ol>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 4. Multikills del torneo ─────────────────────────────────────────────────
//
// Cuatro cifras sueltas no piden un gráfico de columnas: piden cuatro tiles.
// Se leen de un vistazo y la penta, que es la que importa, se destaca.
function Multikills({ players }: { players: PlayerAggregate[] }) {
  const t = useMemo(() => players.reduce((a, p) => ({
    penta: a.penta + (p.pentaKills || 0), quadra: a.quadra + (p.quadraKills || 0),
    triple: a.triple + (p.tripleKills || 0), double: a.double + (p.doubleKills || 0),
  }), { penta: 0, quadra: 0, triple: 0, double: 0 }), [players]);

  const total = t.penta + t.quadra + t.triple + t.double;
  if (!total) return null;

  const tiles = [
    { label: 'Pentas', value: t.penta, accent: true },
    { label: 'Cuádruples', value: t.quadra },
    { label: 'Triples', value: t.triple },
    { label: 'Dobles', value: t.double },
  ];

  return (
    <div className="td-panel td-chart-card">
      <SectionHead icon={<Flame size={14} color={GOLD} />} title="MULTIKILLS DEL TORNEO"
        right={<Tip label="Suma de todas las partidas registradas"><span className="td-over">{total} TOTAL</span></Tip>} />
      <div className="td-mk-grid">
        {tiles.map((x) => (
          <div key={x.label} className="td-mk-tile" data-accent={x.accent ? 'true' : undefined}>
            <span className="td-mk-label">{x.label}</span>
            <span className="td-mk-value">{x.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Sección completa. `players` ya viene filtrado por la barra de Estadísticas. */
export function StatsCharts({ players, standings, minGames, avatarUrl }: {
  players: PlayerAggregate[];
  standings?: TeamStanding[];
  /** Mínimo de partidas activo en la barra de filtros (0 = "Todos"). */
  minGames: number;
  /** Avatar (icono de perfil o campeón) por nombre. */
  avatarUrl?: (name: string) => string | null;
}) {
  return (
    <div className="td-charts-grid">
      <ChampionPicks players={players} />
      <BestWinrate players={players} minGames={minGames} avatarUrl={avatarUrl} />
      {/* Multikills antes que la tarjeta ancha: ocupa la tercera columna en
          escritorio en vez de quedar sola debajo. */}
      <Multikills players={players} />
      {standings?.length ? <TeamWinrate standings={standings} /> : null}
    </div>
  );
}

export default StatsCharts;
