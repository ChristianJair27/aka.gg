// Mesa de control del caster: /broadcast/:canal/control
//
// El espectador no recibe dragón, vacuolarvas, heraldo ni barón (solo el
// companion de un JUGADOR los manda). Desde aquí el caster o un asistente los
// marca con un clic y el overlay los pinta como si fueran eventos reales:
// contadores, dragones hacia el alma, timers y avisos. Pide el token del feed
// (el mismo del modo caster del companion) y lo recuerda en este navegador.
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { axiosInstance } from '@/lib/axios';
import { lol, type DragonKey } from '@/lib/lolAssets';
import { toast } from 'sonner';
import { Undo2, Trash2, Radio } from 'lucide-react';
import '@/styles/arena.css';

type Side = 'blue' | 'red';
const DRAGONS: Array<{ type: string; key: DragonKey; label: string }> = [
  { type: 'Fire', key: 'infernal', label: 'Infernal' }, { type: 'Water', key: 'ocean', label: 'Océano' },
  { type: 'Earth', key: 'mountain', label: 'Montaña' }, { type: 'Air', key: 'cloud', label: 'Nubes' },
  { type: 'Hextech', key: 'hextech', label: 'Hextech' }, { type: 'Chemtech', key: 'chemtech', label: 'Químico' },
  { type: 'Elder', key: 'elder', label: 'Anciano' },
];
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const NAME_ES: Record<string, string> = { DragonKill: 'Dragón', HordeKill: 'Larvas', HeraldKill: 'Heraldo', BaronKill: 'Barón', TurretKilled: 'Torre' };

