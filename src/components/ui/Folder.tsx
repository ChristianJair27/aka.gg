// Carpeta animada (adaptación del "Folder" de React Bits, MIT) para seccionar
// contenido: la tapa se abre y los tres "papeles" salen con un giro. Versión
// controlada (`open` + `onToggle`) para que un grupo de carpetas funcione como
// pestañas. Solo transform/opacity; sin animación si prefers-reduced-motion.
import { type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';

interface FolderProps {
  /** Color de la carpeta (hex). */
  color?: string;
  /** Escala (1 = 100×80 px). */
  size?: number;
  /** Hasta 3 elementos que asoman como papeles. */
  items?: ReactNode[];
  /** Icono pegado en la tapa delantera. */
  badge?: ReactNode;
  open?: boolean;
  onToggle?: () => void;
  label?: string;
  className?: string;
}

const darken = (hex: string, p: number) => {
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map((x) => x + x).join('');
  const n = parseInt(c.slice(0, 6), 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.floor(v * (1 - p))));
  return `#${((1 << 24) + (f((n >> 16) & 255) << 16) + (f((n >> 8) & 255) << 8) + f(n & 255)).toString(16).slice(1)}`;
};

const OPEN_TRANSFORM = ['translate(-120%, -70%) rotate(-15deg)', 'translate(10%, -70%) rotate(15deg)', 'translate(-50%, -100%) rotate(5deg)'];
const PAPER_BG = ['#e3e3e8', '#f0f0f3', '#ffffff'];
const PAPER_SIZE = ['w-[70%] h-[80%]', 'w-[80%] h-[70%]', 'w-[90%] h-[60%]'];

export function Folder({ color = '#e8323c', size = 1, items = [], badge, open = false, onToggle, label, className = '' }: FolderProps) {
  const papers: ReactNode[] = items.slice(0, 3);
  while (papers.length < 3) papers.push(null);
  const back = darken(color, 0.12);
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle?.(); } };
  const style: CSSProperties = { transform: `scale(${size})`, transformOrigin: 'bottom center' };

  return (
    <div className={`inline-flex flex-col items-center ${className}`} style={{ width: 100 * size }}>
      <div style={style} className="pt-[70px]">
        <div
          role="button" tabIndex={0} aria-pressed={open} aria-label={label}
          onClick={onToggle} onKeyDown={onKey}
          className={`group relative cursor-pointer transition-transform duration-200 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 rounded-lg motion-reduce:transition-none ${open ? '-translate-y-2' : 'hover:-translate-y-2'}`}
        >
          <div className="relative w-[100px] h-[80px] rounded-tr-[10px] rounded-br-[10px] rounded-bl-[10px]" style={{ backgroundColor: back }}>
            <span className="absolute z-0 bottom-[98%] left-0 w-[30px] h-[10px] rounded-t-[5px]" style={{ backgroundColor: back }} />
            {papers.map((item, i) => (
              <div
                key={i}
                className={`absolute z-20 bottom-[10%] left-1/2 grid place-items-center overflow-hidden rounded-[10px] shadow-md transition-transform duration-300 ease-out motion-reduce:transition-none ${PAPER_SIZE[i]} ${open ? '' : '-translate-x-1/2 translate-y-[10%] group-hover:translate-y-0'}`}
                style={{ backgroundColor: PAPER_BG[i], ...(open ? { transform: OPEN_TRANSFORM[i] } : null) }}
              >
                {item}
              </div>
            ))}
            {/* Tapa delantera (dos mitades que se abren en abanico) */}
            {[15, -15].map((skew) => (
              <div
                key={skew}
                className={`absolute z-30 inset-0 origin-bottom transition-transform duration-300 ease-out motion-reduce:transition-none ${open ? '' : skew > 0 ? 'group-hover:[transform:skew(15deg)_scaleY(0.6)]' : 'group-hover:[transform:skew(-15deg)_scaleY(0.6)]'}`}
                style={{ backgroundColor: color, borderRadius: '5px 10px 10px 10px', ...(open ? { transform: `skew(${skew}deg) scaleY(0.6)` } : null) }}
              />
            ))}
            {badge && (
              <div className={`pointer-events-none absolute z-40 left-1/2 -translate-x-1/2 transition-all duration-300 ease-out motion-reduce:transition-none ${open ? 'bottom-[12%] opacity-80' : 'bottom-[26%] group-hover:bottom-[12%]'}`}>
                {badge}
              </div>
            )}
          </div>
        </div>
      </div>
      {label && (
        <span className={`mt-2 text-[11px] font-bold uppercase tracking-[0.14em] transition-colors ${open ? 'text-white' : 'text-gray-500 group-hover:text-gray-300'}`}>{label}</span>
      )}
    </div>
  );
}

export default Folder;
