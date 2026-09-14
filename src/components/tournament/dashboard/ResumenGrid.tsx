// ATAK.GG — Dashboard de torneo (extraído del componente único original).
// Sin cambios de comportamiento.

import { CSSProperties, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { axiosInstance } from '@/lib/axios';
import { toast } from 'sonner';
import {
  Trophy, Users, BarChart3, Swords, Play, Check, ArrowRight, Calendar,
  Crown, Skull, Flame, ChevronDown, ChevronUp, RefreshCw,
} from 'lucide-react';
import {
  Button, StatusChip, TeamBadge, ProgressBar, SectionHead,
} from '@/components/tournament/ui';
import { Tip } from '@/components/ui/Tip';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { RoundRail, type RoundRailItem } from '@/components/tournament/RoundRail';
import { TournamentTeamModal } from '@/components/TournamentTeamModal';
import { useTournamentGlobalStats } from '@/hooks/useTournamentGlobalStats';
import { discoveryToast } from '@/hooks/useTournamentDiscovery';
import { useCheckin, useRegistrations, type TdBoardPayload } from '@/hooks/queries/tournaments';
import { dd } from '@/lib/dataDragon';
import {
  BLUE, RED, Card, Block, EmptyState, ChampGrid, ChampPortrait, TeamCol,
  ScheduleTeams, champIcon, fmtTime, pad, useCountdown,
} from './shared';

export function StatsMainCard({ id, onFull }: { id: string; onFull: () => void }) {
  const { data, loading, error } = useTournamentGlobalStats({ tournamentId: id });

  const top5 = useMemo(
    () => (data?.players ? [...data.players].sort((a, b) => b.avgKda - a.avgKda).slice(0, 5) : []),
    [data],
  );
  const leaders = useMemo(() => {
    if (!data?.players?.length) return [];
    const by = (k: 'avgKda' | 'totalKills' | 'avgDamagePerMin') =>
      [...data.players].sort((a, b) => (b[k] as number) - (a[k] as number))[0];
    return [
      { label: 'MEJOR KDA', icon: <Crown size={13} />, p: by('avgKda'), fmt: (p: any) => p.avgKda.toFixed(2) },
      { label: 'MÁS KILLS', icon: <Skull size={13} />, p: by('totalKills'), fmt: (p: any) => String(p.totalKills) },
      { label: 'MÁS DAÑO/MIN', icon: <Flame size={13} />, p: by('avgDamagePerMin'), fmt: (p: any) => String(Math.round(p.avgDamagePerMin)) },
    ];
  }, [data]);

  return (
    <Card>
      <SectionHead
        icon={<BarChart3 size={14} color={RED} />}
        title="ESTADÍSTICAS DEL TORNEO"
        right={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {loading && <RefreshCw size={13} color="var(--td-muted)" className="td-spin" />}
            <Button variant="secondary" icon={<ArrowRight size={13} />} onClick={onFull}>VER TODO</Button>
          </div>
        }
      />

      {error && !data && <EmptyState>{error}</EmptyState>}
      {!error && !data && <Block h={180} />}
      {data && data.matchesCompleted === 0 && (
        <EmptyState>
          Las estadísticas aparecen aquí en cuanto termine la primera partida del torneo.
        </EmptyState>
      )}

      {data && data.matchesCompleted > 0 && (
        <>
          {/* Líderes */}
          <div className="td-leaders">
            {leaders.map((l) => (
              <div key={l.label} className="td-leader">
                <img
                  src={dd.champion(l.p.mostPlayedChamp || 'Garen')} alt="" loading="lazy"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }}
                  style={{ width: 40, height: 40, borderRadius: 10, objectFit: 'cover', flexShrink: 0, boxShadow: '0 0 0 1.5px var(--td-border-hov)' }}
                />
                <div style={{ minWidth: 0 }}>
                  <div className="td-over" style={{ display: 'flex', alignItems: 'center', gap: 5, color: RED }}>
                    {l.icon}{l.label}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--td-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {l.p.summonerName}
                  </div>
                  <div className="td-num" style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{l.fmt(l.p)}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Top 5 por KDA */}
          <div style={{ marginTop: 14 }}>
            <div className="td-strow td-strow-stats td-over" style={{ padding: '0 8px 8px' }}>
              <span>#</span><span>Jugador</span><span>PJ</span>
              <span className="td-st-wr">WR</span><span>KDA</span><span className="td-st-dmg" style={{ textAlign: 'right' }}>Daño/min</span>
            </div>
            {top5.map((p, i) => (
              <div key={p.summonerName + p.tagLine} className="td-strow td-strow-stats td-row-hover" style={{ padding: '8px', borderRadius: 8 }}>
                <span className="td-num" style={{ fontSize: 12.5, fontWeight: 700, color: i === 0 ? RED : 'var(--td-text-2)' }}>{i + 1}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <img
                    src={dd.champion(p.mostPlayedChamp || 'Garen')} alt="" loading="lazy"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }}
                    style={{ width: 24, height: 24, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }}
                  />
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--td-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.summonerName}
                  </span>
                </div>
                <span className="td-num" style={{ fontSize: 12, color: 'var(--td-text-2)' }}>{p.gamesPlayed}</span>
                <span className="td-num td-st-wr" style={{ fontSize: 12, color: p.winrate >= 50 ? 'var(--td-green)' : 'var(--td-neg)' }}>{p.winrate}%</span>
                <span className="td-num" style={{ fontSize: 12.5, fontWeight: 700, color: p.avgKda >= 4 ? '#fde047' : '#fff' }}>{p.avgKda.toFixed(2)}</span>
                <span className="td-num td-st-dmg" style={{ fontSize: 12, color: 'var(--td-text-2)', textAlign: 'right' }}>{Math.round(p.avgDamagePerMin)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}

// ── HERO ─────────────────────────────────────────────────────────────────────
/** Número que cuenta hasta su valor al montar (ease-out; reduced-motion: directo). */

export function ResumenGrid({ data, id, navigate, onStats, onRound }: {
  data: TdBoardPayload; id: string; navigate: (to: string) => void; onStats: () => void;
  /** Salto a Partidas con la ronda elegida (?tab=partidas&round=N). */
  onRound: (round: string) => void;
}) {
  // Eco del RoundRail de Partidas (mismo componente, no una tira paralela): una
  // pill por ronda → salto a Partidas ya filtrado. La ronda vigente va marcada.
  const roundItems: RoundRailItem[] = useMemo(() => (data.bracket ?? []).map((r) => ({
    key: String(r.round),
    label: r.label,
    count: r.matches.length,
    live: r.matches.filter((m) => m.matchStatus === 'active').length,
    done: r.matches.length > 0 && r.matches.every((m) => m.matchStatus === 'complete'),
  })), [data.bracket]);
  const currentRound = useMemo(() => {
    const open = (data.bracket ?? []).filter((r) => r.matches.some((m) => m.matchStatus !== 'complete'));
    return open.length ? String(open[0].round) : null;
  }, [data.bracket]);
  const shortName = data.tournament.name.split(' ')[0];
  const roundTip = data.tournament.bracketType === 'swiss' && data.tournament.swissRounds
    ? `Filtra por ronda — ${shortName} tiene ${data.tournament.swissRounds} rondas suizas`
    : 'Filtra por ronda';

  return (
    <div className="td-dash-grid">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
        {/* Las stats son el corazón del torneo: main card del resumen */}
        <StatsMainCard id={id} onFull={onStats} />
        <StandingsCard data={data} id={id} region={data.tournament.region} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
        <LiveCard data={data} navigate={navigate} id={id} onRound={onRound} />
        {data.tournament.fearless && <FearlessCard id={id} myTeam={data.myTeam?.tag ?? null} />}
        {data.myTeam && <MyTeamCard data={data} id={id} />}
        {roundItems.length > 1 && (
          <Card style={{ padding: '12px 14px' }}>
            <div className="td-over" style={{ marginBottom: 8 }}>RONDAS</div>
            <RoundRail items={roundItems} value={currentRound} onChange={onRound} tip={roundTip} compact />
          </Card>
        )}
        <ScheduleCard data={data} />
      </div>
    </div>
  );
}

// ── FEARLESS: campeones bloqueados por equipo ────────────────────────────────
// Con 19 equipos y 42 partidas jugadas la lista completa mide ~1950px: abierta
// empujaba Clasificación y el directo fuera de pantalla. Por defecto se muestra
// un resumen (y el equipo propio si lo hay); el resto se despliega a petición,
// un equipo cada vez.

export function FearlessCard({ id, myTeam }: { id: string; myTeam?: string | null }) {
  const q = useQuery({
    queryKey: ['tournament', id, 'fearless'],
    queryFn: async () => (await axiosInstance.get(`/api/tournaments/${id}/fearless`)).data as {
      gamesCounted: number;
      teams: Array<{ team: string; usedChampions: string[] }>;
      unassigned: string[]; allUsed: string[];
    },
    refetchInterval: 60_000,
  });
  const d = q.data;
  const [openAll, setOpenAll] = useState(false);
  const [openTeam, setOpenTeam] = useState<string | null>(null);

  const mine = myTeam ? d?.teams.find((t) => t.team === myTeam) ?? null : null;
  const rest = d ? d.teams.filter((t) => t.team !== mine?.team) : [];

  return (
    <Card accent="rgba(245,158,11,0.35)">
      <SectionHead icon={<Swords size={14} color="var(--td-amber)" />} title="FEARLESS · CAMPEONES BLOQUEADOS" />
      {!d ? (
        <Block h={80} />
      ) : d.allUsed.length === 0 ? (
        <EmptyState>Aún no hay campeones bloqueados — se llenan al terminar cada partida</EmptyState>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 12.5, color: 'var(--td-text-2)' }}>
            <strong style={{ color: 'var(--td-text)' }}>{d.allUsed.length}</strong> campeones bloqueados ·{' '}
            <strong style={{ color: 'var(--td-text)' }}>{d.teams.length}</strong> equipos ·{' '}
            {d.gamesCounted} partidas
          </div>

          {/* Tu equipo siempre a la vista: es lo único accionable antes del draft */}
          {mine && (
            <div>
              <div className="td-over" style={{ marginBottom: 6, color: 'var(--td-amber)' }}>
                TU EQUIPO · {mine.team} · {mine.usedChampions.length}
              </div>
              <ChampGrid champs={mine.usedChampions} />
            </div>
          )}

          <Collapsible open={openAll} onOpenChange={setOpenAll}>
            <CollapsibleTrigger asChild>
              <button type="button" className="td-collapse-trigger">
                {openAll ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                {openAll ? 'Ocultar el resto' : `Ver todos los equipos (${rest.length})`}
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                {rest.map((tm) => {
                  const open = openTeam === tm.team;
                  return (
                    <div key={tm.team}>
                      <button type="button" className="td-fearless-team"
                        onClick={() => setOpenTeam(open ? null : tm.team)} aria-expanded={open}>
                        {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {tm.team}
                        </span>
                        <span className="td-num" style={{ color: 'var(--td-amber)' }}>{tm.usedChampions.length}</span>
                      </button>
                      {open && <div style={{ padding: '8px 2px 4px' }}><ChampGrid champs={tm.usedChampions} /></div>}
                    </div>
                  );
                })}
                {d.unassigned.length > 0 && (
                  <div>
                    <div className="td-over" style={{ margin: '6px 0' }}>OTROS · {d.unassigned.length}</div>
                    <ChampGrid champs={d.unassigned} dim />
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>

          <p style={{ margin: 0, fontSize: 11, color: 'var(--td-muted)' }}>
            El lobby no lo bloquea automáticamente — es responsabilidad de los capitanes respetarlo
          </p>
        </div>
      )}
    </Card>
  );
}

// ── STANDINGS ────────────────────────────────────────────────────────────────
// Columnas via clases .td-strow (media queries en ResponsiveStyles): en móvil
// se ocultan WR y Racha para que no desborde.

export function StandingsCard({ data, id, region }: { data: TdBoardPayload; id: string; region: string }) {
  const rows = data.standings;
  // Mismo destino que la tarjeta de Equipos: la fila de la tabla abre el
  // análisis del equipo. `useRegistrations` comparte caché con la pestaña
  // Equipos, así que no dispara una petición extra si ya se visitó.
  const { data: regs } = useRegistrations(id);
  const [openTeam, setOpenTeam] = useState<string | null>(null);
  const reg = regs?.find((r) => r.teamName === openTeam) ?? null;

  return (
    <Card>
      <SectionHead icon={<BarChart3 size={14} color={BLUE} />} title="CLASIFICACIÓN" />
      {!rows.length ? (
        <EmptyState>Sin clasificación todavía</EmptyState>
      ) : (
        <div>
          <div className="td-strow td-over" style={{ padding: '0 8px 8px' }}>
            <span>#</span><span>Equipo</span><span>W-L</span>
            <span className="td-st-wr">WR</span><span className="td-st-streak">Racha</span>
            <span style={{ textAlign: 'right' }}>Pts</span>
          </div>
          {rows.map((s) => (
            <div key={s.teamId} className="td-strow td-row-hover td-strow-click" style={{ padding: '9px 8px', borderRadius: 8 }}
              role="button" tabIndex={0} aria-label={`Ver análisis de ${s.name}`}
              onClick={() => setOpenTeam(s.name)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpenTeam(s.name); } }}
            >
              <span className="td-num" style={{ fontSize: 13, fontWeight: 700, color: s.position === 1 ? RED : 'var(--td-text-2)' }}>
                {s.position}
              </span>
              <Tip label="Click para stats del equipo y jugadores">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <TeamBadge name={s.name} color={s.color} mono={s.mono} size={22} />
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--td-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.name}
                  </span>
                </div>
              </Tip>
              <span className="td-num" style={{ fontSize: 12.5, color: 'var(--td-text-2)' }}>{s.wins}-{s.losses}</span>
              <div className="td-st-wr" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1 }}><ProgressBar kind="wr" pct={s.winratePct} /></div>
                <span className="td-num" style={{ fontSize: 11.5, color: 'var(--td-text-2)', width: 34 }}>{Math.round(s.winratePct)}%</span>
              </div>
              <span className="td-st-streak">
                {s.streak ? (
                  <StatusChip kind={s.streak.type === 'W' ? 'pos' : 'warn'} dot={false}>
                    {s.streak.count}{s.streak.type}
                  </StatusChip>
                ) : (
                  <StatusChip kind="dim" dot={false}>—</StatusChip>
                )}
              </span>
              <span className="td-num" style={{ fontSize: 13, fontWeight: 700, color: '#fff', textAlign: 'right' }}>{s.points}</span>
            </div>
          ))}
        </div>
      )}
      {reg && (
        <TournamentTeamModal
          tournamentId={id}
          region={region}
          reg={reg}
          standing={rows.find((x) => x.name === reg.teamName) ?? null}
          onClose={() => setOpenTeam(null)}
        />
      )}
    </Card>
  );
}

// ── LIVE MATCH ───────────────────────────────────────────────────────────────

export function GoldDiffBars({ series }: { series: number[] }) {
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

export function LiveCard({ data, navigate, id, onRound }: {
  data: TdBoardPayload; navigate: (to: string) => void; id: string; onRound: (round: string) => void;
}) {
  const live = data.liveMatch;
  // El backend devuelve `liveMatch` para la serie activa aunque el Spectator
  // Companion no esté emitiendo: llega sin cronómetro, sin picks, sin oro y
  // 0-0. Pintar eso como "EN DIRECTO · MAPA 1" es mentirle al espectador, así
  // que sin señal real se trata como pendiente (verificado 14-sep: las 9 series
  // de la ronda 3 llegaban con isLive:false y equipos vacíos).
  const hasFeed = !!live && (
    live.timer != null
    || (live.goldDiffSeries?.length ?? 0) > 0
    || (live.teamA.picks?.length ?? 0) > 0
    || (live.teamB.picks?.length ?? 0) > 0
    || (live.teamA.score ?? 0) > 0 || (live.teamB.score ?? 0) > 0
  );
  if (!live || !hasFeed) {
    return <NextMatchCard data={data} onRound={onRound} pendingSeries={live ?? null} id={id} navigate={navigate} />;
  }
  const timer = live.timer != null
    ? `${pad(Math.floor(live.timer / 60))}:${pad(live.timer % 60)}`
    : null;
  return (
    <Card accent="rgba(59,130,246,0.35)" anchor="data-td-live">
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

      <div style={{ marginTop: 14 }}>
        <Tip label="Ver la partida en vivo">
          <span style={{ display: 'block' }}>
            <Button variant="primary" icon={<Play size={15} />} full onClick={() => navigate(`/tournaments/${id}/live`)}>ESPECTAR</Button>
          </span>
        </Tip>
      </div>
    </Card>
  );
}

export function NextMatchCard({ data, onRound, pendingSeries, id, navigate }: {
  data: TdBoardPayload; onRound: (round: string) => void;
  /** Serie activa sin emisión: se nombra en vez de fingir un marcador. */
  pendingSeries?: TdBoardPayload['liveMatch'] | null;
  id?: string; navigate?: (to: string) => void;
}) {
  const next = data.schedule[0];
  // Sin feed de spectator: en vez de un muro, se explica por qué y se ofrece la
  // ronda en juego. El aviso sale una sola vez por navegador.
  const activeRound = useMemo(() => {
    const rounds = (data.bracket ?? []).filter((r) => r.matches.some((m) => m.matchStatus === 'active'));
    return rounds.length ? rounds[0].round : null;
  }, [data.bracket]);
  const isActive = data.tournament.phase === 'active';
  useEffect(() => {
    if (!isActive) return;
    discoveryToast('live-empty', () =>
      toast.info('Ronda activa — el spectator se conecta cuando empiece el juego'));
  }, [isActive]);

  return (
    <Card accent="rgba(59,130,246,0.25)" anchor="data-td-live">
      <SectionHead
        icon={<Play size={14} color={BLUE} />}
        title={pendingSeries ? 'RONDA ACTIVA — SPECTATOR PENDIENTE' : 'PRÓXIMA PARTIDA'}
      />
      {pendingSeries ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <TeamCol team={pendingSeries.teamA} />
            <StatusChip kind="dim" dot={false}>EN CURSO</StatusChip>
            <TeamCol team={pendingSeries.teamB} />
          </div>
          <p style={{ margin: 0, fontSize: 12, lineHeight: 1.55, color: 'var(--td-muted)', textAlign: 'center' }}>
            La serie está en curso. El marcador en vivo aparecerá cuando el Spectator Companion
            esté conectado.
          </p>
          {id && navigate && (
            <Tip label="Puede no haber feed todavía">
              <span style={{ display: 'block' }}>
                <Button variant="secondary" icon={<Play size={14} />} full
                  onClick={() => navigate(`/tournaments/${id}/live?match=${pendingSeries.matchId}`)}>
                  ESPECTAR
                </Button>
              </span>
            </Tip>
          )}
        </div>
      ) : !next ? (
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
      {activeRound != null && (
        <div style={{ marginTop: 14, display: 'flex', justifyContent: 'center' }}>
          <Button variant="secondary" icon={<Swords size={14} />} onClick={() => onRound(String(activeRound))}>
            Ver Partidas de la ronda
          </Button>
        </div>
      )}
    </Card>
  );
}

// ── MY TEAM ──────────────────────────────────────────────────────────────────

export function MyTeamCard({ data, id }: { data: TdBoardPayload; id: string }) {
  const my = data.myTeam!;
  const countdown = useCountdown(my.checkinDeadline);
  const checkin = useCheckin(id);
  const disabled = my.checkedIn || checkin.isPending;

  const doCheckin = () => {
    // El `captainRiotId: ''` NO es un hueco por rellenar: verificado en el
    // backend (POST /:id/checkin), la autorización va por membresía real —
    // quien registró el equipo, un jugador del roster por userId o por cuenta
    // de Riot vinculada, o el organizador— y el campo del body se ignora a
    // propósito porque el cliente puede omitirlo. Mandar algo aquí no cambia
    // nada; el tipo lo pide, de ahí la cadena vacía.
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
        <Tip label="Tu equipo en el torneo">
          <span style={{ display: 'block' }}>
            <Button variant="primary" icon={<Check size={15} />} full disabled={disabled} onClick={doCheckin}>
              {my.checkedIn ? 'CHECK-IN COMPLETADO' : 'HACER CHECK-IN'}
            </Button>
          </span>
        </Tip>
      </div>
    </Card>
  );
}

// ── SCHEDULE ─────────────────────────────────────────────────────────────────

export function ScheduleCard({ data }: { data: TdBoardPayload }) {
  const activity = data.activityByDay;
  const peak = useMemo(() => Math.max(0, ...activity.map((d) => d.games)), [activity]);
  const DAY_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

  return (
    <Card>
      <SectionHead icon={<Calendar size={14} color={BLUE} />} title="PRÓXIMAS PARTIDAS" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {data.schedule.length === 0 && <EmptyState>No hay partidas programadas</EmptyState>}
        {data.schedule.map((s) => (
          <div key={s.matchId} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 4px' }}>
            <span className="td-num" style={{ fontSize: 12.5, fontWeight: 700, color: RED, width: 52, flexShrink: 0 }}>
              {fmtTime(s.scheduledAt) ?? 'S/D'}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <ScheduleTeams a={s.teamA} b={s.teamB} />
              <div className="td-over" style={{ marginTop: 3 }}>{s.roundLabel}</div>
            </div>
          </div>
        ))}
      </div>

      {activity.length > 1 && (
        <div style={{ marginTop: 16, borderTop: '1px solid var(--td-border)', paddingTop: 14 }}>
          <div className="td-over" style={{ marginBottom: 10 }}>PARTIDAS POR DÍA</div>
          {/* Barras con ancho acotado: con pocos días, una barra flex:1 se veía
              como un bloque rojo gigante. Solo se muestra con 2+ días. */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', height: 60, justifyContent: 'flex-start' }}>
            {activity.slice(0, 7).map((d, i) => {
              const h = peak > 0 ? Math.max(6, (d.games / peak) * 48) : 6;
              const isPeak = d.games === peak && peak > 0;
              return (
                <div key={i} style={{ width: 34, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }} title={`${d.day}: ${d.games}`}>
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

// ── ADMIN PANEL (solo organizador) ───────────────────────────────────────────
