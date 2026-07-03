// src/pages/TournamentDashboardPage.tsx — Tournament DETAIL / dashboard view.
// Dark modern, red accent. Consumes useTournamentDashboard() and reuses the
// shared tournament/ui primitives (zero re-styled primitives). Router is wired
// externally; this file only renders the page for route `/tournaments/:id/...`.
import { CSSProperties, ReactNode, useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Trophy, Calendar, Clock, Users, Zap, Bell, Play, Check, ArrowRight, BarChart3,
} from 'lucide-react';
import {
  useTournamentDashboard, useCheckin, type TdBoardPayload,
} from '@/hooks/queries/tournaments';
import {
  Button, StatusChip, TeamBadge, StatTile, ProgressBar, FilterPills, SectionHead,
} from '@/components/tournament/ui';
import { Skeleton } from '@/components/ui/skeleton';
import '@/styles/tournament-dashboard.css';

// ── Helpers ──────────────────────────────────────────────────────────────────
const RED = 'var(--td-red)';
const BLUE = 'var(--td-live)';

/** CommunityDragon champion icon by numeric championId (payload only gives ids). */
const champIcon = (id: number) =>
  `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-icons/${id}.png`;

const pad = (n: number) => String(n).padStart(2, '0');

/** Live HH:MM:SS countdown to an ISO deadline; null when absent/passed. */
function useCountdown(target?: string | null): string | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!target) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [target]);
  if (!target) return null;
  const ms = new Date(target).getTime() - now;
  if (Number.isNaN(ms) || ms <= 0) return null;
  const total = Math.floor(ms / 1000);
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
}

const fmtDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }) : null;
const fmtTime = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : null;

// ── Small local layout helper (uses tokens; not a primitive) ─────────────────
function Card({ children, accent, style }: { children: ReactNode; accent?: string; style?: CSSProperties }) {
  return (
    <div
      className="td-card-in"
      style={{
        background: 'var(--td-card)', border: `1px solid ${accent ?? 'var(--td-border)'}`,
        borderRadius: 16, padding: 18, ...style,
      }}
    >
      {children}
    </div>
  );
}

type Tab = 'resumen' | 'bracket' | 'equipos' | 'partidas' | 'reglas';
const TABS: { key: Tab; label: string }[] = [
  { key: 'resumen', label: 'Resumen' }, { key: 'bracket', label: 'Bracket' },
  { key: 'equipos', label: 'Equipos' }, { key: 'partidas', label: 'Partidas' },
  { key: 'reglas', label: 'Reglas' },
];

// ── Page ─────────────────────────────────────────────────────────────────────
export default function TournamentDashboardPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const go = (to: string) => navigate(to);
  const [params, setParams] = useSearchParams();
  const { data, isLoading } = useTournamentDashboard(id);

  const tab = (params.get('tab') as Tab) || 'resumen';
  const setTab = (t: Tab) =>
    setParams((prev) => { const p = new URLSearchParams(prev); p.set('tab', t); return p; }, { replace: true });

  return (
    <div className="td-root">
      <ResponsiveStyles />
      <div className="td-dash" style={{ maxWidth: 1560, margin: '0 auto', padding: '80px 24px 64px' }}>
        {isLoading || !data ? (
          <DashboardSkeleton />
        ) : (
          <>
            <Hero data={data} onBracket={() => setTab('bracket')} navigate={go} id={id} />
            <Tiles t={data.tournament} />
            <div style={{ margin: '22px 0 18px' }}>
              <FilterPills<Tab> items={TABS} value={tab} onChange={setTab} />
            </div>
            {tab === 'resumen' && <ResumenGrid data={data} id={id} navigate={go} onBracket={() => setTab('bracket')} />}
            {tab === 'bracket' && <BracketTab data={data} />}
            {tab === 'equipos' && <EquiposTab data={data} />}
            {tab === 'partidas' && <PartidasTab data={data} />}
            {tab === 'reglas' && <ReglasTab data={data} />}
          </>
        )}
      </div>
    </div>
  );
}

