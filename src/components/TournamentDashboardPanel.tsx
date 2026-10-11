// Panel "Mis torneos" del dashboard: invitaciones, mis equipos (con códigos)
// y torneos que administro. Sistema "Arena": panel opaco, cabeceras de sección,
// escudos de equipo y chips de fase en español. Requiere un ancestro .td-root.
import { Link, useNavigate } from 'react-router-dom';
import {
  Trophy, Shield, Users, Copy, Check, Loader2, Crown, Zap, ArrowRight, Swords, AlertTriangle,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useMyTournamentDashboard, useRespondInvitation } from '@/hooks/queries/tournaments';
import { Button, StatusChip, SectionHead, ProgressBar, TeamBadge } from '@/components/tournament/ui';
import '@/styles/pages/dashboard.css';

// ── Fase → etiqueta y chip (ES) ──────────────────────────────────────────────
type ChipKind = 'live' | 'registration' | 'finished' | 'gold' | 'dim';
const PHASE_META: Record<string, { label: string; kind: ChipKind }> = {
  registration: { label: 'Inscripciones', kind: 'registration' },
  checkin:      { label: 'Check-in',      kind: 'gold' },
  active:       { label: 'En curso',      kind: 'live' },
  complete:     { label: 'Finalizado',    kind: 'finished' },
};

function PhaseChip({ phase }: { phase: string }) {
  const m = PHASE_META[phase] ?? { label: phase, kind: 'dim' as ChipKind };
  return <StatusChip kind={m.kind}>{m.label}</StatusChip>;
}

function CopyBtn({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      className="db-copy"
      data-ok={ok}
      onClick={() => { navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 2000); }}
      title="Copiar código de partida"
      aria-label={ok ? 'Código copiado' : `Copiar código de partida ${text}`}
    >
      {ok ? <Check size={15} aria-hidden /> : <Copy size={15} aria-hidden />}
      <span>{ok ? '¡Copiado!' : text}</span>
    </button>
  );
}

/** Cabecera de un bloque del panel: título + contador (+ línea de apoyo). */
function BlockHead({ icon, title, count, sub }: {
  icon: ReactNode; title: string; count?: number; sub?: string;
}) {
  return (
    <>
      <SectionHead icon={icon} title={title}
        right={count != null ? <span className="db-count">{count}</span> : undefined} />
      {sub && <p className="db-block-sub">{sub}</p>}
    </>
  );
}

