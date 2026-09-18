// ATAK.GG — Historial de un jugador DENTRO del torneo.
//
// Nace de feedback de un jugador sobre la ficha del radar: "te falta ponerle de
// qué equipo es" y "hasta a lo mejor un historial de sus partidas dentro de ese
// torneo". Los usos reales que describió son tres —presumir, cotillear a
// alguien y scoutear a un rival antes de jugarlo—, así que la ficha responde a
// los tres: qué campeones juega y cómo le va con cada uno (scouting), y partida
// por partida con ronda, rival y resultado (historial).
//
// Todo sale de /api/tournaments/:id/player/:riotId/games, que lee las partidas
// ya guardadas del torneo. Cero llamadas a Riot.
import { useMemo, useState } from 'react';
import { Swords, ChevronDown, ChevronUp, Clock } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Tip } from '@/components/ui/Tip';
import { dd } from '@/lib/dataDragon';
import { usePlayerTournamentGames, type PlayerTournamentGame } from '@/hooks/queries/tournaments';

const WIN = '#2fbf8a';
const LOSS = '#ff5a64';
const GOLD = '#c8aa6e';

/** Rol de Riot → etiqueta corta en español. */
const ROLE_ES: Record<string, string> = {
  TOP: 'Top', JUNGLE: 'Jungla', MIDDLE: 'Mid', BOTTOM: 'ADC', UTILITY: 'Support',
};

const fmtDur = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;

/** Resumen por campeón: lo que de verdad sirve para scoutear a un rival. */
function ChampionBreakdown({ games }: { games: PlayerTournamentGame[] }) {
  const rows = useMemo(() => {
    const by = new Map<string, { champion: string; games: number; wins: number; k: number; d: number; a: number }>();
    for (const g of games) {
      const r = by.get(g.champion) ?? { champion: g.champion, games: 0, wins: 0, k: 0, d: 0, a: 0 };
      r.games++; if (g.win) r.wins++;
      r.k += g.kills; r.d += g.deaths; r.a += g.assists;
      by.set(g.champion, r);
    }
    return [...by.values()].sort((x, y) => y.games - x.games || y.wins - x.wins).slice(0, 5);
  }, [games]);
  if (!rows.length) return null;

  return (
    <div className="td-hist-champs">
      {rows.map((r) => {
        const wr = Math.round((r.wins / r.games) * 100);
        const kda = r.d === 0 ? r.k + r.a : Math.round(((r.k + r.a) / r.d) * 10) / 10;
        return (
          <Tip key={r.champion} label={`${r.champion}: ${r.games} partida${r.games > 1 ? 's' : ''} · ${r.wins}V ${r.games - r.wins}D · KDA ${kda}`}>
            <div className="td-hist-champ">
              <img src={dd.champion(r.champion)} alt={r.champion} loading="lazy"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }} />
              <div style={{ minWidth: 0 }}>
                <div className="td-hist-champ-name">{r.champion}</div>
                <div className="td-hist-champ-sub">
                  <span style={{ color: wr >= 50 ? WIN : LOSS }}>{wr}%</span>
                  <span style={{ opacity: 0.4 }}> · {r.games} PJ · KDA {kda}</span>
                </div>
              </div>
            </div>
          </Tip>
        );
      })}
    </div>
  );
}

function GameRow({ g }: { g: PlayerTournamentGame }) {
  return (
    <div className="td-hist-row" data-win={g.win ? 'true' : 'false'}>
      <span className="td-hist-res" style={{ color: g.win ? WIN : LOSS }}>{g.win ? 'V' : 'D'}</span>
      <img className="td-hist-champ-ico" src={dd.champion(g.champion)} alt={g.champion} loading="lazy"
        onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }} />
      <div style={{ minWidth: 0 }}>
        <div className="td-hist-vs">
          {g.roundLabel && <span className="td-hist-round">{g.roundLabel}</span>}
          {g.opponent && <span className="td-hist-opp">vs {g.opponent}</span>}
        </div>
        <div className="td-hist-meta">
          {g.teamPosition && ROLE_ES[g.teamPosition] && <span>{ROLE_ES[g.teamPosition]}</span>}
          <Tip label="Duración de la partida">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              <Clock size={9} />{fmtDur(g.duration)}
            </span>
          </Tip>
          {g.killParticipation != null && (
            <Tip label="Participación en kills del equipo">
              <span>KP {Math.round(g.killParticipation * 100)}%</span>
            </Tip>
          )}
        </div>
      </div>
      <Tip label={`${g.kills} kills · ${g.deaths} muertes · ${g.assists} asistencias`}>
        <span className="td-hist-kda td-num">
          <b>{g.kills}</b><i>/</i><b style={{ color: LOSS }}>{g.deaths}</b><i>/</i><b>{g.assists}</b>
        </span>
      </Tip>
      <Tip label={`${Math.round(g.damagePerMin)} daño a campeones por minuto · ${g.csPerMin} CS/min · ${g.vision} visión`}>
        <span className="td-hist-dmg td-num">{Math.round(g.damagePerMin)}<small>dmg/min</small></span>
      </Tip>
      {g.multiKills.penta > 0 && <Tip label="¡Pentakill!"><span className="td-hist-penta">🔥</span></Tip>}
    </div>
  );
}

export function PlayerTournamentHistory({ tournamentId, riotId, compact }: {
  tournamentId: string; riotId: string; compact?: boolean;
}) {
  const { data, isLoading } = usePlayerTournamentGames(tournamentId, riotId);
  const [expanded, setExpanded] = useState(false);
  const games = data?.games ?? [];
  const visible = expanded ? games : games.slice(0, compact ? 3 : 5);

  if (isLoading) {
    return <div className="td-hist"><Skeleton variant="block" height={52} count={3} style={{ borderRadius: 10 }} /></div>;
  }
  if (!games.length) return null;

  const wins = games.filter((g) => g.win).length;

  return (
    <div className="td-hist">
      <div className="td-hist-head">
        <Swords size={12} color={GOLD} />
        <span className="td-over" style={{ letterSpacing: '1.6px' }}>EN ESTE TORNEO</span>
        <span className="td-hist-record td-num">
          <span style={{ color: WIN }}>{wins}V</span>
          <span style={{ opacity: 0.35 }}> · </span>
          <span style={{ color: LOSS }}>{games.length - wins}D</span>
        </span>
      </div>

      <ChampionBreakdown games={games} />

      <div className="td-hist-rows">
        {visible.map((g) => <GameRow key={`${g.matchId}-${g.gameId}`} g={g} />)}
      </div>

      {games.length > visible.length && (
        <button type="button" className="td-collapse-trigger" style={{ marginTop: 8 }} onClick={() => setExpanded(true)}>
          <ChevronDown size={13} /> Ver las {games.length} partidas
        </button>
      )}
      {expanded && games.length > (compact ? 3 : 5) && (
        <button type="button" className="td-collapse-trigger" style={{ marginTop: 8 }} onClick={() => setExpanded(false)}>
          <ChevronUp size={13} /> Ver menos
        </button>
      )}
    </div>
  );
}

export default PlayerTournamentHistory;
