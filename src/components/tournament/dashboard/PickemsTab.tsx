// ATAK.GG — Pick'Ems de playoffs (estilo Pick'Em de LoL Esports).
// Se predice el ganador (y si quieres, el marcador) de cada serie y un campeón.
// Las series futuras se llenan con tus propios picks: cambiar uno limpia los que
// dependían de él. Cada serie se cierra al empezar; el campeón, con la primera.
// Backend: sniperlol/src/routes/pickems.routes.ts
import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import { Lock, Check, X, Crown, Target, Users, Share2, Trophy, Info } from 'lucide-react';
import { toast } from 'sonner';
import axiosInstance from '@/lib/axios';
import { trackEvent } from '@/lib/analytics';
import { SectionHead, TeamBadge, Button, StatusChip } from '@/components/tournament/ui';
import { Card, EmptyState, Block, useMediaQuery } from './shared';

type PkMatch = {
  id: string; round: number; matchNumber: number;
  team1: string | null; team2: string | null; winner: string | null;
  score1: number; score2: number; seriesTo: number; status: string; bye: boolean;
  feeders: string[]; locked: boolean; lockReason: string | null; scores: string[];
  community: Array<{ team: string; pct: number }>;
};
type PkRound = { round: number; label: string; points: { win: number; exact: number }; matches: PkMatch[] };
type PkPick = { team: string; score: string | null };
type PkBoard = {
  enabled: boolean; status?: 'no_playoffs' | 'projected' | 'open';
  rounds?: PkRound[]; teams?: string[]; players?: number;
  champion?: { locked: boolean; points: number; winner: string | null; community: Array<{ team: string; pct: number }> };
  mine?: { userId: number; picks: Record<string, PkPick>; points: number; correct: number; exact: number; decided: number; champion: boolean | null } | null;
};
type LbRow = { rank: number; userId: number; name: string; avatar: string | null; points: number; correct: number; exact: number; picks: number; champion: boolean | null };

const CHAMPION = 'champion';
const norm = (s?: string | null) => String(s ?? '').trim().toLowerCase();
const isBye = (s?: string | null) => norm(s) === 'bye';
const known = (s?: string | null) => !!s && !isBye(s);

export function usePickemsEnabled(id: string) {
  const { data } = useQuery({
    queryKey: ['pickems', id],
    enabled: Boolean(id),
    queryFn: async () => (await axiosInstance.get<PkBoard>(`/api/pickems/${id}`)).data,
    staleTime: 30_000,
    retry: false,
  });
  return !!data?.enabled;
}

const LOCK_TEXT: Record<string, string> = {
  complete: 'Terminada', started: 'En juego', live: 'En juego', manual: 'Cerrada', scheduled: 'Cerrada', projected: 'Proyección',
};

