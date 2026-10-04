// src/components/ProfileComments.tsx — Community comments for a summoner profile
// Visual: sistema "Arena". Requiere un ancestro .td-root y las clases pf-comment*
// de src/styles/pages/profile.css (lo monta el perfil dentro de un td-panel).
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { axiosInstance } from '@/lib/axios';
import { Heart, Trash2, MessageCircle, Send, ChevronDown, ChevronUp } from 'lucide-react';
import { Button, SectionHead } from '@/components/tournament/ui';
import '@/styles/pages/profile.css';

// ─── Types ────────────────────────────────────────────────────────────────────
interface ProfileComment {
  id: number;
  puuid: string;
  userId: number;
  username: string;
  content: string;
  likes: number;
  likedByMe: boolean;
  createdAt: string;
}

interface Props {
  puuid: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'ahora mismo';
  if (m < 60) return `hace ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h}h`;
  const d = Math.floor(h / 24);
  return `hace ${d}d`;
}

function getStoredUser(): { id: number; username: string; role?: string } | null {
  try {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Map raw DB snake_case row → camelCase ProfileComment
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapComment(row: any): ProfileComment {
  return {
    id:        row.id,
    puuid:     row.profile_puuid ?? row.puuid ?? '',
    userId:    row.user_id   ?? row.userId,
    username:  row.user_name ?? row.username ?? '?',
    content:   row.content,
    likes:     row.likes_count ?? row.likes ?? 0,
    likedByMe: Boolean(row.liked_by_me ?? row.likedByMe),
    createdAt: row.created_at ?? row.createdAt ?? new Date().toISOString(),
  };
}

// ─── Single comment ───────────────────────────────────────────────────────────
const CommentItem = memo(function CommentItem({
  comment,
  currentUserId,
  onLike,
  onDelete,
}: {
  comment: ProfileComment;
  currentUserId: number | null;
  onLike: (id: number) => void;
  onDelete: (id: number) => void;
}) {
  const isOwn = currentUserId !== null && comment.userId === currentUserId;
  const initials = comment.username.slice(0, 2).toUpperCase();

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20, transition: { duration: 0.2 } }}
      className="td-sub pf-comment"
    >
      {/* Avatar */}
      <div className="pf-comment-avatar" aria-hidden>{initials}</div>

      {/* Body */}
      <div className="pf-comment-body">
        <div className="pf-comment-head">
          <b>{comment.username}</b>
          <span>{timeAgo(comment.createdAt)}</span>
        </div>
        <p className="pf-comment-text">{comment.content}</p>

        {/* Actions */}
        <div className="pf-comment-actions">
          <button
            type="button"
            onClick={() => onLike(comment.id)}
            className="pf-comment-btn td-num"
            data-on={comment.likedByMe}
            aria-pressed={comment.likedByMe}
            aria-label={comment.likedByMe ? 'Quitar me gusta' : 'Me gusta'}
          >
            <Heart size={15} fill={comment.likedByMe ? 'currentColor' : 'none'} />
            {comment.likes > 0 && <span>{comment.likes}</span>}
          </button>

          {isOwn && (
            <button type="button" onClick={() => onDelete(comment.id)} className="pf-comment-btn">
              <Trash2 size={14} />
              Eliminar
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
});

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function CommentSkeleton() {
  return (
    <div className="td-sub pf-comment" aria-hidden>
      <span className="pf-skel" style={{ width: 40, height: 40, flexShrink: 0 }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 2 }}>
        <span className="pf-skel" style={{ height: 13, width: '25%' }} />
        <span className="pf-skel" style={{ height: 13, width: '75%' }} />
        <span className="pf-skel" style={{ height: 13, width: '50%' }} />
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export const ProfileComments = memo(function ProfileComments({ puuid }: Props) {
  const [comments, setComments]   = useState<ProfileComment[]>([]);
  const [loading, setLoading]     = useState(true);
  const [expanded, setExpanded]   = useState(false);
  const [text, setText]           = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]         = useState('');
  const textareaRef               = useRef<HTMLTextAreaElement>(null);
  const currentUser               = getStoredUser();
  const isLoggedIn                = !!currentUser;

  const fetchComments = useCallback(() => {
    setLoading(true);
    axiosInstance.get<any>(`/api/stats/profile-comments/${puuid}`)
      .then(({ data }) => {
        const rows = Array.isArray(data) ? data : (Array.isArray(data?.comments) ? data.comments : []);
        setComments(rows.map(mapComment));
      })
      .catch(() => setComments([]))
      .finally(() => setLoading(false));
  }, [puuid]);

  useEffect(() => { fetchComments(); }, [fetchComments]);

  const handleLike = useCallback(async (id: number) => {
    if (!isLoggedIn) return;
    setComments(prev =>
      prev.map(c => c.id === id
        ? { ...c, likedByMe: !c.likedByMe, likes: c.likedByMe ? c.likes - 1 : c.likes + 1 }
        : c
      )
    );
    try {
      await axiosInstance.post(`/api/stats/profile-comments/${id}/like`);
    } catch {
      fetchComments(); // revert on error
    }
  }, [isLoggedIn, fetchComments]);

  const handleDelete = useCallback(async (id: number) => {
    setComments(prev => prev.filter(c => c.id !== id));
    try {
      await axiosInstance.delete(`/api/stats/profile-comments/${id}`);
    } catch {
      fetchComments();
    }
  }, [fetchComments]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const { data } = await axiosInstance.post<any>(
        `/api/stats/profile-comments/${puuid}`,
        { content: text.trim() }
      );
      setComments(prev => [mapComment(data), ...prev]);
      setText('');
      textareaRef.current?.blur();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'No se pudo publicar el comentario.');
    } finally {
      setSubmitting(false);
    }
  };

  const safeComments = Array.isArray(comments) ? comments : [];
  const visibleComments = expanded ? safeComments : safeComments.slice(0, 3);
  const hasMore = safeComments.length > 3;

  return (
    <div>
      {/* Header */}
      <SectionHead
        icon={<MessageCircle size={15} />}
        title="Comentarios de la comunidad"
        right={!loading ? (
          <span className="td-over">
            {safeComments.length} {safeComments.length === 1 ? 'comentario' : 'comentarios'}
          </span>
        ) : undefined}
      />

      {/* Compose box */}
      {isLoggedIn ? (
        <form onSubmit={handleSubmit} className="pf-compose">
          <label className="td-field">
            <span className="td-label">Tu comentario</span>
            <textarea
              ref={textareaRef}
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSubmit(e as any); }}
              placeholder="Escribe un comentario sobre este jugador..."
              rows={2}
              maxLength={400}
              className="td-textarea"
              aria-invalid={error ? true : undefined}
            />
          </label>
          <div className="pf-compose-foot">
            <span className="td-help td-num">{text.length}/400 · Ctrl+Enter para enviar</span>
            <Button
              type="submit"
              variant="primary"
              disabled={submitting || !text.trim()}
              icon={<Send size={14} />}
            >
              {submitting ? 'Publicando…' : 'Publicar'}
            </Button>
          </div>
          {error && (
            <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
              className="td-error" role="alert" style={{ margin: '8px 0 0' }}>
              {error}
            </motion.p>
          )}
        </form>
      ) : (
        <p className="td-sub pf-login-note">
          <a href="/login" className="ax-link">Inicia sesión</a> para dejar un comentario.
        </p>
      )}

      {/* Comments list */}
      <div className="pf-comments">
        {loading ? (
          [1, 2, 3].map(i => <CommentSkeleton key={i} />)
        ) : safeComments.length === 0 ? (
          <p className="pf-note" style={{ padding: '20px 0', textAlign: 'center' }}>
            Nadie ha comentado aún. ¡Sé el primero!
          </p>
        ) : (
          <AnimatePresence initial={false}>
            {visibleComments.map(c => (
              <CommentItem
                key={c.id}
                comment={c}
                currentUserId={currentUser?.id ?? null}
                onLike={handleLike}
                onDelete={handleDelete}
              />
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Show more / less */}
      {!loading && hasMore && (
        <div className="pf-comments-more">
          <Button
            variant="ghost"
            icon={expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            onClick={() => setExpanded(e => !e)}
          >
            {expanded ? 'Mostrar menos' : `Ver los ${safeComments.length - 3} comentarios restantes`}
          </Button>
        </div>
      )}
    </div>
  );
});
