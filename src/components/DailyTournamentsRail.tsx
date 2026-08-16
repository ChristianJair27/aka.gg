// Torneos diarios programados — riel horizontal con countdown en vivo.
// Lee GET /api/tournaments/daily/upcoming (plantillas habilitadas + instancia
// de hoy si ya abrió inscripciones). El backend crea/inicia/cancela solo.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { axiosInstance } from '@/lib/axios';
import { CalendarClock, Mountain, Snowflake, Swords, Users, ChevronRight } from 'lucide-react';

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
  SR:    { label: 'La Grieta', Icon: Mountain,  tint: 'text-red-400',   ring: 'border-red-500/30 bg-red-500/10' },
  ARAM:  { label: 'ARAM',      Icon: Snowflake, tint: 'text-cyan-300',  ring: 'border-cyan-400/30 bg-cyan-400/10' },
  ARENA: { label: 'Arena',     Icon: Swords,    tint: 'text-amber-300', ring: 'border-amber-400/30 bg-amber-400/10' },
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
  if (ms <= 0) return <span className="font-mono text-green-300">¡ya!</span>;
  const h = Math.floor(ms / 3600_000);
  const m = Math.floor((ms % 3600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return (
    <span className="font-mono tabular-nums text-white">
      {h > 0 && `${h}h `}{String(m).padStart(2, '0')}m {h === 0 && `${String(s).padStart(2, '0')}s`}
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
    <div className="mb-12">
      <div className="flex items-center gap-3 mb-4">
        <span className="p-2 rounded-xl border border-white/[0.08] bg-white/[0.04]">
          <CalendarClock className="h-4 w-4 text-red-400" />
        </span>
        <div>
          <h2 className="text-lg font-bold text-white leading-tight">Torneos diarios</h2>
          <p className="text-xs text-gray-500">Se abren y arrancan solos — llega, inscríbete y juega</p>
        </div>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1 snap-x">
        {items.map((s, i) => {
          const meta = MAP_META[s.gameMap] ?? MAP_META.SR;
          const open = s.today && (s.today.phase === 'registration' || s.today.phase === 'checkin');
          const live = s.today?.phase === 'active';
          const hhmm = `${String(s.startHour).padStart(2, '0')}:${String(s.startMinute).padStart(2, '0')}`;
          return (
            <motion.div
              key={s.id}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06, duration: 0.4, ease: 'easeOut' }}
              className="snap-start flex-shrink-0 w-[290px] rounded-2xl p-5 relative overflow-hidden"
              style={{
                background: 'linear-gradient(180deg, rgba(16,16,20,0.55) 0%, rgba(10,10,13,0.35) 100%)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 12px 44px -30px rgba(0,0,0,.6)',
              }}
            >
              <div className="flex items-center justify-between mb-3">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${meta.ring} ${meta.tint}`}>
                  <meta.Icon className="h-3 w-3" />
                  {meta.label} · {s.gameMap === 'ARENA' ? '2v2 ladder' : `${s.teamSize}v${s.teamSize}`}
                </span>
                {live && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" /> EN CURSO
                  </span>
                )}
              </div>

              <h3 className="font-bold text-white truncate">{s.name}</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                {s.days ? s.days.map(d => DAY_LABELS[d]).join(' · ') : 'Todos los días'} · {hhmm}
              </p>
              {s.prize && <p className="text-xs text-gray-400 mt-1 truncate">🏆 {s.prize}</p>}

              <div className="mt-4 flex items-center justify-between">
                {s.nextStartAt && !live ? (
                  <div className="text-xs text-gray-500">
                    Arranca en <Countdown target={s.nextStartAt} />
                  </div>
                ) : <span />}

                {s.today ? (
                  <Link
                    to={`/tournaments/${s.today.tournamentId}`}
                    className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      open
                        ? 'bg-foreground text-background hover:bg-foreground/90'
                        : 'bg-white/[0.07] text-gray-300 hover:bg-white/[0.12]'
                    }`}
                  >
                    {open ? (
                      <><Users className="h-3 w-3" /> Inscribirse ({s.today.participants}/{s.today.maxParticipants})</>
                    ) : (
                      <>Ver torneo <ChevronRight className="h-3 w-3" /></>
                    )}
                  </Link>
                ) : (
                  <span className="text-[11px] text-gray-600">Inscripciones próximamente</span>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
