// ATAK.GG — Dashboard de torneo (extraído del componente único original).
// Sin cambios de comportamiento.

import { useMemo, useState } from 'react';
import { Users } from 'lucide-react';
import { Button, StatusChip, TeamBadge, ProgressBar, SectionHead } from '@/components/tournament/ui';
import { Tip } from '@/components/ui/Tip';
import { TournamentTeamModal } from '@/components/TournamentTeamModal';
import { useRegistrations, type TdBoardPayload } from '@/hooks/queries/tournaments';
import { useDiscoveryNav } from '@/hooks/useTournamentDiscovery';
import { useProfileIcons, iconFor } from '@/hooks/useProfileIcons';
import { dd } from '@/lib/dataDragon';
import { RED, Card, Block, EmptyState, ErrorCard } from './shared';

export function EquiposTab({ id, region, standings }: {
  id: string; region: string; standings: TdBoardPayload['standings'];
}) {
  const { data: regs, isLoading, isError, error, refetch } = useRegistrations(id);

  if (isError) {
    return (
      <ErrorCard
        message={(error as any)?.response?.data?.error ?? (error as any)?.message ?? 'No se pudieron cargar los equipos'}
        onRetry={() => refetch()}
      />
    );
  }
  if (isLoading || !regs) return <Block h={260} r={16} />;
  if (!regs.length) {
    return (
      <Card>
        <SectionHead icon={<Users size={14} color={RED} />} title="EQUIPOS INSCRITOS" />
        <EmptyState>Aún no hay equipos inscritos</EmptyState>
      </Card>
    );
  }

  return <TeamsBoard regs={regs} id={id} region={region} standings={standings} />;
}

// Tablero de equipos: buscador + orden + tarjetas con estado de plantilla.
// Antes cada jugador sin confirmar pintaba un chip rojo "PENDIENTE": con 7
// jugadores por equipo la rejilla era una pared de alertas y no se distinguía
// lo importante (qué equipo está listo para jugar).

