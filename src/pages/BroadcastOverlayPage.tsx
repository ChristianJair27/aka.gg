// src/pages/BroadcastOverlayPage.tsx
// Overlay de espectador para OBS (Browser Source 1920x1080, fondo transparente):
// /broadcast/:channel/overlay
// - Dos temas (src/lib/broadcastTheme.ts): "atak" (diseño Arena del sitio) y
//   "lqc" (identidad de la liga). Sale del canal — los "lqc…" usan el de la
//   liga — o se fuerza con ?theme=atak|lqc. El acento del caster lo pisa.
// - Marcador: equipos, kills, reloj, torres, vacuolarvas, heraldo, barones y,
//   bajo cada nombre, el contador de dragones hacia el alma (4 casillas).
// - Franja bajo el marcador: timer de dragón / Anciano, diferencia de oro con
//   la ventaja escrita del lado que va ganando, y el timer del foso
//   (vacuolarvas → heraldo → barón) o el "Baron Power Play" mientras dura.
// - Tablero inferior por ENFRENTAMIENTOS (top vs top…): hechizos, runa clave,
//   CS, oro, visión, KDA y objetos de cada jugador.
// - Avisos en cola (solo eventos NUEVOS): objetivos, alma, primera sangre,
//   torres e inhibidores, con el campeón que lo consiguió.
// - Oro ESTIMADO: el Live Client no expone el oro de los 10. Por jugador se
//   aproxima con pasiva + CS + kills/asistencias; al equipo se le suma lo que
//   reparten torres, dragones y barones. Misma fórmula ambos lados → lo que
//   vale es la DIFERENCIA.
// - Un objetivo solo se da por VIVO si el historial de eventos está completo:
//   si el espectador entró con la partida empezada no se sabe qué murió antes.
// - Gráfica de DIFERENCIA DE ORO (estilo Worlds 2026): el overlay guarda la diferencia
//   cada pocos segundos (localStorage por canal, sobrevive a recargas) y SOLO la muestra
//   cuando un equipo pierde de golpe una ventaja grande (?oro=3000 por defecto: llevaba
//   ≥ 3k y en ≤ 100 s se le esfumaron ≥ 3k). Sale tras el panel de pelea, ocupa el sitio
//   del tablero 14 s y no se repite en 2:30. ?grafica=0 la apaga · ?grafica=1 la deja fija.
// - Movimiento solo con transform / opacity; se apaga con prefers-reduced-motion.
// Vista previa: ?bg=1 (fondo de prueba) · ?demo=1 (partida simulada).
import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import { axiosInstance } from '@/lib/axios';
import { useChampions } from '@/hooks/use-ddragon';
import { lol, type DragonKey } from '@/lib/lolAssets';
import { resolveTeamLogo } from '@/lib/teamLogos';
import { broadcastThemeFor, broadcastVars, ensureBroadcastFont } from '@/lib/broadcastTheme';
import { demoFeed } from '@/lib/broadcastDemo';
import '@/styles/pages/broadcast-overlay.css';

// ── Timers de la Grieta — temporada 2026 (AJUSTAR si Riot los mueve) ─────────
const DRAGON_FIRST = 300;     // primer dragón 5:00
const DRAGON_RESPAWN = 300;   // renace 5:00 tras cada toma
const SOUL_AT = 4;            // el 4.º dragón elemental de un equipo da el alma
const ELDER_DELAY = 360;      // Anciano: 6:00 tras el alma y tras cada Anciano
const GRUBS_SPAWN = 480;      // vacuolarvas 8:00, una sola vez (3)
const GRUBS_DESPAWN = 885;    // se van a los 14:45
const GRUBS_COUNT = 3;
const HERALD_SPAWN = 900;     // heraldo 15:00, una sola vez
const HERALD_DESPAWN = 1185;  // se va a los 19:45
const BARON_SPAWN = 1200;     // barón 20:00
const BARON_RESPAWN = 360;    // renace 6:00 tras cada toma
const BARON_BUFF = 180;
const EPIC_EVENTS = new Set(['DragonKill', 'HordeKill', 'HeraldKill', 'BaronKill']);
const EPIC_CHECK_AT = 660; // 11:00 — a esa altura siempre ha caído algún monstruo épico       // la mejora dura 3:00 → ventana del "Power Play"

// Tipo de dragón del Live Client → icono local y nombre.
const DRAGON_KEY: Record<string, DragonKey> = {
  Fire: 'infernal', Water: 'ocean', Earth: 'mountain', Air: 'cloud',
  Hextech: 'hextech', Chemtech: 'chemtech', Elder: 'elder',
};
const dragonIcon = (type: string) => lol.dragon(DRAGON_KEY[type] ?? 'elder');
const DRAGON_ES: Record<string, string> = {
  Fire: 'DRAGÓN INFERNAL', Water: 'DRAGÓN DEL OCÉANO', Earth: 'DRAGÓN DE MONTAÑA',
  Air: 'DRAGÓN DE LAS NUBES', Hextech: 'DRAGÓN HEXTECH', Chemtech: 'DRAGÓN QUÍMICO',
  Elder: 'DRAGÓN ANCIANO',
};
const SOUL_ES: Record<string, string> = {
  Fire: 'ALMA INFERNAL', Water: 'ALMA DEL OCÉANO', Earth: 'ALMA DE MONTAÑA',
  Air: 'ALMA DE LAS NUBES', Hextech: 'ALMA HEXTECH', Chemtech: 'ALMA QUÍMICA',
};
const ICON = {
  baron: lol.ui('nashor'),
  herald: lol.ui('rift_herald'),
  tower: lol.ui('tower'),
  gold: lol.ui('gold'),
  grubs: lol.ui('creep'),
  kill: lol.ui('score'),
  dragon: lol.dragon('elder'),
};

interface FeedPlayer {
  riotId: string; championName: string; team: 'ORDER' | 'CHAOS';
  level: number; kills: number; deaths: number; assists: number;
  creepScore: number; wardScore?: number; isDead: boolean; respawnTimer: number; items: number[];
  position: string;
  /** Hechizos ("SummonerFlash") y runa clave (id): los manda el companion ≥ 0.4.1. */
  spells?: string[]; keystone?: number;
}
interface FeedEvent { id: number; t: number; name: string; killer: string; victim: string; extra: string; assisters?: string[] }

const fmt = (s: number) => `${Math.floor(s / 60)}:${Math.floor(Math.max(0, s) % 60).toString().padStart(2, '0')}`;
const norm = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const shortName = (r: string) => (r.includes('#') ? r.slice(0, r.indexOf('#')) : r);
const kFmt = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(Math.round(n)));
// Formato Worlds para la ventaja por línea: "1.4K" a partir de mil, el número tal cual por debajo.
const wFmt = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(Math.round(n)));

/** Oro estimado de un jugador: pasiva desde 1:50 + CS + kills/asistencias. */
function estGold(p: FeedPlayer, t: number): number {
  const passive = Math.max(0, t - 110) * 2.04;
  return Math.round(500 + passive + p.creepScore * 21 + p.kills * 300 + p.assists * 150);
}
// Oro que reparte al EQUIPO cada objetivo (local + global, redondeado).
const TEAM_GOLD = { tower: 550, dragon: 125, baron: 1500, herald: 200 };

const POS_ORDER = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY'];
/** Cuerpo del nombre del equipo: entero hasta 13 letras, luego baja para que quepa. */
const fitName = (name: string) => `${name.length <= 13 ? 31 : Math.max(19, Math.round((31 * 13) / name.length))}px`;
/** Turret_T1_C_05_A → rótulo de la torre. Solo se nombra la de mid (C): el
 *  sentido de L / R cambia según el lado y no vale la pena arriesgar un error en vivo. */
const towerLane = (extra: string) => (/^Turret_T\d_C_/.test(extra) ? 'TORRE DE MID' : 'TORRE DESTRUIDA');

type Side = 'blue' | 'red';
const sideOfTeam = (team: 'ORDER' | 'CHAOS' | null | undefined): Side => (team === 'CHAOS' ? 'red' : 'blue');

// ── Gráfica de diferencia de oro (solo tras una remontada / un throw) ────────
const GOLD_SAMPLE = 4;        // s de juego entre muestras
const SWING_WINDOW = 100;     // la ventaja se tuvo que perder en ≤ 100 s
const SWING_COOLDOWN = 150;   // no repetir la gráfica antes de 2:30
const GRAPH_HOLD = 14;        // s en pantalla
type GoldPt = [number, number]; // [segundo de juego, oro azul − oro rojo]
interface GoldHist { sig: string; pts: GoldPt[]; cool: number }
interface GoldSwing { t: number; peakT: number; side: Side; peak: number; now: number }
const goldKey = (ch: string) => `bo-gold:${ch}`;
function loadGoldHist(ch: string): GoldHist | null {
  try { const v = JSON.parse(localStorage.getItem(goldKey(ch)) || 'null'); return v && Array.isArray(v.pts) ? v : null; } catch { return null; }
}
function saveGoldHist(ch: string, h: GoldHist) {
  try { localStorage.setItem(goldKey(ch), JSON.stringify(h)); } catch { /* sin almacenamiento: solo en memoria */ }
}
/** ¿Un equipo llevaba ≥ umbral de ventaja y la perdió (≥ umbral) dentro de la ventana? */
function detectSwing(pts: GoldPt[], t: number, thr: number): GoldSwing | null {
  const win = pts.filter(([pt]) => pt >= t - SWING_WINDOW);
  if (win.length < 2) return null;
  const cur = win[win.length - 1][1];
  for (const side of ['blue', 'red'] as Side[]) {
    const sg = side === 'blue' ? 1 : -1;
    let peak = -Infinity, peakT = 0;
    for (const [pt, v] of win) if (v * sg > peak) { peak = v * sg; peakT = pt; }
    const now = cur * sg;
    if (peak >= thr && peak - now >= thr && peakT < win[win.length - 1][0]) return { t, peakT, side, peak, now };
  }
  return null;
}
/** ?demo=1: historial inventado que acaba en un throw azul, para ver la gráfica sin partida. */
function demoGoldHistory(t: number, cur: number): GoldPt[] {
  const pts: GoldPt[] = [];
  const peakT = t - 44, peak = cur + 4700;
  for (let x = 60; x <= t - GOLD_SAMPLE; x += GOLD_SAMPLE) {
    const v = x <= peakT
      ? peak * Math.pow(Math.max(0, (x - 240) / (peakT - 240)), 1.6) - 520 * Math.sin(x / 95) * Math.max(0, 1 - x / 700) + 260 * Math.sin(x / 41)
      : peak + ((cur - peak) * (x - peakT)) / (t - peakT);
    pts.push([x, Math.round(v)]);
  }
  return pts;
}

