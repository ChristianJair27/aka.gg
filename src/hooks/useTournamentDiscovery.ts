// ATAK.GG — Descubrimiento guiado del dashboard de torneo.
//
// Estado ligero en localStorage para enseñar la interfaz SIN bloquearla: no hay
// tour modal ni pasos obligatorios, solo un banner descartable, avisos que
// aparecen una sola vez y utilidades de enlace profundo + resalte.
//
// Claves (contrato fijo, no renombrar):
//   td-discover-{tournamentId}   banner de primera visita ya visto
//   td-toast-{id}                aviso puntual ya mostrado
import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

export type DiscoveryToastKey = 'team-modal' | 'match-expand' | 'stats-108' | 'live-empty';

const DISCOVER_KEY = (tournamentId: string) => `td-discover-${tournamentId}`;
const TOAST_KEY = (id: DiscoveryToastKey) => `td-toast-${id}`;

// localStorage puede tirar (modo privado de Safari, cookies bloqueadas): en ese
// caso el descubrimiento simplemente se comporta como "primera visita" siempre,
// nunca rompe la página.
function readFlag(key: string): boolean {
  try { return window.localStorage.getItem(key) === '1'; } catch { return false; }
}
function writeFlag(key: string) {
  try { window.localStorage.setItem(key, '1'); } catch { /* sin persistencia */ }
}

export function hasSeenDiscovery(tournamentId: string): boolean {
  return readFlag(DISCOVER_KEY(tournamentId));
}
export function markDiscoverySeen(tournamentId: string): void {
  writeFlag(DISCOVER_KEY(tournamentId));
}
export function shouldShowToast(id: DiscoveryToastKey): boolean {
  return !readFlag(TOAST_KEY(id));
}
export function markToastShown(id: DiscoveryToastKey): void {
  writeFlag(TOAST_KEY(id));
}

// Un aviso educativo a la vez: si dos se disparan casi juntos (p.ej. una muestra
// que navega Y abre un modal), el segundo se descarta en vez de apilarse.
let lastToastAt = 0;
const TOAST_GAP_MS = 1200;

/**
 * Lanza un aviso educativo como mucho UNA vez por navegador y clave, y nunca
 * encima de otro. `run` recibe el control del toast (sonner) para que cada
 * llamador elija success / message / info.
 */
export function discoveryToast(id: DiscoveryToastKey, run: () => void): void {
  if (!shouldShowToast(id)) return;
  const now = Date.now();
  if (now - lastToastAt < TOAST_GAP_MS) return;
  lastToastAt = now;
  markToastShown(id);
  run();
}

export function prefersReducedMotion(): boolean {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}

/**
 * Resalta un elemento ~1.2 s para que la muestra "aterrice" en algo visible.
 * Con prefers-reduced-motion solo hace scroll: nada parpadea.
 */
export function pulseElement(el: Element | null | undefined): void {
  if (!el) return;
  el.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'center' });
  if (prefersReducedMotion()) return;
  el.classList.add('td-pulse-hint');
  window.setTimeout(() => el.classList.remove('td-pulse-hint'), 1200);
}

/** Igual que pulseElement pero esperando a que el elemento exista (tras cambiar de pestaña). */
export function pulseSelector(selector: string, timeoutMs = 2500): void {
  const started = Date.now();
  const tick = () => {
    const el = document.querySelector(selector);
    if (el) { pulseElement(el); return; }
    if (Date.now() - started < timeoutMs) window.requestAnimationFrame(tick);
  };
  window.requestAnimationFrame(tick);
}

// ── Radar de jugador: detección real de archivo ──────────────────────────────
// El radar comparativo llega en un cambio posterior. En vez de adivinar, se
// comprueba si el módulo existe en el árbol (import.meta.glob se resuelve en
// build y devuelve {} si no hay archivo). Cuando se añada PlayerRadarCard.tsx
// el chip de la muestra aparece solo, sin tocar este archivo.
const RADAR_MODULES = import.meta.glob('/src/components/tournament/PlayerRadarCard.tsx');
export const HAS_PLAYER_RADAR = Object.keys(RADAR_MODULES).length > 0;

// ── Enlaces profundos ────────────────────────────────────────────────────────
export type DiscoveryTarget = {
  tab?: string;
  /** Ronda de Partidas: número o 'all' (contrato del RoundRail). */
  round?: string | number;
  /** Abre el modal de análisis de ese equipo. */
  team?: string;
  /** Despliega y resalta esa serie. */
  match?: string;
};

/** Navegación por searchParams sin perder los filtros ya puestos por el usuario. */
export function useDiscoveryNav() {
  const [params, setParams] = useSearchParams();
  const goTo = useCallback((t: DiscoveryTarget) => {
    setParams((prev) => {
      const p = new URLSearchParams(prev);
      if (t.tab) p.set('tab', t.tab);
      if (t.round !== undefined) p.set('round', String(t.round));
      if (t.team) p.set('team', t.team); else if (t.team === '') p.delete('team');
      if (t.match) p.set('match', t.match); else if (t.match === '') p.delete('match');
      return p;
    }, { replace: true });
  }, [setParams]);

  const clearParam = useCallback((name: 'team' | 'match') => {
    setParams((prev) => { const p = new URLSearchParams(prev); p.delete(name); return p; }, { replace: true });
  }, [setParams]);

  return useMemo(() => ({ params, goTo, clearParam }), [params, goTo, clearParam]);
}

/** Estado del banner de primera visita + reapertura manual desde "Guía rápida". */
export function useDiscoveryBanner(tournamentId: string) {
  const [dismissed, setDismissed] = useState(() => hasSeenDiscovery(tournamentId));
  const dismiss = useCallback(() => {
    markDiscoverySeen(tournamentId);
    setDismissed(true);
  }, [tournamentId]);
  return { visible: !dismissed, dismiss };
}
