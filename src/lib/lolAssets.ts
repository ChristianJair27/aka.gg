// Assets de League of Legends para la capa visual "Arena".
//
// Dos orígenes:
//  · /public/lol/**  — iconos y fondos del repo noxelisdev/LoL_DDragon (extras),
//    recortados y pasados a WebP (53 archivos, ~160 KB en total). Son locales
//    para no depender de un tercero en cada carga.
//  · Data Dragon / CommunityDragon — arte por campeón (splash, loading, tiles),
//    que cambia con cada parche y no tiene sentido copiar.
const champKey = (name: string) => (name || '').replace(/[^a-zA-Z0-9]/g, '');
const DD_IMG = 'https://ddragon.leagueoflegends.com/cdn/img';
const CDRAGON = 'https://raw.communitydragon.org/latest';

export type Lane = 'top' | 'jungle' | 'middle' | 'bottom' | 'support' | 'fill';
export type ChampClass = 'assassin' | 'fighter' | 'mage' | 'marksman' | 'support' | 'tank';
export type StatKey =
  | 'ability_power' | 'armor' | 'armor_pen' | 'attack_damage' | 'attack_speed' | 'cdr_reduction'
  | 'critical_chance' | 'health' | 'health_regen' | 'life_steal' | 'magic_pen' | 'magic_resist'
  | 'mana' | 'mana_regen' | 'move_speed' | 'omnivamp' | 'range' | 'tenacity';
export type DragonKey = 'chemtech' | 'cloud' | 'elder' | 'hextech' | 'infernal' | 'mountain' | 'ocean';
export type UiIcon = 'champion' | 'creep' | 'gold' | 'items' | 'minion' | 'nashor' | 'rift_herald' | 'score' | 'spells' | 'tower';
export type MapArt = 'summoners-rift' | 'howling-abyss' | 'clash' | 'postgame' | 'shadow-isles' | 'mist';

// Riot nombra los carriles de varias formas según el endpoint (TOP / JUNGLE /
// MIDDLE|MID / BOTTOM|ADC|BOT / UTILITY|SUPPORT). Todas caen aquí.
const LANE_ALIASES: Record<string, Lane> = {
  top: 'top', jungle: 'jungle', jg: 'jungle', mid: 'middle', middle: 'middle',
  bot: 'bottom', bottom: 'bottom', adc: 'bottom', carry: 'bottom',
  support: 'support', supp: 'support', sup: 'support', utility: 'support',
  fill: 'fill', none: 'fill', '': 'fill',
};
export const LANE_LABELS: Record<Lane, string> = {
  top: 'Top', jungle: 'Jungla', middle: 'Mid', bottom: 'ADC', support: 'Soporte', fill: 'Cualquiera',
};
export function normalizeLane(v?: string | null): Lane {
  return LANE_ALIASES[String(v ?? '').trim().toLowerCase()] ?? 'fill';
}

// Etiquetas de clase de Data Dragon (champion.json → tags), en inglés.
const CLASS_ALIASES: Record<string, ChampClass> = {
  assassin: 'assassin', fighter: 'fighter', mage: 'mage', marksman: 'marksman', support: 'support', tank: 'tank',
};
export const CLASS_LABELS: Record<ChampClass, string> = {
  assassin: 'Asesino', fighter: 'Luchador', mage: 'Mago', marksman: 'Tirador', support: 'Soporte', tank: 'Tanque',
};
export function normalizeClass(v?: string | null): ChampClass | null {
  return CLASS_ALIASES[String(v ?? '').trim().toLowerCase()] ?? null;
}

export const lol = {
  // ── Locales (/public/lol) ──────────────────────────────────────────────────
  lane: (lane?: string | null) => `/lol/lanes/${normalizeLane(lane)}.webp`,
  champClass: (tag?: string | null) => {
    const c = normalizeClass(tag);
    return c ? `/lol/classes/${c}.webp` : '';
  },
  stat: (key: StatKey) => `/lol/stats/${key}.webp`,
  dragon: (key: DragonKey) => `/lol/dragons/${key}.webp`,
  ui: (key: UiIcon) => `/lol/ui/${key}.webp`,
  map: (key: MapArt) => `/lol/maps/${key}.webp`,

  // ── Por campeón (CDN de Riot / CommunityDragon) ────────────────────────────
  /** Splash 1215×717: fondos anchos. */
  splash: (name: string, skin = 0) => `${DD_IMG}/champion/splash/${champKey(name)}_${skin}.jpg`,
  /** Splash "centrado" 1280×720 con el campeón en el centro: fondos de héroe. */
  centered: (name: string, skin = 0) => `${DD_IMG}/champion/centered/${champKey(name)}_${skin}.jpg`,
  /** Arte vertical 308×560: tarjetas altas. */
  loading: (name: string, skin = 0) => `${DD_IMG}/champion/loading/${champKey(name)}_${skin}.jpg`,
  /** Mosaico cuadrado 380×380 sin marco: miniaturas grandes. */
  tile: (name: string, skin = 0) => `${DD_IMG}/champion/tiles/${champKey(name)}_${skin}.jpg`,
  /** Icono por id numérico (cuando el payload no trae el slug). */
  iconById: (id: number | string) =>
    `${CDRAGON}/plugins/rcp-be-lol-game-data/global/default/v1/champion-icons/${id}.png`,
  /** Modelo 3D con rig y animaciones (modelviewer.lol). skin 0 = base. */
  model: (name: string, champId: number | string, skin = 0) =>
    `https://cdn.modelviewer.lol/lol/models/${champKey(name).toLowerCase()}/${Number(champId) * 1000 + skin}/model.glb`,
};

/** Arte de mapa según el modo de un torneo/partida. */
export function mapArtFor(gameMap?: string | null): MapArt {
  const m = String(gameMap ?? '').toUpperCase();
  if (m === 'ARAM' || m === 'HA') return 'howling-abyss';
  if (m === 'ARENA') return 'shadow-isles';
  return 'summoners-rift';
}