function TeamsBoard({ regs, id, region, standings }: {
  regs: NonNullable<ReturnType<typeof useRegistrations>['data']>;
  id: string; region: string; standings: TdBoardPayload['standings'];
}) {
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<'estado' | 'nombre' | 'plantilla'>('estado');
  // El equipo abierto puede venir de un click o de `?team=` (muestra del
  // descubrimiento / enlace compartido). Al cerrar se limpia el parámetro para
  // que no se vuelva a abrir al navegar entre pestañas.
  const { params: navParams, clearParam } = useDiscoveryNav();
  const [clicked, setClicked] = useState<string | null>(null);
  const urlTeam = navParams.get('team');
  const openTeam = clicked ?? urlTeam;
  const setOpenTeam = (name: string | null) => setClicked(name);
  const closeTeam = () => { setClicked(null); if (urlTeam) clearParam('team'); };

  // Iconos de perfil de LoL de todos los jugadores inscritos (una llamada batch).
  const allRiotIds = useMemo(
    () => regs.flatMap((r) => (r.players ?? []).map((p) => p.riotId || '')).filter(Boolean),
    [regs],
  );
  const { data: iconMap } = useProfileIcons(`teams-${id}`, allRiotIds, region || 'la1');

  const confirmedOf = (r: (typeof regs)[number]) =>
    (r.players ?? []).filter((p) => p.inviteStatus !== 'pending').length;

  const view = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = regs.filter((r) => {
      if (!needle) return true;
      const hay = [r.teamName, r.captainRiotId, ...(r.players ?? []).map((p) => p.riotId || p.name)]
        .filter(Boolean).join(' ').toLowerCase();
      return hay.includes(needle);
    });
    return [...list].sort((a, b) => {
      if (sort === 'nombre') return a.teamName.localeCompare(b.teamName);
      if (sort === 'plantilla') return (b.players?.length ?? 0) - (a.players?.length ?? 0);
      return Number(b.checkedIn) - Number(a.checkedIn) || a.teamName.localeCompare(b.teamName);
    });
  }, [regs, q, sort]);

  const ready = regs.filter((r) => r.checkedIn).length;
  const totalPlayers = regs.reduce((acc, r) => acc + (r.players?.length ?? 0), 0);

  const SORTS: Array<{ k: typeof sort; label: string }> = [
    { k: 'estado', label: 'Check-in' },
    { k: 'nombre', label: 'A-Z' },
    { k: 'plantilla', label: 'Plantilla' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Barra de control */}
      <div className="td-panel td-teams-bar" style={{ padding: '12px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <span className="td-ico" style={{ color: RED }}><Users size={16} /></span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--td-text)' }}>
              {regs.length} equipos inscritos
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--td-muted)' }}>
              {ready} con check-in · {totalPlayers} jugadores registrados
            </div>
          </div>
        </div>

        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar equipo, capitán o jugador…"
          className="td-teams-search"
          style={{
            height: 38, borderRadius: 999, padding: '0 16px', minWidth: 0,
            background: 'var(--td-subcard)', border: '1px solid var(--td-border)',
            color: 'var(--td-text)', fontSize: 13, fontFamily: 'var(--td-font-ui)', outline: 'none',
          }}
        />

        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          {SORTS.map((s) => (
            <button
              key={s.k}
              onClick={() => setSort(s.k)}
              style={{
                height: 32, padding: '0 13px', borderRadius: 999, cursor: 'pointer',
                fontSize: 12, fontWeight: 600, fontFamily: 'var(--td-font-ui)',
                background: sort === s.k ? 'rgba(232,50,60,0.12)' : 'transparent',
                color: sort === s.k ? '#fff' : 'var(--td-text-2)',
                border: `1px solid ${sort === s.k ? 'var(--td-red-glow)' : 'var(--td-border)'}`,
                transition: 'background .15s, border-color .15s, color .15s',
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {!view.length ? (
        <Card>
          <div className="td-filter-empty">
            <Users size={28} color="var(--td-muted)" style={{ opacity: .5 }} />
            <span style={{ fontSize: 13, color: 'var(--td-text-2)' }}>Ningún equipo coincide con «{q}»</span>
            <Button variant="secondary" onClick={() => setQ('')}>Limpiar búsqueda</Button>
          </div>
        </Card>
      ) : (
        <div className="td-dash-teams">
          {view.map((r) => {
            const players = r.players ?? [];
            const confirmed = confirmedOf(r);
            const pct = players.length ? (confirmed / players.length) * 100 : 0;
            return (
              <Tip key={r.teamName} label="Click para stats del equipo y jugadores">
              <div
                className="td-panel td-hoverable td-card-in"
                style={{ overflow: 'hidden', cursor: 'pointer' }}
                role="button"
                tabIndex={0}
                aria-label={`Ver análisis de ${r.teamName}`}
                onClick={() => setOpenTeam(r.teamName)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpenTeam(r.teamName); } }}
              >
                {/* Cabecera */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 11, padding: 16,
                  borderBottom: '1px solid var(--td-border-soft)',
                  background: r.checkedIn
                    ? 'linear-gradient(90deg, rgba(74,222,128,0.07), transparent 60%)'
                    : 'transparent',
                }}>
                  <TeamBadge name={r.teamName} size={38} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--td-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.teamName}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--td-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      Capitán · {r.captainRiotId || '—'} · <span style={{ color: RED }}>ver análisis →</span>
                    </div>
                  </div>
                  {r.checkedIn
                    ? <StatusChip kind="pos" dot={false}>LISTO</StatusChip>
                    : <StatusChip kind="dim" dot={false}>SIN CHECK-IN</StatusChip>}
                </div>

                {/* Estado de plantilla: una barra en vez de N chips rojos */}
                <div style={{ padding: '12px 16px 10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <span className="td-over" style={{ flexShrink: 0 }}>PLANTILLA</span>
                    <div style={{ flex: 1 }}>
                      <ProgressBar kind={pct === 100 ? '#4ade80' : '#f59e0b'} pct={pct} height={5} />
                    </div>
                    <span className="td-num" style={{
                      fontSize: 12, fontWeight: 700, flexShrink: 0,
                      color: pct === 100 ? 'var(--td-green)' : 'var(--td-text-2)',
                    }}>
                      {confirmed}/{players.length}
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {players.map((p, i) => {
                      const pending = p.inviteStatus === 'pending';
                      const icon = iconFor(iconMap, p.riotId);
                      return (
                        <div key={i} className="td-roster-row">
                          <span className="td-num" style={{ fontSize: 11, color: 'var(--td-muted)', width: 16, flexShrink: 0 }}>
                            {i + 1}
                          </span>
                          {/* Icono de invocador de LoL; el punto de estado pasa a badge encima */}
                          <span style={{ position: 'relative', flexShrink: 0, width: 24, height: 24 }}>
                            {icon ? (
                              <img
                                src={dd.profileIcon(icon)} alt="" loading="lazy"
                                style={{
                                  width: 24, height: 24, borderRadius: 7, objectFit: 'cover', display: 'block',
                                  filter: pending ? 'grayscale(0.8) brightness(0.7)' : 'none',
                                  boxShadow: '0 0 0 1px var(--td-border-hov)',
                                }}
                                onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }}
                              />
                            ) : (
                              <span style={{
                                width: 24, height: 24, borderRadius: 7, display: 'flex', alignItems: 'center',
                                justifyContent: 'center', background: 'var(--td-sunken)',
                                fontSize: 10, fontWeight: 700, color: 'var(--td-muted)',
                              }}>
                                {(p.riotId || p.name || '?')[0]?.toUpperCase()}
                              </span>
                            )}
                            <span style={{
                              position: 'absolute', right: -2, bottom: -2,
                              width: 7, height: 7, borderRadius: '50%',
                              border: '1.5px solid var(--td-card)',
                              background: pending ? 'var(--td-amber)' : 'var(--td-green)',
                            }} />
                          </span>
                          <span style={{
                            flex: 1, minWidth: 0, fontSize: 12.5,
                            color: pending ? 'var(--td-muted)' : 'var(--td-text)',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {p.riotId || p.name}
                          </span>
                          {pending && (
                            <span style={{ fontSize: 10.5, color: 'var(--td-amber)', flexShrink: 0 }}>pendiente</span>
                          )}
                        </div>
                      );
                    })}
                    {!players.length && <EmptyState>Sin jugadores registrados</EmptyState>}
                  </div>
                </div>
              </div>
              </Tip>
            );
          })}
        </div>
      )}

      {/* Modal de análisis del equipo */}
      {openTeam && (() => {
        const r = regs.find((x) => x.teamName === openTeam);
        if (!r) return null;
        return (
          <TournamentTeamModal
            tournamentId={id}
            region={region}
            reg={r}
            standing={standings.find((s) => s.name === r.teamName) ?? null}
            onClose={closeTeam}
          />
        );
      })()}
    </div>
  );
}

// ── PARTIDAS: bracket crudo + stats reales por partido ───────────────────────
// Estados reales de BracketMatch.matchStatus (backend): pending | ready |
// active | complete. Las pills los etiquetan en español; nada de enums inventados.
