// src/pages/BroadcastOverlayPage.tsx
// Overlay de caster estilo LCK con branding LQC: /broadcast/:channel/overlay
// Pensado para OBS como Browser Source 1920x1080 sobre la captura del juego:
// fondo TRANSPARENTE, sin navbar. Muestra barra superior (equipos, kills,
// torres, dragones tomados y timer), timers de próximos objetivos calculados
// de los eventos reales (cada DragonKill reinicia el respawn de 5:00; Barón
// nace al 20:00 y renace a los 6:00), y scoreboard inferior con items/KDA/CS.
// Vista previa en navegador normal: agregar ?bg=1 (fondo oscuro de prueba).
// Paleta LQC (extraída de lqc.revolution505.com): azul #0066ff → cyan #00d4ff
// sobre navy #001433, acento #ff2357. Logo: /lqc-logo.png (blanco).
import { useEffect, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { axiosInstance } from '@/lib/axios';
import { useChampions } from '@/hooks/use-ddragon';

const LQC = {
  blue: '#0066ff',
  cyan: '#00d4ff',
  navy: '#001433',
  deep: 'rgba(0, 12, 32, 0.92)',
  pink: '#ff2357',
};
const FONT = "'Saira Condensed', 'Saira', sans-serif";

interface FeedPlayer {
  riotId: string; championName: string; team: 'ORDER' | 'CHAOS';
  level: number; kills: number; deaths: number; assists: number;
  creepScore: number; isDead: boolean; respawnTimer: number; items: number[];
}
interface FeedEvent { id: number; t: number; name: string; killer: string; victim: string; extra: string }

const fmt = (s: number) => `${Math.floor(s / 60)}:${Math.floor(Math.max(0, s) % 60).toString().padStart(2, '0')}`;
const norm = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const shortName = (r: string) => (r.includes('#') ? r.slice(0, r.indexOf('#')) : r);

const DRAGON_STYLE: Record<string, { icon: string; color: string }> = {
  Fire: { icon: '🔥', color: '#ff6b3d' }, Water: { icon: '💧', color: '#4fd1ff' },
  Earth: { icon: '⛰️', color: '#c8aa6e' }, Air: { icon: '🌪️', color: '#b9e8ff' },
  Hextech: { icon: '⚡', color: '#6bd0ff' }, Chemtech: { icon: '🧪', color: '#8aff7a' },
  Elder: { icon: '👑', color: '#7fd4ff' },
};

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

    const t = feed.gameTime || 0;
    // Próximo dragón: primero al 5:00; renace 5:00 después de cada toma.
    const nextDragon = (lastDragonT < 0 ? 300 : lastDragonT + 300) - t;
    // Barón: nace al 20:00; renace 6:00 tras cada toma. Antes: Heraldo (8:00).
    const baronBase = lastBaronT < 0 ? 1200 : lastBaronT + 360;
    const nextBaron = baronBase - t;
    const nextHerald = !heraldTaken && t < 1140 ? 480 - t : null;

    const label: string = feed.matchLabel || '';
    const vs = label.match(/([^:]+?)\s+vs\.?\s+(.+)/i);
    const team1 = (feed.team1 || vs?.[1] || 'AZUL').trim().toUpperCase();
    const team2 = (feed.team2 || vs?.[2] || 'ROJO').trim().toUpperCase();

    return {
      order, chaos, team1, team2,
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

  const TeamBlock = ({ side }: { side: 'left' | 'right' }) => {
    const isLeft = side === 'left';
    const name = isLeft ? d.team1 : d.team2;
    const logo = isLeft ? d.logo1 : d.logo2;
    const towers = isLeft ? d.towersOrder : d.towersChaos;
    const color = isLeft ? LQC.cyan : LQC.pink;
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14, flexDirection: isLeft ? 'row' : 'row-reverse',
        background: isLeft
          ? `linear-gradient(90deg, ${LQC.navy}, rgba(0,102,255,0.35))`
          : `linear-gradient(270deg, ${LQC.navy}, rgba(255,35,87,0.30))`,
        padding: '0 18px', height: 56, minWidth: 300,
        borderBottom: `3px solid ${color}`,
      }}>
        {logo ? (
          <img src={logo} alt="" style={{ width: 38, height: 38, objectFit: 'contain' }} />
        ) : (
          <span style={{ width: 38, height: 38, borderRadius: 8, background: `${color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color, fontSize: 18 }}>
            {name.slice(0, 1)}
          </span>
        )}
        <span style={{ fontWeight: 800, fontSize: 24, color: '#fff', letterSpacing: 1 }}>{name}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5, marginLeft: isLeft ? 'auto' : 0, marginRight: isLeft ? 0 : 'auto', color: 'rgba(255,255,255,0.75)', fontSize: 16 }}>
          🗼 <b style={{ color: '#fff' }}>{towers}</b>
        </span>
      </div>
    );
  };

  const DragonRow = ({ list, align }: { list: string[]; align: 'left' | 'right' }) => (
    <div style={{ display: 'flex', gap: 4, justifyContent: align === 'left' ? 'flex-start' : 'flex-end', minWidth: 140 }}>
      {list.map((type, i) => {
        const s = DRAGON_STYLE[type] || DRAGON_STYLE.Fire;
        return (
          <span key={i} title={type} style={{
            width: 24, height: 24, borderRadius: '50%', background: `${LQC.navy}dd`,
            border: `1.5px solid ${s.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12,
          }}>{s.icon}</span>
        );
      })}
    </div>
  );

  const ScoreRow = ({ p, side }: { p: FeedPlayer; side: 'left' | 'right' }) => {
    const isLeft = side === 'left';
    const icon = champIcon(p.championName);
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, flexDirection: isLeft ? 'row' : 'row-reverse',
        height: 34, padding: '0 8px',
      }}>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          {icon
            ? <img src={icon} alt="" style={{ width: 28, height: 28, borderRadius: 6, filter: p.isDead ? 'grayscale(1) brightness(0.6)' : 'none' }} />
            : <span style={{ width: 28, height: 28, borderRadius: 6, background: '#123', display: 'inline-block' }} />}
          <span style={{ position: 'absolute', bottom: -3, [isLeft ? 'left' : 'right']: -3, fontSize: 9, fontWeight: 800, background: LQC.navy, color: LQC.cyan, borderRadius: 4, padding: '0 3px' } as any}>
            {p.isDead && p.respawnTimer > 0 ? Math.ceil(p.respawnTimer) : p.level}
          </span>
        </div>
        <span style={{ width: 118, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 700, fontSize: 13.5, color: p.isDead ? 'rgba(255,255,255,0.45)' : '#fff', textAlign: isLeft ? 'left' : 'right' }}>
          {shortName(p.riotId) || p.championName}
        </span>
        <span style={{ width: 62, fontWeight: 800, fontSize: 14, color: '#fff', textAlign: 'center', fontFamily: FONT }}>
          {p.kills}/<span style={{ color: LQC.pink }}>{p.deaths}</span>/{p.assists}
        </span>
        <span style={{ width: 34, fontSize: 12, color: 'rgba(255,255,255,0.65)', textAlign: 'center' }}>{p.creepScore}</span>
        <div style={{ display: 'flex', gap: 2, flexDirection: isLeft ? 'row' : 'row-reverse' }}>
          {Array.from({ length: 6 }).map((_, i) => {
            const id = p.items[i];
            return id ? (
              <img key={i} src={itemIcon(id)} alt="" style={{ width: 20, height: 20, borderRadius: 3, background: '#000' }}
                onError={(e) => { (e.target as HTMLImageElement).style.visibility = 'hidden'; }} />
            ) : (
              <span key={i} style={{ width: 20, height: 20, borderRadius: 3, background: 'rgba(255,255,255,0.06)', display: 'inline-block' }} />
            );
          })}
        </div>
      </div>
    );
  };

  const timerChip = (label: string, secs: number | null, alive: string) => {
    if (secs == null) return null;
    const live = secs <= 0;
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 7, padding: '4px 14px', borderRadius: 999,
        background: LQC.deep, border: `1px solid ${live ? LQC.cyan : 'rgba(0,212,255,0.35)'}`,
        color: live ? LQC.cyan : '#fff', fontWeight: 700, fontSize: 15, fontFamily: FONT,
        boxShadow: live ? `0 0 14px rgba(0,212,255,0.45)` : 'none',
      }}>
        {label} <b style={{ fontFamily: 'monospace' }}>{live ? alive : fmt(secs)}</b>
      </span>
    );
  };

  return (
    <div style={{
      width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden',
      fontFamily: FONT, background: debugBg ? '#1c2530' : 'transparent',
    }}>
      {/* ── Barra superior ── */}
      <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'stretch' }}>
        <TeamBlock side="left" />
        <div style={{
          display: 'flex', alignItems: 'center', gap: 16, padding: '0 22px', height: 56,
          background: `linear-gradient(180deg, ${LQC.navy}, #000a1f)`, borderBottom: `3px solid ${LQC.blue}`,
        }}>
          <span style={{ fontSize: 34, fontWeight: 800, color: LQC.cyan, fontFamily: FONT }}>{d.killsOrder}</span>
          <img src="/lqc-logo.png" alt="LQC" style={{ height: 40, objectFit: 'contain' }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          <span style={{ fontSize: 34, fontWeight: 800, color: LQC.pink, fontFamily: FONT }}>{d.killsChaos}</span>
        </div>
        <TeamBlock side="right" />
      </div>

      {/* ── Fila bajo la barra: dragones tomados + reloj + timers de objetivos ── */}
      <div style={{ position: 'absolute', top: 62, left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 18 }}>
        <DragonRow list={d.dragonsOrder} align="right" />
        <span style={{ padding: '3px 14px', borderRadius: 999, background: LQC.deep, color: '#fff', fontFamily: 'monospace', fontWeight: 700, fontSize: 17, border: '1px solid rgba(255,255,255,0.15)' }}>
          {fmt(d.gameTime)}
        </span>
        <DragonRow list={d.dragonsChaos} align="left" />
      </div>
      <div style={{ position: 'absolute', top: 106, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 10 }}>
        {timerChip('🐉 DRAGÓN', d.nextDragon, 'VIVO')}
        {d.nextHerald != null
          ? timerChip('👁️ HERALDO', d.nextHerald, 'VIVO')
          : timerChip('🟣 BARÓN', d.nextBaron, 'VIVO')}
        {(d.baronsOrder > 0 || d.baronsChaos > 0) && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 999, background: LQC.deep, border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>
            🟣 {d.baronsOrder} - {d.baronsChaos}
          </span>
        )}
      </div>

      {/* ── Scoreboard inferior ── */}
      <div style={{
        position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        background: LQC.deep, borderTop: `3px solid ${LQC.blue}`, borderRadius: '14px 14px 0 0',
        padding: '8px 14px 10px', minWidth: 1080,
      }}>
        <div style={{ textAlign: 'center', fontSize: 12, letterSpacing: 3, color: LQC.cyan, fontWeight: 700, marginBottom: 6 }}>
          {(feed.matchLabel || `LQC · ${String(channel).toUpperCase()}`).toUpperCase()}
        </div>
        <div style={{ display: 'flex', gap: 26 }}>
          <div style={{ flex: 1 }}>
            {d.order.map((p, i) => <ScoreRow key={i} p={p} side="left" />)}
          </div>
          <div style={{ width: 2, background: `linear-gradient(180deg, transparent, ${LQC.blue}, transparent)` }} />
          <div style={{ flex: 1 }}>
            {d.chaos.map((p, i) => <ScoreRow key={i} p={p} side="right" />)}
          </div>
        </div>
      </div>
    </div>
  );
}
