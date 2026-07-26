// src/pages/TournamentDashboardPage.tsx — Tournament DETAIL / dashboard view.
// Dark modern, red accent. Consumes useTournamentDashboard() and reuses the
// shared tournament/ui primitives (zero re-styled primitives). Router is wired
// externally; this file only renders the page for route `/tournaments/:id/...`.
import { CSSProperties, ReactNode, useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Trophy, Calendar, Clock, Users, Zap, Play, Check, ArrowRight, BarChart3,
  AlertTriangle, RefreshCw, Swords, Settings2, Lock, KeySquare, FolderSync,
  LayoutDashboard, Network, ScrollText, ChevronDown, ChevronUp, Crown, Skull, Flame,
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
  Button, StatusChip, TeamBadge, StatTile, ProgressBar, FilterPills, SectionHead,
} from '@/components/tournament/ui';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollVideoBg } from '@/components/ScrollVideoBg';
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
  // Minimalista: sin borde por defecto — degradado sutil + sombra dan la
  // separación. El borde solo aparece cuando hay acento semántico (live/error).
  return (
    <div
      className="td-card-in"
      style={{
        // Misma superficie que PANEL_SURFACE del perfil: velo translúcido sin blur
        background: 'linear-gradient(180deg, rgba(16,16,20,0.55) 0%, rgba(10,10,13,0.35) 100%)',
        border: `1px solid ${accent ?? 'transparent'}`,
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03), 0 8px 24px rgba(0,0,0,0.35)',
        borderRadius: 16, padding: 18, ...style,
      }}
    >
      {children}
    </div>
  );
}

type Tab = 'resumen' | 'bracket' | 'equipos' | 'partidas' | 'stats' | 'reglas';
const TABS: { key: Tab; label: string }[] = [
  { key: 'resumen', label: 'Resumen' }, { key: 'bracket', label: 'Bracket' },
  { key: 'equipos', label: 'Equipos' }, { key: 'partidas', label: 'Partidas' },
  { key: 'stats', label: 'Stats' }, { key: 'reglas', label: 'Reglas' },
];

// ── Page ─────────────────────────────────────────────────────────────────────
export default function TournamentDashboardPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const go = (to: string) => navigate(to);
  const [params, setParams] = useSearchParams();
  const { data, isLoading, isError, error, refetch } = useTournamentDashboard(id);

  const tab = (params.get('tab') as Tab) || 'resumen';
  const setTab = (t: Tab) =>
    setParams((prev) => { const p = new URLSearchParams(prev); p.set('tab', t); return p; }, { replace: true });

  return (
    <div className="td-root" style={{ position: 'relative', background: '#0a0a0c' }}>
      {/* Mundo ambiental compartido — mismo look que el resto de la app */}
      <ScrollVideoBg peakOpacity={0.5} floorOpacity={0.3} />
      <ResponsiveStyles />
      <div className="td-dash" style={{ maxWidth: 1560, margin: '0 auto', padding: '80px 24px 64px' }}>
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
            <Tiles t={data.tournament} />
            {data.viewerAccess === 'owner' && <AdminPanel id={id} phase={data.tournament.phase} />}
            <div className="td-shell">
              <aside className="td-side">
                <SideNav value={tab} onChange={setTab} live={data.tournament.status === 'live'} />
              </aside>
              <main style={{ minWidth: 0 }}>
                <div className="td-pills">
                  <FilterPills<Tab> items={TABS} value={tab} onChange={setTab} />
                </div>
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
                    {tab === 'equipos' && <EquiposTab id={id} />}
                    {tab === 'partidas' && <PartidasTab id={id} />}
                    {tab === 'stats' && <StatsTab id={id} />}
                    {tab === 'reglas' && <ReglasTab data={data} />}
                  </motion.div>
                </AnimatePresence>
              </main>
            </div>
          </>
        )}
      </div>
    </div>
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

