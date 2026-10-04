// ATAK.GG — Tournament Dashboard shared UI primitives.
// Reused across the whole detail view (zero duplicated inline styles).
// Requires src/styles/tournament-dashboard.css and a .td-root ancestor.
import { ReactNode, useState } from 'react';
import { resolveTeamLogo } from '@/lib/teamLogos';

// ── Team color palette (assigned per team, deterministic) ────────────────────
export const TEAM_PALETTE = ['#e8323c', '#e5e7eb', '#4ade80', '#3b82f6', '#a78bfa', '#22d3ee'];
export function teamColor(seed: number | string | undefined | null): string {
  if (seed == null) return '#e5e7eb';
  const n = typeof seed === 'number' ? seed : [...String(seed)].reduce((a, c) => a + c.charCodeAt(0), 0);
  return TEAM_PALETTE[Math.abs(n) % TEAM_PALETTE.length];
}
export function monogram(name?: string | null): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : name.slice(0, 2)).toUpperCase();
}

// ── Button ───────────────────────────────────────────────────────────────────
// Estados (hover / active / foco / disabled) en CSS: ver .td-btn en arena.css.
type BtnVariant = 'primary' | 'secondary' | 'ghost';
export function Button({
  variant = 'primary', children, icon, onClick, disabled, full, type = 'button', ariaLabel,
}: {
  variant?: BtnVariant; children: ReactNode; icon?: ReactNode;
  onClick?: () => void; disabled?: boolean; full?: boolean;
  type?: 'button' | 'submit'; ariaLabel?: string;
}) {
  return (
    <button
      type={type} onClick={disabled ? undefined : onClick} disabled={disabled} aria-label={ariaLabel}
      className={`td-btn td-btn--${variant}`} data-full={full ? 'true' : undefined}
    >
      {icon}{children}
    </button>
  );
}

// ── StatusChip (statuses + insight kinds) ────────────────────────────────────
// El color sale de data-kind (.td-chip en arena.css); "live" es el único relleno.
type ChipKind = 'live' | 'registration' | 'finished' | 'pos' | 'warn' | 'gold' | 'dim';
export function StatusChip({ kind, children, dot = true }: { kind: ChipKind; children: ReactNode; dot?: boolean }) {
  return (
    <span className="td-chip" data-kind={kind}>
      {dot && <span className={`td-chip-dot${kind === 'live' ? ' td-dot-pulse' : ''}`} aria-hidden />}
      {children}
    </span>
  );
}

// ── TeamBadge ────────────────────────────────────────────────────────────────
export function TeamBadge({ name, color, size = 28, mono, logoUrl }: {
  name?: string | null; color?: string; size?: number; mono?: string; logoUrl?: string | null;
}) {
  const c = color || teamColor(name);
  const resolved = logoUrl ?? resolveTeamLogo(name);
  const [imgFailed, setImgFailed] = useState(false);
  const showLogo = Boolean(resolved) && !imgFailed;
  return (
    <span style={{
      width: size, height: size, borderRadius: Math.round(size * 0.24), flexShrink: 0,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      background: showLogo ? '#0a0a0c' : 'var(--td-sunken)', boxShadow: `inset 0 0 0 1px ${c}`,
      color: c, fontFamily: 'var(--td-font-mono)', fontWeight: 700,
      fontSize: Math.max(9, Math.round(size * 0.36)),
      overflow: 'hidden',
    }}>
      {showLogo ? (
        <img
          src={resolved!}
          alt=""
          width={size}
          height={size}
          onError={() => setImgFailed(true)}
          style={{
            width: '100%', height: '100%', objectFit: 'contain',
            padding: size > 32 ? 4 : 2,
          }}
        />
      ) : (
        mono || monogram(name)
      )}
    </span>
  );
}

// ── StatTile ─────────────────────────────────────────────────────────────────
// Etiqueta arriba y número grande en la display condensada. Lee de un vistazo.
export function StatTile({ value, label, color = 'var(--td-text)', icon, accentBorder, hint }: {
  value: ReactNode; label: string; color?: string; icon?: ReactNode; accentBorder?: boolean;
  /** Línea secundaria opcional bajo el valor. */
  hint?: ReactNode;
}) {
  return (
    <div
      className="td-panel td-hoverable td-tile"
      style={{ borderColor: accentBorder ? 'var(--td-red-glow)' : undefined }}
    >
      {icon && <span className="td-ico td-tile-ico">{icon}</span>}
      <div style={{ minWidth: 0, flex: 1 }}>
        <div className="td-over" style={{ marginBottom: 4 }}>{label}</div>
        <div className="td-tile-value" style={{ color }}>{value}</div>
        {hint && <div className="td-tile-hint">{hint}</div>}
      </div>
    </div>
  );
}

// ── ProgressBar ──────────────────────────────────────────────────────────────
export function ProgressBar({ pct, kind = 'red', height = 6 }: { pct: number; kind?: 'red' | 'wr' | string; height?: number }) {
  const p = Math.max(0, Math.min(100, pct));
  let fill: string;
  if (kind === 'red') fill = 'linear-gradient(90deg, var(--td-red-deep), var(--td-red) 70%, var(--td-red-hover))';
  else if (kind === 'wr') fill = p >= 60 ? 'var(--td-green)' : p >= 45 ? '#d7d9de' : 'var(--td-neg)';
  else fill = kind;
  return (
    <div className="td-bar" style={{ height }} role="progressbar" aria-valuenow={Math.round(p)} aria-valuemin={0} aria-valuemax={100}>
      <div className="td-bar-fill" style={{ width: `${p}%`, background: fill }} />
    </div>
  );
}

// ── FilterPills (control segmentado) ─────────────────────────────────────────
export function FilterPills<T extends string>({ items, value, onChange, ariaLabel }: {
  items: { key: T; label: string; count?: number }[]; value: T; onChange: (k: T) => void; ariaLabel?: string;
}) {
  return (
    <div className="td-seg" role="group" aria-label={ariaLabel}>
      {items.map((it) => {
        const active = it.key === value;
        return (
          <button key={it.key} type="button" className="td-seg-item" data-active={active} aria-pressed={active}
            onClick={() => onChange(it.key)}>
            {it.label}
            {typeof it.count === 'number' && <span className="td-seg-count">{it.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

// ── Section header helper ────────────────────────────────────────────────────
// Título en la display condensada sobre un hairline con tramo crimson: marca
// dónde empieza cada bloque. `size="lg"` es la cabecera protagonista.
export function SectionHead({ icon, title, right, size = 'md' }: {
  icon?: ReactNode; title: string; right?: ReactNode; size?: 'md' | 'lg';
}) {
  return (
    <div className="td-sechead" data-size={size}>
      {icon && <span className="td-sechead-ico" aria-hidden>{icon}</span>}
      <h2 className="td-sechead-title" style={{ margin: 0 }}>{title}</h2>
      {right && <span className="td-sechead-right">{right}</span>}
    </div>
  );
}
