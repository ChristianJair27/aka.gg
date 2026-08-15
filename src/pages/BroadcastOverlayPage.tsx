// src/pages/BroadcastOverlayPage.tsx
// Overlay de caster para OBS (Browser Source 1920x1080, fondo transparente):
// /broadcast/:channel/overlay
// - Iconos REALES del juego (CommunityDragon minimapa): dragones por tipo,
//   barón, heraldo, torres — nada de emojis.
// - Oro ESTIMADO por jugador (Live Client no expone el oro de los 10: se
//   aproxima con pasiva + CS + kills/asistencias, misma fórmula ambos lados)
//   con gráfica de diferencia por equipo y por enfrentamiento de línea.
// - Scoreboard inferior por MATCHUPS: top vs top, jg vs jg, etc.
// - Timers de objetivos desde los eventos reales (constantes por parche abajo).
// - Paleta LQC (lqc.revolution505.com): azul #0066ff → cyan #00d4ff sobre navy
//   #001433, rojo #ff2357 — versión fuerte/imponente para broadcast.
// Vista previa: ?bg=1 (fondo oscuro de prueba).
import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { axiosInstance } from '@/lib/axios';
import { useChampions } from '@/hooks/use-ddragon';

const LQC = {
  blue: '#0066ff',
  blueDeep: '#00297a',
  cyan: '#00d4ff',
  navy: '#001433',
  deep: 'rgba(0, 9, 24, 0.96)',
  pink: '#ff2357',
  pinkDeep: '#7a0f2b',
  gold: '#f0b232',
};
const FONT = "'Saira Condensed', 'Saira', sans-serif";

// ── Timers de la Grieta (AJUSTAR POR PARCHE si Riot los mueve) ───────────────
const DRAGON_FIRST = 300;    // primer dragón 5:00
const DRAGON_RESPAWN = 300;  // renace 5:00 tras cada toma
const HERALD_SPAWN = 840;    // heraldo 14:00
const BARON_SPAWN = 1200;    // barón 20:00
const BARON_RESPAWN = 360;   // renace 6:00 tras cada toma

