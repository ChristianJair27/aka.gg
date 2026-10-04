// Piezas pequeñas que comparten el detalle de partida, el espectador y el
// torneo en vivo. Solo marcado: lo visual vive en src/styles/pages/match.css.
import { ReactNode } from 'react';

/** Campeón bloqueado: retrato en gris con una raya crimson. */
export function BanTile({ src, name }: { src?: string | null; name?: string }) {
  return (
    <span className="mx-ban" title={name ? `Bloqueado: ${name}` : 'Bloqueado'}>
      {src && (
        <img src={src} alt={name ?? ''} loading="lazy" decoding="async"
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }} />
      )}
    </span>
  );
}

/** Imagen de ranura (objeto, hechizo, runa) que se vuelve una caja vacía si falla. */
export function Slot({ src, size, alt = '', round, title }: {
  src?: string | null; size: number; alt?: string; round?: boolean; title?: string;
}) {
  if (!src) {
    return <span className="mx-slot" data-empty="true" data-round={round ? 'true' : undefined}
      style={{ width: size, height: size }} aria-hidden />;
  }
  return (
    <img className="mx-slot" data-round={round ? 'true' : undefined} src={src} alt={alt} title={title}
      width={size} height={size} loading="lazy" decoding="async" style={{ width: size, height: size }}
      onError={(e) => {
        const el = e.currentTarget as HTMLImageElement;
        el.removeAttribute('src'); el.dataset.empty = 'true'; el.style.visibility = 'hidden';
      }} />
  );
}

/** K / D / A con la D en el rojo de derrota. */
export function Kda({ k, d, a }: { k: number; d: number; a: number }) {
  return (
    <span className="mx-kda">
      {k}<i>/</i><em>{d}</em><i>/</i>{a}
    </span>
  );
}

/** Estado embebido (sin partida, cargando, error) dentro de un panel. */
export function InlineState({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="mx-state" role="status">
      {icon}
      <h3>{title}</h3>
      {children}
    </div>
  );
}
