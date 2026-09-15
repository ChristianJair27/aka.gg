// ATAK.GG — Dashboard de torneo. Extraído del antiguo componente único
// (src/pages/TournamentDashboardPage.tsx, ~2800 líneas). Sin cambios de
// comportamiento: solo se movió el código a su sitio.

import { CSSProperties, ReactNode, useEffect, useState } from 'react';
import {
  Trophy, Users, BarChart3, Swords, LayoutDashboard, Network, ScrollText,
  AlertTriangle, RefreshCw,
} from 'lucide-react';
import { animate } from 'framer-motion';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/tournament/ui';
import { dd } from '@/lib/dataDragon';
import type { TdBoardPayload } from '@/hooks/queries/tournaments';
import { TeamBadge } from '@/components/tournament/ui';

export const RED = 'var(--td-red)';
export const BLUE = 'var(--td-live)';

/** CommunityDragon champion icon by numeric championId (payload only gives ids). */
export const champIcon = (id: number) =>
  `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-icons/${id}.png`;

export const pad = (n: number) => String(n).padStart(2, '0');

/** Media query reactiva (sin dependencia externa). */
export function useMediaQuery(q: string): boolean {
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
export function useCountdown(target?: string | null): string | null {
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

export const fmtDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }) : null;
export const fmtTime = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : null;

// ── Small local layout helper (uses tokens; not a primitive) ─────────────────
export function Card({ children, accent, style, anchor }: {
  children: ReactNode; accent?: string; style?: CSSProperties;
  /** data-td-* para que el descubrimiento pueda localizar y resaltar la tarjeta. */
  anchor?: string;
}) {
  // Panel opaco con hairline: sobre un dashboard denso, el cristal translúcido
  // dejaba el video de fondo peleando con las tablas. El acento solo cambia el
  // color del borde (live / error / fearless).
  return (
    <div
      className="td-panel td-card-in"
      {...(anchor ? { [anchor]: '' } : null)}
      style={{ padding: 18, ...(accent ? { borderColor: accent } : null), ...style }}
    >
      {children}
    </div>
  );
}

export type Tab = 'resumen' | 'bracket' | 'equipos' | 'partidas' | 'stats' | 'reglas';

// ── Page ─────────────────────────────────────────────────────────────────────


export function ErrorCard({ message, onRetry }: { message: string; onRetry: () => void }) {
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
// Migas: de vuelta al listado sin usar el botón atrás del navegador.

export const NAV_ITEMS: Array<{ key: Tab; label: string; icon: ReactNode }> = [
  { key: 'resumen', label: 'Resumen', icon: <LayoutDashboard size={18} /> },
  { key: 'bracket', label: 'Bracket', icon: <Network size={18} /> },
  { key: 'equipos', label: 'Equipos', icon: <Users size={18} /> },
  { key: 'partidas', label: 'Partidas', icon: <Swords size={18} /> },
  { key: 'stats', label: 'Estadísticas', icon: <BarChart3 size={18} /> },
  { key: 'reglas', label: 'Reglas', icon: <ScrollText size={18} /> },
];

// Qué hay en cada sección: los iconos del nav inferior van con etiqueta mínima.
export const NAV_TIPS: Record<Tab, string> = {
  resumen: 'Directo, clasificación y líderes del torneo',
  bracket: 'Bracket por rondas con el marcador de cada serie',
  equipos: 'Equipos inscritos, plantillas y análisis',
  partidas: 'Todas las series con su scoreboard',
  stats: 'Ranking de jugadores, radar y gráficos',
  reglas: 'Reglamento y formato del torneo',
};

// Sidebar de navegación (desktop). En móvil se oculta y toma el relevo la
// BottomNav flotante.

export function CountUp({ to }: { to: number }) {
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

export function joinDates(start?: string | null, end?: string | null): string | null {
  const s = fmtDate(start);
  const e = fmtDate(end);
  if (s && e) return `${s} – ${e}`;
  return s || null;
}

// ── TILES ────────────────────────────────────────────────────────────────────

export function ChampGrid({ champs, dim }: { champs: string[]; dim?: boolean }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {champs.map((c) => (
        <img key={c} src={dd.champion(c)} alt={c} title={`${c} — bloqueado`} loading="lazy"
          style={{ width: 30, height: 30, borderRadius: 7, objectFit: 'cover',
            filter: dim ? 'grayscale(0.7)' : 'grayscale(0.5)',
            boxShadow: dim ? undefined : '0 0 0 1.5px rgba(245,158,11,0.4)' }}
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
      ))}
    </div>
  );
}

export function ChampPortrait({ id, ring }: { id: number; ring: 'red' | 'gray' }) {
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

export function TeamCol({ team }: { team: NonNullable<TdBoardPayload['liveMatch']>['teamA'] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, textAlign: 'center', minWidth: 0, flex: 1 }}>
      <TeamBadge name={team.name} color={team.color} mono={team.mono} size={44} />
      <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--td-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
        {team.name}
      </span>
    </div>
  );
}

export function ScheduleTeams({ a, b }: { a: TdBoardPayload['schedule'][number]['teamA']; b: TdBoardPayload['schedule'][number]['teamB'] }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
      <TeamBadge name={a?.name} color={a?.color} mono={a?.mono} size={22} />
      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--td-text-2)' }}>vs</span>
      <TeamBadge name={b?.name} color={b?.color} mono={b?.mono} size={22} />
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div style={{ padding: '20px 8px', textAlign: 'center', fontSize: 12.5, color: 'var(--td-muted)' }}>
      {children}
    </div>
  );
}

// ── SKELETON ─────────────────────────────────────────────────────────────────
export function Block({ h, r = 14 }: { h: number; r?: number }) {
  return <Skeleton variant="block" height={h} style={{ borderRadius: r, background: 'var(--td-sunken)' }} />;
}
