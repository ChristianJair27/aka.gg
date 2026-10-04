// ATAK.GG — Dashboard de torneo: migas, aviso de broadcast y héroe.

import { ReactNode, useMemo } from 'react';
import { ShareTournamentButton } from '@/components/tournament/ShareTournamentCard';
import { useQuery } from '@tanstack/react-query';
import { axiosInstance } from '@/lib/axios';
import { Zap, ArrowRight, Radio } from 'lucide-react';
import { Button, StatusChip, ProgressBar, TeamBadge } from '@/components/tournament/ui';
import type { TdBoardPayload } from '@/hooks/queries/tournaments';
import { Tip } from '@/components/ui/Tip';
import { RED, CountUp, NAV_ITEMS, joinDates, useCountdown, type Tab } from './shared';

export function Breadcrumbs({ name, tab, onHome }: { name: string; tab: Tab; onHome: () => void }) {
  const current = NAV_ITEMS.find((i) => i.key === tab);
  return (
    <nav className="td-crumbs" aria-label="Ruta">
      <button type="button" onClick={onHome} className="td-crumb-link">Torneos</button>
      <span className="td-crumb-sep" aria-hidden>/</span>
      <span className={tab === 'resumen' ? 'td-crumb-current' : 'td-crumb-link-static'}>{name}</span>
      {tab !== 'resumen' && current && (
        <>
          <span className="td-crumb-sep" aria-hidden>/</span>
          <span className="td-crumb-current">{current.label}</span>
        </>
      )}
    </nav>
  );
}

// Si el Spectator Companion está transmitiendo en el canal de este torneo
// (canal = id del torneo), aparece el acceso directo al broadcast en vivo.
// Chequeo ligero cada 30s; si no hay transmisión no se renderiza nada.
export function BroadcastBanner({ channel, navigate }: { channel: string; navigate: (to: string) => void }) {
  const feedQ = useQuery({
    queryKey: ['broadcast-check', channel],
    enabled: !!channel,
    refetchInterval: 30_000,
    retry: false,
    queryFn: async () => {
      const { data, status } = await axiosInstance.get(`/api/live-feed/${channel}`, {
        validateStatus: (s) => s < 500,
      });
      return status === 200 && data?.ok
        ? { label: String(data.matchLabel || ''), hasVideo: Boolean(data.streamUrl) }
        : null;
    },
  });
  const feed = feedQ.data;
  if (!feed) return null;
  return (
    <button
      onClick={() => navigate(`/broadcast/${channel}`)}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, width: '100%', margin: '14px 0 0',
        padding: '13px 18px', borderRadius: 'var(--td-r-panel)', border: '1px solid rgba(232,50,60,0.45)',
        background: 'linear-gradient(90deg, rgba(232,50,60,0.18), rgba(232,50,60,0.05))',
        color: 'var(--td-text)', cursor: 'pointer', textAlign: 'left',
      }}
    >
      <span className="td-dot-pulse" style={{ width: 9, height: 9, borderRadius: '50%', background: RED, flexShrink: 0 }} />
      <span className="td-num" style={{ fontWeight: 700, fontSize: 14, letterSpacing: 1, color: 'var(--td-red-hover)', flexShrink: 0, textTransform: 'uppercase' }}>
        <Radio size={14} aria-hidden style={{ marginRight: 6 }} />Transmisión en vivo
      </span>
      <span style={{ fontSize: 14, color: 'var(--td-text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {feed.label || 'Partida del torneo en curso'}{feed.hasVideo ? ' · con video' : ''}
      </span>
      <span className="td-num" style={{ marginLeft: 'auto', fontSize: 13.5, fontWeight: 700, color: 'var(--td-text)', flexShrink: 0 }}>
        Ver broadcast →
      </span>
    </button>
  );
}

// ── HERO ─────────────────────────────────────────────────────────────────────
// Cartel del torneo: título enorme en la display condensada, contexto de la
// competición y, pegado abajo, el marcador con los datos clave (antes eran
// cuatro tarjetas sueltas debajo). El arte de fondo son los escudos de los
// equipos inscritos: dato real, no una ilustración genérica.

type BugCell = { label: string; value: ReactNode; accent?: 'gold' | 'red' };

