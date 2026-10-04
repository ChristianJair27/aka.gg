// src/pages/Social.tsx — feed de la comunidad (sistema "Arena").
// React Query con likes / comentarios / publicaciones optimistas: la lógica de
// datos no cambia, solo la capa visual (ver design-system/atak-gg/MASTER.md).
import { useMemo, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react';
import {
  Heart, MessageSquare, Trash2, Send, Users, Zap, Trophy, HelpCircle, Video, Star,
  ChevronDown, RefreshCw, Lock, LogIn, ArrowRight, LayoutDashboard, BarChart3, Flame,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { Tip } from '@/components/ui/Tip';
import {
  ArenaPage, SplashBackdrop, PageHero, Button, StatusChip, SectionHead, FilterPills,
  RoleIcon, ChampIcon, lol, stagger,
} from '@/components/arena';
import { useChampions } from '@/hooks/use-ddragon';
import {
  useFeed, flattenFeed, useToggleLike, useCreatePost, useDeletePost,
  useComments, useAddComment, useDeleteComment,
  type Post, type Comment,
} from '@/hooks/queries/social';
import '@/styles/pages/social.css';

// ─── Tipos de publicación ────────────────────────────────────────────────────
// Un solo acento: solo "Torneo" va en crimson (ver .so-tag en social.css);
// oro para lo destacado y verde para "abierto a jugar".
type ChipKind = 'registration' | 'gold' | 'dim';
const TAGS = [
  { key: 'general',   label: 'General',   Icon: Star,       kind: 'dim' },
  { key: 'highlight', label: 'Highlight', Icon: Zap,        kind: 'gold' },
  { key: 'lfg',       label: 'LFG',       Icon: Users,      kind: 'registration' },
  { key: 'ayuda',     label: 'Ayuda',     Icon: HelpCircle, kind: 'dim' },
  { key: 'clip',      label: 'Clip',      Icon: Video,      kind: 'dim' },
  { key: 'torneo',    label: 'Torneo',    Icon: Trophy,     kind: 'dim' },
] as const satisfies ReadonlyArray<{ key: string; label: string; Icon: typeof Star; kind: ChipKind }>;

type TagKey = typeof TAGS[number]['key'];
type FilterKey = 'all' | TagKey;

function tagConfig(key: string) {
  return TAGS.find(t => t.key === key) ?? TAGS[0];
}

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'Todo' },
  ...TAGS.map(t => ({ key: t.key as FilterKey, label: t.label })),
];
const ROLES = ['top', 'jungle', 'middle', 'bottom', 'support'] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function timeAgo(dt: string) {
  const diff = (Date.now() - new Date(dt).getTime()) / 1000;
  if (diff < 60)   return 'ahora';
  if (diff < 3600) return `${Math.floor(diff/60)}m`;
  if (diff < 86400)return `${Math.floor(diff/3600)}h`;
  return `${Math.floor(diff/86400)}d`;
}
const fullDate = (dt: string) => {
  const d = new Date(dt);
  return Number.isNaN(d.getTime()) ? undefined
    : d.toLocaleString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

function getUser(): { name: string; id?: number } | null {
  try {
    const u = localStorage.getItem('user');
    return u ? JSON.parse(u) : null;
  } catch { return null; }
}

// ─── Campeón mencionado en el texto ──────────────────────────────────────────
// El post no trae campeón como dato; si el texto nombra uno (nombre completo de
// Data Dragon) se usa su arte. Fuera los nombres que en español son palabras
// comunes: mejor no pintar nada que pintar un campeón que nadie mencionó.
type ChampRef = { id: string; name: string; image: string };
const AMBIGUOUS = new Set(['karma', 'graves', 'twitch', 'brand', 'rumble', 'aurora']);
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function useChampionMention(): (text: string) => ChampRef | null {
  const { data } = useChampions();
  return useMemo(() => {
    if (!data) return () => null;
    const list = Object.values(data.byId)
      .filter(c => c.name.length >= 4 && !AMBIGUOUS.has(c.name.toLowerCase()))
      .sort((a, b) => b.name.length - a.name.length);
    if (!list.length) return () => null;
    const byName = new Map(list.map(c => [c.name.toLowerCase(), c] as const));
    const re = new RegExp(
      `(?:^|[^\\p{L}\\p{N}])(${list.map(c => escapeRe(c.name)).join('|')})(?![\\p{L}\\p{N}])`, 'iu');
    return (text: string) => {
      const m = re.exec(text || '');
      return m ? byName.get(m[1].toLowerCase()) ?? null : null;
    };
  }, [data]);
}

// ─── Avatar ───────────────────────────────────────────────────────────────────
function Avatar({ name, size = 40, me }: { name: string; size?: number; me?: boolean }) {
  return (
    <span className="so-avatar" data-me={me ? 'true' : undefined} aria-hidden
      style={{ ['--s' as string]: `${size}px` } as CSSProperties}>
      {name?.[0] ?? '?'}
    </span>
  );
}

// ─── Chip del tipo ────────────────────────────────────────────────────────────
function TagChip({ tag }: { tag: string }) {
  const cfg = tagConfig(tag);
  return (
    <span className="so-tag" data-tag={cfg.key}>
      <StatusChip kind={cfg.kind} dot={false}><cfg.Icon size={12} aria-hidden />{cfg.label}</StatusChip>
    </span>
  );
}

// ─── Comentario ───────────────────────────────────────────────────────────────
function CommentItem({ c, myId, onDelete }: { c: Comment; myId?: number; onDelete:(id:number)=>void }) {
  return (
    <div className="so-comment">
      <Avatar name={c.user_name} size={32} me={myId === c.user_id} />
      <div className="so-comment-body">
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
          <span className="so-comment-name">{c.user_name}</span>
          <time className="td-num so-post-time" dateTime={c.created_at} title={fullDate(c.created_at)}>{timeAgo(c.created_at)}</time>
        </div>
        <p className="so-comment-text">{c.content}</p>
      </div>
      {myId === c.user_id && (
        <Tip label="Eliminar comentario">
          <button type="button" className="so-iconbtn" aria-label="Eliminar comentario" onClick={() => onDelete(c.id)}>
            <Trash2 size={16} />
          </button>
        </Tip>
      )}
    </div>
  );
}

// ─── Publicación ──────────────────────────────────────────────────────────────
function PostCard({
  post, myUserId, onLike, onDelete, feedTag, index, champ,
}: {
  post: Post; myUserId?: number;
  onLike: (post: Post)=>void;
  onDelete: (id:number)=>void;
  feedTag: string;
  index: number;
  /** Campeón que el texto menciona (si lo hay): arte + enlace a su página. */
  champ: ChampRef | null;
}) {
  const [showComments,  setShowComments]  = useState(false);
  const [newComment,    setNewComment]    = useState('');
  const isAuth = !!localStorage.getItem('access_token');

  // Like state is read straight from the optimistically-updated cache.
  const liked      = post.liked_by_me;
  const likesCount = post.likes_count;

  const commentsQ   = useComments(post.id, showComments);
  const comments    = commentsQ.data ?? [];
  const loadingC    = commentsQ.isLoading;
  const addComment  = useAddComment(post.id, feedTag);
  const delComment  = useDeleteComment(post.id);

  const toggleComments = () => setShowComments(v => !v);

  const handleLike = () => {
    if (!isAuth) return;
    onLike(post); // optimistic in the feed cache
  };

  const submitComment = (e: FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !isAuth) return;
    addComment.mutate(newComment.trim(), { onSuccess: () => setNewComment('') });
  };

  const deleteComment = (cid: number) => delComment.mutate(cid);
  const sendingC = addComment.isPending;
  const mine = myUserId === post.user_id;

  // Arte del dato: el campeón mencionado o, en posts de torneo, el mapa de Clash.
  const art = champ ? lol.splash(champ.id) : post.tag === 'torneo' ? lol.map('clash') : null;
  const commentsId = `so-comments-${post.id}`;

  return (
    <article className="td-panel so-post ax-rise" style={stagger(Math.min(index, 6))}>
      <div className="so-post-main">
        {art && (
          <img className="so-post-art" data-art={champ ? 'champion' : 'map'} src={art} alt="" aria-hidden loading="lazy" decoding="async"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
        )}
        <header className="so-post-head">
          <Avatar name={post.user_name} me={mine} />
          <div className="so-post-who">
            <span className="so-post-name">{post.user_name}</span>
            <div className="so-post-meta">
              <TagChip tag={post.tag} />
              <time className="td-num so-post-time" dateTime={post.created_at} title={fullDate(post.created_at)}>
                {timeAgo(post.created_at)}
              </time>
            </div>
          </div>
          {mine && (
            <Tip label="Eliminar publicación">
              <button type="button" className="so-iconbtn" aria-label="Eliminar publicación" onClick={() => onDelete(post.id)}>
                <Trash2 size={17} />
              </button>
            </Tip>
          )}
        </header>

        <p className="so-post-body">{post.content}</p>

        {champ && (
          <Link to={`/champion/${champ.id}`} className="so-champ-ref" aria-label={`Ver la página de ${champ.name}`}>
            <ChampIcon src={champ.image} size={28} />
            {champ.name}
          </Link>
        )}

        <div className="so-post-actions">
          <Tip label={!isAuth ? 'Inicia sesión para dar me gusta' : liked ? 'Quitar me gusta' : 'Me gusta'}>
            {/* El span mantiene el tooltip cuando el botón está deshabilitado. */}
            <span style={{ display: 'inline-flex' }}>
              <button type="button" className="so-action" data-on={liked} aria-pressed={liked}
                aria-label={`Me gusta (${likesCount})`} onClick={handleLike} disabled={!isAuth}>
                <Heart size={18} aria-hidden />
                <span>{likesCount}</span>
              </button>
            </span>
          </Tip>

          <Tip label={showComments ? 'Ocultar comentarios' : 'Ver comentarios'}>
            <button type="button" className="so-action" aria-expanded={showComments} aria-controls={commentsId}
              aria-label={`Comentarios (${post.comments_count})`} onClick={toggleComments}>
              <MessageSquare size={18} aria-hidden />
              <span>{post.comments_count}</span>
            </button>
          </Tip>
        </div>
      </div>

      {showComments && (
        <div className="so-comments ax-rise" id={commentsId}>
          {loadingC && (
            <div style={{ display: 'grid', gap: 12 }}>
              {[0, 1].map(i => (
                <div key={i} style={{ display: 'flex', gap: 12 }}>
                  <Skeleton width={32} height={32} style={{ borderRadius: 6 }} />
                  <div style={{ flex: 1, display: 'grid', gap: 8 }}>
                    <Skeleton width="30%" height={12} />
                    <Skeleton width="80%" height={12} />
                  </div>
                </div>
              ))}
            </div>
          )}
          {comments.map(c => (
            <CommentItem key={c.id} c={c} myId={myUserId} onDelete={deleteComment} />
          ))}
          {comments.length === 0 && !loadingC && (
            <p className="so-note">Sé el primero en comentar</p>
          )}

          {isAuth ? (
            <form onSubmit={submitComment} className="so-comment-form">
              <input
                className="td-input"
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
                placeholder="Escribe un comentario…"
                aria-label="Escribe un comentario"
                maxLength={280}
              />
              <Button type="submit" variant="primary" ariaLabel="Enviar comentario" disabled={!newComment.trim() || sendingC}>
                {sendingC ? <RefreshCw size={16} className="animate-spin" /> : <Send size={16} />}
              </Button>
            </form>
          ) : (
            <p className="so-note">
              <Link to="/login" className="ax-link">Inicia sesión</Link> para comentar
            </p>
          )}
        </div>
      )}
    </article>
  );
}

