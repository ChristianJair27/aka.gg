// Stats de la pelea que se ve en un clip. Bajo el video va una tira mínima
// (daño por equipo + quien más daño hizo) y un botón que abre el modal: ahí
// las secciones Daño / Bajas / Oro se eligen con carpetas animadas (Folder) y
// el contenido entra con motion. Iconos: Data Dragon local (/lol/**).
// Datos: GET /api/replays/:region/:gameId/fight?start&end.
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Swords, ChevronRight } from 'lucide-react';
import axiosInstance from '@/lib/axios';
import { dd } from '@/lib/dataDragon';
import { lol } from '@/lib/lolAssets';
import { Folder } from '@/components/ui/Folder';
import { AtakModal, AtakModalBody, AtakModalContent, AtakModalHeader } from '@/components/ui/atak-modal';
import { ARENA_MODAL } from '@/components/tournament/forms';

type Side = 'blue' | 'red';
interface FightPlayer { id: number; name: string; champion: string; team: Side; kills: number; deaths: number; assists: number; damage: number; damageTaken: number; gold: number; killDamage: number; damagePct: number }
interface FightKill { t: number; killer: { name: string; champion: string; team: Side } | null; victim: { name: string; champion: string; team: Side } | null; assists: string[]; shutdown: number }
interface TeamTotals { kills: number; deaths: number; damage: number; damageTaken: number; gold: number }
export interface Fight { start: number; end: number; frameStart: number; frameEnd: number; teams: Record<Side, TeamTotals>; players: FightPlayer[]; mvp: { name: string; champion: string; team: Side; damage: number } | null; kills: FightKill[] }

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const k = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(Math.round(n)));
const SIDE: Record<Side, { color: string; text: string; label: string }> = {
  blue: { color: '#49a3ff', text: 'text-sky-300', label: 'Lado azul' },
  red: { color: '#e8323c', text: 'text-red-300', label: 'Lado rojo' },
};
const ICON = { damage: lol.stat('attack_damage'), taken: lol.stat('health'), gold: lol.ui('gold'), kills: lol.ui('score') };

const cache = new Map<string, Fight>();
export function useFight(region?: string | null, gameId?: number | null, start?: number | null, end?: number | null) {
  const ok = !!region && !!gameId && end != null && start != null && end > start;
  const key = ok ? `${region}:${gameId}:${start}-${end}` : '';
  const [fight, setFight] = useState<Fight | null>(() => (key && cache.get(key)) || null);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!key) return;
    const c = cache.get(key); if (c) { setFight(c); return; }
    let alive = true;
    axiosInstance.get(`/api/replays/${region}/${gameId}/fight`, { params: { start, end } })
      .then((r) => { if (!alive) return; cache.set(key, r.data); setFight(r.data); })
      .catch(() => alive && setError(true));
    return () => { alive = false; };
  }, [key, region, gameId, start, end]);
  return { fight, error, ok };
}

function Champ({ name, size = 24, ring }: { name: string; size?: number; ring?: Side }) {
  if (!name) return <span className="inline-block rounded-md bg-white/10 shrink-0" style={{ width: size, height: size }} />;
  return <img src={dd.champion(name)} alt={name} title={name} width={size} height={size} loading="lazy" className="rounded-md object-cover shrink-0" style={{ width: size, height: size, boxShadow: ring ? `0 0 0 1.5px ${SIDE[ring].color}` : undefined }} onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />;
}
const Icon = ({ src, size = 16, className = '' }: { src: string; size?: number; className?: string }) => <img src={src} alt="" aria-hidden width={size} height={size} className={`shrink-0 object-contain ${className}`} style={{ width: size, height: size }} />;

