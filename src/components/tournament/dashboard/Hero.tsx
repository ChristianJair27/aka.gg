// ATAK.GG — Dashboard de torneo (extraído del componente único original).
// Sin cambios de comportamiento.

import { useEffect, useMemo, useState } from 'react';
import { ShareTournamentButton } from '@/components/tournament/ShareTournamentCard';
import { useQuery } from '@tanstack/react-query';
import { axiosInstance } from '@/lib/axios';
import { Trophy, Users, Zap, Play, ArrowRight, Radio, Clock, Calendar, BarChart3 } from 'lucide-react';
import { Button, StatusChip, StatTile, ProgressBar } from '@/components/tournament/ui';
import type { TdBoardPayload } from '@/hooks/queries/tournaments';
import { Tip } from '@/components/ui/Tip';
import {
  BLUE, RED, Card, CountUp, NAV_ITEMS, joinDates, fmtDate, useCountdown, type Tab,
} from './shared';

export function Breadcrumbs({ name, tab, onHome }: { name: string; tab: Tab; onHome: () => void }) {
  const current = NAV_ITEMS.find((i) => i.key === tab);
  return (
    <nav className="td-crumbs" aria-label="Ruta">
      <button type="button" onClick={onHome} className="td-crumb-link">Torneos</button>
      <span className="td-crumb-sep" aria-hidden>›</span>
      <span className={tab === 'resumen' ? 'td-crumb-current' : 'td-crumb-link-static'}>{name}</span>
      {tab !== 'resumen' && current && (
        <>
          <span className="td-crumb-sep" aria-hidden>›</span>
          <span className="td-crumb-current">{current.label}</span>
        </>
      )}
    </nav>
  );
}

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
        padding: '13px 18px', borderRadius: 14, border: '1px solid rgba(232,50,60,0.4)',
        background: 'linear-gradient(90deg, rgba(232,50,60,0.16), rgba(232,50,60,0.05))',
        color: 'var(--td-text)', cursor: 'pointer', textAlign: 'left',
      }}
    >
      <span className="td-dot-pulse" style={{ width: 9, height: 9, borderRadius: '50%', background: RED, boxShadow: `0 0 12px ${RED}`, flexShrink: 0 }} />
      <span style={{ fontWeight: 800, fontSize: 14, letterSpacing: 0.4, color: RED, flexShrink: 0 }}>
        <Radio size={14} aria-hidden style={{ marginRight: 6 }} />TRANSMISIÓN EN VIVO
      </span>
      <span style={{ fontSize: 13.5, color: 'var(--td-text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {feed.label || 'Partida del torneo en curso'}{feed.hasVideo ? ' · con video' : ''}
      </span>
      <span style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 700, color: 'var(--td-text)', flexShrink: 0 }}>
        Ver broadcast →
      </span>
    </button>
  );
}

