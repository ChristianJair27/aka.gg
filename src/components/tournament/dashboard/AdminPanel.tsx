// ATAK.GG — Dashboard de torneo (extraído del componente único original).
// Sin cambios de comportamiento.

import { ReactNode, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { axiosInstance } from '@/lib/axios';
import { qk } from '@/hooks/queries/keys';
import { toast } from 'sonner';
import {
  Settings2, Lock, KeySquare, FolderSync, Play, Check, Trophy, Users, Network,
  Mail, Send, ChevronDown, ChevronUp, RefreshCw, Zap, ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/tournament/ui';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  useCloseRegistration, useStartTournament, useGenerateCodes, useSyncGames,
  useRegistrations,
} from '@/hooks/queries/tournaments';
import { RED, Card } from './shared';

export function AdminPanel({ id, phase, bracketType, seriesTo, finalSeriesTo, swissRounds, isPrivate, discordWebhookUrl, playoffsSize }: {
  id: string; phase: string; bracketType?: string; seriesTo?: number; finalSeriesTo?: number;
  swissRounds?: number | null; isPrivate?: boolean; discordWebhookUrl?: string | null;
  playoffsSize?: number;
}) {
  // Plegado por defecto; la preferencia del organizador persiste.
  const [adminOpen, setAdminOpen] = useState(() => {
    try { return window.localStorage.getItem('td-admin-open') === '1'; } catch { return false; }
  });
  useEffect(() => {
    try { window.localStorage.setItem('td-admin-open', adminOpen ? '1' : '0'); } catch { /* sin persistencia */ }
  }, [adminOpen]);

  const closeReg = useCloseRegistration(id);
  const start    = useStartTournament(id);
  const codes    = useGenerateCodes(id);
  const sync     = useSyncGames(id);
  const qc       = useQueryClient();
  const [savingType, setSavingType] = useState(false);
  const canPickFormat = phase === 'registration' || phase === 'checkin';

  const patchT = async (body: object, okMsg: string) => {
    if (savingType) return;
    setSavingType(true);
    try {
      await axiosInstance.patch(`/api/tournaments/${id}`, body);
      qc.invalidateQueries({ queryKey: qk.tournamentBoard(id) });
      qc.invalidateQueries({ queryKey: qk.bracket(id) });
      toast.success(okMsg);
    } catch (e: any) {
      toast.error(e?.response?.data?.error ?? 'No se pudo guardar');
    } finally { setSavingType(false); }
  };
  const setType = (bt: string, label: string) => bt !== bracketType && patchT({ bracketType: bt }, `Formato: ${label}`);

  const [roundBusy, setRoundBusy] = useState(false);
  const nextRound = async () => {
    setRoundBusy(true);
    try {
      const { data } = await axiosInstance.post(`/api/tournaments/${id}/next-round`);
      toast.success(`Ronda ${data.round} generada (${data.matches?.length ?? 0} partidos con código)`);
      qc.invalidateQueries({ queryKey: qk.tournamentBoard(id) });
      qc.invalidateQueries({ queryKey: qk.bracket(id) });
    } catch (e: any) {
      toast.error(e?.response?.data?.error ?? 'No se pudo generar la ronda');
    } finally { setRoundBusy(false); }
  };
  const completeT = async () => {
    if (!window.confirm('¿Cerrar el torneo? El líder de la clasificación queda como campeón.')) return;
    try {
      const { data } = await axiosInstance.post(`/api/tournaments/${id}/complete`);
      toast.success(data.champion ? `Campeón: ${data.champion}` : 'Torneo finalizado');
      qc.invalidateQueries({ queryKey: qk.tournamentBoard(id) });
    } catch (e: any) {
      toast.error(e?.response?.data?.error ?? 'No se pudo finalizar');
    }
  };

  const actions: Array<{ show: boolean; label: string; icon: ReactNode; onClick: () => void; pending: boolean; primary?: boolean }> = [
    { show: phase === 'registration', label: 'CERRAR INSCRIPCIONES', icon: <Lock size={14} />, onClick: () => closeReg.mutate(), pending: closeReg.isPending },
    { show: phase === 'registration' || phase === 'checkin', label: 'INICIAR TORNEO', icon: <Play size={14} />, onClick: () => start.mutate(), pending: start.isPending, primary: true },
    { show: phase === 'active', label: 'GENERAR CÓDIGOS', icon: <KeySquare size={14} />, onClick: () => codes.mutate(20), pending: codes.isPending },
    { show: phase === 'active' || phase === 'complete', label: 'SINCRONIZAR PARTIDAS', icon: <FolderSync size={14} />, onClick: () => sync.mutate(), pending: sync.isPending, primary: phase === 'active' },
    { show: phase === 'active' && bracketType === 'swiss', label: 'SIGUIENTE RONDA', icon: <ArrowRight size={14} />, onClick: nextRound, pending: roundBusy, primary: true },
    { show: phase === 'active' && bracketType === 'swiss', label: 'FINALIZAR TORNEO', icon: <Trophy size={14} />, onClick: completeT, pending: false },
  ];
  const visible = actions.filter(a => a.show);

  // ── Mover jugador de equipo (typos de nombre → equipos duplicados) ──
  const canMovePlayers = phase === 'registration' || phase === 'checkin';
  const { data: regsData } = useRegistrations(id);
  const regs: any[] = Array.isArray(regsData) ? regsData : [];
  const [moveFrom, setMoveFrom] = useState('');
  const [movePlayer, setMovePlayer] = useState('');
  const [moveTo, setMoveTo] = useState('');
  const [moveBusy, setMoveBusy] = useState(false);
  const fromReg = regs.find(r => r.teamName === moveFrom);
  const doMovePlayer = async () => {
    if (!moveFrom || !movePlayer || !moveTo) { toast.error('Elige equipo origen, jugador y destino'); return; }
    if (!window.confirm(`¿Mover a ${movePlayer} de "${moveFrom}" a "${moveTo}"?${(fromReg?.players?.length ?? 0) <= 1 ? ` El equipo "${moveFrom}" quedará vacío y se eliminará.` : ''}`)) return;
    setMoveBusy(true);
    try {
      const { data } = await axiosInstance.post(`/api/tournaments/${id}/registrations/move-player`, {
        fromTeam: moveFrom, toTeam: moveTo, riotId: movePlayer,
      });
      toast.success(`${data.moved} ahora está en ${data.to}`, {
        description: data.sourceDeleted ? `El equipo "${data.from}" quedó vacío y se eliminó.` : undefined,
      });
      setMoveFrom(''); setMovePlayer(''); setMoveTo('');
      qc.invalidateQueries({ queryKey: qk.registrations(id) });
      qc.invalidateQueries({ queryKey: qk.tournamentBoard(id) });
    } catch (e: any) {
      toast.error(e?.response?.data?.error ?? 'No se pudo mover al jugador');
    } finally { setMoveBusy(false); }
  };

  // ── Invitados (torneo privado): invitar por correo + lista de accesos ──
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteBusy, setInviteBusy] = useState(false);
  const [invites, setInvites] = useState<Array<{ id: number; status: string; email: string; name: string | null }> | null>(null);
  const loadInvites = () => {
    axiosInstance.get(`/api/tournaments/${id}/invites`)
      .then(r => setInvites(Array.isArray(r.data) ? r.data : []))
      .catch(() => setInvites([]));
  };
  useEffect(() => { if (isPrivate) loadInvites(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [isPrivate, id]);
  const sendInvite = async () => {
    const email = inviteEmail.trim();
    if (!email.includes('@')) { toast.error('Correo inválido'); return; }
    setInviteBusy(true);
    try {
      const { data } = await axiosInstance.post(`/api/tournaments/${id}/invite`, { email });
      toast.success(data.message || 'Invitación enviada');
      setInviteEmail('');
      loadInvites();
    } catch (e: any) {
      toast.error(e?.response?.data?.error ?? 'No se pudo invitar');
    } finally { setInviteBusy(false); }
  };

  // ── Discord webhook del torneo ──
  const [webhookDraft, setWebhookDraft] = useState(discordWebhookUrl ?? '');
  const saveWebhook = () => patchT(
    { discordWebhookUrl: webhookDraft.trim() },
    webhookDraft.trim() ? 'Discord conectado — avisos de códigos, resultados y campeón' : 'Webhook de Discord eliminado',
  );

  if (!visible.length && !canPickFormat && !isPrivate) return null;

  // Guía de fase: qué sigue, en lenguaje claro
  const stepHint =
    phase === 'registration' ? 'Paso 1 · Elige formato y series. Los equipos ya pueden hacer check-in desde ahora; cuando el cupo esté listo cierra inscripciones o inicia directo.'
    : phase === 'checkin' ? 'Paso 2 · Los equipos hacen check-in. Cuando estén listos, inicia el torneo (genera la ronda 1 con códigos).'
    : phase === 'active' && bracketType === 'swiss' ? 'Torneo en curso · Al terminar todos los partidos de la ronda, genera la siguiente. Cierra el torneo tras la última ronda.'
    : phase === 'active' ? 'Torneo en curso · Los resultados y stats se detectan solos; sincroniza si algo tarda.'
    : 'Torneo finalizado.';

  const OptionBtn = ({ active, accent, label, hint, onClick }: {
    active: boolean; accent: string; label: string; hint: string; onClick: () => void;
  }) => (
    <button onClick={onClick} disabled={savingType}
      style={{
        flex: '1 1 130px', minWidth: 130, textAlign: 'left', cursor: 'pointer',
        padding: '10px 12px', borderRadius: 12, border: '1px solid',
        borderColor: active ? accent : 'var(--td-border)',
        background: active ? 'rgba(232,50,60,0.10)' : 'rgba(255,255,255,0.02)',
        transition: 'border-color .15s, background .15s',
      }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <span style={{
          width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
          background: active ? accent : 'var(--td-border-hov)',
          boxShadow: active ? `0 0 8px ${accent}` : undefined,
        }} />
        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.5px', color: active ? '#fff' : 'var(--td-text-2)' }}>{label}</span>
      </div>
      <div style={{ fontSize: 10.5, color: 'var(--td-muted)', marginTop: 3, lineHeight: 1.35 }}>{hint}</div>
    </button>
  );

  return (
    // Plegado por defecto: abierto empujaba Clasificación y el directo por
    // debajo del pliegue en cada visita del organizador. La preferencia se
    // recuerda en td-admin-open.
    <Collapsible open={adminOpen} onOpenChange={setAdminOpen}>
      <Card accent="var(--td-red-glow)" style={{ marginTop: 16, padding: 16 }}>
      {/* Encabezado + guía de fase */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', marginBottom: adminOpen ? 12 : 0 }}>
        <CollapsibleTrigger asChild>
          <button type="button" className="td-collapse-trigger" style={{ color: RED }}>
            {adminOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            <Settings2 size={14} />
            {adminOpen ? 'Ocultar administración' : 'Panel de administración'}
          </button>
        </CollapsibleTrigger>
        {adminOpen && <span style={{ fontSize: 12, color: 'var(--td-text-2)' }}>{stepHint}</span>}
      </div>

      <CollapsibleContent>
      <div className="td-admin-grid">
        {/* Configuración (solo antes de iniciar) */}
        {canPickFormat && (
          <>
            <div>
              <div className="td-over" style={{ marginBottom: 8 }}>FORMATO DEL TORNEO</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <OptionBtn active={bracketType === 'single_elim'} accent="var(--td-red)" label="ELIMINACIÓN"
                  hint="Pierdes y quedas fuera. Bracket clásico." onClick={() => setType('single_elim', 'Eliminación directa')} />
                <OptionBtn active={bracketType === 'round_robin'} accent="var(--td-red)" label="LIGA · RR"
                  hint="Todos contra todos por jornadas." onClick={() => setType('round_robin', 'Round Robin')} />
                <OptionBtn active={bracketType === 'swiss'} accent="var(--td-red)" label="SUIZO"
                  hint="Pareos por récord cada ronda, sin revanchas." onClick={() => setType('swiss', 'Suizo')} />
              </div>
            </div>
            <div>
              <div className="td-over" style={{ marginBottom: 8 }}>SERIES POR ENFRENTAMIENTO</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <OptionBtn active={seriesTo === 1} accent="var(--td-amber)" label="BO1"
                  hint="Un juego decide cada enfrentamiento." onClick={() => patchT({ seriesTo: 1, finalSeriesTo: 1 }, 'Series: Bo1')} />
                <OptionBtn active={seriesTo === 2 && finalSeriesTo === 2} accent="var(--td-amber)" label="BO3"
                  hint="Gana el primero en llegar a 2 victorias." onClick={() => patchT({ seriesTo: 2, finalSeriesTo: 2 }, 'Series: Bo3')} />
                <OptionBtn active={seriesTo === 2 && finalSeriesTo === 3} accent="var(--td-amber)" label="BO3 · FINAL BO5"
                  hint="Bo3 todo el torneo; la final a 3 victorias." onClick={() => patchT({ seriesTo: 2, finalSeriesTo: 3 }, 'Series: Bo3, final Bo5')} />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Visibilidad: público (lista abierta) o privado (solo invitados) */}
      <div style={{ marginTop: 14 }}>
        <div className="td-over" style={{ marginBottom: 8 }}>VISIBILIDAD</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <OptionBtn active={!isPrivate} accent="var(--td-green)" label="PÚBLICO"
            hint="Aparece en la lista de torneos; cualquiera se inscribe."
            onClick={() => isPrivate && patchT({ isPrivate: false }, 'Torneo público')} />
          <OptionBtn active={!!isPrivate} accent="var(--td-amber)" label="PRIVADO"
            hint="Oculto al público; solo entran los que invites por correo."
            onClick={() => !isPrivate && patchT({ isPrivate: true }, 'Torneo privado — invita por correo abajo')} />
        </div>
      </div>

      {/* Invitados del torneo privado: correo → invitación por email + acceso */}
      {isPrivate && (
        <div style={{ marginTop: 14 }}>
          <div className="td-over" style={{ marginBottom: 8, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Mail size={12} /> INVITADOS · SOLO ELLOS PUEDEN VER E INSCRIBIRSE
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); sendInvite(); } }}
              placeholder="correo@delcapitan.com (debe tener cuenta ATAK.GG)"
              style={{
                flex: '1 1 260px', height: 38, padding: '0 12px', fontSize: 13,
                background: 'rgba(0,0,0,0.35)', border: '1px solid var(--td-border)',
                borderRadius: 10, color: '#fff', outline: 'none',
              }}
            />
            <Button variant="primary" icon={<Send size={13} />} disabled={inviteBusy} onClick={sendInvite}>
              {inviteBusy ? '...' : 'INVITAR'}
            </Button>
          </div>
          {invites && invites.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
              {invites.map(inv => (
                <span key={inv.id} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '5px 10px', borderRadius: 999, fontSize: 11.5,
                  border: '1px solid var(--td-border)', background: 'rgba(255,255,255,0.03)',
                  color: 'var(--td-text-2)',
                }}>
                  <span style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: inv.status === 'accepted' ? 'var(--td-green)'
                      : inv.status === 'declined' ? 'var(--td-red)' : 'var(--td-amber)',
                  }} />
                  {inv.email}
                  <span style={{ color: 'var(--td-muted)' }}>
                    {inv.status === 'accepted' ? 'aceptó' : inv.status === 'declined' ? 'rechazó' : 'pendiente'}
                  </span>
                </span>
              ))}
            </div>
          )}
          <p style={{ margin: '8px 0 0', fontSize: 11.5, color: 'var(--td-muted)' }}>
            El invitado recibe un correo y la invitación en su dashboard; con ella puede ver el torneo e inscribir a su equipo.
          </p>
        </div>
      )}

      {/* Mover jugador: alguien escribió mal el nombre y creó un equipo nuevo */}
      {canMovePlayers && regs.length >= 2 && (
        <div style={{ marginTop: 14 }}>
          <div className="td-over" style={{ marginBottom: 8 }}>
            MOVER JUGADOR DE EQUIPO · para equipos duplicados por error de nombre
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <select
              value={moveFrom}
              onChange={(e) => { setMoveFrom(e.target.value); setMovePlayer(''); }}
              style={{
                height: 36, padding: '0 10px', fontSize: 12.5, minWidth: 150,
                background: 'rgba(0,0,0,0.35)', border: '1px solid var(--td-border)',
                borderRadius: 10, color: '#fff', outline: 'none',
              }}
            >
              <option value="" style={{ background: '#101014' }}>Equipo origen…</option>
              {regs.map((r: any) => (
                <option key={r.id} value={r.teamName} style={{ background: '#101014' }}>
                  {r.teamName} ({r.players?.length ?? 0})
                </option>
              ))}
            </select>
            <select
              value={movePlayer}
              onChange={(e) => setMovePlayer(e.target.value)}
              disabled={!fromReg}
              style={{
                height: 36, padding: '0 10px', fontSize: 12.5, minWidth: 170,
                background: 'rgba(0,0,0,0.35)', border: '1px solid var(--td-border)',
                borderRadius: 10, color: '#fff', outline: 'none', opacity: fromReg ? 1 : 0.5,
              }}
            >
              <option value="" style={{ background: '#101014' }}>Jugador…</option>
              {(fromReg?.players ?? []).map((p: any, i: number) => (
                <option key={i} value={p.riotId || p.name} style={{ background: '#101014' }}>
                  {p.riotId || p.name}
                </option>
              ))}
            </select>
            <ArrowRight size={14} color="var(--td-muted)" />
            <select
              value={moveTo}
              onChange={(e) => setMoveTo(e.target.value)}
              style={{
                height: 36, padding: '0 10px', fontSize: 12.5, minWidth: 150,
                background: 'rgba(0,0,0,0.35)', border: '1px solid var(--td-border)',
                borderRadius: 10, color: '#fff', outline: 'none',
              }}
            >
              <option value="" style={{ background: '#101014' }}>Equipo destino…</option>
              {regs.filter((r: any) => r.teamName !== moveFrom).map((r: any) => (
                <option key={r.id} value={r.teamName} style={{ background: '#101014' }}>
                  {r.teamName} ({r.players?.length ?? 0})
                </option>
              ))}
            </select>
            <Button variant="primary" disabled={moveBusy || !moveFrom || !movePlayer || !moveTo} onClick={doMovePlayer}>
              {moveBusy ? '...' : 'MOVER'}
            </Button>
          </div>
          <p style={{ margin: '6px 0 0', fontSize: 11.5, color: 'var(--td-muted)' }}>
            Conserva la verificación del jugador. Si el equipo origen queda vacío se elimina solo y se ajusta el cupo.
          </p>
        </div>
      )}

      {/* Discord del torneo: pega la URL del webhook y el torneo avisa solo */}
      <div style={{ marginTop: 14 }}>
        <div className="td-over" style={{ marginBottom: 8 }}>
          DISCORD · AVISOS AUTOMÁTICOS {discordWebhookUrl ? '· CONECTADO ✓' : ''}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            value={webhookDraft}
            onChange={(e) => setWebhookDraft(e.target.value)}
            placeholder="https://discord.com/api/webhooks/… (Ajustes del canal → Integraciones → Webhooks)"
            style={{
              flex: '1 1 320px', height: 38, padding: '0 12px', fontSize: 12.5,
              background: 'rgba(0,0,0,0.35)', border: '1px solid var(--td-border)',
              borderRadius: 10, color: '#fff', outline: 'none', fontFamily: 'var(--td-font-mono, monospace)',
            }}
          />
          <Button variant="secondary" disabled={savingType} onClick={saveWebhook}>
            {discordWebhookUrl ? 'ACTUALIZAR' : 'CONECTAR'}
          </Button>
        </div>
        <p style={{ margin: '6px 0 0', fontSize: 11.5, color: 'var(--td-muted)' }}>
          El canal recibe: código asignado (con horario), resultado de cada serie y campeón. El código en sí NO se publica — llega por correo a los equipos.
        </p>
      </div>

      {/* Piloto automático suizo: rondas planeadas → el sync avanza y cierra solo.
          Editable incluso con el torneo activo (es un interruptor, no toca lo jugado). */}
      {bracketType === 'swiss' && phase !== 'complete' && (
        <div style={{ marginTop: canPickFormat ? 14 : 0 }}>
          <div className="td-over" style={{ marginBottom: 8 }}>
            AVANCE AUTOMÁTICO · RONDAS PLANEADAS
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <OptionBtn active={!swissRounds} accent="var(--td-neutral)" label="MANUAL"
              hint="Tú generas cada ronda y cierras el torneo con los botones."
              onClick={() => swissRounds && patchT({ swissRounds: null }, 'Avance: manual')} />
            {[3, 4, 5].map((n) => (
              <OptionBtn key={n} active={swissRounds === n} accent="var(--td-green)" label={`${n} RONDAS`}
                hint={`Al completarse una ronda se genera la siguiente sola; la ronda ${n} usa las series de final y al terminar se cierra el torneo.`}
                onClick={() => swissRounds !== n && patchT({ swissRounds: n }, `Avance automático: ${n} rondas`)} />
            ))}
          </div>
          {swissRounds ? (
            <p style={{ margin: '8px 0 0', fontSize: 11.5, color: 'var(--td-green)' }}>
              ✓ Piloto automático activo: rondas y cierre del torneo sin intervención. Los botones manuales siguen disponibles por si necesitas corregir algo.
            </p>
          ) : (
            <p style={{ margin: '8px 0 0', fontSize: 11.5, color: 'var(--td-muted)' }}>
              Resultados y stats se detectan solos igualmente; esto solo automatiza el paso de ronda.
            </p>
          )}

          {/* Suizo → playoffs: qué pasa al terminar la fase suiza */}
          <div className="td-over" style={{ margin: '14px 0 8px' }}>
            AL TERMINAR LA FASE SUIZA
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <OptionBtn active={!playoffsSize} accent="var(--td-neutral)" label="SUIZO PURO"
              hint="El líder de la clasificación es el campeón directo."
              onClick={() => playoffsSize !== 0 && patchT({ playoffsSize: 0 }, 'Suizo puro: el líder de tabla es campeón')} />
            <OptionBtn active={playoffsSize === 4} accent="var(--td-red)" label="TOP 4 → PLAYOFFS"
              hint="Semifinales sembradas (1º vs 4º, 2º vs 3º) y gran final."
              onClick={() => playoffsSize !== 4 && patchT({ playoffsSize: 4 }, 'Playoffs top 4 al cerrar el suizo')} />
            <OptionBtn active={playoffsSize === 8} accent="var(--td-red)" label="TOP 8 → PLAYOFFS"
              hint="Cuartos sembrados, semifinales y gran final."
              onClick={() => playoffsSize !== 8 && patchT({ playoffsSize: 8 }, 'Playoffs top 8 al cerrar el suizo')} />
            <OptionBtn active={playoffsSize === 12} accent="var(--td-red)" label="TOP 12 → PLAYOFFS"
              hint="Octavos con BYE para los seeds 1-4 (descansan la primera ronda), luego cuartos, semis y gran final."
              onClick={() => playoffsSize !== 12 && patchT({ playoffsSize: 12 }, 'Playoffs top 12 al cerrar el suizo (1º-4º con BYE)')} />
          </div>
          <p style={{ margin: '8px 0 0', fontSize: 11.5, color: playoffsSize ? 'var(--td-green)' : 'var(--td-muted)' }}>
            {playoffsSize
              ? `✓ Al completarse la última ronda suiza se genera solo el bracket de playoffs (top ${playoffsSize} por tabla), con códigos y series Bo${(seriesTo || 1) * 2 - 1}; la gran final a Bo${(finalSeriesTo || seriesTo || 1) * 2 - 1}. El campeón es el ganador de la final.`
              : 'Con playoffs, la última serie Bo grande se reserva para la gran final del bracket en vez de la última ronda suiza.'}
          </p>
        </div>
      )}

      {/* Acciones */}
      {visible.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--td-border)' }}>
          {visible.map((a) => (
            <Button key={a.label} variant={a.primary ? 'primary' : 'secondary'} icon={a.icon}
              disabled={a.pending} onClick={a.onClick}>
              {a.pending ? '...' : a.label}
            </Button>
          ))}
        </div>
      )}
      </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

// ── SECONDARY TABS ───────────────────────────────────────────────────────────
