// src/components/SummonerPrompt.tsx — barra de búsqueda estilo "prompt" (AI SaaS)
// Una sola caja flotante: input arriba, chips de contexto abajo (región + modo)
// y un botón circular de envío. Es la pieza que comparten el hero de Home y
// /stats, para que buscar un invocador se sienta igual en toda la app.
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, ChevronDown, Clock, Radio, User, X } from 'lucide-react';
import { resolveRiotIdQueryOptions } from '@/hooks/queries/stats';
import { usePlayerSuggestions, type PlayerSuggestion } from '@/hooks/usePlayerSuggestions';
import { dd } from '@/lib/dataDragon';

export const REGIONS = [
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

// ── Recientes (compartido con /stats) ────────────────────────────────────────
const RECENT_KEY = 'atakgg_recent_searches';
const REGION_KEY = 'atakgg_last_region';

export type RecentSearch = { id: string; region: string };

export function getRecentSearches(): RecentSearch[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch { return []; }
}
export function saveRecentSearch(id: string, region: string) {
  const list = [{ id, region }, ...getRecentSearches().filter(r => r.id !== id)].slice(0, 6);
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(list)); } catch { /* storage lleno */ }
}
export function removeRecentSearch(id: string) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(getRecentSearches().filter(r => r.id !== id)));
  } catch { /* noop */ }
}

// El modo decide a dónde te lleva el envío: al perfil o directo a la partida
// en curso. Mismo gesto, dos destinos — como los chips del prompt de un SaaS IA.
const MODES = [
  { value: 'profile' as const, label: 'Perfil',  icon: User },
  { value: 'live'    as const, label: 'En vivo', icon: Radio },
];
type Mode = (typeof MODES)[number]['value'];

const PLACEHOLDERS = ['KisterKata#NA1', 'Faker#KR1', 'Caps#EUW', 'Hide on bush#KR1'];

export interface SummonerPromptProps {
  /** Riot IDs de ejemplo bajo la barra. `null` los oculta. */
  quickLookups?: string[] | null;
  /** Línea fina bajo la barra (el "Kraft can make mistakes" de la referencia). */
  caption?: string | null;
  autoFocus?: boolean;
  className?: string;
  /** Valor inicial del input (p. ej. al reintentar una búsqueda reciente). */
  defaultValue?: string;
  /** Desplegable con tus búsquedas anteriores al enfocar la barra. */
  showRecent?: boolean;
}

