// Panel "Mis torneos" del dashboard: invitaciones, mis equipos (con códigos)
// y torneos que administro. Lenguaje vision: glass, cuadrados de icono,
// monogramas de equipo con color determinista y chips de fase en español.
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Trophy, Shield, Users, Copy, Check, Loader2, Crown, Zap, ArrowRight, Swords,
} from 'lucide-react';
import { useState } from 'react';
import { useMyTournamentDashboard, useRespondInvitation } from '@/hooks/queries/tournaments';
import { teamColor, monogram } from '@/components/tournament/ui';
import '@/styles/vision.css';

// ── Fase → etiqueta y color (ES) ─────────────────────────────────────────────
const PHASE_META: Record<string, { label: string; cls: string }> = {
  registration: { label: 'Inscripciones', cls: 'text-emerald-300 border-emerald-400/30 bg-emerald-400/10' },
  checkin:      { label: 'Check-in',      cls: 'text-amber-300 border-amber-400/30 bg-amber-400/10' },
  active:       { label: 'En curso',      cls: 'text-sky-300 border-sky-400/30 bg-sky-400/10' },
  complete:     { label: 'Finalizado',    cls: 'text-white/40 border-white/15 bg-white/5' },
};

function PhaseChip({ phase }: { phase: string }) {
  const m = PHASE_META[phase] ?? { label: phase, cls: 'text-white/40 border-white/15 bg-white/5' };
  return (
    <span className={`inline-flex items-center h-[22px] px-2.5 rounded-full border text-[10.5px] font-semibold whitespace-nowrap ${m.cls}`}>
      {m.label}
    </span>
  );
}

/** Monograma de equipo con el mismo color determinista que usa el torneo. */
function TeamMark({ name, size = 44 }: { name: string; size?: number }) {
  const c = teamColor(name);
  return (
    <span
      className="inline-flex items-center justify-center rounded-xl font-black flex-shrink-0"
      style={{
        width: size, height: size,
        background: 'rgba(255,255,255,0.04)',
        boxShadow: `inset 0 0 0 1.5px ${c}`,
        color: c, fontSize: Math.round(size * 0.34),
      }}
    >
      {monogram(name)}
    </span>
  );
}

function CopyBtn({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      onClick={() => { navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 2000); }}
      className="inline-flex items-center gap-2 h-9 px-3.5 rounded-xl bg-red-500/10 border border-red-500/30
        text-red-200 text-xs font-mono hover:bg-red-500/20 transition w-full justify-center"
      title="Copiar código de partida"
    >
      {ok ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
      <span className="truncate">{ok ? '¡Copiado!' : text}</span>
    </button>
  );
}