/**
 * Quita objetivos imposibles antes de pintar nada: el lector del HUD del companion del
 * caster puede confundir la aparición del HUD (o un cambio de ventana) con contadores que
 * suben. Un objetivo antes de que su monstruo exista, o varios objetivos DISTINTOS del HUD
 * en el mismo segundo, no son reales.
 */
const SPAWN_AT: Record<string, number> = { DragonKill: DRAGON_FIRST, HordeKill: GRUBS_SPAWN, HeraldKill: HERALD_SPAWN, BaronKill: BARON_SPAWN };
function plausibleEvents(events: FeedEvent[]): FeedEvent[] {
  const hudAt = new Map<number, Set<string>>();
  for (const e of events) if ((e as any).hud && EPIC_EVENTS.has(e.name)) {
    const k = Math.round(e.t); if (!hudAt.has(k)) hudAt.set(k, new Set()); hudAt.get(k)!.add(e.name);
  }
  return events.filter((e) => {
    const spawn = SPAWN_AT[e.name];
    if (spawn != null && e.t < spawn - 20) return false;
    if ((e as any).hud && EPIC_EVENTS.has(e.name) && (hudAt.get(Math.round(e.t))?.size || 0) > 1) return false;
    return true;
  });
}

/** Todo lo que se puede leer de los eventos: objetivos por lado, tiempos y oro. */
function readGame(feed: any) {
  const players: FeedPlayer[] = feed.players || [];
  const events: FeedEvent[] = feed.events || [];
  const t: number = feed.gameTime || 0;
  const order = players.filter((p) => p.team === 'ORDER');
  const chaos = players.filter((p) => p.team === 'CHAOS');
  const playerOf = (name: string) => {
    const n = norm(shortName(name));
    return n ? players.find((p) => norm(shortName(p.riotId)) === n) ?? null : null;
  };
  const sideOf = (name: string): Side | null => {
    const p = playerOf(name);
    return p ? sideOfTeam(p.team) : null;
  };

  const towers = { blue: 0, red: 0 };
  const drakes: Record<Side, string[]> = { blue: [], red: [] };   // elementales
  const elders = { blue: 0, red: 0 };
  const barons = { blue: 0, red: 0 };
  const grubs = { blue: 0, red: 0 };
  let herald: Side | null = null;
  let heraldTaken = false;
  let lastDragonT = -1, lastElderT = -1, lastBaronT = -1, lastBaronSide: Side = 'blue';
  let soul: { side: Side; type: string; t: number } | null = null;
  const dragonOrder: string[] = []; // tipos de todos los dragones elementales muertos, en orden

  for (const e of events) {
    const side = sideOf(e.killer);
    if (e.name === 'TurretKilled') {
      // El evento trae la torre DESTRUIDA: T1 = torre azul → punto para el rojo.
      if (e.extra.startsWith('Turret_T1')) towers.red++;
      else if (e.extra.startsWith('Turret_T2')) towers.blue++;
      else if (side) towers[side]++;
    } else if (e.name === 'DragonKill') {
      const type = e.extra || 'Fire';
      const s = side ?? 'blue';
      if (type === 'Elder') { elders[s]++; lastElderT = e.t; }
      else {
        drakes[s].push(type); dragonOrder.push(type); lastDragonT = e.t;
        if (!soul && drakes[s].length >= SOUL_AT) soul = { side: s, type, t: e.t };
      }
    } else if (e.name === 'BaronKill') {
      lastBaronT = e.t; lastBaronSide = side ?? 'blue'; barons[lastBaronSide]++;
    } else if (e.name === 'HeraldKill') {
      heraldTaken = true; herald = side;
    } else if (e.name === 'HordeKill') {
      grubs[side ?? 'blue']++;
    }
  }

  const goldOf = new Map<string, number>();
  players.forEach((p) => goldOf.set(p.riotId, estGold(p, t)));
  const sum = (list: FeedPlayer[]) => list.reduce((s, p) => s + (goldOf.get(p.riotId) || 0), 0);
  const bonus = (s: Side) =>
    towers[s] * TEAM_GOLD.tower + (drakes[s].length + elders[s]) * TEAM_GOLD.dragon + barons[s] * TEAM_GOLD.baron + (herald === s ? TEAM_GOLD.herald : 0);
  const gold = { blue: sum(order) + bonus('blue'), red: sum(chaos) + bonus('red') };

  return {
    players, events, t, order, chaos, playerOf, sideOf, goldOf, gold,
    towers, drakes, elders, barons, grubs, herald: herald as Side | null, heraldTaken, soul: soul as { side: Side; type: string; t: number } | null,
    lastDragonT, lastElderT, lastBaronT, lastBaronSide, dragonOrder,
  };
}

/** Aviso en pantalla: objetivo, alma, primera sangre o estructura. */
interface Moment {
  key: number; icon: string; kicker: string; title: string; side: Side;
  /** Splash del campeón que lo consiguió (fondo del aviso). */
  art?: string;
  /** Avisos menores (torres, larvas) duran menos y van más compactos. */
  minor?: boolean;
}
interface PowerPlay { side: Side; t0: number; base: number | null }
const EASE = [0.22, 1, 0.36, 1] as const;

/** Cifra que salta (escala + fundido) cada vez que cambia; al montar no anima. */
function Pop({ value }: { value: number | string }) {
  return (
    <AnimatePresence initial={false}>
      <motion.span
        key={String(value)}
        style={{ display: 'inline-block' }}
        initial={{ opacity: 0.2, scale: 1.45 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.45, ease: EASE }}
      >
        {value}
      </motion.span>
    </AnimatePresence>
  );
}

/** Destello blanco sobre la celda de kills cuando sube el marcador. */
function Flash({ value }: { value: number }) {
  return (
    <AnimatePresence initial={false}>
      <motion.i key={value} aria-hidden className="bo-flash" initial={{ opacity: 0.75 }} animate={{ opacity: 0 }} transition={{ duration: 0.7 }} />
    </AnimatePresence>
  );
}

/** Panel inferior "Diferencia de oro" (estilo Worlds 2026): área azul arriba / roja abajo,
 *  minutos en el eje, objetivos épicos abajo y el tramo del throw resaltado. */
