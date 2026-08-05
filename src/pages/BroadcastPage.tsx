// src/pages/BroadcastPage.tsx
// Broadcast en vivo en el navegador: /broadcast/:channel
// Lee el canal que alimenta el ATAK Spectator Companion (PC espectadora →
// Live Client Data API oficial de Riot → backend /api/live-feed) y muestra un
// tablero estilo transmisión: marcador por equipo, K/D/A, CS, items, niveles,
// timers de respawn, feed de eventos y — si el companion manda streamUrl —
// el video HLS embebido. Todo sin instalar nada para el espectador.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { axiosInstance } from '@/lib/axios';
import { useChampions } from '@/hooks/use-ddragon';
import { ScrollVideoBg } from '@/components/ScrollVideoBg';
import { Radio, Link2, Check } from 'lucide-react';

const RED = '#e1242e';
const BLUE = '#3b82f6';
const GOLD = '#c8aa6e';
const FONT_COND = "'Saira Condensed', 'Saira', sans-serif";

interface FeedPlayer {
  riotId: string; championName: string; team: 'ORDER' | 'CHAOS';
  level: number; kills: number; deaths: number; assists: number;
  creepScore: number; wardScore: number; isDead: boolean; respawnTimer: number;
  position: string; items: number[];
}
interface FeedEvent { id: number; t: number; name: string; killer: string; victim: string; assisters: string[]; extra: string }
interface Feed {
  ok: boolean; seq: number; ageMs: number;
  gameTime: number; gameMode: string; mapName: string;
  matchLabel: string; streamUrl: string; tournamentId: string;
  players: FeedPlayer[]; events: FeedEvent[];
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
const norm = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

const EVENT_META: Record<string, { icon: string; label: string }> = {
  ChampionKill: { icon: '⚔️', label: 'Asesinato' },
  FirstBlood: { icon: '🩸', label: 'Primera sangre' },
  Multikill: { icon: '💥', label: 'Multikill' },
  Ace: { icon: '💥', label: 'ACE' },
  DragonKill: { icon: '🐉', label: 'Dragón' },
  BaronKill: { icon: '🟣', label: 'Barón Nashor' },
  HeraldKill: { icon: '👁️', label: 'Heraldo' },
  HordeKill: { icon: '🪲', label: 'Larvas' },
  TurretKilled: { icon: '🗼', label: 'Torre destruida' },
  InhibKilled: { icon: '💎', label: 'Inhibidor' },
  GameStart: { icon: '🟢', label: 'Inicio de partida' },
  MinionsSpawning: { icon: '🟡', label: 'Súbditos en camino' },
  GameEnd: { icon: '🏁', label: 'Fin de la partida' },
};

// El companion manda el nombre limpio ("Nombre#TAG"); recorta el tag para las filas.
const shortName = (riotId: string) => (riotId.includes('#') ? riotId.slice(0, riotId.indexOf('#')) : riotId);

function PlayerLine({ p, champIcon, itemIcon, side }: {
  p: FeedPlayer; side: 'blue' | 'red';
  champIcon: (name: string) => string | null;
  itemIcon: (id: number) => string;
}) {
  const icon = champIcon(p.championName);
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', borderRadius: 12,
      background: side === 'blue' ? 'rgba(59,130,246,0.05)' : 'rgba(225,36,46,0.05)',
      opacity: p.isDead ? 0.55 : 1, transition: 'opacity 300ms ease',
    }}>
      <div style={{ position: 'relative', flexShrink: 0 }}>
        {icon ? (
          <img src={icon} alt="" style={{ width: 40, height: 40, borderRadius: 10, objectFit: 'cover', filter: p.isDead ? 'grayscale(1)' : 'none', background: '#000' }} />
        ) : (
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
            {p.championName.slice(0, 1)}
          </div>
        )}
        <span style={{
          position: 'absolute', bottom: -4, right: -4, background: '#0a0a0c', borderRadius: 6,
          fontSize: 10, fontWeight: 700, color: GOLD, padding: '1px 4px',
        }}>{p.level}</span>
        {p.isDead && p.respawnTimer > 0 && (
          <span style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 800, fontSize: 15, textShadow: '0 0 6px #000',
          }}>{Math.ceil(p.respawnTimer)}</span>
        )}
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {shortName(p.riotId) || p.championName}
        </div>
        <div style={{ display: 'flex', gap: 3, marginTop: 3 }}>
          {p.items.slice(0, 6).map((id, i) => (
            <img key={i} src={itemIcon(id)} alt="" style={{ width: 16, height: 16, borderRadius: 3, background: '#000' }}
              onError={(e) => { (e.target as HTMLImageElement).style.visibility = 'hidden'; }} />
          ))}
        </div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontFamily: FONT_COND, fontWeight: 800, fontSize: 15, color: '#fff' }}>
          {p.kills}/<span style={{ color: '#ff6b73' }}>{p.deaths}</span>/{p.assists}
        </div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{p.creepScore} CS</div>
      </div>
    </div>
  );
}

