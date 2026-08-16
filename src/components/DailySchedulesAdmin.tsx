// Administración de torneos diarios programados (plantillas).
// CRUD contra /api/tournaments/schedules — el scheduler del backend crea la
// instancia del día, abre inscripciones y auto-inicia/cancela a la hora.
// Solo organizadores aprobados/admin pueden crear (el backend lo gatea).
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { axiosInstance } from '@/lib/axios';
import { toast } from '@/components/ui/sonner';
import {
  CalendarClock, Plus, Trash2, Power, Loader2,
  Mountain, Snowflake, Swords,
} from 'lucide-react';

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
  SR:    { label: 'Grieta', Icon: Mountain,  tint: '#ff5a64' },
  ARAM:  { label: 'ARAM',   Icon: Snowflake, tint: '#5ad4ff' },
  ARENA: { label: 'Arena',  Icon: Swords,    tint: '#f0b232' },
} as const;

const field: React.CSSProperties = {
  width: '100%', height: 38, padding: '0 12px',
  background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.10)',
  borderRadius: 10, color: '#fff', fontSize: 13, outline: 'none',
};

const over: React.CSSProperties = {
  fontSize: 10.5, letterSpacing: '0.1em', textTransform: 'uppercase',
  color: 'rgba(255,255,255,0.45)', display: 'block', marginBottom: 5, fontWeight: 700,
};

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
    <div className="vs-card" style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="vs-ico"><CalendarClock size={18} /></span>
          <div>
            <h2 style={{ margin: 0, fontWeight: 700, fontSize: 16, color: '#fff' }}>Torneos diarios</h2>
            <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>
              Plantillas que crean, abren e inician torneos solas cada día
            </p>
          </div>
        </div>
        <button className="vs-btn" style={{ height: 36, fontSize: 13 }} onClick={() => setShowForm(v => !v)}>
          <Plus size={14} style={{ marginRight: 6 }} /> Nueva plantilla
        </button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            style={{ overflow: 'hidden', marginBottom: 18 }}
          >
            <div style={{
              padding: 18, borderRadius: 14, border: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(0,0,0,0.25)', display: 'grid', gap: 14,
            }}>
              <div>
                <label style={over}>Nombre</label>
                <input style={field} value={form.name} placeholder="Ej: Arena Nocturna ATAK"
                  onChange={e => set({ name: e.target.value })} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
                <div>
                  <label style={over}>Modo</label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {(Object.keys(MAP_META) as Array<keyof typeof MAP_META>).map(k => {
                      const M = MAP_META[k];
                      const active = form.gameMap === k;
                      return (
                        <button key={k} type="button" onClick={() => set({ gameMap: k })}
                          style={{
                            flex: 1, height: 38, borderRadius: 10, cursor: 'pointer',
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                            fontSize: 12, fontWeight: 700,
                            color: active ? M.tint : 'rgba(255,255,255,0.55)',
                            background: active ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.3)',
                            border: `1px solid ${active ? M.tint + '66' : 'rgba(255,255,255,0.08)'}`,
                          }}>
                          <M.Icon size={13} /> {M.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <label style={over}>Tamaño</label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {[1, 2, 3, 4, 5].map(n => {
                      const active = (isArena ? 2 : form.teamSize) === n;
                      const disabled = isArena && n !== 2;
                      return (
                        <button key={n} type="button" disabled={disabled}
                          onClick={() => !isArena && set({ teamSize: n })}
                          style={{
                            flex: 1, height: 38, borderRadius: 10, fontSize: 12, fontWeight: 700,
                            cursor: disabled ? 'not-allowed' : 'pointer',
                            opacity: disabled ? 0.3 : 1,
                            color: active ? '#ff5a64' : 'rgba(255,255,255,0.55)',
                            background: active ? 'rgba(225,36,46,0.12)' : 'rgba(0,0,0,0.3)',
                            border: `1px solid ${active ? 'rgba(225,36,46,0.5)' : 'rgba(255,255,255,0.08)'}`,
                          }}>
                          {n}v{n}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12 }}>
                <div>
                  <label style={over}>Hora (local liga)</label>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <select style={{ ...field, width: 'auto', flex: 1 }} value={form.startHour}
                      onChange={e => set({ startHour: Number(e.target.value) })}>
                      {Array.from({ length: 24 }, (_, h) => (
                        <option key={h} value={h} style={{ background: '#101014' }}>{String(h).padStart(2, '0')}</option>
                      ))}
                    </select>
                    <span style={{ color: 'rgba(255,255,255,0.4)' }}>:</span>
                    <select style={{ ...field, width: 'auto', flex: 1 }} value={form.startMinute}
                      onChange={e => set({ startMinute: Number(e.target.value) })}>
                      {[0, 15, 30, 45].map(m => (
                        <option key={m} value={m} style={{ background: '#101014' }}>{String(m).padStart(2, '0')}</option>
                      ))}
                    </select>
                  </div>
                </div>
                {!isArena ? (
                  <>
                    <div>
                      <label style={over}>Bracket</label>
                      <select style={field} value={form.bracketType} onChange={e => set({ bracketType: e.target.value })}>
                        <option value="single_elim" style={{ background: '#101014' }}>Eliminación</option>
                        <option value="round_robin" style={{ background: '#101014' }}>Liga</option>
                        <option value="swiss" style={{ background: '#101014' }}>Suizo</option>
                      </select>
                    </div>
                    <div>
                      <label style={over}>Series</label>
                      <select style={field} value={form.seriesTo} onChange={e => set({ seriesTo: Number(e.target.value) })}>
                        <option value={1} style={{ background: '#101014' }}>Bo1</option>
                        <option value={2} style={{ background: '#101014' }}>Bo3</option>
                        <option value={3} style={{ background: '#101014' }}>Bo5</option>
                      </select>
                    </div>
                  </>
                ) : (
                  <div>
                    <label style={over}>Ventana (horas)</label>
                    <select style={field} value={form.durationHours} onChange={e => set({ durationHours: Number(e.target.value) })}>
                      {[2, 3, 4, 6].map(h => <option key={h} value={h} style={{ background: '#101014' }}>{h}h</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <label style={over}>Mín. equipos</label>
                  <select style={field} value={form.minTeams} onChange={e => set({ minTeams: Number(e.target.value) })}>
                    {[2, 4, 8].map(n => <option key={n} value={n} style={{ background: '#101014' }}>{n}</option>)}
                  </select>
                </div>
                <div>
                  <label style={over}>Máx. equipos</label>
                  <select style={field} value={form.maxParticipants} onChange={e => set({ maxParticipants: Number(e.target.value) })}>
                    {[8, 16, 32, 64].map(n => <option key={n} value={n} style={{ background: '#101014' }}>{n}</option>)}
                  </select>
                </div>
              </div>

              {form.bracketType === 'swiss' && !isArena && (
                <div>
                  <label style={over}>Piloto automático (rondas suizas)</label>
                  <select style={field} value={form.swissRounds} onChange={e => set({ swissRounds: Number(e.target.value) })}>
                    <option value={0} style={{ background: '#101014' }}>Manual</option>
                    {[3, 4, 5].map(n => <option key={n} value={n} style={{ background: '#101014' }}>{n} rondas automáticas</option>)}
                  </select>
                </div>
              )}

              <div>
                <label style={over}>Días (vacío = todos)</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {DAY_LABELS.map((d, i) => {
                    const active = form.days === null || form.days.includes(i);
                    return (
                      <button key={i} type="button" onClick={() => toggleDay(i)} title={DAY_FULL[i]}
                        style={{
                          width: 34, height: 34, borderRadius: 10, fontSize: 12, fontWeight: 800, cursor: 'pointer',
                          color: active ? '#fff' : 'rgba(255,255,255,0.3)',
                          background: active ? 'rgba(225,36,46,0.25)' : 'rgba(0,0,0,0.3)',
                          border: `1px solid ${active ? 'rgba(225,36,46,0.5)' : 'rgba(255,255,255,0.08)'}`,
                        }}>
                        {d}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'end' }}>
                <div>
                  <label style={over}>Premio (opcional)</label>
                  <input style={field} value={form.prize} placeholder="Ej: RP + puntos de liga"
                    onChange={e => set({ prize: e.target.value })} />
                </div>
                {!isArena && (
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'rgba(255,255,255,0.7)', height: 38, cursor: 'pointer' }}>
                    <input type="checkbox" checked={form.createRiot} onChange={e => set({ createRiot: e.target.checked })}
                      style={{ accentColor: '#a78bfa' }} />
                    Códigos Riot
                  </label>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button className="vs-btn vs-btn--ghost" style={{ height: 38, fontSize: 13 }} onClick={() => setShowForm(false)}>
                  Cancelar
                </button>
                <button className="vs-btn" style={{ height: 38, fontSize: 13, minWidth: 150 }} onClick={create} disabled={saving}>
                  {saving ? <Loader2 size={14} className="animate-spin" /> : 'Crear plantilla'}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Listado */}
      {schedules === null ? (
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>Cargando…</p>
      ) : schedules.length === 0 ? (
        <p style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.45)', margin: '8px 0' }}>
          Sin plantillas. Crea una y el torneo del día aparecerá solo en /tournaments,
          abrirá inscripciones y arrancará a su hora.
        </p>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {schedules.map((s, i) => {
            const M = MAP_META[s.gameMap] ?? MAP_META.SR;
            return (
              <motion.div key={s.id}
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, duration: 0.35 }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px',
                  borderRadius: 12, border: '1px solid rgba(255,255,255,0.07)',
                  background: 'rgba(0,0,0,0.22)', opacity: s.enabled ? 1 : 0.5,
                }}>
                <span style={{
                  width: 38, height: 38, borderRadius: 10, display: 'grid', placeItems: 'center',
                  background: `${M.tint}1a`, border: `1px solid ${M.tint}55`, color: M.tint, flexShrink: 0,
                }}>
                  <M.Icon size={16} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.name}
                    <span style={{ fontWeight: 600, fontSize: 11.5, color: M.tint, marginLeft: 8 }}>
                      {s.gameMap === 'ARENA' ? 'Arena 2v2' : `${s.teamSize}v${s.teamSize}`}
                    </span>
                  </p>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>
                    {s.days ? s.days.map(d => DAY_FULL[d]).join(' · ') : 'Diario'} · {String(s.startHour).padStart(2, '0')}:{String(s.startMinute).padStart(2, '0')}
                    {' · '}mín {s.minTeams} equipos
                    {s.lastSpawnedDate && ` · último: ${s.lastSpawnedDate}`}
                  </p>
                </div>
                <button onClick={() => toggleEnabled(s)} title={s.enabled ? 'Pausar' : 'Activar'}
                  style={{
                    width: 34, height: 34, borderRadius: 10, cursor: 'pointer', display: 'grid', placeItems: 'center',
                    color: s.enabled ? '#2fbf8a' : 'rgba(255,255,255,0.35)',
                    background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.09)',
                  }}>
                  <Power size={14} />
                </button>
                <button onClick={() => remove(s)} title="Eliminar"
                  style={{
                    width: 34, height: 34, borderRadius: 10, cursor: 'pointer', display: 'grid', placeItems: 'center',
                    color: '#ff5a64', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.09)',
                  }}>
                  <Trash2 size={14} />
                </button>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