export function SummonerPrompt({
  quickLookups = ['Faker#KR1', 'Caps#EUW', 'Doublelift#NA1'],
  caption = 'Datos oficiales de la API de Riot · sin anuncios ni instalaciones.',
  autoFocus = false,
  className = '',
  defaultValue = '',
  showRecent = true,
}: SummonerPromptProps) {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [value, setValue]         = useState(defaultValue);
  const [mode, setMode]           = useState<Mode>('profile');
  const [region, setRegion]       = useState(() => {
    try { return localStorage.getItem(REGION_KEY) || 'la1'; } catch { return 'la1'; }
  });
  const [regionOpen, setRegionOpen] = useState(false);
  const [focused, setFocused]     = useState(false);
  const [busy, setBusy]           = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [phIndex, setPhIndex]     = useState(0);
  const [recent, setRecent]       = useState<RecentSearch[]>([]);
  const [recentOpen, setRecentOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);

  const inputRef = useRef<HTMLInputElement>(null);
  const dropRef  = useRef<HTMLDivElement>(null);
  const rootRef  = useRef<HTMLDivElement>(null);

  const selectedRegion = REGIONS.find(r => r.value === region) || REGIONS[0];

  // Lo que escribes filtra tus búsquedas anteriores.
  const visibleRecent = recent.filter(
    (r) => !value.trim() || r.id.toLowerCase().includes(value.trim().toLowerCase()),
  );

  // Jugadores reales del índice del backend (estilo League of Graphs), sin
  // duplicar los que ya están en recientes.
  const suggested = usePlayerSuggestions(value, showRecent && recentOpen);
  const visiblePlayers = suggested
    .filter((p) => !visibleRecent.some((r) => r.id.toLowerCase() === `${p.gameName}#${p.tagLine}`.toLowerCase()))
    .slice(0, 5);
  const optionCount = visibleRecent.length + visiblePlayers.length;

  // Cerrar región y recientes al clicar fuera.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (dropRef.current && !dropRef.current.contains(t)) setRegionOpen(false);
      if (rootRef.current && !rootRef.current.contains(t)) { setRecentOpen(false); setHighlight(-1); }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  useEffect(() => { if (showRecent) setRecent(getRecentSearches()); }, [showRecent]);

  // Placeholder rotativo: solo mientras la barra está vacía y sin foco, para
  // insinuar el formato Nombre#Tag sin escribir instrucciones.
  useEffect(() => {
    if (value || focused) return;
    const t = setInterval(() => setPhIndex(i => (i + 1) % PLACEHOLDERS.length), 3200);
    return () => clearInterval(t);
  }, [value, focused]);

  useEffect(() => { try { localStorage.setItem(REGION_KEY, region); } catch { /* noop */ } }, [region]);

  // `override` permite lanzar la búsqueda desde el desplegable de recientes sin
  // esperar al re-render de los setState.
  const submit = async (e?: React.FormEvent, override?: { value?: string; region?: string }) => {
    e?.preventDefault();
    const raw = (override?.value ?? value).trim();
    const reg = override?.region ?? region;
    if (!raw) { inputRef.current?.focus(); return; }
    const [gameName = '', tagLine = ''] = raw.split('#');
    if (!gameName || !tagLine) {
      setError('Escribe tu Riot ID completo: Nombre#Tag');
      return;
    }

    setBusy(true);
    setError(null);
    setRecentOpen(false);
    try {
      // Resolvemos por React Query: el perfil reutiliza esta misma entrada de
      // caché y entra instantáneo.
      const data = await qc.fetchQuery(resolveRiotIdQueryOptions(reg, gameName, tagLine));
      const encoded = encodeURIComponent(`${data.gameName || gameName}#${data.tagLine || tagLine}`);
      saveRecentSearch(raw, reg);
      navigate(`${mode === 'live' ? '/live' : '/stats'}/${reg}/${encoded}`, {
        state: { puuid: data.puuid },
      });
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Invocador no encontrado. Revisa el Riot ID y la región.');
      setBusy(false);
    }
  };

  const fill = (id: string) => {
    setValue(id);
    setError(null);
    inputRef.current?.focus();
  };

  // ── Recientes ───────────────────────────────────────────────────────────────
  const openRecent = () => {
    if (!showRecent) return;
    setRecent(getRecentSearches());
    setRecentOpen(true);
  };

  const pickRecent = (r: RecentSearch) => {
    setValue(r.id);
    setRegion(r.region);
    setHighlight(-1);
    void submit(undefined, { value: r.id, region: r.region });
  };

  // Sugerencia del índice: ya trae puuid y plataforma — navegación directa.
  const pickPlayer = (p: PlayerSuggestion) => {
    const id = `${p.gameName}#${p.tagLine}`;
    saveRecentSearch(id, p.platform);
    setRecentOpen(false);
    setHighlight(-1);
    navigate(`${mode === 'live' ? '/live' : '/stats'}/${p.platform}/${encodeURIComponent(id)}`, {
      state: { puuid: p.puuid },
    });
  };

  const dropRecent = (id: string) => {
    removeRecentSearch(id);
    const next = getRecentSearches();
    setRecent(next);
    setHighlight(-1);
    if (!next.length) setRecentOpen(false);
    inputRef.current?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') { setRecentOpen(false); setHighlight(-1); return; }
    if (!recentOpen || !optionCount) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => (h + 1) % optionCount);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => (h <= 0 ? optionCount - 1 : h - 1));
    } else if (e.key === 'Enter' && highlight >= 0) {
      e.preventDefault();
      if (highlight < visibleRecent.length) pickRecent(visibleRecent[highlight]);
      else pickPlayer(visiblePlayers[highlight - visibleRecent.length]);
    }
  };

  return (
    <div ref={rootRef} className={`relative w-full max-w-2xl mx-auto ${className}`}>
      <form
        onSubmit={submit}
        className="relative rounded-[28px] border transition-all duration-300"
        style={{
          background: 'rgba(255,255,255,0.035)',
          backdropFilter: 'blur(18px) saturate(140%)',
          WebkitBackdropFilter: 'blur(18px) saturate(140%)',
          // Foco: hairline dorado y un halo rojo muy suave — el mismo lenguaje
          // que el resto de la página. Nada de recuadro de outline del sistema.
          borderColor: focused ? 'rgba(200,170,110,0.42)' : 'rgba(255,255,255,0.09)',
          boxShadow: focused
            ? 'inset 0 1px 0 rgba(255,255,255,0.10), 0 24px 64px rgba(0,0,0,0.55), 0 0 60px rgba(239,68,68,0.10)'
            : 'inset 0 1px 0 rgba(255,255,255,0.08), 0 24px 64px rgba(0,0,0,0.45)',
        }}
      >
        <label htmlFor="atak-summoner-prompt" className="sr-only">Riot ID del invocador</label>
        <input
          id="atak-summoner-prompt"
          ref={inputRef}
          value={value}
          onChange={e => {
            setValue(e.target.value);
            if (error) setError(null);
            setHighlight(-1);
            if (showRecent && !recentOpen) openRecent();
          }}
          onFocus={() => { setFocused(true); openRecent(); }}
          onBlur={() => setFocused(false)}
          onKeyDown={onKeyDown}
          role="combobox"
          aria-expanded={recentOpen && visibleRecent.length > 0}
          aria-controls="atak-recent-list"
          aria-autocomplete="list"
          autoFocus={autoFocus}
          autoComplete="off"
          spellCheck={false}
          placeholder={`Busca un invocador… ${PLACEHOLDERS[phIndex]}`}
          // El outline global (:focus-visible) pintaba un rectángulo rojo de
          // esquinas rectas sobre la caja redondeada; el foco lo marca el borde.
          style={{ outline: 'none', boxShadow: 'none' }}
          className="w-full bg-transparent px-6 pt-6 pb-4 text-lg md:text-xl font-light tracking-tight
            text-white placeholder:text-white/25"
        />

        <div className="flex items-center gap-2 px-4 pb-4 flex-wrap">
          {/* Región */}
          <div ref={dropRef} className="relative">
            <button
              type="button"
              onClick={() => setRegionOpen(v => !v)}
              aria-expanded={regionOpen}
              className="flex items-center gap-2 h-9 px-3.5 rounded-full border border-white/[0.09]
                bg-white/[0.03] text-sm text-white/70 hover:text-white hover:border-white/20 transition-all"
            >
              <span className="text-base leading-none">{selectedRegion.flag}</span>
              <span className="font-medium">{selectedRegion.label}</span>
              <ChevronDown className={`h-3.5 w-3.5 text-white/40 transition-transform ${regionOpen ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence>
              {regionOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.97 }}
                  transition={{ duration: 0.15 }}
                  className="absolute bottom-full left-0 mb-2 w-56 max-h-72 overflow-y-auto z-50
                    rounded-2xl border border-white/10 bg-black/95 backdrop-blur-xl shadow-2xl py-1"
                >
                  {REGIONS.map(r => (
                    <button
                      key={r.value}
                      type="button"
                      onClick={() => { setRegion(r.value); setRegionOpen(false); }}
                      className={`flex items-center gap-3 w-full px-4 py-2.5 text-sm text-left transition-colors ${
                        r.value === region ? 'text-white bg-white/[0.07]' : 'text-white/60 hover:text-white hover:bg-white/[0.05]'
                      }`}
                    >
                      <span className="text-base leading-none">{r.flag}</span>
                      <span className="font-medium w-11">{r.label}</span>
                      <span className="text-xs text-white/35 truncate">{r.name}</span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Modo: perfil o partida en vivo */}
          {MODES.map(m => {
            const Icon = m.icon;
            const active = mode === m.value;
            return (
              <button
                key={m.value}
                type="button"
                onClick={() => setMode(m.value)}
                aria-pressed={active}
                className={`flex items-center gap-2 h-9 px-3.5 rounded-full border text-sm transition-all ${
                  active
                    ? 'border-red-500/40 bg-red-500/10 text-white'
                    : 'border-white/[0.09] bg-white/[0.03] text-white/55 hover:text-white hover:border-white/20'
                }`}
              >
                <Icon className={`h-3.5 w-3.5 ${active ? 'text-red-400' : 'text-white/40'}`} />
                {m.label}
              </button>
            );
          })}

          {/* Enviar */}
          <button
            type="submit"
            disabled={busy}
            aria-label="Analizar invocador"
            className="ml-auto flex items-center justify-center h-11 w-11 rounded-full bg-red-600
              hover:bg-red-500 disabled:opacity-60 text-white transition-all duration-200
              hover:scale-105 active:scale-95"
            style={{ boxShadow: '0 0 24px rgba(239,68,68,0.30)' }}
          >
            {busy
              ? <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
              : <ArrowRight className="h-4 w-4" />}
          </button>
        </div>
      </form>

      {/* Recientes + jugadores sugeridos */}
      <AnimatePresence>
        {showRecent && recentOpen && optionCount > 0 && (
          <motion.div
            id="atak-recent-list"
            role="listbox"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 right-0 top-full mt-2 z-40 overflow-hidden rounded-2xl
              border border-white/[0.08] bg-black/90 backdrop-blur-xl shadow-2xl"
          >
            {visibleRecent.length > 0 && (
              <>
                <div className="flex items-center gap-2 px-4 pt-3 pb-2 text-[10px] uppercase tracking-[0.24em] text-white/25">
                  <Clock className="h-3 w-3" />
                  Recientes
                </div>
                {visibleRecent.map((r, i) => (
                  <div
                    key={`${r.id}-${r.region}`}
                    role="option"
                    aria-selected={i === highlight}
                    onMouseEnter={() => setHighlight(i)}
                    className={`group flex items-center gap-3 px-4 py-2.5 transition-colors ${
                      i === highlight ? 'bg-white/[0.06]' : ''
                    }`}
                  >
                    <button
                      type="button"
                      // mousedown: el click llegaría después del blur del input.
                      onMouseDown={(e) => { e.preventDefault(); pickRecent(r); }}
                      className="flex flex-1 items-center gap-3 text-left min-w-0"
                    >
                      <span className="text-base leading-none">
                        {REGIONS.find(rg => rg.value === r.region)?.flag}
                      </span>
                      <span className="text-sm text-white/70 group-hover:text-white transition-colors truncate">
                        {r.id}
                      </span>
                      <span className="ml-auto text-[11px] text-white/25">
                        {REGIONS.find(rg => rg.value === r.region)?.label}
                      </span>
                    </button>
                    <button
                      type="button"
                      aria-label={`Quitar ${r.id} de recientes`}
                      onMouseDown={(e) => { e.preventDefault(); dropRecent(r.id); }}
                      className="text-white/20 hover:text-red-400 transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </>
            )}

            {visiblePlayers.length > 0 && (
              <>
                <div className="px-4 pt-3 pb-2 text-[10px] uppercase tracking-[0.24em] text-white/25">
                  Jugadores
                </div>
                {visiblePlayers.map((p, idx) => {
                  const i = visibleRecent.length + idx;
                  return (
                    <button
                      key={p.puuid}
                      type="button"
                      role="option"
                      aria-selected={i === highlight}
                      onMouseEnter={() => setHighlight(i)}
                      onMouseDown={(e) => { e.preventDefault(); pickPlayer(p); }}
                      className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                        i === highlight ? 'bg-white/[0.06]' : ''
                      }`}
                    >
                      {p.profileIconId ? (
                        <img
                          src={dd.profileIcon(p.profileIconId)}
                          alt=""
                          loading="lazy"
                          className="h-8 w-8 rounded-full object-cover flex-shrink-0 ring-1 ring-white/10"
                          onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }}
                        />
                      ) : (
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-red-700/50 to-red-900/50 text-xs font-bold text-red-200 flex-shrink-0">
                          {p.gameName[0]?.toUpperCase() || '?'}
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm text-white/80 truncate">
                          {p.gameName}<span className="text-white/35">#{p.tagLine}</span>
                        </span>
                        {p.level ? <span className="block text-[10px] text-white/30">Nivel {p.level}</span> : null}
                      </span>
                      <span className="text-[11px] text-white/25 uppercase flex-shrink-0">
                        {REGIONS.find(rg => rg.value === p.platform)?.label || p.platform}
                      </span>
                    </button>
                  );
                })}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-3 text-center text-sm text-red-400/90"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      {/* Ejemplos */}
      {quickLookups && quickLookups.length > 0 && (
        <div className="mt-4 flex items-center justify-center gap-x-4 gap-y-2 flex-wrap">
          {quickLookups.map(q => (
            <button
              key={q}
              type="button"
              onClick={() => fill(q)}
              className="text-xs text-white/35 hover:text-white/80 transition-colors"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {caption && (
        <p className="mt-3 text-center text-xs text-white/25 font-light">{caption}</p>
      )}
    </div>
  );
}

export default SummonerPrompt;
