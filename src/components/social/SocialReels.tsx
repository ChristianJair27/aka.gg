// Social del torneo en formato reels: un clip por pantalla con scroll a saltos, autoplay silencioso
// cuando está a la vista (y pausa fuera), doble toque para like, carril de acciones con animaciones,
// comentarios en hoja inferior con stickers/fotos, repost, compartir (WhatsApp, Instagram, TikTok…)
// y publicación de videos por cualquier usuario. Tokens y piezas del sistema Arena (td-*).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'framer-motion';
import { Heart, MessageCircle, Repeat2, Download, Volume2, VolumeX, Play, Plus, X, Image as ImageIcon, Smile, Send, Film, ChevronUp, ChevronDown } from 'lucide-react';
import axiosInstance from '@/lib/axios';
import { useAuth } from '@/features/auth/useAuth';
import { toast } from '@/components/ui/sonner';
import { ShareMenu, shareUrlFromMedia } from '@/components/ShareMenu';
import { StickerPicker, uploadMedia, type Sticker } from '@/components/social/StickerPicker';
import { AtakModal, AtakModalBody, AtakModalContent, AtakModalHeader } from '@/components/ui/atak-modal';
import { ARENA_MODAL } from '@/components/tournament/forms';

interface Meta { team1?: string; team2?: string; round?: number; gameNumber?: number; tStart?: number; tEnd?: number; kind?: string }
interface Post {
  id: number; user_id: number; user_name: string; user_avatar?: string | null; content: string; kind: string;
  tournament_id?: string | null; media_url?: string | null; title?: string | null; meta?: Meta | null; repost_of?: number | null;
  clip_key?: string | null; clip_game_id?: number | null;
  likes_count: number; comments_count: number; reposts_count: number; created_at: string; liked_by_me: boolean | number; reposted_by_me: boolean | number;
  orig_id?: number | null; orig_user_name?: string; orig_media_url?: string | null; orig_title?: string | null; orig_meta?: Meta | null; orig_clip_key?: string | null; orig_clip_game_id?: number | null;
}
interface Comment { id: number; user_id: number; user_name: string; user_avatar?: string | null; content: string; sticker_url?: string | null; media_url?: string | null; created_at: string }

