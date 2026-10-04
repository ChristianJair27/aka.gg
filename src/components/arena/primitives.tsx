// Piezas de página del sistema "Arena" (ver design-system/atak-gg/MASTER.md).
// Todo lo visual vive en src/styles/arena.css; aquí solo hay marcado.
import { CSSProperties, ReactNode, useEffect, useRef, useState } from 'react';
import {
  lol, normalizeLane, normalizeClass, LANE_LABELS, CLASS_LABELS,
  type StatKey, type UiIcon as UiIconKey, type MapArt, type DragonKey,
} from '@/lib/lolAssets';

/** Retraso escalonado para .ax-rise / .ax-slide / .ax-reveal. */
export const stagger = (i: number) => ({ ['--i' as string]: i }) as CSSProperties;

// ── Raíz de página ───────────────────────────────────────────────────────────
export function ArenaPage({ children, width = 'default', className, backdrop, flush }: {
  children: ReactNode;
  width?: 'default' | 'wide' | 'narrow';
  className?: string;
  /** Capa de fondo (normalmente <SplashBackdrop />). */
  backdrop?: ReactNode;
  /** Menos aire arriba (páginas que empiezan con un héroe a sangre). */
  flush?: boolean;
}) {
  const w = width === 'wide' ? ' ax-wrap--wide' : width === 'narrow' ? ' ax-wrap--narrow' : '';
  return (
    <div className={`td-root ax-canvas${className ? ` ${className}` : ''}`}>
      {backdrop}
      <div className={`ax-wrap${w}${flush ? ' ax-wrap--flush' : ''}`}>{children}</div>
    </div>
  );
}

// ── Fondo con arte ───────────────────────────────────────────────────────────
// Decorativo: alt vacío y aria-hidden. Entra con fundido al cargar (sin parpadeo
// de imagen a medias) y, si falla la carga, simplemente no aparece.
export function SplashBackdrop({ src, champion, skin = 0, map, opacity = 0.5, position, height, side }: {
  /** URL directa; si no, se calcula de `champion` o `map`. */
  src?: string;
  champion?: string | null;
  skin?: number;
  map?: MapArt;
  opacity?: number;
  /** object-position, p. ej. "60% 20%". */
  position?: string;
  height?: string;
  /** 'right': el arte queda a la derecha y el texto respira a la izquierda. */
  side?: 'right';
}) {
  const url = src ?? (champion ? lol.splash(champion, skin) : map ? lol.map(map) : null);
  // Se guarda QUÉ url cargó (no un booleano con reset en un efecto): si la imagen
  // venía de caché, su onLoad llegaba antes que el efecto y este la volvía a
  // marcar como no cargada — el fondo se quedaba invisible.
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const loaded = !!url && loadedUrl === url;
  if (!url || failedUrl === url) return null;
  return (
    <div className="ax-backdrop" aria-hidden data-side={side}
      style={{ ['--op' as string]: opacity, ['--pos' as string]: position, ['--h' as string]: height }}>
      <img src={url} alt="" decoding="async" data-loaded={loaded}
        ref={(el) => { if (el?.complete && el.naturalWidth > 0 && loadedUrl !== url) setLoadedUrl(url); }}
        onLoad={() => setLoadedUrl(url)} onError={() => setFailedUrl(url)} />
    </div>
  );
}

// ── Héroe de página ──────────────────────────────────────────────────────────
export function PageHero({ kicker, title, lede, actions, aside, size = 'lg', children }: {
  kicker?: ReactNode;
  /** Usa <em> para la palabra en crimson y <em data-outline> para la de contorno. */
  title: ReactNode;
  lede?: ReactNode;
  actions?: ReactNode;
  /** Columna derecha: normalmente un <Champion3D />. */
  aside?: ReactNode;
  size?: 'lg' | 'md';
  children?: ReactNode;
}) {
  return (
    <header className="ax-pagehero" data-solo={aside ? undefined : 'true'}>
      <div style={{ minWidth: 0 }}>
        {kicker && <span className="td-over ax-kicker ax-rise">{kicker}</span>}
        <h1 className="ax-pagehero-title ax-rise" data-size={size} style={stagger(1)}>{title}</h1>
        {lede && <p className="ax-lede ax-rise" style={stagger(2)}>{lede}</p>}
        {actions && <div className="ax-pagehero-actions ax-rise" style={stagger(3)}>{actions}</div>}
        {children}
      </div>
      {aside && <div className="ax-pagehero-aside">{aside}</div>}
    </header>
  );
}

// ── Aparición al entrar en vista ─────────────────────────────────────────────
// Un único IntersectionObserver por elemento, se desconecta al dispararse.
export function Reveal({ children, index = 0, as: Tag = 'div', className, style }: {
  children: ReactNode; index?: number; as?: 'div' | 'section' | 'li' | 'article';
  className?: string; style?: CSSProperties;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setShown(true); return; }
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setShown(true); io.disconnect(); }
    }, { rootMargin: '0px 0px -8% 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <Tag ref={ref as any} className={`ax-reveal${className ? ` ${className}` : ''}`} data-in={shown}
      style={{ ...stagger(index), ...style }}>
      {children}
    </Tag>
  );
}

// ── Iconos de LoL (/public/lol) ──────────────────────────────────────────────
type IconProps = { size?: number; title?: string; className?: string; style?: CSSProperties };
const icon = (src: string, alt: string, { size = 20, title, className, style }: IconProps) => (
  <img className={`ax-lolicon${className ? ` ${className}` : ''}`} src={src} alt={alt} title={title}
    width={size} height={size} loading="lazy" decoding="async" style={style} />
);

/** Icono de carril. Con `label` deja de ser decorativo. */
export function RoleIcon({ lane, label, ...p }: IconProps & { lane?: string | null; label?: boolean }) {
  const l = normalizeLane(lane);
  return icon(lol.lane(l), label ? LANE_LABELS[l] : '', { title: LANE_LABELS[l], ...p });
}
/** Icono de clase (Asesino, Mago…) a partir del tag de Data Dragon. */
export function ClassIcon({ tag, ...p }: IconProps & { tag?: string | null }) {
  const c = normalizeClass(tag);
  if (!c) return null;
  return icon(lol.champClass(c), '', { title: CLASS_LABELS[c], ...p });
}
export function StatIcon({ stat, ...p }: IconProps & { stat: StatKey }) {
  return icon(lol.stat(stat), '', p);
}
export function UiIcon({ name, ...p }: IconProps & { name: UiIconKey }) {
  return icon(lol.ui(name), '', p);
}
export function DragonIcon({ dragon, ...p }: IconProps & { dragon: DragonKey }) {
  return icon(lol.dragon(dragon), '', p);
}

/** Retrato de campeón (icono cuadrado de Data Dragon). */
export function ChampIcon({ src, name, size = 40, className, style }: {
  src: string; name?: string; size?: number; className?: string; style?: CSSProperties;
}) {
  return (
    <img className={`ax-champ${className ? ` ${className}` : ''}`} src={src} alt={name ?? ''} width={size} height={size}
      loading="lazy" decoding="async" style={{ width: size, height: size, ...style }}
      onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }} />
  );
}
