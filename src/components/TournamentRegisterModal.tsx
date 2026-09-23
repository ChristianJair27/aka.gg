// Tournament team registration — linked LoL account auto-fill + email invitations
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  AtakModal, AtakModalBody, AtakModalContent, AtakModalFooter, AtakModalHeader,
} from '@/components/ui/atak-modal';
import { Callout, Field, fieldCls } from '@/components/ui/form-bits';
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
  const { data: overview } = useOverview();
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
      <AtakModalContent size="lg" closeDisabled={loading}>
        <AtakModalHeader
          icon={<Users className="h-5 w-5" />}
          eyebrow="Inscripción"
          title="Inscribir equipo"
          description={<>{tournamentName} · tu Riot ID sale de tu perfil vinculado. A los compañeros los invitas por correo ATAK.GG.</>}
        />

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <AtakModalBody className="space-y-5">

            {!isAuthenticated && (
              <Callout tone="warn" icon={<Link2 />} title="Sin sesión">
                <Link to="/login" className="font-semibold underline">Inicia sesión</Link> para inscribir tu equipo.
              </Callout>
            )}

            {isAuthenticated && !linkedRiotId && (
              <Callout tone="warn" icon={<Link2 />} title="Cuenta de LoL no vinculada">
                Ve a tu <Link to="/dashboard" className="underline">Dashboard</Link> y conecta tu Riot ID
                antes de inscribirte.
              </Callout>
            )}

            {linkedRiotId && (
              <div className="flex items-center gap-3 rounded-2xl border border-green-500/25 bg-green-500/10 p-3">
                <Shield className="h-5 w-5 flex-shrink-0 text-green-400" />
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-green-400/80">Tu cuenta (capitán)</p>
                  <p className="truncate font-mono text-sm text-green-200">{linkedRiotId}</p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Nombre del equipo" required>
                <input value={teamName} onChange={e => setTeamName(e.target.value)} required
                  placeholder="Ej: Dragones QRO" className={fieldCls} />
              </Field>
              <Field label="Contacto" hint="Discord o correo">
                <input value={contact} onChange={e => setContact(e.target.value)}
                  placeholder="discord: player#1234" className={fieldCls} />
              </Field>
            </div>

            <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-medium text-gray-400">
                Roster ({players.length}/{maxPlayers}) · {minPlayers === 1 ? 'formato 1v1' : `mínimo ${minPlayers}`}
              </span>
              <Button type="button" size="sm" variant="outline"
                onClick={addPlayer} disabled={players.length >= maxPlayers}
                className="h-8 text-xs border-white/10 bg-white/[0.04] hover:bg-white/[0.08]">
                <Plus className="h-3.5 w-3.5 mr-1.5" /> Suplente
              </Button>
            </div>

            <div className="space-y-3">
              {players.map((player, i) => (
                <div key={i} className="p-3 rounded-xl border border-white/[0.06] bg-white/[0.02] space-y-2.5">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 flex-shrink-0 flex items-center justify-center rounded-lg bg-white/[0.05] border border-white/[0.08] text-xs font-bold text-gray-400">
                      {i + 1}
                    </span>
                    {i === 0 && (
                      <span className="text-xs text-yellow-400 flex items-center gap-1">
                        <Crown className="h-3 w-3" /> Capitán
                      </span>
                    )}
                    {i > 0 && (
                      <div className="flex gap-1 ml-auto">
                        <button type="button" onClick={() => setPlayerMode(i, 'riot')}
                          className={`text-[10px] px-2 py-1 rounded-lg border transition ${
                            player.mode === 'riot' ? 'bg-white/10 border-white/20 text-white' : 'border-white/5 text-gray-600'
                          }`}>
                          Riot ID
                        </button>
                        <button type="button" onClick={() => setPlayerMode(i, 'invite')}
                          className={`text-[10px] px-2 py-1 rounded-lg border transition flex items-center gap-1 ${
                            player.mode === 'invite' ? 'bg-purple-500/20 border-purple-500/30 text-purple-200' : 'border-white/5 text-gray-600'
                          }`}>
                          <Mail className="h-3 w-3" /> Invitar
                        </button>
                      </div>
                    )}
                  </div>

                  <input placeholder={`Nombre del jugador ${i + 1}`} value={player.name}
                    onChange={e => handlePlayerChange(i, 'name', e.target.value)} required
                    className={fieldCls} />

                  {i === 0 ? (
                    <input value={linkedRiotId || player.riotId} readOnly disabled
                      className={`${fieldCls} font-mono opacity-60 cursor-not-allowed`} />
                  ) : player.mode === 'invite' ? (
                    <input placeholder="correo@ejemplo.com (cuenta ATAK.GG)" value={player.inviteEmail}
                      onChange={e => handlePlayerChange(i, 'inviteEmail', e.target.value)} required
                      type="email" className={fieldCls} />
                  ) : (
                    <input placeholder="Riot ID (Nombre#TAG)" value={player.riotId}
                      onChange={e => handlePlayerChange(i, 'riotId', e.target.value)} required
                      className={`${fieldCls} font-mono`} />
                  )}

                  {i > 0 && (
                    <button type="button" onClick={() => removePlayer(i)} disabled={players.length <= minPlayers}
                      className="text-xs text-gray-600 hover:text-red-400 transition disabled:opacity-20 flex items-center gap-1">
                      <X className="h-3 w-3" /> Quitar suplente
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          </AtakModalBody>

          <AtakModalFooter>
            <div className="flex items-center justify-between gap-3">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}
                className="text-gray-400 hover:text-white">
                Cancelar
              </Button>
              <Button type="submit" disabled={loading || !isAuthenticated || !linkedRiotId}
                className="gradient-red min-w-36 border-0 hover:opacity-90">
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                {loading ? 'Enviando…' : 'Inscribirse'}
              </Button>
            </div>
          </AtakModalFooter>
        </form>
      </AtakModalContent>
    </AtakModal>
  );
};