export default function BroadcastPage() {
  const { channel } = useParams<{ channel: string }>();
  const { data: champs } = useChampions();
  const version = (champs as any)?.version || '';

  const feedQ = useQuery({
    queryKey: ['broadcast', channel],
    enabled: !!channel,
    refetchInterval: 2500,
    retry: false,
    queryFn: async () => {
      const { data, status } = await axiosInstance.get(`/api/live-feed/${channel}`, {
        validateStatus: (s) => s < 500,
      });
      return status === 200 && data?.ok ? (data as Feed) : null;
    },
  });
  const feed = feedQ.data ?? null;

  // championName (display o slug) → icono, tolerante a acentos/espacios
  const champIcon = useMemo(() => {
    const map: Record<string, string> = {};
    for (const e of Object.values<any>((champs as any)?.byId || {})) {
      const url = `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-icons/${e.key}.png`;
      map[norm(e.name)] = url;
      map[norm(e.id)] = url;
    }
    return (name: string) => map[norm(name)] || null;
  }, [champs]);

  const itemIcon = (id: number) => `https://ddragon.leagueoflegends.com/cdn/${version || '14.1.1'}/img/item/${id}.png`;

  const blue = (feed?.players || []).filter((p) => p.team === 'ORDER');
  const red = (feed?.players || []).filter((p) => p.team === 'CHAOS');
  const blueKills = blue.reduce((s, p) => s + p.kills, 0);
  const redKills = red.reduce((s, p) => s + p.kills, 0);
  const events = useMemo(() => (feed?.events || []).filter((e) => EVENT_META[e.name]).slice(-9).reverse(), [feed]);

  // ── Video HLS (si el companion transmite streamUrl) ────────────────────────
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamUrl = feed?.streamUrl || '';
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !streamUrl) return;
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = streamUrl;
      video.play().catch(() => {});
      return;
    }
    let hls: any;
    let cancelled = false;
    import('hls.js').then(({ default: Hls }) => {
      if (cancelled || !Hls.isSupported()) return;
      hls = new Hls({ liveDurationInfinity: true });
      hls.loadSource(streamUrl);
      hls.attachMedia(video);
      video.play().catch(() => {});
    });
    return () => { cancelled = true; hls?.destroy?.(); };
  }, [streamUrl]);

  const [copied, setCopied] = useState(false);
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0c', color: '#e8e8ea', fontFamily: FONT_COND }}>
      <ScrollVideoBg />
      <div style={{ position: 'relative', zIndex: 1, maxWidth: 1240, margin: '0 auto', padding: '92px 18px 80px' }}>
        <style>{`@keyframes atak-live-dot { 0%,100%{opacity:1} 50%{opacity:.35} }`}</style>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginBottom: 22 }}>
          {feed && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 999,
              background: 'rgba(225,36,46,0.15)', color: '#ff6b73', fontWeight: 700, fontSize: 13, letterSpacing: 0.6,
            }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: RED, boxShadow: `0 0 10px ${RED}`, animation: 'atak-live-dot 1.4s ease-in-out infinite' }} />
              EN VIVO
            </span>
          )}
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: '#fff' }}>
            {feed?.matchLabel || `Broadcast · ${channel}`}
          </h1>
          {feed && (
            <span style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 700, color: GOLD }}>{fmt(feed.gameTime)}</span>
          )}
          <div style={{ flex: 1 }} />
          <button onClick={copyLink} style={{
            display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 16px', borderRadius: 999,
            background: 'rgba(255,255,255,0.07)', color: copied ? '#0bc4e3' : 'rgba(255,255,255,0.8)',
            border: 'none', cursor: 'pointer', fontFamily: FONT_COND, fontWeight: 700, fontSize: 13,
          }}>
            {copied ? <Check size={15} /> : <Link2 size={15} />}
            {copied ? 'Link copiado' : 'Compartir'}
          </button>
        </div>

        {!feed && (
          <div style={{ textAlign: 'center', padding: '110px 20px' }}>
            <Radio size={44} style={{ color: 'rgba(255,255,255,0.18)', marginBottom: 18 }} />
            <div style={{ fontSize: 22, fontWeight: 700, color: 'rgba(255,255,255,0.85)', marginBottom: 8 }}>
              {feedQ.isPending ? 'Conectando al broadcast…' : 'El broadcast no está activo'}
            </div>
            <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)' }}>
              Esta página se conecta sola en cuanto la transmisión empiece — déjala abierta.
            </div>
          </div>
        )}

        {feed && (
          <>
            {/* Video (opcional) */}
            {streamUrl && (
              <div style={{ marginBottom: 22, borderRadius: 16, overflow: 'hidden', background: '#000', aspectRatio: '16 / 9' }}>
                <video ref={videoRef} controls muted playsInline style={{ width: '100%', height: '100%' }} />
              </div>
            )}

            {/* Marcador global */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 26, marginBottom: 22 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: BLUE, letterSpacing: 1 }}>AZUL</span>
              <span style={{ fontFamily: FONT_COND, fontSize: 44, fontWeight: 800, color: '#fff' }}>
                <span style={{ color: BLUE }}>{blueKills}</span>
                <span style={{ color: 'rgba(255,255,255,0.3)', margin: '0 14px' }}>–</span>
                <span style={{ color: RED }}>{redKills}</span>
              </span>
              <span style={{ fontSize: 15, fontWeight: 700, color: RED, letterSpacing: 1 }}>ROJO</span>
            </div>

            {/* Scoreboard + feed */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr minmax(220px, 300px)', gap: 16, alignItems: 'start' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {blue.map((p, i) => <PlayerLine key={i} p={p} side="blue" champIcon={champIcon} itemIcon={itemIcon} />)}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {red.map((p, i) => <PlayerLine key={i} p={p} side="red" champIcon={champIcon} itemIcon={itemIcon} />)}
              </div>
              <div>
                <div style={{ fontSize: 11, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', marginBottom: 8 }}>
                  Eventos
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {events.length === 0 && <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)' }}>Aún sin eventos…</div>}
                  {events.map((e) => {
                    const meta = EVENT_META[e.name];
                    return (
                      <div key={`${e.id}-${e.t}`} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12.5, color: 'rgba(255,255,255,0.8)', background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '6px 9px' }}>
                        <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'rgba(255,255,255,0.4)', flexShrink: 0, marginTop: 1 }}>{fmt(e.t)}</span>
                        <span>{meta.icon}</span>
                        <span style={{ minWidth: 0 }}>
                          {e.name === 'ChampionKill'
                            ? <><b>{shortName(e.killer)}</b> eliminó a <b>{shortName(e.victim)}</b></>
                            : <>{meta.label}{e.killer ? <> · <b>{shortName(e.killer)}</b></> : null}</>}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div style={{ marginTop: 26, fontSize: 12, color: 'rgba(255,255,255,0.35)', textAlign: 'center' }}>
              Datos en tiempo real vía ATAK Spectator Companion (Live Client Data API oficial de Riot) · se actualiza cada 2s
            </div>
          </>
        )}
      </div>
    </div>
  );
}
