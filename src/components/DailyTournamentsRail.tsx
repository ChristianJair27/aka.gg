// Torneos diarios programados — riel horizontal con countdown en vivo.
// Lee GET /api/tournaments/daily/upcoming (plantillas habilitadas + instancia
// de hoy si ya abrió inscripciones). El backend crea/inicia/cancela solo.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { axiosInstance } from '@/lib/axios';
import { Mountain, Snowflake, Swords, Users, ChevronRight, Trophy } from 'lucide-react';
import { StatusChip } from '@/components/tournament/ui';

type DailySchedule = {
  id: number; name: string; description: string;
  gameMap: 'SR' | 'ARAM' | 'ARENA'; teamSize: number;
  bracketType: string; seriesTo: number;
  prize: string; maxParticipants: number;
  startHour: number; startMinute: number;
  days: number[] | null;
  nextStartAt: string | null;
  today: {
    tournamentId: string; phase: string;
    participants: number; maxParticipants: number; startDate: string;
  } | null;
};

const MAP_META = {
  SR:    { label: 'La Grieta', Icon: Mountain },
  ARAM:  { label: 'ARAM',      Icon: Snowflake },
  ARENA: { label: 'Arena',     Icon: Swords },
} as const;

const DAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

function Countdown({ target }: { target: string }) {
  const now = useNow();
  const ms = Date.parse(target) - now;
  if (ms <= 0) return <span className="ax-countdown" style={{ color: 'var(--td-green)' }}>¡Ya!</span>;
  const h = Math.floor(ms / 3600_000);
  const m = Math.floor((ms % 3600_000) / 60_000);
  const sec = Math.floor((ms % 60_000) / 1000);
  return (
    <span className="ax-countdown">
      {h > 0 && `${h}h `}{String(m).padStart(2, '0')}m{h === 0 && ` ${String(sec).padStart(2, '0')}s`}
    </span>
  );
}

export function DailyTournamentsRail() {
  const [items, setItems] = useState<DailySchedule[] | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () => axiosInstance.get('/api/tournaments/daily/upcoming')
      .then(r => { if (alive) setItems(Array.isArray(r.data) ? r.data : []); })
      .catch(() => { if (alive) setItems([]); });
    load();
    const id = setInterval(load, 60_000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  if (!items || items.length === 0) return null; // sin plantillas → sin sección

  return (
    <section aria-label="Torneos diarios">
      <div className="ax-section-title">
        <h2>Torneos diarios</h2>
        <span style={{ fontSize: 14, color: 'var(--td-muted)' }}>Se abren y arrancan solos: llega, inscríbete y juega.</span>
      </div>

      <div className="ax-daily">
        {items.map((s, i) => {
          const meta = MAP_META[s.gameMap] ?? MAP_META.SR;
          const open = s.today && (s.today.phase === 'registration' || s.today.phase === 'checkin');
          const live = s.today?.phase === 'active';
          const hhmm = `${String(s.startHour).padStart(2, '0')}:${String(s.startMinute).padStart(2, '0')}`;
          return (
            <motion.article
              key={s.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="td-panel ax-daily-card"
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <StatusChip kind="dim" dot={false}>
                  <meta.Icon size={12} aria-hidden />
                  {meta.label} · {s.gameMap === 'ARENA' ? '2v2 ladder' : `${s.teamSize}v${s.teamSize}`}
                </StatusChip>
                {live && <StatusChip kind="live">En vivo</StatusChip>}
              </div>

              <div style={{ minWidth: 0 }}>
                <h3 className="ax-daily-name">{s.name}</h3>
                <p style={{ margin: '2px 0 0', fontSize: 13.5, color: 'var(--td-text-2)' }}>
                  {s.days ? s.days.map(d => DAY_LABELS[d]).join(' · ') : 'Todos los días'} · {hhmm}
                </p>
                {s.prize && (
                  <p style={{ margin: '4px 0 0', fontSize: 13.5, color: 'var(--td-gold-bright)', display: 'flex', alignItems: 'center', gap: 6,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <Trophy size={13} aria-hidden />{s.prize}
                  </p>
                )}
              </div>

              <div className="ax-daily-foot">
                {s.nextStartAt && !live ? (
                  <div>
                    <div className="td-over">Arranca en</div>
                    <Countdown target={s.nextStartAt} />
                  </div>
                ) : <span />}

                {s.today ? (
                  <Link to={`/tournaments/${s.today.tournamentId}`} className={`td-btn ${open ? 'td-btn--primary' : 'td-btn--secondary'}`}>
                    {open ? (
                      <><Users size={14} aria-hidden /> Inscribirse {s.today.participants}/{s.today.maxParticipants}</>
                    ) : (
                      <>Ver torneo <ChevronRight size={14} aria-hidden /></>
                    )}
                  </Link>
                ) : (
                  <span style={{ fontSize: 12.5, color: 'var(--td-muted)' }}>Inscripciones próximamente</span>
                )}
              </div>
            </motion.article>
          );
        })}
      </div>
    </section>
  );
}
