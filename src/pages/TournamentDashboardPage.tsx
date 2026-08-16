// src/pages/TournamentDashboardPage.tsx — Tournament DETAIL / dashboard view.
// Dark modern, red accent. Consumes useTournamentDashboard() and reuses the
// shared tournament/ui primitives (zero re-styled primitives). Router is wired
// externally; this file only renders the page for route `/tournaments/:id/...`.
import { CSSProperties, ReactNode, useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { axiosInstance } from '@/lib/axios';
import { qk } from '@/hooks/queries/keys';
import { toast } from 'sonner';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Trophy, Calendar, Clock, Users, Zap, Play, Check, ArrowRight, BarChart3,
  AlertTriangle, RefreshCw, Swords, Settings2, Lock, KeySquare, FolderSync,
  LayoutDashboard, Network, ScrollText, ChevronDown, ChevronUp, Crown, Skull, Flame,
  Mail, Send,
} from 'lucide-react';
import {
  useTournamentDashboard, useCheckin, useBracket, useRegistrations,
  useCloseRegistration, useStartTournament, useGenerateCodes, useSyncGames,
  useActivateMatch, useReportResult,
  type TdBoardPayload, type BracketMatch,
} from '@/hooks/queries/tournaments';
import { useTournamentGlobalStats } from '@/hooks/useTournamentGlobalStats';
import { TournamentGlobalStats } from '@/components/TournamentGlobalStats';
import { TournamentMatchStats } from '@/components/TournamentMatchStats';
import { TournamentBracket } from '@/components/TournamentBracket';
import {
  Button, StatusChip, TeamBadge, StatTile, ProgressBar, SectionHead,
} from '@/components/tournament/ui';
import { Skeleton } from '@/components/ui/skeleton';
import Aurora from '@/components/Aurora';
import { SwissBracket } from '@/components/SwissBracket';
import { TournamentTeamModal } from '@/components/TournamentTeamModal';
import { useProfileIcons, iconFor } from '@/hooks/useProfileIcons';
import { dd } from '@/lib/dataDragon';
import '@/styles/tournament-dashboard.css';

// ── Helpers ──────────────────────────────────────────────────────────────────
const RED = 'var(--td-red)';
const BLUE = 'var(--td-live)';

/** CommunityDragon champion icon by numeric championId (payload only gives ids). */
const champIcon = (id: number) =>
  `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-icons/${id}.png`;

const pad = (n: number) => String(n).padStart(2, '0');

/** Media query reactiva (sin dependencia externa). */
function useMediaQuery(q: string): boolean {
  const [m, setM] = useState(() => (typeof window !== 'undefined' ? window.matchMedia(q).matches : false));
  useEffect(() => {
    const mq = window.matchMedia(q);
    const fn = (e: MediaQueryListEvent) => setM(e.matches);
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, [q]);
  return m;
}

/** Live HH:MM:SS countdown to an ISO deadline; null when absent/passed. */
function useCountdown(target?: string | null): string | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!target) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [target]);
  if (!target) return null;
  const ms = new Date(target).getTime() - now;
  if (Number.isNaN(ms) || ms <= 0) return null;
  const total = Math.floor(ms / 1000);
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
}

const fmtDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }) : null;
const fmtTime = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : null;

// ── Small local layout helper (uses tokens; not a primitive) ─────────────────
function Card({ children, accent, style }: { children: ReactNode; accent?: string; style?: CSSProperties }) {
  // Panel opaco con hairline: sobre un dashboard denso, el cristal translúcido
  // dejaba el video de fondo peleando con las tablas. El acento solo cambia el
  // color del borde (live / error / fearless).
  return (
    <div
      className="td-panel td-card-in"
      style={{ padding: 18, ...(accent ? { borderColor: accent } : null), ...style }}
    >
      {children}
    </div>
  );
}

type Tab = 'resumen' | 'bracket' | 'equipos' | 'partidas' | 'stats' | 'reglas';

// ── Page ─────────────────────────────────────────────────────────────────────
export default function TournamentDashboardPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const go = (to: string) => navigate(to);
  const [params, setParams] = useSearchParams();
  const { data, isLoading, isError, error, refetch } = useTournamentDashboard(id);

  // Sin ?tab= explícito: durante inscripciones/check-in lo que importa son los
  // equipos; con el torneo ya en marcha (bracket generado), el resumen.
  const defaultTab: Tab =
    data && (data.tournament.phase === 'registration' || data.tournament.phase === 'checkin')
      ? 'equipos'
      : 'resumen';
  const tab = (params.get('tab') as Tab) || defaultTab;
  const setTab = (t: Tab) =>
    setParams((prev) => { const p = new URLSearchParams(prev); p.set('tab', t); return p; }, { replace: true });

  return (
    <div
      className="td-root"
      style={{
        position: 'relative', minHeight: '100vh',
        // Lienzo "vision": negro profundo con sangrado crimson y toque de oro,
        // el mismo lenguaje que el dashboard de usuario.
        background:
          'radial-gradient(1200px 700px at 85% -10%, rgba(225,36,46,0.15), transparent 60%),' +
          'radial-gradient(900px 600px at -10% 30%, rgba(120,20,30,0.18), transparent 60%),' +
          'radial-gradient(1000px 500px at 50% 115%, rgba(200,170,110,0.06), transparent 60%),' +
          'linear-gradient(180deg, #08070a 0%, #0b070b 48%, #060608 100%)',
      }}
    >
      {/* Aurora crimson→oro (React Bits, WebGL) respirando tras el glass */}
      <div aria-hidden style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', opacity: 0.5 }}>
        <Aurora colorStops={['#7a1d24', '#e8323c', '#c8aa6e']} amplitude={1.1} blend={0.55} speed={0.55} />
      </div>
      <div
        aria-hidden
        style={{
          position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
          background: 'linear-gradient(180deg, rgba(8,7,10,0.05) 0%, rgba(8,7,10,0.40) 45%, rgba(6,6,8,0.72) 100%)',
        }}
      />
      <ResponsiveStyles />
      <div className="td-dash" style={{ position: 'relative', zIndex: 1, maxWidth: 1560, margin: '0 auto', padding: '80px 24px 96px' }}>
        {isError ? (
          <ErrorCard
            message={(error as any)?.response?.data?.error ?? (error as any)?.message ?? 'No se pudo cargar el torneo'}
            onRetry={() => refetch()}
          />
        ) : isLoading || !data ? (
          <DashboardSkeleton />
        ) : (
          <>
            <Hero data={data} onBracket={() => setTab('bracket')} navigate={go} />
            <BroadcastBanner channel={id} navigate={go} />
            <Tiles t={data.tournament} />
            {data.viewerAccess === 'owner' && (
              <AdminPanel id={id} phase={data.tournament.phase} bracketType={data.tournament.bracketType}
                seriesTo={data.tournament.seriesTo} finalSeriesTo={data.tournament.finalSeriesTo}
                swissRounds={data.tournament.swissRounds ?? null}
                isPrivate={(data.tournament as any).isPrivate} />
            )}
            <div className="td-shell">
              <aside className="td-side">
                <SideNav value={tab} onChange={setTab} live={data.tournament.status === 'live'} />
              </aside>
              <main style={{ minWidth: 0 }}>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={tab}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                  >
                    {tab === 'resumen' && <ResumenGrid data={data} id={id} navigate={go} onStats={() => setTab('stats')} />}
                    {tab === 'bracket' && <BracketTab id={id} data={data} />}
                    {tab === 'equipos' && (
                      <EquiposTab id={id} region={data.tournament.region} standings={data.standings} />
                    )}
                    {tab === 'partidas' && <PartidasTab id={id} />}
                    {tab === 'stats' && <StatsTab id={id} />}
                    {tab === 'reglas' && <ReglasTab data={data} />}
                  </motion.div>
                </AnimatePresence>
              </main>
            </div>
            {/* Nav flotante inferior (móvil / tablet) */}
            <BottomNav value={tab} onChange={setTab} live={data.tournament.status === 'live'} />
          </>
        )}
      </div>
    </div>
  );
}

// ── BROADCAST BANNER ─────────────────────────────────────────────────────────
// Si el Spectator Companion está transmitiendo en el canal de este torneo
// (canal = id del torneo), aparece el acceso directo al broadcast en vivo.
// Chequeo ligero cada 30s; si no hay transmisión no se renderiza nada.
function BroadcastBanner({ channel, navigate }: { channel: string; navigate: (to: string) => void }) {
  const feedQ = useQuery({
    queryKey: ['broadcast-check', channel],
    enabled: !!channel,
    refetchInterval: 30_000,
    retry: false,
    queryFn: async () => {
      const { data, status } = await axiosInstance.get(`/api/live-feed/${channel}`, {
        validateStatus: (s) => s < 500,
      });
      return status === 200 && data?.ok
        ? { label: String(data.matchLabel || ''), hasVideo: Boolean(data.streamUrl) }
        : null;
    },
  });
  const feed = feedQ.data;
  if (!feed) return null;
  return (
    <button
      onClick={() => navigate(`/broadcast/${channel}`)}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, width: '100%', margin: '14px 0 0',
        padding: '13px 18px', borderRadius: 14, border: '1px solid rgba(232,50,60,0.4)',
        background: 'linear-gradient(90deg, rgba(232,50,60,0.16), rgba(232,50,60,0.05))',
        color: 'var(--td-text)', cursor: 'pointer', textAlign: 'left',
      }}
    >
      <span className="td-dot-pulse" style={{ width: 9, height: 9, borderRadius: '50%', background: RED, boxShadow: `0 0 12px ${RED}`, flexShrink: 0 }} />
      <span style={{ fontWeight: 800, fontSize: 14, letterSpacing: 0.4, color: RED, flexShrink: 0 }}>
        📡 TRANSMISIÓN EN VIVO
      </span>
      <span style={{ fontSize: 13.5, color: 'var(--td-text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {feed.label || 'Partida del torneo en curso'}{feed.hasVideo ? ' · con video' : ''}
      </span>
      <span style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 700, color: 'var(--td-text)', flexShrink: 0 }}>
        Ver broadcast →
      </span>
    </button>
  );
}

