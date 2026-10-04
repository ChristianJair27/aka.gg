// ATAK.GG — Dashboard de torneo (extraído del componente único original).
// Sin cambios de comportamiento.

import { Block } from './shared';

export function DashboardSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }} aria-busy="true" aria-label="Cargando torneo">
      <Block h={300} r={10} />
      <Block h={50} r={10} />
      <div className="td-dash-grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Block h={260} r={10} /><Block h={320} r={10} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Block h={280} r={10} /><Block h={240} r={10} />
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

      .td-dash-tiles { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
      .td-dash-grid { display: grid; grid-template-columns: minmax(0, 1.65fr) minmax(340px, 1fr); gap: 16px; align-items: start; }
      .td-dash-bracket { overflow-x: auto; }

      /* Panel del organizador: configuración en 2 columnas */
      .td-admin-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
      @media (max-width: 900px) { .td-admin-grid { grid-template-columns: 1fr; } }

      /* Pestañas pegajosas (tablet/escritorio) / nav flotante inferior (móvil):
         la regla vive en arena.css (.td-tabs-desktop). */

      /* Standings / tablas compactas */
      .td-strow { display: grid; grid-template-columns: 34px minmax(0,1fr) 64px 170px 92px 46px; gap: 12px; align-items: center; }
      .td-strow-stats { grid-template-columns: 34px minmax(0,1fr) 72px 72px 72px 84px; gap: 14px; }
      .td-row-hover { transition: background .15s; }

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
      .td-leader { display: flex; align-items: center; gap: 10px; padding: 12px; border-radius: 8px;
        background: var(--td-subcard); border: 1px solid var(--td-border); min-width: 0; }

      /* Partido (fila colapsable) */
      .td-match-teams { display: grid; grid-template-columns: minmax(0,1fr) auto minmax(0,1fr); gap: 12px; align-items: center; flex: 1; min-width: 0; }
      .td-match-team { display: flex; align-items: center; gap: 8px; min-width: 0; }

      .td-spin { animation: td-rot 1s linear infinite; }
      @keyframes td-rot { to { transform: rotate(360deg); } }

      @media (max-width: 1100px) {
        .td-dash-grid { grid-template-columns: 1fr; }
        .td-dash-tiles { grid-template-columns: repeat(2, 1fr); }
      }
      @media (max-width: 760px) {
        .td-tabs-desktop { display: none; }
        .td-bottomnav { display: flex !important; }
      }
      @media (max-width: 720px) {
        .td-leaders { grid-template-columns: 1fr; }
        .td-strow { grid-template-columns: 30px minmax(0,1fr) 56px 40px; }
        .td-strow .td-st-wr, .td-strow .td-st-streak, .td-strow .td-st-dmg { display: none !important; }
        .td-strow-stats { grid-template-columns: 34px minmax(0,1fr) 60px 60px; gap: 10px; }
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
