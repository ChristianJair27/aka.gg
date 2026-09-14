// ATAK.GG — Descubrimiento del dashboard de torneo.
//
// Banner suave de primera visita + "muestras": chips que llevan al jugador a una
// función real (equipos, stats de serie, ranking, bracket, espectar, reglas) y
// explican qué va a ver. NUNCA bloquea: no hay overlay obligatorio ni pasos que
// completar, se puede descartar y se reabre desde "Guía rápida".
//
// Las muestras solo enseñan funciones que EXISTEN. El chip de radar aparece solo
// cuando el componente del radar exista en el árbol (ver HAS_PLAYER_RADAR).
import { useState } from 'react';
import { toast } from 'sonner';
import {
  Compass, X, Users, Swords, BarChart3, Network, Play, ScrollText, Radar, LifeBuoy,
} from 'lucide-react';
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/tournament/ui';
import {
  useDiscoveryNav, useDiscoveryBanner, pulseSelector, HAS_PLAYER_RADAR,
} from '@/hooks/useTournamentDiscovery';

// Un solo id de toast para las muestras: al encadenar chips el aviso se
// reemplaza en vez de apilarse.
const SAMPLE_TOAST_ID = 'td-discovery-sample';

export interface DiscoverySamplesData {
  /** Equipo para la muestra 1: el del jugador si lo tiene, si no el 1º de la tabla. */
  sampleTeam: string | null;
  /** Serie FINALIZADA para la muestra 2 (preferimos la ronda 2). */
  sampleMatch: { id: string; round: number } | null;
  /** Ronda con series en juego (para la muestra del bracket). */
  liveRound: number | null;
}

type Sample = {
  key: string;
  label: string;
  icon: React.ReactNode;
  run: () => void;
};

function useSamples({ sampleTeam, sampleMatch, liveRound }: DiscoverySamplesData): Sample[] {
  const { goTo } = useDiscoveryNav();
  const say = (msg: string) => toast.message(msg, { id: SAMPLE_TOAST_ID });

  const samples: Sample[] = [
    {
      key: 'equipos',
      label: 'Ver mi / un equipo',
      icon: <Users size={13} />,
      run: () => {
        goTo({ tab: 'equipos', ...(sampleTeam ? { team: sampleTeam } : {}) });
        say('Haz click en cualquier equipo para ver plantilla y stats');
      },
    },
    {
      key: 'serie',
      label: 'Ver stats de una serie',
      icon: <Swords size={13} />,
      run: () => {
        goTo({
          tab: 'partidas',
          round: sampleMatch ? sampleMatch.round : 'all',
          ...(sampleMatch ? { match: sampleMatch.id } : {}),
        });
        say('Cada partida finalizada tiene KDA, daño, oro y visión');
      },
    },
    {
      key: 'stats',
      label: 'Ranking de jugadores',
      icon: <BarChart3 size={13} />,
      run: () => { goTo({ tab: 'stats' }); say('Ordena por KDA, daño/min, visión…'); },
    },
    {
      key: 'bracket',
      label: 'Bracket en vivo',
      icon: <Network size={13} />,
      run: () => {
        goTo({ tab: 'bracket' });
        if (liveRound != null) pulseSelector(`[data-td-round="${liveRound}"]`);
        else pulseSelector('[data-td-bracket]');
        say(liveRound != null ? `Ronda ${liveRound}: series EN JUEGO` : 'Aquí ves el avance ronda por ronda');
      },
    },
    {
      key: 'espectar',
      label: 'Espectar',
      icon: <Play size={13} />,
      run: () => {
        goTo({ tab: 'resumen' });
        pulseSelector('[data-td-live]');
        say('Cuando haya spectator feed verás la partida aquí');
      },
    },
    {
      key: 'reglas',
      label: 'Reglamento',
      icon: <ScrollText size={13} />,
      run: () => { goTo({ tab: 'reglas' }); },
    },
  ];

  // Chip 7 solo si el radar comparativo ya existe en el árbol.
  if (HAS_PLAYER_RADAR) {
    samples.push({
      key: 'radar',
      label: 'Comparar jugador (radar)',
      icon: <Radar size={13} />,
      run: () => {
        goTo({ tab: 'stats' });
        pulseSelector('[data-td-player-row]');
        say('Radar vs promedio LQC — KDA, WR, daño, oro, CS, visión');
      },
    });
  }
  return samples;
}

function SampleChips({ samples, onPick }: { samples: Sample[]; onPick?: () => void }) {
  return (
    <div className="td-sample-chips">
      {samples.map((s) => (
        <button
          key={s.key}
          type="button"
          className="td-sample-chip"
          onClick={() => { s.run(); onPick?.(); }}
        >
          {s.icon}{s.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Banner de primera visita. Se muestra mientras no exista td-discover-{id};
 * al descartarlo no vuelve solo (se reabre desde "Guía rápida").
 */
export function DiscoveryBanner({ tournamentId, data }: { tournamentId: string; data: DiscoverySamplesData }) {
  const { visible, dismiss } = useDiscoveryBanner(tournamentId);
  const samples = useSamples(data);
  if (!visible) return null;

  return (
    <section className="td-panel td-discover" aria-label="Qué puedes hacer aquí">
      <span className="td-ico td-discover-ico"><Compass size={16} /></span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <h2 className="td-discover-title">¿Qué puedes hacer aquí?</h2>
        <p className="td-discover-body">
          Explora equipos, stats de series, ranking de jugadores y el bracket en vivo.
          Prueba una muestra — no bloquea nada.
        </p>
        <SampleChips samples={samples} />
        <div style={{ marginTop: 12 }}>
          <Button variant="secondary" onClick={dismiss}>Entendido</Button>
        </div>
      </div>
      <button type="button" className="td-discover-x" onClick={dismiss} aria-label="Cerrar">
        <X size={15} />
      </button>
    </section>
  );
}

/**
 * Botón flotante "Guía rápida": reabre las mismas muestras en un panel lateral.
 * Siempre lo abre el jugador — nunca se despliega solo.
 */
export function GuiaRapidaButton({ data }: { data: DiscoverySamplesData }) {
  const [open, setOpen] = useState(false);
  const samples = useSamples(data);

  return (
    <>
      <button type="button" className="td-guide-fab" onClick={() => setOpen(true)}>
        <LifeBuoy size={15} />
        <span>Guía rápida</span>
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="td-root border-white/10 bg-[#0c0b10] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-white">¿Qué puedes hacer aquí?</SheetTitle>
            <SheetDescription className="text-white/50">
              Explora equipos, stats de series, ranking de jugadores y el bracket en vivo.
              Prueba una muestra — no bloquea nada.
            </SheetDescription>
          </SheetHeader>
          <div style={{ marginTop: 18 }}>
            <SampleChips samples={samples} onPick={() => setOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
