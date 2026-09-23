// Riel de pasos del asistente de creación.
//
// Es navegable hacia atrás (un paso ya visitado es un botón), nunca hacia
// delante: avanzar exige validar. El `<ol>` con aria-current deja claro al
// lector de pantalla en qué paso estás sin depender del color.
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

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
    <ol className="flex items-stretch gap-1.5">
      {steps.map((s, i) => {
        const done = i < current;
        const active = i === current;
        const reachable = i <= maxReached;
        return (
          <li key={s.key} className="min-w-0 flex-1">
            <button
              type="button"
              disabled={!reachable || active}
              aria-current={active ? 'step' : undefined}
              onClick={() => reachable && onJump(i)}
              className={cn(
                'w-full rounded-xl border px-2.5 py-2 text-left transition-all',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500/70',
                active
                  ? 'border-red-500/55 bg-red-500/10'
                  : done
                    ? 'border-white/[0.1] bg-white/[0.04] hover:border-white/25'
                    : 'border-white/[0.06] bg-white/[0.015] opacity-55',
                !reachable && 'cursor-default',
              )}
            >
              <span className="flex items-center gap-1.5">
                <span
                  className={cn(
                    'grid h-[18px] w-[18px] flex-shrink-0 place-items-center rounded-full text-[10px] font-bold',
                    done
                      ? 'bg-red-500/85 text-white'
                      : active
                        ? 'bg-red-500 text-white'
                        : 'bg-white/[0.08] text-gray-500',
                  )}
                >
                  {done ? <Check className="h-2.5 w-2.5" /> : i + 1}
                </span>
                <span
                  className={cn(
                    'truncate text-[11.5px] font-bold uppercase tracking-wide',
                    active ? 'text-white' : done ? 'text-gray-300' : 'text-gray-500',
                  )}
                >
                  {s.label}
                </span>
              </span>
              <span className="mt-0.5 block truncate text-[10.5px] leading-tight text-gray-500">
                {s.hint}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
