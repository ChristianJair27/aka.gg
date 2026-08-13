// src/pages/StatsSearch.tsx — búsqueda de invocador · prompt minimalista
// Misma barra que el hero de Home (SummonerPrompt) sobre el video de marca:
// una sola caja flotante, y debajo solo lo que ayuda a buscar (recientes,
// jugadores populares). Sin tarjetas apiladas ni orbes: aire y contraste.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ScrollVideoBg } from '@/components/ScrollVideoBg';
import {
  SummonerPrompt,
  REGIONS,
  getRecentSearches,
  removeRecentSearch,
} from '@/components/SummonerPrompt';
import { BarChart3, Trophy, Target, Zap, TrendingUp, Users, X } from 'lucide-react';

const POPULAR = [
  { id: 'Faker#KR1',      region: 'kr',   label: 'Faker',      role: 'Mid · Challenger' },
  { id: 'Caps#EUW',       region: 'euw1', label: 'Caps',       role: 'Mid · Challenger' },
  { id: 'Doublelift#NA1', region: 'na1',  label: 'Doublelift', role: 'ADC · Challenger' },
  { id: 'Rekkles#EUW',    region: 'euw1', label: 'Rekkles',    role: 'ADC · Grandmaster' },
  { id: 'Perkz#EUW',      region: 'euw1', label: 'Perkz',      role: 'Mid · Challenger' },
  { id: 'Ruler#KR1',      region: 'kr',   label: 'Ruler',      role: 'ADC · Challenger' },
];

const FEATURES = [
  { icon: BarChart3,  label: 'Stats detalladas' },
  { icon: Trophy,     label: 'Rank tracking' },
  { icon: Target,     label: 'Campeón 3D' },
  { icon: Zap,        label: 'AI Insights' },
  { icon: TrendingUp, label: 'Historial' },
  { icon: Users,      label: 'Torneos' },
];

const profileHref = (id: string, region: string) =>
  `/stats/${region}/${encodeURIComponent(id)}`;

const fadeUp = (delay: number) => ({
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] as const },
});

export default function StatsSearch() {
  const [recent, setRecent] = useState(getRecentSearches);

  const drop = (id: string) => {
    removeRecentSearch(id);
    setRecent(getRecentSearches());
  };

  return (
    <div className="min-h-screen text-white relative overflow-hidden">
      {/* ── Fondo: negro + video de marca + un solo halo rojo ─────────────── */}
      <div className="fixed inset-0 bg-black -z-20" />
      <ScrollVideoBg peakOpacity={0.45} floorOpacity={0.28} />
      <div
        className="fixed inset-0 -z-10 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 70% 55% at 50% -10%, rgba(185,28,28,0.22) 0%, transparent 70%)' }}
      />

      <div className="relative min-h-screen flex flex-col items-center justify-center px-5 py-28">
        {/* ── Encabezado ──────────────────────────────────────────────────── */}
        <motion.div {...fadeUp(0)} className="text-center mb-10 flex flex-col items-center gap-4">
          <img
            src="/atak-logo-mark.png"
            alt="ATAK.GG"
            className="h-10 w-10 opacity-90"
            style={{ objectFit: 'contain' }}
            draggable={false}
          />
          <span className="text-[11px] uppercase tracking-[0.28em] text-white/35 font-medium">
            Stats en tiempo real · API oficial de Riot
          </span>
          <h1
            className="font-serif font-normal text-4xl sm:text-5xl md:text-6xl tracking-[-0.02em] leading-[1.05]"
            style={{ textWrap: 'balance' }}
          >
            Busca tu <span className="italic text-red-500">perfil</span>
          </h1>
        </motion.div>

        {/* ── Prompt ──────────────────────────────────────────────────────── */}
        <motion.div {...fadeUp(0.12)} className="w-full">
          {/* Sin desplegable: esta página ya lista los recientes debajo. */}
          <SummonerPrompt autoFocus quickLookups={null} showRecent={false} />
        </motion.div>

        {/* ── Recientes ───────────────────────────────────────────────────── */}
        {recent.length > 0 && (
          <motion.div {...fadeUp(0.24)} className="w-full max-w-2xl mx-auto mt-10">
            <p className="text-[10px] uppercase tracking-[0.28em] text-white/25 mb-3 text-center">
              Recientes
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {recent.map(r => (
                <div
                  key={r.id}
                  className="group flex items-center gap-2 h-9 pl-3.5 pr-2 rounded-full
                    border border-white/[0.08] bg-white/[0.02] hover:border-red-500/30 transition-all"
                >
                  <Link
                    to={profileHref(r.id, r.region)}
                    className="text-sm text-white/55 group-hover:text-white transition-colors"
                  >
                    {r.id}
                    <span className="ml-1.5 text-[11px] text-white/25">
                      {REGIONS.find(rg => rg.value === r.region)?.label}
                    </span>
                  </Link>
                  <button
                    type="button"
                    aria-label={`Quitar ${r.id} de recientes`}
                    onClick={() => drop(r.id)}
                    className="text-white/20 hover:text-red-400 transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* ── Jugadores populares ─────────────────────────────────────────── */}
        <motion.div {...fadeUp(0.32)} className="w-full max-w-2xl mx-auto mt-12">
          <p className="text-[10px] uppercase tracking-[0.28em] text-white/25 mb-4 text-center">
            Jugadores populares
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10">
            {POPULAR.map(p => (
              <Link
                key={p.id}
                to={profileHref(p.id, p.region)}
                className="group flex items-baseline gap-3 py-3 border-b border-white/[0.05]"
              >
                <span className="text-[15px] text-white/70 group-hover:text-white transition-colors">
                  {p.label}
                </span>
                <span className="text-xs text-white/25 truncate">{p.role}</span>
                <span className="ml-auto text-[11px] text-white/20 group-hover:text-red-400 transition-colors">
                  {REGIONS.find(rg => rg.value === p.region)?.label}
                </span>
              </Link>
            ))}
          </div>
        </motion.div>

        {/* ── Qué encuentras dentro ───────────────────────────────────────── */}
        <motion.div {...fadeUp(0.42)} className="mt-12 flex flex-wrap gap-x-6 gap-y-3 justify-center max-w-2xl">
          {FEATURES.map(f => {
            const Icon = f.icon;
            return (
              <span key={f.label} className="flex items-center gap-2 text-xs text-white/30">
                <Icon className="h-3.5 w-3.5 text-red-500/50" />
                {f.label}
              </span>
            );
          })}
        </motion.div>
      </div>
    </div>
  );
}
