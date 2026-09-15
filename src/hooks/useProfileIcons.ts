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

// El backend recorta cada petición a 60 jugadores (stats.ts: players.slice(0, 60)).
// Con las 108 personas de las stats del LQC, un solo POST dejaba a 48 sin icono
// —no por fallo de resolución, sino por el tope—. Se trocea y se fusiona aquí:
// una sola consulta de React Query, ⌈n/60⌉ peticiones en paralelo por debajo.
const BATCH = 60;

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
      const chunks: string[][] = [];
      for (let i = 0; i < ids.length; i += BATCH) chunks.push(ids.slice(i, i + BATCH));
      const results = await Promise.all(chunks.map(async (chunk) => {
        const { data } = await axiosInstance.post('/api/stats/profile-icons', {
          players: chunk.map((riotId) => ({ riotId, platform })),
        });
        return (data?.icons ?? {}) as ProfileIconMap;
      }));
      return Object.assign({}, ...results) as ProfileIconMap;
    },
  });
}

export const iconFor = (map: ProfileIconMap | undefined, riotId?: string): number | null =>
  (riotId && map?.[riotId.toLowerCase()]?.profileIconId) || null;
