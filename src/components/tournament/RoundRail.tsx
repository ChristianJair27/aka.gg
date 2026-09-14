// ATAK.GG — RoundRail: carrusel de rondas (embla) para filtrar / saltar a una
// ronda del torneo. Reutiliza el Carousel de shadcn (src/components/ui/carousel)
// con arrastre libre: en móvil las 5 rondas suizas + "Todas" no caben en una
// fila, y en desktop se ve como una tira de pills con contador.
//
//   <RoundRail items={[{ key: 'all', label: 'Todas', count: 30 }, ...]}
//              value="3" onChange={(k) => ...} tip="Filtra por ronda" />
//
// `value` null ⇒ ninguna seleccionada (modo "enlace", p.ej. en el Resumen).
import { Carousel, CarouselContent, CarouselItem } from '@/components/ui/carousel';
import { Tip } from '@/components/ui/Tip';

export interface RoundRailItem {
  key: string;
  label: string;
  /** Partidas en la ronda (se pinta como contador). */
  count?: number;
  /** Partidas en juego ahora mismo: enciende el punto azul. */
  live?: number;
  /** Ronda cerrada por completo. */
  done?: boolean;
}

export function RoundRail({ items, value, onChange, tip, compact }: {
  items: RoundRailItem[];
  value: string | null;
  onChange: (key: string) => void;
  /** Texto del Tip (español). Sin tip no se envuelve. */
  tip?: string;
  /** Versión fina para el Resumen. */
  compact?: boolean;
}) {
  const rail = (
    <div className={`td-roundrail${compact ? ' td-roundrail--compact' : ''}`} role="tablist" aria-label="Rondas">
      <Carousel opts={{ align: 'start', dragFree: true, containScroll: 'trimSnaps' }}>
        <CarouselContent className="-ml-2">
          {items.map((it) => {
            const active = value === it.key;
            return (
              <CarouselItem key={it.key} className="basis-auto pl-2">
                <button
                  type="button"
                  role="tab"
                  aria-selected={active}
                  data-active={active ? 'true' : 'false'}
                  data-done={it.done ? 'true' : 'false'}
                  className="td-roundrail-item"
                  onClick={() => onChange(it.key)}
                >
                  {(it.live ?? 0) > 0 && <span className="td-roundrail-live td-dot-pulse" aria-label="En juego" />}
                  <span className="td-roundrail-label">{it.label}</span>
                  {typeof it.count === 'number' && (
                    <span className="td-roundrail-count td-num">{it.count}</span>
                  )}
                </button>
              </CarouselItem>
            );
          })}
        </CarouselContent>
      </Carousel>
    </div>
  );
  return tip ? <Tip label={tip} side="bottom" align="start">{rail}</Tip> : rail;
}

export default RoundRail;
