// ATAK.GG — micro-gráficos para celdas de tablas de torneo.
//
// Un número suelto en una tabla de 109 filas no se compara de un vistazo; una
// barra o un anillo sí. Cada pieza mantiene el valor exacto (en texto pequeño
// o en el Tip): el gráfico ayuda a comparar, nunca sustituye al dato.
import { Tip } from '@/components/ui/Tip';
import { rankEmblem, tierColor, tierLabel } from '@/lib/ranks';

/** Barra horizontal relativa a `max` con la cifra en pequeño. */
export function MiniBar({ value, max, color = '#e5e7eb', label, width = 46, tip }: {
  value: number; max: number; color?: string; label?: string; width?: number; tip?: string;
}) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  const body = (
    <span className="inline-flex flex-col items-center gap-[3px]" style={{ width }}>
      <span className="text-[10px] font-semibold leading-none tabular-nums" style={{ color }}>{label ?? value}</span>
      <span className="block h-[5px] w-full rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
        <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: color, transition: 'width .4s ease' }} />
      </span>
    </span>
  );
  return tip ? <Tip label={tip}>{body}</Tip> : body;
}

/** Anillo de progreso 0-100 con la cifra en el centro. */
export function Ring({ value, size = 30, stroke = 3, color = '#e1242e', label, tip }: {
  value: number; size?: number; stroke?: number; color?: string; label?: string; tip?: string;
}) {
  const v = Math.max(0, Math.min(100, value));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const body = (
    <span className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={`${(c * v) / 100} ${c}`} style={{ transition: 'stroke-dasharray .5s ease' }} />
      </svg>
      <span className="absolute font-black tabular-nums leading-none" style={{ fontSize: Math.max(8, size * 0.32), color: '#fff' }}>
        {label ?? Math.round(v)}
      </span>
    </span>
  );
  return tip ? <Tip label={tip}>{body}</Tip> : body;
}

/** Puntos: uno por unidad hasta `max` (partidas jugadas). */
export function Dots({ count, max = 8, color = '#e5e7eb', tip }: { count: number; max?: number; color?: string; tip?: string }) {
  const n = Math.min(count, max);
  const body = (
    <span className="inline-flex flex-col items-center gap-[3px]">
      <span className="text-[10px] font-semibold leading-none tabular-nums text-white/70">{count}</span>
      <span className="inline-flex gap-[3px]">
        {Array.from({ length: max }).map((_, i) => (
          <span key={i} className="block w-[5px] h-[5px] rounded-full"
            style={{ background: i < n ? color : 'rgba(255,255,255,0.10)' }} />
        ))}
      </span>
    </span>
  );
  return tip ? <Tip label={tip}>{body}</Tip> : body;
}

/** K / D / A como barra segmentada proporcional (verde · rojo · azul). */
export function KdaSplit({ k, d, a, width = 68 }: { k: number; d: number; a: number; width?: number }) {
  const total = Math.max(1, k + d + a);
  const seg = (v: number, bg: string) => (
    <span className="block h-full" style={{ width: `${(v / total) * 100}%`, background: bg }} />
  );
  return (
    <Tip label={`${k} kills · ${d} muertes · ${a} asistencias`}>
      <span className="inline-flex flex-col items-center gap-[3px]" style={{ width }}>
        <span className="text-[10px] font-semibold leading-none tabular-nums">
          <span className="text-[#2fbf8a]">{k}</span>
          <span className="text-white/30"> / </span>
          <span className="text-[#ff5a64]">{d}</span>
          <span className="text-white/30"> / </span>
          <span className="text-[#60a5fa]">{a}</span>
        </span>
        <span className="flex h-[5px] w-full rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
          {seg(k, '#2fbf8a')}{seg(d, '#ff5a64')}{seg(a, '#60a5fa')}
        </span>
      </span>
    </Tip>
  );
}

/** Emblema del rango con la división debajo. El logo manda; el texto acompaña. */
export function TierEmblem({ tier, division, lp, size = 30, showLabel = true }: {
  tier?: string | null; division?: string | null; lp?: number | null; size?: number; showLabel?: boolean;
}) {
  if (!tier) {
    return (
      <Tip label="Sin rango solo/dúo">
        <span className="inline-flex items-center justify-center rounded-full"
          style={{ width: size, height: size, background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.25)', fontSize: 10 }}>
          —
        </span>
      </Tip>
    );
  }
  const noDiv = ['MASTER', 'GRANDMASTER', 'CHALLENGER'].includes(tier.toUpperCase());
  return (
    <Tip label={`${tierLabel(tier, division)}${lp != null ? ` · ${lp} LP` : ''}`}>
      <span className="inline-flex flex-col items-center gap-[2px]">
        <img src={rankEmblem(tier)} alt={tierLabel(tier, division)} loading="lazy"
          style={{ width: size, height: size, objectFit: 'contain', filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.6))' }} />
        {showLabel && (
          <span className="text-[9px] font-black leading-none tracking-wide" style={{ color: tierColor(tier) }}>
            {noDiv ? tierLabel(tier).slice(0, 4).toUpperCase() : division ?? ''}
          </span>
        )}
      </span>
    </Tip>
  );
}

/** Multikills como llamas: una por penta (o insignia con el número si son muchas). */
export function PentaBadge({ count }: { count: number }) {
  if (!count) return <span className="text-xs text-white/15">—</span>;
  return (
    <Tip label={`${count} pentakill${count > 1 ? 's' : ''}`}>
      <span className="inline-flex items-center gap-[2px]">
        {Array.from({ length: Math.min(count, 3) }).map((_, i) => <span key={i} style={{ fontSize: 12 }}>🔥</span>)}
        {count > 3 && <span className="text-[10px] font-black text-[#e1242e]">×{count}</span>}
      </span>
    </Tip>
  );
}