export function TournamentDashboardPanel() {
  const { data, isLoading } = useMyTournamentDashboard();
  const respond = useRespondInvitation();
  const navigate = useNavigate();
  // Invitación de ACCESO (torneo privado): al aceptar, directo al torneo con
  // el formulario de inscripción abierto — sin pasos intermedios.
  const acceptInvite = (invId: number) =>
    respond.mutate({ invId, action: 'accept' }, {
      onSuccess: (resp: any) => {
        if (resp?.accessOnly && resp?.tournamentId) {
          navigate(`/tournaments/${resp.tournamentId}?register=1`);
        }
      },
    });

  if (isLoading) {
    return (
      <div className="td-panel db-card" role="status"
        style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--td-text-2)', fontSize: 14.5 }}>
        <Loader2 size={17} className="animate-spin" aria-hidden /> Cargando torneos…
      </div>
    );
  }

  if (!data) return null;
  const { invitations, myTeams, administrating, linkedRiotId } = data;
  const hasContent = invitations.length > 0 || myTeams.length > 0 || administrating.length > 0;

  // ── Estado vacío: invitación a explorar, no un párrafo suelto ──────────────
  if (!hasContent) {
    return (
      <div className="ax-empty">
        <Trophy size={28} color="var(--td-gold)" aria-hidden />
        <h3>Aún no compites en ningún torneo</h3>
        <p style={{ margin: '0 auto 16px', fontSize: 14.5, maxWidth: '44ch' }}>
          Cuando te inscriban en un equipo, tus invitaciones y códigos de partida aparecerán aquí.
        </p>
        <Link to="/tournaments" className="td-btn td-btn--primary">
          Explorar torneos <ArrowRight size={15} aria-hidden />
        </Link>
      </div>
    );
  }

  const summary = [
    myTeams.length > 0 && `${myTeams.length} equipo${myTeams.length > 1 ? 's' : ''}`,
    administrating.length > 0 && `${administrating.length} como organizador`,
    invitations.length > 0 && `${invitations.length} invitación${invitations.length > 1 ? 'es' : ''} pendiente${invitations.length > 1 ? 's' : ''}`,
  ].filter(Boolean).join(' · ');

  return (
    <div className="td-panel db-card">
      {/* Cabecera del bloque */}
      <SectionHead
        size="lg"
        icon={<Trophy size={19} />}
        title="Mis torneos"
        right={
          <Link to="/tournaments" className="ax-link"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'var(--td-font-mono)', fontSize: 13.5, letterSpacing: 0.8, textTransform: 'uppercase' }}>
            Ver todos <ArrowRight size={14} aria-hidden />
          </Link>
        }
      />
      {summary && <p className="db-block-sub" style={{ marginTop: -8, marginBottom: 20 }}>{summary}</p>}

      {/* ── Invitaciones pendientes ── */}
      {invitations.length > 0 && (
        <section className="db-block">
          <BlockHead icon={<Users size={15} />} title="Invitaciones pendientes" count={invitations.length} />
          <div className="db-stack">
            {invitations.map(inv => (
              <div key={inv.id} className="db-inv">
                <TeamBadge name={inv.teamName || inv.tournamentName} size={44} />
                <div className="db-inv-main">
                  <p className="db-inv-name">{inv.tournamentName}</p>
                  {inv.teamName ? (
                    <p className="db-inv-sub">
                      Equipo <b>{inv.teamName}</b>
                      {' · '}slot {inv.playerName || inv.slotIndex + 1}
                    </p>
                  ) : (
                    // Invitación de ACCESO a torneo privado (sin equipo): al
                    // aceptar puedes ver el torneo e inscribir tu propio equipo.
                    <p className="db-inv-sub">
                      Torneo privado · te invitaron a participar — inscribe a tu equipo al aceptar
                    </p>
                  )}
                  {!linkedRiotId && inv.teamName && (
                    <p className="db-inv-warn">
                      <AlertTriangle size={14} aria-hidden /> Vincula tu Riot ID antes de aceptar
                    </p>
                  )}
                </div>
                <div className="db-inv-actions">
                  <Button
                    variant="secondary"
                    disabled={respond.isPending}
                    onClick={() => respond.mutate({ invId: inv.id, action: 'decline' })}
                  >
                    Rechazar
                  </Button>
                  <Button
                    variant="primary"
                    disabled={respond.isPending || (!linkedRiotId && !!inv.teamName)}
                    onClick={() => acceptInvite(inv.id)}
                  >
                    Aceptar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Mis equipos ── */}
      {myTeams.length > 0 && (
        <section className="db-block">
          <BlockHead
            icon={<Swords size={15} />}
            title="Mis equipos"
            count={myTeams.length}
            sub="Tus inscripciones activas y códigos de partida"
          />
          <div className="db-teams">
            {myTeams.map(team => (
              <div key={`${team.tournamentId}-${team.teamName}`} className="td-sub db-team">
                {/* Cabecera del equipo */}
                <div className="db-team-head">
                  <TeamBadge name={team.teamName} size={48} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p className="db-team-name">{team.teamName}</p>
                    <p className="db-team-tour">{team.tournamentName}</p>
                    <div className="db-team-chips">
                      <PhaseChip phase={team.phase} />
                      {team.isCaptain && (
                        <StatusChip kind="gold" dot={false}><Crown size={12} aria-hidden /> Capitán</StatusChip>
                      )}
                    </div>
                  </div>
                </div>

                {/* Código de partida activo */}
                {team.activeMatchCode ? (
                  <div className="db-code">
                    <p className="td-over" style={{ margin: '0 0 8px' }}>
                      <Zap size={13} aria-hidden /> Código de partida
                    </p>
                    <CopyBtn text={team.activeMatchCode} />
                  </div>
                ) : team.phase === 'complete' ? (
                  <p style={{ margin: 0, fontSize: 13.5, color: 'var(--td-muted)' }}>
                    Torneo finalizado — revisa las estadísticas en la página del torneo.
                  </p>
                ) : null}

                {/* Acciones */}
                <div className="db-team-foot">
                  <Link to={`/tournaments/${team.tournamentId}`} className="ax-link">
                    Ver torneo <ArrowRight size={14} aria-hidden />
                  </Link>
                  {(team.phase === 'complete' || team.phase === 'active') && (
                    <Link to={`/tournaments/${team.tournamentId}/live`} className="db-link-dim">
                      Stats / en vivo
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Torneos que administro ── */}
      {administrating.length > 0 && (
        <section className="db-block">
          <BlockHead
            icon={<Shield size={15} />}
            title="Torneos que administro"
            count={administrating.length}
          />
          <div className="db-stack">
            {administrating.map(t => {
              const pct = t.maxParticipants > 0
                ? Math.min(100, Math.round((t.participants / t.maxParticipants) * 100))
                : 0;
              return (
                <Link key={t.id} to={`/tournaments/${t.id}`} className="db-admin">
                  <span className="td-ico db-ico" data-tone="gold" aria-hidden>
                    <Shield size={18} />
                  </span>
                  <div className="db-admin-main">
                    <div className="db-admin-top">
                      <p className="db-admin-name">{t.name}</p>
                      <PhaseChip phase={t.phase} />
                      {t.archived && <span className="tf-archived-tag">Archivado</span>}
                    </div>
                    <div className="db-admin-cap">
                      <ProgressBar kind="red" pct={pct} height={6} />
                      <span className="td-num">
                        {t.participants}/{t.maxParticipants} equipos
                        {t.codesAvailable != null ? ` · ${t.codesAvailable} códigos` : ''}
                      </span>
                    </div>
                  </div>
                  <span className="db-admin-go">Administrar <ArrowRight size={14} aria-hidden /></span>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
