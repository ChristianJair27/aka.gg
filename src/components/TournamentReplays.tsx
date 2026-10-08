// Replays (.rofl) y highlights (clips MP4) de un torneo. Los replays los suben
// los companions de los jugadores; los clips los renderiza el worker de ATAK.
import { useEffect, useMemo, useState } from 'react';
import { Download, Film, Clapperboard } from 'lucide-react';
import axiosInstance from '@/lib/axios';

interface Replay { matchId: string; gameId: number; region: string; patch?: string | null; gameLengthMs?: number | null; size: number; createdAt: string; url: string }
interface Clip { matchId: string; gameId: number; region: string; key: string; tStart: number; tEnd: number; kind: string; title: string; players: Array<{ name: string; champion: string; team: string }>; size: number; createdAt: string; url: string }
interface BracketMatch { id: string; round: number; team1: string; team2: string; games?: Array<{ gameId: number; winner?: string | null }> }

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const mb = (n: number) => `${(n / 1048576).toFixed(1)} MB`;

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

  const matchOf = useMemo(() => {
    const m = new Map<string, BracketMatch>();
    for (const b of bracket || []) m.set(b.id, b);
    return (id: string) => m.get(id);
  }, [bracket]);
  const label = (matchId: string, gameId: number) => {
    const m = matchOf(matchId);
    if (!m) return matchId;
    const idx = (m.games || []).findIndex((g) => Number(g.gameId) === gameId);
    return `${m.team1} vs ${m.team2}${idx >= 0 && (m.games?.length || 0) > 1 ? ` · Juego ${idx + 1}` : ''} · Ronda ${m.round}`;
  };

  if (loading) return <div className="py-10 text-center text-sm text-gray-500">Cargando replays…</div>;

  return (
    <div className="space-y-8">
      {/* Highlights */}
      <section>
        <div className="flex items-end justify-between mb-3">
          <h3 className="flex items-center gap-2 text-lg font-bold uppercase tracking-wide"><Clapperboard className="h-5 w-5 text-red-500" /> Highlights</h3>
          <span className="text-xs text-gray-500">{clips.length} clips</span>
        </div>
        {clips.length === 0 ? (
          <p className="text-sm text-gray-500 bg-white/[0.03] border border-white/[0.08] rounded-xl p-4">
            Todavía no hay clips. Se generan automáticamente a partir de los replays: primera sangre, multikills, aces, barón, heraldo y peleas de equipo.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {clips.map((c) => (
              <figure key={`${c.gameId}-${c.key}`} className="rounded-xl overflow-hidden border border-white/[0.08] bg-white/[0.03]">
                <video src={c.url} controls preload="metadata" playsInline className="w-full aspect-video bg-black" />
                <figcaption className="p-3">
                  <div className="font-bold text-sm text-white leading-tight">{c.title}</div>
                  <div className="mt-1 text-[11px] uppercase tracking-[0.14em] text-gray-500">{label(c.matchId, c.gameId)} · {mmss(c.tStart)}–{mmss(c.tEnd)}</div>
                </figcaption>
              </figure>
            ))}
          </div>
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