const ago = (iso: string) => { const d = (Date.now() - new Date(iso).getTime()) / 1000; if (d < 60) return 'ahora'; if (d < 3600) return `${Math.floor(d / 60)} min`; if (d < 86400) return `${Math.floor(d / 3600)} h`; return `${Math.floor(d / 86400)} d`; };
const mmss = (s?: number) => (s == null ? '' : `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`);
const isVerticalKey = (k?: string | null) => !!k && (k.startsWith('v-') || k.startsWith('vv-'));
const baseKey = (k?: string | null) => String(k || '').replace(/^(vv|v|vod)-/, '');
const posterOf = (media?: string | null) => (media && /\/api\/replays\/.+\/clips\//.test(media) ? `${media}/poster.jpg` : media && /\/api\/social\/media\/\d+$/.test(media) ? `${media}/poster.jpg` : undefined);

function Avatar({ name, url, size = 36 }: { name: string; url?: string | null; size?: number }) {
  return url
    ? <img src={url} alt="" className="rounded-full object-cover ring-2 ring-white/20" style={{ width: size, height: size }} />
    : <div className="grid place-items-center rounded-full bg-red-600 font-black text-white ring-2 ring-white/20" style={{ width: size, height: size, fontSize: size * 0.4 }}>{(name || 'A').slice(0, 1).toUpperCase()}</div>;
}

export function SocialReels({ tournamentId, tournamentName }: { tournamentId: string; tournamentName?: string }) {
  const { isAuthenticated, user } = useAuth();
  const reduce = useReducedMotion();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [muted, setMuted] = useState(true);
  const [active, setActive] = useState(0);
  const [commentsFor, setCommentsFor] = useState<Post | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  // En móvil el feed ocupa toda la pantalla (como Reels/TikTok); en escritorio va en una columna centrada.
  const [fs, setFs] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches);
  useEffect(() => { if (!fs) return; const prev = document.body.style.overflow; document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = prev; }; }, [fs]);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const focusId = useMemo(() => Number(new URLSearchParams(location.search).get('post')) || null, []);

  const load = useCallback(async () => {
    try {
      const { data } = await axiosInstance.get('/api/social/posts', { params: { tournament: tournamentId, limit: 50 } });
      const list: Post[] = data?.posts ?? [];
      // Un clip de replay existe en horizontal y vertical: en reels se muestra solo el vertical si lo hay.
      const seen = new Map<string, Post>();
      for (const p of list) {
        const key = p.kind === 'clip' && p.clip_key ? `${p.clip_game_id}:${baseKey(p.clip_key)}` : `post:${p.id}`;
        const cur = seen.get(key);
        if (!cur) seen.set(key, p);
        else if (isVerticalKey(p.clip_key) && !isVerticalKey(cur.clip_key)) seen.set(key, p);
      }
      setPosts([...seen.values()]);
    } catch { /* feed vacío */ } finally { setLoading(false); }
  }, [tournamentId]);
  useEffect(() => { void load(); }, [load]);

  // Reel activo: el que ocupa el centro del contenedor
  useEffect(() => {
    const el = scrollerRef.current; if (!el) return;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting && e.intersectionRatio >= 0.6) setActive(Number((e.target as HTMLElement).dataset.index));
    }, { root: el, threshold: [0.6] });
    el.querySelectorAll('[data-index]').forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, [posts]);
  useEffect(() => {
    if (!focusId || !posts.length) return;
    const i = posts.findIndex((p) => p.id === focusId);
    if (i >= 0) scrollerRef.current?.querySelector(`[data-index="${i}"]`)?.scrollIntoView({ block: 'start' });
  }, [focusId, posts]);

  const patch = (id: number, fn: (p: Post) => Post) => setPosts((ps) => ps.map((p) => (p.id === id ? fn(p) : p)));
  const like = async (p: Post) => {
    if (!isAuthenticated) return toast('Inicia sesión para dar me gusta');
    const was = !!p.liked_by_me;
    patch(p.id, (x) => ({ ...x, liked_by_me: !was, likes_count: x.likes_count + (was ? -1 : 1) }));
    try { await axiosInstance.post(`/api/social/posts/${p.id}/like`); } catch { patch(p.id, (x) => ({ ...x, liked_by_me: was, likes_count: x.likes_count + (was ? 1 : -1) })); }
  };
  const repost = async (p: Post) => {
    if (!isAuthenticated) return toast('Inicia sesión para repostear');
    try { const { data } = await axiosInstance.post(`/api/social/posts/${p.id}/repost`); toast(data?.reposted ? 'Reposteado en tu perfil' : 'Repost retirado'); patch(p.id, (x) => ({ ...x, reposted_by_me: !!data?.reposted, reposts_count: Math.max(0, (x.reposts_count || 0) + (data?.reposted ? 1 : -1)) })); }
    catch (e: any) { toast(e?.response?.data?.error || 'No se pudo repostear'); }
  };
  const go = (dir: 1 | -1) => scrollerRef.current?.querySelector(`[data-index="${Math.max(0, Math.min(posts.length - 1, active + dir))}"]`)?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });

  if (loading) return <div className="py-10 text-center text-sm text-gray-500">Cargando highlights…</div>;

  return (
    <div className="relative mx-auto max-w-[980px]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-bold uppercase tracking-wide"><Film className="h-5 w-5 text-red-500" /> Social del torneo</h3>
          <p className="text-xs text-gray-500">Clips de la comunidad y de ATAK.GG. Desliza para ver el siguiente.</p>
        </div>
        <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} type="button" onClick={() => (isAuthenticated ? setPublishOpen(true) : toast('Inicia sesión para publicar'))} className="inline-flex h-10 items-center gap-2 rounded-md bg-red-600 px-4 text-xs font-bold uppercase tracking-[0.12em] text-white shadow-[0_8px_24px_-10px_rgba(232,50,60,0.9)]"><Plus className="h-4 w-4" /> Publicar</motion.button>
      </div>

      {posts.length === 0 ? (
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-8 text-center">
          <Film className="mx-auto mb-2 h-7 w-7 text-red-500" />
          <p className="text-sm text-gray-400">Todavía no hay clips. Sé el primero en publicar uno.</p>
        </div>
      ) : (
        (() => { const feed = (
        <div className={fs ? 'fixed inset-0 z-[80] bg-black' : 'relative flex justify-center gap-4'}>
          {fs && <button type="button" onClick={() => setFs(false)} aria-label="Salir de pantalla completa" className="absolute left-3 top-3 z-[90] grid h-9 w-9 place-items-center rounded-full bg-black/50 text-white backdrop-blur"><X className="h-5 w-5" /></button>}
          {fs && <motion.button whileTap={{ scale: 0.95 }} type="button" onClick={() => (isAuthenticated ? setPublishOpen(true) : toast('Inicia sesión para publicar'))} aria-label="Publicar" className="absolute right-3 top-3 z-[90] grid h-9 w-9 place-items-center rounded-full bg-red-600 text-white"><Plus className="h-5 w-5" /></motion.button>}
          <div ref={scrollerRef} className={`reels-scroller snap-y snap-mandatory overflow-y-auto overscroll-contain bg-black [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${fs ? 'h-[100dvh] w-full' : 'h-[min(82vh,860px)] w-full max-w-[440px] rounded-2xl'}`}>
            {posts.map((p, i) => (
              <ReelCard key={p.id} post={p} index={i} active={i === active} muted={muted} onMute={() => setMuted((m) => !m)} onLike={() => like(p)} onRepost={() => repost(p)} onComments={() => setCommentsFor(p)} tournamentId={tournamentId} tournamentName={tournamentName} reduce={!!reduce} fs={fs} />
            ))}
          </div>
          {!fs && <button type="button" onClick={() => setFs(true)} className="absolute -bottom-9 left-1/2 -translate-x-1/2 text-[11px] font-bold uppercase tracking-[0.14em] text-gray-500 hover:text-white md:hidden">Pantalla completa</button>}
          {/* Flechas en escritorio */}
          <div className="hidden flex-col justify-center gap-2 md:flex">
            <button type="button" onClick={() => go(-1)} aria-label="Anterior" className="grid h-11 w-11 place-items-center rounded-full border border-white/[0.1] bg-white/[0.04] text-gray-300 hover:text-white"><ChevronUp className="h-5 w-5" /></button>
            <button type="button" onClick={() => go(1)} aria-label="Siguiente" className="grid h-11 w-11 place-items-center rounded-full border border-white/[0.1] bg-white/[0.04] text-gray-300 hover:text-white"><ChevronDown className="h-5 w-5" /></button>
          </div>
        </div>
        ); return fs ? createPortal(feed, document.body) : feed; })()
      )}

      <CommentsSheet post={commentsFor} onClose={() => setCommentsFor(null)} isAuth={isAuthenticated} onCommented={() => { if (commentsFor) patch(commentsFor.id, (x) => ({ ...x, comments_count: x.comments_count + 1 })); }} />
      <PublishModal open={publishOpen} onOpenChange={setPublishOpen} tournamentId={tournamentId} userName={user?.name || ''} onPublished={() => { void load(); }} />
    </div>
  );
}

