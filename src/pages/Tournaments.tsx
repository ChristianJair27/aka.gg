// src/pages/Tournaments.tsx — listado de torneos (rediseño "Arena").
// Una cartelera: el torneo que importa ahora va destacado arriba y el resto en
// filas que se leen de un vistazo. Tokens y clases en src/styles/arena.css.
import { useState, useMemo, useEffect, type CSSProperties } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from '@/components/ui/sonner';
import { TournamentRegisterModal } from '@/components/TournamentRegisterModal';
import { DailyTournamentsRail } from '@/components/DailyTournamentsRail';
import { TournamentCreateModal } from '@/components/TournamentCreateModal';
import { Skeleton } from '@/components/ui/skeleton';
import { Button, StatusChip, ProgressBar, FilterPills } from '@/components/tournament/ui';
import { useTournaments } from '@/hooks/queries/tournaments';
import { qk } from '@/hooks/queries/keys';
import { Plus, ArrowRight, Search, X, Trophy, UserPlus, CheckCircle } from 'lucide-react';
import '@/styles/tournament-dashboard.css';
import '@/styles/arena.css';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Tournament {
  id: string; name: string;
  phase: 'registration' | 'checkin' | 'active' | 'complete' | 'cancelled';
  status: string; participants: number; maxParticipants: number;
  prize: string; startDate: string; format: string; description: string;
  riotTournamentId?: number; codesAvailable?: number;
  registrationUrl?: string; rulesUrl?: string;
  teamSize?: number; gameMap?: 'SR' | 'ARAM' | 'ARENA';
  isPrivate?: boolean;
}
type RegisterTarget = { id: string; name: string; teamSize?: number };
type FilterKey = 'todos' | 'registration' | 'checkin' | 'active' | 'complete';

const PHASE = {
  registration: { label: 'Inscripciones', kind: 'registration' },
  checkin:      { label: 'Check-in',      kind: 'gold' },
  active:       { label: 'En vivo',       kind: 'live' },
  complete:     { label: 'Finalizado',    kind: 'finished' },
  cancelled:    { label: 'Cancelado',     kind: 'dim' },
} as const;

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'todos',        label: 'Todos' },
  { key: 'active',       label: 'En vivo' },
  { key: 'registration', label: 'Inscripción' },
  { key: 'checkin',      label: 'Check-in' },
  { key: 'complete',     label: 'Finalizados' },
];

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
const pctOf = (t: Tournament) =>
  t.maxParticipants > 0 ? Math.min(100, Math.round((t.participants / t.maxParticipants) * 100)) : 0;
const isOpen = (t: Tournament) => t.phase === 'registration' && t.participants < t.maxParticipants;
/** Retraso escalonado de entrada (ver .ax-rise / .ax-slide). */
const stagger = (i: number) => ({ ['--i' as string]: i }) as CSSProperties;

// ─── Etiquetas de un torneo (estado + rasgos) ────────────────────────────────
function Tags({ t }: { t: Tournament }) {
  const phase = PHASE[t.phase] ?? PHASE.complete;
  return (
    <div className="ax-row-tags">
      <StatusChip kind={phase.kind}>{phase.label}</StatusChip>
      {t.riotTournamentId && <StatusChip kind="gold" dot={false}>Riot oficial</StatusChip>}
      {t.isPrivate && <StatusChip kind="dim" dot={false}>Privado</StatusChip>}
      {t.gameMap === 'ARAM' && <StatusChip kind="dim" dot={false}>ARAM</StatusChip>}
      {t.gameMap === 'ARENA' && <StatusChip kind="dim" dot={false}>Arena ladder</StatusChip>}
      {(t.teamSize ?? 5) !== 5 && t.gameMap !== 'ARENA' && (
        <StatusChip kind="dim" dot={false}>{t.teamSize}v{t.teamSize}</StatusChip>
      )}
    </div>
  );
}

// ─── Botón de inscripción (formulario externo de la liga o modal propio) ─────
function RegisterAction({ t, onRegister, full }: { t: Tournament; onRegister: (t: RegisterTarget) => void; full?: boolean }) {
  if (t.phase === 'checkin') {
    return <Button variant="secondary" icon={<CheckCircle size={15} />} full={full}>Hacer check-in</Button>;
  }
  if (!isOpen(t)) return null;
  return (
    <span onClick={(e) => e.stopPropagation()} style={{ display: full ? 'block' : 'inline-flex' }}>
      <Button variant="primary" icon={<UserPlus size={15} />} full={full}
        onClick={() => (t.registrationUrl
          ? window.open(t.registrationUrl, '_blank', 'noopener')
          : onRegister({ id: t.id, name: t.name, teamSize: t.teamSize }))}>
        Inscribirse
      </Button>
    </span>
  );
}

