// Formulario de creación de torneo EN la portada, sin abrir nada.
//
// Antes esto vivía detrás de un botón que abría un modal. Christian pidió que
// se vea directo, como la tarjeta de contacto de las landings modernas: lo
// primero que hace alguien que llega es crear su torneo, no leer sobre él.
//
// Solo pide lo imprescindible. Todo lo demás toma un valor por defecto sensato
// y se puede afinar en "Más opciones", que abre el asistente completo con lo
// ya escrito. Un torneo creado y luego ajustado vale más que un formulario
// perfecto que nadie termina.
//
// Sin cuenta se puede escribir igual: al enviar se guarda el borrador y se
// manda a registrarse. Al volver, el formulario aparece relleno.
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Check, Loader2, Mountain, Settings2, Snowflake, Swords, Trophy } from 'lucide-react';
import { Field, OptionCard, PillGroup, fieldCls } from '@/components/ui/form-bits';
import { CodesPanel } from '@/components/tournament/create/CodesPanel';
import { useCreateTournament } from '@/hooks/queries/tournaments';
import { useAuth } from '@/features/auth/useAuth';
import { toast } from '@/components/ui/sonner';
import {
  clearDraft, readDraft, saveDraft, type QuickTournamentDraft,
} from './quickTournamentDraft';

const MAPS = [
  { key: 'SR' as const, label: 'La Grieta', sub: 'Códigos de Riot', Icon: Mountain },
  { key: 'ARAM' as const, label: 'ARAM', sub: 'Abismo', Icon: Snowflake },
  { key: 'ARENA' as const, label: 'Arena', sub: 'Ladder 2v2', Icon: Swords },
];

const BRACKETS = [
  { value: 'single_elim', label: 'Eliminación' },
  { value: 'round_robin', label: 'Liga' },
  { value: 'swiss', label: 'Suizo' },
];

/** Mañana en formato YYYY-MM-DD: un torneo casi nunca arranca hoy mismo. */
function tomorrow() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

const EMPTY: QuickTournamentDraft = {
  name: '', gameMap: 'SR', teamSize: 5, startDate: tomorrow(),
  bracketType: 'single_elim', seriesTo: '1',
};