// ── ERROR CARD ───────────────────────────────────────────────────────────────
function ErrorCard({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Card accent="rgba(232,50,60,0.35)" style={{ padding: 40, textAlign: 'center' }}>
      <AlertTriangle size={36} color={RED} style={{ margin: '0 auto 12px' }} />
      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--td-text)', marginBottom: 6 }}>
        No se pudieron cargar los datos
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--td-text-2)', margin: '0 0 16px' }}>{message}</p>
      <Button variant="secondary" icon={<RefreshCw size={14} />} onClick={onRetry}>
        REINTENTAR
      </Button>
    </Card>
  );
}

// ── SIDE NAV (desktop) ───────────────────────────────────────────────────────
const NAV_ITEMS: Array<{ key: Tab; label: string; icon: ReactNode }> = [
  { key: 'resumen', label: 'Resumen', icon: <LayoutDashboard size={16} /> },
  { key: 'bracket', label: 'Bracket', icon: <Network size={16} /> },
  { key: 'equipos', label: 'Equipos', icon: <Users size={16} /> },
  { key: 'partidas', label: 'Partidas', icon: <Swords size={16} /> },
  { key: 'stats', label: 'Estadísticas', icon: <BarChart3 size={16} /> },
  { key: 'reglas', label: 'Reglas', icon: <ScrollText size={16} /> },
];

