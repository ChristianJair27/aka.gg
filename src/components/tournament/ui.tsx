// ATAK.GG — Tournament Dashboard shared UI primitives.
// Reused across the whole detail view (zero duplicated inline styles).
// Requires src/styles/tournament-dashboard.css and a .td-root ancestor.
import { CSSProperties, ReactNode } from 'react';

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
type BtnVariant = 'primary' | 'secondary' | 'ghost';
export function Button({
  variant = 'primary', children, icon, onClick, disabled, full, type = 'button', ariaLabel,
}: {
  variant?: BtnVariant; children: ReactNode; icon?: ReactNode;
  onClick?: () => void; disabled?: boolean; full?: boolean;
  type?: 'button' | 'submit'; ariaLabel?: string;
}) {
  const base: CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
    height: 40, padding: '0 18px', borderRadius: 999, fontWeight: 700, fontSize: 13,
    letterSpacing: '.3px', cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'transform .15s, background .15s, border-color .15s, box-shadow .15s',
    width: full ? '100%' : undefined, whiteSpace: 'nowrap', border: '1px solid transparent',
    fontFamily: 'var(--td-font-ui)',
  };
  const styles: Record<BtnVariant, CSSProperties> = {
    primary: disabled
      ? { ...base, background: '#232329', color: 'var(--td-disabled)', boxShadow: 'none' }
      : { ...base, background: 'var(--td-red)', color: '#fff', boxShadow: '0 6px 22px var(--td-red-glow)' },
    secondary: { ...base, background: 'transparent', color: '#e5e7eb', fontWeight: 600, borderColor: 'var(--td-border-hov)' },
    ghost: { ...base, background: 'transparent', color: 'var(--td-red)', fontWeight: 600, height: 'auto', padding: 0, boxShadow: 'none' },
  };
  return (
    <button
      type={type} onClick={disabled ? undefined : onClick} disabled={disabled} aria-label={ariaLabel}
      style={styles[variant]}
      onMouseEnter={(e) => {
        if (disabled) return;
        const el = e.currentTarget;
        if (variant === 'primary') { el.style.background = 'var(--td-red-hover)'; el.style.transform = 'translateY(-1px)'; }
        if (variant === 'secondary') { el.style.borderColor = 'var(--td-red)'; el.style.background = 'rgba(232,50,60,0.06)'; }
        if (variant === 'ghost') el.style.color = 'var(--td-red-hover)';
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget; el.style.transform = 'none';
        if (variant === 'primary' && !disabled) el.style.background = 'var(--td-red)';
        if (variant === 'secondary') { el.style.borderColor = 'var(--td-border-hov)'; el.style.background = 'transparent'; }
        if (variant === 'ghost') el.style.color = 'var(--td-red)';
      }}
    >
      {icon}{children}
    </button>
  );
}

// ── StatusChip (statuses + insight kinds) ────────────────────────────────────
type ChipKind = 'live' | 'registration' | 'finished' | 'pos' | 'warn' | 'gold' | 'dim';
const CHIP_COLOR: Record<ChipKind, string> = {
  live: '#60a5fa', registration: '#4ade80', finished: '#9ca3af',
  pos: '#4ade80', warn: '#f87171', gold: '#f59e0b', dim: '#9ca3af',
};
export function StatusChip({ kind, children, dot = true }: { kind: ChipKind; children: ReactNode; dot?: boolean }) {
  const c = CHIP_COLOR[kind];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, height: 22, padding: '0 10px',
      borderRadius: 999, fontSize: 10.5, fontWeight: 600, color: c,
      border: `1px solid ${c}59`, background: `${c}14`, whiteSpace: 'nowrap',
    }}>
      {dot && <span className={kind === 'live' ? 'td-dot-pulse' : ''}
        style={{ width: 5, height: 5, borderRadius: '50%', background: c }} />}
      {children}
    </span>
  );
}

// ── TeamBadge ────────────────────────────────────────────────────────────────
export function TeamBadge({ name, color, size = 28, mono }: { name?: string | null; color?: string; size?: number; mono?: string }) {
  const c = color || teamColor(name);
  return (
    <span style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--td-sunken)', boxShadow: `inset 0 0 0 1px ${c}`,
      color: c, fontFamily: 'var(--td-font-mono)', fontWeight: 700,
      fontSize: Math.max(9, Math.round(size * 0.36)),
    }}>
      {mono || monogram(name)}
    </span>
  );
}

// ── StatTile ─────────────────────────────────────────────────────────────────
export function StatTile({ value, label, color = 'var(--td-text)', icon, accentBorder }: {
  value: ReactNode; label: string; color?: string; icon?: ReactNode; accentBorder?: boolean;
}) {
  return (
    <div className="td-tile" style={{
      background: 'var(--td-card)', borderRadius: 14, padding: '14px 16px',
      border: `1px solid ${accentBorder ? 'var(--td-red-glow)' : 'var(--td-border)'}`,
      transition: 'border-color .2s',
    }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--td-border-hov)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = accentBorder ? 'var(--td-red-glow)' : 'var(--td-border)'; }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {icon}
        <span style={{ fontFamily: 'var(--td-font-mono)', fontSize: 26, fontWeight: 700, color, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
      </div>
      <div className="td-over" style={{ marginTop: 8 }}>{label}</div>
    </div>
  );
}

// ── ProgressBar ──────────────────────────────────────────────────────────────
export function ProgressBar({ pct, kind = 'red', height = 6 }: { pct: number; kind?: 'red' | 'wr' | string; height?: number }) {
  const p = Math.max(0, Math.min(100, pct));
  let fill: string;
  if (kind === 'red') fill = 'linear-gradient(90deg, #7a1d24, #e8323c)';
  else if (kind === 'wr') fill = p >= 60 ? '#4ade80' : p >= 45 ? '#e5e7eb' : '#f87171';
  else fill = kind;
  return (
    <div style={{ height, borderRadius: 999, background: 'var(--td-sunken-2)', overflow: 'hidden', width: '100%' }}>
      <div style={{ height: '100%', width: `${p}%`, borderRadius: 999, background: fill, transition: 'width .5s ease' }} />
    </div>
  );
}

// ── FilterPills ──────────────────────────────────────────────────────────────
export function FilterPills<T extends string>({ items, value, onChange }: {
  items: { key: T; label: string }[]; value: T; onChange: (k: T) => void;
}) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {items.map((it) => {
        const active = it.key === value;
        return (
          <button key={it.key} onClick={() => onChange(it.key)}
            style={{
              height: 34, padding: '0 16px', borderRadius: 999, fontSize: 12.5, fontWeight: 600,
              cursor: 'pointer', transition: 'border-color .15s, background .15s, color .15s',
              background: active ? '#fff' : 'transparent', color: active ? '#0a0a0c' : 'var(--td-text-2)',
              border: `1px solid ${active ? '#fff' : '#26262c'}`, fontFamily: 'var(--td-font-ui)',
            }}
            onMouseEnter={(e) => { if (!active) e.currentTarget.style.borderColor = 'var(--td-border-hov2)'; }}
            onMouseLeave={(e) => { if (!active) e.currentTarget.style.borderColor = '#26262c'; }}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Section header helper ────────────────────────────────────────────────────
export function SectionHead({ icon, title, right }: { icon?: ReactNode; title: string; right?: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
      {icon}
      <span className="td-over" style={{ fontSize: 10, letterSpacing: '2px' }}>{title}</span>
      {right && <span style={{ marginLeft: 'auto' }}>{right}</span>}
    </div>
  );
}
