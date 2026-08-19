// Búsqueda local de campeones para los cuadros de búsqueda (navbar, home,
// stats): matchea por nombre localizado o slug, insensible a acentos, con
// prioridad a los que EMPIEZAN por el texto. Datos de DDragon (ya cacheados
// 24h por useChampions) — cero requests extra.
import { useMemo } from 'react';
import { useChampions } from './use-ddragon';

export type ChampionMatch = { key: string; id: string; name: string; image: string };

const norm = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

export function useChampionMatches(query: string, limit = 4): ChampionMatch[] {
  const { data } = useChampions();
  return useMemo(() => {
    const raw = String(query || '').trim();
    // Con '#' es claramente un Riot ID — no sugerir campeones.
    if (!data || raw.length < 2 || raw.includes('#')) return [];
    const q = norm(raw);
    if (!q) return [];
    const all = Object.values(data.byId);
    const starts: ChampionMatch[] = [];
    const contains: ChampionMatch[] = [];
    for (const c of all) {
      const n = norm(c.name), s = norm(c.id);
      if (n.startsWith(q) || s.startsWith(q)) starts.push(c);
      else if (n.includes(q) || s.includes(q)) contains.push(c);
    }
    return [...starts, ...contains].slice(0, limit);
  }, [query, data, limit]);
}
