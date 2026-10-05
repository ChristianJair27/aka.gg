// Temas de la transmisión (/broadcast/:canal y su overlay de OBS).
//  · atak — el diseño "Arena" del sitio: Barlow Condensed en itálica, crimson.
//  · lqc  — la liga, con la identidad de sus publicaciones: Orbitron en
//           itálica con resplandor, JetBrains Mono y el fondo azul con "LQC".
// El tema sale del canal (los canales "lqc…" usan el de la liga) y se puede
// forzar con ?theme=atak|lqc. El color de acento que manda el companion
// (feed.accent) pisa solo el acento, no los colores de los lados.
import type { CSSProperties } from 'react';

export type BroadcastThemeId = 'atak' | 'lqc';

export interface BroadcastTheme {
  id: BroadcastThemeId;
  /** Marca al centro del marcador (y su alto en px dentro de la celda). */
  logo: string;
  logoHeight: number;
  brand: string;
  /** Google Fonts extra que el tema necesita (el sitio ya carga Barlow). */
  fontHref?: string;
  vars: Record<string, string>;
}

const ATAK: BroadcastTheme = {
  id: 'atak',
  logo: '/atak-logo-mark.png',
  logoHeight: 32,
  brand: 'ATAK.GG',
  vars: {
    '--bo-panel': 'rgba(18, 18, 22, 0.97)',
    '--bo-strip': '#0e0e11',
    '--bo-sub': '#18181d',
    '--bo-sunken': '#272730',
    '--bo-line': 'rgba(255, 255, 255, 0.1)',
    '--bo-text': '#f5f5f6',
    '--bo-text-2': '#b6b6c0',
    '--bo-muted': '#8c8c98',
    '--bo-accent': '#e8323c',
    '--bo-blue': '#6db3ff',
    '--bo-blue-fill': '#2a6fd6',
    '--bo-red': '#ff5a64',
    '--bo-red-fill': '#e8323c',
    '--bo-gold': '#f0d891',
    '--bo-font-display': "'Barlow Condensed', 'Barlow Semi Condensed', sans-serif",
    '--bo-font-data': "'Barlow Semi Condensed', 'Barlow', sans-serif",
    '--bo-display-style': 'italic',
    '--bo-display-weight': '800',
    '--bo-display-track': '0.02em',
    '--bo-display-scale': '1',
  },
};

// Identidad de las publicaciones de la liga (instagram.com/lqro.c): títulos en
// negrita cuadrada e itálica con resplandor azul, datos en monoespaciada en
// mayúsculas con el azul de acento, y de fondo el degradado azul con el logo
// "LQC" repetido y legible (public/lqc/bg*.webp, generados desde su logo).
const LQC: BroadcastTheme = {
  id: 'lqc',
  logo: '/lqc-wordmark.png',
  logoHeight: 21,
  brand: 'LQC',
  fontHref: 'https://fonts.googleapis.com/css2?family=Orbitron:wght@800;900&family=JetBrains+Mono:wght@500;700;800&family=Anton&display=swap',
  vars: {
    '--bo-panel': 'rgba(2, 11, 28, 0.97)',
    // Marcador y tablero con el fondo de la liga (se lee "LQC" entero) bajo un
    // velo navy para que el texto mande. Cada pieza tiene su imagen a su tamaño.
    '--bo-bar-img': "linear-gradient(rgba(1, 8, 22, 0.6), rgba(1, 8, 22, 0.6)), url('/lqc/bg-bar.webp') center / cover no-repeat, #020b1c",
    '--bo-board-img': "linear-gradient(rgba(1, 8, 22, 0.52), rgba(1, 8, 22, 0.52)), url('/lqc/bg-board.webp') center / cover no-repeat, #020b1c",
    '--bo-strip': 'rgba(1, 7, 18, 0.78)',
    '--bo-sub': 'rgba(4, 22, 52, 0.9)',
    '--bo-sunken': '#0a2750',
    '--bo-line': 'rgba(96, 165, 255, 0.3)',
    '--bo-text': '#ffffff',
    '--bo-text-2': '#bcd0ee',
    '--bo-muted': '#86a2cc',
    '--bo-accent': '#2a86f0',
    '--bo-blue': '#4ea1ff',
    '--bo-blue-fill': 'linear-gradient(135deg, #0a58c8 0%, #1f7ae6 55%, #3f97ff 100%)',
    '--bo-red': '#ff6a8c',
    '--bo-red-fill': 'linear-gradient(135deg, #a50f3a 0%, #e5235a 60%, #ff3d6e 100%)',
    '--bo-gold': '#f4bd42',
    '--bo-font-display': "'Orbitron', 'Barlow Condensed', sans-serif",
    '--bo-font-data': "'JetBrains Mono', 'Barlow Semi Condensed', monospace",
    // Orbitron no trae itálica: el navegador la inclina (como el logo de la liga).
    '--bo-display-style': 'italic',
    '--bo-display-weight': '900',
    '--bo-display-track': '0.03em',
    // Orbitron es mucho más ancha que Barlow Condensed: se compensa el cuerpo.
    '--bo-display-scale': '0.7',
    '--bo-display-glow': '0 0 18px rgba(63, 151, 255, 0.7)',
  },
};

const THEMES: Record<BroadcastThemeId, BroadcastTheme> = { atak: ATAK, lqc: LQC };

export function broadcastThemeFor(channel?: string | null, override?: string | null): BroadcastTheme {
  const forced = String(override || '').toLowerCase();
  if (forced === 'atak' || forced === 'lqc') return THEMES[forced];
  return /^lqc/i.test(String(channel || '')) ? LQC : ATAK;
}

/** Variables CSS del tema (+ acento del caster si viene uno válido). */
export function broadcastVars(theme: BroadcastTheme, accent?: string | null): CSSProperties {
  const vars: Record<string, string> = { ...theme.vars };
  if (accent && /^#[0-9a-fA-F]{6}$/.test(accent)) vars['--bo-accent'] = accent;
  return vars as CSSProperties;
}

/** Carga la tipografía extra del tema una sola vez. */
export function ensureBroadcastFont(theme: BroadcastTheme): void {
  if (!theme.fontHref || typeof document === 'undefined') return;
  const id = `bo-font-${theme.id}`;
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = theme.fontHref;
  document.head.appendChild(link);
}
