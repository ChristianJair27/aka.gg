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
import { ArrowRight, Check, Loader2, Plus, Settings2, Trophy } from 'lucide-react';
import { Button } from '@/components/tournament/ui';
import { Field, MapPicker, Notice, Seg, type MapOption } from '@/components/tournament/forms';
import { CodesPanel } from '@/components/tournament/create/CodesPanel';
import { useCreateTournament } from '@/hooks/queries/tournaments';
import { useAuth } from '@/features/auth/useAuth';
import { toast } from '@/components/ui/sonner';
import {
  clearDraft, readDraft, saveDraft, type QuickTournamentDraft,
} from './quickTournamentDraft';

// El arte de cada tarjeta sale del propio mapa (ver MapPicker → lol.map).
const MAPS: MapOption[] = [
  { key: 'SR', label: 'La Grieta', sub: 'Códigos de Riot' },
  { key: 'ARAM', label: 'ARAM', sub: 'Abismo' },
  { key: 'ARENA', label: 'Arena', sub: 'Ladder 2v2' },
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
        <div className="tf-home-actions">
          <Link to={`/tournaments/${result.id}`} className="td-btn td-btn--primary">
            Abrir mi torneo <ArrowRight size={16} aria-hidden />
          </Link>
          <Button
            variant="secondary" icon={<Plus size={15} aria-hidden />}
            onClick={() => { setResult(null); setForm({ ...EMPTY, startDate: tomorrow() }); }}
          >
            Crear otro
          </Button>
        </div>
      </Panel>
    );
  }

  return (
    <Panel>
      <span className="td-over ax-kicker">Organiza · gratis</span>
      <h2 className="tf-home-title">Crea tu <em>torneo</em></h2>
      <p className="tf-home-lede">
        Códigos oficiales de Riot, bracket automático y resultados que se detectan solos.
      </p>

      {resumed && (
        <Notice tone="ok" icon={<Check size={16} />} className="mt-4">
          Recuperamos lo que habías escrito. Revisa y publica.
        </Notice>
      )}

      <form onSubmit={submit} className="tf-home-form">
        <Field label="Nombre del torneo" required error={nameError} htmlFor="hct-name">
          <input
            id="hct-name"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="Ej: Copa Querétaro Verano"
            className="td-input"
            aria-invalid={nameError ? true : undefined}
            autoComplete="off"
          />
        </Field>

        <Field label="Mapa y modo">
          <MapPicker value={form.gameMap} onChange={(m) => set('gameMap', m)} options={MAPS} />
        </Field>

        <div className="tf-home-grid">
          <Field label="Equipos de" hint={isArena ? 'Arena es en duplas' : undefined}>
            <Seg
              ariaLabel="Tamaño de equipo"
              value={effTeamSize}
              options={[1, 2, 3, 4, 5].map((n) => ({ value: n, label: `${n}v${n}` }))}
              disabledOf={(n) => isArena && n !== 2}
              onChange={(n) => !isArena && set('teamSize', n)}
            />
          </Field>

          {!isArena && (
            <Field label="Series">
              <Seg
                ariaLabel="Series por enfrentamiento"
                value={form.seriesTo}
                options={[{ value: '1', label: 'Bo1' }, { value: '2', label: 'Bo3' }]}
                onChange={(v) => set('seriesTo', v)}
              />
            </Field>
          )}

          {!isArena && (
            <Field label="Formato">
              <Seg
                ariaLabel="Formato del torneo"
                value={form.bracketType}
                options={BRACKETS}
                onChange={(v) => set('bracketType', v)}
              />
            </Field>
          )}

          <Field label="Arranca el" htmlFor="hct-date">
            <input
              id="hct-date"
              type="date"
              value={form.startDate}
              onChange={(e) => set('startDate', e.target.value)}
              className="td-input tf-date"
            />
          </Field>
        </div>

        <Button
          type="submit" variant="primary" full disabled={create.isPending}
          icon={create.isPending
            ? <Loader2 size={16} className="tf-spin" aria-hidden />
            : isAuthenticated ? <Trophy size={16} aria-hidden /> : undefined}
        >
          {create.isPending
            ? 'Creando…'
            : isAuthenticated
              ? 'Crear torneo'
              : <>Crear cuenta y publicar <ArrowRight size={16} aria-hidden /></>}
        </Button>

        <div className="tf-home-foot">
          <button type="button" onClick={() => onExpand(form)} className="tf-linkbtn">
            <Settings2 size={15} aria-hidden /> Más opciones
          </button>
          <span>{isAuthenticated ? '16 equipos · público' : 'Gratis, sin tarjeta'}</span>
        </div>
      </form>
    </Panel>
  );
}

/**
 * Piel del panel. Lleva su propio `td-root` (tokens y clases Arena) para no
 * depender de dónde lo monte la portada; opaco, con hairline y el tramo crimson.
 */
function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="td-root tf-home">
      <div className="td-panel tf-home-panel">{children}</div>
    </div>
  );
}

export default HomeCreateTournament;
