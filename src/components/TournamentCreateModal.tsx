// src/components/TournamentCreateModal.tsx — glass redesign
// Creación estructurada: mapa/modo (SR · ARAM · Arena), tamaño de equipo
// (1v1-5v5), bracket y series se mandan como campos reales al backend — el
// string `format` legible lo deriva el servidor. Arena no usa códigos de Riot
// (no hay lobbies custom): se juega como ladder por ventana de tiempo.
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { axiosInstance } from '@/lib/axios';
import { toast } from '@/components/ui/sonner';
import { Trophy, Loader2, Copy, Check, Zap, CopyCheck, Mountain, Snowflake, Swords, Globe, Lock } from 'lucide-react';

interface TournamentCreateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

type GameMap = 'SR' | 'ARAM' | 'ARENA';

const MAPS: Array<{ key: GameMap; label: string; sub: string; Icon: typeof Mountain }> = [
  { key: 'SR',    label: 'La Grieta',  sub: 'Códigos oficiales de Riot', Icon: Mountain },
  { key: 'ARAM',  label: 'ARAM',       sub: 'Abismo de los Lamentos',    Icon: Snowflake },
  { key: 'ARENA', label: 'Arena',      sub: 'Ladder 2v2 por puntos',     Icon: Swords },
];

// Shared input look — mirrors the glass inputs used across the tournament pages.
const fieldCls =
  'w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white ' +
  'placeholder:text-gray-600 outline-none transition-colors focus:border-red-500/50 focus:bg-white/[0.07]';

const pillCls = (active: boolean, disabled = false) =>
  `px-3 py-2 rounded-xl border text-sm font-semibold transition-all ${
    disabled ? 'opacity-35 cursor-not-allowed border-white/[0.06] text-gray-500'
    : active ? 'border-red-500/60 bg-red-500/15 text-red-300 shadow-[0_0_16px_rgba(225,36,46,0.25)]'
    : 'border-white/[0.08] bg-white/[0.04] text-gray-300 hover:border-white/20 hover:bg-white/[0.07]'
  }`;

