// src/pages/MetaPage.tsx — Meta diaria potenciada por OP.GG MCP:
// tier list por línea, calendario esports y skins en oferta.
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { axiosInstance } from '@/lib/axios';
import { ScrollVideoBg } from '@/components/ScrollVideoBg';
import { useChampions } from '@/hooks/use-ddragon';
import { dd } from '@/lib/dataDragon';
import { TrendingUp, CalendarDays, Sparkles, Swords } from 'lucide-react';

const LANES = [
  { key: 'top', label: 'Top' }, { key: 'jungle', label: 'Jungla' },
  { key: 'mid', label: 'Mid' }, { key: 'bottom', label: 'ADC' }, { key: 'support', label: 'Soporte' },
] as const;

const TABS = [
  { key: 'tier', label: 'Tier List', icon: <TrendingUp className="h-4 w-4" /> },
  { key: 'esports', label: 'Esports', icon: <CalendarDays className="h-4 w-4" /> },
  { key: 'skins', label: 'Ofertas', icon: <Sparkles className="h-4 w-4" /> },
] as const;

const SURFACE = 'rounded-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_8px_24px_rgba(0,0,0,0.35)]';
const SURFACE_BG = { background: 'linear-gradient(180deg, rgba(16,16,20,0.55) 0%, rgba(10,10,13,0.35) 100%)' };

function tierBadge(tier: number) {
  const map: Record<number, [string, string]> = {
    0: ['NEW', 'bg-purple-500/20 text-purple-300'],
    1: ['S', 'bg-yellow-500/20 text-yellow-300'],
    2: ['A', 'bg-teal-500/20 text-teal-300'],
    3: ['B', 'bg-blue-500/20 text-blue-300'],
    4: ['C', 'bg-gray-500/20 text-gray-300'],
    5: ['D', 'bg-red-500/20 text-red-300'],
  };
  const [label, cls] = map[tier] ?? map[4];
  return <span className={`px-2 py-0.5 rounded-md text-xs font-black ${cls}`}>{label}</span>;
}

