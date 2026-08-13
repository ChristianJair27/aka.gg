// Autocompletado de invocadores (estilo League of Graphs): consulta el índice
// de jugadores ya vistos por el backend mientras escribes, con debounce.
// Si el endpoint no existe aún (backend viejo), degrada a lista vacía.
import { useEffect, useState } from 'react';
import { axiosInstance } from '@/lib/axios';

export interface PlayerSuggestion {
  puuid: string;
  gameName: string;
  tagLine: string;
  platform: string;
  profileIconId: number | null;
  level: number | null;
}

export function usePlayerSuggestions(query: string, enabled = true): PlayerSuggestion[] {
  const [players, setPlayers] = useState<PlayerSuggestion[]>([]);

  useEffect(() => {
    const q = query.trim();
    if (!enabled || q.length < 2) { setPlayers([]); return; }
    let cancelled = false;
    const t = setTimeout(() => {
      axiosInstance
        .get('/api/stats/suggest', { params: { q } })
        .then(({ data }) => {
          if (!cancelled) setPlayers(Array.isArray(data?.players) ? data.players : []);
        })
        .catch(() => { if (!cancelled) setPlayers([]); });
    }, 220);
    return () => { cancelled = true; clearTimeout(t); };
  }, [query, enabled]);

  return players;
}
