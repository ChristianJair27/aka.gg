// Invitaciones pendientes a torneos (sistema "Arena"). Requiere un ancestro
// .td-root. Las clases db-* viven en src/styles/pages/dashboard.css.
import { Link } from 'react-router-dom';
import { Check, X, Mail, Loader2 } from 'lucide-react';
import { useTournamentInvitations, useRespondInvitation } from '@/hooks/queries/tournaments';
import { Button, SectionHead, TeamBadge } from '@/components/tournament/ui';
import '@/styles/pages/dashboard.css';

export function TournamentInvitationsPanel() {
  const { data: invitations = [], isLoading } = useTournamentInvitations();
  const respond = useRespondInvitation();

  if (isLoading) {
    return (
      <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 0', fontSize: 14.5, color: 'var(--td-text-2)' }}>
        <Loader2 size={17} className="animate-spin" aria-hidden /> Cargando invitaciones…
      </div>
    );
  }

  if (invitations.length === 0) return null;

  return (
    <section className="td-panel db-card" style={{ marginBottom: 24 }}>
      <SectionHead
        icon={<Mail size={15} />}
        title="Invitaciones a torneos"
        right={<span className="db-count">{invitations.length}</span>}
      />

      <div className="db-stack">
        {invitations.map((inv) => (
          <div key={inv.id} className="db-inv ax-rise">
            <TeamBadge name={inv.teamName || inv.tournamentName} size={44} />
            <div className="db-inv-main">
              <p className="db-inv-name">
                <Link to={`/tournaments/${inv.tournamentId}`} className="ax-link" style={{ color: 'inherit' }}>
                  {inv.tournamentName}
                </Link>
              </p>
              <p className="db-inv-sub">
                Equipo <b>{inv.teamName}</b>
                {inv.invitedByName && <> · invitado por {inv.invitedByName}</>}
              </p>
              {inv.playerName && (
                <p className="db-inv-sub" style={{ color: 'var(--td-muted)' }}>Slot: {inv.playerName}</p>
              )}
            </div>

            <div className="db-inv-actions">
              <Button
                variant="secondary"
                icon={<X size={15} />}
                disabled={respond.isPending}
                onClick={() => respond.mutate({ invId: inv.id, action: 'decline' })}
              >
                Rechazar
              </Button>
              <Button
                variant="primary"
                icon={respond.isPending ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                disabled={respond.isPending}
                onClick={() => respond.mutate({ invId: inv.id, action: 'accept' })}
              >
                Aceptar
              </Button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