function TierListTab() {
  const [lane, setLane] = useState<(typeof LANES)[number]['key']>('mid');
  const { data: champs } = useChampions();
  const q = useQuery({
    queryKey: ['opgg', 'tier', lane],
    queryFn: async () => (await axiosInstance.get(`/api/opgg/tier-list?position=${lane}`)).data.picks as any[],
    staleTime: 10 * 60 * 1000,
  });

  return (
    <div>
      <div className="flex gap-2 flex-wrap mb-5">
        {LANES.map((l) => (
          <button key={l.key} onClick={() => setLane(l.key)}
            className={`px-4 py-2 rounded-full text-sm font-semibold transition ${
              lane === l.key ? 'bg-red-600 text-white' : 'bg-white/[0.05] text-gray-400 hover:bg-white/[0.1] hover:text-white'
            }`}>
            {l.label}
          </button>
        ))}
      </div>

      {q.isLoading && <p className="text-gray-500 text-sm py-8 text-center animate-pulse">Cargando meta de OP.GG…</p>}
      {q.isError && <p className="text-red-400 text-sm py-8 text-center">No se pudo cargar la tier list.</p>}

      <AnimatePresence mode="wait">
        <motion.div key={lane} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
          <div className="grid gap-2">
            {(q.data ?? []).slice(0, 25).map((p, i) => {
              const slug = champs?.byKey?.[String(p.id)]?.id;
              return (
                <motion.div key={p.name}
                  initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(i * 0.03, 0.5) }}
                  className={`${SURFACE} flex items-center gap-3 px-4 py-2.5`} style={SURFACE_BG}>
                  <span className="w-6 text-center text-sm font-black text-white/40">{i + 1}</span>
                  <img src={slug ? dd.champion(slug) : ''} alt={p.name}
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }}
                    className="w-10 h-10 rounded-xl object-cover border border-white/10" loading="lazy" />
                  <span className="flex-1 min-w-0 font-semibold text-white truncate">{p.name}</span>
                  {tierBadge(p.tier)}
                  <span className={`w-14 text-right text-sm font-bold ${p.wr >= 52 ? 'text-green-400' : p.wr >= 49 ? 'text-white/70' : 'text-red-400/80'}`}>
                    {p.wr != null ? `${p.wr}%` : '—'}
                  </span>
                  <div className="hidden sm:block w-24">
                    <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                      <motion.div className="h-full bg-gradient-to-r from-red-600 to-red-400 rounded-full"
                        initial={{ width: 0 }} animate={{ width: `${(p.score / 10) * 100}%` }}
                        transition={{ duration: 0.7, delay: Math.min(i * 0.03, 0.5) }} />
                    </div>
                  </div>
                  <span className="hidden sm:block w-8 text-right text-xs text-white/40 tabular-nums">{p.score}</span>
                </motion.div>
              );
            })}
          </div>
          <p className="text-[11px] text-white/25 mt-4 text-center">Datos de OP.GG · actualizado cada 30 min · el score combina tier y ranking de línea</p>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function EsportsTab() {
  const q = useQuery({
    queryKey: ['opgg', 'esports'],
    queryFn: async () => (await axiosInstance.get('/api/opgg/esports/schedules')).data.schedules as any[],
    staleTime: 10 * 60 * 1000,
  });
  const byDay = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const s of q.data ?? []) {
      const d = new Date(s.scheduledAt).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'short' });
      if (!m.has(d)) m.set(d, []);
      m.get(d)!.push(s);
    }
    return [...m.entries()];
  }, [q.data]);

  if (q.isLoading) return <p className="text-gray-500 text-sm py-8 text-center animate-pulse">Cargando calendario…</p>;
  if (!byDay.length) return <p className="text-gray-500 text-sm py-8 text-center">Sin partidos próximos.</p>;

  return (
    <div className="space-y-6">
      {byDay.map(([day, matches]) => (
        <section key={day}>
          <h3 className="text-xs uppercase tracking-[2px] text-red-400/80 font-bold mb-3">{day}</h3>
          <div className="grid gap-2">
            {matches.map((m: any) => (
              <a key={m.id} href={m.details} target="_blank" rel="noopener noreferrer"
                className={`${SURFACE} flex items-center gap-3 px-4 py-3 hover:bg-white/[0.04] transition`} style={SURFACE_BG}>
                <span className="px-2 py-0.5 rounded-md bg-white/[0.06] text-[10px] font-bold text-white/60 w-14 text-center">{m.league}</span>
                <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                  <span className="text-sm font-semibold text-white truncate">{m.homeTeam?.acronym}</span>
                  <img src={m.homeTeam?.image_url} alt="" className="w-7 h-7 object-contain" loading="lazy"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }} />
                </div>
                <span className="text-xs font-black text-white/40 px-1">
                  {m.status === 'NOT_STARTED'
                    ? new Date(m.scheduledAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
                    : `${m.homeScore} - ${m.awayScore}`}
                </span>
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <img src={m.awayTeam?.image_url} alt="" className="w-7 h-7 object-contain" loading="lazy"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }} />
                  <span className="text-sm font-semibold text-white truncate">{m.awayTeam?.acronym}</span>
                </div>
                <span className="hidden sm:block text-[10px] text-white/30">Bo{m.numberOfGames}</span>
              </a>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function SkinsTab() {
  const { data: champs } = useChampions();
  const q = useQuery({
    queryKey: ['opgg', 'skins'],
    queryFn: async () => (await axiosInstance.get('/api/opgg/skins-sale')).data.skins as any[],
    staleTime: 60 * 60 * 1000,
  });
  if (q.isLoading) return <p className="text-gray-500 text-sm py-8 text-center animate-pulse">Cargando ofertas…</p>;
  if (!q.data?.length) return <p className="text-gray-500 text-sm py-8 text-center">Sin ofertas activas.</p>;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
      {q.data.map((s: any, i: number) => {
        const champ = champs?.byKey?.[String(s.champion_id)];
        const skinNum = s.skin_id % 1000;
        return (
          <motion.div key={s.skin_id}
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: Math.min(i * 0.04, 0.6) }}
            className={`${SURFACE} overflow-hidden group`} style={SURFACE_BG}>
            <div className="relative h-40 overflow-hidden">
              {champ && (
                <img src={dd.championSplash(champ.id, skinNum)} alt=""
                  className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500"
                  loading="lazy"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).src = dd.championSplash(champ.id, 0); }} />
              )}
              <span className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-red-600 text-white text-xs font-black">
                -{Math.round((s.discount_rate ?? 0) * 100)}%
              </span>
            </div>
            <div className="p-3">
              <p className="text-sm font-semibold text-white truncate">{champ?.name ?? `Campeón ${s.champion_id}`}</p>
              <p className="text-xs text-yellow-300/90 font-bold mt-0.5">{s.cost} RP</p>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

export default function MetaPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('tier');
  return (
    <div className="min-h-screen text-white bg-black relative overflow-x-hidden">
      <ScrollVideoBg peakOpacity={0.55} floorOpacity={0.3} />
      <div className="relative max-w-4xl mx-auto px-4 pt-24 pb-16">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-4 bg-white/[0.05] backdrop-blur-md text-gray-400 text-xs tracking-[3px] uppercase">
            <Swords className="h-3.5 w-3.5" /> Datos en vivo de OP.GG
          </div>
          <h1 className="text-4xl md:text-5xl font-medium tracking-[-1px]">
            Meta <span className="font-serif italic text-red-500">del parche</span>
          </h1>
          <p className="text-gray-500 text-sm mt-2">Tier list por línea, calendario pro y ofertas — actualizado solo.</p>
        </div>

        <div className="flex justify-center gap-2 mb-8">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition ${
                tab === t.key ? 'bg-foreground text-background' : 'bg-white/[0.05] text-gray-400 hover:bg-white/[0.1] hover:text-white'
              }`}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}>
            {tab === 'tier' && <TierListTab />}
            {tab === 'esports' && <EsportsTab />}
            {tab === 'skins' && <SkinsTab />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