function GoldGraph({ pts, t, team, logo, events, epicOk, swing, label }: {
  pts: GoldPt[]; t: number; team: Record<Side, string>; logo: Record<Side, string>;
  events: Array<{ t: number; icon: string; side: Side | null }>; epicOk: boolean; swing: GoldSwing | null; label: string;
}) {
  const W = 900, H = 200, TOP = 18, PH = 126, L = 70, R = 16, PW = W - L - R;
  const data = pts.filter(([pt]) => pt <= t + 2);
  if (data.length < 2) return null;
  const t0 = data[0][0] < 150 ? 0 : data[0][0];
  const t1 = Math.max(data[data.length - 1][0], t0 + 60);
  const vals = data.map(([, v]) => v);
  const maxB = Math.max(0, ...vals), maxR = Math.max(0, ...vals.map((v) => -v));
  const pad = Math.max(500, 0.16 * Math.max(maxB, maxR));
  const vTop = Math.max(maxB, pad), vBot = -Math.max(maxR, pad);
  const x = (s: number) => L + ((s - t0) / (t1 - t0)) * PW;
  const y = (v: number) => TOP + ((vTop - v) / (vTop - vBot)) * PH;
  const y0 = y(0);
  const line = data.map(([s, v], i) => `${i ? 'L' : 'M'}${x(s).toFixed(1)},${y(v).toFixed(1)}`).join('');
  const area = `${line}L${x(data[data.length - 1][0]).toFixed(1)},${y0.toFixed(1)}L${x(data[0][0]).toFixed(1)},${y0.toFixed(1)}Z`;
  const span = t1 - t0;
  const step = span > 900 ? 300 : span > 400 ? 120 : 60;
  const ticks: number[] = [];
  for (let s = Math.ceil(t0 / step) * step; s <= t1; s += step) if (s > t0) ticks.push(s);
  const last = data[data.length - 1];
  const icons = epicOk ? events.filter((e) => e.t >= t0 && e.t <= t1) : [];
  const loser = swing ? swing.side : null;
  const curLead: Side | null = last[1] > 0 ? 'blue' : last[1] < 0 ? 'red' : null;
  const sgn = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '') + wFmt(Math.abs(n));
  const hide = (e: React.SyntheticEvent<HTMLImageElement>) => { e.currentTarget.style.visibility = 'hidden'; };
  const bandX = swing ? x(Math.max(t0, swing.peakT)) : 0;
  return (
    <div className="bo-gg-inner">
      <div className="bo-gg-info">
        <span className="bo-gg-kicker">{label}</span>
        <span className="bo-gg-title bo-disp">Diferencia de oro</span>
        {swing && loser ? (
          <span className="bo-gg-swing">
            <b className={loser}>{team[loser]}</b> {swing.now < 0 ? 'pierde la ventaja:' : 'se deja'} <b className="amt">{wFmt(swing.peak - swing.now)}</b>
            <i>de {sgn(swing.peak)} a {sgn(swing.now)} en {fmt(swing.t - swing.peakT)}</i>
          </span>
        ) : (
          <span className="bo-gg-swing">{curLead ? <><b className={curLead}>{team[curLead]}</b> arriba por <b className="amt">{wFmt(Math.abs(last[1]))}</b></> : 'Oro igualado'}</span>
        )}
        <span className="bo-gg-est">Oro estimado · ATAK.GG</span>
      </div>
      <div className="bo-gg-logos">
        {(['blue', 'red'] as Side[]).map((sd) => (
          <span key={sd} className={`bo-gg-logo ${sd}`} title={team[sd]}>
            {logo[sd] ? <img src={logo[sd]} alt="" onError={hide} /> : <b className="bo-disp">{team[sd].slice(0, 3)}</b>}
          </span>
        ))}
      </div>
      <svg className="bo-gg-svg" viewBox={`0 0 ${W} ${H}`} width={W} height={H} aria-label="Diferencia de oro">
        <defs>
          <clipPath id="bogg-up"><rect x={0} y={0} width={W} height={y0} /></clipPath>
          <clipPath id="bogg-dn"><rect x={0} y={y0} width={W} height={H - y0} /></clipPath>
          <clipPath id="bogg-reveal"><motion.rect x={0} y={0} height={H} initial={{ width: 0 }} animate={{ width: W }} transition={{ duration: 1.2, ease: EASE, delay: 0.25 }} /></clipPath>
        </defs>
        {ticks.map((s) => <line key={s} className="bo-gg-grid" x1={x(s)} x2={x(s)} y1={TOP} y2={TOP + PH} />)}
        {swing && <rect className="bo-gg-band" x={bandX} y={TOP} width={Math.max(4, x(swing.t) - bandX)} height={PH} />}
        <g clipPath="url(#bogg-reveal)">
          <g clipPath="url(#bogg-up)"><path className="bo-gg-area blue" d={area} /><path className="bo-gg-line blue" d={line} /></g>
          <g clipPath="url(#bogg-dn)"><path className="bo-gg-area red" d={area} /><path className="bo-gg-line red" d={line} /></g>
        </g>
        <line className="bo-gg-zero" x1={L} x2={W - R} y1={y0} y2={y0} />
        <text className="bo-gg-ymax blue" x={L - 12} y={TOP + 14} textAnchor="end">{Math.round(maxB / 10) * 10}</text>
        <text className="bo-gg-ymax red" x={L - 12} y={TOP + PH} textAnchor="end">{Math.round(maxR / 10) * 10}</text>
        {ticks.map((s) => <text key={s} className="bo-gg-tick" x={x(s)} y={TOP + PH + 20} textAnchor="middle">{Math.round(s / 60)}</text>)}
        <motion.circle className={`bo-gg-dot ${curLead ?? 'blue'}`} cx={x(last[0])} cy={y(last[1])} r={5} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.4 }} />
        {icons.map((e, i) => (
          <g key={i} transform={`translate(${x(e.t).toFixed(1)}, ${TOP + PH + 42})`}>
            <circle r={12} className={`bo-gg-ev ${e.side ?? ''}`} />
            <image href={e.icon} x={-9} y={-9} width={18} height={18} />
          </g>
        ))}
      </svg>
    </div>
  );
}