function SectionHeader({ icon, title, count, sub }: {
  icon: React.ReactNode; title: string; count?: number; sub?: string;
}) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <span className="vs-ico" style={{ width: 38, height: 38 }}>{icon}</span>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="text-[15px] font-bold text-white leading-none">{title}</h3>
          {count != null && (
            <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full
              bg-white/[0.07] text-[11px] font-bold text-white/60">
              {count}
            </span>
          )}
        </div>
        {sub && <p className="text-xs text-white/40 mt-1">{sub}</p>}
      </div>
    </div>
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
      <div className="vs-card flex items-center gap-2 text-white/40 text-sm px-6 py-8">
        <Loader2 className="h-4 w-4 animate-spin" /> Cargando torneos…
      </div>
    );
  }

  if (!data) return null;
  const { invitations, myTeams, administrating, linkedRiotId } = data;
  const hasContent = invitations.length > 0 || myTeams.length > 0 || administrating.length > 0;

  // ── Estado vacío: invitación a explorar, no un párrafo suelto ──────────────
  if (!hasContent) {
    return (
      <div className="vs-card px-6 py-10 text-center">
        <span className="vs-ico mx-auto mb-4" style={{ width: 52, height: 52 }}>
          <Trophy size={24} />
        </span>
        <h3 className="text-lg font-bold text-white mb-1">Aún no compites en ningún torneo</h3>
        <p className="text-sm text-white/45 max-w-sm mx-auto mb-5">
          Cuando te inscriban en un equipo, tus invitaciones y códigos de partida aparecerán aquí.
        </p>
        <Link to="/tournaments" className="vs-btn" style={{ textDecoration: 'none', height: 40, fontSize: 13 }}>
          Explorar torneos <ArrowRight size={15} />
        </Link>
      </div>
    );
  }

  return (
    <div className="vs-card" style={{ padding: 24 }}>
      {/* Cabecera del bloque */}
      <div className="flex items-center justify-between gap-3 mb-5 pb-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <span className="vs-ico"><Trophy size={20} /></span>
          <div>
            <h2 className="text-base font-bold text-white leading-none">Mis torneos</h2>
            <p className="text-xs text-white/40 mt-1">
              {myTeams.length > 0 && `${myTeams.length} equipo${myTeams.length > 1 ? 's' : ''}`}
              {myTeams.length > 0 && administrating.length > 0 && ' · '}
              {administrating.length > 0 && `${administrating.length} como organizador`}
              {invitations.length > 0 && ` · ${invitations.length} invitación${invitations.length > 1 ? 'es' : ''} pendiente${invitations.length > 1 ? 's' : ''}`}
            </p>
          </div>
        </div>
        <Link to="/tournaments" className="hidden sm:inline-flex items-center gap-1.5 text-xs font-bold text-red-400 hover:text-red-300 transition-colors">
          Ver todos <ArrowRight size={13} />
        </Link>
      </div>

      <div className="space-y-6">
        {/* ── Invitaciones pendientes ── */}
        {invitations.length > 0 && (
          <section>
            <SectionHeader icon={<Users size={17} />} title="Invitaciones pendientes" count={invitations.length} />
            <div className="space-y-2">
              {invitations.map(inv => (
                <motion.div
                  key={inv.id}
                  layout
                  className="flex flex-wrap items-center gap-3 p-3.5 rounded-2xl
                    bg-red-500/[0.05] border border-red-500/20"
                >
                  <TeamMark name={inv.teamName || inv.tournamentName} size={40} />
                  <div className="flex-1 min-w-[180px]">
                    <p className="font-semibold text-white text-sm">{inv.tournamentName}</p>
                    {inv.teamName ? (
                      <p className="text-xs text-white/50">
                        Equipo <span className="text-red-400 font-semibold">{inv.teamName}</span>
                        {' · '}slot {inv.playerName || inv.slotIndex + 1}
                      </p>
                    ) : (
                      // Invitación de ACCESO a torneo privado (sin equipo): al
                      // aceptar puedes ver el torneo e inscribir tu propio equipo.
                      <p className="text-xs text-amber-300/90">
                        Torneo privado · te invitaron a participar — inscribe a tu equipo al aceptar
                      </p>
                    )}
                    {!linkedRiotId && inv.teamName && (
                      <p className="text-[11px] text-amber-400/90 mt-1">
                        ⚠ Vincula tu Riot ID antes de aceptar
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      disabled={respond.isPending}
                      onClick={() => respond.mutate({ invId: inv.id, action: 'decline' })}
                      className="vs-btn vs-btn--ghost"
                      style={{ height: 36, padding: '0 14px', fontSize: 12.5 }}
                    >
                      Rechazar
                    </button>
                    <button
                      disabled={respond.isPending || (!linkedRiotId && !!inv.teamName)}
                      onClick={() => acceptInvite(inv.id)}
                      className="vs-btn"
                      style={{ height: 36, padding: '0 16px', fontSize: 12.5 }}
                    >
                      Aceptar
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          </section>
        )}

        {/* ── Mis equipos ── */}
        {myTeams.length > 0 && (
          <section>
            <SectionHeader
              icon={<Swords size={17} />}
              title="Mis equipos"
              count={myTeams.length}
              sub="Tus inscripciones activas y códigos de partida"
            />
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {myTeams.map(team => (
                <div
                  key={`${team.tournamentId}-${team.teamName}`}
                  className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-4 flex flex-col gap-3
                    transition-colors hover:border-red-500/25"
                >
                  {/* Cabecera del equipo */}
                  <div className="flex items-start gap-3">
                    <TeamMark name={team.teamName} />
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-white text-[15px] leading-tight truncate">{team.teamName}</p>
                      <p className="text-xs text-white/45 truncate mt-0.5">{team.tournamentName}</p>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <PhaseChip phase={team.phase} />
                        {team.isCaptain && (
                          <span className="inline-flex items-center gap-1 h-[22px] px-2.5 rounded-full border
                            border-yellow-400/30 bg-yellow-400/10 text-[10.5px] font-semibold text-yellow-300">
                            <Crown className="h-3 w-3" /> Capitán
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Código de partida activo */}
                  {team.activeMatchCode ? (
                    <div className="rounded-xl bg-black/25 border border-white/[0.05] p-3">
                      <p className="text-[10px] text-red-300/90 uppercase tracking-[0.14em] font-bold mb-2 flex items-center gap-1.5">
                        <Zap className="h-3 w-3" /> Código de partida
                      </p>
                      <CopyBtn text={team.activeMatchCode} />
                    </div>
                  ) : team.phase === 'complete' ? (
                    <p className="text-[11px] text-white/30">
                      Torneo finalizado — revisa las estadísticas en la página del torneo.
                    </p>
                  ) : null}

                  {/* Acciones */}
                  <div className="mt-auto pt-2 border-t border-white/[0.05] flex items-center justify-between">
                    <Link
                      to={`/tournaments/${team.tournamentId}`}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-red-400 hover:text-red-300 transition-colors"
                    >
                      Ver torneo <ArrowRight size={13} />
                    </Link>
                    {(team.phase === 'complete' || team.phase === 'active') && (
                      <Link
                        to={`/tournaments/${team.tournamentId}/live`}
                        className="text-[11px] text-white/40 hover:text-white/70 transition-colors"
                      >
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
          <section>
            <SectionHeader
              icon={<Shield size={17} />}
              title="Torneos que administro"
              count={administrating.length}
            />
            <div className="space-y-2">
              {administrating.map(t => {
                const pct = t.maxParticipants > 0
                  ? Math.min(100, Math.round((t.participants / t.maxParticipants) * 100))
                  : 0;
                return (
                  <Link
                    key={t.id}
                    to={`/tournaments/${t.id}`}
                    className="flex items-center gap-4 p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.06]
                      hover:border-[#c8aa6e]/40 transition-colors group"
                  >
                    <span className="vs-ico vs-ico--gold" style={{ width: 40, height: 40 }}>
                      <Shield size={17} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-white text-sm truncate">{t.name}</p>
                        <PhaseChip phase={t.phase} />
                      </div>
                      <div className="flex items-center gap-3 mt-2">
                        <div className="flex-1 max-w-[220px] h-1.5 rounded-full bg-white/[0.07] overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${pct}%`,
                              background: 'linear-gradient(90deg, #7d1017, #e1242e)',
                              transition: 'width .5s ease',
                            }}
                          />
                        </div>
                        <span className="text-[11px] text-white/45 whitespace-nowrap font-mono">
                          {t.participants}/{t.maxParticipants} equipos
                          {t.codesAvailable != null ? ` · ${t.codesAvailable} códigos` : ''}
                        </span>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-[#c8aa6e] whitespace-nowrap
                      opacity-70 group-hover:opacity-100 transition-opacity">
                      Administrar →
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
