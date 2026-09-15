// ATAK.GG — Dashboard de torneo (extraído del componente único original).
// Sin cambios de comportamiento.

import { useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { TournamentGlobalStats, playerKey } from '@/components/TournamentGlobalStats';
import { useTournamentGlobalStats } from '@/hooks/useTournamentGlobalStats';
import { discoveryToast } from '@/hooks/useTournamentDiscovery';
import { useRegistrations, type TdBoardPayload } from '@/hooks/queries/tournaments';
import { Block, ErrorCard } from './shared';

export function StatsTab({ id, name, standings, region }: {
  id: string; name: string; standings: TdBoardPayload['standings']; region?: string;
}) {
  const { data, loading, error, refresh } = useTournamentGlobalStats({ tournamentId: id });
  const { data: regs } = useRegistrations(id);

  // Primera visita a Estadísticas: la tabla es enorme (108 jugadores en LQC),
  // así que se señalan los filtros que la hacen manejable.
  const playerCount = data?.players.length ?? 0;
  useEffect(() => {
    if (!playerCount) return;
    const shortName = name.split(' ')[0] || 'el torneo';
    discoveryToast('stats-108', () =>
      toast.message(`Usa buscar / mín. partidas — hay ${playerCount} jugadores en ${shortName}`));
  }, [playerCount, name]);

  // Cruce roster → jugador de stats por Riot ID (nombre#tag normalizado, y el
  // nombre solo como respaldo). Las stats de Riot traen el Riot ID con el que
  // se JUGÓ, y algunos jugadores se inscriben con otro (typo, cuenta secundaria,
  // "futaba#kıss" vs "futaba#kiss"…): en LQC 2026 casan ~102/108 (medido
  // 14-sep-2026; al inicio del torneo eran ~87/108). Los que no casan siguen
  // apareciendo en la tabla bajo "Sin equipo" — nunca se descartan.
  const teamBySummoner = useMemo(() => {
    if (!regs?.length) return undefined;
    const map: Record<string, string> = {};
    for (const r of regs) {
      for (const p of r.players ?? []) {
        const [gn, tl] = String(p.riotId || p.name || '').split('#');
        if (!gn) continue;
        map[playerKey(gn, tl)] = r.teamName;
        if (!(playerKey(gn) in map)) map[playerKey(gn)] = r.teamName;
      }
    }
    return map;
  }, [regs]);

  if (error && !data) return <ErrorCard message={error} onRetry={refresh} />;
  if (!data) return <Block h={320} r={16} />;
  return (
    <TournamentGlobalStats
      data={data} loading={loading} onRefresh={refresh}
      teamBySummoner={teamBySummoner} standings={standings}
      tournamentName={name} logoUrl={id === 'lqc-2026' ? '/lqc-logo.png' : undefined}
      region={region}
    />
  );
}
