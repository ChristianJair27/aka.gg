// src/lib/memeTags.ts
// "El dato" meme de cada perfil para la share card. Reglas deterministas sobre
// los datos reales de la cuenta + plantillas con el humor vigente de la
// comunidad (r/leagueofmemes, X). Las PLANTILLAS se refrescan corriendo
// /last30days "league of legends memes" y actualizando este archivo.
// Última sync de tendencias: 2026-08-04.

export interface MemeInput {
  level?: number | null;
  tier?: string | null;          // SOLO queue tier (IRON..CHALLENGER)
  wr?: number | null;            // winrate últimos 30 días (0-100)
  kda?: number | null;
  wins?: number | null;
  losses?: number | null;
  topChamps?: Array<{ name: string; games: number; wr: number }>;
}

// Memes por campeón: solo los que la comunidad repite sin contexto extra.
const CHAMP_MEMES: Record<string, string> = {
  Yasuo: 'Main Yasuo: el 0/10 powerspike es real',
  Yone: 'Main Yone: como Yasuo pero con excusa',
  Katarina: 'Main Katarina: un reset más y ganamos',
  Teemo: 'Main Teemo: eligió el lado del mal',
  'Master Yi': 'Main Yi: apreta Q y que decida el server',
  Draven: 'Main Draven: el ego también hace daño',
  Vayne: 'Main Vayne: 3 toques y tu tanque no existe',
  Thresh: 'Main Thresh: hooks de diamante, manos de hierro',
  Pantheon: 'Main Pantheon: cae del cielo la responsabilidad',
  Akali: 'Main Akali: desaparece hasta del scoreboard',
};

const LOW_TIERS = new Set(['IRON', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'EMERALD']);

const tierEs = (t: string) =>
  ({ IRON: 'Hierro', BRONZE: 'Bronce', SILVER: 'Plata', GOLD: 'Oro', PLATINUM: 'Platino',
     EMERALD: 'Esmeralda', DIAMOND: 'Diamante', MASTER: 'Master', GRANDMASTER: 'GM',
     CHALLENGER: 'Challenger' } as Record<string, string>)[t] || t;

/**
 * Devuelve UNA línea meme para la card (o null si no hay dato jugoso).
 * Orden = prioridad: lo más específico/gracioso primero.
 */
export function memeLine(m: MemeInput): string | null {
  const champs = m.topChamps || [];

  // 1. Un campeón con 0% WR y varias partidas: el "diff" clásico.
  const zero = champs.find((c) => c.wr === 0 && c.games >= 2);
  if (zero) return `${zero.name} gap: 0% WR en ${zero.games} partidas`;

  // 2. Invicto con muestra: presumible.
  const perfect = champs.find((c) => c.wr === 100 && c.games >= 3);
  if (perfect) return `Invicto en ${perfect.name} (${perfect.games}J): retírate en la cima`;

  // 3. Nivel altísimo y elo mortal: el grind no perdona.
  if ((m.level ?? 0) >= 700 && m.tier && LOW_TIERS.has(m.tier)) {
    return `Nv. ${m.level} y sigue en ${tierEs(m.tier)}: hardstuck con orgullo`;
  }

  // 4. WR de smurf.
  if ((m.wr ?? 0) >= 62 && (m.wins ?? 0) + (m.losses ?? 0) >= 10) {
    return `${m.wr}% WR: cuenta reportada por smurf`;
  }

  // 5. Meme por campeón main (el más jugado).
  const main = champs[0];
  if (main && CHAMP_MEMES[main.name]) return CHAMP_MEMES[main.name];

  // 6. KDA player.
  if ((m.kda ?? 0) >= 5) return `KDA ${m.kda}: primero el KDA, luego ganar`;

  // 7. Muere por la causa.
  if (m.kda != null && m.kda > 0 && m.kda < 2.2) return `KDA ${m.kda}: muere por darle visión al equipo`;

  // 8. WR bajo: nunca es tu culpa.
  if (m.wr != null && m.wr < 43 && (m.wins ?? 0) + (m.losses ?? 0) >= 8) {
    return `${m.wr}% WR este mes: jungle diff, obviamente`;
  }

  // 9. Racha pareja: la definición de coinflip.
  if (m.wins != null && m.losses != null && m.wins + m.losses >= 12 && Math.abs(m.wins - m.losses) <= 1) {
    return `${m.wins}V-${m.losses}D: el 50/50 más puro de la Grieta`;
  }

  return null;
}
