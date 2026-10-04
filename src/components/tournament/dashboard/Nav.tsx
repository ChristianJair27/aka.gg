// ATAK.GG — Dashboard de torneo: navegación entre secciones.
// Escritorio/tablet: barra de pestañas pegajosa bajo el héroe (antes era un
// sidebar de 212px que le quitaba ancho a las tablas). Móvil: nav inferior.

import { Tip } from '@/components/ui/Tip';
import { NAV_ITEMS, NAV_TIPS, type Tab } from './shared';

export function TabBar({ value, onChange, live }: { value: Tab; onChange: (t: Tab) => void; live: boolean }) {
  return (
    <nav className="ax-tabs" aria-label="Secciones del torneo">
      {NAV_ITEMS.map((it) => {
        const active = value === it.key;
        return (
          <Tip key={it.key} label={NAV_TIPS[it.key]} side="bottom">
            <button
              type="button"
              className="ax-tab"
              data-active={active}
              aria-current={active ? 'page' : undefined}
              onClick={() => onChange(it.key)}
            >
              {it.icon}
              {it.label}
              {it.key === 'resumen' && live && <span className="ax-tab-live td-dot-pulse" aria-label="En vivo" />}
            </button>
          </Tip>
        );
      })}
    </nav>
  );
}

/** Alias: el sidebar pasó a ser la barra de pestañas. */
export const SideNav = TabBar;

// Nav inferior flotante (móvil): barra fija con iconos, como una app nativa.
export function BottomNav({ value, onChange, live }: { value: Tab; onChange: (t: Tab) => void; live: boolean }) {
  return (
    <nav className="td-bottomnav" aria-label="Secciones del torneo">
      {NAV_ITEMS.map((it) => {
        const active = value === it.key;
        return (
          <Tip key={it.key} label={NAV_TIPS[it.key]} side="top">
          <button
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
                  width: 6, height: 6, borderRadius: '50%', background: 'var(--td-red)',
                }} />
              )}
            </span>
            <span className="td-bottomnav-label">{it.label}</span>
          </button>
          </Tip>
        );
      })}
    </nav>
  );
}