// ─── Composer ─────────────────────────────────────────────────────────────────
function ComposeBox({ feedTag }: { feedTag: string }) {
  const [content,  setContent]  = useState('');
  const [tag,      setTag]      = useState<TagKey>('general');
  const user = getUser();
  const createPost = useCreatePost(feedTag);
  const loading = createPost.isPending;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    // Optimistic: the new post appears instantly via useCreatePost.onMutate.
    createPost.mutate(
      { content: content.trim(), tag },
      { onSuccess: () => setContent('') },
    );
  };

  return (
    <form className="td-panel so-compose" onSubmit={submit}>
      <div className="so-compose-top">
        {user && <Avatar name={user.name} me />}
        <div className="td-field">
          <label className="td-label" htmlFor="so-new-post">Nueva publicación</label>
          <textarea
            id="so-new-post"
            className="td-textarea"
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="Comparte tu highlight, busca teammates, pide ayuda…"
            maxLength={280}
            rows={3}
          />
        </div>
      </div>

      <div className="so-compose-bar">
        <div className="so-compose-type">
          <span className="td-over">Tipo</span>
          <FilterPills<TagKey>
            ariaLabel="Tipo de publicación"
            items={TAGS.map(t => ({ key: t.key, label: t.label }))}
            value={tag} onChange={setTag}
          />
        </div>
        <div className="so-compose-send">
          <span className="td-num so-count" data-near={content.length > 240} aria-live="polite">
            {content.length}/280
          </span>
          <Button type="submit" variant="primary" disabled={!content.trim() || loading}
            icon={loading ? <RefreshCw size={15} className="animate-spin" /> : <Send size={15} />}>
            Publicar
          </Button>
        </div>
      </div>
    </form>
  );
}

