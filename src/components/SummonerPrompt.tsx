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
import { useChampionMatches, type ChampionMatch } from '@/hooks/useChampionSearch';
import { dd } from '@/lib/dataDragon';

// La lista vive en `src/lib/regions.ts` (fuente única, también la usa el
// dashboard). Se reexporta para no tocar quien ya importa REGIONS desde aquí.
export { REGIONS } from '@/lib/regions';
import { REGIONS } from '@/lib/regions';
import '@/styles/summoner-prompt.css';

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
  // Campeones que matchean el texto (local, DDragon) — también se buscan aquí.
  const champMatches = useChampionMatches(value, 3);
  const optionCount = champMatches.length + visibleRecent.length + visiblePlayers.length;

  const pickChamp = (c: ChampionMatch) => {
    setRecentOpen(false);
    setHighlight(-1);
    navigate(`/champion/${c.id}`);
  };

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
      if (highlight < champMatches.length) pickChamp(champMatches[highlight]);
      else if (highlight < champMatches.length + visibleRecent.length) pickRecent(visibleRecent[highlight - champMatches.length]);
      else pickPlayer(visiblePlayers[highlight - champMatches.length - visibleRecent.length]);
    }
  };

  return (
    <div ref={rootRef} className={`sp-root ${className}`}>
      {/* El foco lo marca el borde de la caja (.sp-box[data-focused]). */}
      <form onSubmit={submit} className="sp-box" data-focused={focused}>
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
          className="sp-input"
        />

        <div className="sp-bar">
          {/* Región */}
          <div ref={dropRef} className="relative">
            <button
              type="button"
              onClick={() => setRegionOpen(v => !v)}
              aria-expanded={regionOpen}
              aria-label={`Región: ${selectedRegion.name}`}
              className="sp-chip"
            >
              <span className="text-base leading-none" aria-hidden>{selectedRegion.flag}</span>
              <span>{selectedRegion.label}</span>
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${regionOpen ? 'rotate-180' : ''}`} aria-hidden />
            </button>
            <AnimatePresence>
              {regionOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.97 }}
                  transition={{ duration: 0.15 }}
                  className="sp-drop sp-drop--regions"
                >
                  {REGIONS.map(r => (
                    <button
                      key={r.value}
                      type="button"
                      onClick={() => { setRegion(r.value); setRegionOpen(false); }}
                      className="sp-opt" aria-selected={r.value === region}
                    >
                      <span className="text-base leading-none" aria-hidden>{r.flag}</span>
                      <span className="sp-opt-main" style={{ width: 44, flex: 'none' }}>{r.label}</span>
                      <span className="sp-opt-sub truncate">{r.name}</span>
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
                className="sp-chip" data-active={active}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden />
                {m.label}
              </button>
            );
          })}

          {/* Enviar */}
          <button
            type="submit"
            disabled={busy}
            aria-label="Analizar invocador"
            className="sp-go"
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
            className="sp-drop sp-drop--list"
          >
            {champMatches.length > 0 && (
              <>
                <div className="sp-group td-over">Campeones</div>
                {champMatches.map((c, i) => (
                  <button
                    key={`ch-${c.id}`}
                    type="button"
                    role="option"
                    aria-selected={i === highlight}
                    onMouseEnter={() => setHighlight(i)}
                    onMouseDown={(e) => { e.preventDefault(); pickChamp(c); }}
                    className="sp-opt"
                  >
                    <img
                      src={c.image} alt="" loading="lazy"
                      className="sp-opt-img"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }}
                    />
                    <span className="sp-opt-main">{c.name}</span>
                    <span className="sp-opt-tag">Análisis del campeón</span>
                  </button>
                ))}
              </>
            )}

            {visibleRecent.length > 0 && (
              <>
                <div className="sp-group td-over"><Clock className="h-3 w-3" aria-hidden />Recientes</div>
                {visibleRecent.map((r, ri) => { const i = champMatches.length + ri; return (
                  <div
                    key={`${r.id}-${r.region}`}
                    role="option"
                    aria-selected={i === highlight}
                    onMouseEnter={() => setHighlight(i)}
                    className="sp-opt sp-opt--row"
                  >
                    <button
                      type="button"
                      // mousedown: el click llegaría después del blur del input.
                      onMouseDown={(e) => { e.preventDefault(); pickRecent(r); }}
                      className="sp-opt-btn"
                    >
                      <span className="text-base leading-none" aria-hidden>
                        {REGIONS.find(rg => rg.value === r.region)?.flag}
                      </span>
                      <span className="sp-opt-main truncate">{r.id}</span>
                      <span className="sp-opt-sub" style={{ marginLeft: 'auto' }}>
                        {REGIONS.find(rg => rg.value === r.region)?.label}
                      </span>
                    </button>
                    <button
                      type="button"
                      aria-label={`Quitar ${r.id} de recientes`}
                      onMouseDown={(e) => { e.preventDefault(); dropRecent(r.id); }}
                      className="sp-opt-x"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </div>
                );})}
              </>
            )}

            {visiblePlayers.length > 0 && (
              <>
                <div className="sp-group td-over">Jugadores</div>
                {visiblePlayers.map((p, idx) => {
                  const i = champMatches.length + visibleRecent.length + idx;
                  return (
                    <button
                      key={p.puuid}
                      type="button"
                      role="option"
                      aria-selected={i === highlight}
                      onMouseEnter={() => setHighlight(i)}
                      onMouseDown={(e) => { e.preventDefault(); pickPlayer(p); }}
                      className="sp-opt"
                    >
                      {p.profileIconId ? (
                        <img
                          src={dd.profileIcon(p.profileIconId)}
                          alt=""
                          loading="lazy"
                          className="sp-opt-img"
                          onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }}
                        />
                      ) : (
                        <span className="sp-opt-img sp-opt-img--mono">
                          {p.gameName[0]?.toUpperCase() || '?'}
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="sp-opt-main block truncate">
                          {p.gameName}<span className="sp-opt-sub">#{p.tagLine}</span>
                        </span>
                        {p.level ? <span className="sp-opt-sub block">Nivel {p.level}</span> : null}
                      </span>
                      <span className="sp-opt-sub" style={{ textTransform: 'uppercase', flexShrink: 0 }}>
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
            role="alert"
            className="sp-error td-error"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      {/* Ejemplos */}
      {quickLookups && quickLookups.length > 0 && (
        <div className="sp-quick">
          <span className="td-over">Prueba con</span>
          {quickLookups.map(q => (
            <button
              key={q}
              type="button"
              onClick={() => fill(q)}
              className="sp-quick-btn"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {caption && (
        <p className="sp-caption td-help">{caption}</p>
      )}
    </div>
  );
}

export default SummonerPrompt;