// ── Tira resumen bajo el video ────────────────────────────────────────────────
export function FightStats({ region, gameId, start, end, title, matchup }: { region?: string | null; gameId?: number | null; start?: number | null; end?: number | null; title?: string | null; matchup?: string | null }) {
  const { fight, error, ok } = useFight(region, gameId, start, end);
  const [open, setOpen] = useState(false);
  if (!ok || error) return null;
  if (!fight) return <div className="px-4 py-2 text-[11px] uppercase tracking-[0.14em] text-gray-600">Calculando stats de la pelea…</div>;
  const { blue, red } = fight.teams;
  const total = blue.damage + red.damage || 1;
  const bluePct = Math.round((blue.damage / total) * 100);
  return (
    <>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-white/[0.06] px-4 py-2.5">
        <div className="flex min-w-[180px] flex-1 items-center gap-2 tabular-nums text-xs font-bold">
          <Icon src={ICON.damage} size={14} />
          <span className={SIDE.blue.text}>{k(blue.damage)}</span>
          <div className="flex h-1 flex-1 overflow-hidden rounded-full bg-white/10" role="img" aria-label={`Daño: azul ${bluePct} %, rojo ${100 - bluePct} %`}>
            <div className="h-full" style={{ width: `${bluePct}%`, background: SIDE.blue.color }} />
            <div className="h-full flex-1" style={{ background: SIDE.red.color }} />
          </div>
          <span className={SIDE.red.text}>{k(red.damage)}</span>
        </div>
        {fight.mvp && (
          <div className="inline-flex items-center gap-1.5 text-xs text-gray-400">
            <Champ name={fight.mvp.champion} size={18} ring={fight.mvp.team} />
            <span className="font-semibold text-white">{fight.mvp.name}</span>
            <span className="tabular-nums">{k(fight.mvp.damage)}</span>
          </div>
        )}
        <button type="button" onClick={() => setOpen(true)} className="ml-auto inline-flex h-8 items-center gap-1 rounded-md border border-white/[0.1] px-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-gray-300 transition-colors hover:border-white/30 hover:text-white">
          <Swords className="h-3.5 w-3.5 text-red-500" /> Stats de la pelea <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
      <FightModal fight={fight} open={open} onOpenChange={setOpen} title={title} matchup={matchup} />
    </>
  );
}

// ── Modal con carpetas ────────────────────────────────────────────────────────
type Section = 'damage' | 'kills' | 'gold';
const SECTIONS: Array<{ key: Section; label: string; color: string; icon: string }> = [
  { key: 'damage', label: 'Daño', color: '#e8323c', icon: ICON.damage },
  { key: 'kills', label: 'Bajas', color: '#3b3b47', icon: ICON.kills },
  { key: 'gold', label: 'Oro', color: '#c8aa6e', icon: ICON.gold },
];