// ── Un reel ──────────────────────────────────────────────────────────────────
function ReelCard({ post, index, active, muted, onMute, onLike, onRepost, onComments, tournamentId, tournamentName, reduce, fs }: { post: Post; index: number; active: boolean; muted: boolean; onMute: () => void; onLike: () => void; onRepost: () => void; onComments: () => void; tournamentId: string; tournamentName?: string; reduce: boolean; fs: boolean }) {
  const isRepost = post.kind === 'repost' && post.orig_id;
  const media = isRepost ? post.orig_media_url : post.media_url;
  const rawTitle = (isRepost ? post.orig_title : post.title) || post.content || '';
  // "· Stream" / "· Vertical" van como etiqueta, no en el título.
  const title = rawTitle.replace(/\s·\s(Stream|Vertical)/g, '').trim();
  const meta = (isRepost ? post.orig_meta : post.meta) || {};
  const clipKey = isRepost ? post.orig_clip_key : post.clip_key;
  const tags = [/Stream/.test(rawTitle) ? 'Stream' : '', isVerticalKey(clipKey) ? '9:16' : ''].filter(Boolean);
  const vertical = isVerticalKey(clipKey);
  const isVideo = !!media && (post.kind === 'clip' || /\.mp4|\/clips\/|\/media\//.test(media)) && post.kind !== 'image';
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [burst, setBurst] = useState(0);
  const [showRepostSpin, setShowRepostSpin] = useState(0);
  const lastTap = useRef(0);

  useEffect(() => {
    const v = videoRef.current; if (!v) return;
    if (!active || reduce) { v.pause(); setPlaying(false); return; }
    v.muted = muted;
    const tryPlay = () => { v.play().then(() => setPlaying(true)).catch(() => setPlaying(false)); };
    tryPlay();
    // Si aún no había datos, reintentar en cuanto pueda reproducir.
    v.addEventListener('canplay', tryPlay, { once: true });
    return () => v.removeEventListener('canplay', tryPlay);
  }, [active, muted, reduce]);

  const toggle = () => { const v = videoRef.current; if (!v) return; if (v.paused) { v.play().then(() => setPlaying(true)).catch(() => {}); } else { v.pause(); setPlaying(false); } };
  const onTap = () => {
    const now = Date.now();
    if (now - lastTap.current < 300) { if (!post.liked_by_me) onLike(); setBurst((b) => b + 1); lastTap.current = 0; return; }
    lastTap.current = now; setTimeout(() => { if (lastTap.current === now) toggle(); }, 300);
  };

  // Inclinación 3D sutil siguiendo el puntero (solo escritorio, sin reducir movimiento)
  const mx = useMotionValue(0), my = useMotionValue(0);
  const rx = useSpring(useTransform(my, [-0.5, 0.5], [6, -6]), { stiffness: 180, damping: 20 });
  const ry = useSpring(useTransform(mx, [-0.5, 0.5], [-6, 6]), { stiffness: 180, damping: 20 });
  const onMove = (e: React.MouseEvent) => { if (reduce) return; const r = e.currentTarget.getBoundingClientRect(); mx.set((e.clientX - r.left) / r.width - 0.5); my.set((e.clientY - r.top) / r.height - 0.5); };
  const onLeave = () => { mx.set(0); my.set(0); };

  const shareUrl = shareUrlFromMedia(media) || `${location.origin}/tournaments/${tournamentId}?tab=social&post=${post.id}`;
  const label = [meta.team1 && meta.team2 ? `${meta.team1} vs ${meta.team2}` : '', meta.round ? `Ronda ${meta.round}` : '', meta.gameNumber ? `Juego ${meta.gameNumber}` : '', meta.tStart != null ? mmss(meta.tStart) : ''].filter(Boolean).join(' · ');

  return (
    <section data-index={index} className="relative h-full w-full snap-start" style={{ perspective: 1200 }}>
      <motion.div style={fs ? undefined : { rotateX: rx, rotateY: ry, transformStyle: 'preserve-3d' }} onMouseMove={fs ? undefined : onMove} onMouseLeave={onLeave} className={`relative h-full w-full overflow-hidden bg-black ${fs ? '' : 'rounded-2xl'}`}>
        {isVideo ? (
          <video ref={videoRef} src={media || undefined} poster={posterOf(media)} loop playsInline muted={muted} preload={active ? 'auto' : 'metadata'} onClick={onTap} onTimeUpdate={(e) => { const v = e.currentTarget; if (v.duration) setProgress(v.currentTime / v.duration); }} className={`h-full w-full ${vertical ? 'object-cover' : 'object-contain'}`} />
        ) : media ? (
          <img src={media} alt="" className="h-full w-full object-contain" onDoubleClick={() => { if (!post.liked_by_me) onLike(); setBurst((b) => b + 1); }} />
        ) : (
          <div className="grid h-full place-items-center p-8 text-center text-lg font-semibold text-white">{post.content}</div>
        )}
        {/* Degradados para legibilidad */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/60 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />
        {/* Play cuando está pausado */}
        <AnimatePresence>{isVideo && !playing && active && (
          <motion.button key="play" type="button" onClick={toggle} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.2 }} className="absolute left-1/2 top-1/2 grid h-16 w-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/55 text-white backdrop-blur"><Play className="ml-1 h-7 w-7" /></motion.button>
        )}</AnimatePresence>
        {/* Corazón al doble toque */}
        <AnimatePresence>{burst > 0 && (
          <motion.div key={burst} initial={{ opacity: 0, scale: 0.4 }} animate={{ opacity: [0, 1, 1, 0], scale: [0.4, 1.25, 1.1, 1.4] }} transition={{ duration: 0.9, times: [0, 0.2, 0.7, 1] }} className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-red-500 drop-shadow-[0_8px_24px_rgba(232,50,60,0.8)]"><Heart className="h-28 w-28" fill="currentColor" /></motion.div>
        )}</AnimatePresence>
        {/* Cabecera: autor */}
        <div className={`absolute right-16 flex items-center gap-2 ${fs ? 'left-14 top-3' : 'left-3 top-3'}`}>
          <Avatar name={post.user_name} url={post.user_avatar} size={34} />
          <div className="min-w-0">
            <div className="truncate text-sm font-bold text-white drop-shadow">{post.user_name}{isRepost && <span className="font-normal text-gray-300"> · reposteó a {post.orig_user_name}</span>}</div>
            <div className="text-[10px] uppercase tracking-[0.14em] text-gray-300">{ago(post.created_at)}{tournamentName ? ` · ${tournamentName}` : ''}</div>
          </div>
        </div>
        {isVideo && <button type="button" onClick={onMute} aria-label={muted ? 'Activar sonido' : 'Silenciar'} className={`absolute grid h-9 w-9 place-items-center rounded-full bg-black/50 text-white backdrop-blur ${fs ? 'right-14 top-3' : 'right-3 top-3'}`}>{muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}</button>}
        {/* Pie: título y meta */}
        <div className={`absolute left-3 right-16 ${fs ? 'bottom-10' : 'bottom-6'}`}>
          <div className="text-base font-bold uppercase leading-tight tracking-wide text-white drop-shadow" style={{ fontFamily: 'var(--td-font-display)' }}>{title}</div>
          {(label || tags.length > 0) && <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-300">{tags.map((t) => <span key={t} className="rounded bg-white/15 px-1.5 py-0.5 text-[10px] text-white">{t}</span>)}<span>{label}</span></div>}
          {post.content && post.title && post.kind !== 'clip' && <p className="mt-1 line-clamp-2 text-sm text-gray-200">{post.content}</p>}
        </div>
        {/* Carril de acciones */}
        <div className={`absolute right-2 flex flex-col items-center gap-3 ${fs ? 'bottom-10' : 'bottom-6'}`}>
          <Rail icon={<Heart className="h-6 w-6" fill={post.liked_by_me ? 'currentColor' : 'none'} />} label={post.likes_count} active={!!post.liked_by_me} activeClass="text-red-500" onClick={() => { onLike(); if (!post.liked_by_me) setBurst((b) => b + 1); }} pulse />
          <Rail icon={<MessageCircle className="h-6 w-6" />} label={post.comments_count} onClick={onComments} />
          <Rail icon={<motion.span key={showRepostSpin} animate={showRepostSpin ? { rotate: 360 } : {}} transition={{ duration: 0.5 }} className="inline-block"><Repeat2 className="h-6 w-6" /></motion.span>} label={post.reposts_count ?? 0} active={!!post.reposted_by_me} activeClass="text-emerald-300" onClick={() => { setShowRepostSpin((n) => n + 1); onRepost(); }} />
          <ShareMenu rail url={shareUrl} mp4={isVideo ? media : undefined} title={title || 'Highlight'} text={`${title} · ${tournamentName || 'ATAK.GG'}`} />
          {isVideo && <a href={media || '#'} download aria-label="Descargar" className="grid h-11 w-11 place-items-center rounded-full bg-black/50 text-white backdrop-blur hover:bg-black/70"><Download className="h-5 w-5" /></a>}
        </div>
        {/* Progreso */}
        {isVideo && (
          <input type="range" min={0} max={1000} value={Math.round(progress * 1000)} aria-label="Posición del video"
            onChange={(e) => { const v = videoRef.current; if (v && v.duration) { v.currentTime = (Number(e.target.value) / 1000) * v.duration; setProgress(Number(e.target.value) / 1000); } }}
            className={`reel-seek absolute inset-x-0 h-6 w-full cursor-pointer appearance-none bg-transparent ${fs ? 'bottom-3' : 'bottom-0'}`} style={{ ['--p' as any]: `${progress * 100}%` }} />
        )}
      </motion.div>
    </section>
  );
}

function Rail({ icon, label, onClick, active, activeClass, pulse }: { icon: React.ReactNode; label: number | string; onClick: () => void; active?: boolean; activeClass?: string; pulse?: boolean }) {
  return (
    <motion.button type="button" onClick={onClick} whileTap={{ scale: 0.85 }} animate={active && pulse ? { scale: [1, 1.3, 1] } : {}} transition={{ duration: 0.35 }} className={`flex flex-col items-center gap-0.5 text-white ${active ? activeClass || '' : ''}`}>
      <span className="grid h-11 w-11 place-items-center rounded-full bg-black/50 backdrop-blur">{icon}</span>
      <span className="text-[11px] font-bold tabular-nums drop-shadow">{label}</span>
    </motion.button>
  );
}

// ── Comentarios: hoja inferior ────────────────────────────────────────────────
function CommentsSheet({ post, onClose, isAuth, onCommented }: { post: Post | null; onClose: () => void; isAuth: boolean; onCommented: () => void }) {
  const [list, setList] = useState<Comment[] | null>(null);
  const [text, setText] = useState('');
  const [stickers, setStickers] = useState(false);
  const [sending, setSending] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!post) { setList(null); setText(''); setStickers(false); return; }
    axiosInstance.get(`/api/social/posts/${post.id}/comments`).then((r) => setList(r.data ?? [])).catch(() => setList([]));
  }, [post]);
  const send = async (extra: { sticker_id?: number; media_id?: number } = {}) => {
    if (!post) return;
    if (!isAuth) return toast('Inicia sesión para comentar');
    if (!text.trim() && !extra.sticker_id && !extra.media_id) return;
    setSending(true);
    try { const { data } = await axiosInstance.post(`/api/social/posts/${post.id}/comments`, { content: text.trim(), ...extra }); setList((c) => [...(c ?? []), data]); setText(''); setStickers(false); onCommented(); }
    catch (e: any) { toast(e?.response?.data?.error || 'No se pudo comentar'); } finally { setSending(false); }
  };
  const photo = async (f?: File) => {
    if (!f) return; if (!isAuth) return toast('Inicia sesión para comentar');
    if (f.size > 8 * 1024 * 1024) return toast('La foto debe pesar menos de 8 MB');
    try { const m = await uploadMedia(f, 'image', f.name); await send({ media_id: m.id }); } catch (e: any) { toast(e?.response?.data?.error || 'No se pudo subir la foto'); }
  };
  return (
    <AnimatePresence>
      {post && (
        <>
          <motion.div key="bg" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 z-40 bg-black/60" />
          <motion.div key="sheet" initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', stiffness: 320, damping: 32 }} role="dialog" aria-label="Comentarios" className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[78vh] w-full max-w-[560px] flex-col rounded-t-2xl border border-white/[0.1] bg-[#121216] shadow-[0_-20px_60px_-20px_rgba(0,0,0,0.9)]">
            <div className="flex items-center justify-between px-4 pb-2 pt-3">
              <div className="mx-auto h-1 w-10 rounded-full bg-white/20 absolute left-1/2 top-2 -translate-x-1/2" />
              <span className="pt-2 text-sm font-bold uppercase tracking-[0.12em] text-white">Comentarios <span className="text-gray-500">{post.comments_count}</span></span>
              <button type="button" onClick={onClose} aria-label="Cerrar" className="pt-2 text-gray-400 hover:text-white"><X className="h-5 w-5" /></button>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto px-4 pb-3">
              {list === null && <div className="py-6 text-center text-xs text-gray-500">Cargando…</div>}
              {list?.length === 0 && <div className="py-6 text-center text-sm text-gray-500">Sé el primero en comentar.</div>}
              {list?.map((c, i) => (
                <motion.div key={c.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 8) * 0.03 }} className="flex gap-3">
                  <Avatar name={c.user_name} url={c.user_avatar} size={32} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm"><span className="font-semibold text-white">{c.user_name}</span> <span className="text-[11px] text-gray-500">· {ago(c.created_at)}</span></div>
                    {c.content && <div className="text-sm text-gray-200">{c.content}</div>}
                    {c.sticker_url && <motion.img initial={{ scale: 0.6, rotate: -8 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 18 }} src={c.sticker_url} alt="sticker" className="mt-1 h-24 w-24 object-contain" />}
                    {c.media_url && <img src={c.media_url} alt="" className="mt-1 max-h-60 rounded-lg object-contain" />}
                  </div>
                </motion.div>
              ))}
            </div>
            <div className="relative border-t border-white/[0.08] p-3">
              <StickerPicker open={stickers} onClose={() => setStickers(false)} isAuth={isAuth} onPick={(s: Sticker) => void send({ sticker_id: s.id })} />
              <form onSubmit={(e) => { e.preventDefault(); void send(); }} className="flex items-center gap-2">
                <button type="button" onClick={() => setStickers((o) => !o)} aria-label="Stickers" className={`grid h-10 w-10 place-items-center rounded-md border ${stickers ? 'border-red-500/60 text-white' : 'border-white/[0.1] text-gray-300'} hover:text-white`}><Smile className="h-5 w-5" /></button>
                <button type="button" onClick={() => fileRef.current?.click()} aria-label="Foto" className="grid h-10 w-10 place-items-center rounded-md border border-white/[0.1] text-gray-300 hover:text-white"><ImageIcon className="h-5 w-5" /></button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { void photo(e.target.files?.[0]); e.target.value = ''; }} />
                <input value={text} onChange={(e) => setText(e.target.value)} maxLength={280} placeholder={isAuth ? 'Escribe un comentario…' : 'Inicia sesión para comentar'} disabled={!isAuth || sending} className="h-10 flex-1 rounded-md border border-white/[0.1] bg-black/40 px-3 text-sm text-white placeholder:text-gray-600 focus:border-red-500/60 focus:outline-none" />
                <motion.button whileTap={{ scale: 0.9 }} type="submit" disabled={!isAuth || sending || !text.trim()} aria-label="Enviar" className="grid h-10 w-10 place-items-center rounded-md bg-red-600 text-white disabled:opacity-40"><Send className="h-4 w-4" /></motion.button>
              </form>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ── Publicar: video o imagen del usuario ─────────────────────────────────────
