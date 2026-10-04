// Piezas de formulario del sistema "Arena" para los formularios y modales de
// torneo (panel de la portada, asistente de creación, inscripción, organizador).
//
// Sustituyen a las de `ui/form-bits` (cristal, píldoras, textos de 10px) con
// las clases de arena.css: td-field / td-label / td-input, td-seg, ax-artcard.
// Todo lo visual vive en src/styles/pages/tournament-forms.css y solo funciona
// dentro de `.td-root` — en un portal de Radix hay que ponerlo en el contenido.
import type { ReactNode } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Check } from 'lucide-react';
import { lol, mapArtFor } from '@/lib/lolAssets';
import '@/styles/pages/tournament-forms.css';

export type GameMap = 'SR' | 'ARAM' | 'ARENA';

/** className para `AtakModalContent`: mete el portal en el tema Arena. */
export const ARENA_MODAL = 'td-root tf-modal';

// ── Cabecera de modal ────────────────────────────────────────────────────────
// Usa Title/Description de Radix para que el diálogo siga anunciándose bien.
export function ModalHead({ kicker, title, description, children }: {
  kicker?: ReactNode;
  /** `<em>` pinta la palabra en crimson. */
  title: ReactNode;
  description?: ReactNode;
  /** Fila pegada al borde inferior (riel de pasos). */
  children?: ReactNode;
}) {
  return (
    <header className="atak-modal-head" data-rail={children ? 'true' : undefined}>
      {kicker && <span className="td-over ax-kicker">{kicker}</span>}
      <DialogPrimitive.Title className="tf-title">{title}</DialogPrimitive.Title>
      {description && (
        <DialogPrimitive.Description className="tf-desc">{description}</DialogPrimitive.Description>
      )}
      {children}
    </header>
  );
}

// ── Campo: etiqueta visible + control + ayuda/error junto al campo ───────────
export function Field({ label, hint, error, required, htmlFor, className, children }: {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  required?: boolean;
  /** id del control. Sin él la etiqueta es un rótulo de grupo (segmentados, tarjetas). */
  htmlFor?: string;
  className?: string;
  children: ReactNode;
}) {
  const text = <>{label}{required && <span className="tf-req" aria-hidden>*</span>}</>;
  return (
    <div className={`td-field${className ? ` ${className}` : ''}`}>
      {htmlFor
        ? <label className="td-label" htmlFor={htmlFor}>{text}</label>
        : <span className="td-label">{text}</span>}
      {children}
      {error
        ? <p className="td-error" role="alert">{error}</p>
        : hint ? <p className="td-help">{hint}</p> : null}
    </div>
  );
}

// ── Control segmentado (tamaño de equipo, formato, series…) ──────────────────
export function Seg<T extends string | number>({ value, options, onChange, disabledOf, ariaLabel, fit }: {
  value: T;
  options: Array<{ value: T; label: ReactNode }>;
  onChange: (v: T) => void;
  disabledOf?: (v: T) => boolean;
  ariaLabel: string;
  /** Ancho según contenido en vez de ocupar todo el campo. */
  fit?: boolean;
}) {
  return (
    <div className="td-seg tf-seg" role="group" aria-label={ariaLabel} data-fit={fit ? 'true' : undefined}>
      {options.map((o) => {
        const disabled = disabledOf?.(o.value) ?? false;
        const active = value === o.value;
        return (
          <button
            key={String(o.value)} type="button" className="td-seg-item"
            data-active={active} aria-pressed={active} disabled={disabled}
            onClick={() => !disabled && onChange(o.value)}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Mapa y modo: tarjetas con el arte del mapa ───────────────────────────────
export interface MapOption { key: GameMap; label: string; sub: string }

export function MapPicker({ value, onChange, options, size = 'md' }: {
  value: GameMap;
  onChange: (m: GameMap) => void;
  options: MapOption[];
  size?: 'md' | 'lg';
}) {
  return (
    <div className="tf-maps" data-size={size} role="group" aria-label="Mapa y modo">
      {options.map((o) => {
        const active = value === o.key;
        return (
          <button
            key={o.key} type="button" className="ax-artcard tf-map"
            data-active={active} aria-pressed={active} onClick={() => onChange(o.key)}
          >
            <img
              className="ax-artcard-img" src={lol.map(mapArtFor(o.key))} alt="" loading="lazy" decoding="async"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
            />
            <span className="tf-map-check" aria-hidden><Check size={14} strokeWidth={3} /></span>
            <span className="tf-map-name">{o.label}</span>
            <span className="tf-map-sub">{o.sub}</span>
          </button>
        );
      })}
    </div>
  );
}

// ── Tarjeta de opción exclusiva (público/privado, con/sin códigos) ───────────
export function OptionTile({ icon, title, sub, active, disabled, onClick }: {
  /** Icono lucide; sin él se pinta un testigo cuadrado. */
  icon?: ReactNode;
  title: ReactNode;
  sub?: ReactNode;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button" className="tf-opt" data-active={active} aria-pressed={active}
      disabled={disabled} onClick={onClick}
    >
      {icon
        ? <span className="tf-opt-ico" aria-hidden>{icon}</span>
        : <span className="tf-opt-dot" aria-hidden />}
      <span className="tf-opt-body">
        <span className="tf-opt-title">{title}</span>
        {sub && <span className="tf-opt-sub">{sub}</span>}
      </span>
    </button>
  );
}

// ── Aviso ────────────────────────────────────────────────────────────────────
// El tono marca la intención: warn (ámbar) pide atención, ok (verde) confirma,
// gold es lo oficial de Riot, info es contexto.
export function Notice({ tone = 'info', icon, title, children, className }: {
  tone?: 'info' | 'warn' | 'ok' | 'gold';
  icon?: ReactNode;
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`tf-note${className ? ` ${className}` : ''}`} data-tone={tone}>
      {icon && <span className="tf-note-ico" aria-hidden>{icon}</span>}
      <div className="tf-note-body">
        {title && <p className="tf-note-title">{title}</p>}
        {children}
      </div>
    </div>
  );
}
