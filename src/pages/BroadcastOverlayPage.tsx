// src/pages/BroadcastOverlayPage.tsx
// Overlay de espectador para OBS (Browser Source 1920x1080, fondo transparente):
// /broadcast/:channel/overlay
// - Dos temas (src/lib/broadcastTheme.ts): "atak" (diseño Arena del sitio) y
//   "lqc" (identidad de la liga). Sale del canal — los "lqc…" usan el de la
//   liga — o se fuerza con ?theme=atak|lqc. El acento del caster lo pisa.
// - Arte del juego: iconos locales de /public/lol (dragones por tipo, barón,
//   heraldo, torres, oro, súbditos, líneas) y el splash de cada campeón en su
//   fila y en los avisos — nada de emojis.
// - Oro ESTIMADO por jugador (Live Client no expone el oro de los 10: se
//   aproxima con pasiva + CS + kills/asistencias, misma fórmula ambos lados)
//   con gráfica de diferencia por equipo y por enfrentamiento de línea.
// - Tablero inferior por ENFRENTAMIENTOS: top vs top, jg vs jg, etc.
// - Avisos en cola (solo eventos NUEVOS): objetivos, primera sangre, torres e
//   inhibidores, con el campeón que lo consiguió.
// - Movimiento (solo transform / opacity): entrada del marcador y del tablero,
//   kills que saltan, dragones e items que aparecen, KDA y nivel que parpadean
//   al cambiar. Se apaga con prefers-reduced-motion.
// - Timers de objetivos desde los eventos reales (constantes por parche abajo).
// Vista previa: ?bg=1 (fondo de prueba) · ?demo=1 (partida simulada, para
// colocar y revisar el overlay en OBS sin transmisión).
import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import { axiosInstance } from '@/lib/axios';
import { useChampions } from '@/hooks/use-ddragon';
import { lol, type DragonKey } from '@/lib/lolAssets';
import { broadcastThemeFor, broadcastVars, ensureBroadcastFont } from '@/lib/broadcastTheme';
import { demoFeed } from '@/lib/broadcastDemo';
import '@/styles/pages/broadcast-overlay.css';

// ── Timers de la Grieta (AJUSTAR POR PARCHE si Riot los mueve) ───────────────
const DRAGON_FIRST = 300;    // primer dragón 5:00
const DRAGON_RESPAWN = 300;  // renace 5:00 tras cada toma
const HERALD_SPAWN = 840;    // heraldo 14:00
const BARON_SPAWN = 1200;    // barón 20:00
const BARON_RESPAWN = 360;   // renace 6:00 tras cada toma

// Tipo de dragón del Live Client → icono local.
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
const ICON = {
  baron: lol.ui('nashor'),
  herald: lol.ui('rift_herald'),
  tower: lol.ui('tower'),
  gold: lol.ui('gold'),
  minion: lol.ui('minion'),
  grubs: lol.ui('creep'),
  kill: lol.ui('score'),
  dragon: lol.dragon('elder'),
};

interface FeedPlayer {
  riotId: string; championName: string; team: 'ORDER' | 'CHAOS';
  level: number; kills: number; deaths: number; assists: number;
  creepScore: number; isDead: boolean; respawnTimer: number; items: number[];
  position: string;
}
interface FeedEvent { id: number; t: number; name: string; killer: string; victim: string; extra: string }

const fmt = (s: number) => `${Math.floor(s / 60)}:${Math.floor(Math.max(0, s) % 60).toString().padStart(2, '0')}`;
const norm = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const shortName = (r: string) => (r.includes('#') ? r.slice(0, r.indexOf('#')) : r);
const kFmt = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(Math.round(n)));

/** Oro estimado (Live Client no expone el oro ajeno): pasiva desde 1:50 +
 *  CS + kills/asistencias. Misma fórmula ambos lados → la DIFERENCIA es útil. */
function estGold(p: FeedPlayer, t: number): number {
  const passive = Math.max(0, t - 110) * 2.04;
  return Math.round(500 + passive + p.creepScore * 21 + p.kills * 300 + p.assists * 150);
}

