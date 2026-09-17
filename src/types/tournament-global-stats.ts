// Types for aggregated tournament-wide player stats (across all completed matches)

export interface PlayerAggregate {
  summonerName: string;
  tagLine: string;
  championPool: string[];
  mostPlayedChamp: string;
  gamesPlayed: number;
  wins: number;
  losses: number;
  winrate: number;
  totalKills: number;
  totalDeaths: number;
  totalAssists: number;
  avgKda: number;
  totalGold: number;
  avgGoldPerMin: number;
  totalDamage: number;
  avgDamagePerMin: number;
  totalVisionScore: number;
  avgVisionPerMin: number;
  totalCs: number;
  avgCsPerMin: number;
  pentaKills: number;
  quadraKills: number;
  tripleKills: number;
  doubleKills: number;
  /** Equipo inscrito (cruce por Riot ID); null si juega con otra cuenta. Solo en la API pública. */
  team?: string | null;
  /** Puntuación 0-100: promedio de los 8 ejes del radar, winsorizados al p05-p95 de la cohorte ≥3 PJ. */
  score?: number;
  /** Posición en el torneo por `score`. null con menos de 3 partidas. */
  rank?: number | null;
  /** Rango solo/duo actual (lo refresca el backend cada 6 h). */
  soloTier?: string | null;
  soloDivision?: string | null;
  soloLp?: number | null;
}

export interface TournamentGlobalStats {
  tournamentId: string;
  matchesCompleted: number;
  players: PlayerAggregate[];
  lastUpdated: number;
}

export type GlobalSortKey =
  | 'avgKda' | 'totalKills' | 'totalDeaths' | 'totalAssists'
  | 'avgGoldPerMin' | 'totalGold'
  | 'avgDamagePerMin' | 'totalDamage'
  | 'avgCsPerMin' | 'totalCs'
  | 'avgVisionPerMin' | 'totalVisionScore'
  | 'winrate' | 'gamesPlayed' | 'pentaKills';