export function Hero({ data, onBracket, onRegister }: {
  data: TdBoardPayload; onBracket: () => void; onRegister: () => void;
}) {
  const t = data.tournament;
  const words = t.name.trim().split(/\s+/);
  const lead = words.slice(0, -1).join(' ');
  const tail = words[words.length - 1];

  const meta = [
    t.season,
    joinDates(t.startDate, t.endDate),
    t.format,
    t.region ? t.region.toUpperCase() : null,
  ].filter(Boolean) as string[];

  const statusKind = t.status === 'live' ? 'live' : t.status === 'registration' ? 'registration' : 'finished';
  const statusLabel = t.status === 'live' ? 'En vivo' : t.status === 'registration' ? 'Inscripciones abiertas' : 'Finalizado';
  const regPct = t.teamsMax > 0 ? (t.teamsRegistered / t.teamsMax) * 100 : 0;

  // Con el torneo en marcha, "19/32 equipos inscritos" es ruido: las
  // inscripciones cerraron hace semanas y el jugador quiere saber por dónde va
  // la competición. El cupo sigue visible como dato en el marcador de abajo.
  const inProgress = t.status === 'live' || t.phase === 'active' || t.phase === 'complete';
  const currentRound = useMemo(() => {
    const rounds = data.bracket ?? [];
    const open = rounds.filter((r) => r.matches.some((m) => m.matchStatus !== 'complete'));
    return (open[0] ?? rounds[rounds.length - 1])?.round ?? null;
  }, [data.bracket]);
  const activeSeries = useMemo(
    () => (data.bracket ?? []).reduce((acc, r) => acc + r.matches.filter((m) => m.matchStatus === 'active').length, 0),
    [data.bracket],
  );

  // Formato real (bracketType/series), no el texto libre de la descripción
  // (mostraba "5v5 Single Elimination" en un torneo suizo).
  const shape = t.bracketType === 'swiss' ? 'Suizo'
    : t.bracketType === 'round_robin' ? 'Liga'
    : t.bracketType === 'single_elim' ? 'Eliminación'
    : (t.format || '—');
  const bo = (t.seriesTo ?? 1) > 1 ? `BO${(t.seriesTo! * 2) - 1}` : null;
  const boFinal = bo && (t.finalSeriesTo ?? t.seriesTo)! > t.seriesTo! ? `final BO${(t.finalSeriesTo! * 2) - 1}` : null;

  const countdown = useCountdown(t.checkinDeadline);
  const crests = data.standings.slice(0, 15);

  const cells: BugCell[] = [
    { label: 'Equipos', value: <><CountUp to={t.teamsRegistered} /><small> / {t.teamsMax}</small></> },
    { label: 'Formato', value: <>{shape}{bo && <small> · {bo}{boFinal ? ` · ${boFinal}` : ''}</small>}</> },
  ];
  if (inProgress && currentRound != null) {
    cells.push({ label: 'Ronda', value: <>{currentRound}{t.swissRounds ? <small> de {t.swissRounds}</small> : null}</> });
  }
  if (t.patch) cells.push({ label: 'Parche', value: t.patch });
  cells.push({ label: 'Premio', value: t.prizePool || 'Por definir', accent: 'gold' });
  if (countdown) cells.push({ label: 'Check-in cierra en', value: countdown, accent: 'red' });

  return (
    <section className="ax-hero ax-rise" aria-label={`Torneo ${t.name}`}>
      <div className="ax-hero-art" aria-hidden>
        {t.bannerUrl ? (
          <div className="ax-hero-banner" style={{ backgroundImage: `url(${t.bannerUrl})` }} />
        ) : (
          <>
            <div className="ax-hero-slab" />
            <div className="ax-hero-hatch" />
            {crests.length >= 5 && (
              <div className="ax-crests">
                {crests.map((s) => <TeamBadge key={s.teamId} name={s.name} color={s.color} mono={s.mono} size={64} />)}
              </div>
            )}
          </>
        )}
        <div className="ax-sweep" />
      </div>

      <div className="ax-hero-body">
        <div className="ax-hero-main">
          <div className="ax-eyebrow">
            <StatusChip kind={statusKind}>{statusLabel}</StatusChip>
            {t.fearless && (
              <Tip label="Fearless: un campeón que tu equipo ya jugó queda bloqueado para tu equipo">
                <span style={{ display: 'inline-flex' }}><StatusChip kind="gold" dot={false}>Fearless</StatusChip></span>
              </Tip>
            )}
            <span className="td-over">Torneo oficial · Riot Games</span>
          </div>

          <h1 className="ax-title">{lead && `${lead} `}<em>{tail}</em></h1>

          {meta.length > 0 && (
            <p className="ax-meta">
              {meta.map((m, i) => <span key={i}>{i > 0 && <i aria-hidden>/</i>}{m}</span>)}
            </p>
          )}

          {/* En marcha: contexto de la competición. Antes de empezar: cupo. */}
          {inProgress ? (
            activeSeries > 0 && (
              <div className="ax-context">
                <span className="td-dot-pulse" aria-hidden style={{ width: 8, height: 8, borderRadius: '50%', background: RED }} />
                {activeSeries} {activeSeries === 1 ? 'serie en juego ahora' : 'series en juego ahora'}
              </div>
            )
          ) : (
            <div style={{ marginTop: 20, maxWidth: 420 }}>
              <div className="td-over" style={{ marginBottom: 7, display: 'flex', justifyContent: 'space-between' }}>
                <span>Cupo</span><span>{Math.round(regPct)}%</span>
              </div>
              <ProgressBar kind="red" pct={regPct} height={6} />
            </div>
          )}
        </div>

        <div className="ax-hero-actions">
          {/* Con registro externo (formulario de la liga) el botón manda ahí;
              sin él, abre el modal de inscripción AQUÍ mismo. */}
          {t.status === 'registration' && (
            <Button variant="primary" icon={<Zap size={15} />} full
              onClick={() => t.registrationUrl
                ? window.open(t.registrationUrl, '_blank', 'noopener')
                : onRegister()}>
              Inscribir equipo
            </Button>
          )}
          <Button variant={t.status === 'registration' ? 'secondary' : 'primary'} icon={<ArrowRight size={15} />} full onClick={onBracket}>
            Ver bracket
          </Button>
          {/* Póster 1080x1350 para Instagram. Cada cartel compartido con la
              marca es adquisición: es la vía de crecimiento, no los anuncios. */}
          <ShareTournamentButton
            data={{
              id: t.id,
              name: t.name,
              format: [t.format, (t.seriesTo ?? 1) > 1 ? `Bo${(t.seriesTo! * 2) - 1}` : null]
                .filter(Boolean).join(' · '),
              startDate: t.startDate,
              prize: t.prizePool,
              teamsRegistered: t.teamsRegistered,
              teamsMax: t.teamsMax,
              status: t.status,
              region: t.region,
              logoUrl: t.logoUrl,
            }}
          />
        </div>
      </div>

      <dl className="ax-bug" style={{ ['--cols' as string]: cells.length, margin: 0 }}>
        {cells.map((c) => (
          <div key={c.label} className="ax-bug-cell" data-accent={c.accent}>
            <dt className="td-over">{c.label}</dt>
            <dd className="ax-bug-value" style={{ marginLeft: 0 }}>{c.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
