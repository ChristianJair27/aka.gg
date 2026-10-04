// Administración de torneos diarios programados (plantillas).
// CRUD contra /api/tournaments/schedules — el scheduler del backend crea la
// instancia del día, abre inscripciones y auto-inicia/cancela a la hora.
// Solo organizadores aprobados/admin pueden crear (el backend lo gatea).
//
// Visual: sistema "Arena" (td-panel, td-field/td-label/td-input). Requiere un
// ancestro .td-root; las clases db-* viven en src/styles/pages/dashboard.css.
import { useEffect, useState } from 'react';
import { axiosInstance } from '@/lib/axios';
import { toast } from '@/components/ui/sonner';
import {
  CalendarClock, Plus, Trash2, Power, Loader2,
  Mountain, Snowflake, Swords,
} from 'lucide-react';
import { Button, StatusChip, SectionHead } from '@/components/tournament/ui';
import { lol, mapArtFor } from '@/lib/lolAssets';
import '@/styles/pages/dashboard.css';

type Schedule = {
  id: number; name: string; description: string;
  gameMap: 'SR' | 'ARAM' | 'ARENA'; teamSize: number;
  pickType: string | null; bracketType: string;
  seriesTo: number; finalSeriesTo: number; swissRounds: number | null;
  maxParticipants: number; prize: string; region: string;
  startHour: number; startMinute: number; tzOffsetMinutes: number;
  days: number[] | null; openBeforeMinutes: number;
  minTeams: number; durationHours: number;
  autoStart: boolean; enabled: boolean; createRiot: boolean;
  lastSpawnedDate: string | null;
};

const DAY_LABELS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
const DAY_FULL = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

const MAP_META = {
  SR:    { label: 'Grieta', Icon: Mountain },
  ARAM:  { label: 'ARAM',   Icon: Snowflake },
  ARENA: { label: 'Arena',  Icon: Swords },
} as const;

const DEFAULT_FORM = {
  name: '', gameMap: 'SR' as Schedule['gameMap'], teamSize: 5,
  bracketType: 'single_elim', seriesTo: 1,
  startHour: 20, startMinute: 0, days: null as number[] | null,
  minTeams: 2, maxParticipants: 16, prize: '', durationHours: 3,
  swissRounds: 0, createRiot: false,
};

