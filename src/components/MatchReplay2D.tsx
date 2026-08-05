// src/components/MatchReplay2D.tsx
// Repetición 2D estilo broadcast de una partida terminada, 100% API oficial:
// Match-V5 Timeline (posiciones 1/min de los 10 jugadores, kills y objetivos
// con coordenadas). Dibuja el minimapa real con los iconos de campeón
// moviéndose (interpolación entre frames), marcadores de eventos, killfeed y
// diferencia de oro — con play/pausa, velocidad y scrubbing. Nadie de la
// competencia web tiene esto embebido en el navegador.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { axiosInstance } from '@/lib/axios';
import { Play, Pause, Film } from 'lucide-react';

interface RosterEntry {
  puuid?: string;
  championId?: number;
  teamId?: number;
  summonerName?: string;
}

interface Props {
  regional?: string;
  matchId?: string;
  roster: RosterEntry[];
  queueId?: number;
}

interface ReplayFramePlayer { x: number | null; y: number | null; g: number; l: number }
interface ReplayFrame { t: number; p: Record<string, ReplayFramePlayer> }
interface ReplayEvent { t: number; type: string; x?: number; y?: number; k?: number; v?: number; teamId?: number }

const C = { red: '#e1242e', blue: '#3b82f6', gold: '#c8aa6e', teal: '#0bc4e3' };
const FONT_COND = "'Saira Condensed', 'Saira', sans-serif";

// Límites de coordenadas del juego por mapa (unidades de juego → % del minimapa).
const MAP_BOUNDS: Record<number, { maxX: number; maxY: number }> = {
  11: { maxX: 14870, maxY: 14980 }, // Grieta del Invocador
  12: { maxX: 12849, maxY: 12858 }, // Abismo de los Lamentos
};
const ARAM_QUEUES = new Set([450, 2400]);

const champIcon = (id?: number) =>
  id ? `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-icons/${id}.png` : '';

const EVENT_META: Record<string, { icon: string; label: string }> = {
  kill: { icon: '⚔️', label: 'Asesinato' },
  tower: { icon: '🗼', label: 'Torre destruida' },
  inhib: { icon: '💎', label: 'Inhibidor destruido' },
  dragon: { icon: '🐉', label: 'Dragón' },
  baron: { icon: '🟣', label: 'Barón Nashor' },
  herald: { icon: '👁️', label: 'Heraldo' },
  grubs: { icon: '🪲', label: 'Larvas del Vacío' },
};

const fmt = (s: number) => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;

