// Pestaña "Social" de un torneo: feed de highlights (clips renderizados por ATAK) con
// me gusta, comentarios, compartir y repost. Reusa el backend social (/api/social/posts).
import { useCallback, useEffect, useRef, useState } from 'react';
import { Heart, MessageCircle, Share2, Repeat2, Link as LinkIcon, Clapperboard, Send } from 'lucide-react';
import axiosInstance from '@/lib/axios';
import { useAuth } from '@/features/auth/useAuth';
import { toast } from '@/components/ui/sonner';
import { FightStats } from '@/components/FightStats';

interface Meta { team1?: string; team2?: string; round?: number; gameNumber?: number; matchId?: string; tStart?: number; tEnd?: number; kind?: string }
interface Post {
  id: number; user_id: number; user_name: string; content: string; tag: string; kind: 'text' | 'clip' | 'repost';
  tournament_id?: string | null; media_url?: string | null; title?: string | null; meta?: Meta | null; repost_of?: number | null;
  clip_region?: string | null; clip_game_id?: number | null; orig_clip_region?: string | null; orig_clip_game_id?: number | null;
  likes_count: number; comments_count: number; reposts_count: number; created_at: string; liked_by_me: boolean | number; reposted_by_me: boolean | number;
  orig_id?: number | null; orig_user_name?: string; orig_content?: string; orig_media_url?: string | null; orig_title?: string | null; orig_meta?: Meta | null;
  orig_likes_count?: number; orig_comments_count?: number; orig_reposts_count?: number;
}
interface Comment { id: number; user_name: string; content: string; created_at: string }

