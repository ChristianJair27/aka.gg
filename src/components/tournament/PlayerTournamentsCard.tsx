// ATAK.GG — "Torneos" en el perfil de invocador.
//
// Por cada torneo en el que está inscrito el Riot ID: nombre, región (LAN, no
// "la1"), equipo, posición en el ranking del torneo con su puntuación, y rango
// solo/dúo. Enlaza a la pestaña de estadísticas del torneo. Si no está en
// ninguno, no se pinta nada: el perfil no gana nada con un panel vacío.
import { Link } from 'react-router-dom';
import { Trophy, ArrowUpRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Tip } from '@/components/ui/Tip';
import { usePlayerTournaments } from '@/hooks/queries/tournaments';
import { regionLabel } from '@/lib/regions';
import { Ring, TierEmblem } from '@/components/tournament/MicroViz';

const RED = '#e1242e';
const GOLD = '#c8aa6e';

const PHASE_ES: Record<string, string> = { active: 'En curso', complete: 'Finalizado', checkin: 'Check-in', registration: 'Inscripciones' };

export function PlayerTournamentsCard({ riotId, style }: { riotId?: string; style?: React.CSSProperties }) {
  const { data, isLoading } = usePlayerTournaments(riotId);

  if (!riotId) return null;
  if (isLoading) {
    return (
      <div style={style}>
        <Skeleton variant="block" height={88} count={1} style={{ borderRadius: 14 }} />
      </div>
    );
  }
  if (!data?.length) return null;

  return (
    <div style={style}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <Trophy size={14} color={RED} />
        <span style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 700, color: 'rgba(255,255,255,0.7)' }}>
          Torneos
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {data.map((t) => {
          const podium = t.rank === 1 ? GOLD : t.rank === 2 ? '#e5e7eb' : t.rank === 3 ? '#d9a066' : '#fff';
          return (
            <Link
              key={t.tournamentId}
              to={`/tournaments/${t.tournamentId}?tab=stats`}
              className="group"
              style={{
                display: 'grid', gridTemplateColumns: 'auto minmax(0,1fr) auto', gap: 14, alignItems: 'center',
                padding: '12px 14px', borderRadius: 14, textDecoration: 'none',
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              {/* Posición */}
              <Tip label={t.rank
                ? `Puesto ${t.rank} de ${t.rankedPlayers} · ${t.score} pts (promedio de los 8 ejes del radar, 3+ partidas)`
                : 'Sin posición todavía: necesita 3 partidas'}>
                <div style={{ textAlign: 'center', minWidth: 62, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                  {t.rank
                    ? <Ring value={t.score ?? 0} size={46} stroke={4} color={podium} label={`#${t.rank}`} />
                    : <span style={{ fontSize: 22, fontWeight: 900, color: 'rgba(255,255,255,0.3)' }}>—</span>}
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>
                    {t.rank ? `de ${t.rankedPlayers}` : `${t.gamesPlayed} PJ`}
                  </div>
                </div>
              </Tip>

              {/* Torneo · región · equipo */}
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 14.5, fontWeight: 800, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.name}
                  </span>
                  <Tip label={`Región del torneo: ${regionLabel(t.region)}`}>
                    <span style={{
                      fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', padding: '2px 7px', borderRadius: 999,
                      color: GOLD, border: `1px solid ${GOLD}66`, background: `${GOLD}14`,
                    }}>
                      {regionLabel(t.region)}
                    </span>
                  </Tip>
                  <span style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.4)' }}>{PHASE_ES[t.phase] ?? t.phase}</span>
                </div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {t.team}
                  {t.gamesPlayed > 0 && ` · ${t.gamesPlayed} PJ · WR ${t.winrate}% · KDA ${t.avgKda != null && t.avgKda > 20 ? '20+' : t.avgKda}`}
                </div>
              </div>

              {/* Rango solo/dúo + flecha */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                {t.soloTier && <TierEmblem tier={t.soloTier} division={t.soloDivision} size={60} />}
                <ArrowUpRight size={16} color="rgba(255,255,255,0.35)" className="group-hover:text-white transition-colors" />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export default PlayerTournamentsCard;
