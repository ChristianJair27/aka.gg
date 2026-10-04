// src/pages/MatchDetailPage.tsx
// Detalle de una partida suelta: marcador de retransmisión + scoreboard + gráficos
// (<MatchStatsDetail/>, alimentado por /api/stats/match-stats), repetición 2D y
// lista de jugadores con enlace a su perfil. Sistema "Arena": el fondo es el
// splash del campeón del jugador enfocado (o del MVP del equipo ganador).
import { useMemo } from 'react';
import { useLocation, useParams, useNavigate, Link } from 'react-router-dom';
import { MatchStatsDetail } from '@/components/MatchStatsDetail';
import { ArrowLeft, AlertTriangle, ChevronRight, Users, Clock } from 'lucide-react';
import { KataLoaderOverlay } from '@/components/KataLoader';
import { useMatchStats } from '@/hooks/queries/stats';
import { useAiMatchTags, type AiMatchData } from '@/hooks/queries/ai';
import AiTags from '@/components/ai/AiTags';
import MatchReplay2D from '@/components/MatchReplay2D';
import { ArenaPage, SplashBackdrop, ChampIcon, RoleIcon, stagger } from '@/components/arena/primitives';
import { Button, SectionHead } from '@/components/tournament/ui';
import { LANE_LABELS, normalizeLane } from '@/lib/lolAssets';
import { dd, fmtDuration } from '@/lib/dataDragon';
import '@/styles/pages/match.css';

const QUEUE_NAMES: Record<number, string> = {
  400: 'Normal Draft', 420: 'Solo/Dúo', 430: 'Normal Blind', 440: 'Flex',
  450: 'ARAM', 700: 'Clash', 900: 'URF', 1700: 'Arena', 1900: 'URF',
};

// Build a profile href from a participant; needs a tagLine to resolve cleanly.
function profileHref(region: string, gameName?: string, tagLine?: string) {
  const g = (gameName || '').trim();
  const t = (tagLine || '').trim();
  if (!g || !t) return null;
  return `/profile/${region}/${encodeURIComponent(g)}-${encodeURIComponent(t)}`;
}

const mvpScore = (p: any) => (p.kills + p.assists - p.deaths);

