// Genera public/sitemap.xml antes de cada build (npm run build → prebuild).
// Es el sitemap que se envía en Search Console (tiene que vivir en este dominio):
//   · rutas públicas fijas + las 170+ páginas de campeón (Data Dragon);
//   · torneos y perfiles del sitemap dinámico del backend, si responde a tiempo.
// Si no hay red, deja las rutas fijas y conserva el archivo anterior para lo demás.
import fs from 'node:fs';
import path from 'node:path';

const SITE = 'https://atakgg.revolution505.com';
const BACKEND = process.env.SITEMAP_BACKEND || 'https://atakback.revolution505.com/api/sitemap.xml';
const OUT = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', 'public', 'sitemap.xml');
const today = new Date().toISOString().slice(0, 10);

const STATIC = [
  ['/', 'daily', '1.0'], ['/tournaments', 'daily', '0.9'], ['/tournaments/lqc-2026', 'daily', '0.9'],
  ['/stats', 'weekly', '0.8'], ['/companion', 'monthly', '0.8'],
  ['/meta', 'daily', '0.7'], ['/social', 'daily', '0.7'],
];
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// /crear-torneo no va: sin sesión redirige a /login (noindex); es un enlace corto para la bio.
const SKIP = /\/(crear-torneo|login|register)$/;
const urls = new Map();
const add = (loc, changefreq, priority, lastmod) => { if (!SKIP.test(loc) && !urls.has(loc)) urls.set(loc, { changefreq, priority, lastmod }); };

async function get(url, as = 'json') {
  const r = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return as === 'json' ? r.json() : r.text();
}

for (const [p, f, pr] of STATIC) add(SITE + p, f, pr, today);
try {
  const [v] = await get('https://ddragon.leagueoflegends.com/api/versions.json');
  const data = await get(`https://ddragon.leagueoflegends.com/cdn/${v}/data/es_MX/champion.json`);
  for (const c of Object.values(data.data).sort((a, b) => a.id.localeCompare(b.id))) add(`${SITE}/champion/${encodeURIComponent(c.id)}`, 'weekly', '0.7', today);
} catch (e) { console.warn('[sitemap] campeones:', e.message); }
try {
  const xml = await get(BACKEND, 'text');
  for (const m of xml.matchAll(/<url><loc>([^<]+)<\/loc>(?:<lastmod>([^<]+)<\/lastmod>)?<changefreq>([^<]+)<\/changefreq><priority>([^<]+)<\/priority><\/url>/g)) {
    const loc = m[1].replace(/&amp;/g, '&');
    if (loc.startsWith(SITE)) add(loc, m[3], m[4], m[2]);
  }
} catch (e) {
  console.warn('[sitemap] backend:', e.message);
  // Sin backend: conserva los torneos/perfiles del sitemap anterior.
  try { for (const m of fs.readFileSync(OUT, 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)) add(m[1].replace(/&amp;/g, '&'), 'weekly', '0.5'); } catch { /* primero */ }
}

const body = [...urls].map(([loc, u]) => `  <url><loc>${esc(loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}<changefreq>${u.changefreq}</changefreq><priority>${u.priority}</priority></url>`).join('\n');
fs.writeFileSync(OUT, `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`);
console.log(`[sitemap] ${urls.size} URLs → public/sitemap.xml`);