export default function BroadcastOverlayPage() {
  const { channel } = useParams<{ channel: string }>();
  const [params] = useSearchParams();
  const debugBg = params.get('bg') === '1';
  const demo = params.get('demo') === '1';
  // ?opacidad=0.75 (o 75): el caster pidió poder "bajar" el overlay para que estorbe menos.
  const opacityRaw = Number(params.get('opacidad') ?? params.get('opacity'));
  // Solo se atenúa el FONDO de los paneles (texto e iconos siempre nítidos).
  const panelAlpha = Number.isFinite(opacityRaw) && opacityRaw > 0 ? Math.min(1, Math.max(0.2, opacityRaw > 1 ? opacityRaw / 100 : opacityRaw)) : 0.65;
  // ?tablero=0 oculta el tablero por línea siempre; ?auto=0 evita que se esconda solo durante las peleas.
  const boardParam = params.get('tablero') !== '0';
  const autoHide = params.get('auto') !== '0';
  // ?rotar=25 → el tablero va rotando vistas (líneas → líderes → objetivos) cada N s; 0 lo deja fijo en líneas.
  // ?oro=3000: ventaja perdida que dispara la gráfica · ?grafica=0 apagada · ?grafica=1 siempre visible.
  const swingThr = Math.max(1000, Number(params.get('oro')) || 3000);
  const graphParam = params.get('grafica');
  const rotateSecs = params.has('rotar') ? Math.max(0, Number(params.get('rotar')) || 0) : 25;
  const [viewIdx, setViewIdx] = useState(0);
  useEffect(() => {
    if (!rotateSecs) return;
    const t = window.setInterval(() => setViewIdx((i) => i + 1), rotateSecs * 1000);
    return () => window.clearInterval(t);
  }, [rotateSecs]);
  const theme = broadcastThemeFor(channel, params.get('theme'));
  const { data: champs } = useChampions();
  const version = (champs as any)?.version || '14.1.1';

  useEffect(() => { ensureBroadcastFont(theme); }, [theme]);

  // OBS no recarga la fuente Navegador: cuando el sitio se despliega (cambia index.html)
  // el overlay se recarga solo, pero nunca mientras hay una pelea o un aviso en pantalla.
  const indexRef = useRef<string | null>(null);
  const busyRef = useRef(false);
  useEffect(() => {
    let alive = true;
    const check = async () => {
      try {
        const txt = await (await fetch('/index.html', { cache: 'no-store' })).text();
        if (!alive) return;
        if (indexRef.current === null) indexRef.current = txt;
        else if (txt !== indexRef.current && !busyRef.current) window.location.reload();
      } catch { /* sin red: nada */ }
    };
    void check();
    const t = window.setInterval(check, 90_000);
    return () => { alive = false; window.clearInterval(t); };
  }, []);

  // Fondo transparente real para OBS (html/body traen tema oscuro global).
  useEffect(() => {
    const prevHtml = document.documentElement.style.background;
    const prevBody = document.body.style.background;
    document.documentElement.style.background = 'transparent';
    document.body.style.background = 'transparent';
    return () => {
      document.documentElement.style.background = prevHtml;
      document.body.style.background = prevBody;
    };
  }, []);

  const feedQ = useQuery({
    queryKey: ['overlay', channel],
    enabled: !!channel && !demo,
    refetchInterval: 2000,
    retry: false,
    queryFn: async () => {
      const { data, status } = await axiosInstance.get(`/api/live-feed/${channel}`, { validateStatus: (s) => s < 500 });
      return status === 200 && data?.ok ? data : null;
    },
  });

  // Runa clave (id) → icono, desde Data Dragon. Si falla, la columna queda sin runa.
  const runesQ = useQuery({
    queryKey: ['overlay-runes', version],
    staleTime: Infinity,
    retry: 1,
    queryFn: async () => {
      const trees: any[] = await fetch(`https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/runesReforged.json`).then((r) => r.json());
      const map: Record<number, string> = {};
      for (const tree of trees) for (const slot of tree.slots || []) for (const r of slot.runes || []) map[r.id] = `https://ddragon.leagueoflegends.com/cdn/img/${r.icon}`;
      return map;
    },
  });
  const runeIcon = (id?: number) => (id && runesQ.data ? runesQ.data[id] || '' : '');
  const spellIcon = (key?: string) => (key && /^Summoner[A-Za-z0-9_]+$/.test(key) ? `https://ddragon.leagueoflegends.com/cdn/${version}/img/spell/${key}.png` : '');

  const [demoElapsed, setDemoElapsed] = useState(0);
  useEffect(() => {
    if (!demo) return;
    const id = setInterval(() => setDemoElapsed((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [demo]);
  const demoData = useMemo(
    () => (demo ? demoFeed(demoElapsed, String(channel || 'demo'), theme.id === 'lqc') : null),
    [demo, demoElapsed, channel, theme.id],
  );

  const rawFeed: any = demo ? demoData : feedQ.data ?? null;
  const feed: any = useMemo(
    () => (rawFeed?.events ? { ...rawFeed, events: plausibleEvents(rawFeed.events) } : rawFeed),
    [rawFeed],
  );
  const accent: string = feed?.accent || '';

  // championName (display o slug) → icono y splash, tolerante a acentos/espacios.
  const champArt = useMemo(() => {
    const icon: Record<string, string> = {};
    const slug: Record<string, string> = {};
    for (const e of Object.values<any>((champs as any)?.byId || {})) {
      const url = `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-icons/${e.key}.png`;
      for (const k of [norm(e.name), norm(e.id)]) { icon[k] = url; slug[k] = e.id; }
    }
    const hp: Record<string, { base: number; growth: number }> = {};
    const cls: Record<string, string> = {};
    const phys: Record<string, number> = {};
    for (const e of Object.values<any>((champs as any)?.byId || {})) {
      const k1 = norm(e.name), k2 = norm(e.id);
      const v = { base: Number(e.stats?.hp) || 600, growth: Number(e.stats?.hpperlevel) || 100 };
      const c = String((e.tags || [])[0] || 'Fighter');
      const atk = Number(e.info?.attack), mag = Number(e.info?.magic);
      const share = atk + mag > 0 ? atk / (atk + mag) : (c === 'Mage' || c === 'Support' ? 0.2 : 0.8);
      hp[k1] = v; hp[k2] = v; cls[k1] = c; cls[k2] = c; phys[k1] = share; phys[k2] = share;
    }
    // Formas transformadas ("Mega Gnar", "Elise araña", "Nidalee puma", "Shyvana dragón"…): si el nombre
    // no es exacto, se busca el campeón más largo contenido en él.
    const keys = Object.keys(icon).sort((x, y) => y.length - x.length);
    const resolve = (name: string) => { const n = norm(name); if (icon[n]) return n; return keys.find((k) => k.length >= 3 && n.includes(k)) || n; };
    return {
      icon: (name: string) => icon[resolve(name)] || '',
      splash: (name: string) => (slug[resolve(name)] ? lol.centered(slug[resolve(name)]) : ''),
      hp: (name: string) => hp[resolve(name)] || { base: 600, growth: 100 },
      cls: (name: string) => cls[resolve(name)] || 'Fighter',
      phys: (name: string) => phys[resolve(name)] ?? 0.6,
    };
  }, [champs]);
  // Vida que dan los objetos (item.json de Data Dragon), para la vida total del caído.
  const [itemHp, setItemHp] = useState<Record<number, number>>({});
  useEffect(() => {
    let alive = true;
    fetch(`https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/item.json`).then((r) => r.json()).then((j) => {
      if (!alive) return;
      const m: Record<number, number> = {};
      for (const [id, it] of Object.entries<any>(j?.data || {})) { const v = Number(it?.stats?.FlatHPPoolMod); if (v) m[Number(id)] = v; }
      setItemHp(m);
    }).catch(() => { /* sin objetos: solo vida base */ });
    return () => { alive = false; };
  }, [version]);
  const itemHpRef = useRef(itemHp); itemHpRef.current = itemHp;
  const champArtRef = useRef(champArt);
  champArtRef.current = champArt;

  // ── Estado que vive entre snapshots (se reinicia al empezar otra partida) ──
  const [queue, setQueue] = useState<Moment[]>([]);
  const [powerPlay, setPowerPlay] = useState<PowerPlay | null>(null);
  const seenEvents = useRef<Set<number>>(new Set());
  const firstSnap = useRef(true);
  const lastTime = useRef(-1);
  const historyOk = useRef(false);
  const goldHist = useRef<GoldHist | null>(null);
  const [swing, setSwing] = useState<GoldSwing | null>(null);
  const swingShownAt = useRef<number | null>(null);
  const swingRef = useRef(swing); swingRef.current = swing;

  // Partida nueva (el reloj retrocede) y ¿está completo el historial? Se
  // resuelve durante el render para que los timers de este mismo snapshot ya
  // lo sepan. El companion ≥ 0.4.1 lo dice (eventsComplete); si no, se deduce:
  // hay GameStart, o el feed viene recortado (partida larga), o aún no ha
  // pasado nada. Una vez completo, lo sigue estando.
  const newGame = !!feed && lastTime.current >= 0 && (feed.gameTime || 0) < lastTime.current - 30;
  if (newGame) historyOk.current = false;
  if (feed && !historyOk.current) {
    const evs: FeedEvent[] = feed.events || [];
    const complete = typeof feed.eventsComplete === 'boolean'
      ? feed.eventsComplete
      : evs.some((e) => e.name === 'GameStart') || evs.length >= 80 || (feed.gameTime || 0) < DRAGON_FIRST;
    if (complete) historyOk.current = true;
  }

  useEffect(() => {
    if (!feed) return;
    const g = readGame(feed);

    // ── Historial de la diferencia de oro + detección del throw ──
    {
      const sig = [norm(String(feed.team1 || '')), norm(String(feed.team2 || ''))].sort().join('|');
      let h = goldHist.current ?? loadGoldHist(String(channel));
      const lastT = h?.pts.length ? h.pts[h.pts.length - 1][0] : -1;
      if (!h || h.sig !== sig || g.t < lastT - 30) {
        h = { sig, pts: [], cool: -1e9 };
        swingShownAt.current = null;
        setSwing(null);
      }
      const diff = Math.round(g.gold.blue - g.gold.red);
      if (demo && !h.pts.length) h.pts = demoGoldHistory(g.t, diff);
      const full = g.order.length > 0 && g.order.length === g.chaos.length;
      if (full && g.t > 0 && (!h.pts.length || g.t - h.pts[h.pts.length - 1][0] >= GOLD_SAMPLE)) {
        h.pts.push([Math.round(g.t), diff]);
        if (h.pts.length > 900) { const n = h.pts.length; h.pts = h.pts.filter((_, i) => i % 2 === 0 || i > n - 60); }
        if (g.t - h.cool > SWING_COOLDOWN) {
          const s = detectSwing(h.pts, g.t, swingThr);
          if (s) { h.cool = g.t; swingShownAt.current = null; setSwing(s); }
        }
        if (!demo) saveGoldHist(String(channel), h);
      }
      goldHist.current = h;
      // Se retira sola tras GRAPH_HOLD en pantalla, o si una pelea larga no la dejó salir.
      const cur = swingRef.current;
      if (cur && cur.t !== g.t) {
        const shown = swingShownAt.current;
        if (shown != null ? g.t - shown >= GRAPH_HOLD : g.t - cur.t > 75) { swingShownAt.current = null; setSwing(null); }
      }
    }

    // Partida nueva: los ids de evento vuelven a empezar.
    if (lastTime.current >= 0 && g.t < lastTime.current - 30) {
      seenEvents.current = new Set();
      firstSnap.current = true;
      setQueue([]);
      setPowerPlay(null);
    }
    lastTime.current = g.t;

    if (firstSnap.current) {
      g.events.forEach((e) => seenEvents.current.add(e.id));
      firstSnap.current = false;
      // Abierto con una mejora de barón en curso: se cuenta el tiempo, no el oro.
      if (g.lastBaronT >= 0 && g.t < g.lastBaronT + BARON_BUFF) setPowerPlay({ side: g.lastBaronSide, t0: g.lastBaronT, base: null });
      return;
    }

    const teamName = (side: Side) => String(side === 'red' ? (feed.team2 || 'ROJO') : (feed.team1 || 'AZUL')).toUpperCase();
    const kills = g.events.filter((e) => e.name === 'ChampionKill');
    const firstKillId = kills.length ? Math.min(...kills.map((e) => e.id)) : -1;
    const drakeCount = { blue: 0, red: 0 };

    const fresh: Moment[] = [];
    for (const e of g.events) {
      const killer = g.playerOf(e.killer);
      const side: Side = sideOfTeam(killer?.team);
      const elemental = e.name === 'DragonKill' && (e.extra || 'Fire') !== 'Elder';
      if (elemental) drakeCount[side]++;
      if (seenEvents.current.has(e.id)) continue;
      seenEvents.current.add(e.id);

      const art = killer ? champArtRef.current.splash(killer.championName) : '';
      const takes = `${teamName(side)} SE LLEVA`;

      if (e.name === 'DragonKill') {
        const type = e.extra || 'Fire';
        if (elemental && drakeCount[side] === SOUL_AT) {
          fresh.push({ key: e.id, icon: dragonIcon(type), kicker: `${teamName(side)} CONSIGUE EL`, title: SOUL_ES[type] ?? 'ALMA DEL DRAGÓN', side, art });
        } else {
          const kicker = elemental && drakeCount[side] === SOUL_AT - 1 ? `${teamName(side)} · PUNTO DE ALMA` : takes;
          fresh.push({ key: e.id, icon: dragonIcon(type), kicker, title: DRAGON_ES[type] ?? 'DRAGÓN', side, art });
        }
      } else if (e.name === 'BaronKill') {
        fresh.push({ key: e.id, icon: ICON.baron, kicker: takes, title: 'BARÓN NASHOR', side, art });
        // Power Play: oro ganado respecto al rival mientras dura la mejora.
        setPowerPlay({ side, t0: e.t, base: g.gold.blue - g.gold.red });
      } else if (e.name === 'HeraldKill') {
        fresh.push({ key: e.id, icon: ICON.herald, kicker: takes, title: 'HERALDO DE LA GRIETA', side, art });
      } else if (e.name === 'HordeKill') {
        // Las tres larvas caen casi juntas: un solo aviso.
        if (!fresh.some((m) => m.title === 'VACUOLARVAS')) fresh.push({ key: e.id, icon: ICON.grubs, kicker: takes, title: 'VACUOLARVAS', side, minor: true });
      } else if (e.name === 'ChampionKill' && e.id === firstKillId && killer) {
        fresh.push({
          key: e.id, icon: champArtRef.current.icon(killer.championName) || ICON.kill,
          kicker: `${shortName(killer.riotId).toUpperCase()} · ${teamName(side)}`, title: 'PRIMERA SANGRE', side, art,
        });
      } else if (e.name === 'TurretKilled') {
        const towerSide: Side = e.extra.startsWith('Turret_T1') ? 'red' : e.extra.startsWith('Turret_T2') ? 'blue' : side;
        fresh.push({ key: e.id, icon: ICON.tower, kicker: `${teamName(towerSide)} DERRIBA`, title: towerLane(e.extra), side: towerSide, minor: true });
      } else if (e.name === 'InhibKilled') {
        fresh.push({ key: e.id, icon: ICON.tower, kicker: `${teamName(side)} DERRIBA`, title: 'INHIBIDOR', side, art });
      }
    }
    // Como mucho 4 en espera (tras una pelea grande importa lo último) y un
    // solo aviso de larvas aunque lleguen en snapshots seguidos.
    if (fresh.length) {
      setQueue((q) => {
        const grubsQueued = q.some((m) => m.title === 'VACUOLARVAS');
        return [...q, ...fresh.filter((m) => !(grubsQueued && m.title === 'VACUOLARVAS'))].slice(-4);
      });
    }
  }, [feed]);

  // El primero de la cola se muestra y se retira solo.
  const moment = queue[0] ?? null;
  useEffect(() => {
    if (!moment) return;
    const t = setTimeout(() => setQueue((q) => q.slice(1)), moment.minor ? 3200 : 5000);
    return () => clearTimeout(t);
  }, [moment]);

  const known = historyOk.current;
  // El cliente de LoL en modo ESPECTADOR no reporta las muertes de monstruos
  // épicos (dragón, larvas, heraldo, barón): el feed trae kills y torres pero
  // ningún DragonKill/HordeKill/… Si a los 11 min no ha llegado ninguno, los
  // objetivos se dan por desconocidos y se ocultan en vez de mostrar "VIVO" y
  // ceros falsos. ?objetivos=0|1 lo fuerza.
  const objParam = params.get('objetivos');
  // El companion ≥ 0.4.4 dice quién manda el feed: un jugador (eventos completos) o el espectador.
  // Con objetivos marcados a mano por el caster (/broadcast/:canal/control) el feed del espectador también vale.
  // El companion >= 0.4.8 del caster lee dragones/larvas/heraldo/barón del HUD del espectador (feed.hud).
  const spectator = feed?.source === 'spectator' && !(Number(feed?.manualEvents) > 0) && feed?.hud !== true;
  const epicOk = objParam === '1' || (objParam !== '0' && !!feed && !spectator && (
    (feed.events || []).some((e: FeedEvent) => EPIC_EVENTS.has(e.name)) || (feed.gameTime || 0) < EPIC_CHECK_AT));
  const derived = useMemo(() => {
    if (!feed) return null;
    const g = readGame(feed);
    const { t } = g;

    // ── Dragón / Anciano ────────────────────────────────────────────────────
    // Sin historial completo solo se confía en lo que se vio morir.
    type Timer = { icon: string; label: string; secs: number } | null;
    let dragon: Timer;
    if (g.soul) {
      const from = g.lastElderT >= 0 ? g.lastElderT : g.soul.t;
      dragon = { icon: lol.dragon('elder'), label: 'ANCIANO', secs: from + ELDER_DELAY - t };
    } else if (g.lastDragonT >= 0) {
      const riftType = g.dragonOrder.length >= 3 ? g.dragonOrder[2] : null;
      dragon = riftType
        ? { icon: dragonIcon(riftType), label: (DRAGON_ES[riftType] ?? 'DRAGÓN').toUpperCase(), secs: g.lastDragonT + DRAGON_RESPAWN - t }
        : { icon: ICON.dragon, label: 'DRAGÓN', secs: g.lastDragonT + DRAGON_RESPAWN - t };
    } else {
      dragon = known || t < DRAGON_FIRST ? { icon: ICON.dragon, label: 'DRAGÓN', secs: DRAGON_FIRST - t } : null;
    }

    // ── Foso: vacuolarvas → heraldo → barón ─────────────────────────────────
    const grubsDead = g.grubs.blue + g.grubs.red >= GRUBS_COUNT;
    let pit: Timer;
    if (t < GRUBS_DESPAWN && !grubsDead && (t < GRUBS_SPAWN || known)) {
      pit = { icon: ICON.grubs, label: 'VACUOLARVAS', secs: GRUBS_SPAWN - t };
    } else if (t < HERALD_DESPAWN && !g.heraldTaken && (t < HERALD_SPAWN || known)) {
      pit = { icon: ICON.herald, label: 'HERALDO', secs: HERALD_SPAWN - t };
    } else if (g.lastBaronT >= 0) {
      pit = { icon: ICON.baron, label: 'BARÓN', secs: g.lastBaronT + BARON_RESPAWN - t };
    } else {
      pit = known || t < BARON_SPAWN ? { icon: ICON.baron, label: 'BARÓN', secs: BARON_SPAWN - t } : null;
    }

    if (!epicOk) { dragon = null; pit = null; }

    // ── Enfrentamientos por línea (top vs top…); fallback por índice (ARAM) ──
    const byPos = (list: FeedPlayer[]) => {
      const m = new Map<string, FeedPlayer>();
      list.forEach((p) => { if (POS_ORDER.includes(p.position) && !m.has(p.position)) m.set(p.position, p); });
      return m;
    };
    const oPos = byPos(g.order), cPos = byPos(g.chaos);
    const canPair = POS_ORDER.every((pos) => oPos.has(pos)) && POS_ORDER.every((pos) => cPos.has(pos));
    const matchups: Array<{ pos: string; blue: FeedPlayer | null; red: FeedPlayer | null }> = canPair
      ? POS_ORDER.map((pos) => ({ pos, blue: oPos.get(pos) ?? null, red: cPos.get(pos) ?? null }))
      : Array.from({ length: Math.max(g.order.length, g.chaos.length) }, (_, i) => ({
          pos: '', blue: g.order[i] ?? null, red: g.chaos[i] ?? null,
        }));

    const label: string = feed.matchLabel || '';
    const vs = label.match(/([^:]+?)\s+vs\.?\s+(.+)/i);
    const mode = String(feed.gameMode || '').toUpperCase();

    return {
      ...g, dragon, pit, matchups, epicOk,
      team: { blue: (feed.team1 || vs?.[1] || 'AZUL').trim().toUpperCase() as string, red: (feed.team2 || vs?.[2] || 'ROJO').trim().toUpperCase() as string },
      logo: { blue: (feed.logo1 || resolveTeamLogo(feed.team1) || '') as string, red: (feed.logo2 || resolveTeamLogo(feed.team2) || '') as string },
      kills: { blue: g.order.reduce((s, p) => s + p.kills, 0), red: g.chaos.reduce((s, p) => s + p.kills, 0) },
      isRift: mode === 'CLASSIC' || /summoner/i.test(String(feed.mapName || '')),
    };
  }, [feed, known, epicOk]);

  if (!derived) {
    // Sin transmisión: overlay invisible (OBS no muestra nada). En debug, aviso.
    // La repetición de la segunda cámara también sale entre partidas (sin feed del caster).
    return (
      <>
        {debugBg && <div className="bo-wait">Overlay {channel}: esperando transmisión del companion…</div>}
        <LiveReplay channel={String(channel || '')} brand={theme.brand} logo={theme.logo} />
      </>
    );
  }

  const d = derived;
  busyRef.current = !!moment || !!(d.events as FeedEvent[]).some((e) => e.name === 'ChampionKill' && d.t - e.t < 40);
  const itemIcon = (id: number) => `https://ddragon.leagueoflegends.com/cdn/${version}/img/item/${id}.png`;

  // ── Pelea en curso: bajas agrupadas (≤ 20 s entre una y otra), visible 9 s tras la última ──
  // El cliente en modo espectador no da daño; lo que sí hay son las bajas y el oro que reparten.
  const FIGHT_GAP = 20, FIGHT_HOLD = 12;
  const fight = (() => {
    const kills = (d.events as FeedEvent[]).filter((e) => e.name === 'ChampionKill').sort((a, b) => a.t - b.t);
    let group: FeedEvent[] = [];
    for (const e of kills) { if (group.length && e.t - group[group.length - 1].t > FIGHT_GAP) group = []; group.push(e); }
    if (group.length < 2 || d.t - group[group.length - 1].t > FIGHT_HOLD || d.t < group[0].t) return null;
    const rows = group.map((e) => {
      const killer = d.playerOf(e.killer); const victim = d.playerOf(e.victim);
      const side: Side = killer ? sideOfTeam(killer.team) : (victim && sideOfTeam(victim.team) === 'blue' ? 'red' : 'blue');
      return { id: e.id, killer, victim, side };
    });
    const tally = { blue: rows.filter((r) => r.side === 'blue').length, red: rows.filter((r) => r.side === 'red').length };
    const lead: Side | null = tally.blue > tally.red ? 'blue' : tally.red > tally.blue ? 'red' : null;
    // Por jugador: bajas, asistencias, muertes y oro estimado (baja 300 · asistencia 150)
    const per = new Map<string, { kills: number; assists: number; deaths: number }>();
    const bump = (p: FeedPlayer | null, k: 'kills' | 'assists' | 'deaths') => { if (!p) return; const cur = per.get(p.riotId) || { kills: 0, assists: 0, deaths: 0 }; cur[k]++; per.set(p.riotId, cur); };
    for (const e of group) { bump(d.playerOf(e.killer), 'kills'); bump(d.playerOf(e.victim), 'deaths'); for (const a of e.assisters || []) bump(d.playerOf(a), 'assists'); }
    // ── Daño estimado (modelo ATAK): el cliente no entrega daño, así que cada baja "cuesta" la vida
    // total del caído (base por nivel + objetos, ×1.3 por resistencias) y se reparte entre quien mató
    // (peso 1) y quienes asistieron (0.55), escalado por clase y nivel. Físico/mágico por el perfil
    // attack/magic del campeón.
    const CLASS_W: Record<string, number> = { Marksman: 1.4, Mage: 1.3, Assassin: 1.3, Fighter: 1.1, Tank: 0.6, Support: 0.5 };
    const art = champArtRef.current;
    const everyone = [...d.order, ...d.chaos];
    const avgLvl = Math.max(1, everyone.reduce((s, p) => s + (p.level || 1), 0) / Math.max(1, everyone.length));
    const dmg = new Map<string, { phys: number; magic: number }>();
    for (const e of group) {
      const victim = d.playerOf(e.victim); if (!victim) continue;
      const hp = art.hp(victim.championName);
      const items = (victim.items || []).reduce((s, id) => s + (itemHpRef.current[id] || 0), 0);
      const total = (hp.base + hp.growth * Math.max(0, (victim.level || 1) - 1) + items) * 1.3;
      const parts: Array<{ p: FeedPlayer; w: number }> = [];
      const k = d.playerOf(e.killer); if (k) parts.push({ p: k, w: 1 });
      for (const a of e.assisters || []) { const ap = d.playerOf(a); if (ap && !parts.some((x) => x.p === ap)) parts.push({ p: ap, w: 0.55 }); }
      if (!parts.length) continue;
      const weighted = parts.map((x) => ({ p: x.p, w: x.w * (CLASS_W[art.cls(x.p.championName)] ?? 1) * ((x.p.level || 1) / avgLvl) }));
      const sumW = weighted.reduce((s, x) => s + x.w, 0) || 1;
      for (const x of weighted) { const amt = (total * x.w) / sumW; const share = art.phys(x.p.championName); const cur = dmg.get(x.p.riotId) || { phys: 0, magic: 0 }; cur.phys += amt * share; cur.magic += amt * (1 - share); dmg.set(x.p.riotId, cur); }
    }
    const stat = (p: FeedPlayer) => { const s = per.get(p.riotId) || { kills: 0, assists: 0, deaths: 0 }; const dd = dmg.get(p.riotId) || { phys: 0, magic: 0 }; return { ...s, gold: s.kills * 300 + s.assists * 150, dmg: Math.round(dd.phys + dd.magic), phys: Math.round(dd.phys), magic: Math.round(dd.magic) }; };
    const players = { blue: [...d.order].map((p) => ({ p, ...stat(p) })).sort((a, b) => b.dmg - a.dmg || b.kills - a.kills), red: [...d.chaos].map((p) => ({ p, ...stat(p) })).sort((a, b) => b.dmg - a.dmg || b.kills - a.kills) };
    const maxGold = Math.max(150, ...players.blue.map((x) => x.gold), ...players.red.map((x) => x.gold));
    const maxDmg = Math.max(100, ...players.blue.map((x) => x.dmg), ...players.red.map((x) => x.dmg));
    return { rows, tally, lead, t0: group[0].t, t1: group[group.length - 1].t, gold: Math.abs(tally.blue - tally.red) * 300, players, maxGold, maxDmg };
  })();
  // Gráfica de oro: después del panel de pelea (nunca encima), GRAPH_HOLD s en pantalla.
  let showGraph = false;
  if (d.isRift && graphParam !== '0' && !fight) {
    if (graphParam === '1') showGraph = true;
    else if (swing) {
      if (swingShownAt.current == null) swingShownAt.current = d.t;
      showGraph = d.t - swingShownAt.current < GRAPH_HOLD;
    }
  }
  if (showGraph) busyRef.current = true;
  const graphEvents = (d.events as FeedEvent[])
    .filter((e) => e.name === 'DragonKill' || e.name === 'BaronKill' || e.name === 'HeraldKill')
    .map((e) => ({
      t: e.t, side: d.sideOf(e.killer),
      icon: e.name === 'DragonKill' ? dragonIcon(e.extra || 'Fire') : e.name === 'BaronKill' ? ICON.baron : ICON.herald,
    }));
  const goldDiff = d.gold.blue - d.gold.red;
  const lead: Side | null = goldDiff > 0 ? 'blue' : goldDiff < 0 ? 'red' : null;
  const bluePct = (d.gold.blue / Math.max(1, d.gold.blue + d.gold.red)) * 100;
  const hide = (e: React.SyntheticEvent<HTMLImageElement>) => { e.currentTarget.style.visibility = 'hidden'; };
  // La liga rotula con barras ("CALENDARIO / SEMANA 5"): mismo separador en su tema.
  const rawLabel: string = feed.matchLabel || `${theme.brand} · ${String(channel).toUpperCase()}`;
  const boardLabel = theme.id === 'lqc' ? rawLabel.replace(/\s*[·|•-]\s+/g, ' / ') : rawLabel;

  // Power Play vigente: mientras dure la mejora del último barón.
  const pp = powerPlay && d.t >= powerPlay.t0 && d.t < powerPlay.t0 + BARON_BUFF ? powerPlay : null;
  const ppGold = pp && pp.base != null ? (goldDiff - pp.base) * (pp.side === 'blue' ? 1 : -1) : null;

  // Los bloques de abajo se llaman como funciones (teamBlock('blue')), no como
  // <Componente />: definidos aquí dentro se remontarían en cada snapshot y
  // repetirían su animación de entrada.

  // ── Contador de dragones hacia el alma (bajo el nombre del equipo) ─────────
  const soulTrack = (side: Side) => {
    const taken = d.drakes[side];
    const mine = d.soul?.side === side;
    const point = !d.soul && taken.length === SOUL_AT - 1;
    return (
      <span className={`bo-soul${mine ? ' has' : ''}`}>
        {Array.from({ length: SOUL_AT }).map((_, i) => (
          <span key={i} className={`bo-soul-slot${taken[i] ? ' on' : ''}`} title={taken[i] ? DRAGON_ES[taken[i]] : undefined}>
            {taken[i] && (
              <motion.img
                key={taken[i]} src={dragonIcon(taken[i])} alt="" onError={hide}
                initial={{ opacity: 0, scale: 0.3 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.45, ease: EASE }}
              />
            )}
          </span>
        ))}
        {mine
          ? <b className="bo-soul-tag gold">{SOUL_ES[d.soul!.type] ?? 'ALMA'}</b>
          : point ? <b className="bo-soul-tag">PUNTO DE ALMA</b> : null}
        {d.elders[side] > 0 && <span className="bo-soul-elder"><img src={lol.dragon('elder')} alt="Anciano" onError={hide} />{d.elders[side]}</span>}
      </span>
    );
  };

  // ── Bloque de equipo (marcador superior) ───────────────────────────────────
  const teamBlock = (side: Side) => {
    const name = d.team[side];
    const logo = d.logo[side];
    return (
      <div className={`bo-team ${side}`}>
        {logo
          ? <span className="bo-team-logo"><img src={logo} alt="" onError={hide} /></span>
          : <span className="bo-team-logo ph bo-disp">{name.slice(0, 1)}</span>}
        <div className="bo-team-id">
          {/* Línea 1: nombre + oro del equipo */}
          <div className="bo-team-l1">
            <span className="bo-team-name bo-disp" style={{ ['--fit' as any]: fitName(name) }}>{name}</span>
            {/* Oro del equipo + ventaja en pastilla sólida del lado que va ganando (estilo Worlds: "12.9K +0.8K") */}
            <span className="bo-stat gold" title="Oro del equipo (estimado)">
              <img src={ICON.gold} alt="Oro" onError={hide} />{kFmt(d.gold[side])}
              {(side === 'blue' ? d.gold.blue - d.gold.red : d.gold.red - d.gold.blue) >= 300 && (
                <b className={`bo-golddiff ${side}`}>+{kFmt(Math.abs(d.gold.blue - d.gold.red))}</b>
              )}
            </span>
          </div>
          {/* Línea 2: dragones hacia el alma + torres, vacuolarvas, heraldo y barones */}
          <div className="bo-team-l2">
            {d.isRift && d.epicOk && soulTrack(side)}
            <span className="bo-objs">
              <span className="bo-obj" title="Torres"><img src={ICON.tower} alt="Torres" onError={hide} /><Pop value={d.towers[side]} /></span>
              {d.isRift && d.epicOk && <span className={`bo-obj${d.grubs[side] ? '' : ' zero'}`} title="Vacuolarvas"><img src={ICON.grubs} alt="Vacuolarvas" onError={hide} /><Pop value={d.grubs[side]} /></span>}
              {d.isRift && d.epicOk && <span className={`bo-obj${d.herald === side ? '' : ' zero'}`} title="Heraldo"><img src={ICON.herald} alt="Heraldo" onError={hide} />{d.herald === side ? 1 : 0}</span>}
              {d.isRift && d.epicOk && <span className={`bo-obj${d.barons[side] ? '' : ' zero'}`} title="Barones"><img src={ICON.baron} alt="Barones" onError={hide} /><Pop value={d.barons[side]} /></span>}
            </span>
          </div>
        </div>
      </div>
    );
  };

  const timerChip = (tm: { icon: string; label: string; secs: number } | null) => {
    if (!tm) return null;
    const live = tm.secs <= 0;
    return (
      <span className={`bo-chip${live ? ' live' : ''}`}>
        <img src={tm.icon} alt="" onError={hide} />
        {tm.label}
        {live ? <><span className="bo-live-dot" /><b>VIVO</b></> : <b>{fmt(tm.secs)}</b>}
      </span>
    );
  };

  // ── Jugador de un enfrentamiento ───────────────────────────────────────────
  const playerCell = (p: FeedPlayer | null, side: Side, isLead: boolean) => {
    if (!p) return <div />;
    const icon = champArt.icon(p.championName);
    const splash = champArt.splash(p.championName);
    const gold = d.goldOf.get(p.riotId) || 0;
    const dead = p.isDead;
    const ks = runeIcon(p.keystone);
    const spells = (p.spells || []).map(spellIcon).filter(Boolean);
    return (
      <div className={`bo-p ${side}${isLead ? ' lead' : ''}${dead ? ' dead' : ''}`}>
        {/* Splash del campeón: se funde hacia el centro de la fila */}
        {splash && <span className="bo-art" aria-hidden><img src={splash} alt="" onError={hide} /></span>}
        <span className="bo-face">
          {icon ? <img src={icon} alt="" onError={hide} /> : null}
          {dead && p.respawnTimer > 0 && <span className="bo-respawn"><Pop value={Math.ceil(p.respawnTimer)} /></span>}
          <span className="bo-lvl"><Pop value={p.level} /></span>
        </span>
        {(ks || spells.length > 0) && (
          <span className="bo-loadout">
            <span className="bo-spells">{spells.map((src, i) => <img key={i} src={src} alt="" onError={hide} />)}</span>
            {ks && <img className="bo-rune" src={ks} alt="" onError={hide} />}
          </span>
        )}
        <div className="bo-pid">
          <span className="bo-pname">{shortName(p.riotId) || p.championName}</span>
          <span className="bo-psub">
            <span><em>CS</em>{p.creepScore}</span>
            <span><em>ORO</em><b>{kFmt(gold)}</b></span>
            {p.wardScore != null && <span><em>VIS</em>{Math.round(p.wardScore)}</span>}
          </span>
        </div>
        <span className="bo-kda">
          <Pop value={p.kills} />/<i><Pop value={p.deaths} /></i>/<Pop value={p.assists} />
        </span>
        <div className="bo-items">
          {Array.from({ length: 6 }).map((_, i) => (
            <span key={i} className="bo-item">
              {p.items[i] ? (
                <motion.img
                  key={p.items[i]} src={itemIcon(p.items[i])} alt="" onError={hide}
                  initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.35, ease: EASE }}
                />
              ) : null}
            </span>
          ))}
        </div>
      </div>
    );
  };

  const matchupRow = (m: (typeof d.matchups)[number], index: number) => {
    const gB = m.blue ? d.goldOf.get(m.blue.riotId) || 0 : 0;
    const gR = m.red ? d.goldOf.get(m.red.riotId) || 0 : 0;
    const diff = gB - gR;
    return (
      <motion.div
        key={index}
        className="bo-row"
        initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: EASE, delay: 0.55 + index * 0.07 }}
      >
        {playerCell(m.blue, 'blue', diff > 0)}
        {/* Ventaja de oro de la línea, formato Worlds: una cifra centrada ("1.4K" / "555") y una barra gruesa del color del lado que va arriba. */}
        <div className={`bo-mid ${diff > 0 ? 'blue' : diff < 0 ? 'red' : 'even'}`} title={`${m.pos || ''} · ${kFmt(gB)} vs ${kFmt(gR)}`}>
          {m.pos && <img className="bo-mid-lane" src={lol.lane(m.pos)} alt={m.pos} onError={hide} />}
          <b className="bo-mid-diff">{Math.abs(diff) < 50 ? '—' : wFmt(Math.abs(diff))}</b>
        </div>
        {playerCell(m.red, 'red', diff < 0)}
      </motion.div>
    );
  };

  // ── Vistas del tablero ────────────────────────────────────────────────────
  const views: Array<'lineas' | 'lideres' | 'objetivos'> = rotateSecs ? ['lineas', 'lideres', ...(d.epicOk && d.isRift ? ['objetivos' as const] : [])] : ['lineas'];
  const view = views[viewIdx % views.length];
  const allPlayers = [...d.order, ...d.chaos];
  const sideOfP = (p: FeedPlayer): Side => sideOfTeam(p.team);
  const kda = (p: FeedPlayer) => (p.kills + p.assists) / Math.max(1, p.deaths);
  const leader = (score: (p: FeedPlayer) => number) => [...allPlayers].sort((a, b) => score(b) - score(a))[0] ?? null;
  const leadersView = () => {
    const cards: Array<{ label: string; p: FeedPlayer | null; value: string; icon: string }> = [
      { label: 'MÁS BAJAS', p: leader((p) => p.kills), value: '', icon: ICON.kill },
      { label: 'MEJOR KDA', p: leader(kda), value: '', icon: lol.ui('score') },
      { label: 'MÁS ORO', p: leader((p) => d.goldOf.get(p.riotId) || 0), value: '', icon: ICON.gold },
      { label: 'MÁS CS', p: leader((p) => p.creepScore), value: '', icon: lol.ui('creep') },
      { label: 'MÁS VISIÓN', p: leader((p) => p.wardScore || 0), value: '', icon: lol.stat('range') },
    ];
    cards[0].value = cards[0].p ? String(cards[0].p.kills) : '–';
    cards[1].value = cards[1].p ? `${cards[1].p.kills}/${cards[1].p.deaths}/${cards[1].p.assists}` : '–';
    cards[2].value = cards[2].p ? kFmt(d.goldOf.get(cards[2].p.riotId) || 0) : '–';
    cards[3].value = cards[3].p ? String(cards[3].p.creepScore) : '–';
    cards[4].value = cards[4].p ? String(Math.round(cards[4].p.wardScore || 0)) : '–';
    return (
      <div className="bo-leaders">
        {cards.map((c, i) => (
          <motion.div key={c.label} className={`bo-leader ${c.p ? sideOfP(c.p) : ''}`} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: EASE, delay: 0.06 * i }}>
            {c.p && <span className="bo-leader-art" aria-hidden><img src={champArtRef.current.splash(c.p.championName)} alt="" onError={hide} /></span>}
            <span className="bo-leader-face">{c.p && <img src={champArtRef.current.icon(c.p.championName) || ''} alt="" onError={hide} />}</span>
            <span className="bo-leader-text">
              <span className="bo-leader-label"><img src={c.icon} alt="" onError={hide} />{c.label}</span>
              <span className="bo-leader-name">{c.p ? shortName(c.p.riotId) : '—'}</span>
              <span className="bo-leader-value bo-disp">{c.value}</span>
            </span>
          </motion.div>
        ))}
      </div>
    );
  };
  const objectivesView = () => {
    const sideCol = (side: Side) => {
      const drakes = d.drakes[side];
      return (
        <div className={`bo-objs-col ${side}`}>
          <div className="bo-objs-team bo-disp">{d.team[side]}</div>
          <div className="bo-objs-row">
            <span className="bo-objs-lbl">Dragones</span>
            <span className="bo-objs-drakes">
              {drakes.length ? drakes.map((t: string, i: number) => <img key={i} src={dragonIcon(t)} alt={t} title={DRAGON_ES[t] ?? t} onError={hide} />) : <i>—</i>}
              {d.elders[side] > 0 && <b className="gold"><img src={lol.dragon('elder')} alt="" onError={hide} />×{d.elders[side]}</b>}
            </span>
          </div>
          <div className="bo-objs-row"><span className="bo-objs-lbl">Larvas</span><b>{d.grubs[side]}</b><span className="bo-objs-lbl">Heraldo</span><b>{d.herald === side ? 1 : 0}</b><span className="bo-objs-lbl">Barón</span><b>{d.barons[side]}</b></div>
          <div className="bo-objs-row"><span className="bo-objs-lbl">Torres</span><b>{d.towers[side]}</b><span className="bo-objs-lbl">Oro</span><b>{kFmt(d.gold[side])}</b><span className="bo-objs-lbl">Bajas</span><b>{d.kills[side]}</b></div>
        </div>
      );
    };
    const soulText = d.soul ? `${SOUL_ES[d.soul.type] ?? 'ALMA'} · ${d.team[d.soul.side]}` : (d.drakes.blue.length === SOUL_AT - 1 || d.drakes.red.length === SOUL_AT - 1) ? 'PUNTO DE ALMA' : 'SIN ALMA AÚN';
    return (
      <div className="bo-objs-view">
        {sideCol('blue')}
        <div className="bo-objs-mid">
          <span className="bo-objs-lbl">Alma</span>
          <span className="bo-objs-soul bo-disp">{soulText}</span>
          {d.dragon && <span className="bo-objs-next"><img src={d.dragon.icon} alt="" onError={hide} />{d.dragon.label} {d.dragon.secs > 0 ? `en ${fmt(d.dragon.secs)}` : 'VIVO'}</span>}
          {d.pit && <span className="bo-objs-next"><img src={d.pit.icon} alt="" onError={hide} />{d.pit.label} {d.pit.secs > 0 ? `en ${fmt(d.pit.secs)}` : 'VIVO'}</span>}
        </div>
        {sideCol('red')}
      </div>
    );
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="bo-root" data-theme={theme.id} data-bg={debugBg ? '1' : undefined} style={{ ...broadcastVars(theme, accent), ['--bo-alpha' as any]: panelAlpha }}>
        <div className="bo-top">
          {/* ── Marcador: baja desde arriba al abrir ── */}
          <motion.div className="bo-bug" initial={{ opacity: 0, y: -72 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: EASE }}>
            {teamBlock('blue')}
            <div className="bo-kills blue bo-disp">
              <Pop value={d.kills.blue} />
              <Flash value={d.kills.blue} />
            </div>
            <div className="bo-center">
              <img src={theme.logo} alt={theme.brand} style={{ height: theme.logoHeight }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
              <span className="bo-clock bo-disp">{fmt(d.t)}</span>
            </div>
            <div className="bo-kills red bo-disp">
              <Pop value={d.kills.red} />
              <Flash value={d.kills.red} />
            </div>
            {teamBlock('red')}
            <span aria-hidden className="bo-shine" />
          </motion.div>

          {/* ── Franja: dragón · ventaja de oro · foso / Power Play ── */}
          <motion.div className="bo-strip" initial={{ opacity: 0, y: -14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE, delay: 0.35 }}>
            <div className="bo-strip-side left">{d.isRift && timerChip(d.dragon)}</div>
            <div className="bo-goldw">
              <span className="bo-lead blue">
                <AnimatePresence initial={false}>
                  {lead === 'blue' && (
                    <motion.span key="b" initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 14 }} transition={{ duration: 0.35, ease: EASE }}>
                      <img src={ICON.gold} alt="" onError={hide} />+{kFmt(goldDiff)}
                    </motion.span>
                  )}
                </AnimatePresence>
              </span>
              <div className="bo-goldbar">
                <i className="blue" style={{ width: `${bluePct}%` }} />
                <i className="red" style={{ width: `${100 - bluePct}%` }} />
              </div>
              <span className="bo-lead red">
                <AnimatePresence initial={false}>
                  {lead === 'red' && (
                    <motion.span key="r" initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -14 }} transition={{ duration: 0.35, ease: EASE }}>
                      +{kFmt(-goldDiff)}<img src={ICON.gold} alt="" onError={hide} />
                    </motion.span>
                  )}
                </AnimatePresence>
              </span>
            </div>
            <div className="bo-strip-side right">
              {d.isRift && (pp ? (
                <motion.span key="pp" className={`bo-chip pp ${pp.side}`} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4, ease: EASE }}>
                  <img src={ICON.baron} alt="" onError={hide} />
                  POWER PLAY
                  {ppGold != null && <b>{ppGold >= 0 ? '+' : '−'}{kFmt(Math.abs(ppGold))}</b>}
                  <span className="bo-pp-time">{fmt(pp.t0 + BARON_BUFF - d.t)}</span>
                </motion.span>
              ) : timerChip(d.pit))}
            </div>
          </motion.div>
        </div>

        {/* ── Aviso: entra desde arriba con un barrido, sin rebote; uno a la vez ── */}
        <AnimatePresence mode="wait">
          {moment && (
            <motion.div
              key={moment.key}
              className={`bo-banner ${moment.side}${moment.minor ? ' minor' : ''}`}
              style={{ translateX: '-50%' }}
              initial={{ opacity: 0, y: -28 }}
              animate={{ opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE } }}
              exit={{ opacity: 0, y: -16, transition: { duration: 0.22 } }}
            >
              {moment.art && (
                <motion.span aria-hidden className="bo-banner-art" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 0.1 }}>
                  <motion.img src={moment.art} alt="" onError={hide} initial={{ scale: 1.18 }} animate={{ scale: 1.04 }} transition={{ duration: 5, ease: 'linear' }} />
                </motion.span>
              )}
              <motion.span className="bo-banner-icon" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.45, ease: EASE, delay: 0.12 }}>
                <img src={moment.icon} alt="" onError={hide} />
              </motion.span>
              <motion.div className="bo-banner-text" initial={{ opacity: 0, x: -18 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.45, ease: EASE, delay: 0.16 }}>
                <div className="bo-banner-kicker">{moment.kicker}</div>
                <div className="bo-banner-title bo-disp">{moment.title}</div>
              </motion.div>
              <motion.span
                aria-hidden
                className="bo-banner-sweep"
                initial={{ x: -140 }}
                animate={{ x: 900 }}
                transition={{ duration: 1.1, delay: 0.25, ease: 'easeInOut' }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Pelea: panel abajo al centro con las bajas de cada lado; mientras dura, el tablero se esconde ── */}
        <AnimatePresence>
          {fight && (
            <motion.div
              key={`fight-${fight.t0}`}
              className={`bo-fight ${fight.lead ?? ''}`}
              initial={{ opacity: 0, y: 60 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40, transition: { duration: 0.25 } }}
              transition={{ duration: 0.4, ease: EASE }}
            >
              <div className="bo-fw-head">
                <span className="bo-fw-title bo-disp">Daño a campeones · última pelea</span>
                <span className="bo-fw-sub">{fmt(fight.t0)}–{fmt(fight.t1)} · <b className="blue">{fight.tally.blue}</b> – <b className="red">{fight.tally.red}</b> bajas · estimado</span>
              </div>
              <div className="bo-fw-body">
                <span className="bo-fw-logo blue">{d.logo.blue ? <img src={d.logo.blue} alt="" onError={hide} /> : <b className="bo-disp">{d.team.blue.slice(0, 3)}</b>}<i>{d.team.blue}</i></span>
                {(['blue', 'red'] as Side[]).map((side) => (
                  <div key={side} className={`bo-fw-col ${side}`}>
                    {fight.players[side].map((x, i) => (
                      <motion.div key={x.p.riotId} className="bo-fw-row" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3, delay: 0.05 * i }}>
                        <span className={`bo-fw-face${x.deaths ? ' dead' : ''}`}><img src={champArtRef.current.icon(x.p.championName) || ''} alt="" onError={hide} /></span>
                        <span className="bo-fw-bar">
                          <motion.i className="phys" initial={{ scaleX: 0 }} animate={{ scaleX: Math.max(0.01, x.phys / fight.maxDmg) }} transition={{ duration: 0.6, ease: EASE, delay: 0.1 + 0.05 * i }} />
                          <motion.i className="magic" style={{ ['--off' as any]: `${(x.phys / fight.maxDmg) * 100}%` }} initial={{ scaleX: 0 }} animate={{ scaleX: Math.max(0, x.magic / fight.maxDmg) }} transition={{ duration: 0.6, ease: EASE, delay: 0.15 + 0.05 * i }} />
                        </span>
                        <span className="bo-fw-val bo-disp">{x.dmg ? x.dmg.toLocaleString('es-MX') : '0'}</span>
                        <span className="bo-fw-ka">{x.kills ? `${x.kills}B` : ''}{x.kills && x.assists ? ' ' : ''}{x.assists ? `${x.assists}A` : ''}</span>
                      </motion.div>
                    ))}
                  </div>
                ))}
                <span className="bo-fw-logo red">{d.logo.red ? <img src={d.logo.red} alt="" onError={hide} /> : <b className="bo-disp">{d.team.red.slice(0, 3)}</b>}<i>{d.team.red}</i></span>
              </div>
              <div className="bo-fw-foot"><span><i className="sw phys" /> DAÑO FÍSICO</span><span><i className="sw magic" /> DAÑO MÁGICO</span><span>· ESTIMACIÓN ATAK.GG: VIDA DEL CAÍDO REPARTIDA ENTRE BAJA Y ASISTENCIAS</span></div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Diferencia de oro: solo cuando un equipo pierde de golpe una ventaja grande ── */}
        <AnimatePresence>
          {showGraph && (
            <motion.div
              key={`gg-${swing?.t ?? 'fija'}`}
              className={`bo-gg ${swing ? swing.side : ''}`}
              initial={{ opacity: 0, y: 80 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 60, transition: { duration: 0.3 } }}
              transition={{ duration: 0.55, ease: EASE }}
            >
              <GoldGraph
                pts={goldHist.current?.pts ?? []} t={d.t} team={d.team} logo={d.logo}
                events={graphEvents} epicOk={d.epicOk} swing={graphParam === '1' ? null : swing} label={boardLabel}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Tablero inferior: rota entre vistas; se esconde durante las peleas (?auto=0 lo deja fijo) y con ?tablero=0 ── */}
        <AnimatePresence initial={false}>
          {boardParam && !(autoHide && fight) && !showGraph && (
            <motion.div key="board" className="bo-board" initial={{ opacity: 0, y: 90 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 70, transition: { duration: 0.3 } }} transition={{ duration: 0.6, ease: EASE, delay: 0.1 }}>
              <AnimatePresence mode="wait" initial={false}>
                <motion.div key={view} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8, transition: { duration: 0.22 } }} transition={{ duration: 0.35, ease: EASE }}>
                  <div className="bo-board-head"><span className="bo-board-label bo-disp">{boardLabel}{view !== 'lineas' ? ` / ${view === 'lideres' ? 'LÍDERES' : 'OBJETIVOS'}` : ''}</span></div>
                  {view === 'lineas' && d.matchups.map((m, i) => matchupRow(m, i))}
                  {view === 'lideres' && leadersView()}
                  {view === 'objetivos' && objectivesView()}
                </motion.div>
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
        <LiveReplay channel={String(channel || '')} brand={theme.brand} logo={theme.logo} />
      </div>
    </MotionConfig>
  );
}