export function DailySchedulesAdmin() {
  const [schedules, setSchedules] = useState<Schedule[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...DEFAULT_FORM });
  const isArena = form.gameMap === 'ARENA';

  const load = () => axiosInstance.get('/api/tournaments/schedules')
    .then(r => setSchedules(Array.isArray(r.data) ? r.data : []))
    .catch(() => setSchedules([]));
  useEffect(() => { load(); }, []);

  const set = (patch: Partial<typeof DEFAULT_FORM>) => setForm(f => ({ ...f, ...patch }));

  const toggleDay = (d: number) => set({
    days: form.days === null
      ? [0, 1, 2, 3, 4, 5, 6].filter(x => x !== d)          // "diario" menos este día
      : form.days.includes(d)
        ? (form.days.length > 1 ? form.days.filter(x => x !== d) : form.days)
        : [...form.days, d].sort(),
  });

  const create = async () => {
    if (!form.name.trim()) { toast.error('Ponle nombre a la plantilla'); return; }
    setSaving(true);
    try {
      await axiosInstance.post('/api/tournaments/schedules', {
        name: form.name.trim(),
        gameMap: form.gameMap,
        teamSize: isArena ? 2 : form.teamSize,
        bracketType: isArena ? 'round_robin' : form.bracketType,
        seriesTo: form.seriesTo,
        finalSeriesTo: form.seriesTo,
        swissRounds: form.bracketType === 'swiss' && form.swissRounds > 0 ? form.swissRounds : null,
        startHour: form.startHour, startMinute: form.startMinute,
        days: form.days,
        minTeams: form.minTeams, maxParticipants: form.maxParticipants,
        prize: form.prize, durationHours: form.durationHours,
        createRiot: form.createRiot,
        autoStart: true, enabled: true,
      });
      toast.success('Plantilla creada', { description: 'El torneo del día se creará solo a la hora configurada.' });
      setForm({ ...DEFAULT_FORM });
      setShowForm(false);
      load();
    } catch (e: any) {
      toast.error('No se pudo crear', { description: e.response?.data?.error || e.message });
    } finally { setSaving(false); }
  };

  const toggleEnabled = async (s: Schedule) => {
    try {
      await axiosInstance.patch(`/api/tournaments/schedules/${s.id}`, { enabled: !s.enabled });
      load();
    } catch (e: any) { toast.error(e.response?.data?.error || 'Error'); }
  };

  const remove = async (s: Schedule) => {
    if (!window.confirm(`¿Eliminar la plantilla "${s.name}"? Los torneos ya creados no se borran.`)) return;
    try {
      await axiosInstance.delete(`/api/tournaments/schedules/${s.id}`);
      toast.success('Plantilla eliminada');
      load();
    } catch (e: any) { toast.error(e.response?.data?.error || 'Error'); }
  };

  return (
    <section className="td-panel db-card">
      <SectionHead
        size="lg"
        icon={<CalendarClock size={19} />}
        title="Torneos diarios"
        right={
          <Button variant={showForm ? 'secondary' : 'primary'} icon={<Plus size={15} />} onClick={() => setShowForm(v => !v)}>
            Nueva plantilla
          </Button>
        }
      />
      <p className="db-block-sub" style={{ marginTop: -8, marginBottom: 18 }}>
        Plantillas que crean, abren e inician torneos solas cada día
      </p>

      {showForm && (
        <div className="td-sub db-sched-form ax-rise">
          <div className="td-field">
            <label className="td-label" htmlFor="ds-name">Nombre</label>
            <input id="ds-name" className="td-input" value={form.name} placeholder="Ej: Arena Nocturna ATAK"
              onChange={e => set({ name: e.target.value })} />
          </div>

          <div className="db-sched-grid db-sched-grid--wide">
            <div className="td-field">
              <span className="td-label" id="ds-mode">Modo</span>
              <div className="db-opts" role="group" aria-labelledby="ds-mode">
                {(Object.keys(MAP_META) as Array<keyof typeof MAP_META>).map(k => {
                  const M = MAP_META[k];
                  const active = form.gameMap === k;
                  return (
                    <button key={k} type="button" className="db-opt" data-active={active} aria-pressed={active}
                      onClick={() => set({ gameMap: k })}>
                      <M.Icon size={15} aria-hidden /> {M.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="td-field">
              <span className="td-label" id="ds-size">Tamaño</span>
              <div className="db-opts" role="group" aria-labelledby="ds-size">
                {[1, 2, 3, 4, 5].map(n => {
                  const active = (isArena ? 2 : form.teamSize) === n;
                  const disabled = isArena && n !== 2;
                  return (
                    <button key={n} type="button" className="db-opt td-num" disabled={disabled}
                      data-active={active} aria-pressed={active}
                      onClick={() => !isArena && set({ teamSize: n })}>
                      {n}v{n}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="db-sched-grid">
            <div className="td-field">
              <span className="td-label" id="ds-hour">Hora (local liga)</span>
              <div className="db-time" role="group" aria-labelledby="ds-hour">
                <select className="td-select td-num" aria-label="Hora" value={form.startHour}
                  onChange={e => set({ startHour: Number(e.target.value) })}>
                  {Array.from({ length: 24 }, (_, h) => (
                    <option key={h} value={h}>{String(h).padStart(2, '0')}</option>
                  ))}
                </select>
                <span aria-hidden style={{ color: 'var(--td-muted)' }}>:</span>
                <select className="td-select td-num" aria-label="Minutos" value={form.startMinute}
                  onChange={e => set({ startMinute: Number(e.target.value) })}>
                  {[0, 15, 30, 45].map(m => (
                    <option key={m} value={m}>{String(m).padStart(2, '0')}</option>
                  ))}
                </select>
              </div>
            </div>
            {!isArena ? (
              <>
                <div className="td-field">
                  <label className="td-label" htmlFor="ds-bracket">Bracket</label>
                  <select id="ds-bracket" className="td-select" value={form.bracketType} onChange={e => set({ bracketType: e.target.value })}>
                    <option value="single_elim">Eliminación</option>
                    <option value="round_robin">Liga</option>
                    <option value="swiss">Suizo</option>
                  </select>
                </div>
                <div className="td-field">
                  <label className="td-label" htmlFor="ds-series">Series</label>
                  <select id="ds-series" className="td-select" value={form.seriesTo} onChange={e => set({ seriesTo: Number(e.target.value) })}>
                    <option value={1}>Bo1</option>
                    <option value={2}>Bo3</option>
                    <option value={3}>Bo5</option>
                  </select>
                </div>
              </>
            ) : (
              <div className="td-field">
                <label className="td-label" htmlFor="ds-window">Ventana (horas)</label>
                <select id="ds-window" className="td-select" value={form.durationHours} onChange={e => set({ durationHours: Number(e.target.value) })}>
                  {[2, 3, 4, 6].map(h => <option key={h} value={h}>{h}h</option>)}
                </select>
              </div>
            )}
            <div className="td-field">
              <label className="td-label" htmlFor="ds-min">Mín. equipos</label>
              <select id="ds-min" className="td-select" value={form.minTeams} onChange={e => set({ minTeams: Number(e.target.value) })}>
                {[2, 4, 8].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div className="td-field">
              <label className="td-label" htmlFor="ds-max">Máx. equipos</label>
              <select id="ds-max" className="td-select" value={form.maxParticipants} onChange={e => set({ maxParticipants: Number(e.target.value) })}>
                {[8, 16, 32, 64].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>

          {form.bracketType === 'swiss' && !isArena && (
            <div className="td-field">
              <label className="td-label" htmlFor="ds-swiss">Piloto automático (rondas suizas)</label>
              <select id="ds-swiss" className="td-select" value={form.swissRounds} onChange={e => set({ swissRounds: Number(e.target.value) })}>
                <option value={0}>Manual</option>
                {[3, 4, 5].map(n => <option key={n} value={n}>{n} rondas automáticas</option>)}
              </select>
            </div>
          )}

          <div className="td-field">
            <span className="td-label" id="ds-days">Días (vacío = todos)</span>
            <div className="db-opts" role="group" aria-labelledby="ds-days" style={{ flexWrap: 'wrap' }}>
              {DAY_LABELS.map((d, i) => {
                const active = form.days === null || form.days.includes(i);
                return (
                  <button key={i} type="button" className="db-opt db-opt--day" data-active={active} aria-pressed={active}
                    onClick={() => toggleDay(i)} title={DAY_FULL[i]} aria-label={DAY_FULL[i]}>
                    {d}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="db-sched-grid db-sched-grid--wide" style={{ alignItems: 'end' }}>
            <div className="td-field">
              <label className="td-label" htmlFor="ds-prize">Premio (opcional)</label>
              <input id="ds-prize" className="td-input" value={form.prize} placeholder="Ej: RP + puntos de liga"
                onChange={e => set({ prize: e.target.value })} />
            </div>
            {!isArena && (
              <label className="db-check">
                <input type="checkbox" checked={form.createRiot} onChange={e => set({ createRiot: e.target.checked })} />
                Códigos Riot
              </label>
            )}
          </div>

          <div className="db-sched-actions">
            <Button variant="secondary" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button variant="primary" onClick={create} disabled={saving}
              icon={saving ? <Loader2 size={15} className="animate-spin" /> : undefined}>
              {saving ? 'Creando…' : 'Crear plantilla'}
            </Button>
          </div>
        </div>
      )}

      {/* Listado */}
      {schedules === null ? (
        <p className="db-muted" role="status">Cargando…</p>
      ) : schedules.length === 0 ? (
        <p className="db-muted" style={{ maxWidth: '62ch' }}>
          Sin plantillas. Crea una y el torneo del día aparecerá solo en /tournaments,
          abrirá inscripciones y arrancará a su hora.
        </p>
      ) : (
        <div className="db-stack">
          {schedules.map((s) => {
            const M = MAP_META[s.gameMap] ?? MAP_META.SR;
            return (
              <div key={s.id} className="db-sched" data-off={!s.enabled}>
                {/* Miniatura con el arte del mapa de la plantilla */}
                <img className="ax-champ" src={lol.map(mapArtFor(s.gameMap))} alt="" width={44} height={44}
                  loading="lazy" decoding="async" style={{ width: 44, height: 44 }}
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }} />
                <div className="db-sched-main">
                  <p className="db-sched-name">
                    {s.name}
                    <StatusChip kind="dim" dot={false}>
                      <M.Icon size={12} aria-hidden />
                      {s.gameMap === 'ARENA' ? 'Arena 2v2' : `${M.label} ${s.teamSize}v${s.teamSize}`}
                    </StatusChip>
                    {!s.enabled && <StatusChip kind="warn" dot={false}>Pausada</StatusChip>}
                  </p>
                  <p className="db-sched-sub td-num">
                    {s.days ? s.days.map(d => DAY_FULL[d]).join(' · ') : 'Diario'} · {String(s.startHour).padStart(2, '0')}:{String(s.startMinute).padStart(2, '0')}
                    {' · '}mín {s.minTeams} equipos
                    {s.lastSpawnedDate && ` · último: ${s.lastSpawnedDate}`}
                  </p>
                </div>
                <button type="button" className="db-iconbtn" data-on={s.enabled} onClick={() => toggleEnabled(s)}
                  title={s.enabled ? 'Pausar' : 'Activar'} aria-label={`${s.enabled ? 'Pausar' : 'Activar'} ${s.name}`}>
                  <Power size={16} aria-hidden />
                </button>
                <button type="button" className="db-iconbtn" data-danger="true" onClick={() => remove(s)}
                  title="Eliminar" aria-label={`Eliminar ${s.name}`}>
                  <Trash2 size={16} aria-hidden />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
