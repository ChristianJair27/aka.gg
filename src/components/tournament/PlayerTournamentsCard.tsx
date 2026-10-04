// ATAK.GG — "Torneos" en el perfil de invocador.
//
// Por cada torneo en el que está inscrito el Riot ID: nombre, región (LAN, no
// "la1"), equipo, posición en el ranking del torneo con su puntuación, y rango
// solo/dúo. Enlaza a la pestaña de estadísticas del torneo. Si no está en
// ninguno, no se pinta nada: el perfil no gana nada con un panel vacío.
//
// Visual: sistema "Arena" (td-panel / td-sub / StatusChip). Requiere un
// ancestro .td-root y las clases pf-tourney* de src/styles/pages/profile.css.
import { Link } from 'react-router-dom';
import { Trophy, ArrowUpRight } from 'lucide-react';
import { Tip } from '@/components/ui/Tip';
import { usePlayerTournaments } from '@/hooks/queries/tournaments';
import { regionLabel } from '@/lib/regions';
import { Ring, TierEmblem } from '@/components/tournament/MicroViz';
import { SectionHead, StatusChip } from '@/components/tournament/ui';
import '@/styles/pages/profile.css';

const GOLD = '#c8aa6e';

const PHASE_ES: Record<string, string> = { active: 'En curso', complete: 'Finalizado', checkin: 'Check-in', registration: 'Inscripciones' };
const PHASE_KIND: Record<string, 'live' | 'registration' | 'gold' | 'finished'> = {
  active: 'live', registration: 'registration', checkin: 'gold', complete: 'finished',
};

export function PlayerTournamentsCard({ riotId, style }: { riotId?: string; style?: React.CSSProperties }) {
  const { data, isLoading } = usePlayerTournaments(riotId);

  if (!riotId) return null;
  // Mientras carga no se reserva hueco: casi ningún perfil tiene torneos y un
  // esqueleto que luego desaparece movía toda la página.
  if (isLoading) return null;
  if (!data?.length) return null;

  return (
    <section className="td-panel" style={{ padding: 18, ...style }} aria-label="Torneos del jugador">
      <SectionHead icon={<Trophy size={15} />} title="Torneos" />

      <div>
        {data.map((t) => {
          const podium = t.rank === 1 ? GOLD : t.rank === 2 ? '#d7d9de' : t.rank === 3 ? '#b9794a' : '#f5f5f6';
          return (
            <Link
              key={t.tournamentId}
              to={`/tournaments/${t.tournamentId}?tab=stats`}
              className="td-sub td-hoverable pf-tourney"
            >
              {/* Posición */}
              <Tip label={t.rank
                ? `Puesto ${t.rank} de ${t.rankedPlayers} · ${t.score} pts (promedio de los 8 ejes del radar, 3+ partidas)`
                : 'Sin posición todavía: necesita 3 partidas'}>
                <div className="pf-tourney-pos">
                  {t.rank
                    ? <Ring value={t.score ?? 0} size={48} stroke={4} color={podium} label={`#${t.rank}`} />
                    : <span style={{ fontFamily: 'var(--td-font-display)', fontSize: 26, fontWeight: 700, color: 'var(--td-disabled)' }}>—</span>}
                  <div className="td-num" style={{ fontSize: 12.5, color: 'var(--td-muted)' }}>
                    {t.rank ? `de ${t.rankedPlayers}` : `${t.gamesPlayed} PJ`}
                  </div>
                </div>
              </Tip>

              {/* Torneo · región · equipo */}
              <div style={{ minWidth: 0 }}>
                <div className="pf-tourney-head">
                  <span className="pf-tourney-name">{t.name}</span>
                  <Tip label={`Región del torneo: ${regionLabel(t.region)}`}>
                    <span style={{ display: 'inline-flex' }}>
                      <StatusChip kind="gold" dot={false}>{regionLabel(t.region)}</StatusChip>
                    </span>
                  </Tip>
                  <StatusChip kind={PHASE_KIND[t.phase] ?? 'dim'}>{PHASE_ES[t.phase] ?? t.phase}</StatusChip>
                </div>
                <div className="td-num" style={{ fontSize: 14, color: 'var(--td-text-2)', marginTop: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {t.team}
                  {t.gamesPlayed > 0 && ` · ${t.gamesPlayed} PJ · WR ${t.winrate}% · KDA ${t.avgKda != null && t.avgKda > 20 ? '20+' : t.avgKda}`}
                </div>
              </div>

              {/* Rango solo/dúo + flecha */}
              <div className="pf-tourney-side">
                {t.soloTier && <TierEmblem tier={t.soloTier} division={t.soloDivision} size={56} />}
                <ArrowUpRight size={18} aria-hidden />
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

export default PlayerTournamentsCard;
