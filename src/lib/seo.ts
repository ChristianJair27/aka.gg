// SEO por página en una SPA: título, descripción, Open Graph/Twitter, canonical
// y JSON-LD se escriben en el <head> al montar la página y se restauran al salir.
// Google renderiza JavaScript, así que esto es lo que indexa; WhatsApp/Discord/
// Twitter NO lo ejecutan, para ellos están las páginas /share del backend.
import { useEffect } from 'react';

const SITE = 'https://atakgg.revolution505.com';
const DEFAULTS = {
  title: 'ATAK.GG — Stats y torneos de League of Legends. Sin anuncios.',
  description: 'Stats en tiempo real, torneos con códigos oficiales de Riot y brackets automáticos. Sin anuncios, sin instalar nada: todo en tu navegador. La plataforma de la escena competitiva LATAM.',
  image: `${SITE}/og-image.png`,
};

export interface SeoInput {
  /** Título de la página; se le añade " · ATAK.GG" salvo que ya lo lleve. */
  title?: string;
  description?: string;
  image?: string | null;
  /** Ruta canónica (sin query) o URL completa. Por defecto, la ruta actual. */
  canonical?: string;
  /** Páginas privadas o sin valor de búsqueda (login, dashboard, overlays). */
  noindex?: boolean;
  /** Datos estructurados (schema.org). */
  jsonLd?: Record<string, unknown> | Array<Record<string, unknown>> | null;
}

function meta(attr: 'name' | 'property', key: string, content: string | null) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (content == null) { el?.remove(); return; }
  if (!el) { el = document.createElement('meta'); el.setAttribute(attr, key); document.head.appendChild(el); }
  el.setAttribute('content', content);
}
function link(rel: string, href: string | null) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (href == null) { el?.remove(); return; }
  if (!el) { el = document.createElement('link'); el.setAttribute('rel', rel); document.head.appendChild(el); }
  el.setAttribute('href', href);
}
function jsonLd(data: SeoInput['jsonLd']) {
  const id = 'seo-jsonld';
  let el = document.getElementById(id);
  if (!data) { el?.remove(); return; }
  if (!el) { el = document.createElement('script'); el.id = id; el.setAttribute('type', 'application/ld+json'); document.head.appendChild(el); }
  el.textContent = JSON.stringify(data);
}

export function applySeo(input: SeoInput) {
  const title = input.title ? (/ATAK\.GG/i.test(input.title) ? input.title : `${input.title} · ATAK.GG`) : DEFAULTS.title;
  const description = (input.description || DEFAULTS.description).slice(0, 300);
  const image = input.image || DEFAULTS.image;
  const canonical = input.canonical ? (input.canonical.startsWith('http') ? input.canonical : `${SITE}${input.canonical}`) : `${SITE}${window.location.pathname}`;
  document.title = title;
  meta('name', 'description', description);
  meta('name', 'robots', input.noindex ? 'noindex, nofollow' : null);
  meta('property', 'og:title', title);
  meta('property', 'og:description', description);
  meta('property', 'og:image', image);
  meta('property', 'og:url', canonical);
  meta('property', 'og:type', input.jsonLd && !Array.isArray(input.jsonLd) && input.jsonLd['@type'] === 'SportsEvent' ? 'article' : 'website');
  meta('name', 'twitter:title', title);
  meta('name', 'twitter:description', description);
  meta('name', 'twitter:image', image);
  link('canonical', input.noindex ? null : canonical);
  jsonLd(input.jsonLd ?? null);
}

/** Úsalo al inicio de cada página pública. Se vuelve a aplicar cuando cambian los datos. */
export function useSeo(input: SeoInput, deps: unknown[] = []) {
  useEffect(() => {
    applySeo(input);
    return () => { applySeo({}); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/** JSON-LD de un torneo como evento deportivo (aparece como evento en Google). */
export function tournamentJsonLd(t: { id: string; name: string; startDate?: string; endDate?: string; description?: string; prize?: string; logoUrl?: string | null; bannerUrl?: string | null; phase?: string }) {
  const status = t.phase === 'complete' ? 'https://schema.org/EventCompleted' : 'https://schema.org/EventScheduled';
  return {
    '@context': 'https://schema.org',
    '@type': 'SportsEvent',
    name: t.name,
    sport: 'League of Legends',
    description: t.description || `Torneo de League of Legends ${t.name} en ATAK.GG${t.prize ? ` · Premio: ${t.prize}` : ''}`,
    startDate: t.startDate || undefined,
    endDate: t.endDate || undefined,
    eventStatus: status,
    eventAttendanceMode: 'https://schema.org/OnlineEventAttendanceMode',
    location: { '@type': 'VirtualLocation', url: `${SITE}/tournaments/${t.id}` },
    image: t.bannerUrl || t.logoUrl || DEFAULTS.image,
    organizer: { '@type': 'Organization', name: 'ATAK.GG', url: SITE },
    url: `${SITE}/tournaments/${t.id}`,
  };
}