export default function MatchReplay2D({ regional, matchId, roster, queueId }: Props) {
  const mapId = ARAM_QUEUES.has(queueId ?? -1) ? 12 : 11;
  const bounds = MAP_BOUNDS[mapId];

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

  // participantId (1-10) → campeón/equipo/nombre (cruce timeline ↔ match)
  const pidMap = useMemo(() => {
    const byPuuid = new Map(roster.map((r) => [r.puuid, r]));
    const m: Record<number, RosterEntry> = {};
    for (const p of replay?.participants ?? []) {
      const r = byPuuid.get(p.puuid);
      if (r) m[p.participantId] = r;
    }
    return m;
  }, [replay, roster]);

  const frames = replay?.frames ?? [];
  const maxT = frames.length ? frames[frames.length - 1].t : 0;

  // ── Reloj de reproducción ──────────────────────────────────────────────────
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(24); // segundos de juego por segundo real
  const raf = useRef<number>(0);
  const last = useRef<number>(0);

  useEffect(() => {
    if (!playing) return;
    last.current = performance.now();
    const tick = (now: number) => {
      const dt = (now - last.current) / 1000;
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

  // Frame actual + interpolación de posiciones entre frame i e i+1
  const positions = useMemo(() => {
    if (!frames.length) return null;
    let i = 0;
    while (i < frames.length - 1 && frames[i + 1].t <= t) i++;
    const a = frames[i];
    const b = frames[Math.min(i + 1, frames.length - 1)];
    const span = Math.max(1, b.t - a.t);
    const k = Math.min(1, Math.max(0, (t - a.t) / span));
    const out: Record<number, { x: number; y: number; level: number }> = {};
    for (let pid = 1; pid <= 10; pid++) {
      const pa = a.p[String(pid)];
      const pb = b.p[String(pid)];
      if (!pa || pa.x == null || pa.y == null) continue;
      const bx = pb?.x ?? pa.x, by = pb?.y ?? pa.y;
      out[pid] = {
        x: pa.x + (bx - pa.x) * k,
        y: pa.y + (by - pa.y) * k,
        level: pa.l,
      };
    }
    // Oro por equipo en el frame actual (sin interpolar: cambia poco por frame)
    let blueGold = 0, redGold = 0;
    for (const [pid, pf] of Object.entries(a.p)) {
      if (Number(pid) <= 5) blueGold += pf.g; else redGold += pf.g;
    }
    return { players: out, blueGold, redGold };
  }, [frames, t]);

  // Eventos visibles en el mapa (ventana de 14s tras ocurrir) + killfeed (últimos 3)
  const visibleEvents = useMemo(
    () => (replay?.events ?? []).filter((e) => e.t <= t && t - e.t < 14 && e.x != null),
    [replay, t],
  );
  const feed = useMemo(
    () => (replay?.events ?? []).filter((e) => e.t <= t).slice(-3).reverse(),
    [replay, t],
  );

  if (!regional || !matchId || !roster.length) return null;
  if (replayQ.isError) return null; // timeline aún no procesada por Riot o cola sin timeline: ocultar sin ruido
  if (!replay || !frames.length) {
    return replayQ.isPending ? (
      <div style={{ fontFamily: FONT_COND, fontSize: 13, color: 'rgba(255,255,255,0.4)', padding: '14px 4px' }}>
        Cargando repetición 2D…
      </div>
    ) : null;
  }

  const goldDiff = (positions?.blueGold ?? 0) - (positions?.redGold ?? 0);
  const goldPct = positions ? (positions.blueGold / Math.max(1, positions.blueGold + positions.redGold)) * 100 : 50;

  const nameOf = (pid?: number) => (pid && pidMap[pid]?.summonerName) || `Jugador ${pid ?? '?'}`;
  const teamOf = (pid?: number) => (pid ? (pid <= 5 ? 100 : 200) : 0);

  return (
    <div>
      <h2 style={{ fontFamily: FONT_COND, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: 14, color: '#fff', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ width: 4, height: 16, background: C.red, borderRadius: 2, display: 'inline-block' }} />
        <Film size={15} style={{ color: C.red }} /> Repetición 2D
        <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.35)', textTransform: 'none', letterSpacing: 0 }}>
          posiciones oficiales de Riot (1/min, interpoladas)
        </span>
      </h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 520px) 1fr', gap: 18, alignItems: 'start' }}>
        {/* ── Minimapa ── */}
        <div style={{ position: 'relative', width: '100%', aspectRatio: '1 / 1', borderRadius: 14, overflow: 'hidden', background: '#0c1220' }}>
          {/* DDragon es el único CDN que sirve el minimapa (verificado: las rutas
              de CommunityDragon para map-assets dan 404). */}
          <img
            src={`https://ddragon.leagueoflegends.com/cdn/6.8.1/img/map/map${mapId}.png`}
            alt=""
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.9 }}
            draggable={false}
          />
          {/* Marcadores de eventos recientes */}
          {visibleEvents.map((e, i) => {
            const meta = EVENT_META[e.type] || { icon: '•', label: e.type };
            const killerTeam = e.type === 'kill' ? teamOf(e.k) : (e.teamId === 100 ? 200 : e.teamId === 200 ? 100 : teamOf(e.k));
            const age = (t - e.t) / 14; // 0→1
            return (
              <div key={`${e.t}-${i}`} style={{
                position: 'absolute',
                left: `${((e.x ?? 0) / bounds.maxX) * 100}%`,
                top: `${(1 - (e.y ?? 0) / bounds.maxY) * 100}%`,
                transform: 'translate(-50%, -50%)',
                fontSize: 15, opacity: 1 - age * 0.7,
                filter: `drop-shadow(0 0 6px ${killerTeam === 100 ? C.blue : C.red})`,
                pointerEvents: 'none', zIndex: 3,
              }}>
                {meta.icon}
              </div>
            );
          })}
          {/* Jugadores */}
          {positions && Object.entries(positions.players).map(([pidStr, pos]) => {
            const pid = Number(pidStr);
            const info = pidMap[pid];
            const team = info?.teamId ?? teamOf(pid);
            return (
              <img
                key={pid}
                src={champIcon(info?.championId)}
                title={`${nameOf(pid)} · Nv.${pos.level}`}
                alt=""
                style={{
                  position: 'absolute',
                  left: `${(pos.x / bounds.maxX) * 100}%`,
                  top: `${(1 - pos.y / bounds.maxY) * 100}%`,
                  transform: 'translate(-50%, -50%)',
                  width: '7.5%', height: '7.5%', minWidth: 20, minHeight: 20,
                  borderRadius: '50%',
                  border: `2px solid ${team === 100 ? C.blue : C.red}`,
                  boxShadow: `0 0 8px ${team === 100 ? 'rgba(59,130,246,0.7)' : 'rgba(225,36,46,0.7)'}`,
                  background: '#000', objectFit: 'cover', zIndex: 2,
                }}
                draggable={false}
              />
            );
          })}
          {/* Reloj sobre el mapa */}
          <div style={{ position: 'absolute', top: 8, left: 8, zIndex: 4, background: 'rgba(0,0,0,0.65)', borderRadius: 8, padding: '3px 10px', fontFamily: FONT_COND, fontWeight: 700, fontSize: 14, color: '#fff' }}>
            {fmt(t)}
          </div>
        </div>

        {/* ── Panel lateral: oro + killfeed ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, fontFamily: FONT_COND }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
              <span style={{ color: C.blue, fontWeight: 700 }}>{((positions?.blueGold ?? 0) / 1000).toFixed(1)}k</span>
              <span style={{ color: 'rgba(255,255,255,0.45)' }}>
                ORO {goldDiff !== 0 && (
                  <b style={{ color: goldDiff > 0 ? C.blue : C.red }}>
                    ({goldDiff > 0 ? '+' : ''}{(goldDiff / 1000).toFixed(1)}k)
                  </b>
                )}
              </span>
              <span style={{ color: C.red, fontWeight: 700 }}>{((positions?.redGold ?? 0) / 1000).toFixed(1)}k</span>
            </div>
            <div style={{ height: 8, borderRadius: 999, overflow: 'hidden', background: C.red, display: 'flex' }}>
              <div style={{ width: `${goldPct}%`, background: C.blue, transition: 'width 300ms linear' }} />
            </div>
          </div>

          <div>
            <div style={{ fontSize: 11, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', marginBottom: 8 }}>Eventos recientes</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {feed.length === 0 && <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)' }}>Aún sin eventos…</div>}
              {feed.map((e, i) => {
                const meta = EVENT_META[e.type] || { icon: '•', label: e.type };
                return (
                  <div key={`${e.t}-${e.type}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'rgba(255,255,255,0.8)', background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '6px 10px' }}>
                    <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'rgba(255,255,255,0.4)', flexShrink: 0 }}>{fmt(e.t)}</span>
                    <span>{meta.icon}</span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {e.type === 'kill'
                        ? <><b style={{ color: teamOf(e.k) === 100 ? C.blue : '#ff6b73' }}>{nameOf(e.k)}</b> eliminó a <b style={{ color: teamOf(e.v) === 100 ? C.blue : '#ff6b73' }}>{nameOf(e.v)}</b></>
                        : <>{meta.label}{e.k ? <> · <b style={{ color: teamOf(e.k) === 100 ? C.blue : '#ff6b73' }}>{nameOf(e.k)}</b></> : null}</>}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', lineHeight: 1.5 }}>
            Las posiciones vienen del snapshot oficial por minuto de Riot; el movimiento entre
            snapshots es interpolado.
          </div>
        </div>
      </div>

      {/* ── Controles ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14, fontFamily: FONT_COND }}>
        <button
          onClick={() => { if (t >= maxT) setT(0); setPlaying((p) => !p); }}
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 40, height: 40, borderRadius: '50%', border: 'none',
            background: C.red, color: '#fff', cursor: 'pointer', flexShrink: 0,
          }}
          title={playing ? 'Pausa' : 'Reproducir'}
        >
          {playing ? <Pause size={17} /> : <Play size={17} style={{ marginLeft: 2 }} />}
        </button>
        <span style={{ fontFamily: 'monospace', fontSize: 13, color: 'rgba(255,255,255,0.7)', width: 44, flexShrink: 0 }}>{fmt(t)}</span>
        <input
          type="range"
          min={0}
          max={maxT}
          step={1}
          value={t}
          onChange={(e) => { setPlaying(false); setT(Number(e.target.value)); }}
          style={{ flex: 1, accentColor: C.red, cursor: 'pointer' }}
        />
        <span style={{ fontFamily: 'monospace', fontSize: 13, color: 'rgba(255,255,255,0.4)', width: 44, flexShrink: 0 }}>{fmt(maxT)}</span>
        <select
          value={speed}
          onChange={(e) => setSpeed(Number(e.target.value))}
          style={{ background: 'rgba(255,255,255,0.06)', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 8px', fontFamily: FONT_COND, fontSize: 13, cursor: 'pointer' }}
        >
          <option value={12}>12x</option>
          <option value={24}>24x</option>
          <option value={48}>48x</option>
          <option value={96}>96x</option>
        </select>
      </div>
    </div>
  );
}