// ─── Torneo destacado ────────────────────────────────────────────────────────
function FeatureCard({ t, onOpen, onRegister }: {
  t: Tournament; onOpen: () => void; onRegister: (t: RegisterTarget) => void;
}) {
  const pct = pctOf(t);
  return (
    <article
      className="ax-feature ax-rise" style={stagger(2)}
      role="link" tabIndex={0} aria-label={`Abrir ${t.name}`}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === 'Enter') onOpen(); }}
    >
      <div className="ax-hero-art" aria-hidden>
        <div className="ax-hero-slab" />
        <div className="ax-hero-hatch" />
        <div className="ax-sweep" />
      </div>

      <div className="ax-feature-main">
        <Tags t={t} />
        <h2 className="ax-feature-name">{t.name}</h2>
        {t.description && <p className="ax-feature-desc">{t.description}</p>}
        <dl className="ax-facts" style={{ marginBottom: 0 }}>
          <div className="ax-fact"><dt className="td-over">Premio</dt><dd style={{ margin: 0 }}><b>{t.prize || 'Por definir'}</b></dd></div>
          <div className="ax-fact"><dt className="td-over">Inicio</dt><dd style={{ margin: 0 }}><b>{fmtDate(t.startDate)}</b></dd></div>
          <div className="ax-fact"><dt className="td-over">Formato</dt><dd style={{ margin: 0 }}><b>{t.format}</b></dd></div>
        </dl>
      </div>

      <div className="ax-feature-side">
        <div>
          <div className="td-over">Equipos</div>
          <div className="ax-cap-num" style={{ margin: '4px 0 10px' }}>
            {t.participants}<small> / {t.maxParticipants}</small>
          </div>
          <ProgressBar kind="red" pct={pct} height={6} />
          <div className="td-over" style={{ marginTop: 7 }}>
            {t.participants >= t.maxParticipants ? 'Cupo lleno' : `${pct}% del cupo`}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <RegisterAction t={t} onRegister={onRegister} full />
          <Button variant={isOpen(t) ? 'secondary' : 'primary'} icon={<ArrowRight size={15} />} full>
            {t.phase === 'active' ? 'Seguir el torneo' : 'Ver torneo'}
          </Button>
        </div>
      </div>
    </article>
  );
}

// ─── Fila de torneo ──────────────────────────────────────────────────────────
function TournamentRow({ t, index, onOpen, onRegister }: {
  t: Tournament; index: number; onOpen: () => void; onRegister: (t: RegisterTarget) => void;
}) {
  const pct = pctOf(t);
  return (
    <article
      className="ax-row ax-slide" data-phase={t.phase} style={stagger(Math.min(index, 8))}
      role="link" tabIndex={0} aria-label={`Abrir ${t.name}`}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === 'Enter') onOpen(); }}
    >
      <div style={{ minWidth: 0 }}>
        <Tags t={t} />
        <h3 className="ax-row-name">{t.name}</h3>
        {t.description && <p className="ax-row-desc">{t.description}</p>}
      </div>

      <dl className="ax-row-facts" style={{ margin: 0 }}>
        <div style={{ minWidth: 0 }}><dt className="td-over">Premio</dt><dd style={{ margin: 0 }}><b>{t.prize || 'Por definir'}</b></dd></div>
        <div style={{ minWidth: 0 }}><dt className="td-over">Inicio</dt><dd style={{ margin: 0 }}><b>{fmtDate(t.startDate)}</b></dd></div>
        <div style={{ minWidth: 0 }}><dt className="td-over">Formato</dt><dd style={{ margin: 0 }}><b>{t.format.split(' ')[0]}</b></dd></div>
      </dl>

      <div className="ax-row-cap">
        <div className="ax-row-cap-line">
          <span className="td-over">Equipos</span>
          <span className="td-num" style={{ fontSize: 15, fontWeight: 700 }}>
            {t.participants}<span style={{ color: 'var(--td-muted)', fontWeight: 600 }}> / {t.maxParticipants}</span>
          </span>
        </div>
        <ProgressBar kind={t.phase === 'complete' ? 'var(--td-muted)' : 'red'} pct={pct} height={5} />
      </div>

      <div className="ax-row-actions">
        <RegisterAction t={t} onRegister={onRegister} />
        <span className="ax-row-go" aria-hidden><ArrowRight size={18} /></span>
      </div>
    </article>
  );
}

