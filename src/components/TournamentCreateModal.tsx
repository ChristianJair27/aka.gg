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
import { TdSelect } from '@/components/ui/td-select';
import { useEffect, useMemo, useState } from 'react';
import {
  CalendarClock, ChevronLeft, ChevronRight, Globe, Loader2, Lock,
  Shuffle, Swords, Trophy, Users, Zap,
} from 'lucide-react';
import {
  AtakModal, AtakModalBody, AtakModalContent, AtakModalFooter,
} from '@/components/ui/atak-modal';
import { Button } from '@/components/tournament/ui';
import {
  ARENA_MODAL, Field, MapPicker, ModalHead, Notice, OptionTile, Seg,
  type GameMap, type MapOption,
} from '@/components/tournament/forms';
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

// El arte de cada tarjeta sale del propio mapa (ver MapPicker → lol.map).
const MAPS: MapOption[] = [
  { key: 'SR', label: 'La Grieta', sub: 'Códigos oficiales de Riot' },
  { key: 'ARAM', label: 'ARAM', sub: 'Abismo de los Lamentos' },
  { key: 'ARENA', label: 'Arena', sub: 'Ladder 2v2 por puntos' },
];

const BRACKETS = [
  { value: 'single_elim', label: 'Eliminación directa' },
  { value: 'round_robin', label: 'Liga (round robin)' },
  { value: 'swiss', label: 'Suizo' },
];

const SERIES = [
  { value: '1', label: 'Bo1' },
  { value: '2', label: 'Bo3' },
  { value: '2f3', label: 'Bo3 · Final Bo5' },
];

