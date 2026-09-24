// src/components/MatchReplay2D.tsx
// Repetición 2D de una partida terminada, 100% API oficial: Match-V5 Timeline
// (posición de los 10 jugadores una vez por minuto, más cada asesinato y
// objetivo con su coordenada y su segundo exacto).
//
// Qué cambió respecto a la primera versión y por qué:
//  - Mapa. Usaba el minimapa de DDragon 6.8.1, de 2016, con un terreno que ya
//    no existe. Ahora es el actual de CommunityDragon, que trae la jungla
//    transparente: la teñimos oscura y los campeones resaltan encima.
//  - Movimiento. Entre dos snapshots de un minuto cada campeón iba en línea
//    recta, atravesando paredes. Ahora cada asesinato añade puntos de paso
//    para asesino, víctima y asistentes, con su posición real en ese segundo:
//    en las peleas se ve a la gente llegar al sitio correcto.
//  - Muertes. Un campeón muerto seguía deslizándose por el mapa. Ahora
//    desaparece durante su tiempo de reaparición, queda una marca donde cayó
//    y vuelve a salir desde su base.
//  - Iconos. Los emojis se veían distinto en cada sistema y no llevaban el
//    color del equipo. Ahora son iconos SVG en una ficha del color de quien
//    se llevó el objetivo.
//  - Equipos. Se deducían del número de participante (1-5 azul). Ahora salen
//    del teamId real del match.
//  - Móvil. La cuadrícula de dos columnas aplastaba el panel lateral; ahora
//    se apila por debajo de 860px.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { axiosInstance } from '@/lib/axios';
import {
  Bug, Castle, Crown, Eye, Film, Flame, Gem, Pause, Play, RotateCcw,
  SkipBack, SkipForward, Skull, Swords, X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import './MatchReplay2D.css';

interface RosterEntry {
  puuid?: string;
  championId?: number;
  championName?: string;
  teamId?: number;
  summonerName?: string;
}

interface Props {
  regional?: string;
  matchId?: string;
  roster: RosterEntry[];
  queueId?: number;
  /** Jugador buscado: se dibuja encima y con aro dorado. */
  highlightPuuid?: string;
}

interface ReplayFramePlayer { x: number | null; y: number | null; g: number; l: number }
interface ReplayFrame { t: number; p: Record<string, ReplayFramePlayer> }
interface ReplayEvent {
  t: number; type: string; x?: number; y?: number;
  k?: number; v?: number; a?: number[]; teamId?: number; kt?: number; sub?: string;
}

type Team = 100 | 200;
const TEAM_COLOR: Record<Team, string> = { 100: '#3b82f6', 200: '#e1242e' };

// Límites reales de coordenadas por mapa (los de Riot, con su mínimo
// negativo; asumir 0 desplazaba todo ~1% hacia la esquina).
const MAPS: Record<number, {
  img: string; min: { x: number; y: number }; max: { x: number; y: number };
  fountain: Record<Team, { x: number; y: number }>;
}> = {
  11: {
    img: 'https://raw.communitydragon.org/latest/game/assets/maps/info/map11/2dlevelminimap_base_baron1.png',
    min: { x: -120, y: -120 }, max: { x: 14870, y: 14980 },
    fountain: { 100: { x: 394, y: 461 }, 200: { x: 14340, y: 14391 } },
  },
  12: {
    img: 'https://raw.communitydragon.org/latest/game/assets/maps/info/map12/2dlevelminimap.png',
    min: { x: -28, y: -19 }, max: { x: 12849, y: 12858 },
    fountain: { 100: { x: 1050, y: 1050 }, 200: { x: 11750, y: 11750 } },
  },
};
const ARAM_QUEUES = new Set([450, 2400]);

// Tiempo de reaparición base por nivel (1-18), en segundos. No incluye el
// recargo que Riot suma pasados los 15 minutos, así que en partidas largas
// reaparecen un poco antes de lo real. Es una aproximación honesta: el
// timeline no trae el momento exacto de reaparición.
const RESPAWN = [10, 10, 12, 12, 14, 16, 20, 25, 28, 32.5, 35, 37.5, 40, 42.5, 45, 47.5, 50, 52.5];

/** Cuánto tiempo sigue visible un evento en el mapa. */
const EVENT_TTL = 12;

const champIcon = (id?: number) =>
  id ? `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-icons/${id}.png` : '';

const DRAGON_LABEL: Record<string, string> = {
  FIRE_DRAGON: 'Dragón infernal', WATER_DRAGON: 'Dragón oceánico', EARTH_DRAGON: 'Dragón de montaña',
  AIR_DRAGON: 'Dragón de nube', HEXTECH_DRAGON: 'Dragón hextech', CHEMTECH_DRAGON: 'Dragón quimtech',
  ELDER_DRAGON: 'Dragón ancestral',
};

const EVENT_META: Record<string, { Icon: LucideIcon; label: string }> = {
  kill: { Icon: Swords, label: 'Asesinato' },
  tower: { Icon: Castle, label: 'Torre' },
  inhib: { Icon: Gem, label: 'Inhibidor' },
  dragon: { Icon: Flame, label: 'Dragón' },
  baron: { Icon: Crown, label: 'Barón Nashor' },
  herald: { Icon: Eye, label: 'Heraldo' },
  grubs: { Icon: Bug, label: 'Larvas del Vacío' },
  monster: { Icon: Skull, label: 'Atakhan' },
};
const metaOf = (type: string) => EVENT_META[type] ?? { Icon: Skull, label: 'Objetivo' };

const SPEEDS = [8, 16, 32, 64];

const fmt = (s: number) => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;

interface WP { t: number; x: number; y: number }
interface Death { t0: number; t1: number; x: number; y: number }

/** Último índice i con arr[i].t <= t (búsqueda binaria). -1 si ninguno. */
function lastAtOrBefore<T extends { t: number }>(arr: T[], t: number) {
  let lo = 0, hi = arr.length - 1, ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid].t <= t) { ans = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return ans;
}

