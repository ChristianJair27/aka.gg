// Replays (.rofl) y highlights (clips MP4) de un torneo. Los replays los suben
// los companions de los jugadores; los clips los renderiza el worker de ATAK.
//
// Rendimiento: un torneo tiene cientos de clips. Antes cada tarjeta montaba un
// <video preload="metadata"> (cientos de peticiones Range contra la base) y un
// panel de stats de pelea que pedía su timeline al cargar. Ahora:
//  - las listas van por React Query (caché entre pestañas, sin refetch al volver);
//  - cada tarjeta es el póster (img lazy) y el <video> se monta al pulsar play;
//  - las stats de la pelea se piden solo al desplegarlas;
//  - la rejilla se pagina por lotes al hacer scroll (sin animaciones de layout);
//  - los filtros y sus contadores se calculan en una sola pasada memoizada.
import { TdSelect } from '@/components/ui/td-select';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Download, Film, Clapperboard, Play } from 'lucide-react';
import { ShareMenu } from '@/components/ShareMenu';
import { Skeleton } from '@/components/ui/skeleton';
import { FightStats } from '@/components/FightStats';
import { lol } from '@/lib/lolAssets';
import { useTournamentClips, useTournamentReplays, type TournamentClip as Clip } from '@/hooks/queries/tournaments';

interface BracketLite { id: string; round: number; team1: string | null; team2: string | null; games?: Array<{ gameId: number; winner?: string | null }> }

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const mb = (n: number) => `${(n / 1048576).toFixed(1)} MB`;
const clipId = (c: Clip) => `${c.gameId}-${c.key}`;
const PAGE = 18;

// ── Categorías ───────────────────────────────────────────────────────────────
type Cat = 'all' | 'teamfight' | 'multikill' | 'first_blood' | 'ace' | 'objective';
type Fmt = 'h' | 'v';
type Src = 'all' | 'replay' | 'stream';
// kind = [vertical_][stream_]<tipo>. El formato (horizontal/vertical) y la fuente (replay/stream) son filtros aparte.
const base = (k: string) => k.replace(/^vertical_/, '').replace(/^stream_/, '');
const isVertical = (k: string) => k.startsWith('vertical_');
const isStream = (k: string) => k.replace(/^vertical_/, '').startsWith('stream_');
const CATS: Array<{ key: Cat; label: string; icon: string; match: (kind: string) => boolean }> = [
  { key: 'all', label: 'Todos', icon: lol.ui('champion'), match: () => true },
  { key: 'teamfight', label: 'Peleas', icon: lol.stat('attack_damage'), match: (k) => base(k) === 'teamfight' },
  { key: 'multikill', label: 'Multikills', icon: lol.ui('score'), match: (k) => base(k).startsWith('multikill') },
  { key: 'first_blood', label: 'Primera sangre', icon: lol.stat('life_steal'), match: (k) => base(k) === 'first_blood' },
  { key: 'ace', label: 'Aces', icon: lol.stat('critical_chance'), match: (k) => base(k) === 'ace' },
  { key: 'objective', label: 'Objetivos', icon: lol.ui('nashor'), match: (k) => ['baron_nashor', 'riftherald', 'dragon', 'horde', 'inhibitor'].includes(base(k)) },
];
const isCat = (v: string | null): v is Cat => !!v && CATS.some((c) => c.key === v);

