// src/pages/BroadcastPage.tsx
// Broadcast en vivo en el navegador: /broadcast/:channel
// Lee el canal que alimenta el ATAK Spectator Companion (PC espectadora →
// Live Client Data API oficial de Riot → backend /api/live-feed) y muestra un
// tablero estilo transmisión: marcador por equipo, K/D/A, CS, items, niveles,
// timers de respawn, feed de eventos y — si el companion manda streamUrl —
// el video embebido. Todo sin instalar nada para el espectador.
// Tema (src/lib/broadcastTheme.ts): "atak" (Arena) o "lqc" (azul de la liga),
// según el canal o ?theme=. ?demo=1 muestra una partida simulada.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { axiosInstance } from '@/lib/axios';
import { useChampions } from '@/hooks/use-ddragon';
import { lol, type DragonKey } from '@/lib/lolAssets';
import { broadcastThemeFor, broadcastVars, ensureBroadcastFont } from '@/lib/broadcastTheme';
import { demoFeed } from '@/lib/broadcastDemo';
import { Radio, Link2, Check } from 'lucide-react';
import '@/styles/pages/broadcast-board.css';

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
  team1?: string; team2?: string; logo1?: string; logo2?: string; accent?: string;
  players: FeedPlayer[]; events: FeedEvent[];
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
const norm = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

// ── streamUrl → embed correcto ───────────────────────────────────────────────
// El caster pega lo que tenga a mano: un canal de Twitch, un video/directo de
// YouTube, un canal de Kick o un HLS (.m3u8). Cada uno se embebe distinto —
// meter twitch.tv en hls.js era el bug del spinner infinito + error CORS.
type StreamEmbed =
  | { kind: 'iframe'; src: string }
  | { kind: 'hls'; src: string }
  | { kind: 'link'; href: string };

function parseStreamEmbed(raw: string, hostname: string): StreamEmbed | null {
  const url = (raw || '').trim();
  if (!url) return null;
  let u: URL;
  try { u = new URL(url); } catch { return null; }
  const host = u.hostname.replace(/^www\./, '').toLowerCase();

  // Twitch: player oficial (exige `parent` = dominio que embebe)
  if (host === 'twitch.tv' || host === 'm.twitch.tv') {
    const chan = u.pathname.split('/').filter(Boolean)[0];
    if (chan) {
      return { kind: 'iframe', src: `https://player.twitch.tv/?channel=${encodeURIComponent(chan)}&parent=${hostname}&autoplay=true&muted=true` };
    }
  }
  if (host === 'player.twitch.tv') {
    // Ya es el player: asegurar parent correcto
    u.searchParams.set('parent', hostname);
    return { kind: 'iframe', src: u.toString() };
  }

  // YouTube: watch?v= / youtu.be/ / live/
  if (host === 'youtube.com' || host === 'youtu.be') {
    const id = host === 'youtu.be'
      ? u.pathname.split('/').filter(Boolean)[0]
      : u.searchParams.get('v') || u.pathname.match(/\/(?:live|embed)\/([^/?]+)/)?.[1];
    if (id) return { kind: 'iframe', src: `https://www.youtube.com/embed/${encodeURIComponent(id)}?autoplay=1&mute=1` };
  }

  // Kick
  if (host === 'kick.com') {
    const chan = u.pathname.split('/').filter(Boolean)[0];
    if (chan) return { kind: 'iframe', src: `https://player.kick.com/${encodeURIComponent(chan)}?autoplay=true&muted=true` };
  }

  // HLS directo
  if (/\.m3u8(\?.*)?$/i.test(url)) return { kind: 'hls', src: url };

  // Desconocido: enlace externo en vez de un reproductor roto
  return { kind: 'link', href: url };
}

