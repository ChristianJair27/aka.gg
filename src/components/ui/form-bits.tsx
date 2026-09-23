// ATAK.GG — piezas de formulario compartidas.
//
// `fieldCls` estaba copiado carácter por carácter en TournamentCreateModal y
// TournamentRegisterModal: dos copias que se iban a separar en cuanto alguien
// tocara una. Aquí queda una sola fuente, más los controles que ambos modales
// (y los que vengan) necesitan: tarjetas seleccionables, píldoras y el envoltorio
// etiqueta + ayuda + error.
import * as React from 'react';
import { cn } from '@/lib/utils';

/** Input de cristal estándar. Úsalo en todo `<input>`/`<select>` nativo. */
export const fieldCls =
  'w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white ' +
  'placeholder:text-gray-600 outline-none transition-colors focus:border-red-500/50 focus:bg-white/[0.07]';

/** Variante en rojo para un campo que no valida. */
export const fieldErrCls = 'border-red-500/60 bg-red-500/[0.06]';

export function pillCls(active: boolean, disabled = false) {
  return cn(
    'px-3 py-2 rounded-xl border text-sm font-semibold transition-all',
    disabled
      ? 'opacity-35 cursor-not-allowed border-white/[0.06] text-gray-500'
      : active
        ? 'border-red-500/60 bg-red-500/15 text-red-300 shadow-[0_0_16px_rgba(225,36,46,0.25)]'
        : 'border-white/[0.08] bg-white/[0.04] text-gray-300 hover:border-white/20 hover:bg-white/[0.07]',
  );
}

/** Etiqueta + ayuda + error alrededor de un control. */
export function Field({
  label, hint, error, required, className, children,
}: {
  label: React.ReactNode;
  hint?: React.ReactNode;
  error?: string | null;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[13px] font-medium text-gray-400">
          {label}
          {required && <span className="ml-1 text-red-400">*</span>}
        </span>
        {hint && <span className="text-[11px] leading-tight text-gray-600">{hint}</span>}
      </div>
      {children}
      {error && <p className="text-[11px] font-medium text-red-400">{error}</p>}
    </div>
  );
}

/**
 * Tarjeta seleccionable: icono, título y subtítulo. Es un `<button>` de verdad,
 * con `aria-pressed`, así que funciona con teclado y lector de pantalla.
 */
export function OptionCard({
  icon, title, sub, active, disabled, tone = 'red', onClick, className,
}: {
  icon?: React.ReactNode;
  title: React.ReactNode;
  sub?: React.ReactNode;
  active: boolean;
  disabled?: boolean;
  tone?: 'red' | 'gold';
  onClick: () => void;
  className?: string;
}) {
  const on = tone === 'gold'
    ? 'border-amber-400/60 bg-amber-400/10 shadow-[0_0_20px_rgba(240,178,50,0.15)]'
    : 'border-red-500/60 bg-red-500/10 shadow-[0_0_20px_rgba(225,36,46,0.2)]';
  const iconOn = tone === 'gold' ? 'text-amber-300' : 'text-red-400';

  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex flex-col items-start gap-1 rounded-2xl border p-3 text-left transition-all',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500/70',
        disabled
          ? 'cursor-not-allowed border-white/[0.05] bg-white/[0.02] opacity-40'
          : active
            ? on
            : 'border-white/[0.08] bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]',
        className,
      )}
    >
      {icon && <span className={cn('[&>svg]:h-4 [&>svg]:w-4', active ? iconOn : 'text-gray-500')}>{icon}</span>}
      <span className="text-sm font-bold text-white">{title}</span>
      {sub && <span className="text-[10.5px] leading-tight text-gray-500">{sub}</span>}
    </button>
  );
}

/** Grupo de píldoras exclusivas (tamaño de equipo, Bo1/Bo3…). */
export function PillGroup<T extends string | number>({
  value, options, onChange, disabledOf, className,
}: {
  value: T;
  options: Array<{ value: T; label: React.ReactNode }>;
  onChange: (v: T) => void;
  disabledOf?: (v: T) => boolean;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap gap-2', className)} role="group">
      {options.map((o) => {
        const disabled = disabledOf?.(o.value) ?? false;
        return (
          <button
            key={String(o.value)}
            type="button"
            aria-pressed={value === o.value}
            disabled={disabled}
            onClick={() => !disabled && onChange(o.value)}
            className={pillCls(value === o.value, disabled)}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Aviso en caja de color. `tone` marca la intención, no solo el color. */
export function Callout({
  tone = 'info', icon, title, children, className,
}: {
  tone?: 'info' | 'warn' | 'ok' | 'violet';
  icon?: React.ReactNode;
  title?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  const skin = {
    info: 'border-white/[0.1] bg-white/[0.03] text-gray-300',
    warn: 'border-amber-500/30 bg-amber-500/[0.07] text-amber-200',
    ok: 'border-green-500/30 bg-green-500/[0.08] text-green-200',
    violet: 'border-purple-500/25 bg-purple-500/[0.07] text-purple-200',
  }[tone];

  return (
    <div className={cn('flex items-start gap-3 rounded-2xl border p-3.5', skin, className)}>
      {icon && <span className="mt-0.5 flex-shrink-0 [&>svg]:h-4 [&>svg]:w-4">{icon}</span>}
      <div className="min-w-0 text-[12.5px] leading-relaxed">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cn(title && 'mt-1', 'text-gray-400')}>{children}</div>}
      </div>
    </div>
  );
}