export default function MatchReplay2D({ regional, matchId, roster, queueId, highlightPuuid }: Props) {
  const mapId = ARAM_QUEUES.has(queueId ?? -1) ? 12 : 11;
  const map = MAPS[mapId];

  const replayQ = useQuery({
    queryKey: ['match-replay', regional, matchId],
    enabled: Boolean(regional && matchId && roster.length > 0),
    staleTime: Infinity, // una partida terminada es inmutable
    retry: 1,
    queryFn: async () => {
      const { data } = await axiosInstance.get(`/api/stats/match-replay/${regional}/${matchId}`);
      return data as { participants: Array<{ participantId: number; puuid: string }>; frames: ReplayFrame[]; events: ReplayEvent[] };
    },
  });
  const replay = replayQ.data ?? null;
  const frames = useMemo(() => replay?.frames ?? [], [replay]);
  const events = useMemo(() => [...(replay?.events ?? [])].sort((a, b) => a.t - b.t), [replay]);
  const maxT = frames.length ? frames[frames.length - 1].t : 0;

  // participantId (1-10) → campeón/equipo/nombre (cruce timeline ↔ match).
  const pidMap = useMemo(() => {
    const byPuuid = new Map(roster.map((r) => [r.puuid, r]));
    const m: Record<number, RosterEntry & { team: Team }> = {};
    for (const p of replay?.participants ?? []) {
      const r = byPuuid.get(p.puuid) ?? {};
      const team: Team = r.teamId === 200 ? 200 : r.teamId === 100 ? 100 : (p.participantId <= 5 ? 100 : 200);
      m[p.participantId] = { ...r, team };
    }
    return m;
  }, [replay, roster]);

  const teamOfPid = useCallback((pid?: number): Team | null =>
    (pid && pidMap[pid] ? pidMap[pid].team : null), [pidMap]);

  // ── Trayectorias: snapshots + puntos de paso de cada pelea + muertes ──────
  const tracks = useMemo(() => {
    const out: Record<number, { wps: WP[]; deaths: Death[] }> = {};
    const ensure = (pid: number) => (out[pid] ??= { wps: [], deaths: [] });

    for (const f of frames) {
      for (const [pidStr, pf] of Object.entries(f.p)) {
        if (pf.x == null || pf.y == null) continue;
        ensure(Number(pidStr)).wps.push({ t: f.t, x: pf.x, y: pf.y });
      }
    }

    const levelAt = (pid: number, t: number) => {
      const i = lastAtOrBefore(frames, t);
      return frames[Math.max(0, i)]?.p[String(pid)]?.l ?? 1;
    };

    for (const e of events) {
      if (e.type !== 'kill' || e.x == null || e.y == null) continue;
      const at = { t: e.t, x: e.x, y: e.y };
      for (const pid of [e.k, e.v, ...(e.a ?? [])]) if (pid) ensure(pid).wps.push(at);
      if (e.v) {
        const lvl = Math.min(18, Math.max(1, levelAt(e.v, e.t)));
        const dur = RESPAWN[lvl - 1] * (mapId === 12 ? 0.75 : 1);
        ensure(e.v).deaths.push({ t0: e.t, t1: e.t + dur, x: e.x, y: e.y });
      }
    }

    for (const [pidStr, tr] of Object.entries(out)) {
      const team = teamOfPid(Number(pidStr)) ?? 100;
      // Mientras está muerto no hay trayectoria: los snapshots de ese tramo
      // lo pondrían deslizándose. Al reaparecer sale de su base.
      tr.wps = tr.wps.filter((w) => !tr.deaths.some((d) => w.t > d.t0 && w.t < d.t1));
      for (const d of tr.deaths) tr.wps.push({ t: d.t1, ...map.fountain[team] });
      tr.wps.sort((a, b) => a.t - b.t);
    }
    return out;
  }, [frames, events, map, mapId, teamOfPid]);

  // ── Reloj de reproducción ──────────────────────────────────────────────────
  // `?rt=segundos` abre la repetición en ese momento: permite compartir el
  // enlace a una pelea concreta en vez de "adelántalo al minuto 14".
  const [t, setT] = useState(() => {
    if (typeof window === 'undefined') return 0;
    const v = Number(new URLSearchParams(window.location.search).get('rt'));
    return Number.isFinite(v) && v > 0 ? v : 0;
  });
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(32); // segundos de juego por segundo real
  const raf = useRef<number>(0);
  const last = useRef<number>(0);

  useEffect(() => {
    if (!playing) return;
    last.current = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last.current) / 1000); // evita saltos al volver de otra pestaña
      last.current = now;
      setT((prev) => {
        const next = prev + dt * speed;
        if (next >= maxT) { setPlaying(false); return maxT; }
        return next;
      });
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [playing, speed, maxT]);

  const seek = useCallback((v: number) => setT(Math.max(0, Math.min(maxT, v))), [maxT]);
  const toggle = useCallback(() => {
    if (t >= maxT) setT(0);
    setPlaying((p) => !p);
  }, [t, maxT]);

  // ── Estado en el instante t ────────────────────────────────────────────────
  const players = useMemo(() => {
    const out: Array<{ pid: number; x: number; y: number; dead: boolean }> = [];
    for (const [pidStr, tr] of Object.entries(tracks)) {
      const pid = Number(pidStr);
      const death = tr.deaths.find((d) => t >= d.t0 && t < d.t1);
      if (death) { out.push({ pid, x: death.x, y: death.y, dead: true }); continue; }
      const i = lastAtOrBefore(tr.wps, t);
      if (i < 0) continue;
      const a = tr.wps[i];
      const b = tr.wps[Math.min(i + 1, tr.wps.length - 1)];
      const k = b.t > a.t ? Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t))) : 0;
      out.push({ pid, x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, dead: false });
    }
    // El jugador buscado se pinta el último para quedar encima.
    return out.sort((p, q) =>
      Number(pidMap[p.pid]?.puuid === highlightPuuid) - Number(pidMap[q.pid]?.puuid === highlightPuuid));
  }, [tracks, t, pidMap, highlightPuuid]);

  // Oro por equipo, interpolado entre snapshots para que la barra no salte.
  const gold = useMemo(() => {
    if (!frames.length) return { blue: 0, red: 0 };
    const i = Math.max(0, lastAtOrBefore(frames, t));
    const a = frames[i], b = frames[Math.min(i + 1, frames.length - 1)];
    const k = b.t > a.t ? Math.min(1, (t - a.t) / (b.t - a.t)) : 0;
    let blue = 0, red = 0;
    for (const pid of Object.keys(a.p)) {
      const g = a.p[pid].g + ((b.p[pid]?.g ?? a.p[pid].g) - a.p[pid].g) * k;
      if (teamOfPid(Number(pid)) === 200) red += g; else blue += g;
    }
    return { blue, red };
  }, [frames, t, teamOfPid]);

  /** Equipo que se llevó el evento (el asesino, o quien tiró la estructura). */
  const takerOf = useCallback((e: ReplayEvent): Team | null => {
    if (e.type === 'kill') {
      const victim = teamOfPid(e.v);
      return victim ? (victim === 100 ? 200 : 100) : teamOfPid(e.k);
    }
    if (e.type === 'tower' || e.type === 'inhib') {
      // teamId de Riot es el equipo que PERDIÓ la estructura.
      return e.teamId === 100 ? 200 : e.teamId === 200 ? 100 : null;
    }
    if (e.kt === 100 || e.kt === 200) return e.kt;
    return teamOfPid(e.k);
  }, [teamOfPid]);

  // Marcador y objetivos acumulados hasta t.
  const score = useMemo(() => {
    const s = { 100: { kills: 0, towers: 0, dragons: 0, barons: 0 }, 200: { kills: 0, towers: 0, dragons: 0, barons: 0 } };
    const end = lastAtOrBefore(events, t);
    for (let i = 0; i <= end; i++) {
      const e = events[i];
      const team = takerOf(e);
      if (!team) continue;
      if (e.type === 'kill') s[team].kills++;
      else if (e.type === 'tower') s[team].towers++;
      else if (e.type === 'dragon') s[team].dragons++;
      else if (e.type === 'baron') s[team].barons++;
    }
    return s;
  }, [events, t, takerOf]);

  const onMap = useMemo(() => {
    const end = lastAtOrBefore(events, t);
    const out: ReplayEvent[] = [];
    for (let i = end; i >= 0 && t - events[i].t < EVENT_TTL; i--) {
      if (events[i].x != null && events[i].y != null) out.push(events[i]);
    }
    return out;
  }, [events, t]);

  const feed = useMemo(() => {
    const end = lastAtOrBefore(events, t);
    return events.slice(Math.max(0, end - 5), end + 1).reverse();
  }, [events, t]);

  // Marcas del scrubber: dónde pasó algo, para saltar directo a las peleas.
  const ticks = useMemo(() => events.map((e) => ({
    left: maxT ? (e.t / maxT) * 100 : 0,
    big: e.type !== 'kill',
    color: TEAM_COLOR[takerOf(e) ?? 100],
    t: e.t,
  })), [events, maxT, takerOf]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === ' ' || e.key === 'k') { e.preventDefault(); toggle(); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); seek(t + 10); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); seek(t - 10); }
  };

  if (!regional || !matchId || !roster.length) return null;

  const pos = (x: number, y: number) => ({
    left: `${((x - map.min.x) / (map.max.x - map.min.x)) * 100}%`,
    top: `${(1 - (y - map.min.y) / (map.max.y - map.min.y)) * 100}%`,
  });

  const nameOf = (pid?: number) => (pid && pidMap[pid]?.summonerName) || (pid ? `Jugador ${pid}` : 'Súbditos');
  const labelOf = (e: ReplayEvent) =>
    e.type === 'dragon' && e.sub ? (DRAGON_LABEL[e.sub] ?? 'Dragón') : metaOf(e.type).label;

  const header = (
    <h2 className="rp-title">
      <span className="rp-title-bar" />
      <Film size={15} /> Repetición 2D
      <span className="rp-title-sub">posiciones oficiales de Riot</span>
    </h2>
  );

  if (replayQ.isError) {
    return (
      <div>
        {header}
        <div className="rp-empty">
          <p>La repetición no está disponible para esta partida. Riot a veces tarda en publicar el timeline.</p>
          <button type="button" className="rp-btn" onClick={() => replayQ.refetch()}>
            <RotateCcw size={14} /> Reintentar
          </button>
        </div>
      </div>
    );
  }

  if (!replay || !frames.length) {
    if (!replayQ.isPending) return null;
    return (
      <div>
        {header}
        <div className="rp-layout">
          <div className="rp-map rp-skeleton" />
          <div className="rp-side"><div className="rp-skel-line" /><div className="rp-skel-line" /><div className="rp-skel-line" /></div>
        </div>
      </div>
    );
  }

  const totalGold = Math.max(1, gold.blue + gold.red);
  const goldDiff = gold.blue - gold.red;

  return (
    <div className="rp-root" tabIndex={0} onKeyDown={onKey}
      aria-label="Repetición 2D. Espacio para reproducir o pausar, flechas para avanzar o retroceder 10 segundos.">
      {header}

      <div className="rp-layout">
        {/* ── Minimapa ── */}
        <div className="rp-map">
          <img className="rp-map-img" src={map.img} alt="" draggable={false} />

          {/* Eventos recientes: debajo de los campeones, nunca tapándolos. */}
          {onMap.map((e) => {
            const team = takerOf(e);
            const color = team ? TEAM_COLOR[team] : 'rgba(255,255,255,0.6)';
            const age = (t - e.t) / EVENT_TTL;
            if (e.type === 'kill') {
              // Marca donde cayó la víctima, en el color de SU equipo.
              const vTeam = teamOfPid(e.v);
              return (
                <span key={`k-${e.t}-${e.v}`} className="rp-death" title={`${nameOf(e.v)} cayó · ${fmt(e.t)}`}
                  style={{ ...pos(e.x!, e.y!), color: vTeam ? TEAM_COLOR[vTeam] : '#fff', opacity: 1 - age * 0.75 }}>
                  <X size={12} strokeWidth={3} />
                </span>
              );
            }
            const { Icon } = metaOf(e.type);
            return (
              <span key={`o-${e.t}-${e.type}`} className="rp-obj" title={`${labelOf(e)} · ${fmt(e.t)}`}
                style={{ ...pos(e.x!, e.y!), borderColor: color, opacity: 1 - age * 0.6 }}>
                <span className="rp-ping" style={{ borderColor: color }} />
                <Icon size={12} />
              </span>
            );
          })}

          {/* Campeones */}
          {players.map((p) => {
            if (p.dead) return null;
            const info = pidMap[p.pid];
            const team = info?.team ?? 100;
            const me = !!highlightPuuid && info?.puuid === highlightPuuid;
            return (
              <span key={p.pid} className="rp-champ" data-me={me ? 'true' : undefined}
                title={`${nameOf(p.pid)}${info?.championName ? ` · ${info.championName}` : ''}`}
                style={{ ...pos(p.x, p.y), borderColor: me ? '#c8aa6e' : TEAM_COLOR[team] }}>
                {info?.championId
                  ? <img src={champIcon(info.championId)} alt="" draggable={false}
                      onError={(ev) => { (ev.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                  : <span className="rp-champ-fallback">{nameOf(p.pid).slice(0, 1)}</span>}
              </span>
            );
          })}

          <div className="rp-clock">{fmt(t)}</div>
        </div>

        {/* ── Panel lateral ── */}
        <div className="rp-side">
          {/* Marcador */}
          <div className="rp-score">
            <div className="rp-score-team" style={{ color: TEAM_COLOR[100] }}>
              <b>{score[100].kills}</b><span>Azul</span>
            </div>
            <div className="rp-score-vs">
              <Swords size={14} />
            </div>
            <div className="rp-score-team rp-score-team--red" style={{ color: TEAM_COLOR[200] }}>
              <b>{score[200].kills}</b><span>Rojo</span>
            </div>
          </div>

          {/* Objetivos */}
          <div className="rp-objs">
            {([['towers', Castle, 'Torres'], ['dragons', Flame, 'Dragones'], ['barons', Crown, 'Barones']] as const).map(([k, Icon, label]) => (
              <div key={k} className="rp-obj-row" title={label}>
                <span className="rp-obj-n" style={{ color: TEAM_COLOR[100] }}>{score[100][k]}</span>
                <span className="rp-obj-label"><Icon size={13} /> {label}</span>
                <span className="rp-obj-n" style={{ color: TEAM_COLOR[200] }}>{score[200][k]}</span>
              </div>
            ))}
          </div>

          {/* Oro */}
          <div>
            <div className="rp-gold-head">
              <span>{(gold.blue / 1000).toFixed(1)}k</span>
              <span className="rp-muted">
                Oro {goldDiff !== 0 && <b>{goldDiff > 0 ? '+' : '−'}{(Math.abs(goldDiff) / 1000).toFixed(1)}k {goldDiff > 0 ? 'azul' : 'rojo'}</b>}
              </span>
              <span>{(gold.red / 1000).toFixed(1)}k</span>
            </div>
            <div className="rp-gold-bar">
              <span style={{ width: `${(gold.blue / totalGold) * 100}%`, background: TEAM_COLOR[100] }} />
              <span style={{ flex: 1, background: TEAM_COLOR[200] }} />
            </div>
          </div>

          {/* Eventos */}
          <div className="rp-feed">
            <div className="rp-feed-title">Eventos</div>
            {feed.length === 0 && <div className="rp-muted rp-small">Aún sin eventos…</div>}
            {feed.map((e) => {
              const { Icon } = metaOf(e.type);
              const team = takerOf(e);
              return (
                <button key={`${e.t}-${e.type}-${e.v ?? e.k ?? ''}`} type="button" className="rp-feed-row"
                  onClick={() => { setPlaying(false); seek(e.t - 3); }} title="Ir a este momento">
                  <span className="rp-feed-time">{fmt(e.t)}</span>
                  <span className="rp-feed-icon" style={{ borderColor: team ? TEAM_COLOR[team] : 'transparent' }}>
                    <Icon size={11} />
                  </span>
                  {e.type === 'kill' ? (
                    <span className="rp-feed-text">
                      <FeedChamp id={pidMap[e.k ?? 0]?.championId} />
                      <b>{nameOf(e.k)}</b>
                      <span className="rp-muted">eliminó a</span>
                      <FeedChamp id={pidMap[e.v ?? 0]?.championId} />
                      <b>{nameOf(e.v)}</b>
                    </span>
                  ) : (
                    <span className="rp-feed-text">
                      <b>{labelOf(e)}</b>
                      {team && <span className="rp-muted">para {team === 100 ? 'azul' : 'rojo'}</span>}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Controles ── */}
      <div className="rp-controls">
        <button type="button" className="rp-icon-btn" onClick={() => seek(t - 30)} aria-label="Retroceder 30 segundos" title="−30 s">
          <SkipBack size={15} />
        </button>
        <button type="button" className="rp-play" onClick={toggle} aria-label={playing ? 'Pausa' : 'Reproducir'}>
          {playing ? <Pause size={17} /> : <Play size={17} style={{ marginLeft: 2 }} />}
        </button>
        <button type="button" className="rp-icon-btn" onClick={() => seek(t + 30)} aria-label="Avanzar 30 segundos" title="+30 s">
          <SkipForward size={15} />
        </button>

        <span className="rp-time">{fmt(t)}</span>

        <div className="rp-scrub">
          <div className="rp-scrub-track">
            <span className="rp-scrub-fill" style={{ width: `${maxT ? (t / maxT) * 100 : 0}%` }} />
            {ticks.map((k, i) => (
              <span key={i} className="rp-tick" data-big={k.big ? 'true' : undefined}
                style={{ left: `${k.left}%`, background: k.color }} />
            ))}
          </div>
          <input type="range" min={0} max={maxT} step={1} value={t} aria-label="Momento de la partida"
            onChange={(e) => { setPlaying(false); seek(Number(e.target.value)); }} />
        </div>

        <span className="rp-time rp-muted">{fmt(maxT)}</span>

        <div className="rp-speeds" role="group" aria-label="Velocidad">
          {SPEEDS.map((s) => (
            <button key={s} type="button" aria-pressed={speed === s} onClick={() => setSpeed(s)}>{s}x</button>
          ))}
        </div>
      </div>

      <div className="rp-legend">
        {(['kill', 'tower', 'inhib', 'dragon', 'herald', 'grubs', 'baron'] as const).map((k) => {
          const { Icon, label } = EVENT_META[k];
          return <span key={k}>{k === 'kill' ? <X size={11} strokeWidth={3} /> : <Icon size={11} />} {k === 'kill' ? 'Caída' : label}</span>;
        })}
        <span className="rp-legend-note">
          Snapshot oficial cada minuto, más la posición exacta de cada asesinato. El resto del trayecto es interpolado.
        </span>
      </div>
    </div>
  );
}

function FeedChamp({ id }: { id?: number }) {
  if (!id) return null;
  return <img className="rp-feed-champ" src={champIcon(id)} alt="" loading="lazy" />;
}