function RowSkeleton() {
  return (
    <div className="ax-row" style={{ cursor: 'default' }} aria-hidden>
      <div style={{ display: 'grid', gap: 8 }}>
        <Skeleton width={110} height={22} /><Skeleton width="62%" height={26} />
      </div>
      <Skeleton height={38} /><Skeleton height={30} /><Skeleton width={40} height={40} />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function TournamentsPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<FilterKey>('todos');
  const [registerOpen, setRegisterOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedTournament, setSelectedTournament] = useState<RegisterTarget | null>(null);

  const qc = useQueryClient();
  const { data, isLoading: loading } = useTournaments();
  const tournaments = useMemo(() => (data ?? []) as Tournament[], [data]);
  // After a register/create mutation, refetch the cached list.
  const refetchTournaments = () => qc.invalidateQueries({ queryKey: qk.tournaments() });

  const counts = useMemo(() => {
    const by = (p: Tournament['phase']) => tournaments.filter((t) => t.phase === p).length;
    return {
      todos: tournaments.length, active: by('active'), registration: by('registration'),
      checkin: by('checkin'), complete: by('complete'),
    } as Record<FilterKey, number>;
  }, [tournaments]);

  // El destacado: lo que está en juego ahora; si no, lo que admite equipos.
  const featured = useMemo(
    () => tournaments.find((t) => t.phase === 'active')
      ?? tournaments.find((t) => t.phase === 'checkin')
      ?? tournaments.find((t) => t.phase === 'registration')
      ?? null,
    [tournaments],
  );

  // Búsqueda por texto (nombre, descripción, formato, mapa) sobre la fase elegida.
  const [q, setQ] = useState('');
  const browsing = filter !== 'todos' || q.trim() !== '';
  const filtered = useMemo(() => {
    const byPhase = filter === 'todos' ? tournaments : tournaments.filter((t) => t.phase === filter);
    const needle = q.trim().toLowerCase();
    const list = needle
      ? byPhase.filter((t) =>
          [t.name, t.description, t.format, t.gameMap, t.prize].filter(Boolean).join(' ').toLowerCase().includes(needle))
      : byPhase;
    // Sin filtros, el destacado ya está arriba: no se repite en la lista.
    return browsing ? list : list.filter((t) => t.id !== featured?.id);
  }, [tournaments, filter, q, browsing, featured]);

  const isAuth = !!localStorage.getItem('access_token');

  // /crear-torneo es la misma página con el modal ya abierto. Existe para tener
  // un enlace corto que se pueda poner en la bio de Instagram o en un story,
  // en vez de pedirle a la gente que entre y busque el botón.
  const location = useLocation();
  const deepLinkCreate = location.pathname === '/crear-torneo';
  useEffect(() => {
    if (!deepLinkCreate) return;
    if (isAuth) { setCreateOpen(true); return; }
    // Visita fría desde una campaña: mandarla a /login en silencio parece un
    // error. Se explica por qué antes de moverla de sitio.
    toast.info('Crea tu cuenta para organizar un torneo', {
      description: 'Es gratis y te toma menos de un minuto.',
    });
    navigate('/login', { state: { from: location }, replace: true });
  }, [deepLinkCreate, isAuth, navigate, location]);

  // Al cerrar el modal desde el enlace corto, dejamos la URL en la lista real:
  // quedarse en /crear-torneo con el modal cerrado sería una página en blanco.
  const closeCreate = (open: boolean) => {
    setCreateOpen(open);
    if (!open && deepLinkCreate) navigate('/tournaments', { replace: true });
  };

  // Sin sesión, el mismo botón lleva al enlace corto, que explica y manda a login.
  const startCreate = () => (isAuth ? setCreateOpen(true) : navigate('/crear-torneo'));

  const onRegister = (sel: RegisterTarget) => {
    if (!isAuth) {
      toast.error('Inicia sesión para inscribir tu equipo');
      navigate('/login');
      return;
    }
    setSelectedTournament(sel);
    setRegisterOpen(true);
  };

  const showFeatured = !loading && featured && !browsing;
  const showToolbar = loading || tournaments.length > 1 || browsing;

  return (
    <div className="td-root ax-canvas">
      <div className="ax-wrap">

        {/* Cabecera */}
        <header className="ax-head">
          <div style={{ minWidth: 0 }}>
            <span className="td-over ax-kicker ax-rise">Competitivo · códigos oficiales Riot</span>
            <h1 className="ax-h1 ax-rise" style={stagger(1)}>Torneos <em>ATAK</em></h1>
            <p className="ax-lede ax-rise" style={stagger(2)}>
              La escena competitiva de Querétaro. Brackets automáticos, resultados que se
              detectan solos y stats en vivo de cada partida.
            </p>
          </div>
          <div className="ax-head-side ax-rise" style={stagger(2)}>
            <div className="ax-counters" aria-label="Resumen de torneos">
              <div className="ax-counter" data-tone="live"><b>{counts.active}</b><span className="td-over">En vivo</span></div>
              <div className="ax-counter" data-tone="open"><b>{counts.registration + counts.checkin}</b><span className="td-over">Abiertos</span></div>
              <div className="ax-counter"><b>{counts.complete}</b><span className="td-over">Finalizados</span></div>
            </div>
            <Button variant="primary" icon={<Plus size={16} />} onClick={startCreate}>Crear torneo</Button>
          </div>
        </header>

        {showFeatured && (
          <FeatureCard t={featured} onOpen={() => navigate(`/tournaments/${featured.id}`)} onRegister={onRegister} />
        )}

        {/* Torneos diarios programados (auto-creados por el backend) */}
        <DailyTournamentsRail />

        {/* Filtros + búsqueda */}
        {showToolbar && (
          <div className="ax-toolbar">
            <FilterPills<FilterKey>
              ariaLabel="Filtrar por fase"
              items={FILTERS.map((f) => ({ ...f, count: counts[f.key] }))}
              value={filter} onChange={setFilter}
            />
            <label className="td-search-wrap">
              <Search size={16} aria-hidden />
              <input
                className="td-search" value={q} onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar torneo…" aria-label="Buscar torneo"
              />
              {q && (
                <button type="button" className="td-search-clear" aria-label="Limpiar búsqueda" onClick={() => setQ('')}>
                  <X size={13} />
                </button>
              )}
            </label>
          </div>
        )}

        {/* Lista */}
        {loading ? (
          <div className="ax-list">{Array.from({ length: 4 }).map((_, i) => <RowSkeleton key={i} />)}</div>
        ) : filtered.length > 0 ? (
          <div className="ax-list">
            {filtered.map((t, i) => (
              <TournamentRow key={t.id} t={t} index={i}
                onOpen={() => navigate(`/tournaments/${t.id}`)} onRegister={onRegister} />
            ))}
          </div>
        ) : browsing ? (
          <div className="ax-empty">
            <Search size={28} color="var(--td-muted)" aria-hidden />
            <h3>{q.trim() ? `Nada coincide con «${q.trim()}»` : 'No hay torneos en esta fase'}</h3>
            <p style={{ margin: '0 0 16px', fontSize: 14 }}>Prueba con otra fase o revisa la cartelera completa.</p>
            <Button variant="secondary" onClick={() => { setFilter('todos'); setQ(''); }}>Ver todos los torneos</Button>
          </div>
        ) : (
          // Sin más torneos que el destacado (o ninguno): el hueco es una invitación.
          <div className="ax-empty" style={{ marginTop: showToolbar ? 0 : 40 }}>
            <Trophy size={28} color="var(--td-gold)" aria-hidden />
            <h3>{tournaments.length ? '¿Organizas el siguiente?' : 'Todavía no hay torneos'}</h3>
            <p style={{ margin: '0 auto 16px', fontSize: 14, maxWidth: '46ch' }}>
              Arma tu torneo en minutos: Grieta, ARAM o Arena, de 1v1 a 5v5, con bracket automático.
            </p>
            <Button variant="primary" icon={<Plus size={16} />} onClick={startCreate}>Crear torneo</Button>
          </div>
        )}
      </div>

      {/* Modals */}
      {selectedTournament && (
        <TournamentRegisterModal
          tournamentId={selectedTournament.id}
          tournamentName={selectedTournament.name}
          teamSize={selectedTournament.teamSize}
          open={registerOpen}
          onOpenChange={setRegisterOpen}
          onRegistered={refetchTournaments}
        />
      )}
      <TournamentCreateModal
        open={createOpen}
        onOpenChange={closeCreate}
        onCreated={refetchTournaments}
      />
    </div>
  );
}
