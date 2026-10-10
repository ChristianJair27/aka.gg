// ATAK.GG — Dashboard de torneo: navegación entre secciones.
//
// Una sola barra compacta para escritorio y móvil (antes: pestañas de 50 px en
// escritorio + barra flotante inferior con 8 iconos en móvil, que tapaba el
// contenido y no cabía). Son 8 secciones: una nav inferior admite 5 y esconder
// el resto bajo "Más" entierra Replays y Social, que son las más visitadas.
// Aquí el carril es pegajoso bajo la cabecera, de 44 px (tamaño táctil), con
// subrayado animado; en pantallas estrechas se desplaza en horizontal con
// snap y la sección activa se centra sola.
import { useEffect, useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Tip } from '@/components/ui/Tip';
import { NAV_ITEMS, NAV_TIPS, type Tab } from './shared';

export function TabBar({ value, onChange, live }: { value: Tab; onChange: (t: Tab) => void; live: boolean }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  // La pestaña activa siempre a la vista (en móvil el carril se desplaza).
  useEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>(`[data-key="${value}"]`);
    if (!el || !ref.current) return;
    const nav = ref.current;
    if (nav.scrollWidth <= nav.clientWidth) return;
    const left = el.offsetLeft - (nav.clientWidth - el.offsetWidth) / 2;
    nav.scrollTo({ left, behavior: reduce ? 'auto' : 'smooth' });
  }, [value, reduce]);
  return (
    <nav ref={ref} className="ax-tabs" aria-label="Secciones del torneo">
      {NAV_ITEMS.map((it) => {
        const active = value === it.key;
        return (
          <Tip key={it.key} label={NAV_TIPS[it.key]} side="bottom">
            <button
              type="button"
              className="ax-tab"
              data-key={it.key}
              data-active={active}
              aria-current={active ? 'page' : undefined}
              onClick={() => onChange(it.key)}
            >
              {it.icon}
              <span className="ax-tab-label">{it.label}</span>
              {it.key === 'resumen' && live && <span className="ax-tab-live td-dot-pulse" aria-label="En vivo" />}
              {active && (
                <motion.span
                  layoutId="ax-tab-underline"
                  className="ax-tab-underline"
                  transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 42, mass: 0.6 }}
                />
              )}
            </button>
          </Tip>
        );
      })}
    </nav>
  );
}

/** Alias histórico: el sidebar pasó a ser la barra de pestañas. */
export const SideNav = TabBar;
