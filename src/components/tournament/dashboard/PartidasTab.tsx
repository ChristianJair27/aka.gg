// ATAK.GG — Dashboard de torneo (extraído del componente único original).
// Sin cambios de comportamiento.

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Swords, X } from 'lucide-react';
import { Button, FilterPills, SectionHead } from '@/components/tournament/ui';
import { RoundRail, type RoundRailItem } from '@/components/tournament/RoundRail';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { TournamentMatchStats } from '@/components/TournamentMatchStats';
import { pulseSelector } from '@/hooks/useTournamentDiscovery';
import { useBracket } from '@/hooks/queries/tournaments';
import { RED, Card, Block, EmptyState, ErrorCard, useMediaQuery } from './shared';
import { MatchRow, MATCH_STATUS_PILLS, type MatchStatusFilter } from './MatchRow';

export function PartidasTab({ id, swissRounds }: { id: string; swissRounds: number | null }) {
  const { data, isLoading, isError, error, refetch } = useBracket(id);

  // ── Filtros (solo cliente). La ronda vive en la URL (?round=N | all) para que
  // los deep-links funcionen; estado y equipo son locales. ──
  const [params, setParams] = useSearchParams();
  const [status, setStatus] = useState<MatchStatusFilter>('all');
  const [q, setQ] = useState('');

  const matches = useMemo(
    () => (data?.bracket ?? []).filter((m) => m.team1 && m.team2 && m.team1 !== 'BYE' && m.team2 !== 'BYE'),
    [data],
  );
  const rounds = useMemo(
    () => Array.from(new Set(matches.map((m) => m.round))).sort((a, b) => a - b),
    [matches],
  );
  // Ronda "vigente": la menor con partidas sin cerrar (LQC en ronda 3 → 3).
  const currentRound = useMemo(() => {
    const open = matches.filter((m) => m.matchStatus !== 'complete').map((m) => m.round);
    return open.length ? Math.min(...open) : null;
  }, [matches]);

  // `?match=` (muestra "Ver stats de una serie" / enlace compartido): esa serie
  // se despliega sola y se resalta cuando aparece en pantalla.
  const urlMatch = params.get('match');
  const [openId, setOpenId] = useState<string | null>(null);
  useEffect(() => {
    if (!urlMatch) return;
    setOpenId(urlMatch);
    pulseSelector(`[data-td-match="${urlMatch}"]`);
  }, [urlMatch]);
  const toggleMatch = (mid: string) => setOpenId((cur) => (cur === mid ? null : mid));

  const urlRound = params.get('round');
  const round: number | null =
    urlRound === 'all' ? null
    : urlRound && Number.isFinite(Number(urlRound)) ? Number(urlRound)
    : (data?.phase === 'active' ? currentRound : null);
  const pickRound = (key: string) =>
    setParams((prev) => { const p = new URLSearchParams(prev); p.set('round', key); return p; }, { replace: true });
  const clearFilters = () => {
    setStatus('all'); setQ('');
    setParams((prev) => { const p = new URLSearchParams(prev); p.set('round', 'all'); return p; }, { replace: true });
  };

  if (isError) {
    return (
      <ErrorCard
        message={(error as any)?.response?.data?.error ?? (error as any)?.message ?? 'No se pudo cargar el bracket'}
        onRetry={() => refetch()}
      />
    );
  }
  if (isLoading || !data) return <Block h={280} r={16} />;

  if (!matches.length) {
    return (
      <Card>
        <SectionHead icon={<Swords size={14} color={RED} />} title="PARTIDAS" />
        <EmptyState>Aún no hay partidas — se crean al iniciar el torneo</EmptyState>
      </Card>
    );
  }

  const maxRound = Math.max(...matches.map((m) => m.round));
  // Rondas de playoffs (suizo multi-fase): etiquetas de bracket, no "Ronda N".
  const playoffRounds = new Set(matches.filter((m) => m.stage === 'playoffs').map((m) => m.round));
  const maxPlayoff = playoffRounds.size ? Math.max(...playoffRounds) : 0;
  const rlabel = (r: number) => {
    if (playoffRounds.has(r)) {
      const d = maxPlayoff - r;
      return d === 0 ? '🏆 Gran Final' : d === 1 ? 'Playoffs · Semifinales' : d === 2 ? 'Playoffs · Cuartos' : 'Playoffs · Octavos';
    }
    if (data.bracketType === 'round_robin') return `Jornada ${r}`;
    if (data.bracketType === 'swiss') return `Ronda ${r}`;
    const d = maxRound - r;
    return d === 0 ? 'Final' : d === 1 ? 'Semifinales' : d === 2 ? 'Cuartos' : `Ronda ${r}`;
  };

  // Una serie abierta a la vez: cada TournamentMatchStats monta su propio
  // sondeo de 30 s, así que abrir varias multiplicaba las peticiones. Antes se
  // abrían solas cuando había ≤2 partidas sin empezar; con 30 series eso ya no
  // aplica, y el auto-abrir se limita a la que llega por `?match=`.
  const narrow = useMediaQuery('(max-width: 1100px)');

  // RoundRail: "Todas" + una pill por ronda existente (las rondas futuras del
  // suizo aparecen solas cuando el backend las genera).
  const roundItems: RoundRailItem[] = [
    { key: 'all', label: 'Todas', count: matches.length, live: matches.filter((m) => m.matchStatus === 'active').length },
    ...rounds.map((r) => {
      const ms = matches.filter((m) => m.round === r);
      return {
        key: String(r), label: rlabel(r), count: ms.length,
        live: ms.filter((m) => m.matchStatus === 'active').length,
        done: ms.every((m) => m.matchStatus === 'complete'),
      };
    }),
  ];
  const roundTip = data.bracketType === 'swiss' && swissRounds
    ? `Filtra por ronda — este torneo tiene ${swissRounds} rondas suizas`
    : 'Filtra por ronda';

  const openMatch = matches.find((m) => m.id === openId) ?? null;
  const needle = q.trim().toLowerCase();
  const visible = matches.filter((m) =>
    (round === null || m.round === round)
    && (status === 'all' || m.matchStatus === status)
    && (!needle || (m.team1 ?? '').toLowerCase().includes(needle) || (m.team2 ?? '').toLowerCase().includes(needle)),
  );
  const visibleRounds = rounds.filter((r) => visible.some((m) => m.round === r));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div className="td-panel td-filterbar">
        <RoundRail items={roundItems} value={round === null ? 'all' : String(round)} onChange={pickRound} tip={roundTip} />
        <div className="td-filterbar-row">
          <FilterPills<MatchStatusFilter> items={MATCH_STATUS_PILLS} value={status} onChange={setStatus} />
          <div className="td-search-wrap" style={{ marginLeft: 'auto', maxWidth: 320 }}>
            <Search size={14} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar equipo…"
              aria-label="Buscar equipo"
              className="td-search"
            />
            {q && (
              <button type="button" className="td-search-clear" aria-label="Limpiar búsqueda" onClick={() => setQ('')}>
                <X size={12} />
              </button>
            )}
          </div>
        </div>
      </div>

      {visible.length === 0 ? (
        <Card>
          <div className="td-filter-empty">
            <Swords size={28} color="var(--td-muted)" style={{ opacity: .5 }} />
            <span style={{ fontSize: 13, color: 'var(--td-text-2)' }}>Ninguna partida coincide con los filtros</span>
            <Button variant="secondary" onClick={clearFilters}>Quitar filtros</Button>
          </div>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          {visibleRounds.map((r) => (
            <section key={r}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '0 2px 10px' }}>
                <span className="td-over" style={{ color: RED, letterSpacing: '2px' }}>{rlabel(r).toUpperCase()}</span>
                <div style={{ flex: 1, height: 1, background: 'var(--td-border)' }} />
                <span className="td-over">{visible.filter((m) => m.round === r).length} partidas</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {visible.filter((m) => m.round === r).map((m) => (
                  <MatchRow key={m.id} id={id} m={m}
                    open={openId === m.id}
                    onToggle={() => toggleMatch(m.id)}
                    inlineStats={!narrow}
                    onSeeRound={() => pickRound(String(m.round))}
                    isOwner={data.viewerAccess === 'owner'} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* ≤1100px: el detalle va en cajón. Al cerrarlo se desmonta el sondeo. */}
      {narrow && (
        <Drawer open={!!openMatch} onOpenChange={(o) => { if (!o) setOpenId(null); }}>
          <DrawerContent className="td-root border-white/10 bg-[#0c0b10] max-h-[92vh]">
            {openMatch && (
              <>
                <div className="td-drawer-head">
                  <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--td-text)' }}>
                    {openMatch.team1} vs {openMatch.team2}
                  </span>
                  {(openMatch.seriesTo ?? 1) > 1 && (
                    <span className="td-num" style={{ fontSize: 10.5, fontWeight: 800, color: '#c8aa6e' }}>
                      BO{(openMatch.seriesTo ?? 1) * 2 - 1}
                    </span>
                  )}
                </div>
                <div style={{ overflowY: 'auto', padding: '0 12px 20px' }}>
                  <TournamentMatchStats
                    tournamentId={id} match={openMatch} isActive
                    onSeeRound={() => { setOpenId(null); pickRound(String(openMatch.round)); }}
                    liveHref={`/tournaments/${id}/live?match=${openMatch.id}`}
                  />
                </div>
              </>
            )}
          </DrawerContent>
        </Drawer>
      )}
    </div>
  );
}

// P1: sala de espera — quién ya entró al lobby de Riot del código (poll 30s).
