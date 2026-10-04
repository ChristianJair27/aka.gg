// Campeones que pueden salir en 3D en el héroe de la portada.
//
// Criterio: modelo ≤ 5 MB en cdn.modelviewer.lol, para que cargue rápido y entre
// también en el presupuesto de móvil de <Champion3D> (medido el 4-oct-2026).
// Si añades uno, comprueba antes el peso de su GLB.
export interface StageChampion {
  /** Slug de Data Dragon. */
  slug: string;
  /** Id numérico (champion.json → key). */
  id: number;
  /** Skin del splash de fondo (por defecto la base). */
  backdropSkin?: number;
}

export const STAGE_CHAMPIONS: StageChampion[] = [
  // Katarina es la daga del logo; su fondo usa la skin 8 (negro y crimson).
  { slug: 'Katarina', id: 55, backdropSkin: 8 },
  { slug: 'Garen', id: 86 },
  { slug: 'Riven', id: 92 },
  { slug: 'Fiora', id: 114 },
  { slug: 'Draven', id: 119 },
  { slug: 'Talon', id: 91 },
  { slug: 'MissFortune', id: 21 },
  { slug: 'Ashe', id: 22 },
  { slug: 'Tryndamere', id: 23 },
  { slug: 'Renekton', id: 58 },
  { slug: 'Gangplank', id: 41 },
  { slug: 'Vladimir', id: 8 },
  { slug: 'Nocturne', id: 56 },
  { slug: 'Shen', id: 98 },
  { slug: 'Ryze', id: 13 },
  { slug: 'Azir', id: 268 },
  { slug: 'TwistedFate', id: 4 },
  { slug: 'Tristana', id: 18 },
  { slug: 'Blitzcrank', id: 53 },
  { slug: 'Veigar', id: 45 },
  { slug: 'Shaco', id: 35 },
  { slug: 'Malphite', id: 54 },
];

/**
 * Elige un campeón al azar, distinto del de la visita anterior (se recuerda en
 * localStorage bajo `storageKey`). `?champ=Slug` en la URL fuerza uno concreto:
 * sirve para compartir, para capturas y para probar un modelo nuevo.
 */
export function pickStageChampion(storageKey: string): StageChampion {
  const pool = STAGE_CHAMPIONS;
  try {
    const forced = new URLSearchParams(window.location.search).get('champ');
    const hit = forced && pool.find((c) => c.slug.toLowerCase() === forced.toLowerCase());
    if (hit) return hit;
  } catch { /* sin window: sigue al azar */ }

  let last: string | null = null;
  try { last = localStorage.getItem(storageKey); } catch { /* almacenamiento bloqueado */ }
  const options = pool.length > 1 ? pool.filter((c) => c.slug !== last) : pool;
  const pick = options[Math.floor(Math.random() * options.length)];
  try { localStorage.setItem(storageKey, pick.slug); } catch { /* noop */ }
  return pick;
}