export function TournamentReplays({ tournamentId, bracket = [] }: { tournamentId: string; bracket?: BracketLite[] }) {
  const replaysQ = useTournamentReplays(tournamentId);
  const clipsQ = useTournamentClips(tournamentId);
  const clips = clipsQ.data?.clips ?? [];
  const replays = replaysQ.data?.replays ?? [];
  const pending = replaysQ.data?.pending ?? 0;
  const loading = !clipsQ.data && !clipsQ.isError;

  // Filtros (con deep link: ?cat=, ?formato=, ?fuente=, ?game=, ?clip=)
  const initial = useMemo(() => new URLSearchParams(window.location.search), []);
  const [cat, setCat] = useState<Cat>(() => (isCat(initial.get('cat')) ? (initial.get('cat') as Cat) : 'all'));
  const [fmt, setFmt] = useState<Fmt>(() => (initial.get('formato') === 'v' ? 'v' : 'h'));
  const [src, setSrc] = useState<Src>(() => (initial.get('fuente') === 'stream' || initial.get('fuente') === 'replay' ? (initial.get('fuente') as Src) : 'all'));
  const [round, setRound] = useState<number | 'all'>('all');
  const [game, setGame] = useState<number | 'all'>(() => Number(initial.get('game')) || 'all');
  const [focus, setFocus] = useState<string | null>(() => initial.get('clip'));

  // URL compartible sin crear entradas de historial (los filtros no son "páginas").
  useEffect(() => {
    const u = new URL(window.location.href);
    if (u.searchParams.get('tab') !== 'replays') return;
    if (cat === 'all') u.searchParams.delete('cat'); else u.searchParams.set('cat', cat);
    if (fmt === 'h') u.searchParams.delete('formato'); else u.searchParams.set('formato', fmt);
    if (src === 'all') u.searchParams.delete('fuente'); else u.searchParams.set('fuente', src);
    if (game === 'all') u.searchParams.delete('game'); else u.searchParams.set('game', String(game));
    if (!focus) u.searchParams.delete('clip');
    if (u.href !== window.location.href) window.history.replaceState(window.history.state, '', u);
  }, [cat, fmt, src, game, focus]);

  const matchOf = useMemo(() => {
    const m = new Map<string, BracketLite>();
    for (const b of bracket || []) m.set(b.id, b);
    return (id: string) => m.get(id);
  }, [bracket]);
  const label = (matchId: string, gameId: number, withRound = true) => {
    const m = matchOf(matchId);
    if (!m) return matchId;
    const idx = (m.games || []).findIndex((g) => Number(g.gameId) === gameId);
    return `${m.team1 ?? '?'} vs ${m.team2 ?? '?'}${idx >= 0 && (m.games?.length || 0) > 1 ? ` · Juego ${idx + 1}` : ''}${withRound ? ` · Ronda ${m.round}` : ''}`;
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

  // Una sola pasada: lista visible + contadores de cada chip (cada contador
  // ignora su propio filtro para decir "qué habría si lo cambio").
  const { visible, counts } = useMemo(() => {
    const catMatch = CATS.find((x) => x.key === cat)!.match;
    const counts = { cat: Object.fromEntries(CATS.map((c) => [c.key, 0])) as Record<Cat, number>, fmt: { h: 0, v: 0 }, src: { all: 0, replay: 0, stream: 0 } };
    const visible: Clip[] = [];
    for (const c of clips) {
      const inGame = game === 'all' ? (round === 'all' || matchOf(c.matchId)?.round === round) : c.gameId === game;
      if (!inGame) continue;
      const f: Fmt = isVertical(c.kind) ? 'v' : 'h';
      const s: Src = isStream(c.kind) ? 'stream' : 'replay';
      const srcOk = src === 'all' || src === s;
      if (srcOk) counts.fmt[f]++;
      if (f !== fmt) continue;
      counts.src.all++; counts.src[s]++;
      if (!srcOk) continue;
      for (const k of CATS) if (k.match(c.kind)) counts.cat[k.key]++;
      if (catMatch(c.kind)) visible.push(c);
    }
    return { visible, counts };
  }, [clips, cat, fmt, src, round, game, matchOf]);

  // Paginación por scroll: lotes de PAGE; se reinicia al cambiar un filtro.
  const [limit, setLimit] = useState(PAGE);
  useEffect(() => { setLimit(PAGE); }, [cat, fmt, src, round, game]);
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || limit >= visible.length) return;
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) setLimit((l) => l + PAGE); }, { rootMargin: '600px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [limit, visible.length]);

  // Deep link a un clip: mostrarlo aunque los filtros lo escondan y hacer scroll.
  useEffect(() => {
    if (!focus || loading) return;
    const c = clips.find((x) => clipId(x) === focus);
    if (!c) { setFocus(null); return; }
    const idx = visible.findIndex((x) => clipId(x) === focus);
    if (idx < 0) { setCat('all'); setGame('all'); setRound('all'); setSrc('all'); setFmt(isVertical(c.kind) ? 'v' : 'h'); return; }
    if (idx >= limit) { setLimit(idx + PAGE); return; }
    const t = window.setTimeout(() => document.getElementById(`clip-${focus}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 120);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus, loading, clips, visible, limit]);

  if (loading) return <ReplaysSkeleton />;
  const shown = visible.slice(0, limit);

  return (
    <div className="space-y-8">
      {/* Highlights */}
      <section>
        <div className="mb-3 flex items-end justify-between">
          <h3 className="flex items-center gap-2 text-lg font-bold uppercase tracking-wide"><Clapperboard className="h-5 w-5 text-red-500" /> Highlights</h3>
          <span className="text-xs tabular-nums text-gray-500">{visible.length === clips.length ? `${clips.length} clips` : `${visible.length} de ${clips.length} clips`}</span>
        </div>
        {clips.length === 0 ? (
          <p className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 text-sm text-gray-500">
            Todavía no hay clips. Se generan automáticamente a partir de los replays: primera sangre, multikills, aces, barón, heraldo y peleas de equipo.
          </p>
        ) : (
          <>
            {/* Filtros: formato · fuente · categoría */}
            <div className="space-y-3 rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Seg label="Formato">
                  <SegBtn active={fmt === 'h'} onClick={() => { setFmt('h'); setFocus(null); }}>Horizontal <Count n={counts.fmt.h} /></SegBtn>
                  <SegBtn active={fmt === 'v'} onClick={() => { setFmt('v'); setFocus(null); }}>Vertical <Count n={counts.fmt.v} /></SegBtn>
                </Seg>
                <Seg label="Fuente">
                  <SegBtn active={src === 'all'} onClick={() => setSrc('all')}>Todo <Count n={counts.src.all} /></SegBtn>
                  <SegBtn active={src === 'replay'} onClick={() => setSrc('replay')}>Replay <Count n={counts.src.replay} /></SegBtn>
                  <SegBtn active={src === 'stream'} onClick={() => setSrc('stream')}>Stream <Count n={counts.src.stream} /></SegBtn>
                </Seg>
              </div>
              <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Categoría">
                {CATS.map((k) => {
                  const n = counts.cat[k.key];
                  return (
                    <button key={k.key} type="button" role="tab" aria-selected={cat === k.key} onClick={() => { setCat(k.key); setFocus(null); }}
                      className={`inline-flex h-9 items-center gap-2 rounded-md border px-3 text-[12px] font-bold uppercase tracking-[0.1em] transition-colors ${cat === k.key ? 'border-red-500/60 bg-red-500/10 text-white' : n === 0 ? 'border-white/[0.06] text-gray-600' : 'border-white/[0.1] text-gray-300 hover:border-white/30 hover:text-white'}`}>
                      <img src={k.icon} alt="" aria-hidden className="h-4 w-4 object-contain" />{k.label}<Count n={n} />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Filtro por ronda y partida */}
            {games.length > 1 && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <div className="flex flex-wrap gap-1" role="group" aria-label="Ronda">
                  <RoundChip active={round === 'all'} onClick={() => { setRound('all'); setGame('all'); }}>Todas las rondas</RoundChip>
                  {rounds.map((r) => <RoundChip key={r} active={round === r} onClick={() => { setRound(r); setGame('all'); }}>R{r}</RoundChip>)}
                </div>
                <div className="td-root" style={{ display: 'contents' }}>
                  <TdSelect
                    size="sm" ariaLabel="Partida"
                    value={game === 'all' ? 'all' : String(game)}
                    onValueChange={(v) => { setGame(v === 'all' ? 'all' : Number(v)); setFocus(null); }}
                    style={{ width: 'auto', maxWidth: '100%', minWidth: 220 }}
                    options={[{ value: 'all', label: round === 'all' ? 'Todas las partidas' : `Todas las partidas de la ronda ${round}` }, ...gamesInRound.map((g) => ({ value: String(g.gameId), label: label(g.matchId, g.gameId, round === 'all'), hint: `${g.count} clips` }))]}
                  />
                </div>
              </div>
            )}

            {visible.length === 0 ? (
              <p className="mt-4 rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 text-sm text-gray-500">No hay clips de esta categoría con los filtros actuales.</p>
            ) : (
              <>
                <div className={`mt-4 grid gap-4 ${fmt === 'v' ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5' : 'sm:grid-cols-2 lg:grid-cols-3'}`}>
                  {shown.map((c) => <ClipCard key={clipId(c)} clip={c} caption={label(c.matchId, c.gameId)} focused={focus === clipId(c)} />)}
                </div>
                {limit < visible.length && (
                  <div ref={sentinel} className="mt-6 flex justify-center">
                    <button type="button" onClick={() => setLimit((l) => l + PAGE)} className="h-9 rounded-md border border-white/[0.1] px-4 text-[12px] font-bold uppercase tracking-[0.12em] text-gray-300 hover:border-white/30 hover:text-white">
                      Cargar más · {visible.length - limit} restantes
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </section>

      {/* Replays */}
      <section>
        <div className="mb-3 flex items-end justify-between">
          <h3 className="flex items-center gap-2 text-lg font-bold uppercase tracking-wide"><Film className="h-5 w-5 text-red-500" /> Replays</h3>
          <span className="text-xs text-gray-500">{replays.length} disponibles{pending ? ` · ${pending} por subir` : ''}</span>
        </div>
        {replays.length === 0 ? (
          <p className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 text-sm text-gray-500">
            Aún no hay replays. Los sube automáticamente el ATAK Companion de cualquier jugador o caster del torneo.
          </p>
        ) : (
          <div className="divide-y divide-white/[0.06] rounded-xl border border-white/[0.08] bg-white/[0.02]">
            {replays.map((r) => (
              <div key={`${r.region}-${r.gameId}`} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-white">{label(r.matchId, r.gameId)}</div>
                  <div className="text-[11px] uppercase tracking-[0.12em] text-gray-500">{r.gameLengthMs ? `${mmss(r.gameLengthMs / 1000)} · ` : ''}{r.patch ? `parche ${r.patch.split('.').slice(0, 2).join('.')} · ` : ''}{mb(r.size)}</div>
                </div>
                <a href={r.url} className="inline-flex h-8 items-center gap-1.5 rounded-full border border-white/[0.1] bg-white/[0.04] px-3 text-xs font-bold text-gray-200 hover:border-white/30 hover:text-white" title="Archivo .rofl: ábrelo con el cliente de League (mismo parche)">
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

// ── Tarjeta de clip: póster hasta que se pulsa play ──────────────────────────
const ClipCard = memo(function ClipCard({ clip: c, caption, focused }: { clip: Clip; caption: string; focused: boolean }) {
  const [playing, setPlaying] = useState(false);
  const vertical = isVertical(c.kind);
  const id = clipId(c);
  return (
    <figure id={`clip-${id}`} className={`overflow-hidden rounded-xl border bg-white/[0.03] ${focused ? 'border-red-500/70 shadow-[0_0_0_3px_rgba(232,50,60,0.18)]' : 'border-white/[0.08]'}`}>
      <div className={`relative w-full bg-black ${vertical ? 'aspect-[9/16]' : 'aspect-video'}`}>
        {playing ? (
          <video src={c.url} poster={c.poster || undefined} controls autoPlay playsInline preload="auto" className="absolute inset-0 h-full w-full bg-black" />
        ) : (
          <button type="button" onClick={() => setPlaying(true)} aria-label={`Reproducir: ${c.title}`} className="group absolute inset-0 block h-full w-full text-left">
            {c.poster ? (
              <img src={c.poster} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
            ) : (
              <div className="grid h-full w-full place-items-center bg-[radial-gradient(ellipse_at_center,rgba(232,50,60,0.18),rgba(10,10,12,0.95)_70%)]"><Film className="h-8 w-8 text-white/30" /></div>
            )}
            <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/0 to-black/20" />
            <span aria-hidden className="absolute left-1/2 top-1/2 grid h-12 w-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-white/20 bg-black/55 text-white backdrop-blur transition-transform duration-200 group-hover:scale-110 group-active:scale-95">
              <Play className="ml-0.5 h-5 w-5" fill="currentColor" />
            </span>
            <span className="absolute right-2 top-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-white backdrop-blur">{mmss(Math.max(0, c.tEnd - c.tStart))}</span>
          </button>
        )}
      </div>
      <figcaption className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-sm font-bold leading-tight text-white">{c.title}</div>
            <div className="mt-1 text-[11px] uppercase tracking-[0.14em] text-gray-500">{caption} · {mmss(c.tStart)}–{mmss(c.tEnd)}</div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <ShareMenu compact url={c.share || c.url} mp4={c.url} title={c.title} text={`${c.title} · ${caption}`} />
            <a href={c.url} download title="Descargar MP4" className="grid h-8 w-8 place-items-center rounded-md border border-white/[0.1] text-gray-300 hover:border-white/30 hover:text-white"><Download className="h-3.5 w-3.5" /></a>
          </div>
        </div>
      </figcaption>
      {!vertical && <FightStats region={c.region} gameId={c.gameId} start={c.tStart} end={c.tEnd} defaultOpen={false} dense lazy />}
    </figure>
  );
});

function ReplaysSkeleton() {
  return (
    <div className="space-y-8">
      <section>
        <div className="mb-3 flex items-end justify-between"><Skeleton className="h-6 w-40" /><Skeleton className="h-4 w-16" /></div>
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3"><div className="flex flex-wrap gap-2">{[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-9 w-28" />)}</div></div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.03]"><Skeleton className="aspect-video w-full rounded-none" /><div className="space-y-2 p-3"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-3 w-1/2" /></div></div>)}
        </div>
      </section>
    </div>
  );
}

function Count({ n }: { n: number }) {
  return <span className="rounded bg-white/[0.08] px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-gray-300">{n}</span>;
}
function Seg({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-2">
      <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-gray-500">{label}</span>
      <div className="inline-flex overflow-hidden rounded-md border border-white/[0.1]">{children}</div>
    </div>
  );
}
function SegBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active}
      className={`inline-flex h-9 items-center gap-1.5 border-r border-white/[0.08] px-3 text-[12px] font-bold uppercase tracking-[0.08em] transition-colors last:border-r-0 ${active ? 'bg-red-500/15 text-white' : 'text-gray-400 hover:bg-white/[0.04] hover:text-white'}`}>
      {children}
    </button>
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