export default function BroadcastControlPage() {
  const { channel = '' } = useParams();
  const [token, setToken] = useState<string>(() => { try { return localStorage.getItem('atak.feed.token') || ''; } catch { return ''; } });
  const [feed, setFeed] = useState<any>(null);
  const [marks, setMarks] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => { try { localStorage.setItem('atak.feed.token', token); } catch { /* */ } }, [token]);

  // Estado en vivo cada 3 s: partida, equipos, reloj y lo ya marcado.
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const r = await axiosInstance.get(`/api/live-feed/${channel}`, { validateStatus: () => true });
        if (!alive) return;
        setFeed(r.status === 200 ? r.data : null);
        const m = await axiosInstance.get(`/api/live-feed/${channel}/mark`);
        if (alive) setMarks(Array.isArray(m.data?.events) ? m.data.events : []);
      } catch { /* sin feed */ }
    };
    void tick();
    const id = window.setInterval(tick, 3000);
    return () => { alive = false; window.clearInterval(id); };
  }, [channel]);

  const teams = useMemo(() => ({ blue: feed?.team1 || 'Lado azul', red: feed?.team2 || 'Lado rojo' }), [feed]);
  const headers = { 'X-Feed-Token': token };
  const mark = async (name: string, side: Side, extra = '') => {
    if (!token) { toast.error('Pon el token del feed (el del modo caster del companion)'); return; }
    setBusy(true);
    try {
      const { data } = await axiosInstance.post(`/api/live-feed/${channel}/mark`, { name, side, extra }, { headers });
      toast.success(`${NAME_ES[name] || name}${extra ? ` ${extra}` : ''} → ${teams[side]} (${fmt(data.event?.t || 0)})`);
      setMarks((m) => [...m, data.event]);
    } catch (e: any) { toast.error(e?.response?.data?.error || 'No se pudo marcar'); }
    finally { setBusy(false); }
  };
  const undo = async () => {
    setBusy(true);
    try { const { data } = await axiosInstance.delete(`/api/live-feed/${channel}/mark/last`, { headers }); setMarks((m) => m.slice(0, -1)); toast(data.removed ? `Quitado: ${NAME_ES[data.removed.name] || data.removed.name}` : 'Nada que deshacer'); }
    catch (e: any) { toast.error(e?.response?.data?.error || 'No se pudo deshacer'); }
    finally { setBusy(false); }
  };
  const clear = async () => {
    if (!window.confirm('¿Borrar todos los objetivos marcados de esta partida?')) return;
    try { await axiosInstance.delete(`/api/live-feed/${channel}/mark`, { headers }); setMarks([]); toast('Marcas borradas'); }
    catch (e: any) { toast.error(e?.response?.data?.error || 'No se pudo borrar'); }
  };

  const count = (name: string, side: Side) => marks.filter((m) => m.name === name && m.side === side).length;
  const sideBlock = (side: Side) => (
    <div className="td-panel" style={{ padding: 16, borderTop: `3px solid ${side === 'blue' ? '#3b82f6' : '#e8323c'}` }}>
      <div className="td-over" style={{ marginBottom: 10 }}>{side === 'blue' ? 'LADO AZUL' : 'LADO ROJO'} · <b style={{ color: 'var(--td-text)' }}>{teams[side]}</b></div>
      <div className="td-over" style={{ fontSize: 11, marginBottom: 6 }}>DRAGÓN</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
        {DRAGONS.map((d) => (
          <button key={d.type} type="button" disabled={busy} onClick={() => mark('DragonKill', side, d.type)} className="td-btn td-btn--secondary" style={{ flexDirection: 'column', gap: 4, height: 72, padding: 6 }}>
            <img src={lol.dragon(d.key)} alt="" style={{ width: 28, height: 28, objectFit: 'contain' }} />
            <span style={{ fontSize: 11 }}>{d.label}</span>
          </button>
        ))}
      </div>
      <div className="td-over" style={{ fontSize: 11, margin: '12px 0 6px' }}>OTROS OBJETIVOS</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        <button type="button" disabled={busy} onClick={() => mark('HordeKill', side)} className="td-btn td-btn--secondary" style={{ height: 56 }}>Larva +1 <span className="td-num" style={{ opacity: 0.7 }}>({count('HordeKill', side)})</span></button>
        <button type="button" disabled={busy} onClick={() => mark('HeraldKill', side)} className="td-btn td-btn--secondary" style={{ height: 56 }}>Heraldo</button>
        <button type="button" disabled={busy} onClick={() => mark('BaronKill', side)} className="td-btn td-btn--primary" style={{ height: 56 }}>Barón <span className="td-num" style={{ opacity: 0.8 }}>({count('BaronKill', side)})</span></button>
      </div>
    </div>
  );

  return (
    <div className="td-root ax-canvas" style={{ minHeight: '100vh', padding: '92px 20px 40px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gap: 16 }}>
        <div className="td-panel" style={{ padding: 16, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
          <Radio size={18} color={feed ? 'var(--td-green)' : 'var(--td-muted)'} aria-hidden />
          <div style={{ flex: 1, minWidth: 220 }}>
            <div className="td-over">MESA DE CONTROL · {channel.toUpperCase()}</div>
            <div style={{ fontSize: 14, color: 'var(--td-text-2)' }}>
              {feed ? <>En vivo: <b style={{ color: 'var(--td-text)' }}>{teams.blue}</b> vs <b style={{ color: 'var(--td-text)' }}>{teams.red}</b> · {fmt(feed.gameTime || 0)} · {feed.source === 'player' ? 'feed de jugador (objetivos automáticos)' : 'feed del espectador: marca los objetivos aquí'}</> : 'Sin partida en vivo (el companion del caster no está enviando)'}
            </div>
          </div>
          <input value={token} onChange={(e) => setToken(e.target.value)} placeholder="Token del feed (modo caster)" className="td-input" style={{ width: 260 }} type="password" autoComplete="off" />
        </div>
        <ReplayPanel channel={channel} token={token} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 16 }}>
          {sideBlock('blue')}
          {sideBlock('red')}
        </div>
        <div className="td-panel" style={{ padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
            <span className="td-over">MARCADOS EN ESTA PARTIDA ({marks.length})</span>
            <span style={{ flex: 1 }} />
            <button type="button" className="td-btn td-btn--secondary" disabled={busy || !marks.length} onClick={undo}><Undo2 size={14} /> Deshacer último</button>
            <button type="button" className="td-btn td-btn--secondary tf-btn-danger" disabled={busy || !marks.length} onClick={clear}><Trash2 size={14} /> Borrar todo</button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {marks.length === 0 && <span style={{ fontSize: 13, color: 'var(--td-muted)' }}>Nada marcado todavía. Las marcas se borran solas al empezar la siguiente partida.</span>}
            {marks.map((m) => (
              <span key={m.id} className="td-chip" data-kind={m.side === 'blue' ? 'pos' : 'live'} style={{ fontSize: 12 }}>
                {fmt(m.t)} · {NAME_ES[m.name] || m.name}{m.extra && m.name === 'DragonKill' ? ` ${DRAGONS.find((d) => d.type === m.extra)?.label || m.extra}` : ''} · {teams[m.side as Side]}
              </span>
            ))}
          </div>
          <p className="td-help" style={{ marginTop: 10 }}>Marca cada objetivo en cuanto caiga: el overlay actualiza contadores, dragones hacia el alma, timers y avisos en menos de 3 s. Si un jugador de la partida tiene el companion abierto, los objetivos llegan solos y lo que marques aquí no se duplica.</p>
        </div>
      </div>
    </div>
  );
}

// Repeticiones de la segunda cámara (OBS de quien espectea + scripts/live-clip-uploader): lista de las
// últimas subidas y botones para que el overlay del caster la muestre o la quite.
function ReplayPanel({ channel, token }: { channel: string; token: string }) {
  const [clips, setClips] = useState<Array<{ id: number; title: string | null; size: number; createdAt: number; url: string }>>([]);
  const [state, setState] = useState<{ show: boolean; id: number; last: number; slow?: boolean }>({ show: false, id: 0, last: 0 });
  const [last, setLast] = useState(15);
  const [slow, setSlow] = useState(false);
  const [preview, setPreview] = useState<number>(0);
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const [c, s] = await Promise.all([axiosInstance.get(`/api/live-feed/${channel}/clips`), axiosInstance.get(`/api/live-feed/${channel}/clip-state`)]);
        if (!alive) return;
        setClips(Array.isArray(c.data?.clips) ? c.data.clips : []);
        if (s.data?.state) setState(s.data.state);
      } catch { /* backend sin repeticiones */ }
    };
    void tick();
    const id = window.setInterval(tick, 2000);
    return () => { alive = false; window.clearInterval(id); };
  }, [channel]);
  const send = async (body: any) => {
    if (!token) { toast.error('Pon el token del feed arriba'); return; }
    try { const { data } = await axiosInstance.post(`/api/live-feed/${channel}/clip-state`, body, { headers: { 'X-Feed-Token': token } }); setState(data.state); toast.success(data.state.show ? 'Repetición al aire' : 'Repetición quitada'); }
    catch (e: any) { toast.error(e?.response?.data?.error === 'bad_token' ? 'Token incorrecto' : 'No se pudo'); }
  };
  const ago = (t: number) => { const s = Math.max(0, Math.round((Date.now() - t) / 1000)); return s < 60 ? `hace ${s} s` : `hace ${Math.floor(s / 60)} min`; };
  return (
    <div className="td-panel" style={{ padding: 16, display: 'grid', gap: 12, borderTop: `3px solid ${state.show ? '#e8323c' : 'var(--td-line, #333)'}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span className="td-over">REPETICIONES · SEGUNDA CÁMARA</span>
        {state.show ? <span className="td-chip" data-kind="live">AL AIRE · #{state.id}</span> : <span className="td-chip">Fuera del aire</span>}
        <span style={{ flex: 1 }} />
        <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>Últimos
          <select className="td-input" value={last} onChange={(e) => setLast(Number(e.target.value))} style={{ width: 80 }}>
            {[8, 10, 15, 20, 30].map((s) => <option key={s} value={s}>{s} s</option>)}
          </select>
        </label>
        <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}><input type="checkbox" checked={slow} onChange={(e) => setSlow(e.target.checked)} /> Cámara lenta</label>
        <button type="button" className="td-btn td-btn--primary" disabled={!state.show} onClick={() => send({ show: false })} style={{ minWidth: 120 }}>Quitar</button>
      </div>
      {clips.length === 0 && <span style={{ fontSize: 13, color: 'var(--td-muted)' }}>Aún no hay repeticiones. Cuando guardes una en tu OBS (búfer de repetición) aparece aquí en unos segundos.</span>}
      <div style={{ display: 'grid', gap: 8 }}>
        {clips.map((c, i) => (
          <div key={c.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 10, alignItems: 'center', padding: '8px 10px', borderRadius: 8, background: state.show && state.id === c.id ? 'rgba(232,50,60,.12)' : 'rgba(255,255,255,.03)' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>#{c.id} {c.title || 'Repetición'} {i === 0 && <span className="td-chip" data-kind="pos" style={{ fontSize: 11 }}>nueva</span>}</div>
              <div style={{ fontSize: 12, color: 'var(--td-muted)' }}>{ago(c.createdAt)} · {(c.size / 1048576).toFixed(1)} MB</div>
              {preview === c.id && <video src={c.url} controls muted autoPlay style={{ width: '100%', maxWidth: 480, marginTop: 8, borderRadius: 6 }} />}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button type="button" className="td-btn td-btn--secondary" onClick={() => setPreview(preview === c.id ? 0 : c.id)}>{preview === c.id ? 'Cerrar' : 'Ver'}</button>
              <button type="button" className="td-btn td-btn--primary" onClick={() => send({ show: true, id: c.id, last, slow })} style={{ minWidth: 110 }}>Mostrar</button>
            </div>
          </div>
        ))}
      </div>
      <p className="td-help" style={{ margin: 0 }}>"Mostrar" pone la repetición en pantalla completa en el overlay del caster, desde los últimos segundos elegidos (ahí está la jugada); se quita sola al terminar o con "Quitar".</p>
    </div>
  );
}
