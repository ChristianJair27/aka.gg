// Replays (.rofl) y highlights (clips MP4) de un torneo. Los replays los suben
// los companions de los jugadores; los clips los renderiza el worker de ATAK.
//
// Con todas las partidas del torneo los clips se cuentan por cientos: se
// seccionan con carpetas por categoría (peleas, multikills, primera sangre,
// aces, objetivos), se filtran por ronda y partida, y cada clip tiene su enlace
// para compartir (?tab=replays&clip=<gameId>-<key>).
import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Download, Film, Clapperboard, Share2, Link as LinkIcon } from 'lucide-react';
import axiosInstance from '@/lib/axios';
import { FightStats } from '@/components/FightStats';
import { Folder } from '@/components/ui/Folder';
import { dd } from '@/lib/dataDragon';
import { lol } from '@/lib/lolAssets';
import { toast } from '@/components/ui/sonner';

interface Replay { matchId: string; gameId: number; region: string; patch?: string | null; gameLengthMs?: number | null; size: number; createdAt: string; url: string }
interface Clip { matchId: string; gameId: number; region: string; key: string; tStart: number; tEnd: number; kind: string; title: string; players: Array<{ name: string; champion: string; team: string }>; size: number; createdAt: string; url: string }
interface BracketMatch { id: string; round: number; team1: string; team2: string; games?: Array<{ gameId: number; winner?: string | null }> }

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const mb = (n: number) => `${(n / 1048576).toFixed(1)} MB`;
const clipId = (c: Clip) => `${c.gameId}-${c.key}`;

// ── Categorías (carpetas) ─────────────────────────────────────────────────────
type Cat = 'all' | 'stream' | 'teamfight' | 'multikill' | 'first_blood' | 'ace' | 'objective';
// Los clips del stream llegan como kind "stream_<tipo>": entran en su categoría y además en "Del stream".
const base = (k: string) => k.replace(/^stream_/, '');
const CATS: Array<{ key: Cat; label: string; color: string; icon: string; match: (kind: string) => boolean }> = [
  { key: 'all', label: 'Todos', color: '#e8323c', icon: lol.ui('champion'), match: () => true },
  { key: 'stream', label: 'Del stream', color: '#9146ff', icon: lol.ui('spells'), match: (k) => k.startsWith('stream_') },
  { key: 'teamfight', label: 'Peleas', color: '#c8aa6e', icon: lol.stat('attack_damage'), match: (k) => base(k) === 'teamfight' },
  { key: 'multikill', label: 'Multikills', color: '#3b3b47', icon: lol.ui('score'), match: (k) => base(k).startsWith('multikill') },
  { key: 'first_blood', label: 'Primera sangre', color: '#8d1a22', icon: lol.stat('life_steal'), match: (k) => base(k) === 'first_blood' },
  { key: 'ace', label: 'Aces', color: '#f0d891', icon: lol.stat('critical_chance'), match: (k) => base(k) === 'ace' },
  { key: 'objective', label: 'Objetivos', color: '#49a3ff', icon: lol.ui('nashor'), match: (k) => ['baron_nashor', 'riftherald', 'dragon', 'horde', 'inhibitor'].includes(base(k)) },
];
const isCat = (v: string | null): v is Cat => !!v && CATS.some((c) => c.key === v);

function Champ({ name, size = 24 }: { name: string; size?: number }) {
  if (!name) return <span className="inline-block rounded-md bg-white/10" style={{ width: size, height: size }} />;
  return <img src={dd.champion(name)} alt={name} title={name} width={size} height={size} loading="lazy" className="rounded-md object-cover" style={{ width: size, height: size }} onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />;
}

