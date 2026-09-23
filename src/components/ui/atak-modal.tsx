// ATAK.GG — carcasa de modal compartida.
//
// Por qué existe: en el repo convivían tres formas distintas de abrir un modal
// (shadcn Dialog con clases sueltas, createPortal a mano en TournamentTeamModal,
// y un `fixed inset-0` improvisado en TournamentDetailsPage). Cada una con su
// propio fondo, su propio radio y su propia X. Esto unifica la piel.
//
// Lo que NO reimplementa: portal, foco atrapado, bloqueo del scroll del body,
// cierre con Escape, click en el backdrop y aria-modal/labelledby. Todo eso ya
// lo da Radix Dialog, que es la base. Volver a escribirlo a mano (useFocusTrap,
// useLockBodyScroll…) solo añade superficie de error.
//
// Layout: cabecera fija · cuerpo con scroll · pie fijo. Así los botones de
// acción nunca se van fuera de pantalla en formularios largos.
import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Acento de marca del modal. Tiñe el riel superior, la X y los focos. */
export type AtakTone = 'red' | 'gold' | 'green' | 'violet';

const TONE: Record<AtakTone, string> = {
  red: '#e1242e',
  gold: '#c8aa6e',
  green: '#2fbf8a',
  violet: '#a78bfa',
};

const SIZE: Record<'sm' | 'md' | 'lg' | 'xl', string> = {
  sm: '440px',
  md: '620px',
  lg: '820px',
  xl: '1040px',
};

export const AtakModal = DialogPrimitive.Root;
export const AtakModalClose = DialogPrimitive.Close;

export interface AtakModalContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  size?: keyof typeof SIZE;
  tone?: AtakTone;
  /** Oculta la X (p. ej. mientras una operación no se puede abortar). */
  hideClose?: boolean;
  /** Desactiva la X sin ocultarla: hay algo en vuelo. */
  closeDisabled?: boolean;
}

/**
 * Contenido del modal. Espera `AtakModalHeader` / `AtakModalBody` /
 * `AtakModalFooter` como hijos, en ese orden.
 */
export const AtakModalContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  AtakModalContentProps
>(({ className, children, size = 'md', tone = 'red', hideClose, closeDisabled, style, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="atak-modal-overlay data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'atak-modal duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out',
        'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
        'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
        className,
      )}
      style={{
        maxWidth: SIZE[size],
        // El acento viaja por CSS var: el riel, la X y los focos lo leen.
        ['--atak-accent' as string]: TONE[tone],
        ...style,
      }}
      {...props}
    >
      <span className="atak-modal-frame" aria-hidden />
      {!hideClose && (
        <DialogPrimitive.Close asChild>
          <button type="button" className="atak-modal-x" aria-label="Cerrar" disabled={closeDisabled}>
            <X className="h-4 w-4" />
          </button>
        </DialogPrimitive.Close>
      )}
      {children}
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
AtakModalContent.displayName = 'AtakModalContent';

export interface AtakModalHeaderProps {
  /** Icono de marca, ya dimensionado (h-5 w-5). */
  icon?: React.ReactNode;
  /** Línea pequeña en versalitas sobre el título. */
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  tone?: AtakTone;
  /** Zona derecha: chips de estado, contador de paso, etc. */
  aside?: React.ReactNode;
  /** Fila extra bajo el texto (riel de pasos, pestañas…). */
  children?: React.ReactNode;
}

export function AtakModalHeader({
  icon, eyebrow, title, description, tone = 'red', aside, children,
}: AtakModalHeaderProps) {
  const accent = TONE[tone];
  return (
    <header className="atak-modal-head">
      <div className="flex items-start gap-3">
        {icon && (
          <span
            className="mt-0.5 grid h-9 w-9 flex-shrink-0 place-items-center rounded-xl border"
            style={{
              color: accent,
              borderColor: `${accent}33`,
              background: `${accent}1a`,
            }}
          >
            {icon}
          </span>
        )}
        <div className="min-w-0 flex-1">
          {eyebrow && (
            <p
              className="text-[10px] font-bold uppercase tracking-[0.18em]"
              style={{ color: accent }}
            >
              {eyebrow}
            </p>
          )}
          <DialogPrimitive.Title className="font-serif text-[22px] font-bold leading-tight text-white sm:text-2xl">
            {title}
          </DialogPrimitive.Title>
          {description && (
            <DialogPrimitive.Description className="mt-1 text-[13px] leading-snug text-gray-400">
              {description}
            </DialogPrimitive.Description>
          )}
        </div>
        {aside && <div className="flex-shrink-0">{aside}</div>}
      </div>
      {children && <div className="mt-4">{children}</div>}
    </header>
  );
}

export function AtakModalBody({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('atak-modal-body', className)}>{children}</div>;
}

export function AtakModalFooter({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('atak-modal-foot', className)}>{children}</div>;
}