// ── HERO ─────────────────────────────────────────────────────────────────────
function Hero({ data, onBracket, navigate, id }: {
  data: TdBoardPayload; onBracket: () => void; navigate: (to: string) => void; id: string;
}) {
  const t = data.tournament;
  const words = t.name.trim().split(/\s+/);
  const lead = words.slice(0, -1).join(' ');
  const tail = words[words.length - 1];

  const subtitle = [t.season, joinDates(t.startDate, t.endDate), t.format].filter(Boolean).join(' · ');
  const statusKind = t.status === 'live' ? 'live' : t.status === 'registration' ? 'registration' : 'finished';
  const statusLabel = t.status === 'live' ? 'EN DIRECTO' : t.status === 'registration' ? 'INSCRIPCIONES' : 'FINALIZADO';
  const regPct = t.teamsMax > 0 ? (t.teamsRegistered / t.teamsMax) * 100 : 0;

  return (
    <Card
      style={{
        position: 'relative', overflow: 'hidden', padding: 30,
        background:
          'radial-gradient(120% 120% at 100% 0%, rgba(232,50,60,0.14), rgba(232,50,60,0) 45%), var(--td-card)',
      }}
    >
      {/* decorative giant faded motif */}
      <Trophy
        aria-hidden
        style={{
          position: 'absolute', right: 24, top: -20, width: 260, height: 260,
          color: '#fff', opacity: 0.05, transform: 'rotate(12deg)', pointerEvents: 'none',
        }}
      />
      <div className="td-dash-hero" style={{ position: 'relative' }}>
        <div style={{ minWidth: 0 }}>
          {/* pill badge */}
          <span
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7, height: 24, padding: '0 12px',
              borderRadius: 999, border: '1px solid var(--td-red-glow)', background: 'rgba(232,50,60,0.08)',
            }}
          >
            <span className="td-dot-pulse" style={{ width: 5, height: 5, borderRadius: '50%', background: RED }} />
            <Trophy size={12} color={RED} />
            <span className="td-over" style={{ color: RED, letterSpacing: '2px' }}>TORNEO OFICIAL · RIOT GAMES</span>
          </span>

          <h1 style={{ fontSize: 38, fontWeight: 700, lineHeight: 1.08, margin: '14px 0 6px', color: 'var(--td-text)' }}>
            {lead && `${lead} `}<span className="td-italic" style={{ color: RED }}>{tail}</span>
          </h1>
          {subtitle && <p style={{ color: 'var(--td-text-2)', fontSize: 14, margin: 0 }}>{subtitle}</p>}

          {/* chips */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
            <StatusChip kind={statusKind}>{statusLabel}</StatusChip>
            {t.phase && <StatusChip kind="dim" dot={false}>{t.phase.toUpperCase()}</StatusChip>}
            {t.region && <StatusChip kind="dim" dot={false}>{t.region.toUpperCase()}</StatusChip>}
          </div>

          {/* registration bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 18, maxWidth: 460 }}>
            <Users size={15} color="var(--td-text-2)" />
            <div style={{ flex: 1 }}>
              <ProgressBar kind="red" pct={regPct} />
            </div>
            <span className="td-num" style={{ fontSize: 12.5, color: 'var(--td-text)', whiteSpace: 'nowrap' }}>
              {t.teamsRegistered}/{t.teamsMax} equipos inscritos
            </span>
          </div>
        </div>

        {/* right: prize + CTAs */}
        <div className="td-dash-hero-right" style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 220 }}>
          <div>
            <div className="td-over">BOLSA DE PREMIOS</div>
            <div className="td-num" style={{ fontSize: 36, fontWeight: 700, color: '#fff', lineHeight: 1.1, marginTop: 4 }}>
              {t.prizePool || '—'}
            </div>
          </div>
          <Button variant="primary" icon={<Zap size={15} />} full onClick={() => navigate(`/tournaments/${id}`)}>
            INSCRIBIR EQUIPO
          </Button>
          <Button variant="secondary" icon={<ArrowRight size={15} />} full onClick={onBracket}>
            VER BRACKET
          </Button>
        </div>
      </div>
    </Card>
  );
}

function joinDates(start?: string | null, end?: string | null): string | null {
  const s = fmtDate(start);
  const e = fmtDate(end);
  if (s && e) return `${s} – ${e}`;
  return s || null;
}