// Sidebar de navegación (desktop). En móvil se oculta y toma el relevo la
// BottomNav flotante.
function SideNav({ value, onChange, live }: { value: Tab; onChange: (t: Tab) => void; live: boolean }) {
  return (
    <nav className="td-panel" aria-label="Secciones del torneo" style={{ padding: 8 }}>
      <div className="td-over" style={{ padding: '8px 12px 10px', letterSpacing: '2.4px' }}>TORNEO</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {NAV_ITEMS.map((it) => {
          const active = value === it.key;
          return (
            <button
              key={it.key}
              onClick={() => onChange(it.key)}
              aria-current={active ? 'page' : undefined}
              className="td-nav-item"
              data-active={active}
            >
              <span className="td-nav-ind" aria-hidden />
              <span style={{ color: active ? RED : 'var(--td-muted)', display: 'inline-flex' }}>{it.icon}</span>
              <span style={{ flex: 1 }}>{it.label}</span>
              {it.key === 'resumen' && live && (
                <span className="td-dot-pulse" style={{ width: 6, height: 6, borderRadius: '50%', background: BLUE }} />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

// Nav inferior flotante (móvil): pastilla fija con iconos, como una app nativa.
function BottomNav({ value, onChange, live }: { value: Tab; onChange: (t: Tab) => void; live: boolean }) {
  return (
    <nav className="td-bottomnav" aria-label="Secciones del torneo">
      {NAV_ITEMS.map((it) => {
        const active = value === it.key;
        return (
          <button
            key={it.key}
            className="td-bottomnav-item"
            data-active={active}
            aria-current={active ? 'page' : undefined}
            onClick={() => onChange(it.key)}
          >
            <span style={{ display: 'inline-flex', position: 'relative' }}>
              {it.icon}
              {it.key === 'resumen' && live && !active && (
                <span className="td-dot-pulse" style={{
                  position: 'absolute', top: -2, right: -4,
                  width: 6, height: 6, borderRadius: '50%', background: BLUE,
                }} />
              )}
            </span>
            <span className="td-bottomnav-label">{it.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

// ── STATS PRINCIPALES (main card del Resumen) ────────────────────────────────
function StatsMainCard({ id, onFull }: { id: string; onFull: () => void }) {
  const { data, loading, error } = useTournamentGlobalStats({ tournamentId: id });

  const top5 = useMemo(
    () => (data?.players ? [...data.players].sort((a, b) => b.avgKda - a.avgKda).slice(0, 5) : []),
    [data],
  );
  const leaders = useMemo(() => {
    if (!data?.players?.length) return [];
    const by = (k: 'avgKda' | 'totalKills' | 'avgDamagePerMin') =>
      [...data.players].sort((a, b) => (b[k] as number) - (a[k] as number))[0];
    return [
      { label: 'MEJOR KDA', icon: <Crown size={13} />, p: by('avgKda'), fmt: (p: any) => p.avgKda.toFixed(2) },
      { label: 'MÁS KILLS', icon: <Skull size={13} />, p: by('totalKills'), fmt: (p: any) => String(p.totalKills) },
      { label: 'MÁS DAÑO/MIN', icon: <Flame size={13} />, p: by('avgDamagePerMin'), fmt: (p: any) => String(Math.round(p.avgDamagePerMin)) },
    ];
  }, [data]);

  return (
    <Card>
      <SectionHead
        icon={<BarChart3 size={14} color={RED} />}
        title="ESTADÍSTICAS DEL TORNEO"
        right={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {loading && <RefreshCw size={13} color="var(--td-muted)" className="td-spin" />}
            <Button variant="secondary" icon={<ArrowRight size={13} />} onClick={onFull}>VER TODO</Button>
          </div>
        }
      />

      {error && !data && <EmptyState>{error}</EmptyState>}
      {!error && !data && <Block h={180} />}
      {data && data.matchesCompleted === 0 && (
        <EmptyState>
          Las estadísticas aparecen aquí en cuanto termine la primera partida del torneo.
        </EmptyState>
      )}

      {data && data.matchesCompleted > 0 && (
        <>
          {/* Líderes */}
          <div className="td-leaders">
            {leaders.map((l) => (
              <div key={l.label} className="td-leader">
                <img
                  src={dd.champion(l.p.mostPlayedChamp || 'Garen')} alt="" loading="lazy"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }}
                  style={{ width: 40, height: 40, borderRadius: 10, objectFit: 'cover', flexShrink: 0, boxShadow: '0 0 0 1.5px var(--td-border-hov)' }}
                />
                <div style={{ minWidth: 0 }}>
                  <div className="td-over" style={{ display: 'flex', alignItems: 'center', gap: 5, color: RED }}>
                    {l.icon}{l.label}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--td-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {l.p.summonerName}
                  </div>
                  <div className="td-num" style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{l.fmt(l.p)}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Top 5 por KDA */}
          <div style={{ marginTop: 14 }}>
            <div className="td-strow td-strow-stats td-over" style={{ padding: '0 8px 8px' }}>
              <span>#</span><span>Jugador</span><span>PJ</span>
              <span className="td-st-wr">WR</span><span>KDA</span><span className="td-st-dmg" style={{ textAlign: 'right' }}>Daño/min</span>
            </div>
            {top5.map((p, i) => (
              <div key={p.summonerName + p.tagLine} className="td-strow td-strow-stats td-row-hover" style={{ padding: '8px', borderRadius: 8 }}>
                <span className="td-num" style={{ fontSize: 12.5, fontWeight: 700, color: i === 0 ? RED : 'var(--td-text-2)' }}>{i + 1}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <img
                    src={dd.champion(p.mostPlayedChamp || 'Garen')} alt="" loading="lazy"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }}
                    style={{ width: 24, height: 24, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }}
                  />
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--td-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.summonerName}
                  </span>
                </div>
                <span className="td-num" style={{ fontSize: 12, color: 'var(--td-text-2)' }}>{p.gamesPlayed}</span>
                <span className="td-num td-st-wr" style={{ fontSize: 12, color: p.winrate >= 50 ? 'var(--td-green)' : 'var(--td-neg)' }}>{p.winrate}%</span>
                <span className="td-num" style={{ fontSize: 12.5, fontWeight: 700, color: p.avgKda >= 4 ? '#fde047' : '#fff' }}>{p.avgKda.toFixed(2)}</span>
                <span className="td-num td-st-dmg" style={{ fontSize: 12, color: 'var(--td-text-2)', textAlign: 'right' }}>{Math.round(p.avgDamagePerMin)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}

// ── HERO ─────────────────────────────────────────────────────────────────────
/** Número que cuenta hasta su valor al montar (ease-out; reduced-motion: directo). */
function CountUp({ to }: { to: number }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setV(to); return; }
    let raf = 0;
    const t0 = performance.now();
    const dur = 900;
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / dur);
      setV(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to]);
  return <>{v}</>;
}

// Editorial: tipografía display de la marca, una sola línea de metadatos y la
// bolsa de premios como panel propio. Menos chips, más jerarquía.
function Hero({ data, onBracket, navigate }: {
  data: TdBoardPayload; onBracket: () => void; navigate: (to: string) => void;
}) {
  const t = data.tournament;
  const words = t.name.trim().split(/\s+/);
  const lead = words.slice(0, -1).join(' ');
  const tail = words[words.length - 1];

  const meta = [
    t.season,
    joinDates(t.startDate, t.endDate),
    t.format,
    t.region ? t.region.toUpperCase() : null,
    t.patch ? `Parche ${t.patch}` : null,
  ].filter(Boolean).join('  ·  ');

  const statusKind = t.status === 'live' ? 'live' : t.status === 'registration' ? 'registration' : 'finished';
  const statusLabel = t.status === 'live' ? 'EN DIRECTO' : t.status === 'registration' ? 'INSCRIPCIONES ABIERTAS' : 'FINALIZADO';
  const regPct = t.teamsMax > 0 ? (t.teamsRegistered / t.teamsMax) * 100 : 0;

  return (
    <Card style={{ position: 'relative', overflow: 'hidden', padding: 0 }}>
      {/* Fondo: banner del torneo (si hay) fundido a la izquierda + glow */}
      <div
        aria-hidden
        style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: t.bannerUrl
            ? `linear-gradient(90deg, var(--td-card) 34%, rgba(16,16,20,0.72) 62%, rgba(16,16,20,0.35)), url(${t.bannerUrl}) right center/cover no-repeat`
            : 'radial-gradient(110% 140% at 100% 0%, rgba(232,50,60,0.12), transparent 52%)',
        }}
      />
      {/* Filo inferior: el motivo blade de la marca */}
      <div aria-hidden style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, height: 1,
        background: 'linear-gradient(90deg, transparent, rgba(232,50,60,0.6) 30%, rgba(200,170,110,0.5) 70%, transparent)',
      }} />

      <div className="td-dash-hero" style={{ position: 'relative', padding: 'clamp(20px, 3.5vw, 32px)' }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          {/* Eyebrow: texto plano con punto vivo — sin caja */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span className="td-dot-pulse" style={{ width: 6, height: 6, borderRadius: '50%', background: RED, flexShrink: 0 }} />
            <span className="td-over" style={{ color: 'var(--td-text-2)', letterSpacing: '2.6px' }}>
              TORNEO OFICIAL · RIOT GAMES
            </span>
            <StatusChip kind={statusKind}>{statusLabel}</StatusChip>
            {t.fearless && <StatusChip kind="warn" dot={false}>FEARLESS</StatusChip>}
          </div>

          {/* Título en la display de la marca (Friz Quadrata) */}
          <h1 style={{
            fontFamily: 'var(--font-display, inherit)',
            fontSize: 'clamp(30px, 5.2vw, 46px)', fontWeight: 700, lineHeight: 1.04,
            letterSpacing: '0.5px', margin: '14px 0 8px', color: 'var(--td-text)',
          }}>
            {lead && `${lead} `}<span className="td-italic" style={{ color: RED }}>{tail}</span>
          </h1>

          {meta && (
            <p className="td-num" style={{ color: 'var(--td-muted)', fontSize: 12, letterSpacing: '0.4px', margin: 0 }}>
              {meta}
            </p>
          )}

          {/* Cupo: número protagonista + barra fina */}
          <div style={{ marginTop: 22, maxWidth: 440 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 7 }}>
              <span className="td-num" style={{ fontSize: 26, fontWeight: 700, color: 'var(--td-text)' }}>
                <CountUp to={t.teamsRegistered} />
                <span style={{ color: 'var(--td-muted)', fontWeight: 500 }}> / {t.teamsMax}</span>
              </span>
              <span className="td-over" style={{ letterSpacing: '2px' }}>EQUIPOS INSCRITOS</span>
            </div>
            <ProgressBar kind="red" pct={regPct} height={5} />
          </div>
        </div>

        {/* Derecha: premio + CTAs como panel propio */}
        <div className="td-dash-hero-right td-sub" style={{
          display: 'flex', flexDirection: 'column', gap: 12, minWidth: 236, padding: 18, alignSelf: 'stretch',
          justifyContent: 'center',
        }}>
          <div>
            <div className="td-over" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Trophy size={11} color="#c8aa6e" /> BOLSA DE PREMIOS
            </div>
            <div className="td-num" style={{ fontSize: 30, fontWeight: 700, color: '#fff', lineHeight: 1.1, marginTop: 5 }}>
              {t.prizePool || '—'}
            </div>
          </div>
          {/* Con registro externo (formulario de la liga) el botón manda ahí;
              sin él, al listado donde vive el modal de inscripción. */}
          {t.status === 'registration' && (
            <Button variant="primary" icon={<Zap size={15} />} full
              onClick={() => t.registrationUrl
                ? window.open(t.registrationUrl, '_blank', 'noopener')
                : navigate('/tournaments')}>
              INSCRIBIR EQUIPO
            </Button>
          )}
          <Button variant="secondary" icon={<ArrowRight size={15} />} full onClick={onBracket}>
            VER BRACKET
          </Button>
        </div>
      </div>
    </Card>
  );
}

function joinDates(start?: string | null, end?: string | null): string | null {
  const s = fmtDate(start);
  const e = fmtDate(end);
  if (s && e) return `${s} – ${e}`;
  return s || null;
}

// ── TILES ────────────────────────────────────────────────────────────────────
function Tiles({ t }: { t: TdBoardPayload['tournament'] }) {
  const countdown = useCountdown(t.checkinDeadline);
  // El tile refleja la configuración REAL (bracketType/series), no el texto libre
  // de la descripción (mostraba "5v5 Single Elimination" en un torneo suizo).
  const fmt = t.bracketType === 'swiss' ? 'Suizo'
    : t.bracketType === 'round_robin' ? 'Round Robin'
    : t.bracketType === 'single_elim' ? 'Eliminación'
    : (t.format || '—');
  const series = (t.seriesTo ?? 1) > 1
    ? ` · BO${(t.seriesTo! * 2) - 1}${(t.finalSeriesTo ?? t.seriesTo)! > t.seriesTo! ? ` (F: BO${(t.finalSeriesTo! * 2) - 1})` : ''}`
    : '';
  return (
    <div className="td-dash-tiles" style={{ marginTop: 18 }}>
      <StatTile value={`${t.teamsRegistered} / ${t.teamsMax}`} label="Equipos" icon={<Users size={15} color="var(--td-text-2)" />} />
      <StatTile value={`${fmt}${series}`} label="Formato" color={BLUE} icon={<Zap size={15} color={BLUE} />} />
      <StatTile value={t.patch || '—'} label="Parche" color="var(--td-green)" icon={<BarChart3 size={15} color="var(--td-green)" />} />
      <StatTile value={countdown ?? '—'} label="Check-in" color={RED} icon={<Clock size={15} color={RED} />} accentBorder />
    </div>
  );
}

// ── RESUMEN GRID ─────────────────────────────────────────────────────────────
function ResumenGrid({ data, id, navigate, onStats }: {
  data: TdBoardPayload; id: string; navigate: (to: string) => void; onStats: () => void;
}) {
  return (
    <div className="td-dash-grid">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
        {/* Las stats son el corazón del torneo: main card del resumen */}
        <StatsMainCard id={id} onFull={onStats} />
        <StandingsCard data={data} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
        <LiveCard data={data} navigate={navigate} id={id} />
        {data.tournament.fearless && <FearlessCard id={id} />}
        {data.myTeam && <MyTeamCard data={data} id={id} />}
        <ScheduleCard data={data} />
      </div>
    </div>
  );
}

// ── FEARLESS: campeones bloqueados por equipo ────────────────────────────────
function FearlessCard({ id }: { id: string }) {
  const q = useQuery({
    queryKey: ['tournament', id, 'fearless'],
    queryFn: async () => (await axiosInstance.get(`/api/tournaments/${id}/fearless`)).data as {
      gamesCounted: number;
      teams: Array<{ team: string; usedChampions: string[] }>;
      unassigned: string[]; allUsed: string[];
    },
    refetchInterval: 60_000,
  });
  const d = q.data;
  return (
    <Card accent="rgba(245,158,11,0.35)">
      <SectionHead icon={<Swords size={14} color="var(--td-amber)" />} title="FEARLESS · CAMPEONES BLOQUEADOS" />
      {!d ? (
        <Block h={80} />
      ) : d.allUsed.length === 0 ? (
        <EmptyState>Aún no hay campeones bloqueados — se llenan al terminar cada partida</EmptyState>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {d.teams.map((tm) => (
            <div key={tm.team}>
              <div className="td-over" style={{ marginBottom: 6 }}>{tm.team} · {tm.usedChampions.length}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {tm.usedChampions.map((c) => (
                  <img key={c} src={dd.champion(c)} alt={c} title={`${c} — bloqueado`} loading="lazy"
                    style={{ width: 30, height: 30, borderRadius: 7, objectFit: 'cover',
                      filter: 'grayscale(0.5)', boxShadow: '0 0 0 1.5px rgba(245,158,11,0.4)' }}
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                ))}
              </div>
            </div>
          ))}
          {d.unassigned.length > 0 && (
            <div>
              <div className="td-over" style={{ marginBottom: 6 }}>OTROS · {d.unassigned.length}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {d.unassigned.map((c) => (
                  <img key={c} src={dd.champion(c)} alt={c} title={`${c} — bloqueado`} loading="lazy"
                    style={{ width: 30, height: 30, borderRadius: 7, objectFit: 'cover', filter: 'grayscale(0.7)' }}
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                ))}
              </div>
            </div>
          )}
          <p style={{ margin: 0, fontSize: 11, color: 'var(--td-muted)' }}>
            {d.gamesCounted} partida(s) contadas · el lobby no lo bloquea automáticamente — es responsabilidad de los capitanes respetarlo
          </p>
        </div>
      )}
    </Card>
  );
}

// ── STANDINGS ────────────────────────────────────────────────────────────────
// Columnas via clases .td-strow (media queries en ResponsiveStyles): en móvil
// se ocultan WR y Racha para que no desborde.
function StandingsCard({ data }: { data: TdBoardPayload }) {
  const rows = data.standings;
  return (
    <Card>
      <SectionHead icon={<BarChart3 size={14} color={BLUE} />} title="CLASIFICACIÓN" />
      {!rows.length ? (
        <EmptyState>Sin clasificación todavía</EmptyState>
      ) : (
        <div>
          <div className="td-strow td-over" style={{ padding: '0 8px 8px' }}>
            <span>#</span><span>Equipo</span><span>W-L</span>
            <span className="td-st-wr">WR</span><span className="td-st-streak">Racha</span>
            <span style={{ textAlign: 'right' }}>Pts</span>
          </div>
          {rows.map((s) => (
            <div key={s.teamId} className="td-strow td-row-hover" style={{ padding: '9px 8px', borderRadius: 8 }}>
              <span className="td-num" style={{ fontSize: 13, fontWeight: 700, color: s.position === 1 ? RED : 'var(--td-text-2)' }}>
                {s.position}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <TeamBadge name={s.name} color={s.color} mono={s.mono} size={22} />
                <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--td-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {s.name}
                </span>
              </div>
              <span className="td-num" style={{ fontSize: 12.5, color: 'var(--td-text-2)' }}>{s.wins}-{s.losses}</span>
              <div className="td-st-wr" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1 }}><ProgressBar kind="wr" pct={s.winratePct} /></div>
                <span className="td-num" style={{ fontSize: 11.5, color: 'var(--td-text-2)', width: 34 }}>{Math.round(s.winratePct)}%</span>
              </div>
              <span className="td-st-streak">
                {s.streak ? (
                  <StatusChip kind={s.streak.type === 'W' ? 'pos' : 'warn'} dot={false}>
                    {s.streak.count}{s.streak.type}
                  </StatusChip>
                ) : (
                  <StatusChip kind="dim" dot={false}>—</StatusChip>
                )}
              </span>
              <span className="td-num" style={{ fontSize: 13, fontWeight: 700, color: '#fff', textAlign: 'right' }}>{s.points}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// ── LIVE MATCH ───────────────────────────────────────────────────────────────
function ChampPortrait({ id, ring }: { id: number; ring: 'red' | 'gray' }) {
  return (
    <img
      src={champIcon(id)}
      alt=""
      loading="lazy"
      onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }}
      style={{
        width: 26, height: 26, borderRadius: 6, objectFit: 'cover', flexShrink: 0,
        boxShadow: `0 0 0 1.5px ${ring === 'red' ? RED : 'var(--td-border-hov)'}`,
        transition: 'transform .15s',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.25)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; }}
    />
  );
}

function GoldDiffBars({ series }: { series: number[] }) {
  const bars = series.slice(-12);
  const max = Math.max(1, ...bars.map((v) => Math.abs(v)));
  return (
    <div style={{ display: 'flex', alignItems: 'stretch', gap: 3, height: 44, padding: '4px 0' }}>
      {bars.map((v, i) => {
        const positive = v >= 0;
        const h = `${(Math.abs(v) / max) * 100}%`;
        const opacity = 0.35 + (i / Math.max(1, bars.length - 1)) * 0.65;
        const barStyle: CSSProperties = {
          position: 'absolute', left: 0, right: 0, height: `calc(${h} / 2)`,
          background: positive ? BLUE : RED, opacity, borderRadius: 2,
          ...(positive ? { bottom: '50%' } : { top: '50%' }),
        };
        return (
          <div key={i} style={{ position: 'relative', flex: 1, minWidth: 0 }}>
            <div style={barStyle} />
          </div>
        );
      })}
    </div>
  );
}

function LiveCard({ data, navigate, id }: { data: TdBoardPayload; navigate: (to: string) => void; id: string }) {
  const live = data.liveMatch;
  if (!live) return <NextMatchCard data={data} />;
  const timer = live.timer != null
    ? `${pad(Math.floor(live.timer / 60))}:${pad(live.timer % 60)}`
    : null;
  return (
    <Card accent="rgba(59,130,246,0.35)">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <span className="td-dot-pulse" style={{ width: 6, height: 6, borderRadius: '50%', background: BLUE }} />
        <span className="td-over" style={{ color: 'var(--td-live-text)', letterSpacing: '2px' }}>
          EN DIRECTO · MAPA {live.game}
        </span>
        {timer && <span className="td-num" style={{ marginLeft: 'auto', fontSize: 12.5, color: 'var(--td-live-text)' }}>{timer}</span>}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <TeamCol team={live.teamA} />
        <div className="td-num" style={{ fontSize: 32, fontWeight: 700, whiteSpace: 'nowrap' }}>
          <span style={{ color: '#fff' }}>{live.teamA.score ?? 0}</span>
          <span style={{ color: RED, margin: '0 8px' }}>–</span>
          <span style={{ color: '#fff' }}>{live.teamB.score ?? 0}</span>
        </div>
        <TeamCol team={live.teamB} />
      </div>

      {(live.teamA.picks?.length || live.teamB.picks?.length) ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 16 }}>
          {!!live.teamA.picks?.length && (
            <div style={{ display: 'flex', gap: 6 }}>
              {live.teamA.picks.map((c, i) => <ChampPortrait key={i} id={c} ring="red" />)}
            </div>
          )}
          {!!live.teamB.picks?.length && (
            <div style={{ display: 'flex', gap: 6 }}>
              {live.teamB.picks.map((c, i) => <ChampPortrait key={i} id={c} ring="gray" />)}
            </div>
          )}
        </div>
      ) : null}

      {live.goldDiffSeries?.length ? <GoldDiffBars series={live.goldDiffSeries} /> : null}

      <div style={{ marginTop: 14 }}>
        <Button variant="primary" icon={<Play size={15} />} full onClick={() => navigate(`/tournaments/${id}/live`)}>ESPECTAR</Button>
      </div>
    </Card>
  );
}

function TeamCol({ team }: { team: NonNullable<TdBoardPayload['liveMatch']>['teamA'] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, textAlign: 'center', minWidth: 0, flex: 1 }}>
      <TeamBadge name={team.name} color={team.color} mono={team.mono} size={44} />
      <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--td-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
        {team.name}
      </span>
    </div>
  );
}

function NextMatchCard({ data }: { data: TdBoardPayload }) {
  const next = data.schedule[0];
  return (
    <Card accent="rgba(59,130,246,0.25)">
      <SectionHead icon={<Play size={14} color={BLUE} />} title="PRÓXIMA PARTIDA" />
      {!next ? (
        <EmptyState>No hay partidas en directo ni programadas</EmptyState>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <ScheduleTeams a={next.teamA} b={next.teamB} />
          <div style={{ textAlign: 'right' }}>
            <div className="td-num" style={{ fontSize: 15, fontWeight: 700, color: RED }}>{fmtTime(next.scheduledAt) ?? 'Por definir'}</div>
            <div className="td-over" style={{ marginTop: 2 }}>{next.roundLabel}</div>
          </div>
        </div>
      )}
    </Card>
  );
}

// ── MY TEAM ──────────────────────────────────────────────────────────────────
function MyTeamCard({ data, id }: { data: TdBoardPayload; id: string }) {
  const my = data.myTeam!;
  const countdown = useCountdown(my.checkinDeadline);
  const checkin = useCheckin(id);
  const disabled = my.checkedIn || checkin.isPending;

  const doCheckin = () => {
    // Dashboard payload only exposes the team tag; captainRiotId is resolved
    // server-side from the authenticated session. See report note.
    checkin.mutate(
      { teamName: my.tag, captainRiotId: '' },
      { onSuccess: () => toast.success('Check-in realizado') },
    );
  };

  return (
    <Card>
      <SectionHead
        icon={<Users size={14} color={RED} />}
        title={`MI EQUIPO · ${my.tag}`}
        right={
          my.checkedIn
            ? <StatusChip kind="pos" dot={false}>LISTO</StatusChip>
            : countdown
              ? <span className="td-num" style={{ fontSize: 12.5, color: 'var(--td-green)' }}>{countdown}</span>
              : null
        }
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {my.roster.length === 0 && <EmptyState>Roster vacío</EmptyState>}
        {my.roster.map((p, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {p.mainChampionId != null ? (
              <img
                src={champIcon(p.mainChampionId)} alt="" loading="lazy"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }}
                style={{ width: 28, height: 28, borderRadius: 7, objectFit: 'cover', flexShrink: 0 }}
              />
            ) : (
              <TeamBadge name={p.playerName} size={28} />
            )}
            <span
              style={{
                fontSize: 10, fontWeight: 700, color: RED, border: '1px solid var(--td-red-glow)',
                borderRadius: 999, padding: '2px 8px', minWidth: 42, textAlign: 'center', flexShrink: 0,
              }}
            >
              {p.role ? p.role.toUpperCase() : '—'}
            </span>
            <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 600, color: 'var(--td-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {p.playerName}
            </span>
            <span style={{ fontSize: 11.5, fontWeight: 600, color: p.rank?.color ?? 'var(--td-muted)', flexShrink: 0 }}>
              {p.rank ? `${p.rank.tier} ${p.rank.division}` : 'Sin rango'}
            </span>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 14 }}>
        <Button variant="primary" icon={<Check size={15} />} full disabled={disabled} onClick={doCheckin}>
          {my.checkedIn ? 'CHECK-IN COMPLETADO' : 'HACER CHECK-IN'}
        </Button>
      </div>
    </Card>
  );
}

// ── SCHEDULE ─────────────────────────────────────────────────────────────────
function ScheduleTeams({ a, b }: { a: TdBoardPayload['schedule'][number]['teamA']; b: TdBoardPayload['schedule'][number]['teamB'] }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
      <TeamBadge name={a?.name} color={a?.color} mono={a?.mono} size={22} />
      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--td-text-2)' }}>vs</span>
      <TeamBadge name={b?.name} color={b?.color} mono={b?.mono} size={22} />
    </div>
  );
}

function ScheduleCard({ data }: { data: TdBoardPayload }) {
  const activity = data.activityByDay;
  const peak = useMemo(() => Math.max(0, ...activity.map((d) => d.games)), [activity]);
  const DAY_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

  return (
    <Card>
      <SectionHead icon={<Calendar size={14} color={BLUE} />} title="PRÓXIMAS PARTIDAS" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {data.schedule.length === 0 && <EmptyState>No hay partidas programadas</EmptyState>}
        {data.schedule.map((s) => (
          <div key={s.matchId} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 4px' }}>
            <span className="td-num" style={{ fontSize: 12.5, fontWeight: 700, color: RED, width: 52, flexShrink: 0 }}>
              {fmtTime(s.scheduledAt) ?? 'S/D'}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <ScheduleTeams a={s.teamA} b={s.teamB} />
              <div className="td-over" style={{ marginTop: 3 }}>{s.roundLabel}</div>
            </div>
          </div>
        ))}
      </div>

      {activity.length > 1 && (
        <div style={{ marginTop: 16, borderTop: '1px solid var(--td-border)', paddingTop: 14 }}>
          <div className="td-over" style={{ marginBottom: 10 }}>PARTIDAS POR DÍA</div>
          {/* Barras con ancho acotado: con pocos días, una barra flex:1 se veía
              como un bloque rojo gigante. Solo se muestra con 2+ días. */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', height: 60, justifyContent: 'flex-start' }}>
            {activity.slice(0, 7).map((d, i) => {
              const h = peak > 0 ? Math.max(6, (d.games / peak) * 48) : 6;
              const isPeak = d.games === peak && peak > 0;
              return (
                <div key={i} style={{ width: 34, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }} title={`${d.day}: ${d.games}`}>
                  <div style={{ width: '100%', height: h, borderRadius: 4, background: isPeak ? RED : 'var(--td-sunken)' }} />
                  <span className="td-over" style={{ fontSize: 8 }}>{DAY_LABELS[i] ?? d.day.slice(0, 1)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
}

// ── ADMIN PANEL (solo organizador) ───────────────────────────────────────────
function AdminPanel({ id, phase, bracketType, seriesTo, finalSeriesTo, swissRounds, isPrivate }: {
  id: string; phase: string; bracketType?: string; seriesTo?: number; finalSeriesTo?: number;
  swissRounds?: number | null; isPrivate?: boolean;
}) {
  const closeReg = useCloseRegistration(id);
  const start    = useStartTournament(id);
  const codes    = useGenerateCodes(id);
  const sync     = useSyncGames(id);
  const qc       = useQueryClient();
  const [savingType, setSavingType] = useState(false);
  const canPickFormat = phase === 'registration' || phase === 'checkin';

  const patchT = async (body: object, okMsg: string) => {
    if (savingType) return;
    setSavingType(true);
    try {
      await axiosInstance.patch(`/api/tournaments/${id}`, body);
      qc.invalidateQueries({ queryKey: qk.tournamentBoard(id) });
      qc.invalidateQueries({ queryKey: qk.bracket(id) });
      toast.success(okMsg);
    } catch (e: any) {
      toast.error(e?.response?.data?.error ?? 'No se pudo guardar');
    } finally { setSavingType(false); }
  };
  const setType = (bt: string, label: string) => bt !== bracketType && patchT({ bracketType: bt }, `Formato: ${label}`);

  const [roundBusy, setRoundBusy] = useState(false);
  const nextRound = async () => {
    setRoundBusy(true);
    try {
      const { data } = await axiosInstance.post(`/api/tournaments/${id}/next-round`);
      toast.success(`Ronda ${data.round} generada (${data.matches?.length ?? 0} partidos con código)`);
      qc.invalidateQueries({ queryKey: qk.tournamentBoard(id) });
      qc.invalidateQueries({ queryKey: qk.bracket(id) });
    } catch (e: any) {
      toast.error(e?.response?.data?.error ?? 'No se pudo generar la ronda');
    } finally { setRoundBusy(false); }
  };
  const completeT = async () => {
    if (!window.confirm('¿Cerrar el torneo? El líder de la clasificación queda como campeón.')) return;
    try {
      const { data } = await axiosInstance.post(`/api/tournaments/${id}/complete`);
      toast.success(data.champion ? `🏆 Campeón: ${data.champion}` : 'Torneo finalizado');
      qc.invalidateQueries({ queryKey: qk.tournamentBoard(id) });
    } catch (e: any) {
      toast.error(e?.response?.data?.error ?? 'No se pudo finalizar');
    }
  };

  const actions: Array<{ show: boolean; label: string; icon: ReactNode; onClick: () => void; pending: boolean; primary?: boolean }> = [
    { show: phase === 'registration', label: 'CERRAR INSCRIPCIONES', icon: <Lock size={14} />, onClick: () => closeReg.mutate(), pending: closeReg.isPending },
    { show: phase === 'registration' || phase === 'checkin', label: 'INICIAR TORNEO', icon: <Play size={14} />, onClick: () => start.mutate(), pending: start.isPending, primary: true },
    { show: phase === 'active', label: 'GENERAR CÓDIGOS', icon: <KeySquare size={14} />, onClick: () => codes.mutate(20), pending: codes.isPending },
    { show: phase === 'active' || phase === 'complete', label: 'SINCRONIZAR PARTIDAS', icon: <FolderSync size={14} />, onClick: () => sync.mutate(), pending: sync.isPending, primary: phase === 'active' },
    { show: phase === 'active' && bracketType === 'swiss', label: 'SIGUIENTE RONDA', icon: <ArrowRight size={14} />, onClick: nextRound, pending: roundBusy, primary: true },
    { show: phase === 'active' && bracketType === 'swiss', label: 'FINALIZAR TORNEO', icon: <Trophy size={14} />, onClick: completeT, pending: false },
  ];
  const visible = actions.filter(a => a.show);

  // ── Invitados (torneo privado): invitar por correo + lista de accesos ──
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteBusy, setInviteBusy] = useState(false);
  const [invites, setInvites] = useState<Array<{ id: number; status: string; email: string; name: string | null }> | null>(null);
  const loadInvites = () => {
    axiosInstance.get(`/api/tournaments/${id}/invites`)
      .then(r => setInvites(Array.isArray(r.data) ? r.data : []))
      .catch(() => setInvites([]));
  };
  useEffect(() => { if (isPrivate) loadInvites(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [isPrivate, id]);
  const sendInvite = async () => {
    const email = inviteEmail.trim();
    if (!email.includes('@')) { toast.error('Correo inválido'); return; }
    setInviteBusy(true);
    try {
      const { data } = await axiosInstance.post(`/api/tournaments/${id}/invite`, { email });
      toast.success(data.message || 'Invitación enviada');
      setInviteEmail('');
      loadInvites();
    } catch (e: any) {
      toast.error(e?.response?.data?.error ?? 'No se pudo invitar');
    } finally { setInviteBusy(false); }
  };

  if (!visible.length && !canPickFormat && !isPrivate) return null;

  // Guía de fase: qué sigue, en lenguaje claro
  const stepHint =
    phase === 'registration' ? 'Paso 1 · Elige formato y series, y cuando el cupo esté listo cierra inscripciones o inicia directo.'
    : phase === 'checkin' ? 'Paso 2 · Los equipos hacen check-in. Cuando estén listos, inicia el torneo (genera la ronda 1 con códigos).'
    : phase === 'active' && bracketType === 'swiss' ? 'Torneo en curso · Al terminar todos los partidos de la ronda, genera la siguiente. Cierra el torneo tras la última ronda.'
    : phase === 'active' ? 'Torneo en curso · Los resultados y stats se detectan solos; sincroniza si algo tarda.'
    : 'Torneo finalizado.';

  const OptionBtn = ({ active, accent, label, hint, onClick }: {
    active: boolean; accent: string; label: string; hint: string; onClick: () => void;
  }) => (
    <button onClick={onClick} disabled={savingType}
      style={{
        flex: '1 1 130px', minWidth: 130, textAlign: 'left', cursor: 'pointer',
        padding: '10px 12px', borderRadius: 12, border: '1px solid',
        borderColor: active ? accent : 'var(--td-border)',
        background: active ? 'rgba(232,50,60,0.10)' : 'rgba(255,255,255,0.02)',
        transition: 'border-color .15s, background .15s',
      }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <span style={{
          width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
          background: active ? accent : 'var(--td-border-hov)',
          boxShadow: active ? `0 0 8px ${accent}` : undefined,
        }} />
        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.5px', color: active ? '#fff' : 'var(--td-text-2)' }}>{label}</span>
      </div>
      <div style={{ fontSize: 10.5, color: 'var(--td-muted)', marginTop: 3, lineHeight: 1.35 }}>{hint}</div>
    </button>
  );

  return (
    <Card accent="var(--td-red-glow)" style={{ marginTop: 16, padding: 16 }}>
      {/* Encabezado + guía de fase */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
          <Settings2 size={14} color={RED} />
          <span className="td-over" style={{ color: RED, letterSpacing: '2px' }}>PANEL DEL ORGANIZADOR</span>
        </span>
        <span style={{ fontSize: 12, color: 'var(--td-text-2)' }}>{stepHint}</span>
      </div>

      <div className="td-admin-grid">
        {/* Configuración (solo antes de iniciar) */}
        {canPickFormat && (
          <>
            <div>
              <div className="td-over" style={{ marginBottom: 8 }}>FORMATO DEL TORNEO</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <OptionBtn active={bracketType === 'single_elim'} accent="var(--td-red)" label="ELIMINACIÓN"
                  hint="Pierdes y quedas fuera. Bracket clásico." onClick={() => setType('single_elim', 'Eliminación directa')} />
                <OptionBtn active={bracketType === 'round_robin'} accent="var(--td-red)" label="LIGA · RR"
                  hint="Todos contra todos por jornadas." onClick={() => setType('round_robin', 'Round Robin')} />
                <OptionBtn active={bracketType === 'swiss'} accent="var(--td-red)" label="SUIZO"
                  hint="Pareos por récord cada ronda, sin revanchas." onClick={() => setType('swiss', 'Suizo')} />
              </div>
            </div>
            <div>
              <div className="td-over" style={{ marginBottom: 8 }}>SERIES POR ENFRENTAMIENTO</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <OptionBtn active={seriesTo === 1} accent="var(--td-amber)" label="BO1"
                  hint="Un juego decide cada enfrentamiento." onClick={() => patchT({ seriesTo: 1, finalSeriesTo: 1 }, 'Series: Bo1')} />
                <OptionBtn active={seriesTo === 2 && finalSeriesTo === 2} accent="var(--td-amber)" label="BO3"
                  hint="Gana el primero en llegar a 2 victorias." onClick={() => patchT({ seriesTo: 2, finalSeriesTo: 2 }, 'Series: Bo3')} />
                <OptionBtn active={seriesTo === 2 && finalSeriesTo === 3} accent="var(--td-amber)" label="BO3 · FINAL BO5"
                  hint="Bo3 todo el torneo; la final a 3 victorias." onClick={() => patchT({ seriesTo: 2, finalSeriesTo: 3 }, 'Series: Bo3, final Bo5')} />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Visibilidad: público (lista abierta) o privado (solo invitados) */}
      <div style={{ marginTop: 14 }}>
        <div className="td-over" style={{ marginBottom: 8 }}>VISIBILIDAD</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <OptionBtn active={!isPrivate} accent="var(--td-green)" label="PÚBLICO"
            hint="Aparece en la lista de torneos; cualquiera se inscribe."
            onClick={() => isPrivate && patchT({ isPrivate: false }, 'Torneo público')} />
          <OptionBtn active={!!isPrivate} accent="var(--td-amber)" label="PRIVADO"
            hint="Oculto al público; solo entran los que invites por correo."
            onClick={() => !isPrivate && patchT({ isPrivate: true }, 'Torneo privado — invita por correo abajo')} />
        </div>
      </div>

      {/* Invitados del torneo privado: correo → invitación por email + acceso */}
      {isPrivate && (
        <div style={{ marginTop: 14 }}>
          <div className="td-over" style={{ marginBottom: 8, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Mail size={12} /> INVITADOS · SOLO ELLOS PUEDEN VER E INSCRIBIRSE
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); sendInvite(); } }}
              placeholder="correo@delcapitan.com (debe tener cuenta ATAK.GG)"
              style={{
                flex: '1 1 260px', height: 38, padding: '0 12px', fontSize: 13,
                background: 'rgba(0,0,0,0.35)', border: '1px solid var(--td-border)',
                borderRadius: 10, color: '#fff', outline: 'none',
              }}
            />
            <Button variant="primary" icon={<Send size={13} />} disabled={inviteBusy} onClick={sendInvite}>
              {inviteBusy ? '...' : 'INVITAR'}
            </Button>
          </div>
          {invites && invites.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
              {invites.map(inv => (
                <span key={inv.id} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '5px 10px', borderRadius: 999, fontSize: 11.5,
                  border: '1px solid var(--td-border)', background: 'rgba(255,255,255,0.03)',
                  color: 'var(--td-text-2)',
                }}>
                  <span style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: inv.status === 'accepted' ? 'var(--td-green)'
                      : inv.status === 'declined' ? 'var(--td-red)' : 'var(--td-amber)',
                  }} />
                  {inv.email}
                  <span style={{ color: 'var(--td-muted)' }}>
                    {inv.status === 'accepted' ? 'aceptó' : inv.status === 'declined' ? 'rechazó' : 'pendiente'}
                  </span>
                </span>
              ))}
            </div>
          )}
          <p style={{ margin: '8px 0 0', fontSize: 11.5, color: 'var(--td-muted)' }}>
            El invitado recibe un correo y la invitación en su dashboard; con ella puede ver el torneo e inscribir a su equipo.
          </p>
        </div>
      )}

      {/* Piloto automático suizo: rondas planeadas → el sync avanza y cierra solo.
          Editable incluso con el torneo activo (es un interruptor, no toca lo jugado). */}
      {bracketType === 'swiss' && phase !== 'complete' && (
        <div style={{ marginTop: canPickFormat ? 14 : 0 }}>
          <div className="td-over" style={{ marginBottom: 8 }}>
            AVANCE AUTOMÁTICO · RONDAS PLANEADAS
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <OptionBtn active={!swissRounds} accent="var(--td-neutral)" label="MANUAL"
              hint="Tú generas cada ronda y cierras el torneo con los botones."
              onClick={() => swissRounds && patchT({ swissRounds: null }, 'Avance: manual')} />
            {[3, 4, 5].map((n) => (
              <OptionBtn key={n} active={swissRounds === n} accent="var(--td-green)" label={`${n} RONDAS`}
                hint={`Al completarse una ronda se genera la siguiente sola; la ronda ${n} usa las series de final y al terminar se cierra el torneo.`}
                onClick={() => swissRounds !== n && patchT({ swissRounds: n }, `Avance automático: ${n} rondas`)} />
            ))}
          </div>
          {swissRounds ? (
            <p style={{ margin: '8px 0 0', fontSize: 11.5, color: 'var(--td-green)' }}>
              ✓ Piloto automático activo: rondas y cierre del torneo sin intervención. Los botones manuales siguen disponibles por si necesitas corregir algo.
            </p>
          ) : (
            <p style={{ margin: '8px 0 0', fontSize: 11.5, color: 'var(--td-muted)' }}>
              Resultados y stats se detectan solos igualmente; esto solo automatiza el paso de ronda.
            </p>
          )}
        </div>
      )}

      {/* Acciones */}
      {visible.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--td-border)' }}>
          {visible.map((a) => (
            <Button key={a.label} variant={a.primary ? 'primary' : 'secondary'} icon={a.icon}
              disabled={a.pending} onClick={a.onClick}>
              {a.pending ? '...' : a.label}
            </Button>
          ))}
        </div>
      )}
    </Card>
  );
}

// ── SECONDARY TABS ───────────────────────────────────────────────────────────
function BracketTab({ id, data }: { id: string; data: TdBoardPayload }) {
  const { data: br, isLoading, isError, error, refetch } = useBracket(id);
  const activate = useActivateMatch(id);
  const report   = useReportResult(id);
  const narrow   = useMediaQuery('(max-width: 760px)');

  if (isError) {
    return (
      <ErrorCard
        message={(error as any)?.response?.data?.error ?? (error as any)?.message ?? 'No se pudo cargar el bracket'}
        onRetry={() => refetch()}
      />
    );
  }
  if (isLoading || !br) return <Block h={320} r={16} />;

  const bracket = br.bracket ?? [];
  if (!bracket.length) {
    return (
      <Card>
        <SectionHead icon={<Trophy size={14} color={RED} />} title="BRACKET COMPLETO" />
        <EmptyState>Bracket aún no generado — se crea al iniciar el torneo</EmptyState>
      </Card>
    );
  }

  const access = br.viewerAccess ?? data.viewerAccess;

  const isRR = br.bracketType === 'round_robin';
  const isSwiss = br.bracketType === 'swiss';

  // Suizo / liga: bracket de columnas por ronda con cards grandes (desktop).
  // El árbol clásico no aplica — el avance es pareo por récord.
  if ((isRR || isSwiss) && !narrow) {
    const champion = br.phase === 'complete' ? (data.standings?.[0]?.name ?? null) : null;
    return (
      <SwissBracket
        bracket={bracket as BracketMatch[]}
        bracketType={br.bracketType}
        tournamentId={id}
        isActive={br.phase === 'active'}
        canViewCodes={access === 'owner' || access === 'participant'}
        champion={champion}
      />
    );
  }

  // Lista vertical: móvil (ni el árbol ni las columnas caben)
  if (narrow || isRR || isSwiss) {
    const maxRound = Math.max(...bracket.map((m) => m.round));
    const rlabel = (r: number) => {
      if (isRR) return `Jornada ${r}`;
      if (isSwiss) return `Ronda ${r}`;
      const d = maxRound - r;
      return d === 0 ? 'Final' : d === 1 ? 'Semifinales' : d === 2 ? 'Cuartos' : `Ronda ${r}`;
    };
    const rounds = Array.from(new Set(bracket.map((m) => m.round))).sort((a, b) => a - b);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {rounds.map((r) => (
          <section key={r}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '0 2px 10px' }}>
              <span className="td-over" style={{ color: RED, letterSpacing: '2px' }}>{rlabel(r).toUpperCase()}</span>
              <div style={{ flex: 1, height: 1, background: 'var(--td-border)' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {bracket.filter((m) => m.round === r).map((m) => (
                <MatchRow key={m.id} id={id} m={m as BracketMatch} defaultOpen={false} />
              ))}
            </div>
          </section>
        ))}
      </div>
    );
  }

  return (
    <TournamentBracket
      bracket={bracket as any}
      maxRound={Math.max(...bracket.map((m) => m.round))}
      isActive={br.phase === 'active'}
      tournamentId={id}
      canViewCodes={access === 'owner' || access === 'participant'}
      canManage={access === 'owner'}
      onActivateMatch={(matchId) => activate.mutateAsync(matchId)}
      onReportResult={(matchId, winner, score1, score2) => report.mutate({ matchId, winner, score1, score2 })}
      reportingMatch={report.isPending ? (report.variables?.matchId ?? null) : null}
    />
  );
}

// ── EQUIPOS: inscripciones reales con roster ─────────────────────────────────
function EquiposTab({ id, region, standings }: {
  id: string; region: string; standings: TdBoardPayload['standings'];
}) {
  const { data: regs, isLoading, isError, error, refetch } = useRegistrations(id);

  if (isError) {
    return (
      <ErrorCard
        message={(error as any)?.response?.data?.error ?? (error as any)?.message ?? 'No se pudieron cargar los equipos'}
        onRetry={() => refetch()}
      />
    );
  }
  if (isLoading || !regs) return <Block h={260} r={16} />;
  if (!regs.length) {
    return (
      <Card>
        <SectionHead icon={<Users size={14} color={RED} />} title="EQUIPOS INSCRITOS" />
        <EmptyState>Aún no hay equipos inscritos</EmptyState>
      </Card>
    );
  }

  return <TeamsBoard regs={regs} id={id} region={region} standings={standings} />;
}

// Tablero de equipos: buscador + orden + tarjetas con estado de plantilla.
// Antes cada jugador sin confirmar pintaba un chip rojo "PENDIENTE": con 7
// jugadores por equipo la rejilla era una pared de alertas y no se distinguía
// lo importante (qué equipo está listo para jugar).
function TeamsBoard({ regs, id, region, standings }: {
  regs: NonNullable<ReturnType<typeof useRegistrations>['data']>;
  id: string; region: string; standings: TdBoardPayload['standings'];
}) {
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<'estado' | 'nombre' | 'plantilla'>('estado');
  const [openTeam, setOpenTeam] = useState<string | null>(null);

  // Iconos de perfil de LoL de todos los jugadores inscritos (una llamada batch).
  const allRiotIds = useMemo(
    () => regs.flatMap((r) => (r.players ?? []).map((p) => p.riotId || '')).filter(Boolean),
    [regs],
  );
  const { data: iconMap } = useProfileIcons(`teams-${id}`, allRiotIds, region || 'la1');

  const confirmedOf = (r: (typeof regs)[number]) =>
    (r.players ?? []).filter((p) => p.inviteStatus !== 'pending').length;

  const view = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = regs.filter((r) => {
      if (!needle) return true;
      const hay = [r.teamName, r.captainRiotId, ...(r.players ?? []).map((p) => p.riotId || p.name)]
        .filter(Boolean).join(' ').toLowerCase();
      return hay.includes(needle);
    });
    return [...list].sort((a, b) => {
      if (sort === 'nombre') return a.teamName.localeCompare(b.teamName);
      if (sort === 'plantilla') return (b.players?.length ?? 0) - (a.players?.length ?? 0);
      return Number(b.checkedIn) - Number(a.checkedIn) || a.teamName.localeCompare(b.teamName);
    });
  }, [regs, q, sort]);

  const ready = regs.filter((r) => r.checkedIn).length;
  const totalPlayers = regs.reduce((acc, r) => acc + (r.players?.length ?? 0), 0);

  const SORTS: Array<{ k: typeof sort; label: string }> = [
    { k: 'estado', label: 'Check-in' },
    { k: 'nombre', label: 'A-Z' },
    { k: 'plantilla', label: 'Plantilla' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Barra de control */}
      <div className="td-panel td-teams-bar" style={{ padding: '12px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <span className="td-ico" style={{ color: RED }}><Users size={16} /></span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--td-text)' }}>
              {regs.length} equipos inscritos
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--td-muted)' }}>
              {ready} con check-in · {totalPlayers} jugadores registrados
            </div>
          </div>
        </div>

        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar equipo, capitán o jugador…"
          className="td-teams-search"
          style={{
            height: 38, borderRadius: 999, padding: '0 16px', minWidth: 0,
            background: 'var(--td-subcard)', border: '1px solid var(--td-border)',
            color: 'var(--td-text)', fontSize: 13, fontFamily: 'var(--td-font-ui)', outline: 'none',
          }}
        />

        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          {SORTS.map((s) => (
            <button
              key={s.k}
              onClick={() => setSort(s.k)}
              style={{
                height: 32, padding: '0 13px', borderRadius: 999, cursor: 'pointer',
                fontSize: 12, fontWeight: 600, fontFamily: 'var(--td-font-ui)',
                background: sort === s.k ? 'rgba(232,50,60,0.12)' : 'transparent',
                color: sort === s.k ? '#fff' : 'var(--td-text-2)',
                border: `1px solid ${sort === s.k ? 'var(--td-red-glow)' : 'var(--td-border)'}`,
                transition: 'background .15s, border-color .15s, color .15s',
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {!view.length ? (
        <Card><EmptyState>Ningún equipo coincide con «{q}»</EmptyState></Card>
      ) : (
        <div className="td-dash-teams">
          {view.map((r) => {
            const players = r.players ?? [];
            const confirmed = confirmedOf(r);
            const pct = players.length ? (confirmed / players.length) * 100 : 0;
            return (
              <div
                key={r.teamName}
                className="td-panel td-hoverable td-card-in"
                style={{ overflow: 'hidden', cursor: 'pointer' }}
                role="button"
                tabIndex={0}
                aria-label={`Ver análisis de ${r.teamName}`}
                onClick={() => setOpenTeam(r.teamName)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpenTeam(r.teamName); } }}
              >
                {/* Cabecera */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 11, padding: 16,
                  borderBottom: '1px solid var(--td-border-soft)',
                  background: r.checkedIn
                    ? 'linear-gradient(90deg, rgba(74,222,128,0.07), transparent 60%)'
                    : 'transparent',
                }}>
                  <TeamBadge name={r.teamName} size={38} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--td-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.teamName}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--td-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      Capitán · {r.captainRiotId || '—'} · <span style={{ color: RED }}>ver análisis →</span>
                    </div>
                  </div>
                  {r.checkedIn
                    ? <StatusChip kind="pos" dot={false}>LISTO</StatusChip>
                    : <StatusChip kind="dim" dot={false}>SIN CHECK-IN</StatusChip>}
                </div>

                {/* Estado de plantilla: una barra en vez de N chips rojos */}
                <div style={{ padding: '12px 16px 10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <span className="td-over" style={{ flexShrink: 0 }}>PLANTILLA</span>
                    <div style={{ flex: 1 }}>
                      <ProgressBar kind={pct === 100 ? '#4ade80' : '#f59e0b'} pct={pct} height={5} />
                    </div>
                    <span className="td-num" style={{
                      fontSize: 12, fontWeight: 700, flexShrink: 0,
                      color: pct === 100 ? 'var(--td-green)' : 'var(--td-text-2)',
                    }}>
                      {confirmed}/{players.length}
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {players.map((p, i) => {
                      const pending = p.inviteStatus === 'pending';
                      const icon = iconFor(iconMap, p.riotId);
                      return (
                        <div key={i} className="td-roster-row">
                          <span className="td-num" style={{ fontSize: 11, color: 'var(--td-muted)', width: 16, flexShrink: 0 }}>
                            {i + 1}
                          </span>
                          {/* Icono de invocador de LoL; el punto de estado pasa a badge encima */}
                          <span style={{ position: 'relative', flexShrink: 0, width: 24, height: 24 }}>
                            {icon ? (
                              <img
                                src={dd.profileIcon(icon)} alt="" loading="lazy"
                                style={{
                                  width: 24, height: 24, borderRadius: 7, objectFit: 'cover', display: 'block',
                                  filter: pending ? 'grayscale(0.8) brightness(0.7)' : 'none',
                                  boxShadow: '0 0 0 1px var(--td-border-hov)',
                                }}
                                onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }}
                              />
                            ) : (
                              <span style={{
                                width: 24, height: 24, borderRadius: 7, display: 'flex', alignItems: 'center',
                                justifyContent: 'center', background: 'var(--td-sunken)',
                                fontSize: 10, fontWeight: 700, color: 'var(--td-muted)',
                              }}>
                                {(p.riotId || p.name || '?')[0]?.toUpperCase()}
                              </span>
                            )}
                            <span style={{
                              position: 'absolute', right: -2, bottom: -2,
                              width: 7, height: 7, borderRadius: '50%',
                              border: '1.5px solid var(--td-card)',
                              background: pending ? 'var(--td-amber)' : 'var(--td-green)',
                            }} />
                          </span>
                          <span style={{
                            flex: 1, minWidth: 0, fontSize: 12.5,
                            color: pending ? 'var(--td-muted)' : 'var(--td-text)',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {p.riotId || p.name}
                          </span>
                          {pending && (
                            <span style={{ fontSize: 10.5, color: 'var(--td-amber)', flexShrink: 0 }}>pendiente</span>
                          )}
                        </div>
                      );
                    })}
                    {!players.length && <EmptyState>Sin jugadores registrados</EmptyState>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de análisis del equipo */}
      {openTeam && (() => {
        const r = regs.find((x) => x.teamName === openTeam);
        if (!r) return null;
        return (
          <TournamentTeamModal
            tournamentId={id}
            region={region}
            reg={r}
            standing={standings.find((s) => s.name === r.teamName) ?? null}
            onClose={() => setOpenTeam(null)}
          />
        );
      })()}
    </div>
  );
}

// ── PARTIDAS: bracket crudo + stats reales por partido ───────────────────────
function PartidasTab({ id }: { id: string }) {
  const { data, isLoading, isError, error, refetch } = useBracket(id);

  if (isError) {
    return (
      <ErrorCard
        message={(error as any)?.response?.data?.error ?? (error as any)?.message ?? 'No se pudo cargar el bracket'}
        onRetry={() => refetch()}
      />
    );
  }
  if (isLoading || !data) return <Block h={280} r={16} />;

  const matches = (data.bracket ?? []).filter(
    (m) => m.team1 && m.team2 && m.team1 !== 'BYE' && m.team2 !== 'BYE',
  );
  if (!matches.length) {
    return (
      <Card>
        <SectionHead icon={<Swords size={14} color={RED} />} title="PARTIDAS" />
        <EmptyState>Aún no hay partidas — se crean al iniciar el torneo</EmptyState>
      </Card>
    );
  }

  const maxRound = Math.max(...matches.map((m) => m.round));
  const rlabel = (r: number) => {
    if (data.bracketType === 'round_robin') return `Jornada ${r}`;
    if (data.bracketType === 'swiss') return `Ronda ${r}`;
    const d = maxRound - r;
    return d === 0 ? 'Final' : d === 1 ? 'Semifinales' : d === 2 ? 'Cuartos' : `Ronda ${r}`;
  };

  // Agrupado por ronda, stats colapsables: con muchas partidas la página no
  // dispara N fetches a la vez ni se hace infinita. Con ≤2 partidas se abren solas.
  const rounds = Array.from(new Set(matches.map((m) => m.round))).sort((a, b) => a - b);
  const autoOpen = matches.filter((m) => m.matchStatus !== 'pending').length <= 2;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      {rounds.map((r) => (
        <section key={r}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '0 2px 10px' }}>
            <span className="td-over" style={{ color: RED, letterSpacing: '2px' }}>{rlabel(r).toUpperCase()}</span>
            <div style={{ flex: 1, height: 1, background: 'var(--td-border)' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {matches.filter((m) => m.round === r).map((m) => (
              <MatchRow key={m.id} id={id} m={m} defaultOpen={autoOpen && m.matchStatus !== 'pending'} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function MatchRow({ id, m, defaultOpen }: { id: string; m: BracketMatch; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const hasStats = m.matchStatus !== 'pending';
  const statusChip =
    m.matchStatus === 'complete' ? <StatusChip kind="pos" dot={false}>FINALIZADO</StatusChip>
    : m.matchStatus === 'active' ? <StatusChip kind="live">EN JUEGO</StatusChip>
    : m.matchStatus === 'ready' ? <StatusChip kind="registration" dot={false}>LISTO</StatusChip>
    : <StatusChip kind="dim" dot={false}>PENDIENTE</StatusChip>;

  // Serie del enfrentamiento (BO3/BO5), estampada por el backend
  const seriesTo = Number((m as any).seriesTo) || 1;
  const boLabel = seriesTo > 1 ? `BO${seriesTo * 2 - 1}` : null;

  const teamName = (name: string | null, won: boolean) => (
    <span style={{
      fontSize: 14.5, fontWeight: won ? 800 : 600,
      color: won ? '#fff' : m.winner ? 'var(--td-muted)' : 'var(--td-text-2)',
      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    }}>
      {name}
    </span>
  );

  return (
    <Card accent={m.matchStatus === 'active' ? 'rgba(59,130,246,0.35)' : undefined} style={{ padding: '16px 18px' }}>
      <button
        onClick={hasStats ? () => setOpen((o) => !o) : undefined}
        aria-expanded={open}
        className="td-match-head"
        style={{
          display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left',
          background: 'transparent', border: 'none', padding: 0,
          cursor: hasStats ? 'pointer' : 'default', color: 'inherit',
        }}
      >
        <div className="td-match-teams">
          <span className="td-match-team" style={{ justifyContent: 'flex-end' }}>
            {teamName(m.team1, m.winner === m.team1)}
            <TeamBadge name={m.team1 ?? undefined} size={34} />
          </span>
          {/* Marcador central grande — lo primero que buscas en un partido */}
          <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <span className="td-num" style={{ fontSize: 24, fontWeight: 800, color: 'var(--td-text)', whiteSpace: 'nowrap', lineHeight: 1 }}>
              <span style={{ color: m.winner === m.team1 ? '#fff' : 'var(--td-text-2)' }}>{m.score1 ?? '–'}</span>
              <span style={{ color: RED, margin: '0 10px', fontSize: 14, fontWeight: 700 }}>–</span>
              <span style={{ color: m.winner === m.team2 ? '#fff' : 'var(--td-text-2)' }}>{m.score2 ?? '–'}</span>
            </span>
            {boLabel && (
              <span className="td-num" style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '0.1em', color: '#c8aa6e' }}>
                {boLabel}
              </span>
            )}
          </span>
          <span className="td-match-team">
            <TeamBadge name={m.team2 ?? undefined} size={34} />
            {teamName(m.team2, m.winner === m.team2)}
          </span>
        </div>
        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          {statusChip}
          {hasStats && (open ? <ChevronUp size={16} color="var(--td-muted)" /> : <ChevronDown size={16} color="var(--td-muted)" />)}
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && hasStats && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <TournamentMatchStats tournamentId={id} match={m} isActive />
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

// ── STATS GLOBALES DEL TORNEO ────────────────────────────────────────────────
function StatsTab({ id }: { id: string }) {
  const { data, loading, error, refresh } = useTournamentGlobalStats({ tournamentId: id });

  if (error && !data) return <ErrorCard message={error} onRetry={refresh} />;
  if (!data) return <Block h={320} r={16} />;
  return <TournamentGlobalStats data={data} loading={loading} onRefresh={refresh} />;
}

function ReglasTab({ data }: { data: TdBoardPayload }) {
  const t = data.tournament;
  const lines = [
    `Formato: ${t.format || 'Por confirmar'}.`,
    ...(t.fearless ? ['FEARLESS DRAFT: los campeones jugados en partidas anteriores del torneo quedan bloqueados para ambos equipos. La lista de bloqueados está en el Resumen; los capitanes son responsables de respetarla en el lobby.'] : []),
    `Parche de juego: ${t.patch || 'Por confirmar'}. Región: ${t.region || '—'}.`,
    'Todos los jugadores deben completar el check-in antes del cierre indicado; los equipos sin check-in serán descalificados.',
    'Los partidos se juegan con los códigos de torneo oficiales de Riot Games. La suplantación o el uso de cuentas no verificadas conlleva descalificación.',
    'Las decisiones de los administradores del torneo son definitivas.',
  ];
  return (
    <Card>
      <SectionHead
        icon={<BarChart3 size={14} color={RED} />}
        title="REGLAS DEL TORNEO"
        right={t.rulesUrl ? (
          <Button variant="secondary" icon={<ScrollText size={14} />}
            onClick={() => window.open(t.rulesUrl!, '_blank', 'noopener')}>
            ABRIR PDF
          </Button>
        ) : undefined}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {lines.map((l, i) => (
          <p key={i} style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: 'var(--td-text-2)' }}>{l}</p>
        ))}
      </div>
      {/* Reglamento oficial embebido (PDF) */}
      {t.rulesUrl && (
        <div style={{ marginTop: 16, borderRadius: 12, overflow: 'hidden', background: '#1a1a20' }}>
          <iframe
            src={`${t.rulesUrl}#view=FitH`}
            title="Reglamento oficial"
            style={{ width: '100%', height: '75vh', border: 'none', display: 'block' }}
          />
        </div>
      )}
    </Card>
  );
}

// ── EMPTY STATE ──────────────────────────────────────────────────────────────
function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div style={{ padding: '20px 8px', textAlign: 'center', fontSize: 12.5, color: 'var(--td-muted)' }}>
      {children}
    </div>
  );
}

// ── SKELETON ─────────────────────────────────────────────────────────────────
function Block({ h, r = 14 }: { h: number; r?: number }) {
  return <Skeleton variant="block" height={h} style={{ borderRadius: r, background: 'var(--td-sunken)' }} />;
}
function DashboardSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <Block h={220} r={16} />
      <div className="td-dash-tiles">
        {Array.from({ length: 4 }).map((_, i) => <Block key={i} h={84} />)}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} variant="block" width={90} height={34} style={{ borderRadius: 999, background: 'var(--td-sunken)' }} />)}
      </div>
      <div className="td-dash-grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Block h={260} r={16} /><Block h={320} r={16} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Block h={280} r={16} /><Block h={240} r={16} /><Block h={260} r={16} />
        </div>
      </div>
    </div>
  );
}

// ── RESPONSIVE STYLES (scoped to .td-dash) ───────────────────────────────────
function ResponsiveStyles() {
  return (
    <style>{`
      /* Guardas anti-desborde: nada dentro del dashboard provoca scroll lateral */
      .td-dash { overflow-x: clip; }
      .td-dash-tiles > *, .td-dash-grid > *, .td-dash-teams > * { min-width: 0; }

      .td-dash-hero { display: flex; gap: 28px; justify-content: space-between; align-items: center; }
      .td-dash-tiles { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
      .td-dash-grid { display: grid; grid-template-columns: minmax(0,1fr) 400px; gap: 16px; align-items: start; }
      .td-dash-bracket { overflow-x: auto; }

      /* Panel del organizador: configuración en 2 columnas */
      .td-admin-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
      @media (max-width: 900px) { .td-admin-grid { grid-template-columns: 1fr; } }

      /* Shell: sidebar (desktop) / nav flotante inferior (móvil) */
      .td-shell { display: grid; grid-template-columns: 212px minmax(0, 1fr); gap: 18px; align-items: start; margin-top: 22px; }
      .td-side { position: sticky; top: 84px; }

      /* Standings / tablas compactas */
      .td-strow { display: grid; grid-template-columns: 30px minmax(0,1fr) 64px 150px 92px 46px; gap: 10px; align-items: center; }
      .td-strow-stats { grid-template-columns: 26px minmax(0,1fr) 40px 56px 60px 80px; }
      .td-row-hover { transition: background .15s; }
      .td-row-hover:hover { background: rgba(255,255,255,0.02); }

      /* Equipos */
      .td-dash-teams { display: grid; grid-template-columns: repeat(auto-fill, minmax(330px, 1fr)); gap: 16px; align-items: start; }
      .td-teams-bar { display: grid; grid-template-columns: minmax(0,1fr) minmax(220px, 320px) auto; gap: 14px; align-items: center; }
      .td-teams-search:focus { border-color: var(--td-red-glow) !important; }
      .td-roster-row { display: flex; align-items: center; gap: 9px; padding: 6px 8px; margin: 0 -8px;
        border-radius: 8px; transition: background .15s; }
      .td-roster-row:hover { background: rgba(255,255,255,0.03); }
      @media (max-width: 860px) {
        .td-teams-bar { grid-template-columns: 1fr; }
      }

      /* Líderes de stats */
      .td-leaders { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
      .td-leader { display: flex; align-items: center; gap: 10px; padding: 12px; border-radius: 12px;
        background: var(--td-subcard); border: 1px solid var(--td-border); min-width: 0; }

      /* Partido (fila colapsable) */
      .td-match-teams { display: grid; grid-template-columns: minmax(0,1fr) auto minmax(0,1fr); gap: 12px; align-items: center; flex: 1; min-width: 0; }
      .td-match-team { display: flex; align-items: center; gap: 8px; min-width: 0; }

      .td-spin { animation: td-rot 1s linear infinite; }
      @keyframes td-rot { to { transform: rotate(360deg); } }

      @media (max-width: 1280px) {
        .td-dash-grid { grid-template-columns: minmax(0,1fr) 360px; }
      }
      @media (max-width: 1100px) {
        .td-shell { grid-template-columns: 1fr; }
        .td-side { display: none; }
        .td-bottomnav { display: flex !important; }
        .td-dash-grid { grid-template-columns: 1fr; }
        .td-dash-tiles { grid-template-columns: repeat(2, 1fr); }
      }
      @media (max-width: 720px) {
        .td-dash-hero { flex-direction: column; }
        .td-dash-hero-right { width: 100%; }
        .td-leaders { grid-template-columns: 1fr; }
        .td-strow { grid-template-columns: 24px minmax(0,1fr) 56px 40px; }
        .td-strow .td-st-wr, .td-strow .td-st-streak, .td-strow .td-st-dmg { display: none; }
        .td-strow-stats { grid-template-columns: 24px minmax(0,1fr) 34px 56px; }
        .td-match-teams { grid-template-columns: 1fr; gap: 6px; }
        .td-match-team { justify-content: flex-start !important; }
      }
      @media (max-width: 480px) {
        .td-dash-tiles { grid-template-columns: 1fr 1fr; gap: 8px; }
        /* En pantallas mínimas el chip de icono roba el ancho del dato */
        .td-tile-ico { display: none !important; }
        .td-dash { padding-left: 14px !important; padding-right: 14px !important; }
      }
    `}</style>
  );
}
