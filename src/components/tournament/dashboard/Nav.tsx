// ATAK.GG — Dashboard de torneo (extraído del componente único original).
// Sin cambios de comportamiento.

import { Tip } from '@/components/ui/Tip';
import { BLUE, RED, NAV_ITEMS, NAV_TIPS, type Tab } from './shared';

export function SideNav({ value, onChange, live }: { value: Tab; onChange: (t: Tab) => void; live: boolean }) {
  return (
    <nav className="td-panel" aria-label="Secciones del torneo" style={{ padding: 8 }}>
      <div className="td-over" style={{ padding: '8px 12px 10px', letterSpacing: '2.4px' }}>TORNEO</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {NAV_ITEMS.map((it) => {
          const active = value === it.key;
          return (
            <button
              key={it.key}
              onClick={() => onChange(it.key)}
              aria-current={active ? 'page' : undefined}
              className="td-nav-item"
              data-active={active}
            >
              <span className="td-nav-ind" aria-hidden />
              <span style={{ color: active ? RED : 'var(--td-muted)', display: 'inline-flex' }}>{it.icon}</span>
              <span style={{ flex: 1 }}>{it.label}</span>
              {it.key === 'resumen' && live && (
                <span className="td-dot-pulse" style={{ width: 6, height: 6, borderRadius: '50%', background: BLUE }} />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

// Nav inferior flotante (móvil): pastilla fija con iconos, como una app nativa.
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
                  width: 6, height: 6, borderRadius: '50%', background: BLUE,
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

// ── STATS PRINCIPALES (main card del Resumen) ────────────────────────────────