// ── TILES ────────────────────────────────────────────────────────────────────
function Tiles({ t }: { t: TdBoardPayload['tournament'] }) {
  const countdown = useCountdown(t.checkinDeadline);
  return (
    <div className="td-dash-tiles" style={{ marginTop: 18 }}>
      <StatTile value={`${t.teamsRegistered} / ${t.teamsMax}`} label="Equipos" icon={<Users size={15} color="var(--td-text-2)" />} />
      <StatTile value={t.format || '—'} label="Formato" color={BLUE} icon={<Zap size={15} color={BLUE} />} />
      <StatTile value={t.patch || '—'} label="Parche" color="var(--td-green)" icon={<BarChart3 size={15} color="var(--td-green)" />} />
      <StatTile value={countdown ?? '—'} label="Check-in" color={RED} icon={<Clock size={15} color={RED} />} accentBorder />
    </div>
  );
}

// ── RESUMEN GRID ─────────────────────────────────────────────────────────────
function ResumenGrid({ data, id, navigate, onBracket }: {
  data: TdBoardPayload; id: string; navigate: (to: string) => void; onBracket: () => void;
}) {
  return (
    <div className="td-dash-grid">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
        <BracketCard data={data} onBracket={onBracket} summary />
        <StandingsCard data={data} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
        <LiveCard data={data} navigate={navigate} id={id} />
        {data.myTeam && <MyTeamCard data={data} id={id} />}
        <ScheduleCard data={data} />
      </div>
    </div>
  );
}

// ── BRACKET ──────────────────────────────────────────────────────────────────
function MatchCard({ match, isFinal, prize }: {
  match: TdBoardPayload['bracket'][number]['matches'][number]; isFinal?: boolean; prize?: string | null;
}) {
  const row = (team: typeof match.teamA) => {
    const isWinner = !!team && !!match.winnerId && team.id === match.winnerId;
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <TeamBadge name={team?.name} color={team?.color} mono={team?.mono} size={22} />
        <span
          style={{
            flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            fontSize: 12.5, fontWeight: isWinner ? 700 : 500,
            color: !team ? 'var(--td-muted)' : isWinner ? '#fff' : 'var(--td-text-2)',
          }}
        >
          {team?.name ?? 'TBD'}
        </span>
        <span
          className="td-num"
          style={{ fontSize: 13, fontWeight: isWinner ? 700 : 500, color: isWinner ? RED : 'var(--td-muted)' }}
        >
          {team?.score ?? '–'}
        </span>
      </div>
    );
  };
  return (
    <div
      style={{
        display: 'flex', flexDirection: 'column', gap: 8, width: 180, borderRadius: 10, padding: '10px 12px',
        background: isFinal ? 'linear-gradient(180deg, rgba(232,50,60,0.10), rgba(232,50,60,0.02))' : 'var(--td-subcard)',
        border: `1px solid ${isFinal ? 'var(--td-red-glow)' : 'var(--td-border)'}`,
      }}
    >
      {isFinal && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 2 }}>
          <Trophy size={12} color={RED} />
          {prize && <span className="td-num" style={{ fontSize: 11, fontWeight: 700, color: RED }}>{prize}</span>}
        </div>
      )}
      {row(match.teamA)}
      {row(match.teamB)}
    </div>
  );
}