function PostSkeleton() {
  return (
    <div className="td-panel" style={{ padding: '18px 20px' }} aria-hidden>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <Skeleton width={40} height={40} style={{ borderRadius: 6 }} />
        <div style={{ flex: 1, display: 'grid', gap: 8, alignContent: 'center' }}>
          <Skeleton width="33%" height={14} />
          <Skeleton width="22%" height={12} />
        </div>
      </div>
      <div style={{ display: 'grid', gap: 8 }}>
        <Skeleton width="100%" height={13} />
        <Skeleton width="83%" height={13} />
      </div>
    </div>
  );
}

function SideLink({ to, icon, children }: { to: string; icon: ReactNode; children: ReactNode }) {
  return (
    <li>
      <Link to={to}>{icon}<span>{children}</span><ArrowRight size={16} aria-hidden /></Link>
    </li>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function Social() {
  const [tagFilter, setTagFilter] = useState<FilterKey>('all');
  const user   = getUser();
  const isAuth = !!localStorage.getItem('access_token');

  // Paginated feed via React Query (caching + dedupe). Filtering by tag swaps
  // the query key, so each filter keeps its own cache.
  const feed = useFeed(tagFilter);
  const posts = flattenFeed(feed.data?.pages);
  const loading = feed.isLoading;
  const loadingMore = feed.isFetchingNextPage;
  const hasMore = feed.hasNextPage;

  const toggleLike = useToggleLike(tagFilter);
  const deletePost = useDeletePost(tagFilter);
  const mentionOf = useChampionMention();

  const handleLike = (post: Post) => toggleLike.mutate(post);

  const handleDelete = (postId: number) => {
    if (!confirm('¿Eliminar esta publicación?')) return;
    deletePost.mutate(postId);
  };

  const filtering = tagFilter !== 'all';

  return (
    <ArenaPage backdrop={<SplashBackdrop map="summoners-rift" opacity={0.8} height="600px" position="50% 42%" side="right" />}>
      <PageHero
        kicker="Comunidad · League of Legends"
        title={<>Comunidad <em>ATAK</em></>}
        lede="Comparte highlights, busca dúo, pide consejos y conecta con la comunidad."
      />

      <div className="so-layout">
        <div className="so-feed">
          {/* Publicar, o el porqué de no poder */}
          {isAuth ? (
            <ComposeBox feedTag={tagFilter} />
          ) : (
            <div className="td-panel so-locked ax-rise" style={stagger(3)}>
              <span className="so-locked-ico" aria-hidden><Lock size={20} /></span>
              <div className="so-locked-text">
                <h2 className="ax-h3">Únete a la conversación</h2>
                <p>Inicia sesión para publicar en la comunidad</p>
              </div>
              <div className="so-locked-actions">
                <Link to="/login" className="td-btn td-btn--primary"><LogIn size={15} aria-hidden /> Iniciar sesión</Link>
                <Link to="/register" className="td-btn td-btn--secondary">Crear cuenta</Link>
              </div>
            </div>
          )}

          <div className="so-feedhead">
            <SectionHead
              size="lg"
              icon={<MessageSquare size={19} />}
              title="Publicaciones"
              right={
                <FilterPills<FilterKey>
                  ariaLabel="Filtrar publicaciones por tipo"
                  items={FILTERS} value={tagFilter} onChange={setTagFilter}
                />
              }
            />
          </div>

          {/* Feed */}
          {loading ? (
            <>{[1, 2, 3].map(i => <PostSkeleton key={i} />)}</>
          ) : posts.length > 0 ? (
            <>
              {posts.map((post, i) => (
                <PostCard
                  key={post.id}
                  post={post}
                  index={i}
                  myUserId={user?.id}
                  onLike={handleLike}
                  onDelete={handleDelete}
                  feedTag={tagFilter}
                  champ={mentionOf(post.content)}
                />
              ))}

              {hasMore && (
                <div className="so-more">
                  <Button variant="secondary" onClick={() => feed.fetchNextPage()} disabled={loadingMore}
                    icon={loadingMore ? <RefreshCw size={15} className="animate-spin" /> : <ChevronDown size={16} />}>
                    {loadingMore ? 'Cargando…' : 'Cargar más'}
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div className="ax-empty">
              <Users size={28} color="var(--td-muted)" aria-hidden />
              <h3>No hay publicaciones aún</h3>
              {isAuth && <p style={{ margin: 0, fontSize: 14.5 }}>¡Sé el primero en publicar algo!</p>}
              {filtering && (
                <div style={{ marginTop: 16 }}>
                  <Button variant="secondary" onClick={() => setTagFilter('all')}>Ver todas las publicaciones</Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Columna lateral: accesos con lo que la página ya tiene (sin llamadas nuevas) */}
        <aside className="so-side" aria-label="Accesos de la comunidad">
          <Link to="/tournaments" className="ax-artcard so-side-art">
            <img className="ax-artcard-img" src={lol.map('clash')} alt="" loading="lazy" decoding="async"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
            <span className="td-over">Competitivo</span>
            <h2 className="ax-h3" style={{ marginTop: 4 }}>Torneos ATAK</h2>
            <p>Brackets automáticos y stats en vivo de cada partida.</p>
            <span className="so-side-go">Ver torneos <ArrowRight size={15} aria-hidden /></span>
          </Link>

          <section className="td-panel so-side-card">
            <SectionHead icon={<Users size={15} />} title="Buscar dúo" />
            <div className="so-roles" aria-hidden>
              {ROLES.map(r => <span key={r}><RoleIcon lane={r} size={24} /></span>)}
            </div>
            <p>Las publicaciones LFG son de jugadores que buscan con quién jugar. Publica la tuya con tu rol y tu rango.</p>
            <Button variant="secondary" full
              onClick={() => setTagFilter(tagFilter === 'lfg' ? 'all' : 'lfg')}>
              {tagFilter === 'lfg' ? 'Ver todas las publicaciones' : 'Ver publicaciones LFG'}
            </Button>
          </section>

          <nav className="td-panel so-side-card" aria-label="Más en ATAK.GG">
            <SectionHead title="Más en ATAK.GG" />
            <ul className="so-links">
              <SideLink to="/stats" icon={<BarChart3 size={20} color="var(--td-text-2)" aria-hidden />}>Buscar invocador</SideLink>
              <SideLink to="/meta" icon={<Flame size={20} color="var(--td-text-2)" aria-hidden />}>Meta del parche</SideLink>
              {isAuth && (
                <SideLink to="/dashboard" icon={<LayoutDashboard size={20} color="var(--td-text-2)" aria-hidden />}>Mi panel</SideLink>
              )}
            </ul>
          </nav>
        </aside>
      </div>
    </ArenaPage>
  );
}