// Evento → icono del juego (los locales de /public/lol) + etiqueta.
const DRAGON_KEY: Record<string, DragonKey> = {
  Fire: 'infernal', Water: 'ocean', Earth: 'mountain', Air: 'cloud',
  Hextech: 'hextech', Chemtech: 'chemtech', Elder: 'elder',
};
const EVENT_META: Record<string, { icon: string; label: string }> = {
  ChampionKill: { icon: lol.ui('score'), label: 'Asesinato' },
  FirstBlood: { icon: lol.ui('score'), label: 'Primera sangre' },
  Multikill: { icon: lol.ui('score'), label: 'Multikill' },
  Ace: { icon: lol.ui('score'), label: 'ACE' },
  DragonKill: { icon: lol.dragon('elder'), label: 'Dragón' },
  BaronKill: { icon: lol.ui('nashor'), label: 'Barón Nashor' },
  HeraldKill: { icon: lol.ui('rift_herald'), label: 'Heraldo' },
  HordeKill: { icon: lol.ui('creep'), label: 'Larvas' },
  TurretKilled: { icon: lol.ui('tower'), label: 'Torre destruida' },
  InhibKilled: { icon: lol.ui('tower'), label: 'Inhibidor' },
  GameStart: { icon: lol.ui('minion'), label: 'Inicio de partida' },
  MinionsSpawning: { icon: lol.ui('minion'), label: 'Súbditos en camino' },
  GameEnd: { icon: lol.ui('champion'), label: 'Fin de la partida' },
};
const eventIcon = (e: FeedEvent) =>
  e.name === 'DragonKill' && DRAGON_KEY[e.extra] ? lol.dragon(DRAGON_KEY[e.extra]) : EVENT_META[e.name].icon;

// El companion manda el nombre limpio ("Nombre#TAG"); recorta el tag para las filas.
const shortName = (riotId: string) => (riotId.includes('#') ? riotId.slice(0, riotId.indexOf('#')) : riotId);
const hideImg = (e: React.SyntheticEvent<HTMLImageElement>) => { e.currentTarget.style.visibility = 'hidden'; };

function PlayerLine({ p, champIcon, champSplash, itemIcon, side, index }: {
  p: FeedPlayer; side: 'blue' | 'red'; index: number;
  champIcon: (name: string) => string | null;
  champSplash: (name: string) => string;
  itemIcon: (id: number) => string;
}) {
  const icon = champIcon(p.championName);
  const splash = champSplash(p.championName);
  return (
    <div className={`bb-player ${side}${p.isDead ? ' dead' : ''}`} style={{ animationDelay: `${0.12 + index * 0.06}s` }}>
      {/* Splash del campeón de fondo, fundido hacia los datos */}
      {splash && <span className="bb-art" aria-hidden><img src={splash} alt="" loading="lazy" onError={hideImg} /></span>}
      <span className="bb-face">
        {icon ? <img src={icon} alt="" onError={hideImg} /> : p.championName.slice(0, 1)}
        {p.isDead && p.respawnTimer > 0 && <span className="bb-respawn bb-disp">{Math.ceil(p.respawnTimer)}</span>}
      </span>
      <span className="bb-lvl">{p.level}</span>
      <div className="bb-pid">
        <div className="bb-pname">{shortName(p.riotId) || p.championName}</div>
        <div className="bb-items">
          {p.items.slice(0, 6).map((id, i) => <img key={i} src={itemIcon(id)} alt="" onError={hideImg} />)}
        </div>
      </div>
      <div className="bb-pstats">
        <div className="bb-kda"><span key={p.kills} className="bb-pop">{p.kills}</span>/<i key={p.deaths} className="bb-pop">{p.deaths}</i>/<span key={p.assists} className="bb-pop">{p.assists}</span></div>
        <div className="bb-cs">CS {p.creepScore} · VIS {Math.round(p.wardScore || 0)}</div>
      </div>
    </div>
  );
}