const POS_ORDER = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY'];
/** Cuerpo del nombre del equipo: entero hasta 13 letras, luego baja para que quepa. */
const fitName = (name: string) => `${name.length <= 13 ? 31 : Math.max(19, Math.round((31 * 13) / name.length))}px`;
/** Turret_T1_C_05_A → rótulo de la torre. Solo se nombra la de mid (C): el
 *  sentido de L / R cambia según el lado y no vale la pena arriesgar un error en vivo. */
const towerLane = (extra: string) => (/^Turret_T\d_C_/.test(extra) ? 'TORRE DE MID' : 'TORRE DESTRUIDA');

type Side = 'blue' | 'red';
/** Aviso en pantalla: objetivo, primera sangre o estructura. */
interface Moment {
  key: number; icon: string; kicker: string; title: string; side: Side;
  /** Splash del campeón que lo consiguió (fondo del aviso). */
  art?: string;
  /** Avisos menores (torres) duran menos y van más compactos. */
  minor?: boolean;
}
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

export default function BroadcastOverlayPage() {
  const { channel } = useParams<{ channel: string }>();
  const [params] = useSearchParams();
  const debugBg = params.get('bg') === '1';
  const demo = params.get('demo') === '1';
  const theme = broadcastThemeFor(channel, params.get('theme'));
  const { data: champs } = useChampions();
  const version = (champs as any)?.version || '14.1.1';

  useEffect(() => { ensureBroadcastFont(theme); }, [theme]);

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

  const feed: any = demo ? demoData : feedQ.data ?? null;
  const accent: string = feed?.accent || '';

  // championName (display o slug) → icono y splash, tolerante a acentos/espacios.
  const champArt = useMemo(() => {
    const icon: Record<string, string> = {};
    const slug: Record<string, string> = {};
    for (const e of Object.values<any>((champs as any)?.byId || {})) {
      const url = `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-icons/${e.key}.png`;
      for (const k of [norm(e.name), norm(e.id)]) { icon[k] = url; slug[k] = e.id; }
    }
    return {
      icon: (name: string) => icon[norm(name)] || '',
      splash: (name: string) => (slug[norm(name)] ? lol.centered(slug[norm(name)]) : ''),
    };
  }, [champs]);
  const champArtRef = useRef(champArt);
  champArtRef.current = champArt;

  // ── Avisos en cola (solo eventos NUEVOS entre snapshots) ──────────────────
  const [queue, setQueue] = useState<Moment[]>([]);
  const seenEvents = useRef<Set<number>>(new Set());
  const firstSnap = useRef(true);

  useEffect(() => {
    const events: FeedEvent[] = feed?.events || [];
    if (!events.length) return;
    if (firstSnap.current) {
      events.forEach((e) => seenEvents.current.add(e.id));
      firstSnap.current = false;
      return;
    }

    const players: FeedPlayer[] = feed?.players || [];
    const playerOf = (name: string) => {
      const n = norm(shortName(name));
      return n ? players.find((p) => norm(shortName(p.riotId)) === n) ?? null : null;
    };
    const teamNameOf = (side: Side) => String(side === 'red' ? (feed?.team2 || 'ROJO') : (feed?.team1 || 'AZUL')).toUpperCase();
    const firstKillId = Math.min(...events.filter((e) => e.name === 'ChampionKill').map((e) => e.id));

    const fresh: Moment[] = [];
    for (const e of events) {
      if (seenEvents.current.has(e.id)) continue;
      seenEvents.current.add(e.id);

      const killer = playerOf(e.killer);
      const side: Side = killer?.team === 'CHAOS' ? 'red' : 'blue';
      const art = killer ? champArtRef.current.splash(killer.championName) : '';
      const takes = `${teamNameOf(side)} SE LLEVA`;

      if (e.name === 'DragonKill') {
        const type = e.extra || 'Fire';
        fresh.push({ key: e.id, icon: dragonIcon(type), kicker: takes, title: DRAGON_ES[type] ?? 'DRAGÓN', side, art });
      } else if (e.name === 'BaronKill') {
        fresh.push({ key: e.id, icon: ICON.baron, kicker: takes, title: 'BARÓN NASHOR', side, art });
      } else if (e.name === 'HeraldKill') {
        fresh.push({ key: e.id, icon: ICON.herald, kicker: takes, title: 'HERALDO DE LA GRIETA', side, art });
      } else if (e.name === 'HordeKill') {
        fresh.push({ key: e.id, icon: ICON.grubs, kicker: takes, title: 'LARVAS DEL VACÍO', side, art, minor: true });
      } else if (e.name === 'ChampionKill' && e.id === firstKillId && killer) {
        fresh.push({
          key: e.id, icon: champArtRef.current.icon(killer.championName) || ICON.kill,
          kicker: `${shortName(killer.riotId).toUpperCase()} · ${teamNameOf(side)}`, title: 'PRIMERA SANGRE', side, art,
        });
      } else if (e.name === 'TurretKilled') {
        // La torre destruida dice el lado: T1 = torre azul → la tira el rojo.
        const towerSide: Side = e.extra.startsWith('Turret_T1') ? 'red' : e.extra.startsWith('Turret_T2') ? 'blue' : side;
        fresh.push({ key: e.id, icon: ICON.tower, kicker: `${teamNameOf(towerSide)} DERRIBA`, title: towerLane(e.extra), side: towerSide, minor: true });
      } else if (e.name === 'InhibKilled') {
        fresh.push({ key: e.id, icon: ICON.tower, kicker: `${teamNameOf(side)} DERRIBA`, title: 'INHIBIDOR', side, art });
      }
    }
    // Como mucho 4 en espera: tras una pelea grande importa lo último.
    if (fresh.length) setQueue((q) => [...q, ...fresh].slice(-4));
  }, [feed]);

  // El primero de la cola se muestra y se retira solo.
  const moment = queue[0] ?? null;
  useEffect(() => {
    if (!moment) return;
    const t = setTimeout(() => setQueue((q) => q.slice(1)), moment.minor ? 3200 : 5000);
    return () => clearTimeout(t);
  }, [moment]);

  const derived = useMemo(() => {
    if (!feed) return null;
    const players: FeedPlayer[] = feed.players || [];
    const events: FeedEvent[] = feed.events || [];
    const t: number = feed.gameTime || 0;
    const order = players.filter((p) => p.team === 'ORDER');
    const chaos = players.filter((p) => p.team === 'CHAOS');
    const teamOfName = (name: string): 'ORDER' | 'CHAOS' | null => {
      const n = norm(shortName(name));
      if (order.some((p) => norm(shortName(p.riotId)) === n)) return 'ORDER';
      if (chaos.some((p) => norm(shortName(p.riotId)) === n)) return 'CHAOS';
      return null;
    };

    // Torres: el evento trae la torre DESTRUIDA (Turret_T1_* = torre del azul
    // → punto para el rojo). Fallback: equipo del asesino.
    let towersOrder = 0, towersChaos = 0;
    const dragonsOrder: string[] = [], dragonsChaos: string[] = [];
    let baronsOrder = 0, baronsChaos = 0;
    let lastDragonT = -1, lastBaronT = -1, heraldTaken = false;

    for (const e of events) {
      if (e.name === 'TurretKilled') {
        if (e.extra.startsWith('Turret_T1')) towersChaos++;
        else if (e.extra.startsWith('Turret_T2')) towersOrder++;
        else if (teamOfName(e.killer) === 'ORDER') towersOrder++;
        else if (teamOfName(e.killer) === 'CHAOS') towersChaos++;
      } else if (e.name === 'DragonKill') {
        lastDragonT = e.t;
        const type = e.extra || 'Fire';
        (teamOfName(e.killer) === 'CHAOS' ? dragonsChaos : dragonsOrder).push(type);
      } else if (e.name === 'BaronKill') {
        lastBaronT = e.t;
        if (teamOfName(e.killer) === 'CHAOS') baronsChaos++; else baronsOrder++;
      } else if (e.name === 'HeraldKill') {
        heraldTaken = true;
      }
    }

    const nextDragon = (lastDragonT < 0 ? DRAGON_FIRST : lastDragonT + DRAGON_RESPAWN) - t;
    const baronBase = lastBaronT < 0 ? BARON_SPAWN : lastBaronT + BARON_RESPAWN;
    const nextBaron = baronBase - t;
    const nextHerald = !heraldTaken && t < BARON_SPAWN ? HERALD_SPAWN - t : null;

    // ── Oro estimado por jugador / equipo ─────────────────────────────────
    const goldOf = new Map<string, number>();
    players.forEach((p) => goldOf.set(p.riotId, estGold(p, t)));
    const goldOrder = order.reduce((s, p) => s + (goldOf.get(p.riotId) || 0), 0);
    const goldChaos = chaos.reduce((s, p) => s + (goldOf.get(p.riotId) || 0), 0);

    // ── Enfrentamientos por línea (top vs top…); fallback por índice (ARAM) ──
    const byPos = (list: FeedPlayer[]) => {
      const m = new Map<string, FeedPlayer>();
      list.forEach((p) => { if (POS_ORDER.includes(p.position) && !m.has(p.position)) m.set(p.position, p); });
      return m;
    };
    const oPos = byPos(order), cPos = byPos(chaos);
    const canPair = POS_ORDER.every((pos) => oPos.has(pos)) && POS_ORDER.every((pos) => cPos.has(pos));
    const matchups: Array<{ pos: string; blue: FeedPlayer | null; red: FeedPlayer | null }> = canPair
      ? POS_ORDER.map((pos) => ({ pos, blue: oPos.get(pos) ?? null, red: cPos.get(pos) ?? null }))
      : Array.from({ length: Math.max(order.length, chaos.length) }, (_, i) => ({
          pos: '', blue: order[i] ?? null, red: chaos[i] ?? null,
        }));

    const label: string = feed.matchLabel || '';
    const vs = label.match(/([^:]+?)\s+vs\.?\s+(.+)/i);
    const team1 = (feed.team1 || vs?.[1] || 'AZUL').trim().toUpperCase();
    const team2 = (feed.team2 || vs?.[2] || 'ROJO').trim().toUpperCase();

    const mode = String(feed.gameMode || '').toUpperCase();
    const isRift = mode === 'CLASSIC' || /summoner/i.test(String(feed.mapName || ''));

    return {
      order, chaos, team1, team2, isRift, matchups, goldOf, goldOrder, goldChaos,
      logo1: feed.logo1 || '', logo2: feed.logo2 || '',
      killsOrder: order.reduce((s, p) => s + p.kills, 0),
      killsChaos: chaos.reduce((s, p) => s + p.kills, 0),
      towersOrder, towersChaos, dragonsOrder, dragonsChaos, baronsOrder, baronsChaos,
      nextDragon, nextBaron, nextHerald, gameTime: t,
    };
  }, [feed]);

  if (!derived) {
    // Sin transmisión: overlay invisible (OBS no muestra nada). En debug, aviso.
    return debugBg ? (
      <div className="bo-wait">Overlay {channel}: esperando transmisión del companion…</div>
    ) : null;
  }

  const d = derived;
  const itemIcon = (id: number) => `https://ddragon.leagueoflegends.com/cdn/${version}/img/item/${id}.png`;
  const goldTotal = Math.max(1, d.goldOrder + d.goldChaos);
  const goldDiff = d.goldOrder - d.goldChaos;
  const bluePct = (d.goldOrder / goldTotal) * 100;
  const hide = (e: React.SyntheticEvent<HTMLImageElement>) => { e.currentTarget.style.visibility = 'hidden'; };
  // La liga rotula con barras ("CALENDARIO / SEMANA 5"): mismo separador en su tema.
  const rawLabel: string = feed.matchLabel || `${theme.brand} · ${String(channel).toUpperCase()}`;
  const boardLabel = theme.id === 'lqc' ? rawLabel.replace(/\s*[·|•-]\s+/g, ' / ') : rawLabel;

  // Los bloques de abajo se llaman como funciones (teamBlock('blue')), no como
  // <Componente />: definidos aquí dentro se remontarían en cada snapshot y
  // repetirían su animación de entrada.

  // ── Bloque de equipo (marcador superior) ───────────────────────────────────
  const teamBlock = (side: Side) => {
    const blue = side === 'blue';
    const name = blue ? d.team1 : d.team2;
    const logo = blue ? d.logo1 : d.logo2;
    const barons = blue ? d.baronsOrder : d.baronsChaos;
    return (
      <div className={`bo-team ${side}`}>
        {logo
          ? <span className="bo-team-logo"><img src={logo} alt="" onError={hide} /></span>
          : <span className="bo-team-logo ph bo-disp">{name.slice(0, 1)}</span>}
        <div className="bo-team-id">
          <span className="bo-team-name bo-disp" style={{ ['--fit' as any]: fitName(name) }}>{name}</span>
          <span className="bo-team-side">{blue ? 'LADO AZUL' : 'LADO ROJO'}</span>
        </div>
        <div className="bo-team-stats">
          <span className="bo-stat"><img src={ICON.tower} alt="Torres" onError={hide} /><Pop value={blue ? d.towersOrder : d.towersChaos} /></span>
          {d.isRift && barons > 0 && <span className="bo-stat"><img src={ICON.baron} alt="Barones" onError={hide} /><Pop value={barons} /></span>}
          <span className="bo-stat gold"><img src={ICON.gold} alt="Oro" onError={hide} />{kFmt(blue ? d.goldOrder : d.goldChaos)}</span>
        </div>
      </div>
    );
  };

  // Dragones tomados: cada uno aparece con un salto corto al entrar.
  const drakes = (side: Side) => (
    <div className={`bo-drakes ${side}`}>
      {(side === 'blue' ? d.dragonsOrder : d.dragonsChaos).map((type, i) => (
        <motion.span
          key={`${i}-${type}`} className="bo-drake" title={DRAGON_ES[type] ?? type}
          initial={{ opacity: 0, scale: 0.4 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4, ease: EASE }}
        >
          <img src={dragonIcon(type)} alt="" onError={hide} />
        </motion.span>
      ))}
    </div>
  );

  const timerChip = (icon: string, label: string, secs: number | null) => {
    if (secs == null) return null;
    const live = secs <= 0;
    return (
      <span className={`bo-chip${live ? ' live' : ''}`}>
        <img src={icon} alt="" onError={hide} />
        {label}
        {live ? <><span className="bo-live-dot" /><b>VIVO</b></> : <b>{fmt(secs)}</b>}
      </span>
    );
  };

  // ── Jugador de un enfrentamiento ───────────────────────────────────────────
  const playerCell = (p: FeedPlayer | null, side: Side, lead: boolean) => {
    if (!p) return <div />;
    const icon = champArt.icon(p.championName);
    const splash = champArt.splash(p.championName);
    const gold = d.goldOf.get(p.riotId) || 0;
    const dead = p.isDead;
    return (
      <div className={`bo-p ${side}${lead ? ' lead' : ''}${dead ? ' dead' : ''}`}>
        {/* Splash del campeón: se funde hacia el centro de la fila */}
        {splash && <span className="bo-art" aria-hidden><img src={splash} alt="" onError={hide} /></span>}
        <span className="bo-face">
          {icon ? <img src={icon} alt="" onError={hide} /> : null}
          {dead && p.respawnTimer > 0 && <span className="bo-respawn"><Pop value={Math.ceil(p.respawnTimer)} /></span>}
        </span>
        <span className="bo-lvl"><Pop value={p.level} /></span>
        <div className="bo-pid">
          <span className="bo-pname">{shortName(p.riotId) || p.championName}</span>
          <span className="bo-psub">
            <img src={ICON.minion} alt="CS" onError={hide} />{p.creepScore}
            <img src={ICON.gold} alt="Oro" onError={hide} /><b>{kFmt(gold)}</b>
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
    const pctB = (gB / Math.max(1, gB + gR)) * 100;
    const diff = gB - gR;
    return (
      <motion.div
        key={index}
        className="bo-row"
        initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: EASE, delay: 0.55 + index * 0.07 }}
      >
        {playerCell(m.blue, 'blue', diff > 0)}
        <div className={`bo-mid${diff > 0 ? ' blue' : diff < 0 ? ' red' : ''}`}>
          <span className="bo-mid-top">
            {m.pos ? <img src={lol.lane(m.pos)} alt={m.pos} onError={hide} /> : 'VS'}
            {diff !== 0 && <b>{diff > 0 ? '+' : '−'}{kFmt(Math.abs(diff))}</b>}
          </span>
          <div className="bo-goldbar">
            <i className="blue" style={{ width: `${pctB}%` }} />
            <i className="red" style={{ width: `${100 - pctB}%` }} />
          </div>
        </div>
        {playerCell(m.red, 'red', diff < 0)}
      </motion.div>
    );
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="bo-root" data-theme={theme.id} data-bg={debugBg ? '1' : undefined} style={broadcastVars(theme, accent)}>
        <div className="bo-top">
          {/* ── Marcador: baja desde arriba al abrir ── */}
          <motion.div className="bo-bug" initial={{ opacity: 0, y: -72 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: EASE }}>
            {teamBlock('blue')}
            <div className="bo-kills blue bo-disp">
              <Pop value={d.killsOrder} />
              <Flash value={d.killsOrder} />
            </div>
            <div className="bo-center">
              <img src={theme.logo} alt={theme.brand} style={{ height: theme.logoHeight }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
              <span className="bo-clock bo-disp">{fmt(d.gameTime)}</span>
            </div>
            <div className="bo-kills red bo-disp">
              <Pop value={d.killsChaos} />
              <Flash value={d.killsChaos} />
            </div>
            {teamBlock('red')}
            <span aria-hidden className="bo-shine" />
          </motion.div>

          {/* ── Dragones tomados + diferencia de oro por equipo ── */}
          <motion.div className="bo-subrow" initial={{ opacity: 0, y: -14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE, delay: 0.35 }}>
            {d.isRift ? drakes('blue') : <span />}
            <div>
              <div className="bo-goldbar">
                <i className="blue" style={{ width: `${bluePct}%` }} />
                <i className="red" style={{ width: `${100 - bluePct}%` }} />
              </div>
              <div className={`bo-goldchip${goldDiff > 0 ? ' blue' : goldDiff < 0 ? ' red' : ''}`}>
                <img src={ICON.gold} alt="" onError={hide} />
                ORO <b>{goldDiff === 0 ? '0' : `${goldDiff > 0 ? '+' : '−'}${kFmt(Math.abs(goldDiff))}`}</b>
              </div>
            </div>
            {d.isRift ? drakes('red') : <span />}
          </motion.div>

          {/* ── Timers de objetivos (solo en la Grieta) ── */}
          {d.isRift && (
            <motion.div className="bo-timers" initial={{ opacity: 0, y: -14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE, delay: 0.5 }}>
              {timerChip(ICON.dragon, 'DRAGÓN', d.nextDragon)}
              {d.nextHerald != null
                ? timerChip(ICON.herald, 'HERALDO', d.nextHerald)
                : timerChip(ICON.baron, 'BARÓN', d.nextBaron)}
            </motion.div>
          )}
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

        {/* ── Tablero inferior: sube al abrir; las filas entran escalonadas ── */}
        <motion.div className="bo-board" initial={{ opacity: 0, y: 90 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: EASE, delay: 0.2 }}>
          <div className="bo-board-head">
            <span className="bo-board-team blue"><i />{d.team1}</span>
            <span className="bo-board-label bo-disp">{boardLabel}</span>
            <span className="bo-board-team red">{d.team2}<i /></span>
          </div>
          {d.matchups.map((m, i) => matchupRow(m, i))}
        </motion.div>
      </div>
    </MotionConfig>
  );
}