export const TournamentCreateModal = ({ open, onOpenChange, onCreated }: TournamentCreateModalProps) => {
  const [name, setName] = useState('');
  const [prize, setPrize] = useState('');
  const [startDate, setStartDate] = useState('');
  const [description, setDescription] = useState('');
  const [maxParticipants, setMaxParticipants] = useState('16');
  const [gameMap, setGameMap] = useState<GameMap>('SR');
  const [teamSize, setTeamSize] = useState(5);
  const [bracketType, setBracketType] = useState('single_elim');
  const [seriesTo, setSeriesTo] = useState('1');       // '1' Bo1 · '2' Bo3 · '2f3' Bo3+final Bo5
  const [swissRounds, setSwissRounds] = useState('0'); // '0' manual
  const [durationHours, setDurationHours] = useState('3');
  const [isPrivate, setIsPrivate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    id: string; name: string; riotTournamentId?: number; riotCodes?: string[];
    riotSkippedReason?: string;
  } | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  const isArena = gameMap === 'ARENA';
  const effTeamSize = isArena ? 2 : teamSize;

  const copyCode = async (code: string, i: number) => {
    await navigator.clipboard.writeText(code);
    setCopiedIndex(i);
    setTimeout(() => setCopiedIndex(null), 2000);
  };
  const copyAll = async (codes: string[]) => {
    await navigator.clipboard.writeText(codes.join('\n'));
    setCopiedAll(true);
    toast.success(`${codes.length} códigos copiados`);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const st = seriesTo === '2f3' ? 2 : Number(seriesTo);
      const fst = seriesTo === '2f3' ? 3 : st;
      const { data } = await axiosInstance.post('/api/tournaments', {
        name, prize, startDate, description,
        maxParticipants: Number(maxParticipants),
        isPrivate,
        gameMap, teamSize: effTeamSize,
        bracketType: isArena ? undefined : bracketType,
        seriesTo: isArena ? undefined : st,
        finalSeriesTo: isArena ? undefined : fst,
        swissRounds: bracketType === 'swiss' && Number(swissRounds) > 0 ? Number(swissRounds) : undefined,
        durationHours: isArena ? Number(durationHours) : undefined,
      });
      setResult({ ...data.tournament, riotSkippedReason: data.riotSkippedReason });
      toast.success('Torneo creado', { description: data.tournament?.name });
      onCreated();
    } catch (err: any) {
      toast.error('No se pudo crear el torneo', {
        description: err.response?.data?.error || err.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (loading) return;
    setName(''); setPrize(''); setStartDate(''); setDescription('');
    setMaxParticipants('16'); setGameMap('SR'); setTeamSize(5);
    setBracketType('single_elim'); setSeriesTo('1'); setSwissRounds('0');
    setDurationHours('3'); setIsPrivate(false); setResult(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-[#0a0a0c]/95 backdrop-blur-xl text-white border border-white/[0.08] shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold flex items-center gap-2.5">
            <span className="p-1.5 rounded-xl bg-red-500/10 border border-red-500/20">
              <Trophy className="h-5 w-5 text-red-400" />
            </span>
            Crear nuevo torneo
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Elige mapa, tamaño de equipo y formato — la detección de resultados es automática.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-5">
            <div className="p-4 rounded-2xl border border-green-500/30 bg-green-500/10">
              <p className="font-bold text-green-300 text-lg flex items-center gap-2">
                <Check className="h-5 w-5" /> ¡Torneo creado!
              </p>
              <p className="text-gray-300 mt-1">{result.name}</p>
              {result.riotTournamentId && (
                <p className="text-xs text-gray-500 mt-1">Riot Tournament ID: {result.riotTournamentId}</p>
              )}
            </div>

            {result.riotSkippedReason && (
              <div className="p-3 rounded-xl border border-yellow-500/30 bg-yellow-500/10 text-yellow-200 text-xs">
                Sin códigos de Riot: {result.riotSkippedReason} El torneo funciona igual — los
                resultados se detectan por el roster de los equipos.
              </div>
            )}

            {result.riotCodes && result.riotCodes.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-purple-300 flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    Códigos generados ({result.riotCodes.length})
                  </p>
                  <Button
                    size="sm" variant="outline"
                    onClick={() => copyAll(result.riotCodes!)}
                    className="h-8 text-xs border-white/10 bg-white/[0.04] hover:bg-white/[0.08]"
                  >
                    {copiedAll ? <CopyCheck className="h-3.5 w-3.5 mr-1.5 text-green-400" /> : <Copy className="h-3.5 w-3.5 mr-1.5" />}
                    Copiar todos
                  </Button>
                </div>
                <p className="text-xs text-gray-500">
                  Compártelos con los equipos. Se ingresan en:{' '}
                  <strong className="text-gray-300">LoL → Jugar → Torneos → Buscar por código</strong>.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                  {result.riotCodes.map((code, i) => (
                    <button
                      key={i}
                      onClick={() => copyCode(code, i)}
                      className="flex items-center justify-between gap-2 bg-white/[0.04] border border-white/[0.08] rounded-xl p-2.5 hover:border-purple-400/50 hover:bg-white/[0.07] transition text-left"
                    >
                      <span className="font-mono text-xs text-purple-300 truncate">{code}</span>
                      {copiedIndex === i
                        ? <Check className="h-3.5 w-3.5 text-green-400 flex-shrink-0" />
                        : <Copy className="h-3.5 w-3.5 text-gray-600 flex-shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <Button onClick={handleClose} className="w-full gradient-red border-0 hover:opacity-90">
              Cerrar
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2 space-y-1.5">
                <Label className="text-gray-400">Nombre del torneo *</Label>
                <input
                  value={name} onChange={e => setName(e.target.value)} required
                  placeholder="Ej: LQC Split Verano 2026" className={fieldCls}
                />
              </div>

              {/* Mapa / modo de juego */}
              <div className="md:col-span-2 space-y-1.5">
                <Label className="text-gray-400">Mapa y modo</Label>
                <div className="grid grid-cols-3 gap-2">
                  {MAPS.map(({ key, label, sub, Icon }) => (
                    <button
                      key={key} type="button"
                      onClick={() => setGameMap(key)}
                      className={`flex flex-col items-start gap-1 p-3 rounded-2xl border text-left transition-all ${
                        gameMap === key
                          ? 'border-red-500/60 bg-red-500/10 shadow-[0_0_20px_rgba(225,36,46,0.2)]'
                          : 'border-white/[0.08] bg-white/[0.03] hover:border-white/20'
                      }`}
                    >
                      <Icon className={`h-4 w-4 ${gameMap === key ? 'text-red-400' : 'text-gray-500'}`} />
                      <span className="text-sm font-bold">{label}</span>
                      <span className="text-[10px] text-gray-500 leading-tight">{sub}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Visibilidad */}
              <div className="md:col-span-2 space-y-1.5">
                <Label className="text-gray-400">Visibilidad</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button" onClick={() => setIsPrivate(false)}
                    className={`flex items-start gap-3 p-3 rounded-2xl border text-left transition-all ${
                      !isPrivate
                        ? 'border-red-500/60 bg-red-500/10 shadow-[0_0_20px_rgba(225,36,46,0.2)]'
                        : 'border-white/[0.08] bg-white/[0.03] hover:border-white/20'
                    }`}
                  >
                    <Globe className={`h-4 w-4 mt-0.5 flex-shrink-0 ${!isPrivate ? 'text-red-400' : 'text-gray-500'}`} />
                    <span>
                      <span className="block text-sm font-bold">Público</span>
                      <span className="block text-[11px] text-gray-500 leading-tight mt-0.5">
                        Visible en la lista — cualquiera puede inscribirse
                      </span>
                    </span>
                  </button>
                  <button
                    type="button" onClick={() => setIsPrivate(true)}
                    className={`flex items-start gap-3 p-3 rounded-2xl border text-left transition-all ${
                      isPrivate
                        ? 'border-amber-400/60 bg-amber-400/10 shadow-[0_0_20px_rgba(240,178,50,0.15)]'
                        : 'border-white/[0.08] bg-white/[0.03] hover:border-white/20'
                    }`}
                  >
                    <Lock className={`h-4 w-4 mt-0.5 flex-shrink-0 ${isPrivate ? 'text-amber-300' : 'text-gray-500'}`} />
                    <span>
                      <span className="block text-sm font-bold">Privado</span>
                      <span className="block text-[11px] text-gray-500 leading-tight mt-0.5">
                        Solo por invitación — tú invitas por correo
                      </span>
                    </span>
                  </button>
                </div>
              </div>

              {/* Tamaño de equipo */}
              <div className="md:col-span-2 space-y-1.5">
                <Label className="text-gray-400">
                  Tamaño de equipo {isArena && <span className="text-gray-600">· Arena siempre es en duplas</span>}
                </Label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button
                      key={n} type="button"
                      disabled={isArena && n !== 2}
                      onClick={() => !isArena && setTeamSize(n)}
                      className={pillCls(effTeamSize === n, isArena && n !== 2)}
                    >
                      {n}v{n}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-gray-400">Premio</Label>
                <input
                  value={prize} onChange={e => setPrize(e.target.value)}
                  placeholder="Ej: $10,000 MXN" className={fieldCls}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-gray-400">Fecha de inicio *</Label>
                <input
                  type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                  required className={`${fieldCls} [color-scheme:dark]`}
                />
              </div>

              {isArena ? (
                <div className="space-y-1.5">
                  <Label className="text-gray-400">Duración de la ventana</Label>
                  <Select value={durationHours} onValueChange={setDurationHours}>
                    <SelectTrigger className="bg-white/[0.05] border-white/[0.08] rounded-xl h-[42px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[2, 3, 4, 6, 12, 24].map(h => <SelectItem key={h} value={String(h)}>{h} horas</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-gray-400">Bracket</Label>
                    <Select value={bracketType} onValueChange={setBracketType}>
                      <SelectTrigger className="bg-white/[0.05] border-white/[0.08] rounded-xl h-[42px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="single_elim">Eliminación directa</SelectItem>
                        <SelectItem value="round_robin">Liga (round robin)</SelectItem>
                        <SelectItem value="swiss">Suizo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-gray-400">Series</Label>
                    <Select value={seriesTo} onValueChange={setSeriesTo}>
                      <SelectTrigger className="bg-white/[0.05] border-white/[0.08] rounded-xl h-[42px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">Bo1</SelectItem>
                        <SelectItem value="2">Bo3</SelectItem>
                        <SelectItem value="2f3">Bo3 · Final Bo5</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {bracketType === 'swiss' && (
                    <div className="space-y-1.5">
                      <Label className="text-gray-400">Piloto automático (rondas suizas)</Label>
                      <Select value={swissRounds} onValueChange={setSwissRounds}>
                        <SelectTrigger className="bg-white/[0.05] border-white/[0.08] rounded-xl h-[42px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">Manual (botón siguiente ronda)</SelectItem>
                          {[3, 4, 5].map(n => <SelectItem key={n} value={String(n)}>{n} rondas · avance automático</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </>
              )}

              <div className="space-y-1.5">
                <Label className="text-gray-400">Máx. equipos</Label>
                <Select value={maxParticipants} onValueChange={setMaxParticipants}>
                  <SelectTrigger className="bg-white/[0.05] border-white/[0.08] rounded-xl h-[42px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[4, 8, 16, 32, 64].map(n => <SelectItem key={n} value={String(n)}>{n} equipos</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2 space-y-1.5">
                <Label className="text-gray-400">Descripción</Label>
                <Textarea
                  value={description} onChange={e => setDescription(e.target.value)}
                  placeholder="Descripción del torneo..." rows={3}
                  className="bg-white/[0.05] border-white/[0.08] rounded-xl resize-none focus-visible:border-red-500/50"
                />
              </div>
            </div>

            {isArena ? (
              <div className="p-4 rounded-2xl border border-amber-500/25 bg-amber-500/[0.06]">
                <span className="text-amber-300 font-semibold flex items-center gap-2">
                  <Swords className="h-4 w-4" /> Modo ladder (sin códigos)
                </span>
                <p className="text-xs text-gray-400 mt-1">
                  Arena no permite lobbies personalizados. Las duplas inscritas juegan Arena
                  normal durante la ventana y el sistema puntúa sus placements automáticamente
                  (cuentan sus 5 mejores partidas).
                </p>
              </div>
            ) : (
              <div className="flex items-start gap-3 p-4 rounded-2xl border border-purple-500/25 bg-purple-500/[0.06]">
                <Zap className="h-4 w-4 mt-0.5 text-purple-300 flex-shrink-0" />
                <div>
                  <span className="text-purple-300 font-semibold">Torneo oficial de Riot</span>
                  <p className="text-xs text-gray-400 mt-1">
                    Se generan códigos reales automáticamente ({effTeamSize}v{effTeamSize}
                    {gameMap === 'ARAM' ? ' · ARAM' : ''}) — los jugadores se unen desde el cliente de LoL
                    y los resultados se detectan solos.
                  </p>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-1">
              <Button
                type="button" variant="outline" onClick={handleClose} disabled={loading}
                className="border-white/10 bg-white/[0.04] hover:bg-white/[0.08]"
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={loading} className="gradient-red border-0 hover:opacity-90 min-w-40">
                {loading ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{createRiot && !isArena ? 'Creando en Riot...' : 'Creando...'}</>
                ) : (
                  <><Trophy className="h-4 w-4 mr-2" />Crear torneo</>
                )}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};
