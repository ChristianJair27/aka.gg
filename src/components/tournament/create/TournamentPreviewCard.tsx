// Vista previa en vivo del torneo que se va a crear.
//
// El valor está en `deriveFormat`: replica exactamente la cadena `format` que
// arma el backend en POST /api/tournaments, así que lo que el organizador ve
// aquí es literalmente lo que va a aparecer luego en la lista de torneos. Si
// algún día cambia la regla en el servidor, hay que cambiarla aquí también.
//
// Piel "Arena": es la hermana pequeña de la tarjeta destacada del listado
// (.ax-feature en Tournaments.tsx) — mismas etiquetas, nombre en la display
// condensada, datos en `dl` y el cupo abajo — con el arte del mapa elegido.
import { Globe, Lock, Swords, Zap } from 'lucide-react';
import { ProgressBar, StatusChip } from '@/components/tournament/ui';
import { lol, mapArtFor } from '@/lib/lolAssets';
import '@/styles/pages/tournament-forms.css';

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

export function TournamentPreviewCard({ input }: { input: PreviewInput }) {
  const isArena = input.gameMap === 'ARENA';
  const fmt = deriveFormat(input);
  const name = input.name.trim();
  const riot = !isArena && input.createRiot;
  const date = input.startDate
    ? new Date(`${input.startDate}T12:00:00`).toLocaleDateString('es-MX', {
        weekday: 'short', day: '2-digit', month: 'long',
      })
    : 'Sin fecha';

  return (
    <article className="tf-preview" aria-label="Vista previa del torneo">
      {/* key: al cambiar de mapa se remonta la imagen y se limpia un onError previo. */}
      <div className="tf-preview-art" aria-hidden>
        <img
          key={input.gameMap} src={lol.map(mapArtFor(input.gameMap))} alt="" decoding="async"
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
        />
      </div>

      <div className="tf-preview-top">
        <span className="td-over">Así se verá en la lista</span>
        <StatusChip kind={input.isPrivate ? 'gold' : 'dim'} dot={false}>
          {input.isPrivate ? <Lock size={12} aria-hidden /> : <Globe size={12} aria-hidden />}
          {input.isPrivate ? 'Privado' : 'Público'}
        </StatusChip>
      </div>

      <div className="tf-preview-main">
        {/* Mismas etiquetas que pinta el listado para un torneo recién creado. */}
        <div className="ax-row-tags">
          <StatusChip kind="registration">Inscripciones</StatusChip>
          {riot && <StatusChip kind="gold" dot={false}>Riot oficial</StatusChip>}
          {input.gameMap === 'ARAM' && <StatusChip kind="dim" dot={false}>ARAM</StatusChip>}
          {isArena && <StatusChip kind="dim" dot={false}>Arena ladder</StatusChip>}
          {input.teamSize !== 5 && !isArena && (
            <StatusChip kind="dim" dot={false}>{input.teamSize}v{input.teamSize}</StatusChip>
          )}
        </div>

        <h3 className="tf-preview-name" data-empty={name ? undefined : 'true'}>
          {name || 'Nombre del torneo'}
        </h3>
        <p className="tf-preview-format">
          {fmt}
          {!isArena && ` · ${SERIES_LABEL[input.seriesTo] ?? 'Bo1'}`}
        </p>

        <dl className="tf-preview-facts">
          <div style={{ minWidth: 0 }}>
            <dt className="td-over">Premio</dt>
            <dd>{input.prize.trim() || 'Por definir'}</dd>
          </div>
          <div style={{ minWidth: 0 }}>
            <dt className="td-over">Inicio</dt>
            <dd>{date}</dd>
          </div>
        </dl>
      </div>

      <div className="tf-preview-side">
        <div className="td-over">Equipos</div>
        <div className="ax-cap-num">0<small> / {input.maxParticipants}</small></div>
        <ProgressBar kind="red" pct={0} height={6} />

        <p className="tf-preview-extra">
          {isArena ? (
            <><Swords size={15} aria-hidden /> Ventana de {input.durationHours} h</>
          ) : input.bracketType === 'swiss' && Number(input.swissRounds) > 0 ? (
            <><Zap size={15} aria-hidden /> {input.swissRounds} rondas automáticas</>
          ) : (
            <><Zap size={15} aria-hidden /> {riot ? 'Códigos de Riot' : 'Sin códigos de Riot'}</>
          )}
        </p>

        {riot && input.bracketType === 'swiss' && (
          <p className="td-help" style={{ margin: '6px 0 0' }}>Los códigos se generan al crear el torneo.</p>
        )}
      </div>
    </article>
  );
}
