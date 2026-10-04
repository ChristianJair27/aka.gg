// Riel de pasos del asistente de creación.
//
// Es navegable hacia atrás (un paso ya visitado es un botón), nunca hacia
// delante: avanzar exige validar. El `<ol>` con aria-current deja claro al
// lector de pantalla en qué paso estás sin depender del color.
//
// Piel "Arena": número en bloque (`ax-pos`), rótulo en la display condensada y
// una barra bajo cada paso — crimson en el activo, crimson apagado en los ya
// hechos. Estilos en src/styles/pages/tournament-forms.css (.tf-step*).
import { Check } from 'lucide-react';
import '@/styles/pages/tournament-forms.css';

export interface Step {
  key: string;
  label: string;
  hint: string;
}

export function StepRail({
  steps, current, maxReached, onJump,
}: {
  steps: Step[];
  /** Índice del paso visible. */
  current: number;
  /** Índice más lejano alcanzado: define hasta dónde se puede saltar atrás. */
  maxReached: number;
  onJump: (index: number) => void;
}) {
  return (
    <ol className="tf-steps">
      {steps.map((s, i) => {
        const done = i < current;
        const active = i === current;
        const reachable = i <= maxReached;
        return (
          <li key={s.key} style={{ minWidth: 0 }}>
            <button
              type="button"
              className="tf-step"
              data-state={active ? 'active' : reachable ? 'done' : 'todo'}
              disabled={!reachable || active}
              aria-current={active ? 'step' : undefined}
              onClick={() => reachable && onJump(i)}
            >
              <span className="ax-pos" aria-hidden>
                {done ? <Check size={15} strokeWidth={3} /> : i + 1}
              </span>
              <span className="tf-step-text">
                <span className="tf-step-label">{s.label}</span>
                <span className="tf-step-hint">{s.hint}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