function PublishModal({ open, onOpenChange, tournamentId, userName, onPublished }: { open: boolean; onOpenChange: (o: boolean) => void; tournamentId: string; userName: string; onPublished: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>('');
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [progress, setProgress] = useState<number | null>(null);
  const reset = () => { setFile(null); setPreview(''); setTitle(''); setText(''); setProgress(null); };
  const pick = (f?: File) => { if (!f) return; if (f.size > 80 * 1024 * 1024) return toast('Máximo 80 MB'); setFile(f); setPreview(URL.createObjectURL(f)); };
  const posterFrom = (url: string): Promise<Blob | null> => new Promise((res) => {
    const v = document.createElement('video'); v.muted = true; v.src = url; v.preload = 'auto';
    v.addEventListener('loadeddata', () => { v.currentTime = Math.min(1, (v.duration || 1) / 3); });
    v.addEventListener('seeked', () => { try { const c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight; c.getContext('2d')!.drawImage(v, 0, 0); c.toBlob((b) => res(b), 'image/jpeg', 0.82); } catch { res(null); } });
    v.addEventListener('error', () => res(null));
  });
  const publish = async () => {
    if (!file && !text.trim()) return toast('Agrega un video, una imagen o un texto');
    try {
      let mediaId: number | undefined;
      if (file) {
        const isVideo = file.type.startsWith('video/');
        setProgress(0);
        const m = await uploadMedia(file, isVideo ? 'video' : 'image', file.name, setProgress);
        mediaId = m.id;
        if (isVideo) { const p = await posterFrom(preview); if (p) await axiosInstance.post(`/api/social/media/${m.id}/poster`, p, { headers: { 'Content-Type': 'image/jpeg' } }).catch(() => {}); }
      }
      await axiosInstance.post('/api/social/posts', { content: text.trim() || title.trim(), title: title.trim() || undefined, media_id: mediaId, tournament_id: tournamentId, tag: 'highlight' });
      toast('Publicado'); reset(); onOpenChange(false); onPublished();
    } catch (e: any) { toast(e?.response?.data?.error || 'No se pudo publicar'); setProgress(null); }
  };
  return (
    <AtakModal open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <AtakModalContent size="md" className={ARENA_MODAL}>
        <AtakModalHeader icon={<Film className="h-5 w-5" />} eyebrow="Social del torneo" title="Publicar un clip" description={`Se publica como ${userName || 'tú'} en el feed del torneo. Video (mp4/webm, máx. 80 MB) o imagen.`} />
        <AtakModalBody>
          <label className="block cursor-pointer rounded-xl border border-dashed border-white/[0.15] bg-white/[0.02] p-4 text-center hover:border-red-500/50">
            <input type="file" accept="video/mp4,video/webm,image/*" className="hidden" onChange={(e) => pick(e.target.files?.[0] || undefined)} />
            {preview ? (file?.type.startsWith('video/') ? <video src={preview} controls muted playsInline className="mx-auto max-h-72 rounded-lg bg-black" /> : <img src={preview} alt="" className="mx-auto max-h-72 rounded-lg" />) : (
              <div className="py-6 text-sm text-gray-400"><Film className="mx-auto mb-2 h-7 w-7 text-red-500" />Arrastra o elige tu video o imagen<div className="mt-1 text-[11px] uppercase tracking-[0.14em] text-gray-600">Vertical 9:16 se ve mejor</div></div>
            )}
          </label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="Título (opcional)" className="mt-3 h-10 w-full rounded-md border border-white/[0.1] bg-black/40 px-3 text-sm text-white placeholder:text-gray-600 focus:border-red-500/60 focus:outline-none" />
          <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={280} rows={3} placeholder="Cuéntanos qué pasó…" className="mt-2 w-full rounded-md border border-white/[0.1] bg-black/40 px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-red-500/60 focus:outline-none" />
          {progress !== null && <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10"><motion.div className="h-full bg-red-500" animate={{ width: `${progress}%` }} /></div>}
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={() => { reset(); onOpenChange(false); }} className="h-10 rounded-md border border-white/[0.12] px-4 text-xs font-bold uppercase tracking-[0.12em] text-gray-300 hover:text-white">Cancelar</button>
            <motion.button whileTap={{ scale: 0.97 }} type="button" onClick={() => void publish()} disabled={progress !== null && progress < 100} className="h-10 rounded-md bg-red-600 px-5 text-xs font-bold uppercase tracking-[0.12em] text-white disabled:opacity-50">{progress !== null && progress < 100 ? `Subiendo ${progress}%` : 'Publicar'}</motion.button>
          </div>
        </AtakModalBody>
      </AtakModalContent>
    </AtakModal>
  );
}