export default function MatchDetailPage() {
  const { regional, matchId } = useParams<{ regional: string; matchId: string }>();
  const { state } = useLocation() as { state?: { puuid?: string; region?: string } };
  const navigate = useNavigate();
  const region = state?.region || 'la1';

  const { data: stats = null, isLoading: loading, error: queryError } = useMatchStats(regional, matchId);
  const error = queryError
    ? ((queryError as any)?.response?.data?.message || 'No se pudo cargar la partida')
    : null;

  const queueLabel = useMemo(() => {
    const qid = (stats as any)?.queueId;
    return QUEUE_NAMES[qid] || stats?.gameMode || 'Partida';
  }, [stats]);

  // Roster of clickable players (both teams), resolved from the stats payload.
  const roster = useMemo(() => {
    if (!stats) return [];
    return [...stats.blueTeam, ...stats.redTeam];
  }, [stats]);

  // Jugador enfocado: quien abrió la partida desde su historial (puuid en el
  // estado de la ruta). Los participantes traen puuid en runtime aunque el tipo
  // no lo declare.
  const me = useMemo<any | null>(() => {
    if (!state?.puuid) return null;
    return roster.find((p: any) => p.puuid === state.puuid) ?? null;
  }, [roster, state?.puuid]);

  // Arte de fondo: el campeón del jugador enfocado; si no hay, el MVP del
  // equipo ganador (o el primer jugador si la partida no tiene ganador).
  const heroChampion = useMemo<string | null>(() => {
    if (me) return me.championName;
    if (!stats) return null;
    const winners = stats.winner === 'red' ? stats.redTeam : stats.blueTeam;
    const mvp = [...winners].sort((a, b) => mvpScore(b) - mvpScore(a))[0];
    return mvp?.championName ?? roster[0]?.championName ?? null;
  }, [me, stats, roster]);

  // ── ATAK AI match tags ─────────────────────────────────────────────────────
  // Build the payload from the searched player's participant. The match detail is
  // opened with the player's `puuid` in route state, so we match on that (the
  // parsed participants carry puuid at runtime even though the type omits it).
  const matchData = useMemo<AiMatchData | null>(() => {
    if (!stats || !state?.puuid) return null;
    if (!me) return null;
    return {
      matchId: stats.matchId,
      win: me.win,
      kda: me.kda,
      cs: me.csPerMin,          // CS per minute — the normalized performance metric
      role: me.teamPosition,
      kills: me.kills,
      deaths: me.deaths,
      assists: me.assists,
      championName: me.championName,
    };
  }, [stats, me, state?.puuid]);

  const matchTagsQ = useAiMatchTags(matchData);
  const aiLoading = matchData ? matchTagsQ.isPending : loading;

  const playedOn = stats?.gameStartTimestamp
    ? new Date(stats.gameStartTimestamp).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : null;
  const meLane = me?.teamPosition ? normalizeLane(me.teamPosition) : 'fill';
  const meKda = me ? (me.deaths === 0 ? (me.kills + me.assists).toFixed(1) : ((me.kills + me.assists) / me.deaths).toFixed(2)) : null;

  const rosterItem = (p: any, i: number) => {
    const href = profileHref(region, p.summonerName, p.tagLine);
    const lane = p.teamPosition ? normalizeLane(p.teamPosition) : 'fill';
    const content = (
      <>
        <ChampIcon src={dd.champion(p.championName)} name={p.championName} size={36} />
        {lane !== 'fill' && <RoleIcon lane={p.teamPosition} size={16} />}
        <span className="mx-roster-name">
          {p.summonerName}{p.tagLine ? <small> #{p.tagLine}</small> : ''}
        </span>
        <span className="mx-roster-champ">{p.championName}</span>
        {href && <ChevronRight size={16} className="mx-roster-go" aria-hidden />}
      </>
    );
    const side = p.teamId === 100 ? 'blue' : 'red';
    return href ? (
      <Link key={i} to={href} className="mx-roster-item" data-side={side} title={`Ver perfil de ${p.summonerName}`}>{content}</Link>
    ) : (
      <div key={i} className="mx-roster-item" data-side={side}>{content}</div>
    );
  };

  return (
    <ArenaPage
      width="wide"
      backdrop={<SplashBackdrop champion={heroChampion} opacity={0.42} side="right" position="50% 16%" />}
    >
      {/* 3D Katarina loader while the match detail loads. */}
      {loading && !stats && <KataLoaderOverlay show label="Cargando partida" />}

      <button type="button" className="mx-back" onClick={() => navigate(-1)}>
        <ArrowLeft size={16} aria-hidden /> Volver
      </button>

      <header className="mx-head" data-solo={me ? undefined : 'true'}>
        <div style={{ minWidth: 0 }}>
          <span className="td-over ax-kicker ax-rise">{queueLabel}</span>
          <h1 className="ax-pagehero-title ax-rise" data-size="md" style={stagger(1)}>
            Detalle de <em>partida</em>
          </h1>
          <p className="ax-meta ax-rise" style={{ marginTop: 12, ...stagger(2) }}>
            {stats && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Clock size={14} aria-hidden /><span className="td-num">{fmtDuration(stats.gameDuration)}</span>
              </span>
            )}
            {playedOn && <span><i aria-hidden>/</i>{playedOn}</span>}
            {matchId && <span>{stats && <i aria-hidden>/</i>}<span className="mx-id">{matchId}</span></span>}
          </p>

          {/* ATAK AI — compact per-match tags for the searched player */}
          <AiTags
            label="ATAK AI"
            tags={matchTagsQ.data?.tags ?? []}
            loading={aiLoading}
            unavailable={matchTagsQ.data?.unavailable}
            style={{ marginTop: 14 }}
          />
        </div>

        {me && (
          <aside className="td-panel mx-me ax-rise" data-win={me.win ? 'true' : 'false'} style={stagger(2)}
            aria-label={`Resultado de ${me.summonerName}`}>
            <ChampIcon src={dd.champion(me.championName)} name={me.championName} size={64} />
            <div className="mx-me-body">
              <span className="mx-result" data-win={me.win ? 'true' : 'false'}>{me.win ? 'Victoria' : 'Derrota'}</span>
              <div className="mx-me-name">{me.summonerName}</div>
              <div className="mx-me-sub">
                {meLane !== 'fill' && <RoleIcon lane={me.teamPosition} size={15} />}
                <span>{me.championName}{meLane !== 'fill' ? ` · ${LANE_LABELS[meLane]}` : ''}</span>
              </div>
            </div>
            <div className="mx-me-kda">
              <b>{me.kills}<i>/</i><em>{me.deaths}</em><i>/</i>{me.assists}</b>
              <span className="td-over">{meKda} KDA</span>
            </div>
          </aside>
        )}
      </header>

      {/* Sin datos por error: estado claro con salida (antes quedaba "Sin partida vinculada"). */}
      {error && !stats && (
        <div className="ax-empty" role="alert">
          <AlertTriangle size={40} aria-hidden style={{ color: 'var(--td-amber)' }} />
          <h3>No se pudo cargar la partida</h3>
          <p style={{ margin: 0 }}>{error}</p>
          <div className="mx-empty-actions">
            <Button variant="secondary" icon={<ArrowLeft size={15} />} onClick={() => navigate(-1)}>Volver</Button>
          </div>
        </div>
      )}

      {/* Marcador + scoreboard + gráficos + objetivos + destacados */}
      {stats && (
        <MatchStatsDetail
          stats={stats}
          loading={loading}
          error={error}
          bracketMatchId={matchId || ''}
          gameId={(stats as any)?.gameId ?? (stats ? 1 : undefined)}
          team1="Equipo Azul"
          team2="Equipo Rojo"
          queueLabel={queueLabel}
          highlightPuuid={state?.puuid}
        />
      )}

      {/* Repetición 2D estilo broadcast (Match-V5 Timeline oficial) */}
      {roster.length > 0 && (
        <section className="td-panel ax-card" style={{ marginTop: 40 }}>
          <MatchReplay2D
            regional={regional}
            matchId={matchId}
            roster={roster as any}
            queueId={(stats as any)?.queueId}
            highlightPuuid={state?.puuid}
          />
        </section>
      )}

      {/* Jugadores — salto al perfil de cualquiera de los diez */}
      {roster.length > 0 && stats && (
        <section style={{ marginTop: 40 }}>
          <SectionHead size="lg" icon={<Users size={18} />} title="Jugadores" />
          <div className="mx-roster">
            <div className="mx-roster-col">
              <span className="td-over" data-side="blue" style={{ color: 'var(--side-text)' }}>Equipo Azul</span>
              {stats.blueTeam.map(rosterItem)}
            </div>
            <div className="mx-roster-col">
              <span className="td-over" data-side="red" style={{ color: 'var(--side-text)' }}>Equipo Rojo</span>
              {stats.redTeam.map(rosterItem)}
            </div>
          </div>
        </section>
      )}
    </ArenaPage>
  );
}