function SideNav({ value, onChange, live }: { value: Tab; onChange: (t: Tab) => void; live: boolean }) {
  return (
    <nav
      aria-label="Secciones del torneo"
      style={{
        background: 'linear-gradient(180deg, rgba(16,16,20,0.55) 0%, rgba(10,10,13,0.35) 100%)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03), 0 8px 24px rgba(0,0,0,0.35)',
        borderRadius: 16, padding: 10, display: 'flex', flexDirection: 'column', gap: 4,
      }}
    >
      {NAV_ITEMS.map((it) => {
        const active = value === it.key;
        return (
          <button
            key={it.key}
            onClick={() => onChange(it.key)}
            aria-current={active ? 'page' : undefined}
            className="td-nav-item"
            style={{
              display: 'flex', alignItems: 'center', gap: 11, width: '100%',
              padding: '10px 12px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
              fontSize: 13, fontWeight: active ? 700 : 500, letterSpacing: '0.2px',
              color: active ? '#fff' : 'var(--td-text-2)',
              background: active ? 'linear-gradient(90deg, rgba(232,50,60,0.18), rgba(232,50,60,0.05))' : 'transparent',
              border: active ? '1px solid var(--td-red-glow)' : '1px solid transparent',
              transition: 'background .15s, color .15s, border-color .15s',
            }}
          >
            <span style={{ color: active ? RED : 'var(--td-muted)', display: 'inline-flex' }}>{it.icon}</span>
            <span style={{ flex: 1 }}>{it.label}</span>
            {it.key === 'resumen' && live && (
              <span className="td-dot-pulse" style={{ width: 6, height: 6, borderRadius: '50%', background: BLUE }} />
            )}
            {active && <span style={{ width: 3, height: 16, borderRadius: 2, background: RED }} />}
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
function Hero({ data, onBracket, navigate }: {
  data: TdBoardPayload; onBracket: () => void; navigate: (to: string) => void;
}) {
  const t = data.tournament;
  const words = t.name.trim().split(/\s+/);
  const lead = words.slice(0, -1).join(' ');
  const tail = words[words.length - 1];

  const subtitle = [t.season, joinDates(t.startDate, t.endDate), t.format].filter(Boolean).join(' · ');
  const statusKind = t.status === 'live' ? 'live' : t.status === 'registration' ? 'registration' : 'finished';
  const statusLabel = t.status === 'live' ? 'EN DIRECTO' : t.status === 'registration' ? 'INSCRIPCIONES' : 'FINALIZADO';
  const regPct = t.teamsMax > 0 ? (t.teamsRegistered / t.teamsMax) * 100 : 0;

  return (
    <Card
      style={{
        position: 'relative', overflow: 'hidden', padding: 30,
        // Si el torneo tiene banner, va de fondo con velo oscuro para legibilidad.
        background: t.bannerUrl
          ? `linear-gradient(90deg, rgba(10,10,12,0.92) 30%, rgba(10,10,12,0.55)), radial-gradient(120% 120% at 100% 0%, rgba(232,50,60,0.14), rgba(232,50,60,0) 45%), url(${t.bannerUrl}) center/cover no-repeat, var(--td-card)`
          : 'radial-gradient(120% 120% at 100% 0%, rgba(232,50,60,0.14), rgba(232,50,60,0) 45%), var(--td-card)',
      }}
    >
      {/* decorative giant faded motif */}
      <Trophy
        aria-hidden
        style={{
          position: 'absolute', right: 24, top: -20, width: 260, height: 260,
          color: '#fff', opacity: 0.05, transform: 'rotate(12deg)', pointerEvents: 'none',
        }}
      />
      <div className="td-dash-hero" style={{ position: 'relative' }}>
        <div style={{ minWidth: 0 }}>
          {/* pill badge */}
          <span
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7, height: 24, padding: '0 12px',
              borderRadius: 999, border: '1px solid var(--td-red-glow)', background: 'rgba(232,50,60,0.08)',
            }}
          >
            <span className="td-dot-pulse" style={{ width: 5, height: 5, borderRadius: '50%', background: RED }} />
            <Trophy size={12} color={RED} />
            <span className="td-over" style={{ color: RED, letterSpacing: '2px' }}>TORNEO OFICIAL · RIOT GAMES</span>
          </span>

          <h1 style={{ fontSize: 38, fontWeight: 700, lineHeight: 1.08, margin: '14px 0 6px', color: 'var(--td-text)' }}>
            {lead && `${lead} `}<span className="td-italic" style={{ color: RED }}>{tail}</span>
          </h1>
          {subtitle && <p style={{ color: 'var(--td-text-2)', fontSize: 14, margin: 0 }}>{subtitle}</p>}

          {/* chips */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
            <StatusChip kind={statusKind}>{statusLabel}</StatusChip>
            {t.phase && <StatusChip kind="dim" dot={false}>{t.phase.toUpperCase()}</StatusChip>}
            {t.region && <StatusChip kind="dim" dot={false}>{t.region.toUpperCase()}</StatusChip>}
          </div>

          {/* registration bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 18, maxWidth: 460 }}>
            <Users size={15} color="var(--td-text-2)" />
            <div style={{ flex: 1 }}>
              <ProgressBar kind="red" pct={regPct} />
            </div>
            <span className="td-num" style={{ fontSize: 12.5, color: 'var(--td-text)', whiteSpace: 'nowrap' }}>
              {t.teamsRegistered}/{t.teamsMax} equipos inscritos
            </span>
          </div>
        </div>

        {/* right: prize + CTAs */}
        <div className="td-dash-hero-right" style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 220 }}>
          <div>
            <div className="td-over">BOLSA DE PREMIOS</div>
            <div className="td-num" style={{ fontSize: 36, fontWeight: 700, color: '#fff', lineHeight: 1.1, marginTop: 4 }}>
              {t.prizePool || '—'}
            </div>
          </div>
          {/* La inscripción vive en el listado (/tournaments) — navegar a la
              misma página era un no-op. Solo se muestra durante inscripciones. */}
          {t.status === 'registration' && (
            <Button variant="primary" icon={<Zap size={15} />} full onClick={() => navigate('/tournaments')}>
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
  return (
    <div className="td-dash-tiles" style={{ marginTop: 18 }}>
      <StatTile value={`${t.teamsRegistered} / ${t.teamsMax}`} label="Equipos" icon={<Users size={15} color="var(--td-text-2)" />} />
      <StatTile value={t.format || '—'} label="Formato" color={BLUE} icon={<Zap size={15} color={BLUE} />} />
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
        {data.myTeam && <MyTeamCard data={data} id={id} />}
        <ScheduleCard data={data} />
      </div>
    </div>
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
function AdminPanel({ id, phase }: { id: string; phase: string }) {
  const closeReg = useCloseRegistration(id);
  const start    = useStartTournament(id);
  const codes    = useGenerateCodes(id);
  const sync     = useSyncGames(id);

  const actions: Array<{ show: boolean; label: string; icon: ReactNode; onClick: () => void; pending: boolean; primary?: boolean }> = [
    { show: phase === 'registration', label: 'CERRAR INSCRIPCIONES', icon: <Lock size={14} />, onClick: () => closeReg.mutate(), pending: closeReg.isPending },
    { show: phase === 'registration' || phase === 'checkin', label: 'INICIAR TORNEO', icon: <Play size={14} />, onClick: () => start.mutate(), pending: start.isPending, primary: true },
    { show: phase === 'active', label: 'GENERAR CÓDIGOS', icon: <KeySquare size={14} />, onClick: () => codes.mutate(20), pending: codes.isPending },
    { show: phase === 'active' || phase === 'complete', label: 'SINCRONIZAR PARTIDAS', icon: <FolderSync size={14} />, onClick: () => sync.mutate(), pending: sync.isPending, primary: phase === 'active' },
  ];
  const visible = actions.filter(a => a.show);
  if (!visible.length) return null;

  return (
    <Card accent="var(--td-red-glow)" style={{ marginTop: 16, padding: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
          <Settings2 size={14} color={RED} />
          <span className="td-over" style={{ color: RED, letterSpacing: '2px' }}>PANEL DEL ORGANIZADOR</span>
        </span>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginLeft: 'auto' }}>
          {visible.map((a) => (
            <Button key={a.label} variant={a.primary ? 'primary' : 'secondary'} icon={a.icon}
              disabled={a.pending} onClick={a.onClick}>
              {a.pending ? '...' : a.label}
            </Button>
          ))}
        </div>
      </div>
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

  // En pantallas angostas el árbol con conectores no cabe (ancho fijo por
  // columna): mostramos las rondas como lista vertical, mismo contenido.
  if (narrow) {
    const maxRound = Math.max(...bracket.map((m) => m.round));
    const rlabel = (r: number) => {
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
function EquiposTab({ id }: { id: string }) {
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

  return (
    <div className="td-dash-teams" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
      {regs.map((r) => (
        <Card key={r.teamName}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <TeamBadge name={r.teamName} size={34} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--td-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {r.teamName}
              </div>
              <div style={{ fontSize: 11, color: 'var(--td-muted)' }}>Capitán: {r.captainRiotId || '—'}</div>
            </div>
            {r.checkedIn
              ? <StatusChip kind="pos" dot={false}>LISTO</StatusChip>
              : <StatusChip kind="dim" dot={false}>SIN CHECK-IN</StatusChip>}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {(r.players ?? []).map((p, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="td-num" style={{ fontSize: 11, color: 'var(--td-muted)', width: 14 }}>{i + 1}</span>
                <span style={{ fontSize: 12.5, color: 'var(--td-text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                  {p.riotId || p.name}
                </span>
                {p.inviteStatus === 'pending' && <StatusChip kind="warn" dot={false}>PENDIENTE</StatusChip>}
              </div>
            ))}
          </div>
        </Card>
      ))}
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

  return (
    <Card accent={m.matchStatus === 'active' ? 'rgba(59,130,246,0.35)' : undefined} style={{ padding: 14 }}>
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
            <span style={{ fontSize: 13, fontWeight: m.winner === m.team1 ? 700 : 500, color: m.winner === m.team1 ? '#fff' : 'var(--td-text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {m.team1}
            </span>
            <TeamBadge name={m.team1 ?? undefined} size={26} />
          </span>
          <span className="td-num" style={{ fontSize: 15, fontWeight: 700, color: 'var(--td-text)', whiteSpace: 'nowrap' }}>
            {m.score1 ?? '–'}<span style={{ color: RED, margin: '0 7px' }}>vs</span>{m.score2 ?? '–'}
          </span>
          <span className="td-match-team">
            <TeamBadge name={m.team2 ?? undefined} size={26} />
            <span style={{ fontSize: 13, fontWeight: m.winner === m.team2 ? 700 : 500, color: m.winner === m.team2 ? '#fff' : 'var(--td-text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {m.team2}
            </span>
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
    `Parche de juego: ${t.patch || 'Por confirmar'}. Región: ${t.region || '—'}.`,
    'Todos los jugadores deben completar el check-in antes del cierre indicado; los equipos sin check-in serán descalificados.',
    'Los partidos se juegan con los códigos de torneo oficiales de Riot Games. La suplantación o el uso de cuentas no verificadas conlleva descalificación.',
    'Las decisiones de los administradores del torneo son definitivas.',
  ];
  return (
    <Card>
      <SectionHead icon={<BarChart3 size={14} color={RED} />} title="REGLAS DEL TORNEO" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {lines.map((l, i) => (
          <p key={i} style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: 'var(--td-text-2)' }}>{l}</p>
        ))}
      </div>
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
      .td-dash-hero { display: flex; gap: 28px; justify-content: space-between; align-items: flex-start; }
      .td-dash-tiles { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
      .td-dash-grid { display: grid; grid-template-columns: minmax(0,1fr) 400px; gap: 16px; align-items: start; }
      .td-dash-bracket { overflow-x: auto; }

      /* Shell: sidebar de navegación (desktop) / pills (móvil) */
      .td-shell { display: grid; grid-template-columns: 208px minmax(0, 1fr); gap: 18px; align-items: start; margin-top: 22px; }
      .td-side { position: sticky; top: 88px; }
      .td-pills { display: none; margin-bottom: 16px; }
      .td-nav-item:hover { background: rgba(255,255,255,0.04) !important; color: var(--td-text) !important; }

      /* Standings / tablas compactas */
      .td-strow { display: grid; grid-template-columns: 30px minmax(0,1fr) 64px 150px 92px 46px; gap: 10px; align-items: center; }
      .td-strow-stats { grid-template-columns: 26px minmax(0,1fr) 40px 56px 60px 80px; }
      .td-row-hover { transition: background .15s; }
      .td-row-hover:hover { background: rgba(255,255,255,0.02); }

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
        .td-pills { display: block; overflow-x: auto; -webkit-overflow-scrolling: touch; }
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
        .td-dash-tiles { grid-template-columns: 1fr 1fr; gap: 10px; }
      }
    `}</style>
  );
}
