// Stats de la pelea que se ve en un clip: daño a campeones, daño recibido, oro y
// K/D/A de cada jugador dentro de la ventana del clip, totales por equipo y la
// secuencia de bajas. Datos: GET /api/replays/:region/:gameId/fight?start&end.
import { useEffect, useState } from 'react';
import { ChevronDown, Swords, Crown } from 'lucide-react';
import axiosInstance from '@/lib/axios';
import { dd } from '@/lib/dataDragon';
import { Skeleton } from '@/components/ui/skeleton';

interface FightPlayer { id: number; name: string; champion: string; team: 'blue' | 'red'; kills: number; deaths: number; assists: number; damage: number; damageTaken: number; gold: number; killDamage: number; damagePct: number }
interface FightKill { t: number; killer: { name: string; champion: string; team: string } | null; victim: { name: string; champion: string; team: string } | null; assists: string[]; shutdown: number }
interface TeamTotals { kills: number; deaths: number; damage: number; damageTaken: number; gold: number }
export interface Fight { start: number; end: number; frameStart: number; frameEnd: number; teams: { blue: TeamTotals; red: TeamTotals }; players: FightPlayer[]; mvp: { name: string; champion: string; team: 'blue' | 'red'; damage: number } | null; kills: FightKill[] }

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const k = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(Math.round(n)));
const TEAM = { blue: { text: 'text-sky-300', bar: 'bg-sky-400', label: 'Azul' }, red: { text: 'text-red-300', bar: 'bg-red-400', label: 'Rojo' } } as const;

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

function Champ({ name, size = 22 }: { name: string; size?: number }) {
  if (!name) return <span className="inline-block rounded bg-white/10" style={{ width: size, height: size }} />;
  return <img src={dd.champion(name)} alt={name} title={name} width={size} height={size} loading="lazy" className="rounded object-cover shrink-0" style={{ width: size, height: size }} onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />;
}

