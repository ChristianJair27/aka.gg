// src/pages/ChampionPage.tsx — Detalle de campeón (OP.GG MCP): runas, build,
// orden de skills, counters y stats con estilo ATAK (motion + splash de fondo).
import { useMemo, useState } from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { axiosInstance } from '@/lib/axios';
import { useChampions, useStaticData } from '@/hooks/use-ddragon';
import { dd } from '@/lib/dataDragon';
import { ArrowLeft, Swords, ChevronRight } from 'lucide-react';

const POSITIONS = [
  { key: 'TOP', label: 'Top' }, { key: 'JUNGLE', label: 'Jungla' },
  { key: 'MIDDLE', label: 'Mid' }, { key: 'ADC', label: 'ADC' }, { key: 'SUPPORT', label: 'Soporte' },
] as const;

const SURFACE = 'rounded-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_8px_24px_rgba(0,0,0,0.35)]';
const SURFACE_BG = { background: 'linear-gradient(180deg, rgba(16,16,20,0.6) 0%, rgba(10,10,13,0.42) 100%)' };

// Anillo de stat animado (SVG)
function StatRing({ value, label, color, fmt }: { value: number | null; label: string; color: string; fmt?: (v: number) => string }) {
  const pct = value != null ? Math.min(1, Math.max(0, value)) : 0;
  const R = 34, C = 2 * Math.PI * R;
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-[92px] h-[92px]">
        <svg viewBox="0 0 92 92" className="w-full h-full -rotate-90">
          <circle cx="46" cy="46" r={R} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="7" />
          <motion.circle cx="46" cy="46" r={R} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round"
            strokeDasharray={C} initial={{ strokeDashoffset: C }}
            animate={{ strokeDashoffset: C * (1 - pct) }} transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }} />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-sm font-black text-white">
          {value != null ? (fmt ? fmt(value) : `${Math.round(value * 100)}%`) : '—'}
        </span>
      </div>
      <span className="text-[10px] uppercase tracking-[2px] text-white/40">{label}</span>
    </div>
  );
}

const SKILL_COLOR: Record<string, string> = { Q: '#3b82f6', W: '#22c55e', E: '#f59e0b', R: '#ef4444' };

