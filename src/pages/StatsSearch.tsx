// src/pages/StatsSearch.tsx — búsqueda de invocador (rediseño "Arena").
// Misma barra que el héroe de la portada (SummonerPrompt) y, debajo, solo lo que
// ayuda a buscar: tus recientes y jugadores conocidos con su carril.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  SummonerPrompt,
  REGIONS,
  getRecentSearches,
  removeRecentSearch,
} from '@/components/SummonerPrompt';
import { ArrowRight, BarChart3, Trophy, Radio, Sparkles, History, X } from 'lucide-react';
import { ArenaPage, SplashBackdrop, PageHero, Champion3D, RoleIcon, SectionHead, stagger } from '@/components/arena';
import '@/styles/pages/stats-search.css';

const POPULAR = [
  { id: 'Faker#KR1',      region: 'kr',   label: 'Faker',      lane: 'middle', rank: 'Challenger' },
  { id: 'Caps#EUW',       region: 'euw1', label: 'Caps',       lane: 'middle', rank: 'Challenger' },
  { id: 'Doublelift#NA1', region: 'na1',  label: 'Doublelift', lane: 'bottom', rank: 'Challenger' },
  { id: 'Rekkles#EUW',    region: 'euw1', label: 'Rekkles',    lane: 'bottom', rank: 'Grandmaster' },
  { id: 'Perkz#EUW',      region: 'euw1', label: 'Perkz',      lane: 'middle', rank: 'Challenger' },
  { id: 'Ruler#KR1',      region: 'kr',   label: 'Ruler',      lane: 'bottom', rank: 'Challenger' },
];

const FEATURES = [
  { icon: BarChart3, label: 'Rango, win rate y KDA' },
  { icon: History,   label: 'Historial partida a partida' },
  { icon: Radio,     label: 'Partida en vivo' },
  { icon: Sparkles,  label: 'Insights con IA' },
  { icon: Trophy,    label: 'Torneos jugados' },
];

// El campeón de la página: Twisted Fate, el que revela el destino de cualquiera.
const STAGE = { slug: 'TwistedFate', id: 4 };

const profileHref = (id: string, region: string) => `/stats/${region}/${encodeURIComponent(id)}`;
const regionLabel = (region: string) => REGIONS.find((rg) => rg.value === region)?.label;

export default function StatsSearch() {
  const [recent, setRecent] = useState(getRecentSearches);

  const drop = (id: string) => {
    removeRecentSearch(id);
    setRecent(getRecentSearches());
  };

  return (
    <ArenaPage
      className="ss-page"
      backdrop={<SplashBackdrop champion={STAGE.slug} opacity={0.36} side="right" position="62% 14%" />}
    >
      <PageHero
        kicker="Stats en tiempo real · API oficial de Riot"
        title={<>Busca tu <em>perfil</em></>}
        lede="Escribe tu Riot ID (Nombre#Tag) y elige si quieres ver el perfil o entrar directo a la partida en curso."
        aside={<Champion3D slug={STAGE.slug} champId={STAGE.id} clip="idle" art="none" facing={-0.3} className="ss-stage" />}
      >
        <div className="ss-prompt ax-rise" style={stagger(3)}>
          {/* Sin desplegable: esta página ya lista los recientes debajo. */}
          <SummonerPrompt autoFocus quickLookups={null} showRecent={false} className="ss-prompt-box" />
        </div>
        <ul className="ss-features ax-rise" style={stagger(4)}>
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return <li key={f.label}><Icon size={15} aria-hidden />{f.label}</li>;
          })}
        </ul>
      </PageHero>

      <div className="ss-cols">
        {recent.length > 0 && (
          <section className="td-panel ax-card ax-rise" style={stagger(5)}>
            <SectionHead icon={<History size={15} />} title="Tus búsquedas recientes" />
            <ul className="ss-list">
              {recent.map((r) => (
                <li key={r.id} className="ss-item">
                  <Link to={profileHref(r.id, r.region)} className="ss-item-link">
                    <span className="ss-item-name">{r.id}</span>
                    <span className="td-over">{regionLabel(r.region)}</span>
                  </Link>
                  <button type="button" className="ss-item-x" aria-label={`Quitar ${r.id} de recientes`} onClick={() => drop(r.id)}>
                    <X size={15} aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="td-panel ax-card ax-rise" style={stagger(6)}>
          <SectionHead icon={<Trophy size={15} />} title="Jugadores populares" />
          <ul className="ss-list ss-list--two">
            {POPULAR.map((p) => (
              <li key={p.id} className="ss-item">
                <Link to={profileHref(p.id, p.region)} className="ss-item-link">
                  <RoleIcon lane={p.lane} size={22} label />
                  <span className="ss-item-name">{p.label}</span>
                  <span className="ss-item-sub">{p.rank}</span>
                  <span className="td-over ss-item-region">{regionLabel(p.region)}</span>
                  <ArrowRight size={15} aria-hidden className="ss-item-go" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </ArenaPage>
  );
}