/** Panel de stats de la pelea. `defaultOpen` controla si el detalle por jugador arranca desplegado. */
export function FightStats({ region, gameId, start, end, defaultOpen = true, dense = false }: { region?: string | null; gameId?: number | null; start?: number | null; end?: number | null; defaultOpen?: boolean; dense?: boolean }) {
  const { fight, error, ok } = useFight(region, gameId, start, end);
  const [open, setOpen] = useState(defaultOpen);
  if (!ok || error) return null;
  if (!fight) return <div className="space-y-2 border-t border-white/[0.06] px-4 py-3"><Skeleton className="h-3 w-40" /><Skeleton className="h-1.5 w-full" /></div>;
  const { blue, red } = fight.teams;
  const totalDmg = blue.damage + red.damage || 1;
  const bluePct = Math.round((blue.damage / totalDmg) * 100);
  const maxDmg = Math.max(1, ...fight.players.map((p) => p.damage));
  const pad = dense ? 'px-3' : 'px-4';

  return (
    <div className={`border-t border-white/[0.06] ${dense ? 'text-[12px]' : 'text-sm'}`}>
      {/* Cabecera: daño por equipo + toggle */}
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className={`w-full ${pad} py-2.5 text-left hover:bg-white/[0.03] transition-colors`}>
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-gray-300"><Swords className="h-3.5 w-3.5 text-red-500" /> Daño en la pelea <span className="text-gray-600 font-normal normal-case tracking-normal">· {mmss(fight.start)}–{mmss(fight.end)}</span></span>
          <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
        <div className="mt-2 flex items-center justify-between text-xs font-bold tabular-nums">
          <span className={TEAM.blue.text}>{k(blue.damage)} <span className="font-normal text-gray-500">· {blue.kills} bajas</span></span>
          <span className={TEAM.red.text}><span className="font-normal text-gray-500">{red.kills} bajas · </span>{k(red.damage)}</span>
        </div>
        <div className="mt-1 flex h-1.5 overflow-hidden rounded-full bg-white/10" role="img" aria-label={`Daño azul ${bluePct}%, rojo ${100 - bluePct}%`}>
          <div className={`${TEAM.blue.bar} h-full`} style={{ width: `${bluePct}%` }} />
          <div className={`${TEAM.red.bar} h-full flex-1`} />
        </div>
        {fight.mvp && (
          <div className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-gray-400">
            <Crown className="h-3.5 w-3.5 text-amber-400" /> <Champ name={fight.mvp.champion} size={16} /> <span className="font-semibold text-white">{fight.mvp.name}</span> hizo más daño ({k(fight.mvp.damage)})
          </div>
        )}
      </button>

      {open && (
        <div className={`${pad} pb-3`}>
          <table className="w-full border-separate border-spacing-0 tabular-nums">
            <thead>
              <tr className="text-[10px] uppercase tracking-[0.12em] text-gray-500">
                <th className="text-left font-semibold pb-1">Jugador</th>
                <th className="text-right font-semibold pb-1">K/D/A</th>
                <th className="text-right font-semibold pb-1 w-[38%]">Daño</th>
                <th className="text-right font-semibold pb-1 hidden sm:table-cell">Recibido</th>
                <th className="text-right font-semibold pb-1 hidden sm:table-cell">Oro</th>
              </tr>
            </thead>
            <tbody>
              {fight.players.map((p, i) => {
                const t = TEAM[p.team];
                const first = i === 0 || fight.players[i - 1].team !== p.team;
                return (
                  <tr key={p.id} className={first && i > 0 ? 'border-t' : ''}>
                    <td className={`py-1 ${first && i > 0 ? 'pt-2.5' : ''}`}>
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`w-1 self-stretch rounded-full ${t.bar}`} aria-hidden />
                        <Champ name={p.champion} />
                        <span className="truncate font-medium text-gray-200">{p.name}</span>
                      </div>
                    </td>
                    <td className={`py-1 text-right text-gray-300 ${first && i > 0 ? 'pt-2.5' : ''}`}>{p.kills}/{p.deaths}/{p.assists}</td>
                    <td className={`py-1 pl-3 ${first && i > 0 ? 'pt-2.5' : ''}`}>
                      <div className="flex items-center gap-2 justify-end">
                        <div className="h-1.5 flex-1 max-w-[120px] rounded-full bg-white/10 overflow-hidden"><div className={`h-full ${t.bar}`} style={{ width: `${Math.round((p.damage / maxDmg) * 100)}%` }} /></div>
                        <span className={`w-12 text-right font-bold ${t.text}`}>{k(p.damage)}</span>
                        <span className="w-8 text-right text-[10px] text-gray-500">{p.damagePct}%</span>
                      </div>
                    </td>
                    <td className={`py-1 pl-3 text-right text-gray-400 hidden sm:table-cell ${first && i > 0 ? 'pt-2.5' : ''}`}>{k(p.damageTaken)}</td>
                    <td className={`py-1 pl-3 text-right text-amber-200/80 hidden sm:table-cell ${first && i > 0 ? 'pt-2.5' : ''}`}>+{k(p.gold)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {fight.kills.length > 0 && (
            <ol className="mt-3 space-y-1 border-t border-white/[0.06] pt-2">
              {fight.kills.map((kl, i) => (
                <li key={i} className="flex items-center gap-1.5 text-xs text-gray-400">
                  <span className="w-10 tabular-nums text-gray-600">{mmss(kl.t)}</span>
                  {kl.killer ? <><Champ name={kl.killer.champion} size={18} /><span className={`font-semibold ${TEAM[kl.killer.team as 'blue' | 'red']?.text}`}>{kl.killer.name}</span></> : <span className="text-gray-500">Ejecución</span>}
                  <span className="text-gray-600">mató a</span>
                  {kl.victim && <><Champ name={kl.victim.champion} size={18} /><span className={`font-semibold ${TEAM[kl.victim.team as 'blue' | 'red']?.text}`}>{kl.victim.name}</span></>}
                  {kl.assists.length > 0 && <span className="ml-1 inline-flex items-center gap-0.5 text-gray-600">+{kl.assists.map((c) => <Champ key={c} name={c} size={14} />)}</span>}
                  {kl.shutdown > 0 && <span className="ml-1 rounded bg-amber-400/15 px-1 text-[10px] font-bold text-amber-300">+{kl.shutdown}g</span>}
                </li>
              ))}
            </ol>
          )}
          <p className="mt-2 text-[10px] text-gray-600">Daño, recibido y oro medidos entre los minutos {mmss(fight.frameStart)} y {mmss(fight.frameEnd)} (resolución de la timeline de Riot). Bajas y asistencias exactas al clip.</p>
        </div>
      )}
    </div>
  );
}
