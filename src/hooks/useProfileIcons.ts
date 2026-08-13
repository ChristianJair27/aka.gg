// Iconos de perfil de LoL para listas de jugadores (rosters de torneo).
// Una sola llamada batch al backend, cacheada fuerte: el backend a su vez sirve
// de su índice seen_summoners y solo consulta Riot por los que falten.
import { useQuery } from '@tanstack/react-query';
import { axiosInstance } from '@/lib/axios';

export interface ProfileIconEntry {
  profileIconId: number | null;
  level: number | null;
}

/** Mapa "nombre#tag" (lowercase) → icono/nivel. */
export type ProfileIconMap = Record<string, ProfileIconEntry>;

export function useProfileIcons(
  cacheKey: string,
  riotIds: string[],
  platform: string,
) {
  const ids = riotIds.filter((r) => r.includes('#'));
  return useQuery({
    queryKey: ['profile-icons', cacheKey, ids.length],
    enabled: ids.length > 0,
    staleTime: 30 * 60_000,
    retry: false,
    queryFn: async () => {
      const { data } = await axiosInstance.post('/api/stats/profile-icons', {
        players: ids.map((riotId) => ({ riotId, platform })),
      });
      return (data?.icons ?? {}) as ProfileIconMap;
    },
  });
}

export const iconFor = (map: ProfileIconMap | undefined, riotId?: string): number | null =>
  (riotId && map?.[riotId.toLowerCase()]?.profileIconId) || null;
