// ATAK.GG — regiones de Riot: el identificador que viaja a la API y la
// etiqueta que ve la gente NO son lo mismo. La API usa `la1` / `la2`; los
// jugadores dicen LAN y LAS. Mostrar "LA1" en un selector es hablarle al
// usuario en el idioma de la API.
//
// Fuente única: esta lista. SummonerPrompt la reexporta para no romper sus
// importaciones existentes.

export interface RiotRegion {
  /** Valor que se envía a la API (platform id). Nunca se traduce. */
  value: string;
  /** Etiqueta corta que ve el usuario (LAN, LAS, NA…). */
  label: string;
  /** Nombre completo en español. */
  name: string;
  flag: string;
}

export const REGIONS: RiotRegion[] = [
  { value: 'la1',  label: 'LAN',  name: 'Latinoamérica Norte', flag: '🇲🇽' },
  { value: 'la2',  label: 'LAS',  name: 'Latinoamérica Sur',   flag: '🇦🇷' },
  { value: 'na1',  label: 'NA',   name: 'Norteamérica',        flag: '🇺🇸' },
  { value: 'euw1', label: 'EUW',  name: 'Europa Oeste',        flag: '🇪🇺' },
  { value: 'eun1', label: 'EUNE', name: 'Europa Nórdica',      flag: '🇪🇺' },
  { value: 'kr',   label: 'KR',   name: 'Corea',               flag: '🇰🇷' },
  { value: 'br1',  label: 'BR',   name: 'Brasil',              flag: '🇧🇷' },
  { value: 'oc1',  label: 'OCE',  name: 'Oceanía',             flag: '🇦🇺' },
  { value: 'ru',   label: 'RU',   name: 'Rusia',               flag: '🇷🇺' },
  { value: 'tr1',  label: 'TR',   name: 'Turquía',             flag: '🇹🇷' },
  { value: 'jp1',  label: 'JP',   name: 'Japón',               flag: '🇯🇵' },
];

/** Etiqueta de usuario para un platform id ('la1' → 'LAN'). */
export function regionLabel(platform?: string | null): string {
  const r = REGIONS.find((x) => x.value === (platform || '').toLowerCase());
  return r?.label ?? (platform ? platform.toUpperCase() : '—');
}

/** Nombre completo ('la1' → 'Latinoamérica Norte'). */
export function regionName(platform?: string | null): string {
  const r = REGIONS.find((x) => x.value === (platform || '').toLowerCase());
  return r?.name ?? regionLabel(platform);
}
