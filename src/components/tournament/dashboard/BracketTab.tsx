// ATAK.GG — Dashboard de torneo (extraído del componente único original).
// Sin cambios de comportamiento.

import { useState } from 'react';
import { Trophy } from 'lucide-react';
import { SectionHead } from '@/components/tournament/ui';
import { SwissBracket } from '@/components/SwissBracket';
import { TournamentBracket } from '@/components/TournamentBracket';
import {
  useBracket, useActivateMatch, useReportResult,
  type TdBoardPayload, type BracketMatch,
} from '@/hooks/queries/tournaments';
import { RED, Card, Block, EmptyState, ErrorCard, useMediaQuery } from './shared';
import { MatchRow } from './MatchRow';

export function BracketTab({ id, data }: { id: string; data: TdBoardPayload }) {
  const { data: br, isLoading, isError, error, refetch } = useBracket(id);
  const activate = useActivateMatch(id);
  const report   = useReportResult(id);
  const narrow   = useMediaQuery('(max-width: 760px)');
  // Misma regla que en Partidas: una serie desplegada a la vez (un sondeo).
  const [bracketOpenId, setBracketOpenId] = useState<string | null>(null);

  if (isError) {
    return (
      <ErrorCard
        message={(error as any)?.response?.data?.error ?? (error as any)?.message ?? 'No se pudo cargar el bracket'}
        onRetry={() => refetch()}
      />
    );
  }
  if (isLoading || !br) return <Block h={320} r={16} />;

  const bracket = br.bracket ?? [];
  if (!bracket.length) {
    return (
      <Card>
        <SectionHead icon={<Trophy size={14} color={RED} />} title="BRACKET COMPLETO" />
        <EmptyState>Bracket aún no generado — se crea al iniciar el torneo</EmptyState>
      </Card>
    );
  }

  const access = br.viewerAccess ?? data.viewerAccess;

  const isRR = br.bracketType === 'round_robin';
  const isSwiss = br.bracketType === 'swiss';

  // Suizo / liga: bracket de columnas por ronda con cards grandes (desktop).
  // El árbol clásico no aplica — el avance es pareo por récord.
  if ((isRR || isSwiss) && !narrow) {
    const champion = br.phase === 'complete' ? (data.standings?.[0]?.name ?? null) : null;
    return (
      <SwissBracket
        bracket={bracket as BracketMatch[]}
        bracketType={br.bracketType}
        tournamentId={id}
        isActive={br.phase === 'active'}
        canViewCodes={access === 'owner' || access === 'participant'}
        champion={champion}
      />
    );
  }

  // Lista vertical: móvil (ni el árbol ni las columnas caben)
  if (narrow || isRR || isSwiss) {
    const maxRound = Math.max(...bracket.map((m) => m.round));
    const rlabel = (r: number) => {
      if (isRR) return `Jornada ${r}`;
      if (isSwiss) return `Ronda ${r}`;
      const d = maxRound - r;
      return d === 0 ? 'Final' : d === 1 ? 'Semifinales' : d === 2 ? 'Cuartos' : `Ronda ${r}`;
    };
    const rounds = Array.from(new Set(bracket.map((m) => m.round))).sort((a, b) => a - b);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }} data-td-bracket>
        {rounds.map((r) => (
          <section key={r} data-td-round={r}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '0 2px 10px' }}>
              <span className="td-over" style={{ color: RED, letterSpacing: '2px' }}>{rlabel(r).toUpperCase()}</span>
              <div style={{ flex: 1, height: 1, background: 'var(--td-border)' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {bracket.filter((m) => m.round === r).map((m) => (
                <MatchRow key={m.id} id={id} m={m as BracketMatch}
                  open={bracketOpenId === m.id}
                  onToggle={() => setBracketOpenId((cur) => (cur === m.id ? null : m.id))} />
              ))}
            </div>
          </section>
        ))}
      </div>
    );
  }

  return (
    <TournamentBracket
      bracket={bracket as any}
      maxRound={Math.max(...bracket.map((m) => m.round))}
      isActive={br.phase === 'active'}
      tournamentId={id}
      canViewCodes={access === 'owner' || access === 'participant'}
      canManage={access === 'owner'}
      onActivateMatch={(matchId) => activate.mutateAsync(matchId)}
      onReportResult={(matchId, winner, score1, score2) => report.mutate({ matchId, winner, score1, score2 })}
      reportingMatch={report.isPending ? (report.variables?.matchId ?? null) : null}
    />
  );
}

// ── EQUIPOS: inscripciones reales con roster ─────────────────────────────────