export default function ChampionPage() {
  const { slug = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const pos = (params.get('pos') || 'MIDDLE').toUpperCase();

  const { data: champs } = useChampions();
  const { runes, items } = useStaticData();
  const entry = champs?.byId?.[slug] ?? Object.values(champs?.byId ?? {}).find((c: any) => c.id.toLowerCase() === slug.toLowerCase());
  const displayName = entry?.name ?? slug;

  const buildQ = useQuery({
    queryKey: ['champ', 'build', displayName, pos],
    enabled: !!displayName,
    staleTime: 30 * 60_000,
    queryFn: async () => (await axiosInstance.get(`/api/opgg/build`, { params: { champion: displayName, position: pos } })).data.build,
  });
  const countersQ = useQuery({
    queryKey: ['champ', 'counters', displayName, pos],
    enabled: !!displayName,
    staleTime: 30 * 60_000,
    queryFn: async () => (await axiosInstance.get(`/api/opgg/counters`, { params: { champion: displayName, position: pos } })).data.counters as any[],
  });

  const b = buildQ.data;
  const maxOrder = useMemo(() => {
    // Orden de maxeo: primeras 3 skills distintas con más niveles en el orden
    if (!b?.skill_order?.length) return [];
    const counts: Record<string, number> = {};
    for (const s of b.skill_order) if (s !== 'R') counts[s] = (counts[s] ?? 0) + 1;
    return Object.entries(counts).sort((x, y) => y[1] - x[1]).map(([k]) => k);
  }, [b]);

  const setPos = (p: string) => setParams((prev) => { const q = new URLSearchParams(prev); q.set('pos', p); return q; }, { replace: true });

  return (
    <div className="min-h-screen text-white bg-black relative overflow-x-hidden">
      {/* Splash de fondo */}
      {entry && (
        <div className="fixed inset-0 -z-10">
          <img src={dd.championSplash(entry.id)} alt="" className="w-full h-full object-cover object-top opacity-30" />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(5,5,7,0.55) 0%, rgba(5,5,7,0.92) 55%, #050507 100%)' }} />
        </div>
      )}

      <div className="relative max-w-5xl mx-auto px-4 pt-24 pb-16">
        <Link to="/meta" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition mb-6 group">
          <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" /> Volver a Meta
        </Link>

        {/* Hero */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-center gap-5 mb-8">
          {entry && <img src={dd.champion(entry.id)} alt={displayName} className="w-20 h-20 rounded-2xl border-2 border-red-500/40 shadow-[0_0_24px_rgba(225,36,46,0.3)]" />}
          <div className="flex-1 min-w-0">
            <h1 className="text-4xl md:text-5xl font-medium tracking-[-1px]">
              {displayName} {b?.tier != null && b.tier > 0 && (
                <span className="align-middle ml-2 px-2.5 py-1 rounded-lg text-sm font-black bg-yellow-500/15 text-yellow-300">
                  {['', 'S', 'A', 'B', 'C', 'D'][b.tier] ?? `T${b.tier}`}{b.rank ? ` · #${b.rank}` : ''}
                </span>
              )}
            </h1>
            <div className="flex gap-2 mt-3 flex-wrap">
              {POSITIONS.map((p) => (
                <button key={p.key} onClick={() => setPos(p.key)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition ${pos === p.key ? 'bg-red-600 text-white' : 'bg-white/[0.06] text-gray-400 hover:text-white'}`}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-5">
            <StatRing value={b?.win_rate ?? null} label="Winrate" color={b?.win_rate != null && b.win_rate >= 0.51 ? '#4ade80' : '#f87171'} />
            <StatRing value={b?.pick_rate ?? null} label="Pick" color="#60a5fa" fmt={(v) => `${(v * 100).toFixed(1)}%`} />
            <StatRing value={b?.ban_rate ?? null} label="Ban" color="#f59e0b" fmt={(v) => `${(v * 100).toFixed(1)}%`} />
          </div>
        </motion.div>

        {buildQ.isLoading && <p className="text-center text-gray-500 py-16 animate-pulse">Analizando el meta de {displayName}…</p>}
        {buildQ.isError && <p className="text-center text-red-400 py-16">No hay datos para {displayName} en esta posición.</p>}

        {b && (
          <div className="grid md:grid-cols-2 gap-4">
            {/* Runas */}
            <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
              className={`${SURFACE} p-5`} style={SURFACE_BG}>
              <h2 className="text-xs uppercase tracking-[2px] text-red-400 font-bold mb-4">Runas recomendadas</h2>
              <div className="flex flex-wrap items-center gap-2.5">
                {(b.rune_ids ?? []).map((id: number, i: number) => {
                  const r = (runes as any)?.[id];
                  if (!r) return null;
                  return (
                    <motion.div key={`${id}-${i}`} initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.15 + i * 0.05 }} title={r.name}
                      className={i === 0 ? 'w-14 h-14' : 'w-9 h-9'}>
                      <img src={r.icon} alt={r.name} className="w-full h-full object-contain drop-shadow-[0_0_8px_rgba(200,170,110,0.25)]" />
                    </motion.div>
                  );
                })}
              </div>
              <p className="text-[11px] text-white/35 mt-3">{(b.primary_rune_names ?? []).join(' · ')}</p>
            </motion.section>

            {/* Build */}
            <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }}
              className={`${SURFACE} p-5`} style={SURFACE_BG}>
              <h2 className="text-xs uppercase tracking-[2px] text-red-400 font-bold mb-4">Build</h2>
              <div className="space-y-3">
                {[['Inicio', b.starter_ids], ['Núcleo', b.core_item_ids], ['Botas', b.boots_id ? [b.boots_id] : []]].map(([label, ids]: any) => (
                  <div key={label} className="flex items-center gap-2">
                    <span className="w-14 text-[10px] uppercase tracking-wider text-white/40">{label}</span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {(ids ?? []).map((id: number, i: number) => (
                        <motion.div key={`${id}-${i}`} className="flex items-center gap-1.5"
                          initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 + i * 0.07 }}>
                          {i > 0 && label === 'Núcleo' && <ChevronRight className="h-3 w-3 text-white/25" />}
                          <img src={dd.item(id)} alt={(items as any)?.[id]?.name ?? ''} title={(items as any)?.[id]?.name ?? ''}
                            className="w-9 h-9 rounded-lg border border-white/10"
                            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                        </motion.div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </motion.section>

            {/* Orden de skills */}
            <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }}
              className={`${SURFACE} p-5`} style={SURFACE_BG}>
              <h2 className="text-xs uppercase tracking-[2px] text-red-400 font-bold mb-4">Orden de habilidades</h2>
              {maxOrder.length > 0 && (
                <div className="flex items-center gap-2 mb-4">
                  {maxOrder.map((s, i) => (
                    <div key={s} className="flex items-center gap-2">
                      {i > 0 && <ChevronRight className="h-4 w-4 text-white/25" />}
                      <span className="w-9 h-9 rounded-lg flex items-center justify-center font-black text-sm"
                        style={{ background: `${SKILL_COLOR[s]}22`, color: SKILL_COLOR[s], border: `1px solid ${SKILL_COLOR[s]}55` }}>{s}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap gap-1">
                {(b.skill_order ?? []).slice(0, 15).map((s: string, i: number) => (
                  <motion.span key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 + i * 0.03 }}
                    className="w-7 h-7 rounded-md flex items-center justify-center text-[11px] font-bold"
                    style={{ background: `${SKILL_COLOR[s] ?? '#666'}1e`, color: SKILL_COLOR[s] ?? '#aaa' }}>
                    {s}<span className="text-[8px] text-white/30 ml-0.5">{i + 1}</span>
                  </motion.span>
                ))}
              </div>
            </motion.section>

            {/* Counters */}
            <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }}
              className={`${SURFACE} p-5`} style={SURFACE_BG}>
              <h2 className="text-xs uppercase tracking-[2px] text-red-400 font-bold mb-4 flex items-center gap-2">
                <Swords className="h-3.5 w-3.5" /> Cuidado con (counters)
              </h2>
              {countersQ.isLoading && <p className="text-gray-500 text-sm animate-pulse">Cargando…</p>}
              <div className="grid gap-2">
                {(countersQ.data ?? []).slice(0, 6).map((c: any, i: number) => {
                  const cName = c.name ?? c.champion ?? c.champion_name ?? '';
                  const cEntry = Object.values(champs?.byId ?? {}).find((x: any) => x.name.toLowerCase() === String(cName).replace(/_/g, ' ').toLowerCase());
                  const wr = c.winRate ?? c.win_rate ?? null;
                  return (
                    <motion.button key={`${cName}-${i}`} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 + i * 0.05 }}
                      onClick={() => cEntry && navigate(`/champion/${cEntry.id}?pos=${pos}`)}
                      className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/[0.05] transition text-left">
                      {cEntry && <img src={dd.champion(cEntry.id)} alt="" className="w-8 h-8 rounded-lg border border-white/10" />}
                      <span className="flex-1 text-sm font-semibold truncate">{cEntry?.name ?? cName}</span>
                      {wr != null && <span className="text-xs font-bold text-red-400">{Math.round((wr <= 1 ? wr * 100 : wr))}% vs ti</span>}
                    </motion.button>
                  );
                })}
                {!countersQ.isLoading && !(countersQ.data ?? []).length && <p className="text-white/30 text-sm">Sin datos de counters aquí.</p>}
              </div>
            </motion.section>
          </div>
        )}
        <p className="text-[11px] text-white/25 mt-6 text-center">Datos en vivo de OP.GG (ranked, parche actual)</p>
      </div>
    </div>
  );
}
