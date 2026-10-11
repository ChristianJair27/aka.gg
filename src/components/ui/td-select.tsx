// ATAK.GG — select con la piel Arena.
//
// El <select> nativo no deja estilizar el desplegable: en Windows sale la lista
// blanca del sistema con 11 px. Este envuelve Radix Select con las mismas
// superficies que los inputs (td-strip, borde, foco crimson) y un panel de
// cristal con animación corta. Accesible de serie: teclado, tipado para saltar
// a una opción, aria-* y lector de pantalla los da Radix.
//
// Uso: <TdSelect value={v} onValueChange={setV} options={[{ value, label }]} />
// Radix reserva '' para "sin valor": si tu estado usa '' como placeholder, pasa
// `placeholder` y el componente lo traduce.
import * as React from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface TdSelectOption { value: string; label: React.ReactNode; disabled?: boolean; hint?: React.ReactNode }

export function TdSelect({
  value, onValueChange, options, placeholder, disabled, id, ariaLabel, className, style, size = 'md', align = 'start',
}: {
  value: string;
  onValueChange: (v: string) => void;
  options: TdSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  ariaLabel?: string;
  className?: string;
  style?: React.CSSProperties;
  /** md = 46 px (campos de formulario), sm = 36 px (filtros en línea). */
  size?: 'md' | 'sm';
  align?: 'start' | 'center' | 'end';
}) {
  return (
    <SelectPrimitive.Root value={value || undefined} onValueChange={onValueChange} disabled={disabled}>
      <SelectPrimitive.Trigger
        id={id}
        aria-label={ariaLabel}
        className={cn('td-sel-trigger', size === 'sm' && 'td-sel-trigger--sm', className)}
        style={style}
      >
        <span className="td-sel-value"><SelectPrimitive.Value placeholder={placeholder || 'Elegir…'} /></span>
        <SelectPrimitive.Icon asChild>
          <ChevronDown className="td-sel-chevron" size={16} aria-hidden />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content className="td-root td-sel-content" position="popper" sideOffset={6} align={align} collisionPadding={12}>
          <SelectPrimitive.Viewport className="td-sel-viewport">
            {options.map((o) => (
              <SelectPrimitive.Item key={o.value} value={o.value} disabled={o.disabled} className="td-sel-item">
                <SelectPrimitive.ItemText>{o.label}</SelectPrimitive.ItemText>
                {o.hint && <span className="td-sel-hint">{o.hint}</span>}
                <SelectPrimitive.ItemIndicator className="td-sel-check"><Check size={14} aria-hidden /></SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