// ── ERROR CARD ───────────────────────────────────────────────────────────────

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
    t.patch ? `Parche ${t.patch}` : null,
  ].filter(Boolean).join('  ·  ');

  const statusKind = t.status === 'live' ? 'live' : t.status === 'registration' ? 'registration' : 'finished';
  const statusLabel = t.status === 'live' ? 'EN DIRECTO' : t.status === 'registration' ? 'INSCRIPCIONES ABIERTAS' : 'FINALIZADO';
  const regPct = t.teamsMax > 0 ? (t.teamsRegistered / t.teamsMax) * 100 : 0;

  // Con el torneo en marcha, "19/32 equipos inscritos" es ruido: las
  // inscripciones cerraron hace semanas y el jugador quiere saber por dónde va
  // la competición. El cupo sigue visible como dato en los tiles de abajo.
  const inProgress = t.status === 'live' || t.phase === 'active' || t.phase === 'complete';
  const currentRound = useMemo(() => {
    const rounds = data.bracket ?? [];
    const open = rounds.filter((r) => r.matches.some((m) => m.matchStatus !== 'complete'));
    return (open[0] ?? rounds[rounds.length - 1])?.round ?? null;
  }, [data.bracket]);
  const liveContext = useMemo(() => {
    const parts: string[] = [];
    if (currentRound != null) {
      parts.push(t.swissRounds ? `Ronda ${currentRound} de ${t.swissRounds}` : `Ronda ${currentRound}`);
    }
    const shape = t.bracketType === 'swiss' ? 'Suizo'
      : t.bracketType === 'round_robin' ? 'Liga'
      : t.bracketType === 'single_elim' ? 'Eliminación' : null;
    const bo = (t.seriesTo ?? 1) > 1 ? `Bo${(t.seriesTo! * 2) - 1}` : null;
    const fmt = [shape, bo].filter(Boolean).join(' ');
    if (fmt) parts.push(fmt);
    return parts.join('  ·  ');
  }, [currentRound, t.swissRounds, t.bracketType, t.seriesTo]);
  const activeSeries = useMemo(
    () => (data.bracket ?? []).reduce((acc, r) => acc + r.matches.filter((m) => m.matchStatus === 'active').length, 0),
    [data.bracket],
  );

  return (
    <Card style={{ position: 'relative', overflow: 'hidden', padding: 0 }}>
      {/* Fondo: banner del torneo (si hay) fundido a la izquierda + glow */}
      <div
        aria-hidden
        style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: t.bannerUrl
            ? `linear-gradient(90deg, var(--td-card) 34%, rgba(16,16,20,0.72) 62%, rgba(16,16,20,0.35)), url(${t.bannerUrl}) right center/cover no-repeat`
            : 'radial-gradient(110% 140% at 100% 0%, rgba(232,50,60,0.12), transparent 52%)',
        }}
      />
      {/* Filo inferior: el motivo blade de la marca */}
      <div aria-hidden style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, height: 1,
        background: 'linear-gradient(90deg, transparent, rgba(232,50,60,0.6) 30%, rgba(200,170,110,0.5) 70%, transparent)',
      }} />

      <div className="td-dash-hero" style={{ position: 'relative', padding: 'clamp(20px, 3.5vw, 32px)' }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          {/* Eyebrow: texto plano con punto vivo — sin caja */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span className="td-dot-pulse" style={{ width: 6, height: 6, borderRadius: '50%', background: RED, flexShrink: 0 }} />
            <span className="td-over" style={{ color: 'var(--td-text-2)', letterSpacing: '2.6px' }}>
              TORNEO OFICIAL · RIOT GAMES
            </span>
            <StatusChip kind={statusKind}>{statusLabel}</StatusChip>
            {t.fearless && <StatusChip kind="warn" dot={false}>FEARLESS</StatusChip>}
          </div>

          {/* Título en la display de la marca (Friz Quadrata) */}
          <h1 style={{
            fontFamily: 'var(--font-display, inherit)',
            fontSize: 'clamp(30px, 5.2vw, 46px)', fontWeight: 700, lineHeight: 1.04,
            letterSpacing: '0.5px', margin: '14px 0 8px', color: 'var(--td-text)',
          }}>
            {lead && `${lead} `}<span className="td-italic" style={{ color: RED }}>{tail}</span>
          </h1>

          {meta && (
            <p className="td-num" style={{ color: 'var(--td-muted)', fontSize: 12, letterSpacing: '0.4px', margin: 0 }}>
              {meta}
            </p>
          )}

          {/* En marcha: contexto de la competición. Antes de empezar: cupo. */}
          {inProgress ? (
            <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              {activeSeries > 0 && (
                <StatusChip kind="live">{activeSeries} {activeSeries === 1 ? 'SERIE EN JUEGO' : 'SERIES EN JUEGO'}</StatusChip>
              )}
              {liveContext && (
                <span className="td-num" style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--td-text-2)', letterSpacing: '0.3px' }}>
                  {liveContext}
                </span>
              )}
            </div>
          ) : (
            <div style={{ marginTop: 22, maxWidth: 440 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 7 }}>
                <span className="td-num" style={{ fontSize: 26, fontWeight: 700, color: 'var(--td-text)' }}>
                  <CountUp to={t.teamsRegistered} />
                  <span style={{ color: 'var(--td-muted)', fontWeight: 500 }}> / {t.teamsMax}</span>
                </span>
                <span className="td-over" style={{ letterSpacing: '2px' }}>EQUIPOS INSCRITOS</span>
              </div>
              <ProgressBar kind="red" pct={regPct} height={5} />
            </div>
          )}
        </div>

        {/* Derecha: premio + CTAs como panel propio */}
        <div className="td-dash-hero-right td-sub" style={{
          display: 'flex', flexDirection: 'column', gap: 12, minWidth: 236, padding: 18, alignSelf: 'stretch',
          justifyContent: 'center',
        }}>
          <div>
            <div className="td-over" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Trophy size={11} color="#c8aa6e" /> BOLSA DE PREMIOS
            </div>
            <div className="td-num" style={{ fontSize: 30, fontWeight: 700, color: '#fff', lineHeight: 1.1, marginTop: 5 }}>
              {t.prizePool || '—'}
            </div>
          </div>
          {/* Con registro externo (formulario de la liga) el botón manda ahí;
              sin él, abre el modal de inscripción AQUÍ mismo. */}
          {t.status === 'registration' && (
            <Button variant="primary" icon={<Zap size={15} />} full
              onClick={() => t.registrationUrl
                ? window.open(t.registrationUrl, '_blank', 'noopener')
                : onRegister()}>
              INSCRIBIR EQUIPO
            </Button>
          )}
          <Button variant="secondary" icon={<ArrowRight size={15} />} full onClick={onBracket}>
            VER BRACKET
          </Button>
          {/* Póster 1080x1350 para Instagram. Cada cartel compartido con la
              marca es adquisición: es la vía de crecimiento, no los anuncios. */}
          <ShareTournamentButton
            data={{
              id: t.id,
              name: t.name,
              format: [t.format, (t.seriesTo ?? 1) > 1 ? `Bo${(t.seriesTo! * 2) - 1}` : null]
                .filter(Boolean).join(' \u00b7 '),
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
    </Card>
  );
}

export function Tiles({ t }: { t: TdBoardPayload['tournament'] }) {
  const countdown = useCountdown(t.checkinDeadline);
  // El tile refleja la configuración REAL (bracketType/series), no el texto libre
  // de la descripción (mostraba "5v5 Single Elimination" en un torneo suizo).
  const fmt = t.bracketType === 'swiss' ? 'Suizo'
    : t.bracketType === 'round_robin' ? 'Round Robin'
    : t.bracketType === 'single_elim' ? 'Eliminación'
    : (t.format || '—');
  const series = (t.seriesTo ?? 1) > 1
    ? ` · BO${(t.seriesTo! * 2) - 1}${(t.finalSeriesTo ?? t.seriesTo)! > t.seriesTo! ? ` (F: BO${(t.finalSeriesTo! * 2) - 1})` : ''}`
    : '';
  return (
    <div className="td-dash-tiles" style={{ marginTop: 18 }}>
      <StatTile value={`${t.teamsRegistered} / ${t.teamsMax}`} label="Equipos" icon={<Users size={15} color="var(--td-text-2)" />} />
      <StatTile value={`${fmt}${series}`} label="Formato" color={BLUE} icon={<Zap size={15} color={BLUE} />} />
      <StatTile value={t.patch || '—'} label="Parche" color="var(--td-green)" icon={<BarChart3 size={15} color="var(--td-green)" />} />
      <StatTile value={countdown ?? '—'} label="Check-in" color={RED} icon={<Clock size={15} color={RED} />} accentBorder />
    </div>
  );
}

// ── RESUMEN GRID ─────────────────────────────────────────────────────────────
