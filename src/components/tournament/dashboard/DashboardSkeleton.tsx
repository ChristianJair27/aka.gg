// ATAK.GG — Dashboard de torneo (extraído del componente único original).
// Sin cambios de comportamiento.

import { Skeleton } from '@/components/ui/skeleton';
import { Block } from './shared';

export function DashboardSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <Block h={220} r={16} />
      <div className="td-dash-tiles">
        {Array.from({ length: 4 }).map((_, i) => <Block key={i} h={84} />)}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} variant="block" width={90} height={34} style={{ borderRadius: 999, background: 'var(--td-sunken)' }} />)}
      </div>
      <div className="td-dash-grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Block h={260} r={16} /><Block h={320} r={16} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Block h={280} r={16} /><Block h={240} r={16} /><Block h={260} r={16} />
        </div>
      </div>
    </div>
  );
}

// ── RESPONSIVE STYLES (scoped to .td-dash) ───────────────────────────────────

export function ResponsiveStyles() {
  return (
    <style>{`
      /* Guardas anti-desborde: nada dentro del dashboard provoca scroll lateral */
      .td-dash { overflow-x: clip; }
      .td-dash-tiles > *, .td-dash-grid > *, .td-dash-teams > * { min-width: 0; }

      .td-dash-hero { display: flex; gap: 28px; justify-content: space-between; align-items: center; }
      .td-dash-tiles { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
      .td-dash-grid { display: grid; grid-template-columns: minmax(0,1fr) 400px; gap: 16px; align-items: start; }
      .td-dash-bracket { overflow-x: auto; }

      /* Panel del organizador: configuración en 2 columnas */
      .td-admin-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
      @media (max-width: 900px) { .td-admin-grid { grid-template-columns: 1fr; } }

      /* Shell: sidebar (desktop) / nav flotante inferior (móvil) */
      .td-shell { display: grid; grid-template-columns: 212px minmax(0, 1fr); gap: 18px; align-items: start; margin-top: 22px; }
      .td-side { position: sticky; top: 84px; }

      /* Standings / tablas compactas */
      .td-strow { display: grid; grid-template-columns: 30px minmax(0,1fr) 64px 150px 92px 46px; gap: 10px; align-items: center; }
      .td-strow-stats { grid-template-columns: 26px minmax(0,1fr) 40px 56px 60px 80px; }
      .td-row-hover { transition: background .15s; }
      .td-row-hover:hover { background: rgba(255,255,255,0.02); }

      /* Equipos */
      .td-dash-teams { display: grid; grid-template-columns: repeat(auto-fill, minmax(330px, 1fr)); gap: 16px; align-items: start; }
      .td-teams-bar { display: grid; grid-template-columns: minmax(0,1fr) minmax(220px, 320px) auto; gap: 14px; align-items: center; }
      .td-teams-search:focus { border-color: var(--td-red-glow) !important; }
      .td-roster-row { display: flex; align-items: center; gap: 9px; padding: 6px 8px; margin: 0 -8px;
        border-radius: 8px; transition: background .15s; }
      .td-roster-row:hover { background: rgba(255,255,255,0.03); }
      @media (max-width: 860px) {
        .td-teams-bar { grid-template-columns: 1fr; }
      }

      /* Líderes de stats */
      .td-leaders { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
      .td-leader { display: flex; align-items: center; gap: 10px; padding: 12px; border-radius: 12px;
        background: var(--td-subcard); border: 1px solid var(--td-border); min-width: 0; }

      /* Partido (fila colapsable) */
      .td-match-teams { display: grid; grid-template-columns: minmax(0,1fr) auto minmax(0,1fr); gap: 12px; align-items: center; flex: 1; min-width: 0; }
      .td-match-team { display: flex; align-items: center; gap: 8px; min-width: 0; }

      .td-spin { animation: td-rot 1s linear infinite; }
      @keyframes td-rot { to { transform: rotate(360deg); } }

      @media (max-width: 1280px) {
        .td-dash-grid { grid-template-columns: minmax(0,1fr) 360px; }
      }
      @media (max-width: 1100px) {
        .td-shell { grid-template-columns: 1fr; }
        .td-side { display: none; }
        .td-bottomnav { display: flex !important; }
        .td-dash-grid { grid-template-columns: 1fr; }
        .td-dash-tiles { grid-template-columns: repeat(2, 1fr); }
      }
      @media (max-width: 720px) {
        .td-dash-hero { flex-direction: column; }
        .td-dash-hero-right { width: 100%; }
        .td-leaders { grid-template-columns: 1fr; }
        .td-strow { grid-template-columns: 24px minmax(0,1fr) 56px 40px; }
        .td-strow .td-st-wr, .td-strow .td-st-streak, .td-strow .td-st-dmg { display: none; }
        .td-strow-stats { grid-template-columns: 24px minmax(0,1fr) 34px 56px; }
        .td-match-teams { grid-template-columns: 1fr; gap: 6px; }
        .td-match-team { justify-content: flex-start !important; }
      }
      @media (max-width: 480px) {
        .td-dash-tiles { grid-template-columns: 1fr 1fr; gap: 8px; }
        /* En pantallas mínimas el chip de icono roba el ancho del dato */
        .td-tile-ico { display: none !important; }
        .td-dash { padding-left: 14px !important; padding-right: 14px !important; }
      }
    `}</style>
  );
}