export function HomeCreateTournament({ onExpand }: {
  /** Abre el asistente completo con lo que ya se escribió aquí. */
  onExpand: (draft: QuickTournamentDraft) => void;
}) {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const create = useCreateTournament();

  const [form, setForm] = useState<QuickTournamentDraft>(EMPTY);
  const [touched, setTouched] = useState(false);
  const [resumed, setResumed] = useState(false);
  const [result, setResult] = useState<{
    id: string; name: string; riotTournamentId?: number;
    riotCodes?: string[]; riotSkippedReason?: string;
  } | null>(null);

  // Recuperar el borrador al volver de registrarse.
  useEffect(() => {
    const d = readDraft();
    if (!d) return;
    setForm(d);
    if (isAuthenticated) {
      setResumed(true);
      clearDraft();
    }
  }, [isAuthenticated]);

  const set = <K extends keyof QuickTournamentDraft>(k: K, v: QuickTournamentDraft[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const isArena = form.gameMap === 'ARENA';
  const effTeamSize = isArena ? 2 : form.teamSize;
  const nameError = touched && form.name.trim().length < 3 ? 'Pon al menos 3 caracteres.' : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.name.trim().length < 3) { setTouched(true); return; }

    if (!isAuthenticated) {
      saveDraft(form);
      toast.info('Crea tu cuenta para publicar el torneo', {
        description: 'Guardamos lo que escribiste: al volver sigue aquí.',
      });
      navigate('/register', { state: { from: { pathname: '/' } } });
      return;
    }

    const st = Number(form.seriesTo);
    try {
      const data = await create.mutateAsync({
        name: form.name.trim(),
        startDate: form.startDate,
        maxParticipants: 16,
        isPrivate: false,
        gameMap: form.gameMap,
        teamSize: effTeamSize,
        bracketType: isArena ? undefined : form.bracketType,
        seriesTo: isArena ? undefined : st,
        finalSeriesTo: isArena ? undefined : st,
        durationHours: isArena ? 3 : undefined,
      });
      clearDraft();
      setResult({ ...data.tournament, riotSkippedReason: data.riotSkippedReason });
    } catch {
      // El hook ya muestra el toast de error.
    }
  };

  // ── Éxito: el mismo panel se convierte en la entrega de códigos ───────────
  if (result) {
    return (
      <Panel>
        <CodesPanel
          name={result.name}
          riotTournamentId={result.riotTournamentId}
          codes={result.riotCodes ?? []}
          skippedReason={result.riotSkippedReason}
        />
        <div className="mt-4 flex gap-2">
          <Link
            to={`/tournaments/${result.id}`}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl py-3 text-sm font-bold text-white"
            style={{ background: 'linear-gradient(135deg,#ef4444,#b91c1c)' }}
          >
            Abrir mi torneo <ArrowRight className="h-4 w-4" />
          </Link>
          <button
            type="button"
            onClick={() => { setResult(null); setForm({ ...EMPTY, startDate: tomorrow() }); }}
            className="rounded-2xl border border-white/[0.12] bg-white/[0.04] px-4 text-sm font-semibold text-gray-300 hover:text-white"
          >
            Crear otro
          </button>
        </div>
      </Panel>
    );
  }

  return (
    <Panel>
      <div className="flex items-start gap-3">
        <span
          className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl border border-red-500/30"
          style={{ background: 'linear-gradient(160deg, rgba(225,36,46,0.26), rgba(225,36,46,0.05))' }}
        >
          <Trophy className="h-5 w-5 text-red-300" />
        </span>
        <div className="min-w-0">
          <h2 className="font-serif text-xl font-normal leading-tight text-white sm:text-2xl">
            Crea tu torneo
          </h2>
          <p className="mt-0.5 text-[12.5px] leading-snug text-white/45">
            Códigos oficiales de Riot, bracket automático y resultados que se detectan solos.
          </p>
        </div>
      </div>

      {resumed && (
        <p className="mt-3 flex items-center gap-2 rounded-xl border border-green-500/25 bg-green-500/[0.08] px-3 py-2 text-[12px] text-green-200">
          <Check className="h-3.5 w-3.5 flex-shrink-0" />
          Recuperamos lo que habías escrito. Revisa y publica.
        </p>
      )}

      <form onSubmit={submit} className="mt-4 flex flex-col gap-4">
        <Field label="Nombre del torneo" required error={nameError}>
          <input
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="Ej: Copa Querétaro Verano"
            className={fieldCls}
          />
        </Field>

        <Field label="Mapa y modo">
          <div className="grid grid-cols-3 gap-2">
            {MAPS.map(({ key, label, sub, Icon }) => (
              <OptionCard
                key={key}
                icon={<Icon />}
                title={label}
                sub={sub}
                active={form.gameMap === key}
                onClick={() => set('gameMap', key)}
              />
            ))}
          </div>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Equipos de" hint={isArena ? 'Arena es en duplas' : undefined}>
            <PillGroup
              value={effTeamSize}
              options={[1, 2, 3, 4, 5].map((n) => ({ value: n, label: `${n}v${n}` }))}
              disabledOf={(n) => isArena && n !== 2}
              onChange={(n) => !isArena && set('teamSize', n)}
            />
          </Field>

          <Field label="Arranca el">
            <input
              type="date"
              value={form.startDate}
              onChange={(e) => set('startDate', e.target.value)}
              className={`${fieldCls} [color-scheme:dark]`}
            />
          </Field>
        </div>

        {!isArena && (
          <Field label="Formato">
            <div className="flex flex-wrap gap-2">
              {BRACKETS.map((b) => (
                <button
                  key={b.value}
                  type="button"
                  aria-pressed={form.bracketType === b.value}
                  onClick={() => set('bracketType', b.value)}
                  className={`rounded-xl border px-3 py-2 text-[12.5px] font-semibold transition-all ${
                    form.bracketType === b.value
                      ? 'border-red-500/60 bg-red-500/15 text-red-300'
                      : 'border-white/[0.08] bg-white/[0.04] text-gray-300 hover:border-white/20'
                  }`}
                >
                  {b.label}
                </button>
              ))}
              <span className="mx-1 self-center text-white/15">|</span>
              {[['1', 'Bo1'], ['2', 'Bo3']].map(([v, label]) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={form.seriesTo === v}
                  onClick={() => set('seriesTo', v)}
                  className={`rounded-xl border px-3 py-2 text-[12.5px] font-semibold transition-all ${
                    form.seriesTo === v
                      ? 'border-red-500/60 bg-red-500/15 text-red-300'
                      : 'border-white/[0.08] bg-white/[0.04] text-gray-300 hover:border-white/20'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </Field>
        )}

        <button
          type="submit"
          disabled={create.isPending}
          className="mt-1 inline-flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold text-white transition-transform duration-200 hover:scale-[1.01] disabled:opacity-60 disabled:hover:scale-100"
          style={{
            background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
            boxShadow: '0 12px 34px -14px rgba(225,36,46,0.95)',
          }}
        >
          {create.isPending
            ? <><Loader2 className="h-4 w-4 animate-spin" /> Creando…</>
            : isAuthenticated
              ? <><Trophy className="h-4 w-4" /> Crear torneo</>
              : <>Crear cuenta y publicar <ArrowRight className="h-4 w-4" /></>}
        </button>

        <div className="flex items-center justify-between gap-3 text-[11.5px]">
          <button
            type="button"
            onClick={() => onExpand(form)}
            className="inline-flex items-center gap-1.5 text-gray-400 transition-colors hover:text-white"
          >
            <Settings2 className="h-3.5 w-3.5" /> Más opciones
          </button>
          <span className="text-white/30">
            {isAuthenticated ? '16 equipos · público' : 'Gratis, sin tarjeta'}
          </span>
        </div>
      </form>
    </Panel>
  );
}

/** Cristal de la portada. Aislado para que el éxito y el formulario compartan piel. */
function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-px rounded-[30px] opacity-60 blur-[26px]"
        style={{ background: 'radial-gradient(70% 110% at 50% 0%, rgba(225,36,46,0.5), transparent 72%)' }}
      />
      <div
        className="relative rounded-[26px] border border-white/[0.10] p-5 text-left sm:p-6"
        style={{
          background:
            'linear-gradient(180deg, rgba(255,255,255,0.055) 0%, rgba(255,255,255,0.015) 38%, rgba(0,0,0,0.35) 100%)',
          backdropFilter: 'blur(22px) saturate(140%)',
          WebkitBackdropFilter: 'blur(22px) saturate(140%)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.10), 0 30px 80px -44px rgba(0,0,0,0.95)',
        }}
      >
        {children}
      </div>
    </div>
  );
}

export default HomeCreateTournament;