const mmss = (s?: number) => s == null ? '' : `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const ago = (iso: string) => {
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (d < 60) return 'ahora'; if (d < 3600) return `${Math.floor(d / 60)} min`; if (d < 86400) return `${Math.floor(d / 3600)} h`; return `${Math.floor(d / 86400)} d`;
};

export function TournamentSocial({ tournamentId, tournamentName }: { tournamentId: string; tournamentName?: string }) {
  const { isAuthenticated } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [focus, setFocus] = useState<number | null>(() => Number(new URLSearchParams(location.search).get('post')) || null);

  const load = useCallback(async () => {
    try {
      const { data } = await axiosInstance.get('/api/social/posts', { params: { tournament: tournamentId, limit: 50 } });
      setPosts(data?.posts ?? []);
    } catch { /* feed vacío */ } finally { setLoading(false); }
  }, [tournamentId]);
  useEffect(() => { void load(); }, [load]);

  const patch = (id: number, fn: (p: Post) => Post) => setPosts((ps) => ps.map((p) => (p.id === id ? fn(p) : p)));

  const like = async (p: Post) => {
    if (!isAuthenticated) return toast('Inicia sesión para dar me gusta');
    const was = !!p.liked_by_me;
    patch(p.id, (x) => ({ ...x, liked_by_me: !was, likes_count: x.likes_count + (was ? -1 : 1) }));
    try { await axiosInstance.post(`/api/social/posts/${p.id}/like`); } catch { patch(p.id, (x) => ({ ...x, liked_by_me: was, likes_count: x.likes_count + (was ? 1 : -1) })); }
  };
  const repost = async (p: Post) => {
    if (!isAuthenticated) return toast('Inicia sesión para repostear');
    try {
      const { data } = await axiosInstance.post(`/api/social/posts/${p.id}/repost`);
      toast(data?.reposted ? 'Reposteado en tu perfil y en el feed del torneo' : 'Repost retirado');
      await load();
    } catch (e: any) { toast(e?.response?.data?.error || 'No se pudo repostear'); }
  };
  const share = async (p: Post) => {
    const url = `${location.origin}/tournaments/${tournamentId}?tab=social&post=${p.id}`;
    const title = p.title || p.orig_title || 'Highlight';
    const text = `${title} · ${tournamentName || 'ATAK.GG'}`;
    try {
      if (navigator.share) { await navigator.share({ title: text, text, url }); return; }
    } catch { /* cancelado */ }
    try { await navigator.clipboard.writeText(url); toast('Enlace copiado'); } catch { toast(url); }
  };

  if (loading) return <div className="py-10 text-center text-sm text-gray-500">Cargando highlights…</div>;
  if (!posts.length) return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-6 text-center">
      <Clapperboard className="mx-auto mb-2 h-6 w-6 text-red-500" />
      <p className="text-sm text-gray-400">Todavía no hay highlights. Se publican automáticamente en cuanto ATAK.GG renderiza los replays de las partidas.</p>
    </div>
  );

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {posts.map((p) => <PostCard key={p.id} post={p} focus={focus === p.id} onLike={() => like(p)} onRepost={() => repost(p)} onShare={() => share(p)} isAuth={isAuthenticated} onCommented={() => patch(p.id, (x) => ({ ...x, comments_count: x.comments_count + 1 }))} />)}
    </div>
  );
}

function PostCard({ post, focus, onLike, onRepost, onShare, isAuth, onCommented }: { post: Post; focus: boolean; onLike: () => void; onRepost: () => void; onShare: () => void; isAuth: boolean; onCommented: () => void }) {
  const isRepost = post.kind === 'repost' && post.orig_id;
  const media = isRepost ? post.orig_media_url : post.media_url;
  const title = isRepost ? post.orig_title : post.title;
  const meta = (isRepost ? post.orig_meta : post.meta) || {};
  const clipRegion = isRepost ? post.orig_clip_region : post.clip_region;
  const clipGameId = isRepost ? post.orig_clip_game_id : post.clip_game_id;
  const [open, setOpen] = useState(focus);
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [text, setText] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (focus && ref.current) ref.current.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, [focus]);
  useEffect(() => {
    if (!open || comments) return;
    axiosInstance.get(`/api/social/posts/${post.id}/comments`).then((r) => setComments(r.data ?? [])).catch(() => setComments([]));
  }, [open, comments, post.id]);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    if (!isAuth) return toast('Inicia sesión para comentar');
    try { const { data } = await axiosInstance.post(`/api/social/posts/${post.id}/comments`, { content: text.trim() }); setComments((c) => [...(c ?? []), data]); setText(''); onCommented(); }
    catch (err: any) { toast(err?.response?.data?.error || 'No se pudo comentar'); }
  };
  const Action = ({ icon, label, on, active, onClick, title: t }: { icon: React.ReactNode; label: number | string; on?: boolean; active?: string; onClick: () => void; title: string }) => (
    <button type="button" onClick={onClick} title={t} aria-pressed={!!on}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 h-8 text-xs font-bold border transition-colors ${on ? `${active || 'text-red-400 border-red-500/40 bg-red-500/10'}` : 'text-gray-400 border-white/[0.08] hover:text-white hover:border-white/20'}`}>
      {icon}<span>{label}</span>
    </button>
  );
  return (
    <article ref={ref} className={`rounded-xl border bg-white/[0.03] overflow-hidden ${focus ? 'border-red-500/60' : 'border-white/[0.08]'}`}>
      <header className="flex items-center gap-3 px-4 pt-3">
        <div className="h-8 w-8 rounded-full bg-red-600/90 grid place-items-center text-[11px] font-black text-white">{(post.user_name || 'A').slice(0, 1).toUpperCase()}</div>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-white truncate">{post.user_name}{isRepost && <span className="text-gray-500 font-normal"> · reposteó a {post.orig_user_name}</span>}</div>
          <div className="text-[11px] uppercase tracking-[0.14em] text-gray-500">{ago(post.created_at)}{meta.round ? ` · Ronda ${meta.round}` : ''}{meta.gameNumber ? ` · Juego ${meta.gameNumber}` : ''}</div>
        </div>
      </header>
      {isRepost && post.content && !post.content.startsWith('Repost de') && <p className="px-4 pt-2 text-sm text-gray-200">{post.content}</p>}
      <div className="px-4 pt-3">
        <h3 className="text-base font-bold text-white leading-tight uppercase tracking-wide">{title || post.content}</h3>
        {(meta.team1 || meta.team2) && <div className="mt-1 text-xs text-gray-400">{meta.team1} vs {meta.team2}{meta.tStart != null ? ` · ${mmss(meta.tStart)}–${mmss(meta.tEnd)}` : ''}</div>}
      </div>
      {media && <video src={media} controls preload="metadata" playsInline className="mt-3 w-full aspect-video bg-black" />}
      {media && <FightStats region={clipRegion} gameId={clipGameId} start={meta.tStart} end={meta.tEnd} title={title} matchup={meta.team1 && meta.team2 ? `${meta.team1} vs ${meta.team2}${meta.round ? ` · Ronda ${meta.round}` : ''}${meta.gameNumber ? ` · Juego ${meta.gameNumber}` : ''}` : undefined} />}
      <footer className="flex flex-wrap items-center gap-2 px-4 py-3">
        <Action icon={<Heart className="h-3.5 w-3.5" />} label={post.likes_count} on={!!post.liked_by_me} onClick={onLike} title={isAuth ? 'Me gusta' : 'Inicia sesión para dar me gusta'} />
        <Action icon={<MessageCircle className="h-3.5 w-3.5" />} label={post.comments_count} on={open} active="text-white border-white/30 bg-white/[0.06]" onClick={() => setOpen((o) => !o)} title="Comentarios" />
        <Action icon={<Repeat2 className="h-3.5 w-3.5" />} label={(isRepost ? post.orig_reposts_count : post.reposts_count) ?? 0} on={!!post.reposted_by_me} active="text-emerald-300 border-emerald-500/40 bg-emerald-500/10" onClick={onRepost} title={isAuth ? 'Repostear' : 'Inicia sesión para repostear'} />
        <Action icon={<Share2 className="h-3.5 w-3.5" />} label="Compartir" onClick={onShare} title="Compartir enlace" />
        {media && <a href={media} download className="ml-auto inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.14em] text-gray-500 hover:text-white"><LinkIcon className="h-3 w-3" /> MP4</a>}
      </footer>
      {open && (
        <div className="border-t border-white/[0.06] px-4 py-3 space-y-2">
          {comments === null && <div className="text-xs text-gray-500">Cargando comentarios…</div>}
          {comments?.map((c) => (
            <div key={c.id} className="text-sm"><span className="font-semibold text-white">{c.user_name}</span> <span className="text-gray-500 text-[11px]">· {ago(c.created_at)}</span><div className="text-gray-200">{c.content}</div></div>
          ))}
          {comments?.length === 0 && <div className="text-xs text-gray-500">Sé el primero en comentar.</div>}
          <form onSubmit={submit} className="flex gap-2 pt-1">
            <input value={text} onChange={(e) => setText(e.target.value)} maxLength={280} placeholder={isAuth ? 'Escribe un comentario…' : 'Inicia sesión para comentar'} disabled={!isAuth}
              className="flex-1 h-9 rounded-md bg-black/40 border border-white/[0.1] px-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-red-500/60" />
            <button type="submit" disabled={!isAuth || !text.trim()} className="h-9 px-3 rounded-md bg-red-600 text-white text-xs font-bold disabled:opacity-40 inline-flex items-center gap-1"><Send className="h-3.5 w-3.5" /> Enviar</button>
          </form>
        </div>
      )}
    </article>
  );
}
