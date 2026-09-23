// Vista previa en vivo del torneo que se va a crear.
//
// El valor está en `deriveFormat`: replica exactamente la cadena `format` que
// arma el backend en POST /api/tournaments, así que lo que el organizador ve
// aquí es literalmente lo que va a aparecer luego en la lista de torneos. Si
// algún día cambia la regla en el servidor, hay que cambiarla aquí también.
import { Calendar, Globe, Lock, Trophy, Users, Zap, Swords } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PreviewInput {
  name: string;
  prize: string;
  startDate: string;
  gameMap: 'SR' | 'ARAM' | 'ARENA';
  teamSize: number;
  bracketType: string;
  seriesTo: string;
  maxParticipants: string;
  isPrivate: boolean;
  createRiot: boolean;
  swissRounds: string;
  durationHours: string;
}

/** Misma regla que el servidor: mantenerlas alineadas. */
export function deriveFormat(i: Pick<PreviewInput, 'gameMap' | 'teamSize' | 'bracketType'>) {
  if (i.gameMap === 'ARENA') return 'Arena Ladder 2v2';
  if (i.gameMap === 'ARAM') return `ARAM ${i.teamSize}v${i.teamSize}`;
  const b = i.bracketType === 'swiss' ? 'Suizo'
    : i.bracketType === 'round_robin' ? 'Liga'
    : 'Single Elimination';
  return `${i.teamSize}v${i.teamSize} ${b}`;
}

const SERIES_LABEL: Record<string, string> = {
  '1': 'Bo1',
  '2': 'Bo3',
  '2f3': 'Bo3 · Final Bo5',
};

function Row({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-[12px] text-gray-400">
      <span className="flex-shrink-0 text-gray-600 [&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</span>
      <span className="truncate">{children}</span>
    </div>
  );
}

export function TournamentPreviewCard({ input }: { input: PreviewInput }) {
  const isArena = input.gameMap === 'ARENA';
  const fmt = deriveFormat(input);
  const date = input.startDate
    ? new Date(`${input.startDate}T12:00:00`).toLocaleDateString('es-MX', {
        weekday: 'short', day: '2-digit', month: 'long',
      })
    : 'Sin fecha';

  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.025]">
      <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] bg-white/[0.02] px-3 py-1.5">
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-500">
          Así se verá en la lista
        </span>
        <span
          className={cn(
            'flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold',
            input.isPrivate
              ? 'border-amber-400/35 bg-amber-400/10 text-amber-300'
              : 'border-white/10 bg-white/[0.04] text-gray-400',
          )}
        >
          {input.isPrivate ? <Lock className="h-2.5 w-2.5" /> : <Globe className="h-2.5 w-2.5" />}
          {input.isPrivate ? 'Privado' : 'Público'}
        </span>
      </div>

      <div className="space-y-2.5 p-3.5">
        <div>
          <p className="truncate font-serif text-[17px] font-bold leading-tight text-white">
            {input.name.trim() || 'Nombre del torneo'}
          </p>
          <p className="mt-0.5 text-[11.5px] font-semibold uppercase tracking-wider text-red-400">
            {fmt}
            {!isArena && ` · ${SERIES_LABEL[input.seriesTo] ?? 'Bo1'}`}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
          <Row icon={<Calendar />}>{date}</Row>
          <Row icon={<Users />}>{input.maxParticipants} equipos máx.</Row>
          <Row icon={<Trophy />}>{input.prize.trim() || 'Por definir'}</Row>
          {isArena ? (
            <Row icon={<Swords />}>Ventana de {input.durationHours} h</Row>
          ) : input.bracketType === 'swiss' && Number(input.swissRounds) > 0 ? (
            <Row icon={<Zap />}>{input.swissRounds} rondas automáticas</Row>
          ) : (
            <Row icon={<Zap />}>
              {isArena || !input.createRiot ? 'Sin códigos de Riot' : 'Códigos de Riot'}
            </Row>
          )}
        </div>

        {!isArena && input.createRiot && input.bracketType === 'swiss' && (
          <p className="text-[11px] text-gray-600">Los códigos se generan al crear el torneo.</p>
        )}
      </div>
    </div>
  );
}
