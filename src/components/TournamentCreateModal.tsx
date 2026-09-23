// src/components/TournamentCreateModal.tsx — asistente de creación en 3 pasos.
//
// Antes era un formulario único de ~15 controles donde mapa, bracket, series y
// fechas competían por la misma atención, y el botón de crear vivía al final de
// un scroll largo. Ahora: Identidad → Juego → Agenda, con el pie fijo y una
// vista previa que replica la tarjeta que verá el resto de la gente.
//
// Campos que el backend ya aceptaba y el modal no mandaba, ahora sí: `pickType`
// (solo Grieta), `checkinDeadline` y `createRiot`. Ese último además arregla un
// ReferenceError real: el botón de envío leía una variable `createRiot` que
// nadie declaraba, así que reventaba en cuanto empezaba el envío.
//
// Arena no usa códigos de Riot (no hay lobbies personalizados): se juega como
// ladder por ventana de tiempo, y por eso oculta bracket, series y códigos.
import { useEffect, useMemo, useState } from 'react';
import {
  CalendarClock, Check, ChevronLeft, ChevronRight, Globe, Loader2, Lock,
  Mountain, Shuffle, Snowflake, Swords, Trophy, Users, Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AtakModal, AtakModalBody, AtakModalContent, AtakModalFooter, AtakModalHeader,
} from '@/components/ui/atak-modal';
import { Callout, Field, OptionCard, PillGroup, fieldCls } from '@/components/ui/form-bits';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { StepRail, type Step } from '@/components/tournament/create/StepRail';
import { TournamentPreviewCard } from '@/components/tournament/create/TournamentPreviewCard';
import { CodesPanel } from '@/components/tournament/create/CodesPanel';
import { useCreateTournament } from '@/hooks/queries/tournaments';

interface TournamentCreateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
  /**
   * Valores con los que abrir el asistente. Lo usa el formulario rápido de la
   * portada cuando alguien pulsa "Más opciones": lo ya escrito no se pierde.
   */
  initial?: Partial<{
    name: string; gameMap: GameMap; teamSize: number; startDate: string;
    bracketType: string; seriesTo: string;
  }>;
}

type GameMap = 'SR' | 'ARAM' | 'ARENA';

const MAPS: Array<{ key: GameMap; label: string; sub: string; Icon: typeof Mountain }> = [
  { key: 'SR', label: 'La Grieta', sub: 'Códigos oficiales de Riot', Icon: Mountain },
  { key: 'ARAM', label: 'ARAM', sub: 'Abismo de los Lamentos', Icon: Snowflake },
  { key: 'ARENA', label: 'Arena', sub: 'Ladder 2v2 por puntos', Icon: Swords },
];

// 'auto' deja que el backend elija: ARAM → ALL_RANDOM, 5v5 → TOURNAMENT_DRAFT,
// formatos cortos → BLIND_PICK. Es lo correcto en la mayoría de los casos.
const PICK_TYPES = [
  { value: 'auto', label: 'Automático (recomendado)' },
  { value: 'TOURNAMENT_DRAFT', label: 'Tournament Draft (con bans)' },
  { value: 'DRAFT_MODE', label: 'Draft normal' },
  { value: 'BLIND_PICK', label: 'Selección a ciegas' },
];

const STEPS: Step[] = [
  { key: 'identidad', label: 'Identidad', hint: 'Nombre y visibilidad' },
  { key: 'juego', label: 'Juego', hint: 'Mapa y formato' },
  { key: 'agenda', label: 'Agenda', hint: 'Fechas y plazas' },
];