// ── Iconos oficiales (CommunityDragon, minimapa del juego) ───────────────────
const MINIMAP = 'https://raw.communitydragon.org/latest/game/assets/ux/minimap/icons';
const ICON = {
  baron: `${MINIMAP}/baron.png`,
  herald: `${MINIMAP}/riftherald.png`,
  tower: `${MINIMAP}/icon_ui_tower_minimap.png`,
  dragon: `${MINIMAP}/dragon.png`,
};
const DRAGON_ICON: Record<string, string> = {
  Fire: `${MINIMAP}/dragon_infernal.png`,
  Water: `${MINIMAP}/dragon_ocean.png`,
  Earth: `${MINIMAP}/dragon_mountain.png`,
  Air: `${MINIMAP}/dragon_cloud.png`,
  Hextech: `${MINIMAP}/dragon_hextech.png`,
  Chemtech: `${MINIMAP}/dragon_chemtech.png`,
  Elder: `${MINIMAP}/dragon_elder.png`,
};
const DRAGON_GLOW: Record<string, string> = {
  Fire: '#ff6b3d', Water: '#4fd1ff', Earth: '#c8aa6e', Air: '#b9e8ff',
  Hextech: '#6bd0ff', Chemtech: '#8aff7a', Elder: '#7fd4ff',
};
const DRAGON_ES: Record<string, string> = {
  Fire: 'DRAGÓN INFERNAL', Water: 'DRAGÓN DEL OCÉANO', Earth: 'DRAGÓN DE MONTAÑA',
  Air: 'DRAGÓN DE LAS NUBES', Hextech: 'DRAGÓN HEXTECH', Chemtech: 'DRAGÓN QUÍMICO',
  Elder: 'DRAGÓN ANCIANO',
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
const POS_TAG: Record<string, string> = {
  TOP: 'TOP', JUNGLE: 'JG', MIDDLE: 'MID', BOTTOM: 'ADC', UTILITY: 'SUP',
};

interface ObjectiveBanner {
  key: number; icon: string; title: string;
  teamName: string; teamColor: string; glow: string;
}

export default function BroadcastOverlayPage() {
  const { channel } = useParams<{ channel: string }>();
  const [params] = useSearchParams();
  const debugBg = params.get('bg') === '1';
  const { data: champs } = useChampions();
  const version = (champs as any)?.version || '14.1.1';

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
    enabled: !!channel,
    refetchInterval: 2000,
    retry: false,
    queryFn: async () => {
      const { data, status } = await axiosInstance.get(`/api/live-feed/${channel}`, { validateStatus: (s) => s < 500 });
      return status === 200 && data?.ok ? data : null;
    },
  });
  const feed = feedQ.data ?? null;
  const accent: string = feed?.accent || '';

  // ── Banner animado de objetivos (solo eventos NUEVOS entre snapshots) ─────
  const [banner, setBanner] = useState<ObjectiveBanner | null>(null);
  const seenEvents = useRef<Set<number>>(new Set());
  const firstSnap = useRef(true);
  const bannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const events: FeedEvent[] = feed?.events || [];
    if (!events.length) return;
    if (firstSnap.current) {
      events.forEach((e) => seenEvents.current.add(e.id));
      firstSnap.current = false;
      return;
    }

    const players: FeedPlayer[] = feed?.players || [];
    const sideOf = (killer: string): 'ORDER' | 'CHAOS' | null => {
      const n = norm(shortName(killer));
      const hit = players.find((p) => norm(shortName(p.riotId)) === n);
      return hit?.team ?? null;
    };
    const teamNameOf = (side: 'ORDER' | 'CHAOS' | null) =>
      side === 'CHAOS' ? (feed?.team2 || 'ROJO') : (feed?.team1 || 'AZUL');
    const teamColorOf = (side: 'ORDER' | 'CHAOS' | null) =>
      side === 'CHAOS' ? LQC.pink : LQC.cyan;

    for (const e of events) {
      if (seenEvents.current.has(e.id)) continue;
      seenEvents.current.add(e.id);

      let next: ObjectiveBanner | null = null;
      const side = sideOf(e.killer);
      if (e.name === 'DragonKill') {
        const type = e.extra || 'Fire';
        next = {
          key: e.id, icon: DRAGON_ICON[type] ?? ICON.dragon, title: DRAGON_ES[type] ?? 'DRAGÓN',
          teamName: teamNameOf(side), teamColor: teamColorOf(side), glow: DRAGON_GLOW[type] ?? '#ff6b3d',
        };
      } else if (e.name === 'BaronKill') {
        next = {
          key: e.id, icon: ICON.baron, title: 'BARÓN NASHOR',
          teamName: teamNameOf(side), teamColor: teamColorOf(side), glow: '#b06bff',
        };
      } else if (e.name === 'HeraldKill') {
        next = {
          key: e.id, icon: ICON.herald, title: 'HERALDO DE LA GRIETA',
          teamName: teamNameOf(side), teamColor: teamColorOf(side), glow: '#9fb4d8',
        };
      }

      if (next) {
        if (bannerTimer.current) clearTimeout(bannerTimer.current);
        setBanner(next);
        bannerTimer.current = setTimeout(() => setBanner(null), 5000);
      }
    }
  }, [feed]);

  useEffect(() => () => { if (bannerTimer.current) clearTimeout(bannerTimer.current); }, []);

  const champIcon = useMemo(() => {
    const map: Record<string, string> = {};
    for (const e of Object.values<any>((champs as any)?.byId || {})) {
      const url = `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-icons/${e.key}.png`;
      map[norm(e.name)] = url;
      map[norm(e.id)] = url;
    }
    return (name: string) => map[norm(name)] || '';
  }, [champs]);

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

    // ── Matchups por línea (top vs top…); fallback por índice (ARAM) ──────
    const byPos = (list: FeedPlayer[]) => {
      const m = new Map<string, FeedPlayer>();
      list.forEach((p) => { if (POS_ORDER.includes(p.position) && !m.has(p.position)) m.set(p.position, p); });
      return m;
    };
    const oPos = byPos(order), cPos = byPos(chaos);
    const canPair = POS_ORDER.every((pos) => oPos.has(pos)) && POS_ORDER.every((pos) => cPos.has(pos));
    const matchups: Array<{ pos: string; blue: FeedPlayer | null; red: FeedPlayer | null }> = canPair
      ? POS_ORDER.map((pos) => ({ pos: POS_TAG[pos], blue: oPos.get(pos) ?? null, red: cPos.get(pos) ?? null }))
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
      <div style={{ width: '100vw', height: '100vh', background: '#222', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT }}>
        Overlay {channel}: esperando transmisión del companion…
      </div>
    ) : null;
  }

  const d = derived;
  const itemIcon = (id: number) => `https://ddragon.leagueoflegends.com/cdn/${version}/img/item/${id}.png`;
  const goldTotal = Math.max(1, d.goldOrder + d.goldChaos);
  const goldDiff = d.goldOrder - d.goldChaos;
  const bluePct = (d.goldOrder / goldTotal) * 100;
  const accentTop = accent || LQC.blue;

  const Img = ({ src, size, alt = '' }: { src: string; size: number; alt?: string }) => (
    <img src={src} alt={alt} width={size} height={size}
      style={{ display: 'block', objectFit: 'contain' }}
      onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }} />
  );

  // ── Bloque de equipo (barra superior) ──────────────────────────────────────
  const TeamBlock = ({ side }: { side: 'left' | 'right' }) => {
    const isLeft = side === 'left';
    const name = isLeft ? d.team1 : d.team2;
    const logo = isLeft ? d.logo1 : d.logo2;
    const towers = isLeft ? d.towersOrder : d.towersChaos;
    const gold = isLeft ? d.goldOrder : d.goldChaos;
    const color = isLeft ? LQC.cyan : LQC.pink;
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14, flexDirection: isLeft ? 'row' : 'row-reverse',
        background: isLeft
          ? `linear-gradient(90deg, ${LQC.navy} 0%, ${LQC.blueDeep} 55%, rgba(0,102,255,0.55) 100%)`
          : `linear-gradient(270deg, ${LQC.navy} 0%, ${LQC.pinkDeep} 55%, rgba(255,35,87,0.5) 100%)`,
        padding: '0 20px', height: 62, minWidth: 330,
        borderBottom: `3px solid ${color}`,
        boxShadow: `inset 0 -12px 24px -14px ${color}88`,
      }}>
        {logo ? (
          <img src={logo} alt="" style={{ width: 42, height: 42, objectFit: 'contain' }} />
        ) : (
          <span style={{ width: 42, height: 42, borderRadius: 8, background: `${color}22`, border: `1.5px solid ${color}66`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color, fontSize: 20, fontFamily: FONT }}>
            {name.slice(0, 1)}
          </span>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: isLeft ? 'flex-start' : 'flex-end', lineHeight: 1 }}>
          <span style={{ fontWeight: 800, fontSize: 25, color: '#fff', letterSpacing: 1.5, fontFamily: FONT }}>{name}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4, color: LQC.gold, fontSize: 15, fontWeight: 700, fontFamily: FONT }}>
            {/* moneda simple (svg inline, sin emoji) */}
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden><circle cx="6" cy="6" r="5" fill="none" stroke={LQC.gold} strokeWidth="1.6" /><circle cx="6" cy="6" r="2" fill={LQC.gold} /></svg>
            {kFmt(gold)}
          </span>
        </div>
        <span style={{
          display: 'flex', alignItems: 'center', gap: 6,
          marginLeft: isLeft ? 'auto' : 0, marginRight: isLeft ? 0 : 'auto',
          color: '#fff', fontSize: 17, fontWeight: 800, fontFamily: FONT,
        }}>
          <Img src={ICON.tower} size={20} />
          {towers}
        </span>
      </div>
    );
  };

  const DragonRow = ({ list, align }: { list: string[]; align: 'left' | 'right' }) => (
    <div style={{ display: 'flex', gap: 4, justifyContent: align === 'left' ? 'flex-start' : 'flex-end', minWidth: 150 }}>
      {list.map((type, i) => (
        <span key={i} title={type} style={{
          width: 26, height: 26, borderRadius: '50%', background: LQC.deep,
          border: `1.5px solid ${DRAGON_GLOW[type] ?? '#888'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 2,
        }}>
          <Img src={DRAGON_ICON[type] ?? ICON.dragon} size={18} />
        </span>
      ))}
    </div>
  );

  const timerChip = (iconSrc: string, label: string, secs: number | null, glow: string) => {
    if (secs == null) return null;
    const live = secs <= 0;
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 8, padding: '4px 14px', borderRadius: 999,
        background: LQC.deep, border: `1.5px solid ${live ? glow : `${glow}55`}`,
        color: live ? glow : '#fff', fontWeight: 700, fontSize: 15, fontFamily: FONT,
        boxShadow: live ? `0 0 16px ${glow}77` : 'none',
      }}>
        <Img src={iconSrc} size={18} />
        {label} <b style={{ fontFamily: 'monospace' }}>{live ? 'VIVO' : fmt(secs)}</b>
      </span>
    );
  };

  // ── Fila de matchup (scoreboard inferior) ──────────────────────────────────
  const MatchupRow = ({ m }: { m: (typeof d.matchups)[number] }) => {
    const gB = m.blue ? d.goldOf.get(m.blue.riotId) || 0 : 0;
    const gR = m.red ? d.goldOf.get(m.red.riotId) || 0 : 0;
    const total = Math.max(1, gB + gR);
    const pctB = (gB / total) * 100;
    const diff = gB - gR;
    const leader = diff >= 0 ? 'blue' : 'red';

    const PlayerCell = ({ p, side }: { p: FeedPlayer | null; side: 'left' | 'right' }) => {
      if (!p) return <div style={{ flex: 1 }} />;
      const isLeft = side === 'left';
      const icon = champIcon(p.championName);
      const winning = (isLeft && leader === 'blue') || (!isLeft && leader === 'red');
      return (
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', gap: 8,
          flexDirection: isLeft ? 'row' : 'row-reverse', minWidth: 0,
        }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            {icon
              ? <img src={icon} alt="" style={{ width: 32, height: 32, borderRadius: 6, filter: p.isDead ? 'grayscale(1) brightness(0.55)' : 'none', border: `1.5px solid ${winning ? (isLeft ? LQC.cyan : LQC.pink) : 'rgba(255,255,255,0.15)'}` }} />
              : <span style={{ width: 32, height: 32, borderRadius: 6, background: '#123', display: 'inline-block' }} />}
            <span style={{ position: 'absolute', bottom: -4, [isLeft ? 'left' : 'right']: -4, fontSize: 9.5, fontWeight: 800, background: LQC.navy, color: p.isDead ? LQC.pink : LQC.cyan, borderRadius: 4, padding: '0 3px', fontFamily: FONT } as any}>
              {p.isDead && p.respawnTimer > 0 ? Math.ceil(p.respawnTimer) : p.level}
            </span>
          </div>
          <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: isLeft ? 'flex-start' : 'flex-end', lineHeight: 1.15 }}>
            <span style={{ maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 700, fontSize: 13.5, color: p.isDead ? 'rgba(255,255,255,0.45)' : '#fff', fontFamily: FONT }}>
              {shortName(p.riotId) || p.championName}
            </span>
            <span style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.5)', fontFamily: FONT }}>
              {p.creepScore} CS · <span style={{ color: LQC.gold }}>{kFmt(gB && isLeft ? gB : gR)}</span>
            </span>
          </div>
          <span style={{ width: 64, fontWeight: 800, fontSize: 14.5, color: '#fff', textAlign: 'center', fontFamily: FONT, flexShrink: 0 }}>
            {p.kills}/<span style={{ color: LQC.pink }}>{p.deaths}</span>/{p.assists}
          </span>
          <div style={{ display: 'flex', gap: 2, flexDirection: isLeft ? 'row' : 'row-reverse', flexShrink: 0 }}>
            {Array.from({ length: 6 }).map((_, i) => {
              const id = p.items[i];
              return id ? (
                <img key={i} src={itemIcon(id)} alt="" style={{ width: 21, height: 21, borderRadius: 3, background: '#000' }}
                  onError={(e) => { (e.target as HTMLImageElement).style.visibility = 'hidden'; }} />
              ) : (
                <span key={i} style={{ width: 21, height: 21, borderRadius: 3, background: 'rgba(255,255,255,0.06)', display: 'inline-block' }} />
              );
            })}
          </div>
        </div>
      );
    };

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, height: 42, padding: '0 10px' }}>
        <PlayerCell p={m.blue} side="left" />
        {/* Centro: línea + mini gráfica de diferencia de oro del matchup */}
        <div style={{ width: 118, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
          <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: 2, color: 'rgba(255,255,255,0.55)', fontFamily: FONT }}>
            {m.pos || 'VS'}
            <b style={{ marginLeft: 5, color: diff >= 0 ? LQC.cyan : LQC.pink }}>
              {diff === 0 ? '' : `${diff > 0 ? '+' : '−'}${kFmt(Math.abs(diff))}`}
            </b>
          </span>
          <div style={{ position: 'relative', width: '100%', height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.10)', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pctB}%`, background: `linear-gradient(90deg, ${LQC.blue}, ${LQC.cyan})` }} />
            <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: `${100 - pctB}%`, background: `linear-gradient(270deg, #c9184a, ${LQC.pink})` }} />
            <div style={{ position: 'absolute', top: -1, bottom: -1, left: '50%', width: 1.5, background: 'rgba(255,255,255,0.85)' }} />
          </div>
        </div>
        <PlayerCell p={m.red} side="right" />
      </div>
    );
  };

  return (
    <div style={{
      width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden',
      fontFamily: FONT, background: debugBg ? '#1c2530' : 'transparent',
    }}>
      {/* ── Barra superior ── */}
      <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'stretch', filter: 'drop-shadow(0 6px 18px rgba(0,0,0,0.55))' }}>
        <TeamBlock side="left" />
        <div style={{
          display: 'flex', alignItems: 'center', gap: 18, padding: '0 24px', height: 62,
          background: `linear-gradient(180deg, ${LQC.navy}, #000a1f)`, borderBottom: `3px solid ${accentTop}`,
        }}>
          <span style={{ fontSize: 38, fontWeight: 800, color: LQC.cyan, fontFamily: FONT, textShadow: `0 0 18px ${LQC.cyan}55` }}>{d.killsOrder}</span>
          <img src="/lqc-logo.png" alt="LQC" style={{ height: 44, objectFit: 'contain' }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          <span style={{ fontSize: 38, fontWeight: 800, color: LQC.pink, fontFamily: FONT, textShadow: `0 0 18px ${LQC.pink}55` }}>{d.killsChaos}</span>
        </div>
        <TeamBlock side="right" />
      </div>

      {/* ── Gráfica de diferencia de oro por equipo ── */}
      <div style={{ position: 'absolute', top: 66, left: '50%', transform: 'translateX(-50%)', width: 560 }}>
        <div style={{ position: 'relative', height: 8, borderRadius: 4, overflow: 'hidden', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.12)' }}>
          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${bluePct}%`, background: `linear-gradient(90deg, ${LQC.blue}, ${LQC.cyan})`, transition: 'width 1s ease' }} />
          <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: `${100 - bluePct}%`, background: `linear-gradient(270deg, #c9184a, ${LQC.pink})`, transition: 'width 1s ease' }} />
          <div style={{ position: 'absolute', top: -2, bottom: -2, left: '50%', width: 2, background: 'rgba(255,255,255,0.9)' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 3 }}>
          <span style={{
            fontSize: 13, fontWeight: 800, fontFamily: FONT, letterSpacing: 1,
            color: goldDiff >= 0 ? LQC.cyan : LQC.pink,
            background: LQC.deep, borderRadius: 999, padding: '1px 12px', border: '1px solid rgba(255,255,255,0.12)',
          }}>
            ORO {goldDiff >= 0 ? '+' : '−'}{kFmt(Math.abs(goldDiff))}
          </span>
        </div>
      </div>

      {/* ── Banner animado de objetivo ── */}
      <AnimatePresence>
        {banner && (
          <motion.div
            key={banner.key}
            initial={{ opacity: 0, y: -34, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 320, damping: 24 } }}
            exit={{ opacity: 0, y: -22, scale: 0.94, transition: { duration: 0.28 } }}
            style={{
              position: 'absolute', top: 168, left: '50%', translateX: '-50%',
              display: 'flex', alignItems: 'center', gap: 14, padding: '10px 26px',
              background: LQC.deep, borderRadius: 14,
              border: `2px solid ${accent || banner.glow}`,
              boxShadow: `0 0 34px ${banner.glow}66, 0 12px 40px rgba(0,0,0,0.5)`,
              pointerEvents: 'none',
            }}
          >
            <motion.span
              style={{ display: 'inline-flex' }}
              animate={{ scale: [1, 1.18, 1] }}
              transition={{ duration: 0.9, repeat: 3, ease: 'easeInOut' }}
            >
              <Img src={banner.icon} size={44} />
            </motion.span>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontWeight: 800, fontSize: 22, letterSpacing: 2, color: '#fff', lineHeight: 1.05 }}>
                {banner.title}
              </div>
              <div style={{ fontWeight: 700, fontSize: 14, letterSpacing: 1.5, color: banner.teamColor }}>
                {banner.teamName.toUpperCase()}
              </div>
            </div>
            <motion.div aria-hidden style={{ position: 'absolute', inset: 0, borderRadius: 14, overflow: 'hidden', pointerEvents: 'none' }}>
              <motion.div
                style={{ position: 'absolute', top: 0, bottom: 0, width: 70, background: 'linear-gradient(105deg, transparent, rgba(255,255,255,0.22), transparent)' }}
                initial={{ left: '-20%' }}
                animate={{ left: '110%' }}
                transition={{ duration: 1.1, delay: 0.15, ease: 'easeInOut' }}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Fila bajo la barra: reloj siempre; dragones/timers solo en la Grieta ── */}
      <div style={{ position: 'absolute', top: 96, left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 18 }}>
        {d.isRift && <DragonRow list={d.dragonsOrder} align="right" />}
        <span style={{ padding: '3px 14px', borderRadius: 999, background: LQC.deep, color: '#fff', fontFamily: 'monospace', fontWeight: 700, fontSize: 17, border: '1px solid rgba(255,255,255,0.15)' }}>
          {fmt(d.gameTime)}
        </span>
        {d.isRift && <DragonRow list={d.dragonsChaos} align="left" />}
      </div>
      {d.isRift && (
        <div style={{ position: 'absolute', top: 134, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 10 }}>
          {timerChip(ICON.dragon, 'DRAGÓN', d.nextDragon, DRAGON_GLOW.Water)}
          {d.nextHerald != null
            ? timerChip(ICON.herald, 'HERALDO', d.nextHerald, '#9fb4d8')
            : timerChip(ICON.baron, 'BARÓN', d.nextBaron, '#b06bff')}
          {(d.baronsOrder > 0 || d.baronsChaos > 0) && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 999, background: LQC.deep, border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: 700, fontFamily: FONT }}>
              <Img src={ICON.baron} size={16} /> {d.baronsOrder} - {d.baronsChaos}
            </span>
          )}
        </div>
      )}

      {/* ── Scoreboard inferior: MATCHUPS por línea ── */}
      <div style={{
        position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        background: LQC.deep, borderTop: `3px solid ${accent || LQC.blue}`, borderRadius: '14px 14px 0 0',
        padding: '8px 14px 10px', minWidth: 1180,
        boxShadow: '0 -10px 34px rgba(0,0,0,0.55)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginBottom: 5 }}>
          <span style={{ height: 1, width: 120, background: `linear-gradient(90deg, transparent, ${LQC.cyan}88)` }} />
          <span style={{ fontSize: 12.5, letterSpacing: 3.5, color: LQC.cyan, fontWeight: 800, fontFamily: FONT }}>
            {(feed.matchLabel || `LQC · ${String(channel).toUpperCase()}`).toUpperCase()}
          </span>
          <span style={{ height: 1, width: 120, background: `linear-gradient(270deg, transparent, ${LQC.pink}88)` }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {d.matchups.map((m, i) => (
            <div key={i} style={{ borderTop: i > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
              <MatchupRow m={m} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
