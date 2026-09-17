// ATAK.GG — rango de LoL: color, etiqueta en español y emblema.
// Fuente única para tablas de torneo, podio y perfil. Los colores ya existían
// duplicados en FeaturedPlayers y LiveGameVisualizer; aquí quedan de referencia.
export const TIER_COLOR: Record<string, string> = {
  IRON: '#8b8b8b', BRONZE: '#a97142', SILVER: '#b8c4d0', GOLD: '#e8b923',
  PLATINUM: '#3fb9a8', EMERALD: '#2fbf8a', DIAMOND: '#5aa8f0',
  MASTER: '#b06ce6', GRANDMASTER: '#e34d4d', CHALLENGER: '#f4c430',
};
export const TIER_ES: Record<string, string> = {
  IRON: 'Hierro', BRONZE: 'Bronce', SILVER: 'Plata', GOLD: 'Oro', PLATINUM: 'Platino',
  EMERALD: 'Esmeralda', DIAMOND: 'Diamante', MASTER: 'Maestro', GRANDMASTER: 'Gran Maestro',
  CHALLENGER: 'Retador',
};
/** Orden para ordenar por rango (mayor = mejor). */
export const TIER_ORDER = ['IRON','BRONZE','SILVER','GOLD','PLATINUM','EMERALD','DIAMOND','MASTER','GRANDMASTER','CHALLENGER'];
const DIV_ORDER: Record<string, number> = { IV: 0, III: 1, II: 2, I: 3 };

export const tierColor = (tier?: string | null) => (tier && TIER_COLOR[tier.toUpperCase()]) || 'rgba(255,255,255,0.45)';
export const tierLabel = (tier?: string | null, division?: string | null) => {
  if (!tier) return 'Sin rango';
  const t = TIER_ES[tier.toUpperCase()] ?? tier;
  return division && !['MASTER','GRANDMASTER','CHALLENGER'].includes(tier.toUpperCase()) ? `${t} ${division}` : t;
};
/** Abreviatura para celdas densas: "D2", "GM", "Ch". */
export const tierShort = (tier?: string | null, division?: string | null) => {
  if (!tier) return '—';
  const T = tier.toUpperCase();
  const s: Record<string, string> = { IRON: 'I', BRONZE: 'B', SILVER: 'S', GOLD: 'G', PLATINUM: 'P', EMERALD: 'E', DIAMOND: 'D', MASTER: 'M', GRANDMASTER: 'GM', CHALLENGER: 'Ch' };
  const roman: Record<string, string> = { I: '1', II: '2', III: '3', IV: '4' };
  return `${s[T] ?? T[0]}${division && roman[division] && !['MASTER','GRANDMASTER','CHALLENGER'].includes(T) ? roman[division] : ''}`;
};
export const rankEmblem = (tier?: string | null) =>
  tier ? `https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/images/ranked-emblem/emblem-${tier.toLowerCase()}.png` : '';
/** Valor numérico para ordenar (tier×10 + división + LP/100). */
export const tierValue = (tier?: string | null, division?: string | null, lp?: number | null) => {
  if (!tier) return -1;
  const t = TIER_ORDER.indexOf(tier.toUpperCase());
  return t < 0 ? -1 : t * 10 + (DIV_ORDER[division ?? ''] ?? 0) + Math.min(99, lp ?? 0) / 1000;
};