export default function BroadcastPage() {
  const { channel } = useParams<{ channel: string }>();
  const [params] = useSearchParams();
  const demo = params.get('demo') === '1';
  const theme = broadcastThemeFor(channel, params.get('theme'));
  const { data: champs } = useChampions();
  const version = (champs as any)?.version || '';

  useEffect(() => { ensureBroadcastFont(theme); }, [theme]);

  const feedQ = useQuery({
    queryKey: ['broadcast', channel],
    enabled: !!channel && !demo,
    refetchInterval: 2500,
    retry: false,
    queryFn: async () => {
      const { data, status } = await axiosInstance.get(`/api/live-feed/${channel}`, {
        validateStatus: (s) => s < 500,
      });
      return status === 200 && data?.ok ? (data as Feed) : null;
    },
  });
  const [demoElapsed, setDemoElapsed] = useState(0);
  useEffect(() => {
    if (!demo) return;
    const id = setInterval(() => setDemoElapsed((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [demo]);
  const feed: Feed | null = demo
    ? (demoFeed(demoElapsed, String(channel || 'demo'), theme.id === 'lqc') as Feed)
    : feedQ.data ?? null;
  const lqc = theme.id === 'lqc';
  const team1 = (feed?.team1 || 'Azul').trim();
  const team2 = (feed?.team2 || 'Rojo').trim();

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
  const champSplash = useMemo(() => {
    const slug: Record<string, string> = {};
    for (const e of Object.values<any>((champs as any)?.byId || {})) { slug[norm(e.name)] = e.id; slug[norm(e.id)] = e.id; }
    return (name: string) => (slug[norm(name)] ? lol.centered(slug[norm(name)]) : '');
  }, [champs]);

  const itemIcon = (id: number) => `https://ddragon.leagueoflegends.com/cdn/${version || '14.1.1'}/img/item/${id}.png`;

  const blue = (feed?.players || []).filter((p) => p.team === 'ORDER');
  const red = (feed?.players || []).filter((p) => p.team === 'CHAOS');
  const blueKills = blue.reduce((s, p) => s + p.kills, 0);
  const redKills = red.reduce((s, p) => s + p.kills, 0);
  const events = useMemo(() => (feed?.events || []).filter((e) => EVENT_META[e.name]).slice(-9).reverse(), [feed]);

  // ── Video del stream (Twitch/YouTube/Kick → iframe · .m3u8 → HLS) ─────────
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamUrl = feed?.streamUrl || '';
  const embed = useMemo(
    () => parseStreamEmbed(streamUrl, window.location.hostname),
    [streamUrl],
  );
  useEffect(() => {
    if (embed?.kind !== 'hls') return;
    const video = videoRef.current;
    if (!video) return;
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = embed.src;
      video.play().catch(() => {});
      return;
    }
    let hls: any;
    let cancelled = false;
    import('hls.js').then(({ default: Hls }) => {
      if (cancelled || !Hls.isSupported()) return;
      hls = new Hls({ liveDurationInfinity: true });
      hls.loadSource(embed.src);
      hls.attachMedia(video);
      video.play().catch(() => {});
    });
    return () => { cancelled = true; hls?.destroy?.(); };
  }, [embed]);

  const [copied, setCopied] = useState(false);
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div className="bb-root" data-theme={theme.id} style={broadcastVars(theme, feed?.accent)}>
      <div className="bb-wrap">
        {/* Marca de la liga, como en sus publicaciones */}
        {lqc && (
          <div className="bb-lqc-top">
            <span className="bb-lockup">
              <img src="/lqc-wordmark.png" alt="LQC" />
              <i />
              <span><small>League of Legends</small>Queretaro<br />Championship</span>
            </span>
            <span className="bb-lqc-sep" />
            <a className="bb-lqc-watch" href="https://www.twitch.tv/lqroc" target="_blank" rel="noopener noreferrer">
              <span>Míralos en:</span>
              <b>TWITCH.TV/LQROC</b>
            </a>
          </div>
        )}

        {/* Cabecera */}
        {lqc && <div className="bb-kicker">Transmisión / {feed ? 'En vivo' : 'Fuera de línea'}</div>}
        <div className="bb-head">
          {feed && <span className="bb-live"><i />EN VIVO</span>}
          <h1 className="bb-title bb-disp">{feed?.matchLabel || `Broadcast · ${channel}`}</h1>
          <button type="button" className="bb-btn" data-done={copied} onClick={copyLink}>
            {copied ? <Check size={15} /> : <Link2 size={15} />}
            {copied ? 'Link copiado' : 'Compartir'}
          </button>
        </div>

        {!feed && (
          <div className="bb-empty">
            <Radio size={44} />
            <h2 className="bb-disp">{feedQ.isPending ? 'Conectando al broadcast…' : 'El broadcast no está activo'}</h2>
            <p>Esta página se conecta sola en cuanto la transmisión empiece — déjala abierta.</p>
          </div>
        )}

        {feed && (
          <>
            {/* Video (opcional) — embed según el tipo de stream */}
            {embed?.kind === 'iframe' && (
              <div className="bb-panel bb-video">
                <iframe src={embed.src} title="Stream en vivo" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen />
              </div>
            )}
            {embed?.kind === 'hls' && (
              <div className="bb-panel bb-video">
                <video ref={videoRef} controls muted playsInline />
              </div>
            )}
            {embed?.kind === 'link' && (
              <div className="bb-panel bb-extlink">
                <span>La transmisión de video está en otro sitio:</span>
                <a href={embed.href} target="_blank" rel="noopener noreferrer">Abrir stream →</a>
              </div>
            )}

            {/* Marcador */}
            <div className="bb-panel bb-bug">
              <div className="bb-team blue">
                <span className="bb-team-logo bb-disp">
                  {feed.logo1 ? <img src={feed.logo1} alt="" onError={hideImg} /> : team1.slice(0, 1)}
                </span>
                <span className="bb-team-id">
                  <span className="bb-team-name bb-disp">{team1}</span>
                  <span className="bb-team-side">LADO AZUL</span>
                </span>
              </div>
              <div className="bb-kills blue bb-disp"><span key={blueKills} className="bb-pop">{blueKills}</span></div>
              <div className="bb-mid">
                <img src={theme.logo} alt={theme.brand} style={{ height: theme.logoHeight }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                <span className="bb-disp">{fmt(feed.gameTime)}</span>
              </div>
              <div className="bb-kills red bb-disp"><span key={redKills} className="bb-pop">{redKills}</span></div>
              <div className="bb-team red">
                <span className="bb-team-logo bb-disp">
                  {feed.logo2 ? <img src={feed.logo2} alt="" onError={hideImg} /> : team2.slice(0, 1)}
                </span>
                <span className="bb-team-id">
                  <span className="bb-team-name bb-disp">{team2}</span>
                  <span className="bb-team-side">LADO ROJO</span>
                </span>
              </div>
            </div>

            {/* Equipos + eventos */}
            <div className="bb-grid">
              <div className="bb-col blue">
                <div className="bb-over">{team1}</div>
                {blue.map((p, i) => <PlayerLine key={i} index={i} p={p} side="blue" champIcon={champIcon} champSplash={champSplash} itemIcon={itemIcon} />)}
              </div>
              <div className="bb-col red">
                <div className="bb-over">{team2}</div>
                {red.map((p, i) => <PlayerLine key={i} index={i} p={p} side="red" champIcon={champIcon} champSplash={champSplash} itemIcon={itemIcon} />)}
              </div>
              <div>
                <div className="bb-over">Eventos</div>
                <div className="bb-events">
                  {events.length === 0 && <div className="bb-none">Aún sin eventos…</div>}
                  {events.map((e) => {
                    const meta = EVENT_META[e.name];
                    return (
                      <div key={`${e.id}-${e.t}`} className="bb-event">
                        <time>{fmt(e.t)}</time>
                        <img src={eventIcon(e)} alt="" onError={hideImg} />
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

            {lqc ? (
              <div className="bb-foot">
                <span>Datos en tiempo real<b>ATAK Spectator Companion · API oficial de Riot</b></span>
                <span>Se actualiza<b>cada 2 segundos</b></span>
              </div>
            ) : (
              <div className="bb-foot">
                Datos en tiempo real vía ATAK Spectator Companion (Live Client Data API oficial de Riot) · se actualiza cada 2s
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
