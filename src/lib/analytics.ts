// Analítica de producto (Google Analytics 4) con lo mínimo necesario:
//  - se carga solo si hay VITE_GA_MEASUREMENT_ID (en Coolify, build env) y el
//    visitante no pidió "Do Not Track";
//  - nunca en los overlays/mesa de control de OBS (no son visitas reales);
//  - vistas de página por cambio de ruta (SPA) y un puñado de eventos con
//    nombre estable, para medir el embudo: ver torneo → inscribirse, clips
//    reproducidos/compartidos, descargas del companion, publicaciones.
declare global { interface Window { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void } }

const GA_ID = (import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined) || '';
const BARE = /^\/broadcast\/[^/]+\/(overlay|control|champselect)/;
let ready = false;

function dnt(): boolean {
  try { return navigator.doNotTrack === '1' || (window as any).doNotTrack === '1'; } catch { return false; }
}

export function initAnalytics(): void {
  if (ready || !GA_ID || typeof window === 'undefined' || dnt() || BARE.test(window.location.pathname)) return;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() { window.dataLayer!.push(arguments as unknown); };
  const s = document.createElement('script');
  s.async = true; s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`;
  document.head.appendChild(s);
  window.gtag('js', new Date());
  // send_page_view: false → las vistas las manda el router (si no, GA cuenta solo la primera carga).
  window.gtag('config', GA_ID, { send_page_view: false, anonymize_ip: true });
  ready = true;
}

export function trackPageview(path: string, title?: string): void {
  if (!ready || !window.gtag) return;
  window.gtag('event', 'page_view', { page_path: path, page_title: title || document.title, page_location: window.location.href });
}

export type AtakEvent =
  | 'tournament_view' | 'tournament_tab' | 'register_open' | 'tournament_created'
  | 'clip_play' | 'clip_share' | 'reel_like' | 'reel_publish'
  | 'companion_download' | 'login_start' | 'search_player';

export function trackEvent(name: AtakEvent, params: Record<string, string | number | boolean | undefined> = {}): void {
  if (!ready || !window.gtag) return;
  const clean: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(params)) if (v !== undefined) clean[k] = typeof v === 'string' ? v.slice(0, 100) : v;
  window.gtag('event', name, clean);
}

export const analyticsEnabled = () => ready;
