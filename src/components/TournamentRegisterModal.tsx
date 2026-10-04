// Tournament team registration — linked LoL account auto-fill + email invitations
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  AtakModal, AtakModalBody, AtakModalContent, AtakModalFooter,
} from '@/components/ui/atak-modal';
import { Button, StatusChip } from '@/components/tournament/ui';
import { ARENA_MODAL, Field, ModalHead, Notice, Seg } from '@/components/tournament/forms';
import { axiosInstance } from '@/lib/axios';
import { toast } from '@/components/ui/sonner';
import { useOverview } from '@/hooks/queries/players';
import { useAuth } from '@/features/auth/useAuth';
import { Plus, Loader2, Check, X, Crown, Users, Link2, Mail, Shield } from 'lucide-react';

interface PlayerSlot {
  name: string;
  riotId: string;
  inviteEmail: string;
  mode: 'riot' | 'invite';
}

interface TournamentRegisterModalProps {
  tournamentId: string;
  tournamentName: string;
  /** Tamaño de equipo del torneo (1-5). Default 5 para torneos previos. */
  teamSize?: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRegistered?: () => void;
}

const emptySlot = (): PlayerSlot => ({ name: '', riotId: '', inviteEmail: '', mode: 'riot' });
const emptyRoster = (n: number): PlayerSlot[] => Array.from({ length: n }, emptySlot);

const looksLikeRiotId = (v: string) => /^.+#.{2,}$/.test(v.trim());