export function FightModal({ fight, open, onOpenChange, title, matchup }: { fight: Fight; open: boolean; onOpenChange: (o: boolean) => void; title?: string | null; matchup?: string | null }) {
  const [section, setSection] = useState<Section>('damage');
  const reduce = useReducedMotion();
  const top = useMemo(() => ({
    damage: [...fight.players].sort((a, b) => b.damage - a.damage).slice(0, 3),
    kills: [...fight.players].sort((a, b) => (b.kills * 2 + b.assists) - (a.kills * 2 + a.assists) || b.damage - a.damage).slice(0, 3),
    gold: [...fight.players].sort((a, b) => b.gold - a.gold).slice(0, 3),
  }), [fight]);
  const { blue, red } = fight.teams;

  return (
    <AtakModal open={open} onOpenChange={onOpenChange}>
      <AtakModalContent size="lg" className={ARENA_MODAL}>
        <AtakModalHeader
          icon={<Swords className="h-5 w-5" />}
          eyebrow={<>Stats de la pelea · {mmss(fight.start)}–{mmss(fight.end)}</>}
          title={title || 'Pelea de equipo'}
          description={matchup || undefined}
        />
        <AtakModalBody>
          {/* Marcador de la pelea */}
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-[10px] border border-white/[0.08] bg-white/[0.03] px-4 py-3">
            <SideScore side="blue" t={blue} align="left" />
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-gray-500">vs</span>
            <SideScore side="red" t={red} align="right" />
          </div>

          {/* Carpetas = secciones */}
          <div className="mt-2 flex items-end justify-center gap-8 sm:gap-14" role="tablist" aria-label="Secciones">
            {SECTIONS.map((s) => (
              <Folder
                key={s.key} color={s.color} size={0.9} label={s.label} open={section === s.key}
                onToggle={() => setSection(s.key)}
                badge={<Icon src={s.icon} size={22} className="drop-shadow" />}
                items={top[s.key].map((p) => <Champ key={p.id} name={p.champion} size={26} />)}
              />
            ))}
          </div>

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={section}
              initial={reduce ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? undefined : { opacity: 0, y: -6 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="mt-4"
            >
              {section === 'damage' && <DamageSection fight={fight} />}
              {section === 'kills' && <KillsSection fight={fight} />}
              {section === 'gold' && <GoldSection fight={fight} />}
            </motion.div>
          </AnimatePresence>

          <p className="mt-4 text-[11px] text-gray-500">
            Daño, daño recibido y oro medidos entre {mmss(fight.frameStart)} y {mmss(fight.frameEnd)} (la timeline de Riot da un punto por minuto). Bajas y asistencias exactas al clip.
          </p>
        </AtakModalBody>
      </AtakModalContent>
    </AtakModal>
  );
}

function SideScore({ side, t, align }: { side: Side; t: TeamTotals; align: 'left' | 'right' }) {
  const s = SIDE[side];
  return (
    <div className={`flex flex-col ${align === 'right' ? 'items-end text-right' : 'items-start'}`}>
      <span className={`text-[11px] font-bold uppercase tracking-[0.16em] ${s.text}`}>{s.label}</span>
      <span className="mt-0.5 text-3xl font-bold leading-none tabular-nums text-white" style={{ fontFamily: 'var(--td-font-display)' }}>{t.kills}</span>
      <span className="mt-1 inline-flex items-center gap-1 text-xs text-gray-400 tabular-nums"><Icon src={ICON.damage} size={12} /> {k(t.damage)} <span className="text-gray-600">·</span> <Icon src={ICON.gold} size={12} /> +{k(t.gold)}</span>
    </div>
  );
}

// ── Secciones ─────────────────────────────────────────────────────────────────
/** Fila jugador + cifra + barra proporcional (anima el ancho al entrar). */
function Row({ p, value, max, i, suffix, extra }: { p: FightPlayer; value: number; max: number; i: number; suffix?: ReactNode; extra?: ReactNode }) {
  const reduce = useReducedMotion();
  const s = SIDE[p.team];
  return (
    <li className="py-1.5">
      <div className="flex items-center gap-2.5">
        <Champ name={p.champion} size={28} ring={p.team} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate text-sm font-semibold text-gray-100">{p.name}</span>
            <span className="shrink-0 text-sm font-bold tabular-nums text-white">{k(value)}{suffix}</span>
          </div>
          <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/[0.08]">
            <motion.div
              className="h-full origin-left rounded-full"
              style={{ background: s.color, width: `${Math.max(2, Math.round((value / max) * 100))}%` }}
              initial={reduce ? false : { scaleX: 0 }} animate={{ scaleX: 1 }}
              transition={{ duration: 0.5, delay: 0.04 * i, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
          {extra}
        </div>
      </div>
    </li>
  );
}

function TwoColumns({ children }: { children: ReactNode }) {
  return <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">{children}</div>;
}
function ColHead({ side, icon, children }: { side: Side; icon: string; children: ReactNode }) {
  return <div className={`mb-1 flex items-center gap-1.5 border-b border-white/[0.08] pb-1.5 text-[11px] font-bold uppercase tracking-[0.14em] ${SIDE[side].text}`}><Icon src={icon} size={14} />{children}</div>;
}

function DamageSection({ fight }: { fight: Fight }) {
  const max = Math.max(1, ...fight.players.map((p) => p.damage));
  return (
    <TwoColumns>
      {(['blue', 'red'] as Side[]).map((side) => (
        <div key={side}>
          <ColHead side={side} icon={ICON.damage}>{SIDE[side].label} · {k(fight.teams[side].damage)}</ColHead>
          <ul>{fight.players.filter((p) => p.team === side).sort((a, b) => b.damage - a.damage).map((p, i) => <Row key={p.id} p={p} value={p.damage} max={max} i={i} suffix={<span className="ml-1.5 text-[11px] font-medium text-gray-500">{p.damagePct}%</span>} />)}</ul>
        </div>
      ))}
    </TwoColumns>
  );
}

function KillsSection({ fight }: { fight: Fight }) {
  const reduce = useReducedMotion();
  const score = (p: FightPlayer) => p.kills * 2 + p.assists;
  const max = Math.max(1, ...fight.players.map(score));
  return (
    <div>
      <TwoColumns>
        {(['blue', 'red'] as Side[]).map((side) => (
          <div key={side}>
            <ColHead side={side} icon={ICON.kills}>{SIDE[side].label} · {fight.teams[side].kills} bajas</ColHead>
            <ul>
              {fight.players.filter((p) => p.team === side).sort((a, b) => score(b) - score(a) || b.damage - a.damage).map((p, i) => (
                <li key={p.id} className="flex items-center gap-2.5 py-1.5">
                  <Champ name={p.champion} size={28} ring={p.team} />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-100">{p.name}</span>
                  <span className="text-sm tabular-nums"><b className="text-white">{p.kills}</b><span className="text-gray-600"> / </span><span className="text-red-300">{p.deaths}</span><span className="text-gray-600"> / </span><span className="text-gray-300">{p.assists}</span></span>
                  <span className="hidden w-16 overflow-hidden rounded-full bg-white/[0.08] sm:block" style={{ height: 4 }}><motion.span className="block h-full origin-left" style={{ background: SIDE[side].color, width: `${Math.round((score(p) / max) * 100)}%` }} initial={reduce ? false : { scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.5, delay: 0.04 * i }} /></span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </TwoColumns>
      {fight.kills.length > 0 && (
        <div className="mt-4">
          <div className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-gray-400">Secuencia</div>
          <ol className="divide-y divide-white/[0.06] rounded-[10px] border border-white/[0.08] bg-white/[0.02]">
            {fight.kills.map((kl, i) => (
              <motion.li key={i} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm" initial={reduce ? false : { opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 * i, duration: 0.25 }}>
                <span className="w-10 text-xs tabular-nums text-gray-500">{mmss(kl.t)}</span>
                {kl.killer ? <><Champ name={kl.killer.champion} size={22} ring={kl.killer.team} /><span className={`font-semibold ${SIDE[kl.killer.team].text}`}>{kl.killer.name}</span></> : <span className="text-gray-500">Ejecución</span>}
                <ChevronRight className="h-3.5 w-3.5 text-gray-600" />
                {kl.victim && <><Champ name={kl.victim.champion} size={22} ring={kl.victim.team} /><span className={`font-semibold ${SIDE[kl.victim.team].text}`}>{kl.victim.name}</span></>}
                {kl.assists.length > 0 && <span className="ml-1 inline-flex items-center gap-1 text-xs text-gray-500">+{kl.assists.map((c) => <Champ key={c} name={c} size={16} />)}</span>}
                {kl.shutdown > 0 && <span className="ml-auto inline-flex items-center gap-1 rounded bg-amber-400/15 px-1.5 py-0.5 text-[11px] font-bold text-amber-300"><Icon src={ICON.gold} size={11} />+{kl.shutdown}</span>}
              </motion.li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

function GoldSection({ fight }: { fight: Fight }) {
  const max = Math.max(1, ...fight.players.map((p) => p.gold));
  return (
    <TwoColumns>
      {(['blue', 'red'] as Side[]).map((side) => (
        <div key={side}>
          <ColHead side={side} icon={ICON.gold}>{SIDE[side].label} · +{k(fight.teams[side].gold)}</ColHead>
          <ul>
            {fight.players.filter((p) => p.team === side).sort((a, b) => b.gold - a.gold).map((p, i) => (
              <Row key={p.id} p={p} value={p.gold} max={max} i={i}
                extra={<div className="mt-1 inline-flex items-center gap-1 text-[11px] text-gray-500 tabular-nums"><Icon src={ICON.taken} size={11} /> recibió {k(p.damageTaken)}</div>} />
            ))}
          </ul>
        </div>
      ))}
    </TwoColumns>
  );
}
