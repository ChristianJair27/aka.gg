// ATAK.GG — guía de primera visita a Estadísticas.
//
// Tres pistas cortas sobre la barra de filtros (buscar, mínimo de partidas,
// click en una fila) la primera vez que alguien entra a la pestaña. No es un
// tour ni bloquea: es una tarjeta flotante anclada al panel de filtros, con
// "Entendido", y el buscador parpadea para que se vea dónde está. Se recuerda
// en localStorage (td-coach-stats) y no vuelve a salir sola.
import { useEffect, useState } from 'react';
import { Search, SlidersHorizontal, MousePointerClick, X } from 'lucide-react';
import { Button } from '@/components/tournament/ui';
import { pulseSelector, prefersReducedMotion } from '@/hooks/useTournamentDiscovery';

const KEY = 'td-coach-stats';

function seen(): boolean { try { return window.localStorage.getItem(KEY) === '1'; } catch { return false; } }
function markSeen() { try { window.localStorage.setItem(KEY, '1'); } catch { /* sin persistencia */ } }

const STEPS = [
  { icon: <Search size={14} />, title: 'Busca a un jugador', body: 'Escribe su nombre en "Buscar jugador…" o pulsa Ctrl+K. Con 109 jugadores es lo más rápido.' },
  { icon: <SlidersHorizontal size={14} />, title: 'Filtra por partidas', body: '"Mín. partidas" ≥3 quita a quien casi no ha jugado: la tabla y el podio cambian a la vez.' },
  { icon: <MousePointerClick size={14} />, title: 'Toca una fila', body: 'Abre el radar de ese jugador contra el promedio del torneo y compáralo con otro.' },
];

export function StatsCoachmarks({ playerCount }: { playerCount: number }) {
  const [open, setOpen] = useState(() => !seen());

  useEffect(() => {
    if (!open) return;
    // Resalta el buscador un momento para que la pista aterrice en algo real.
    const t = window.setTimeout(() => pulseSelector('[data-td-search]'), 400);
    return () => window.clearTimeout(t);
  }, [open]);

  if (!open) return null;
  const close = () => { markSeen(); setOpen(false); };

  return (
    <div className={`td-coach${prefersReducedMotion() ? '' : ' td-coach--in'}`} role="dialog" aria-label="Cómo usar las estadísticas">
      <button type="button" className="td-coach-x" onClick={close} aria-label="Cerrar"><X size={14} /></button>
      <div className="td-over" style={{ color: 'var(--td-red)', letterSpacing: '2px', marginBottom: 10 }}>
        PRIMERA VEZ AQUÍ · {playerCount} JUGADORES
      </div>
      <ol className="td-coach-steps">
        {STEPS.map((s, i) => (
          <li key={i} className="td-coach-step">
            <span className="td-coach-n">{i + 1}</span>
            <span className="td-coach-ico">{s.icon}</span>
            <span style={{ minWidth: 0 }}>
              <span className="td-coach-title">{s.title}</span>
              <span className="td-coach-body">{s.body}</span>
            </span>
          </li>
        ))}
      </ol>
      <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
        <Button variant="primary" onClick={close}>Entendido</Button>
      </div>
    </div>
  );
}

export default StatsCoachmarks;
