// src/components/BladeWipe.tsx — transición de ruta global "corte de daga".
// Overlay que barre la pantalla en diagonal (negro con filo rojo + hairline oro)
// en cada cambio de ruta. Decorativo y no bloqueante (pointer-events: none), así
// no interfiere con lazy-loading ni refetches. El CSS vive en index.css
// (.blade-wipe); prefers-reduced-motion lo colapsa a imperceptible.
import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

export function BladeWipe() {
  const { pathname } = useLocation();
  const [sweep, setSweep] = useState(0);
  const first = useRef(true);

  useEffect(() => {
    // No barrer en el primer render: el landing tiene su propia entrada.
    if (first.current) { first.current = false; return; }
    setSweep(s => s + 1);
  }, [pathname]);

  if (sweep === 0) return null;
  // key reinicia la animación CSS en cada navegación.
  return (
    <div key={sweep} className="blade-wipe" aria-hidden="true">
      <div className="panel" />
    </div>
  );
}