export const TournamentCreateModal = ({ open, onOpenChange, onCreated, initial }: TournamentCreateModalProps) => {
  const [step, setStep] = useState(0);
  const [maxReached, setMaxReached] = useState(0);
  const [touched, setTouched] = useState(false);

  const [name, setName] = useState('');
  const [prize, setPrize] = useState('');
  const [startDate, setStartDate] = useState('');
  const [checkinDeadline, setCheckinDeadline] = useState('');
  const [description, setDescription] = useState('');
  const [maxParticipants, setMaxParticipants] = useState('16');
  const [gameMap, setGameMap] = useState<GameMap>('SR');
  const [teamSize, setTeamSize] = useState(5);
  const [pickType, setPickType] = useState('auto');
  const [bracketType, setBracketType] = useState('single_elim');
  const [seriesTo, setSeriesTo] = useState('1');       // '1' Bo1 · '2' Bo3 · '2f3' Bo3+final Bo5
  const [swissRounds, setSwissRounds] = useState('0'); // '0' manual
  const [durationHours, setDurationHours] = useState('3');
  const [isPrivate, setIsPrivate] = useState(false);
  const [createRiot, setCreateRiot] = useState(true);

  const [result, setResult] = useState<{
    id: string; name: string; riotTournamentId?: number; riotCodes?: string[];
    riotSkippedReason?: string;
  } | null>(null);

  const create = useCreateTournament();
  const loading = create.isPending;

  // Al abrir con valores iniciales, sembramos el formulario una sola vez. Se
  // hace en efecto y no en useState porque el modal se monta antes de que
  // exista el borrador: el estado inicial se calcularía con el valor viejo.
  useEffect(() => {
    if (!open || !initial) return;
    if (initial.name !== undefined) setName(initial.name);
    if (initial.gameMap !== undefined) setGameMap(initial.gameMap);
    if (initial.teamSize !== undefined) setTeamSize(initial.teamSize);
    if (initial.startDate !== undefined) setStartDate(initial.startDate);
    if (initial.bracketType !== undefined) setBracketType(initial.bracketType);
    if (initial.seriesTo !== undefined) setSeriesTo(initial.seriesTo);
    // Solo al abrir: mientras el modal está abierto manda lo que escriba la
    // persona, no el borrador.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const isArena = gameMap === 'ARENA';
  const effTeamSize = isArena ? 2 : teamSize;
  const wantsCodes = !isArena && createRiot;

  const nameError = touched && name.trim().length < 3
    ? 'Pon al menos 3 caracteres.'
    : null;
  const dateError = touched && !startDate ? 'Elige la fecha de arranque.' : null;

  const preview = useMemo(() => ({
    name, prize, startDate, gameMap, teamSize: effTeamSize, bracketType,
    seriesTo, maxParticipants, isPrivate, createRiot, swissRounds, durationHours,
  }), [name, prize, startDate, gameMap, effTeamSize, bracketType, seriesTo,
      maxParticipants, isPrivate, createRiot, swissRounds, durationHours]);

  const canLeaveStep = (i: number) => {
    if (i === 0) return name.trim().length >= 3;
    if (i === 2) return !!startDate;
    return true;
  };

  const goTo = (i: number) => {
    setStep(i);
    setMaxReached((m) => Math.max(m, i));
    setTouched(false);
  };

  const next = () => {
    if (!canLeaveStep(step)) { setTouched(true); return; }
    goTo(Math.min(STEPS.length - 1, step + 1));
  };

  const reset = () => {
    setStep(0); setMaxReached(0); setTouched(false);
    setName(''); setPrize(''); setStartDate(''); setCheckinDeadline(''); setDescription('');
    setMaxParticipants('16'); setGameMap('SR'); setTeamSize(5); setPickType('auto');
    setBracketType('single_elim'); setSeriesTo('1'); setSwissRounds('0');
    setDurationHours('3'); setIsPrivate(false); setCreateRiot(true); setResult(null);
    create.reset();
  };

  const handleClose = () => {
    if (loading) return;
    reset();
    onOpenChange(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canLeaveStep(0)) { goTo(0); setTouched(true); return; }
    if (!canLeaveStep(2)) { goTo(2); setTouched(true); return; }

    const st = seriesTo === '2f3' ? 2 : Number(seriesTo);
    const fst = seriesTo === '2f3' ? 3 : st;

    try {
      const data = await create.mutateAsync({
        name: name.trim(),
        prize: prize.trim(),
        startDate,
        description: description.trim(),
        maxParticipants: Number(maxParticipants),
        isPrivate,
        gameMap,
        teamSize: effTeamSize,
        pickType: !isArena && pickType !== 'auto' ? pickType : undefined,
        bracketType: isArena ? undefined : bracketType,
        seriesTo: isArena ? undefined : st,
        finalSeriesTo: isArena ? undefined : fst,
        swissRounds: bracketType === 'swiss' && Number(swissRounds) > 0 ? Number(swissRounds) : undefined,
        durationHours: isArena ? Number(durationHours) : undefined,
        checkinDeadline: checkinDeadline ? new Date(checkinDeadline).toISOString() : undefined,
        createRiot: isArena ? undefined : createRiot,
      });
      setResult({ ...data.tournament, riotSkippedReason: data.riotSkippedReason });
      onCreated();
    } catch {
      // El toast de error lo dispara el hook; aquí solo evitamos el unhandled.
    }
  };

  return (
    <AtakModal open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <AtakModalContent size={result ? 'md' : 'xl'} tone={result ? 'green' : 'red'} closeDisabled={loading}>
        <AtakModalHeader
          tone={result ? 'green' : 'red'}
          icon={result ? <Check className="h-5 w-5" /> : <Trophy className="h-5 w-5" />}
          eyebrow={result ? 'Listo' : `Paso ${step + 1} de ${STEPS.length}`}
          title={result ? 'Torneo creado' : 'Crear nuevo torneo'}
          description={
            result
              ? 'Reparte los códigos y abre las inscripciones.'
              : 'Mapa, formato y calendario. La detección de resultados es automática.'
          }
        >
          {!result && (
            <StepRail steps={STEPS} current={step} maxReached={maxReached} onJump={goTo} />
          )}
        </AtakModalHeader>

        {result ? (
          <>
            <AtakModalBody>
              <CodesPanel
                name={result.name}
                riotTournamentId={result.riotTournamentId}
                codes={result.riotCodes ?? []}
                skippedReason={result.riotSkippedReason}
              />
            </AtakModalBody>
            <AtakModalFooter>
              <Button onClick={handleClose} className="gradient-red w-full border-0 hover:opacity-90">
                Cerrar
              </Button>
            </AtakModalFooter>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
            <AtakModalBody>
              <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_260px]">
                <div className="min-w-0 space-y-5">
                  {/* ───────────── Paso 1 · Identidad ───────────── */}
                  {step === 0 && (
                    <>
                      <Field label="Nombre del torneo" required error={nameError}>
                        <input
                          autoFocus
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Ej: LQC Split Verano 2026"
                          className={fieldCls}
                        />
                      </Field>

                      <Field label="Premio" hint="Opcional">
                        <input
                          value={prize}
                          onChange={(e) => setPrize(e.target.value)}
                          placeholder="Ej: $10,000 MXN"
                          className={fieldCls}
                        />
                      </Field>

                      <Field label="Descripción" hint="Aparece en la ficha del torneo">
                        <Textarea
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          placeholder="Reglas rápidas, sede, horarios, contacto…"
                          rows={3}
                          className="resize-none rounded-xl border-white/[0.08] bg-white/[0.05] focus-visible:border-red-500/50"
                        />
                      </Field>

                      <Field label="Visibilidad">
                        <div className="grid grid-cols-2 gap-2">
                          <OptionCard
                            icon={<Globe />}
                            title="Público"
                            sub="Visible en la lista — cualquiera se inscribe"
                            active={!isPrivate}
                            onClick={() => setIsPrivate(false)}
                          />
                          <OptionCard
                            icon={<Lock />}
                            title="Privado"
                            sub="Solo por invitación — tú invitas por correo"
                            tone="gold"
                            active={isPrivate}
                            onClick={() => setIsPrivate(true)}
                          />
                        </div>
                      </Field>
                    </>
                  )}

                  {/* ───────────── Paso 2 · Juego ───────────── */}
                  {step === 1 && (
                    <>
                      <Field label="Mapa y modo">
                        <div className="grid grid-cols-3 gap-2">
                          {MAPS.map(({ key, label, sub, Icon }) => (
                            <OptionCard
                              key={key}
                              icon={<Icon />}
                              title={label}
                              sub={sub}
                              active={gameMap === key}
                              onClick={() => setGameMap(key)}
                            />
                          ))}
                        </div>
                      </Field>

                      <Field
                        label="Tamaño de equipo"
                        hint={isArena ? 'Arena siempre es en duplas' : undefined}
                      >
                        <PillGroup
                          value={effTeamSize}
                          options={[1, 2, 3, 4, 5].map((n) => ({ value: n, label: `${n}v${n}` }))}
                          disabledOf={(n) => isArena && n !== 2}
                          onChange={(n) => !isArena && setTeamSize(n)}
                        />
                      </Field>

                      {isArena ? (
                        <>
                          <Field label="Duración de la ventana" hint="Desde la hora de inicio">
                            <Select value={durationHours} onValueChange={setDurationHours}>
                              <SelectTrigger className="h-[42px] rounded-xl border-white/[0.08] bg-white/[0.05]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {[2, 3, 4, 6, 12, 24].map((h) => (
                                  <SelectItem key={h} value={String(h)}>{h} horas</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </Field>

                          <Callout tone="warn" icon={<Swords />} title="Modo ladder (sin códigos)">
                            Arena no permite lobbies personalizados. Las duplas inscritas juegan
                            Arena normal durante la ventana y el sistema puntúa sus placements
                            automáticamente: cuentan sus 5 mejores partidas.
                          </Callout>
                        </>
                      ) : (
                        <>
                          <div className="grid gap-4 sm:grid-cols-2">
                            <Field label="Bracket">
                              <Select value={bracketType} onValueChange={setBracketType}>
                                <SelectTrigger className="h-[42px] rounded-xl border-white/[0.08] bg-white/[0.05]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="single_elim">Eliminación directa</SelectItem>
                                  <SelectItem value="round_robin">Liga (round robin)</SelectItem>
                                  <SelectItem value="swiss">Suizo</SelectItem>
                                </SelectContent>
                              </Select>
                            </Field>

                            <Field label="Series">
                              <Select value={seriesTo} onValueChange={setSeriesTo}>
                                <SelectTrigger className="h-[42px] rounded-xl border-white/[0.08] bg-white/[0.05]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="1">Bo1</SelectItem>
                                  <SelectItem value="2">Bo3</SelectItem>
                                  <SelectItem value="2f3">Bo3 · Final Bo5</SelectItem>
                                </SelectContent>
                              </Select>
                            </Field>

                            {bracketType === 'swiss' && (
                              <Field
                                label="Piloto automático"
                                hint="Rondas suizas"
                                className="sm:col-span-2"
                              >
                                <Select value={swissRounds} onValueChange={setSwissRounds}>
                                  <SelectTrigger className="h-[42px] rounded-xl border-white/[0.08] bg-white/[0.05]">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="0">Manual (botón siguiente ronda)</SelectItem>
                                    {[3, 4, 5].map((n) => (
                                      <SelectItem key={n} value={String(n)}>
                                        {n} rondas · avance automático
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </Field>
                            )}

                            <Field
                              label="Selección de campeones"
                              hint={gameMap === 'ARAM' ? 'ARAM siempre es aleatorio' : undefined}
                              className="sm:col-span-2"
                            >
                              <Select
                                value={gameMap === 'ARAM' ? 'auto' : pickType}
                                onValueChange={setPickType}
                                disabled={gameMap === 'ARAM'}
                              >
                                <SelectTrigger className="h-[42px] rounded-xl border-white/[0.08] bg-white/[0.05]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {PICK_TYPES.map((p) => (
                                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </Field>
                          </div>

                          <Callout
                            tone={wantsCodes ? 'violet' : 'info'}
                            icon={wantsCodes ? <Zap /> : <Shuffle />}
                            title={wantsCodes ? 'Torneo oficial de Riot' : 'Sin códigos de Riot'}
                          >
                            {wantsCodes ? (
                              <>
                                Se generan códigos reales ({effTeamSize}v{effTeamSize}
                                {gameMap === 'ARAM' ? ' · ARAM' : ''}): los jugadores entran desde el
                                cliente de LoL y los resultados se detectan solos.
                              </>
                            ) : (
                              <>
                                Los equipos organizan sus partidas por su cuenta. Los resultados se
                                detectan por el roster, o los reporta el organizador a mano.
                              </>
                            )}
                          </Callout>
                        </>
                      )}
                    </>
                  )}

                  {/* ───────────── Paso 3 · Agenda ───────────── */}
                  {step === 2 && (
                    <>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="Fecha de inicio" required error={dateError}>
                          <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className={`${fieldCls} [color-scheme:dark]`}
                          />
                        </Field>

                        <Field label="Máx. equipos">
                          <Select value={maxParticipants} onValueChange={setMaxParticipants}>
                            <SelectTrigger className="h-[42px] rounded-xl border-white/[0.08] bg-white/[0.05]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {[4, 8, 16, 32, 64].map((n) => (
                                <SelectItem key={n} value={String(n)}>{n} equipos</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </Field>

                        <Field
                          label="Cierre de check-in"
                          hint="Opcional"
                          className="sm:col-span-2"
                        >
                          <input
                            type="datetime-local"
                            value={checkinDeadline}
                            onChange={(e) => setCheckinDeadline(e.target.value)}
                            className={`${fieldCls} [color-scheme:dark]`}
                          />
                        </Field>
                      </div>

                      <Callout icon={<CalendarClock />} title="Cómo funciona el check-in">
                        Si pones fecha límite, los equipos tienen que confirmar antes de esa hora o
                        quedan fuera del bracket. Déjalo vacío si vas a confirmar tú a mano.
                      </Callout>

                      {!isArena && (
                        <Field label="Códigos oficiales de Riot">
                          <div className="grid grid-cols-2 gap-2">
                            <OptionCard
                              icon={<Zap />}
                              title="Generar códigos"
                              sub="Lobbies oficiales y resultados automáticos"
                              active={createRiot}
                              onClick={() => setCreateRiot(true)}
                            />
                            <OptionCard
                              icon={<Users />}
                              title="Sin códigos"
                              sub="Los equipos arman sus partidas"
                              tone="gold"
                              active={!createRiot}
                              onClick={() => setCreateRiot(false)}
                            />
                          </div>
                        </Field>
                      )}
                    </>
                  )}
                </div>

                {/* Vista previa pegajosa — en móvil cae debajo del formulario. */}
                <aside className="lg:sticky lg:top-0 lg:self-start">
                  <TournamentPreviewCard input={preview} />
                </aside>
              </div>
            </AtakModalBody>

            <AtakModalFooter>
              <div className="flex items-center justify-between gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => (step === 0 ? handleClose() : goTo(step - 1))}
                  disabled={loading}
                  className="text-gray-400 hover:text-white"
                >
                  {step === 0 ? 'Cancelar' : <><ChevronLeft className="mr-1 h-4 w-4" /> Atrás</>}
                </Button>

                {step < STEPS.length - 1 ? (
                  <Button
                    type="button"
                    onClick={next}
                    className="gradient-red min-w-32 border-0 hover:opacity-90"
                  >
                    Siguiente <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    disabled={loading}
                    className="gradient-red min-w-44 border-0 hover:opacity-90"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {wantsCodes ? 'Creando en Riot…' : 'Creando…'}
                      </>
                    ) : (
                      <><Trophy className="mr-2 h-4 w-4" /> Crear torneo</>
                    )}
                  </Button>
                )}
              </div>
            </AtakModalFooter>
          </form>
        )}
      </AtakModalContent>
    </AtakModal>
  );
};