export function PickemsTab({ id }: { id: string }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const mobile = useMediaQuery('(max-width: 760px)');
  const isAuth = !!localStorage.getItem('access_token');
  const [saving, setSaving] = useState(false);

  const board = useQuery({
    queryKey: ['pickems', id],
    queryFn: async () => (await axiosInstance.get<PkBoard>(`/api/pickems/${id}`)).data,
    refetchInterval: 30_000,
  });
  const lb = useQuery({
    queryKey: ['pickems-lb', id],
    queryFn: async () => (await axiosInstance.get<{ total: number; top: LbRow[]; me: LbRow | null }>(`/api/pickems/${id}/leaderboard`)).data,
    enabled: !!board.data?.enabled && board.data.status === 'open',
    refetchInterval: 60_000,
  });

  const data = board.data;
  const rounds = data?.rounds ?? [];
  const picks = data?.mine?.picks ?? {};
  const all = useMemo(() => new Map(rounds.flatMap((r) => r.matches).map((m) => [m.id, m])), [rounds]);
  const projected = data?.status === 'projected';

  // Equipos de cada lado: el real si ya se sabe; si no, tu pick de la serie que lo alimenta.
  const slots = (m: PkMatch, p: Record<string, PkPick>): Array<{ name: string | null; predicted: boolean }> =>
    [m.team1, m.team2].map((real, i) => {
      if (known(real)) return { name: real, predicted: false };
      const f = m.feeders[i] ? all.get(m.feeders[i]) : undefined;
      if (f?.winner && known(f.winner)) return { name: f.winner, predicted: false };
      const fp = f ? p[f.id]?.team : undefined;
      return { name: fp || null, predicted: !!fp };
    });

  const save = async (changes: Array<{ matchId: string; team: string | null; score?: string | null }>, next: Record<string, PkPick>) => {
    const prev = qc.getQueryData<PkBoard>(['pickems', id]);
    qc.setQueryData<PkBoard>(['pickems', id], (old) => (old ? { ...old, mine: { ...(old.mine ?? { userId: 0, points: 0, correct: 0, exact: 0, decided: 0, champion: null }), picks: next } } : old));
    setSaving(true);
    try {
      const { data: r } = await axiosInstance.put<{ saved: string[]; rejected: Array<{ matchId: string; reason: string }> }>(`/api/pickems/${id}/picks`, { picks: changes });
      if (r.rejected?.length) { toast.error(`No se guardó: ${r.rejected.map((x) => x.reason).join(', ')}`); qc.invalidateQueries({ queryKey: ['pickems', id] }); }
      qc.invalidateQueries({ queryKey: ['pickems-lb', id] });
    } catch (e: any) {
      qc.setQueryData(['pickems', id], prev);
      toast.error(e?.response?.data?.error || 'No se pudo guardar tu pick');
    } finally { setSaving(false); }
  };

  const requireLogin = () => {
    toast.info('Inicia sesión para jugar los Pick\'Ems', { description: 'Es gratis: entra con tu cuenta de Riot o de Google.' });
    navigate('/login', { state: { from: location } });
  };

  const choose = (m: PkMatch, team: string) => {
    if (!isAuth) return requireLogin();
    if (m.locked || projected) return;
    const next: Record<string, PkPick> = { ...picks };
    const same = norm(next[m.id]?.team) === norm(team);
    next[m.id] = { team, score: same ? next[m.id].score : null };
    const changes: Array<{ matchId: string; team: string | null; score?: string | null }> = [{ matchId: m.id, team, score: next[m.id].score }];
    // Los picks de rondas siguientes que dependían del equipo anterior dejan de ser posibles.
    for (const r of rounds) for (const x of r.matches) {
      if (x.round <= m.round || x.locked || !next[x.id]) continue;
      const opts = slots(x, next).map((s) => norm(s.name));
      if (!opts.includes(norm(next[x.id].team))) { delete next[x.id]; changes.push({ matchId: x.id, team: null }); }
    }
    trackEvent('pickem_pick', { tournament: id, match: m.id });
    void save(changes, next);
  };

  const chooseScore = (m: PkMatch, score: string) => {
    if (!isAuth) return requireLogin();
    const cur = picks[m.id];
    if (!cur || m.locked) return;
    const next = { ...picks, [m.id]: { ...cur, score: cur.score === score ? null : score } };
    void save([{ matchId: m.id, team: cur.team, score: next[m.id].score }], next);
  };

  const chooseChampion = (team: string) => {
    if (!isAuth) return requireLogin();
    if (data?.champion?.locked || projected) return;
    trackEvent('pickem_pick', { tournament: id, match: CHAMPION });
    void save([{ matchId: CHAMPION, team }], { ...picks, [CHAMPION]: { team, score: null } });
  };

  const share = async () => {
    const url = `${window.location.origin}/tournaments/${id}?tab=pickems`;
    const text = data?.mine?.points ? `Llevo ${data.mine.points} puntos en los Pick'Ems de la LQC en ATAK.GG. ¿Me ganas?` : '¿Quién gana la LQC? Haz tus Pick\'Ems en ATAK.GG';
    try {
      if (navigator.share) await navigator.share({ title: "Pick'Ems LQC", text, url });
      else { await navigator.clipboard.writeText(`${text} ${url}`); toast.success('Enlace copiado'); }
    } catch { /* cancelado */ }
  };

  if (board.isLoading) return <div style={{ display: 'grid', gap: 12 }}><Block h={90} /><Block h={320} /></div>;
  if (board.isError || !data?.enabled) return <Card><EmptyState>Este torneo no tiene Pick'Ems.</EmptyState></Card>;
  if (data.status === 'no_playoffs') return <Card><EmptyState>Este torneo no tiene playoffs configurados.</EmptyState></Card>;

  const firstReal = rounds.find((r) => r.matches.some((m) => !m.bye));
  const byes = rounds[0]?.matches.filter((m) => m.bye).map((m) => m.winner).filter(Boolean) as string[];
  const myLb = lb.data?.me;
  const maxPts = rounds.reduce((a, r) => a + r.matches.filter((m) => !m.bye).length * (r.points.win + r.points.exact), 0) + (data.champion?.points ?? 0);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 16 }}>
      {/* Cabecera: cómo se juega y tu marcador */}
      <Card accent="rgba(232,50,60,0.35)">
        <SectionHead icon={<Target size={18} />} title="Pick'Ems de playoffs" size="lg"
          right={<Button variant="secondary" icon={<Share2 size={14} />} onClick={share}>Compartir</Button>} />
        <p style={{ margin: '8px 0 14px', fontSize: 14, color: 'var(--td-text-2)', lineHeight: 1.5 }}>
          Elige quién gana cada serie de los playoffs y a tu campeón. Puedes llenar el bracket completo desde ya y cambiar
          cualquier pick hasta que empiece esa serie.{' '}
          <b style={{ color: 'var(--td-text)' }}>Puntos:</b>{' '}
          {rounds.filter((r) => r.matches.some((m) => !m.bye)).map((r) => `${r.label} ${r.points.win}`).join(' · ')}
          {' '}· marcador exacto +50 % · campeón {data.champion?.points}.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <Stat label="Tus puntos" value={data.mine ? String(data.mine.points) : '—'} accent />
          <Stat label="Posición" value={myLb ? `#${myLb.rank}` : '—'} hint={lb.data ? `de ${lb.data.total}` : undefined} />
          <Stat label="Aciertos" value={data.mine ? `${data.mine.correct}/${data.mine.decided}` : '—'} />
          <Stat label="Exactos" value={data.mine ? String(data.mine.exact) : '—'} />
          <Stat label="Jugando" value={String(data.players ?? 0)} icon={<Users size={13} />} />
          <Stat label="Máximo posible" value={String(maxPts)} />
        </div>
        {!isAuth && !projected && (
          <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14, color: 'var(--td-text-2)' }}>Necesitas una cuenta para guardar tus picks.</span>
            <Button onClick={requireLogin}>Iniciar sesión y jugar</Button>
          </div>
        )}
      </Card>

      {projected && (
        <Card accent="rgba(245,158,11,0.4)">
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <Info size={18} color="var(--td-amber)" style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ fontSize: 14, color: 'var(--td-text-2)', lineHeight: 1.5 }}>
              <b style={{ color: 'var(--td-text)' }}>Así quedarían los playoffs con la tabla de hoy.</b> Los Pick'Ems se abren en cuanto
              termine el suizo y se generen los cruces reales.
            </div>
          </div>
        </Card>
      )}

      {/* Bracket */}
      <Card>
        <SectionHead icon={<Trophy size={18} />} title="Tu bracket" right={saving ? <StatusChip kind="dim" dot={false}>Guardando…</StatusChip> : undefined} />
        {byes.length > 0 && (
          <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--td-muted)' }}>Pase directo a cuartos: {byes.join(', ')}.</p>
        )}
        <div style={{
          marginTop: 14, display: 'grid', gap: mobile ? 18 : 14,
          gridTemplateColumns: mobile ? 'minmax(0, 1fr)' : `repeat(${rounds.filter((r) => r.matches.some((m) => !m.bye)).length}, minmax(210px, 1fr))`,
          overflowX: mobile ? undefined : 'auto',
        }}>
          {rounds.filter((r) => r.matches.some((m) => !m.bye)).map((r) => (
            <div key={r.round} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontFamily: 'var(--td-font-display)', fontSize: 16, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--td-text)' }}>{r.label}</span>
                <span style={{ fontFamily: 'var(--td-font-mono)', fontSize: 12, color: 'var(--td-muted)' }}>{r.points.win} pts</span>
              </div>
              {/* En escritorio cada ronda se reparte a lo alto, como un bracket (las series quedan entre sus dos de origen). */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1, justifyContent: mobile ? undefined : 'space-around' }}>
                {r.matches.filter((m) => !m.bye).map((m) => (
                  <MatchPick key={m.id} m={m} sides={slots(m, picks)} pick={picks[m.id]} points={r.points}
                    disabled={projected} onPick={(t) => choose(m, t)} onScore={(s) => chooseScore(m, s)} />
                ))}
              </div>
            </div>
          ))}
        </div>
        {firstReal && !projected && <p style={{ margin: '12px 0 0', fontSize: 12.5, color: 'var(--td-muted)' }}>
          Las líneas punteadas son tus predicciones; se reemplazan por el equipo real cuando termina la serie anterior.
        </p>}
      </Card>

      {/* Campeón */}
      <Card accent={picks[CHAMPION] ? 'rgba(245,158,11,0.45)' : undefined}>
        <SectionHead icon={<Crown size={18} />} title={`Tu campeón · ${data.champion?.points} pts`}
          right={data.champion?.locked && !projected ? <StatusChip kind="dim" dot={false}><Lock size={12} /> Cerrado</StatusChip> : undefined} />
        <p style={{ margin: '6px 0 12px', fontSize: 13.5, color: 'var(--td-text-2)' }}>
          {data.champion?.locked && !projected ? 'Se cerró al empezar la primera serie de playoffs.' : 'Se cierra cuando empiece la primera serie de playoffs.'}
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8 }}>
          {(data.teams ?? []).map((t) => {
            const sel = norm(picks[CHAMPION]?.team) === norm(t);
            const won = data.champion?.winner && norm(data.champion.winner) === norm(t);
            const pct = data.champion?.community.find((c) => norm(c.team) === norm(t))?.pct;
            return (
              <button key={t} type="button" onClick={() => chooseChampion(t)} disabled={projected || data.champion?.locked}
                aria-pressed={sel}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', minHeight: 44, borderRadius: 10, textAlign: 'left',
                  background: sel ? 'rgba(245,158,11,0.12)' : 'var(--td-sunken)', color: 'var(--td-text)',
                  border: `1px solid ${won ? 'var(--td-green)' : sel ? 'var(--td-amber)' : 'var(--td-border)'}`,
                  cursor: projected || data.champion?.locked ? 'default' : 'pointer', fontSize: 13.5, fontWeight: 600,
                }}>
                <TeamBadge name={t} size={26} />
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t}</span>
                {sel && <Crown size={14} color="var(--td-amber)" />}
                {pct != null && <span style={{ fontFamily: 'var(--td-font-mono)', fontSize: 11.5, color: 'var(--td-muted)' }}>{pct}%</span>}
              </button>
            );
          })}
        </div>
      </Card>

      {/* Clasificación */}
      {!projected && (
        <Card>
          <SectionHead icon={<Users size={18} />} title="Clasificación" right={lb.data ? <span style={{ fontSize: 13, color: 'var(--td-muted)' }}>{lb.data.total} jugadores</span> : undefined} />
          {!lb.data?.top.length ? <EmptyState>Aún nadie ha hecho sus picks. ¡Sé el primero!</EmptyState> : (
            <div style={{ marginTop: 10, overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <tr style={{ color: 'var(--td-muted)', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                    <th style={th}>#</th><th style={{ ...th, textAlign: 'left' }}>Jugador</th><th style={th}>Pts</th>
                    <th style={th}>Aciertos</th><th style={th}>Exactos</th><th style={th}>Campeón</th>
                  </tr>
                </thead>
                <tbody>
                  {lb.data.top.map((r) => {
                    const me = data.mine && r.userId === data.mine.userId;
                    return (
                      <tr key={r.userId} style={{ borderTop: '1px solid var(--td-border-soft)', background: me ? 'rgba(232,50,60,0.08)' : undefined }}>
                        <td style={{ ...td, fontFamily: 'var(--td-font-mono)', color: r.rank <= 3 ? 'var(--td-amber)' : 'var(--td-text-2)' }}>{r.rank}</td>
                        <td style={{ ...td, textAlign: 'left', fontWeight: me ? 700 : 500, color: 'var(--td-text)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}{me ? ' (tú)' : ''}</td>
                        <td style={{ ...td, fontWeight: 700, color: 'var(--td-text)' }}>{r.points}</td>
                        <td style={td}>{r.correct}</td>
                        <td style={td}>{r.exact}</td>
                        <td style={td}>{r.champion == null ? '—' : r.champion ? <Check size={15} color="var(--td-green)" /> : <X size={15} color="var(--td-neg)" />}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

const th: CSSProperties = { padding: '6px 8px', textAlign: 'center', fontWeight: 600 };
const td: CSSProperties = { padding: '9px 8px', textAlign: 'center', color: 'var(--td-text-2)' };

function Stat({ label, value, hint, accent, icon }: { label: string; value: string; hint?: string; accent?: boolean; icon?: ReactNode }) {
  return (
    <div style={{ padding: '8px 12px', borderRadius: 10, background: 'var(--td-sunken)', border: `1px solid ${accent ? 'rgba(232,50,60,0.45)' : 'var(--td-border)'}`, minWidth: 96 }}>
      <div style={{ fontSize: 11.5, color: 'var(--td-muted)', textTransform: 'uppercase', letterSpacing: 0.4, display: 'flex', alignItems: 'center', gap: 4 }}>{icon}{label}</div>
      <div style={{ fontFamily: 'var(--td-font-display)', fontSize: 22, fontWeight: 700, color: 'var(--td-text)', lineHeight: 1.15 }}>
        {value}{hint && <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--td-muted)', marginLeft: 5 }}>{hint}</span>}
      </div>
    </div>
  );
}

function MatchPick({ m, sides, pick, points, disabled, onPick, onScore }: {
  m: PkMatch; sides: Array<{ name: string | null; predicted: boolean }>; pick?: PkPick;
  points: { win: number; exact: number }; disabled: boolean;
  onPick: (team: string) => void; onScore: (score: string) => void;
}) {
  const decided = !!m.winner && known(m.winner);
  const hit = decided && pick && norm(pick.team) === norm(m.winner);
  const realScore = decided ? (norm(m.winner) === norm(m.team1) ? `${m.score1}-${m.score2}` : `${m.score2}-${m.score1}`) : null;
  const exact = hit && pick?.score && pick.score === realScore;
  const earned = hit ? points.win + (exact ? points.exact : 0) : 0;
  const closed = m.locked || disabled;
  return (
    <div style={{
      borderRadius: 12, background: 'var(--td-subcard)', padding: 8, display: 'grid', gap: 6,
      border: `1px solid ${decided ? (hit ? 'rgba(74,222,128,0.5)' : pick ? 'rgba(248,113,113,0.45)' : 'var(--td-border)') : 'var(--td-border)'}`,
    }}>
      {sides.map((s, i) => {
        const sel = !!s.name && norm(pick?.team) === norm(s.name);
        const isWinner = decided && norm(m.winner) === norm(s.name);
        const pct = m.community.find((c) => norm(c.team) === norm(s.name))?.pct;
        const score = decided || m.score1 + m.score2 > 0 ? (i === 0 ? m.score1 : m.score2) : null;
        return (
          <button key={i} type="button" disabled={!s.name || closed} onClick={() => s.name && onPick(s.name)} aria-pressed={sel}
            style={{
              position: 'relative', display: 'flex', alignItems: 'center', gap: 8, minHeight: 44, padding: '6px 8px', borderRadius: 9, textAlign: 'left',
              background: sel ? 'rgba(232,50,60,0.14)' : 'var(--td-sunken)', overflow: 'hidden',
              border: `1px ${s.predicted ? 'dashed' : 'solid'} ${sel ? 'var(--td-red)' : 'var(--td-border-soft)'}`,
              color: s.name ? 'var(--td-text)' : 'var(--td-muted)', cursor: !s.name || closed ? 'default' : 'pointer',
              opacity: decided && !isWinner ? 0.55 : 1, fontSize: 13.5, fontWeight: 600,
            }}>
            {pct != null && <span aria-hidden style={{ position: 'absolute', inset: 0, width: `${pct}%`, background: 'rgba(255,255,255,0.04)' }} />}
            {s.name ? <TeamBadge name={s.name} size={24} /> : <span style={{ width: 24, height: 24, borderRadius: 6, background: 'var(--td-sunken-2)', flexShrink: 0 }} />}
            <span style={{ position: 'relative', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontStyle: s.predicted ? 'italic' : undefined }}>
              {s.name || 'Por definir'}
            </span>
            {pct != null && <span style={{ position: 'relative', fontFamily: 'var(--td-font-mono)', fontSize: 11.5, color: 'var(--td-muted)' }}>{pct}%</span>}
            {score != null && <span style={{ position: 'relative', fontFamily: 'var(--td-font-mono)', fontWeight: 700, color: isWinner ? 'var(--td-text)' : 'var(--td-muted)' }}>{score}</span>}
            {sel && !decided && <Check size={15} color="var(--td-red)" style={{ position: 'relative' }} />}
          </button>
        );
      })}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', minHeight: 26 }}>
        {pick && !decided && m.scores.length > 0 && m.scores.map((sc) => (
          <button key={sc} type="button" disabled={closed} onClick={() => onScore(sc)} aria-pressed={pick.score === sc}
            title={`Marcador exacto: +${points.exact} pts`}
            style={{
              fontFamily: 'var(--td-font-mono)', fontSize: 12, padding: '3px 9px', borderRadius: 999, minHeight: 26,
              border: `1px solid ${pick.score === sc ? 'var(--td-red)' : 'var(--td-border)'}`,
              background: pick.score === sc ? 'rgba(232,50,60,0.16)' : 'transparent', color: 'var(--td-text-2)', cursor: closed ? 'default' : 'pointer',
            }}>{sc}</button>
        ))}
        <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--td-muted)' }}>
          {decided ? (pick ? (hit ? <><Check size={13} color="var(--td-green)" /> +{earned}{exact ? ' (exacto)' : ''}</> : <><X size={13} color="var(--td-neg)" /> 0</>) : 'Sin pick')
            : m.locked ? <><Lock size={12} /> {LOCK_TEXT[m.lockReason || ''] || 'Cerrada'}</> : pick ? 'Abierta' : 'Elige un ganador'}
        </span>
      </div>
    </div>
  );
}