function BracketColumns({ rounds, prize }: {
  rounds: TdBoardPayload['bracket']; prize?: string | null;
}) {
  if (!rounds.length) return <EmptyState>Bracket aún no generado</EmptyState>;
  const lastRound = rounds[rounds.length - 1]?.round;
  return (
    <div className="td-dash-bracket" style={{ display: 'flex', gap: 20, paddingBottom: 4 }}>
      {rounds.map((r) => (
        <div key={r.round} style={{ display: 'flex', flexDirection: 'column', gap: 12, flexShrink: 0 }}>
          <div className="td-over" style={{ textAlign: 'center' }}>{r.label}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, justifyContent: 'center', flex: 1 }}>
            {r.matches.map((m) => {
              const isFinal = r.round === lastRound && r.matches.length === 1;
              return <MatchCard key={m.id} match={m} isFinal={isFinal} prize={prize} />;
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function BracketCard({ data, onBracket, summary }: {
  data: TdBoardPayload; onBracket: () => void; summary?: boolean;
}) {
  const t = data.tournament;
  const rounds = summary ? data.bracket.slice(-3) : data.bracket;
  return (
    <Card>
      <SectionHead
        icon={<Trophy size={14} color={RED} />}
        title="BRACKET · ELIMINATORIAS"
        right={<Button variant="ghost" onClick={onBracket}>VER BRACKET</Button>}
      />
      <BracketColumns rounds={rounds} prize={t.prizeFinal || t.prizePool} />
    </Card>
  );
}

// ── STANDINGS ────────────────────────────────────────────────────────────────
const STANDINGS_COLS = '34px 1fr 90px 160px 110px 60px';
function StandingsCard({ data }: { data: TdBoardPayload }) {
  const rows = data.standings;
  return (
    <Card>
      <SectionHead icon={<BarChart3 size={14} color={BLUE} />} title="CLASIFICACIÓN" />
      {!rows.length ? (
        <EmptyState>Sin clasificación todavía</EmptyState>
      ) : (
        <div>
          <div
            className="td-over"
            style={{ display: 'grid', gridTemplateColumns: STANDINGS_COLS, gap: 10, alignItems: 'center', padding: '0 8px 8px' }}
          >
            <span>#</span><span>Equipo</span><span>W-L</span><span>WR</span><span>Racha</span>
            <span style={{ textAlign: 'right' }}>Pts</span>
          </div>
          {rows.map((s) => (
            <div
              key={s.teamId}
              style={{
                display: 'grid', gridTemplateColumns: STANDINGS_COLS, gap: 10, alignItems: 'center',
                padding: '9px 8px', borderRadius: 8, transition: 'background .15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              <span className="td-num" style={{ fontSize: 13, fontWeight: 700, color: s.position === 1 ? RED : 'var(--td-text-2)' }}>
                {s.position}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <TeamBadge name={s.name} color={s.color} mono={s.mono} size={22} />
                <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--td-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {s.name}
                </span>
              </div>
              <span className="td-num" style={{ fontSize: 12.5, color: 'var(--td-text-2)' }}>{s.wins}-{s.losses}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1 }}><ProgressBar kind="wr" pct={s.winratePct} /></div>
                <span className="td-num" style={{ fontSize: 11.5, color: 'var(--td-text-2)', width: 34 }}>{Math.round(s.winratePct)}%</span>
              </div>
              {s.streak ? (
                <StatusChip kind={s.streak.type === 'W' ? 'pos' : 'warn'} dot={false}>
                  {s.streak.count}{s.streak.type}
                </StatusChip>
              ) : (
                <StatusChip kind="dim" dot={false}>—</StatusChip>
              )}
              <span className="td-num" style={{ fontSize: 13, fontWeight: 700, color: '#fff', textAlign: 'right' }}>{s.points}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// ── LIVE MATCH ───────────────────────────────────────────────────────────────
function ChampPortrait({ id, ring }: { id: number; ring: 'red' | 'gray' }) {
  return (
    <img
      src={champIcon(id)}
      alt=""
      loading="lazy"
      onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }}
      style={{
        width: 26, height: 26, borderRadius: 6, objectFit: 'cover', flexShrink: 0,
        boxShadow: `0 0 0 1.5px ${ring === 'red' ? RED : 'var(--td-border-hov)'}`,
        transition: 'transform .15s',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.25)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; }}
    />
  );
}

function GoldDiffBars({ series }: { series: number[] }) {
  const bars = series.slice(-12);
  const max = Math.max(1, ...bars.map((v) => Math.abs(v)));
  return (
    <div style={{ display: 'flex', alignItems: 'stretch', gap: 3, height: 44, padding: '4px 0' }}>
      {bars.map((v, i) => {
        const positive = v >= 0;
        const h = `${(Math.abs(v) / max) * 100}%`;
        const opacity = 0.35 + (i / Math.max(1, bars.length - 1)) * 0.65;
        const barStyle: CSSProperties = {
          position: 'absolute', left: 0, right: 0, height: `calc(${h} / 2)`,
          background: positive ? BLUE : RED, opacity, borderRadius: 2,
          ...(positive ? { bottom: '50%' } : { top: '50%' }),
        };
        return (
          <div key={i} style={{ position: 'relative', flex: 1, minWidth: 0 }}>
            <div style={barStyle} />
          </div>
        );
      })}
    </div>
  );
}

function LiveCard({ data, navigate, id }: { data: TdBoardPayload; navigate: (to: string) => void; id: string }) {
  const live = data.liveMatch;
  if (!live) return <NextMatchCard data={data} />;
  const timer = live.timer != null
    ? `${pad(Math.floor(live.timer / 60))}:${pad(live.timer % 60)}`
    : null;
  return (
    <Card accent="rgba(59,130,246,0.35)">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <span className="td-dot-pulse" style={{ width: 6, height: 6, borderRadius: '50%', background: BLUE }} />
        <span className="td-over" style={{ color: 'var(--td-live-text)', letterSpacing: '2px' }}>
          EN DIRECTO · MAPA {live.game}
        </span>
        {timer && <span className="td-num" style={{ marginLeft: 'auto', fontSize: 12.5, color: 'var(--td-live-text)' }}>{timer}</span>}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <TeamCol team={live.teamA} />
        <div className="td-num" style={{ fontSize: 32, fontWeight: 700, whiteSpace: 'nowrap' }}>
          <span style={{ color: '#fff' }}>{live.teamA.score ?? 0}</span>
          <span style={{ color: RED, margin: '0 8px' }}>–</span>
          <span style={{ color: '#fff' }}>{live.teamB.score ?? 0}</span>
        </div>
        <TeamCol team={live.teamB} />
      </div>

      {(live.teamA.picks?.length || live.teamB.picks?.length) ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 16 }}>
          {!!live.teamA.picks?.length && (
            <div style={{ display: 'flex', gap: 6 }}>
              {live.teamA.picks.map((c, i) => <ChampPortrait key={i} id={c} ring="red" />)}
            </div>
          )}
          {!!live.teamB.picks?.length && (
            <div style={{ display: 'flex', gap: 6 }}>
              {live.teamB.picks.map((c, i) => <ChampPortrait key={i} id={c} ring="gray" />)}
            </div>
          )}
        </div>
      ) : null}

      {live.goldDiffSeries?.length ? <GoldDiffBars series={live.goldDiffSeries} /> : null}

      <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
        <Button variant="primary" icon={<Play size={15} />} full onClick={() => navigate(`/tournaments/${id}/live`)}>ESPECTAR</Button>
        <Button variant="secondary" full onClick={() => navigate(`/tournaments/${id}/live`)}>VER STATS</Button>
      </div>
    </Card>
  );
}

function TeamCol({ team }: { team: NonNullable<TdBoardPayload['liveMatch']>['teamA'] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, textAlign: 'center', minWidth: 0, flex: 1 }}>
      <TeamBadge name={team.name} color={team.color} mono={team.mono} size={44} />
      <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--td-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
        {team.name}
      </span>
    </div>
  );
}

function NextMatchCard({ data }: { data: TdBoardPayload }) {
  const next = data.schedule[0];
  return (
    <Card accent="rgba(59,130,246,0.25)">
      <SectionHead icon={<Play size={14} color={BLUE} />} title="PRÓXIMA PARTIDA" />
      {!next ? (
        <EmptyState>No hay partidas en directo ni programadas</EmptyState>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <ScheduleTeams a={next.teamA} b={next.teamB} />
          <div style={{ textAlign: 'right' }}>
            <div className="td-num" style={{ fontSize: 15, fontWeight: 700, color: RED }}>{fmtTime(next.scheduledAt) ?? 'Por definir'}</div>
            <div className="td-over" style={{ marginTop: 2 }}>{next.roundLabel}</div>
          </div>
        </div>
      )}
    </Card>
  );
}

// ── MY TEAM ──────────────────────────────────────────────────────────────────
function MyTeamCard({ data, id }: { data: TdBoardPayload; id: string }) {
  const my = data.myTeam!;
  const countdown = useCountdown(my.checkinDeadline);
  const checkin = useCheckin(id);
  const disabled = my.checkedIn || checkin.isPending;

  const doCheckin = () => {
    // Dashboard payload only exposes the team tag; captainRiotId is resolved
    // server-side from the authenticated session. See report note.
    checkin.mutate(
      { teamName: my.tag, captainRiotId: '' },
      { onSuccess: () => toast.success('Check-in realizado') },
    );
  };

  return (
    <Card>
      <SectionHead
        icon={<Users size={14} color={RED} />}
        title={`MI EQUIPO · ${my.tag}`}
        right={
          my.checkedIn
            ? <StatusChip kind="pos" dot={false}>LISTO</StatusChip>
            : countdown
              ? <span className="td-num" style={{ fontSize: 12.5, color: 'var(--td-green)' }}>{countdown}</span>
              : null
        }
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {my.roster.length === 0 && <EmptyState>Roster vacío</EmptyState>}
        {my.roster.map((p, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {p.mainChampionId != null ? (
              <img
                src={champIcon(p.mainChampionId)} alt="" loading="lazy"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }}
                style={{ width: 28, height: 28, borderRadius: 7, objectFit: 'cover', flexShrink: 0 }}
              />
            ) : (
              <TeamBadge name={p.playerName} size={28} />
            )}
            <span
              style={{
                fontSize: 10, fontWeight: 700, color: RED, border: '1px solid var(--td-red-glow)',
                borderRadius: 999, padding: '2px 8px', minWidth: 42, textAlign: 'center', flexShrink: 0,
              }}
            >
              {p.role ? p.role.toUpperCase() : '—'}
            </span>
            <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 600, color: 'var(--td-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {p.playerName}
            </span>
            <span style={{ fontSize: 11.5, fontWeight: 600, color: p.rank?.color ?? 'var(--td-muted)', flexShrink: 0 }}>
              {p.rank ? `${p.rank.tier} ${p.rank.division}` : 'Sin rango'}
            </span>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 14 }}>
        <Button variant="primary" icon={<Check size={15} />} full disabled={disabled} onClick={doCheckin}>
          {my.checkedIn ? 'CHECK-IN COMPLETADO' : 'HACER CHECK-IN'}
        </Button>
      </div>
    </Card>
  );
}

// ── SCHEDULE ─────────────────────────────────────────────────────────────────
function ScheduleTeams({ a, b }: { a: TdBoardPayload['schedule'][number]['teamA']; b: TdBoardPayload['schedule'][number]['teamB'] }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
      <TeamBadge name={a?.name} color={a?.color} mono={a?.mono} size={22} />
      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--td-text-2)' }}>vs</span>
      <TeamBadge name={b?.name} color={b?.color} mono={b?.mono} size={22} />
    </div>
  );
}

function ScheduleCard({ data }: { data: TdBoardPayload }) {
  const [reminders, setReminders] = useState<Record<string, boolean>>(
    () => Object.fromEntries(data.schedule.map((s) => [s.matchId, s.reminded])),
  );
  const toggle = (mid: string) => setReminders((r) => ({ ...r, [mid]: !r[mid] }));

  const activity = data.activityByDay;
  const peak = useMemo(() => Math.max(0, ...activity.map((d) => d.games)), [activity]);
  const DAY_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

  return (
    <Card>
      <SectionHead icon={<Calendar size={14} color={BLUE} />} title="PRÓXIMAS PARTIDAS" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {data.schedule.length === 0 && <EmptyState>No hay partidas programadas</EmptyState>}
        {data.schedule.map((s) => {
          const active = !!reminders[s.matchId];
          return (
            <div key={s.matchId} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 4px' }}>
              <span className="td-num" style={{ fontSize: 12.5, fontWeight: 700, color: RED, width: 52, flexShrink: 0 }}>
                {fmtTime(s.scheduledAt) ?? 'S/D'}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <ScheduleTeams a={s.teamA} b={s.teamB} />
                <div className="td-over" style={{ marginTop: 3 }}>{s.roundLabel}</div>
              </div>
              <button
                onClick={() => toggle(s.matchId)}
                aria-pressed={active}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5, height: 26, padding: '0 10px', borderRadius: 999,
                  fontSize: 10.5, fontWeight: 700, cursor: 'pointer', flexShrink: 0,
                  color: active ? '#fff' : RED,
                  background: active ? RED : 'transparent',
                  border: `1px solid ${active ? RED : 'var(--td-red-glow)'}`,
                  transition: 'background .15s, color .15s',
                }}
              >
                <Bell size={12} />{active ? 'ACTIVO' : 'RECORDAR'}
              </button>
            </div>
          );
        })}
      </div>

      {activity.length > 0 && (
        <div style={{ marginTop: 16, borderTop: '1px solid var(--td-border)', paddingTop: 14 }}>
          <div className="td-over" style={{ marginBottom: 10 }}>PARTIDAS POR DÍA</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', height: 60 }}>
            {activity.slice(0, 7).map((d, i) => {
              const h = peak > 0 ? Math.max(6, (d.games / peak) * 48) : 6;
              const isPeak = d.games === peak && peak > 0;
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: '100%', height: h, borderRadius: 4, background: isPeak ? RED : 'var(--td-sunken)' }} />
                  <span className="td-over" style={{ fontSize: 8 }}>{DAY_LABELS[i] ?? d.day.slice(0, 1)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
}

// ── SECONDARY TABS ───────────────────────────────────────────────────────────
function BracketTab({ data }: { data: TdBoardPayload }) {
  return (
    <Card>
      <SectionHead icon={<Trophy size={14} color={RED} />} title="BRACKET COMPLETO" />
      <BracketColumns rounds={data.bracket} prize={data.tournament.prizeFinal || data.tournament.prizePool} />
    </Card>
  );
}

function EquiposTab({ data }: { data: TdBoardPayload }) {
  return <StandingsCard data={data} />;
}

function PartidasTab({ data }: { data: TdBoardPayload }) {
  return <ScheduleCard data={data} />;
}

function ReglasTab({ data }: { data: TdBoardPayload }) {
  const t = data.tournament;
  const lines = [
    `Formato: ${t.format || 'Por confirmar'}.`,
    `Parche de juego: ${t.patch || 'Por confirmar'}. Región: ${t.region || '—'}.`,
    'Todos los jugadores deben completar el check-in antes del cierre indicado; los equipos sin check-in serán descalificados.',
    'Los partidos se juegan con los códigos de torneo oficiales de Riot Games. La suplantación o el uso de cuentas no verificadas conlleva descalificación.',
    'Las decisiones de los administradores del torneo son definitivas.',
  ];
  return (
    <Card>
      <SectionHead icon={<BarChart3 size={14} color={RED} />} title="REGLAS DEL TORNEO" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {lines.map((l, i) => (
          <p key={i} style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: 'var(--td-text-2)' }}>{l}</p>
        ))}
      </div>
    </Card>
  );
}

// ── EMPTY STATE ──────────────────────────────────────────────────────────────
function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div style={{ padding: '20px 8px', textAlign: 'center', fontSize: 12.5, color: 'var(--td-muted)' }}>
      {children}
    </div>
  );
}

// ── SKELETON ─────────────────────────────────────────────────────────────────
function Block({ h, r = 14 }: { h: number; r?: number }) {
  return <Skeleton variant="block" height={h} style={{ borderRadius: r, background: 'var(--td-sunken)' }} />;
}
function DashboardSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <Block h={220} r={16} />
      <div className="td-dash-tiles">
        {Array.from({ length: 4 }).map((_, i) => <Block key={i} h={84} />)}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} variant="block" width={90} height={34} style={{ borderRadius: 999, background: 'var(--td-sunken)' }} />)}
      </div>
      <div className="td-dash-grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Block h={260} r={16} /><Block h={320} r={16} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Block h={280} r={16} /><Block h={240} r={16} /><Block h={260} r={16} />
        </div>
      </div>
    </div>
  );
}

// ── RESPONSIVE STYLES (scoped to .td-dash) ───────────────────────────────────
function ResponsiveStyles() {
  return (
    <style>{`
      .td-dash-hero { display: flex; gap: 28px; justify-content: space-between; align-items: flex-start; }
      .td-dash-tiles { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
      .td-dash-grid { display: grid; grid-template-columns: 1fr 470px; gap: 16px; align-items: start; }
      .td-dash-bracket { overflow-x: auto; }
      @media (max-width: 1100px) {
        .td-dash-grid { grid-template-columns: 1fr; }
        .td-dash-tiles { grid-template-columns: repeat(2, 1fr); }
      }
      @media (max-width: 720px) {
        .td-dash-hero { flex-direction: column; }
        .td-dash-hero-right { width: 100%; }
      }
    `}</style>
  );
}