// Repetición de la segunda cámara: la mesa de control (/broadcast/:canal/control) decide cuándo sale y
// cuándo se quita; aquí se reproduce a pantalla completa desde los últimos `last` segundos del clip.
function LiveReplay({ channel, brand, logo }: { channel: string; brand: string; logo: string }) {
  const [on, setOn] = useState<{ url: string; last: number; slow: boolean; at: number } | null>(null);
  const seen = useRef(0);
  const video = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    if (!channel) return;
    let alive = true;
    const tick = async () => {
      try {
        const { data } = await axiosInstance.get(`/api/live-feed/${channel}/clip-state`);
        if (!alive) return;
        const s = data?.state;
        if (!s?.show) { setOn(null); return; }
        // Solo arranca por una orden nueva (y reciente): recargar el overlay no repite la anterior.
        if (s.at !== seen.current && data.url && Date.now() - s.at < 60_000) { seen.current = s.at; setOn({ url: data.url, last: Number(s.last) || 0, slow: !!s.slow, at: s.at }); }
      } catch { /* sin backend */ }
    };
    void tick();
    const id = window.setInterval(tick, 1000);
    return () => { alive = false; window.clearInterval(id); };
  }, [channel]);
  const start = () => {
    const v = video.current; if (!v || !on) return;
    if (on.last > 0 && Number.isFinite(v.duration) && v.duration > on.last) v.currentTime = v.duration - on.last;
    v.playbackRate = on.slow ? 0.5 : 1;
    void v.play().catch(() => {});
  };
  return (
    <AnimatePresence>
      {on && (
        <motion.div key={on.at} initial={{ opacity: 0, scale: 1.04 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, transition: { duration: 0.35 } }} transition={{ duration: 0.45, ease: EASE }}
          style={{ position: 'fixed', inset: 0, zIndex: 50, background: '#000', overflow: 'hidden' }}>
          <video ref={video} src={on.url} muted playsInline preload="auto" onLoadedMetadata={start} onEnded={() => setOn(null)}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          <div style={{ position: 'absolute', inset: 0, boxShadow: 'inset 0 0 0 6px var(--bo-accent, #e8323c), inset 0 0 160px rgba(0,0,0,.55)', pointerEvents: 'none' }} />
          <motion.div initial={{ x: -60, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.2, duration: 0.5, ease: EASE }}
            style={{ position: 'absolute', top: 44, left: 48, display: 'flex', alignItems: 'center', gap: 16, padding: '12px 22px 12px 16px', background: 'rgba(6,10,20,.82)', borderLeft: '6px solid var(--bo-accent, #e8323c)' }}>
            <img src={logo} alt={brand} style={{ height: 40 }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
            <span className="bo-disp" style={{ fontSize: 40, letterSpacing: '.06em', color: '#fff', lineHeight: 1 }}>REPETICIÓN</span>
            {on.slow && <span className="bo-disp" style={{ fontSize: 22, color: 'var(--bo-accent, #e8323c)' }}>CÁMARA LENTA</span>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