export function TournamentReplays({ tournamentId, bracket: bracketProp }: { tournamentId: string; bracket?: BracketMatch[] }) {
  const [bracket, setBracket] = useState<BracketMatch[]>(bracketProp ?? []);
  useEffect(() => {
    if (bracketProp) { setBracket(bracketProp); return; }
    axiosInstance.get(`/api/tournaments/${tournamentId}`).then((r) => { const t = r.data?.tournament ?? r.data; setBracket(Array.isArray(t?.bracket) ? t.bracket : []); }).catch(() => {});
  }, [tournamentId, bracketProp]);
  const [replays, setReplays] = useState<Replay[]>([]);
  const [clips, setClips] = useState<Clip[]>([]);
  const [pending, setPending] = useState(0);
  const [loading, setLoading] = useState(true);
  const reduce = useReducedMotion();

  // Filtros (con deep link: ?cat=, ?game=, ?clip=)
  const initial = useMemo(() => new URLSearchParams(location.search), []);
  const [cat, setCat] = useState<Cat>(() => (isCat(initial.get('cat')) ? (initial.get('cat') as Cat) : 'all'));
  const [round, setRound] = useState<number | 'all'>('all');
  const [game, setGame] = useState<number | 'all'>(() => Number(initial.get('game')) || 'all');
  const [focus, setFocus] = useState<string | null>(() => initial.get('clip'));

  useEffect(() => {
    let alive = true;
    Promise.all([
      axiosInstance.get(`/api/replays/tournament/${tournamentId}`).then((r) => r.data).catch(() => null),
      axiosInstance.get(`/api/replays/tournament/${tournamentId}/clips`).then((r) => r.data).catch(() => null),
    ]).then(([r, c]) => {
      if (!alive) return;
      setReplays(r?.replays ?? []); setPending(r?.pending ?? 0); setClips(c?.clips ?? []); setLoading(false);
    });
    return () => { alive = false; };
  }, [tournamentId]);

  // Mantener la URL compartible sin recargar.
  useEffect(() => {
    const u = new URL(location.href);
    u.searchParams.set('tab', 'replays');
    if (cat === 'all') u.searchParams.delete('cat'); else u.searchParams.set('cat', cat);
    if (game === 'all') u.searchParams.delete('game'); else u.searchParams.set('game', String(game));
    if (!focus) u.searchParams.delete('clip');
    history.replaceState(history.state, '', u);
  }, [cat, game, focus]);

  const matchOf = useMemo(() => {
    const m = new Map<string, BracketMatch>();
    for (const b of bracket || []) m.set(b.id, b);
    return (id: string) => m.get(id);
  }, [bracket]);
  const label = (matchId: string, gameId: number, withRound = true) => {
    const m = matchOf(matchId);
    if (!m) return matchId;
    const idx = (m.games || []).findIndex((g) => Number(g.gameId) === gameId);
    return `${m.team1} vs ${m.team2}${idx >= 0 && (m.games?.length || 0) > 1 ? ` · Juego ${idx + 1}` : ''}${withRound ? ` · Ronda ${m.round}` : ''}`;
  };

  // Partidas con clips, agrupadas por ronda (para el filtro).
  const games = useMemo(() => {
    const seen = new Map<number, { gameId: number; matchId: string; round: number; count: number }>();
    for (const c of clips) {
      const g = seen.get(c.gameId) || { gameId: c.gameId, matchId: c.matchId, round: matchOf(c.matchId)?.round ?? 0, count: 0 };
      g.count++; seen.set(c.gameId, g);
    }
    return [...seen.values()].sort((a, b) => a.round - b.round || a.matchId.localeCompare(b.matchId) || a.gameId - b.gameId);
  }, [clips, matchOf]);
  const rounds = useMemo(() => [...new Set(games.map((g) => g.round))].sort((a, b) => a - b), [games]);
  const gamesInRound = round === 'all' ? games : games.filter((g) => g.round === round);

  const byCat = (c: Clip) => CATS.find((x) => x.key === cat)!.match(c.kind);
  const byGame = (c: Clip) => (game === 'all' ? (round === 'all' || matchOf(c.matchId)?.round === round) : c.gameId === game);
  const visible = clips.filter((c) => byCat(c) && byGame(c));
  const countFor = (k: Cat) => clips.filter((c) => CATS.find((x) => x.key === k)!.match(c.kind) && byGame(c)).length;

  // Deep link a un clip: mostrarlo aunque los filtros lo escondan y hacer scroll.
  useEffect(() => {
    if (!focus || loading) return;
    const c = clips.find((x) => clipId(x) === focus);
    if (!c) { setFocus(null); return; }
    if (!byCat(c) || !byGame(c)) { setCat('all'); setGame('all'); setRound('all'); }
    const t = window.setTimeout(() => document.getElementById(`clip-${focus}`)?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' }), 120);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus, loading, clips]);

  const share = async (c: Clip) => {
    const u = new URL(location.href);
    u.search = ''; u.searchParams.set('tab', 'replays'); u.searchParams.set('clip', clipId(c));
    const url = u.toString();
    const text = `${c.title} · ${label(c.matchId, c.gameId)}`;
    try { if (navigator.share) { await navigator.share({ title: text, text, url }); return; } } catch { /* cancelado */ }
    try { await navigator.clipboard.writeText(url); toast('Enlace del clip copiado'); } catch { toast(url); }
  };

  if (loading) return <div className="py-10 text-center text-sm text-gray-500">Cargando replays…</div>;

  return (
    <div className="space-y-8">
      {/* Highlights */}
      <section>
        <div className="flex items-end justify-between mb-3">
          <h3 className="flex items-center gap-2 text-lg font-bold uppercase tracking-wide"><Clapperboard className="h-5 w-5 text-red-500" /> Highlights</h3>
          <span className="text-xs text-gray-500 tabular-nums">{visible.length === clips.length ? `${clips.length} clips` : `${visible.length} de ${clips.length} clips`}</span>
        </div>
        {clips.length === 0 ? (
          <p className="text-sm text-gray-500 bg-white/[0.03] border border-white/[0.08] rounded-xl p-4">
            Todavía no hay clips. Se generan automáticamente a partir de los replays: primera sangre, multikills, aces, barón, heraldo y peleas de equipo.
          </p>
        ) : (
          <>
            {/* Carpetas por categoría */}
            <div className="flex flex-wrap items-end justify-center gap-x-6 gap-y-4 sm:gap-x-10 rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 pb-3 overflow-hidden" role="tablist" aria-label="Categorías de clips">
              {CATS.map((k) => {
                const n = countFor(k.key);
                const sample = clips.filter((c) => k.match(c.kind) && byGame(c)).slice(0, 3);
                return (
                  <Folder
                    key={k.key} color={k.color} size={0.8} open={cat === k.key}
                    label={`${k.label} · ${n}`}
                    onToggle={() => { setCat(k.key); setFocus(null); }}
                    badge={<img src={k.icon} alt="" aria-hidden width={22} height={22} className="h-[22px] w-[22px] object-contain drop-shadow" />}
                    items={sample.map((c) => <Champ key={clipId(c)} name={c.players?.[0]?.champion || ''} size={28} />)}
                    className={n === 0 && cat !== k.key ? 'opacity-40' : ''}
                  />
                );
              })}
            </div>

            {/* Filtro por ronda y partida */}
            {games.length > 1 && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <div className="flex flex-wrap gap-1" role="group" aria-label="Ronda">
                  <RoundChip active={round === 'all'} onClick={() => { setRound('all'); setGame('all'); }}>Todas las rondas</RoundChip>
                  {rounds.map((r) => <RoundChip key={r} active={round === r} onClick={() => { setRound(r); setGame('all'); }}>R{r}</RoundChip>)}
                </div>
                <select
                  value={game === 'all' ? 'all' : String(game)} aria-label="Partida"
                  onChange={(e) => { const v = e.target.value; setGame(v === 'all' ? 'all' : Number(v)); setFocus(null); }}
                  className="h-8 max-w-full rounded-md border border-white/[0.1] bg-[#121216] px-2 text-xs font-semibold text-gray-200 focus:outline-none focus:border-red-500/60"
                >
                  <option value="all">{round === 'all' ? 'Todas las partidas' : `Todas las partidas de la ronda ${round}`}</option>
                  {gamesInRound.map((g) => <option key={g.gameId} value={g.gameId}>{label(g.matchId, g.gameId, round === 'all')} · {g.count} clips</option>)}
                </select>
              </div>
            )}

            {visible.length === 0 ? (
              <p className="mt-4 text-sm text-gray-500 bg-white/[0.03] border border-white/[0.08] rounded-xl p-4">No hay clips de esta categoría con los filtros actuales.</p>
            ) : (
              <motion.div layout className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <AnimatePresence initial={false}>
                  {visible.map((c) => {
                    const id = clipId(c);
                    return (
                      <motion.figure
                        key={id} id={`clip-${id}`} layout
                        initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={reduce ? undefined : { opacity: 0, scale: 0.98 }}
                        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                        className={`rounded-xl overflow-hidden border bg-white/[0.03] ${focus === id ? 'border-red-500/70 shadow-[0_0_0_3px_rgba(232,50,60,0.18)]' : 'border-white/[0.08]'}`}
                      >
                        <video src={c.url} controls preload="metadata" playsInline className="w-full aspect-video bg-black" />
                        <figcaption className="p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="font-bold text-sm text-white leading-tight">{c.title}</div>
                              <div className="mt-1 text-[11px] uppercase tracking-[0.14em] text-gray-500">{label(c.matchId, c.gameId)} · {mmss(c.tStart)}–{mmss(c.tEnd)}</div>
                            </div>
                            <div className="flex shrink-0 items-center gap-1">
                              <button type="button" onClick={() => share(c)} title="Compartir enlace del clip" className="grid h-8 w-8 place-items-center rounded-md border border-white/[0.1] text-gray-300 hover:border-white/30 hover:text-white"><Share2 className="h-3.5 w-3.5" /></button>
                              <a href={c.url} download title="Descargar MP4" className="grid h-8 w-8 place-items-center rounded-md border border-white/[0.1] text-gray-300 hover:border-white/30 hover:text-white"><LinkIcon className="h-3.5 w-3.5" /></a>
                            </div>
                          </div>
                        </figcaption>
                        <FightStats region={c.region} gameId={c.gameId} start={c.tStart} end={c.tEnd} defaultOpen={false} dense />
                      </motion.figure>
                    );
                  })}
                </AnimatePresence>
              </motion.div>
            )}
          </>
        )}
      </section>

      {/* Replays */}
      <section>
        <div className="flex items-end justify-between mb-3">
          <h3 className="flex items-center gap-2 text-lg font-bold uppercase tracking-wide"><Film className="h-5 w-5 text-red-500" /> Replays</h3>
          <span className="text-xs text-gray-500">{replays.length} disponibles{pending ? ` · ${pending} por subir` : ''}</span>
        </div>
        {replays.length === 0 ? (
          <p className="text-sm text-gray-500 bg-white/[0.03] border border-white/[0.08] rounded-xl p-4">
            Aún no hay replays. Los sube automáticamente el ATAK Companion de cualquier jugador o caster del torneo.
          </p>
        ) : (
          <div className="rounded-xl border border-white/[0.08] divide-y divide-white/[0.06] bg-white/[0.02]">
            {replays.map((r) => (
              <div key={`${r.region}-${r.gameId}`} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-white truncate">{label(r.matchId, r.gameId)}</div>
                  <div className="text-[11px] uppercase tracking-[0.12em] text-gray-500">{r.gameLengthMs ? `${mmss(r.gameLengthMs / 1000)} · ` : ''}{r.patch ? `parche ${r.patch.split('.').slice(0, 2).join('.')} · ` : ''}{mb(r.size)}</div>
                </div>
                <a href={r.url} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-bold bg-white/[0.04] text-gray-200 border border-white/[0.1] hover:text-white hover:border-white/30" title="Archivo .rofl: ábrelo con el cliente de League (mismo parche)">
                  <Download className="h-3.5 w-3.5" /> .rofl
                </a>
              </div>
            ))}
          </div>
        )}
        <p className="mt-2 text-[11px] text-gray-600">Para ver un replay: descárgalo y ábrelo con el cliente de League of Legends. Solo funciona con el mismo parche en que se jugó.</p>
      </section>
    </div>
  );
}

function RoundChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active}
      className={`h-8 rounded-md border px-2.5 text-[11px] font-bold uppercase tracking-[0.12em] transition-colors ${active ? 'border-red-500/60 bg-red-500/10 text-white' : 'border-white/[0.1] text-gray-400 hover:border-white/30 hover:text-white'}`}>
      {children}
    </button>
  );
}
