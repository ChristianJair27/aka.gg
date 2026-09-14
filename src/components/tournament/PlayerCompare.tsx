// ATAK.GG — Comparar dos jugadores del torneo sobre el mismo radar.
//
// Capa fina sobre PlayerRadarCard: elige al rival con la paleta de búsqueda que
// ya existe (cmdk) y superpone su silueta en oro. La referencia "Promedio LQC"
// se mantiene siempre, así que se leen tres cosas a la vez: jugador, rival y
// media del torneo.
import { useState } from 'react';
import { Users, X } from 'lucide-react';
import { Button } from '@/components/tournament/ui';
import { PlayerTeamCommand } from '@/components/tournament/PlayerTeamCommand';
import { PlayerRadarCard } from '@/components/tournament/PlayerRadarCard';
import type { PlayerAggregate } from '@/types/tournament-global-stats';

export function PlayerCompare({ player, cohort, teamOf, onClose }: {
  player: PlayerAggregate;
  cohort: PlayerAggregate[];
  /** Equipo del jugador (si el cruce con el roster lo encontró). */
  teamOf?: (p: PlayerAggregate) => string | null;
  onClose?: () => void;
}) {
  const [rival, setRival] = useState<PlayerAggregate | null>(null);

  const pick = (name: string) => {
    const found = cohort.find((p) => p.summonerName === name);
    if (found && found.summonerName !== player.summonerName) setRival(found);
  };

  return (
    <div className="td-compare">
      <div className="td-compare-bar">
        <span className="td-over">RADAR DEL JUGADOR</span>
        <div className="td-compare-actions">
          {rival ? (
            <>
              <span className="td-chip-x">
                <Users size={12} /> vs {rival.summonerName}
                <button type="button" aria-label="Cerrar comparación" onClick={() => setRival(null)}>
                  <X size={11} />
                </button>
              </span>
              <Button variant="ghost" onClick={() => setRival(null)}>Cerrar comparación</Button>
            </>
          ) : (
            <PlayerTeamCommand
              players={cohort
                .filter((p) => p.summonerName !== player.summonerName)
                .map((p) => ({ name: p.summonerName, tag: p.tagLine, team: teamOf?.(p) ?? null }))}
              teams={[]}
              onPickPlayer={pick}
              onPickTeam={() => { /* comparar es entre jugadores */ }}
            />
          )}
          {onClose && <Button variant="ghost" onClick={onClose}>Cerrar</Button>}
        </div>
      </div>

      {!rival && (
        <p className="td-compare-hint">
          Busca a otro jugador para superponer su radar. La referencia gris siempre es el Promedio LQC.
        </p>
      )}

      <PlayerRadarCard player={player} cohort={cohort} compare={rival} />
    </div>
  );
}

export default PlayerCompare;