export const TournamentRegisterModal = ({
  tournamentId, tournamentName, teamSize, open, onOpenChange, onRegistered,
}: TournamentRegisterModalProps) => {
  // Roster según formato: teamSize titulares + hasta 2 suplentes (0 en 1v1).
  const minPlayers = Math.min(5, Math.max(1, Number(teamSize) || 5));
  const maxPlayers = minPlayers === 1 ? 1 : Math.min(7, minPlayers + 2);
  const { isAuthenticated } = useAuth();
  // Solo con sesión: sin este guard, un visitante anónimo recibía 401 y el
  // interceptor lo mandaba a /login al abrir CUALQUIER torneo.
  const { data: overview } = useOverview(isAuthenticated);
  const linked = overview?.linked ? overview.profile : null;
  const linkedRiotId = linked?.gameName && linked?.tagLine
    ? `${linked.gameName}#${linked.tagLine}` : '';

  const [teamName, setTeamName] = useState('');
  const [contact, setContact] = useState('');
  const [players, setPlayers] = useState<PlayerSlot[]>(() => emptyRoster(minPlayers));
  const [loading, setLoading] = useState(false);

  // Ajusta el roster al tamaño del formato al abrir (recorta o rellena slots).
  useEffect(() => {
    if (!open) return;
    setPlayers(prev => {
      if (prev.length === minPlayers) return prev;
      return prev.length > maxPlayers
        ? prev.slice(0, maxPlayers)
        : [...prev, ...emptyRoster(Math.max(0, minPlayers - prev.length))];
    });
  }, [open, minPlayers, maxPlayers]);

  // Pre-fill captain slot (index 0) with linked account
  useEffect(() => {
    if (!open || !linkedRiotId) return;
    setPlayers(prev => prev.map((p, i) =>
      i === 0 ? { ...p, riotId: linkedRiotId, mode: 'riot' as const, name: p.name || linked?.gameName || '' } : p
    ));
  }, [open, linkedRiotId, linked?.gameName]);

  const handlePlayerChange = (index: number, field: keyof PlayerSlot, value: string) => {
    setPlayers(prev => prev.map((p, i) => (i === index ? { ...p, [field]: value } : p)));
  };

  const setPlayerMode = (index: number, mode: 'riot' | 'invite') => {
    setPlayers(prev => prev.map((p, i) =>
      i === index ? { ...p, mode, riotId: mode === 'invite' ? '' : p.riotId, inviteEmail: mode === 'riot' ? '' : p.inviteEmail } : p
    ));
  };

  const addPlayer = () => setPlayers(prev => (prev.length < maxPlayers ? [...prev, emptySlot()] : prev));
  const removePlayer = (index: number) =>
    setPlayers(prev => (prev.length > minPlayers ? prev.filter((_, i) => i !== index) : prev));

  const reset = () => {
    setTeamName(''); setContact(''); setPlayers(emptyRoster(minPlayers));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isAuthenticated) {
      toast.error('Inicia sesión para inscribir tu equipo');
      return;
    }
    if (!linkedRiotId) {
      toast.error('Vincula tu cuenta de LoL primero', {
        description: 'Ve a tu Dashboard y conecta tu Riot ID antes de inscribirte.',
      });
      return;
    }

    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      if (!p.name.trim()) {
        toast.error(`Nombre requerido en jugador ${i + 1}`);
        return;
      }
      if (p.mode === 'invite') {
        if (!p.inviteEmail.trim() || !p.inviteEmail.includes('@')) {
          toast.error(`Correo inválido en jugador ${i + 1}`);
          return;
        }
      } else if (!p.riotId.trim() || !looksLikeRiotId(p.riotId)) {
        toast.error(`Riot ID inválido en jugador ${i + 1}`, { description: 'Formato: Nombre#TAG' });
        return;
      }
    }

    setLoading(true);
    try {
      const payload = {
        teamName,
        captainRiotId: linkedRiotId,
        contact,
        players: players.map(p => ({
          name: p.name.trim(),
          ...(p.mode === 'invite'
            ? { inviteEmail: p.inviteEmail.trim() }
            : { riotId: p.riotId.trim() }),
        })),
      };
      const { data } = await axiosInstance.post(`/api/tournaments/${tournamentId}/register`, payload);
      toast.success(data.message || '¡Equipo inscrito!', { description: teamName });
      onRegistered?.();
      reset();
      onOpenChange(false);
    } catch (err: any) {
      const code = err.response?.data?.code;
      if (code === 'RIOT_NOT_LINKED' || code === 'CAPTAIN_RIOT_REQUIRED') {
        toast.error('Vincula tu cuenta de LoL en el Dashboard');
      } else {
        toast.error('No se pudo inscribir el equipo', {
          description: err.response?.data?.error || 'Error al inscribirse',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AtakModal open={open} onOpenChange={(o) => { if (!loading) onOpenChange(o); }}>
      <AtakModalContent size="lg" closeDisabled={loading} className={ARENA_MODAL}>
        <ModalHead
          kicker="Inscripción"
          title={<>Inscribir <em>equipo</em></>}
          description={<>{tournamentName} · tu Riot ID sale de tu perfil vinculado. A los compañeros los invitas por correo ATAK.GG.</>}
        />

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <AtakModalBody>
            <div className="tf-form">

            {!isAuthenticated && (
              <Notice tone="warn" icon={<Link2 size={18} />} title="Sin sesión">
                <Link to="/login">Inicia sesión</Link> para inscribir tu equipo.
              </Notice>
            )}

            {isAuthenticated && !linkedRiotId && (
              <Notice tone="warn" icon={<Link2 size={18} />} title="Cuenta de LoL no vinculada">
                Ve a tu <Link to="/dashboard">Dashboard</Link> y conecta tu Riot ID
                antes de inscribirte.
              </Notice>
            )}

            {linkedRiotId && (
              <Notice tone="ok" icon={<Shield size={20} />}>
                <span className="td-over">Tu cuenta (capitán)</span>
                <p className="tf-account-id">{linkedRiotId}</p>
              </Notice>
            )}

            <div className="tf-grid-2">
              <Field label="Nombre del equipo" required htmlFor="trm-team">
                <input id="trm-team" value={teamName} onChange={e => setTeamName(e.target.value)} required
                  placeholder="Ej: Dragones QRO" className="td-input" autoComplete="off" />
              </Field>
              <Field label="Contacto" hint="Discord o correo" htmlFor="trm-contact">
                <input id="trm-contact" value={contact} onChange={e => setContact(e.target.value)}
                  placeholder="discord: player#1234" className="td-input" autoComplete="off" />
              </Field>
            </div>

            <div>
              <div className="td-sechead tf-sechead">
                <span className="td-sechead-ico" aria-hidden><Users size={16} /></span>
                <h3 className="td-sechead-title" style={{ margin: 0 }}>
                  Roster <span className="td-num" style={{ color: 'var(--td-muted)' }}>({players.length}/{maxPlayers})</span>
                </h3>
                <span className="td-help">{minPlayers === 1 ? 'formato 1v1' : `mínimo ${minPlayers}`}</span>
                <span className="td-sechead-right">
                  <Button variant="secondary" icon={<Plus size={15} aria-hidden />}
                    onClick={addPlayer} disabled={players.length >= maxPlayers}>
                    Suplente
                  </Button>
                </span>
              </div>

              <div className="tf-roster">
                {players.map((player, i) => (
                  <div key={i} className="td-sub tf-player">
                    <div className="tf-player-head">
                      <span className="ax-pos" aria-hidden>{i + 1}</span>
                      {i === 0 ? (
                        <StatusChip kind="gold" dot={false}><Crown size={12} aria-hidden /> Capitán</StatusChip>
                      ) : (
                        <span className="td-over">{i < minPlayers ? `Jugador ${i + 1}` : 'Suplente'}</span>
                      )}
                      {i > 0 && (
                        <Seg
                          fit
                          ariaLabel={`Cómo añadir al jugador ${i + 1}`}
                          value={player.mode}
                          options={[
                            { value: 'riot', label: 'Riot ID' },
                            { value: 'invite', label: <><Mail size={14} aria-hidden /> Invitar</> },
                          ]}
                          onChange={(mode) => setPlayerMode(i, mode)}
                        />
                      )}
                    </div>

                    <div className="tf-grid-2">
                      <Field label="Nombre" htmlFor={`trm-p${i}-name`}>
                        <input id={`trm-p${i}-name`} placeholder={`Nombre del jugador ${i + 1}`} value={player.name}
                          onChange={e => handlePlayerChange(i, 'name', e.target.value)} required
                          className="td-input" autoComplete="off" />
                      </Field>

                      {i === 0 ? (
                        <Field label="Riot ID" htmlFor="trm-p0-riot">
                          <input id="trm-p0-riot" value={linkedRiotId || player.riotId} readOnly disabled
                            className="td-input tf-mono" />
                        </Field>
                      ) : player.mode === 'invite' ? (
                        <Field label="Correo de su cuenta ATAK.GG" htmlFor={`trm-p${i}-mail`}>
                          <input id={`trm-p${i}-mail`} placeholder="correo@ejemplo.com (cuenta ATAK.GG)" value={player.inviteEmail}
                            onChange={e => handlePlayerChange(i, 'inviteEmail', e.target.value)} required
                            type="email" className="td-input" autoComplete="off" />
                        </Field>
                      ) : (
                        <Field label="Riot ID" htmlFor={`trm-p${i}-riot`}>
                          <input id={`trm-p${i}-riot`} placeholder="Riot ID (Nombre#TAG)" value={player.riotId}
                            onChange={e => handlePlayerChange(i, 'riotId', e.target.value)} required
                            className="td-input tf-mono" autoComplete="off" />
                        </Field>
                      )}
                    </div>

                    {/* Con el roster en el mínimo el botón estaría desactivado en cada fila: se oculta. */}
                    {i > 0 && players.length > minPlayers && (
                      <div className="tf-player-foot">
                        <button type="button" onClick={() => removePlayer(i)} disabled={players.length <= minPlayers}
                          className="tf-linkbtn" data-tone="danger">
                          <X size={15} aria-hidden /> Quitar suplente
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            </div>
          </AtakModalBody>

          <AtakModalFooter>
            <div className="tf-foot-row">
              <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={loading}>
                Cancelar
              </Button>
              <Button type="submit" variant="primary" disabled={loading || !isAuthenticated || !linkedRiotId}
                icon={loading
                  ? <Loader2 size={16} className="tf-spin" aria-hidden />
                  : <Check size={16} aria-hidden />}>
                {loading ? 'Enviando…' : 'Inscribirse'}
              </Button>
            </div>
          </AtakModalFooter>
        </form>
      </AtakModalContent>
    </AtakModal>
  );
};