// 'auto' deja que el backend elija: ARAM → ALL_RANDOM, 5v5 → TOURNAMENT_DRAFT,
// formatos cortos → BLIND_PICK. Riot acepta cualquier selección en el Abismo
// (verificado con códigos reales), así que en ARAM también se puede draftear.
const PICK_TYPES = [
  { value: 'auto', label: 'Automático (recomendado)' },
  { value: 'TOURNAMENT_DRAFT', label: 'Tournament Draft (con bans)' },
  { value: 'DRAFT_MODE', label: 'Draft normal' },
  { value: 'BLIND_PICK', label: 'Selección a ciegas' },
  { value: 'ALL_RANDOM', label: 'Aleatorio (ARAM clásico)' },
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
      <AtakModalContent
        size={result ? 'md' : 'xl'} tone={result ? 'green' : 'red'} closeDisabled={loading}
        className={ARENA_MODAL}
      >
        <ModalHead
          kicker={result ? 'Listo' : `Paso ${step + 1} de ${STEPS.length}`}
          title={result ? <>Torneo <em>creado</em></> : <>Crear nuevo <em>torneo</em></>}
          description={
            result
              ? 'Reparte los códigos y abre las inscripciones.'
              : 'Mapa, formato y calendario. La detección de resultados es automática.'
          }
        >
          {!result && (
            <StepRail steps={STEPS} current={step} maxReached={maxReached} onJump={goTo} />
          )}
        </ModalHead>

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
              <Button variant="primary" full onClick={handleClose}>Cerrar</Button>
            </AtakModalFooter>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
            <AtakModalBody>
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
                <div className="tf-form">
                  {/* ───────────── Paso 1 · Identidad ───────────── */}
                  {step === 0 && (
                    <>
                      <Field label="Nombre del torneo" required error={nameError} htmlFor="tcm-name">
                        <input
                          id="tcm-name"
                          autoFocus
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Ej: LQC Split Verano 2026"
                          className="td-input"
                          aria-invalid={nameError ? true : undefined}
                          autoComplete="off"
                        />
                      </Field>

                      <Field label="Premio" hint="Opcional" htmlFor="tcm-prize">
                        <input
                          id="tcm-prize"
                          value={prize}
                          onChange={(e) => setPrize(e.target.value)}
                          placeholder="Ej: $10,000 MXN"
                          className="td-input"
                          autoComplete="off"
                        />
                      </Field>

                      <Field label="Descripción" hint="Aparece en la ficha del torneo" htmlFor="tcm-desc">
                        <textarea
                          id="tcm-desc"
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          placeholder="Reglas rápidas, sede, horarios, contacto…"
                          rows={3}
                          className="td-textarea"
                        />
                      </Field>

                      <Field label="Visibilidad">
                        <div className="tf-opts" role="group" aria-label="Visibilidad">
                          <OptionTile
                            icon={<Globe size={18} />}
                            title="Público"
                            sub="Visible en la lista — cualquiera se inscribe"
                            active={!isPrivate}
                            onClick={() => setIsPrivate(false)}
                          />
                          <OptionTile
                            icon={<Lock size={18} />}
                            title="Privado"
                            sub="Solo por invitación — tú invitas por correo"
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
                        <MapPicker value={gameMap} onChange={setGameMap} options={MAPS} size="lg" />
                      </Field>

                      <Field
                        label="Tamaño de equipo"
                        hint={isArena ? 'Arena siempre es en duplas' : undefined}
                      >
                        <Seg
                          ariaLabel="Tamaño de equipo"
                          value={effTeamSize}
                          options={[1, 2, 3, 4, 5].map((n) => ({ value: n, label: `${n}v${n}` }))}
                          disabledOf={(n) => isArena && n !== 2}
                          onChange={(n) => !isArena && setTeamSize(n)}
                        />
                      </Field>

                      {isArena ? (
                        <>
                          <Field label="Duración de la ventana" hint="Desde la hora de inicio" htmlFor="tcm-duration">
                            <TdSelect
                              id="tcm-duration"
                              value={durationHours}
                              onValueChange={setDurationHours}
                              options={[2, 3, 4, 6, 12, 24].map((h) => ({ value: String(h), label: `${h} horas` }))}
                            />
                          </Field>

                          <Notice tone="warn" icon={<Swords size={18} />} title="Modo ladder (sin códigos)">
                            Arena no permite lobbies personalizados. Las duplas inscritas juegan
                            Arena normal durante la ventana y el sistema puntúa sus placements
                            automáticamente: cuentan sus 5 mejores partidas.
                          </Notice>
                        </>
                      ) : (
                        <>
                          <Field label="Bracket">
                            <Seg<string>
                              ariaLabel="Bracket"
                              value={bracketType}
                              options={BRACKETS}
                              onChange={setBracketType}
                            />
                          </Field>

                          <Field label="Series">
                            <Seg<string>
                              ariaLabel="Series por enfrentamiento"
                              value={seriesTo}
                              options={SERIES}
                              onChange={setSeriesTo}
                            />
                          </Field>

                          {bracketType === 'swiss' && (
                            <Field label="Piloto automático" hint="Rondas suizas" htmlFor="tcm-swiss">
                              <TdSelect
                                id="tcm-swiss"
                                value={swissRounds}
                                onValueChange={setSwissRounds}
                                options={[{ value: '0', label: 'Manual (botón siguiente ronda)' }, ...[3, 4, 5, 6, 7, 8, 9].map((n) => ({ value: String(n), label: `${n} rondas · avance automático` }))]}
                              />
                            </Field>
                          )}

                          <Field
                            label="Selección de campeones"
                            hint={gameMap === 'ARAM' ? 'Automático = aleatorio; también puedes draftear en el Abismo' : teamSize < 5 ? 'Automático = a ciegas' : 'Automático = Tournament Draft'}
                            htmlFor="tcm-pick"
                          >
                            <TdSelect
                              id="tcm-pick"
                              value={pickType}
                              onValueChange={setPickType}
                              options={PICK_TYPES.map((p) => ({ value: p.value, label: p.label }))}
                            />
                          </Field>

                          <Notice
                            tone={wantsCodes ? 'gold' : 'info'}
                            icon={wantsCodes ? <Zap size={18} /> : <Shuffle size={18} />}
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
                          </Notice>
                        </>
                      )}
                    </>
                  )}

                  {/* ───────────── Paso 3 · Agenda ───────────── */}
                  {step === 2 && (
                    <>
                      <div className="tf-grid-2">
                        <Field label="Fecha de inicio" required error={dateError} htmlFor="tcm-start">
                          <input
                            id="tcm-start"
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="td-input tf-date"
                            aria-invalid={dateError ? true : undefined}
                          />
                        </Field>

                        <Field label="Cierre de check-in" hint="Opcional" htmlFor="tcm-checkin">
                          <input
                            id="tcm-checkin"
                            type="datetime-local"
                            value={checkinDeadline}
                            onChange={(e) => setCheckinDeadline(e.target.value)}
                            className="td-input tf-date"
                          />
                        </Field>
                      </div>

                      <Field label="Máx. equipos">
                        <Seg<string>
                          ariaLabel="Máximo de equipos"
                          value={maxParticipants}
                          options={[4, 8, 16, 32, 64].map((n) => ({ value: String(n), label: String(n) }))}
                          onChange={setMaxParticipants}
                        />
                      </Field>

                      <Notice icon={<CalendarClock size={18} />} title="Cómo funciona el check-in">
                        Si pones fecha límite, los equipos tienen que confirmar antes de esa hora o
                        quedan fuera del bracket. Déjalo vacío si vas a confirmar tú a mano.
                      </Notice>

                      {!isArena && (
                        <Field label="Códigos oficiales de Riot">
                          <div className="tf-opts" role="group" aria-label="Códigos oficiales de Riot">
                            <OptionTile
                              icon={<Zap size={18} />}
                              title="Generar códigos"
                              sub="Lobbies oficiales y resultados automáticos"
                              active={createRiot}
                              onClick={() => setCreateRiot(true)}
                            />
                            <OptionTile
                              icon={<Users size={18} />}
                              title="Sin códigos"
                              sub="Los equipos arman sus partidas"
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
                <aside className="min-w-0 lg:sticky lg:top-0 lg:self-start">
                  <TournamentPreviewCard input={preview} />
                </aside>
              </div>
            </AtakModalBody>

            <AtakModalFooter>
              <div className="tf-foot-row">
                <Button
                  variant="secondary"
                  onClick={() => (step === 0 ? handleClose() : goTo(step - 1))}
                  disabled={loading}
                  icon={step === 0 ? undefined : <ChevronLeft size={16} aria-hidden />}
                >
                  {step === 0 ? 'Cancelar' : 'Atrás'}
                </Button>

                {step < STEPS.length - 1 ? (
                  <Button variant="primary" onClick={next}>
                    Siguiente <ChevronRight size={16} aria-hidden />
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={loading}
                    icon={loading
                      ? <Loader2 size={16} className="tf-spin" aria-hidden />
                      : <Trophy size={16} aria-hidden />}
                  >
                    {loading ? (wantsCodes ? 'Creando en Riot…' : 'Creando…') : 'Crear torneo'}
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
