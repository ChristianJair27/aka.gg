// src/pages/BroadcastChampSelectPage.tsx — overlay de SELECCIÓN DE CAMPEONES para OBS
// (/broadcast/:canal/champselect, 1920×1080, fondo transparente).
//
// Fila inferior: 5 tarjetas por lado con el arte del campeón, nombre del jugador
// y rol; bloque central con equipos y número de juego; franja superior con los
// baneos de esta partida, los campeones ya usados en la serie (fearless) y el
// temporizador de la fase. Lo alimenta el companion del caster, que debe estar
// en el lobby de la custom como espectador (GET /api/live-feed/:canal/champselect).
//   ?demo=1   datos de muestra animados   ?bg=1  fondo de prueba   ?theme=atak|lqc
import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { axiosInstance } from '@/lib/axios';
import { lol } from '@/lib/lolAssets';
import { broadcastThemeFor, broadcastVars, ensureBroadcastFont } from '@/lib/broadcastTheme';
import { useSeo } from '@/lib/seo';
import '@/styles/pages/broadcast-overlay.css';
import '@/styles/pages/broadcast-champselect.css';

interface CsCell { cellId: number; championId: number; championName: string; championKey: string; position: string; summonerName: string; tagLine: string; acting: boolean; locked: boolean }
interface CsFeed {
  phase: string; actionType: string; timerSecs: number; timerTotalSecs: number;
  blue: CsCell[]; red: CsCell[];
  bans: { blue: number[]; red: number[] };
  used: { blue: number[]; red: number[] };
  game: number; matchLabel: string; team1: string; team2: string; logo1: string; logo2: string; accent: string;
}
type Side = 'blue' | 'red';

const ROLE_ORDER = ['top', 'jungle', 'middle', 'bottom', 'utility'];
const ROLE_LABEL: Record<string, string> = { top: 'Top', jungle: 'Jungla', middle: 'Mid', bottom: 'ADC', utility: 'Soporte' };

function phaseLabel(f: CsFeed): string {
  const p = String(f.phase || '').toUpperCase();
  if (p === 'PLANNING') return 'Declaración';
  if (p === 'FINALIZATION') return 'Finalizando';
  if (p === 'GAME_STARTING') return 'Iniciando partida';
  if (p === 'BAN_PICK') return f.actionType === 'ban' ? 'Baneos' : 'Picks';
  return 'Selección';
}

// ── Demo: una selección que avanza sola (para colocar la fuente en OBS) ──────
const DEMO_BLUE = [[799, 'Ambessa', 'top', 'GelAwA'], [234, 'Viego', 'jungle', 'Kister'], [103, 'Ahri', 'middle', 'Clantoz'], [222, 'Jinx', 'bottom', 'Paulownia'], [267, 'Nami', 'utility', 'Nami Masoquista']] as const;
const DEMO_RED = [[266, 'Aatrox', 'top', 'Ghoul'], [64, 'LeeSin', 'jungle', 'Leavyathan'], [134, 'Syndra', 'middle', 'MGE Conta'], [145, 'Kaisa', 'bottom', 'Sh4d0w518'], [89, 'Leona', 'utility', 'Moowum']] as const;
const DEMO_ORDER: Array<[Side, number]> = [['blue', 0], ['red', 0], ['red', 1], ['blue', 1], ['blue', 2], ['red', 2], ['red', 3], ['blue', 3], ['blue', 4], ['red', 4]];
function demoFeed(tick: number): CsFeed {
  const banPhase = tick < 12;
  const step = banPhase ? -1 : Math.min(10, Math.floor((tick - 12) / 4)); // un pick cada 4 s
  const inStep = banPhase ? 0 : (tick - 12) % 4;
  const cell = (side: Side, i: number): CsCell => {
    const src = (side === 'blue' ? DEMO_BLUE : DEMO_RED)[i];
    const order = DEMO_ORDER.findIndex(([s, n]) => s === side && n === i);
    const locked = step > order;
    const acting = step === order;
    const hovering = acting && inStep >= 1;
    return { cellId: side === 'blue' ? i : 5 + i, championId: locked || hovering ? src[0] : 0, championName: locked || hovering ? src[1] : '', championKey: locked || hovering ? src[1] : '', position: src[2], summonerName: src[3], tagLine: 'LQC', acting, locked };
  };
  const bansN = banPhase ? Math.min(3, Math.floor(tick / 4)) : 3;
  return {
    phase: step >= 10 ? 'FINALIZATION' : 'BAN_PICK', actionType: banPhase ? 'ban' : 'pick',
    timerSecs: banPhase ? 27 - (tick % 4) * 7 : 30 - inStep * 8, timerTotalSecs: 30,
    blue: [0, 1, 2, 3, 4].map((i) => cell('blue', i)), red: [0, 1, 2, 3, 4].map((i) => cell('red', i)),
    bans: { blue: [238, 157, 517].slice(0, bansN), red: [777, 245, 350].slice(0, bansN) },
    used: { blue: [875, 221, 268], red: [166, 141, 523] },
    game: 2, matchLabel: 'Ronda 8 · Juego 2', team1: 'Axolotl', team2: 'The Town Boys', logo1: '', logo2: '', accent: '',
  };
}

export default function BroadcastChampSelectPage() {
  const { channel } = useParams();
  const [params] = useSearchParams();
  const demo = params.get('demo') === '1';
  const debugBg = params.get('bg') === '1';
  const theme = broadcastThemeFor(channel, params.get('theme'));
  useSeo({ title: 'Overlay de selección', noindex: true });
  useEffect(() => { ensureBroadcastFont(theme); }, [theme]);

  // Fondo transparente real para OBS (html/body traen tema oscuro global).
  useEffect(() => {
    const prevHtml = document.documentElement.style.background;
    const prevBody = document.body.style.background;
    document.documentElement.style.background = 'transparent';
    document.body.style.background = 'transparent';
    return () => { document.documentElement.style.background = prevHtml; document.body.style.background = prevBody; };
  }, []);

  const feedQ = useQuery({
    queryKey: ['champselect-overlay', channel],
    enabled: !!channel && !demo,
    refetchInterval: 1000,
    retry: false,
    queryFn: async () => {
      const { data, status } = await axiosInstance.get(`/api/live-feed/${channel}/champselect`, { validateStatus: (s) => s < 500 });
      return status === 200 && data?.ok ? (data as CsFeed) : null;
    },
  });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!demo) return;
    const id = window.setInterval(() => setTick((n) => (n + 1) % 60), 1000);
    return () => window.clearInterval(id);
  }, [demo]);
  const feed: CsFeed | null = useMemo(() => (demo ? demoFeed(tick) : feedQ.data ?? null), [demo, tick, feedQ.data]);

  // Al desaparecer el feed (champ select terminado) la fila se va con una salida corta.
  const [visible, setVisible] = useState(false);
  const lastRef = useRef<CsFeed | null>(null);
  useEffect(() => {
    if (feed) { lastRef.current = feed; setVisible(true); return; }
    const t = window.setTimeout(() => setVisible(false), 400);
    return () => window.clearTimeout(t);
  }, [feed]);
  const f = feed ?? lastRef.current;

  // Temporizador: el feed llega cada segundo; entre llegadas se descuenta en local.
  const [localSecs, setLocalSecs] = useState(0);
  useEffect(() => { setLocalSecs(f?.timerSecs ?? 0); }, [f?.timerSecs, f?.phase]);
  useEffect(() => {
    const id = window.setInterval(() => setLocalSecs((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearInterval(id);
  }, []);

  if (!f) return <div className="bo-root" data-theme={theme.id} data-bg={debugBg ? '1' : undefined} style={broadcastVars(theme)} />;

  const actingSide: Side | null = f.blue.some((c) => c.acting) ? 'blue' : f.red.some((c) => c.acting) ? 'red' : null;
  const total = Math.max(1, f.timerTotalSecs || 30);
  const pct = Math.max(0, Math.min(100, (localSecs / total) * 100));
  const bySide = (side: Side) => [...(side === 'blue' ? f.blue : f.red)].sort((a, b) => {
    const ra = ROLE_ORDER.indexOf(a.position), rb = ROLE_ORDER.indexOf(b.position);
    return (ra < 0 ? 9 : ra) - (rb < 0 ? 9 : rb) || a.cellId - b.cellId;
  });
  const teamName = (side: Side) => (side === 'blue' ? f.team1 : f.team2) || (side === 'blue' ? 'Lado azul' : 'Lado rojo');
  const teamLogo = (side: Side) => (side === 'blue' ? f.logo1 : f.logo2);
  const initials = (name: string) => name.split(/\s+/).map((w) => w[0]).join('').slice(0, 3).toUpperCase();

  return (
    <div className="bo-root" data-theme={theme.id} data-bg={debugBg ? '1' : undefined} style={broadcastVars(theme, f.accent)}>
      <div className={`cs-root${visible ? ' in' : ' out'}`}>
        {/* Franja: usados + baneos | fase + temporizador | baneos + usados */}
        <div className="cs-strip">
          {(['blue', 'red'] as Side[]).map((side) => (
            <div key={side} className={`cs-strip-side ${side}`}>
              {f.used[side].length > 0 && (
                <div className="cs-used" title="Ya usados en la serie (fearless)">
                  <span className="cs-used-label">Usados</span>
                  {f.used[side].map((id) => <img key={id} src={lol.iconById(id)} alt="" />)}
                </div>
              )}
              <div className="cs-bans" aria-label={`Baneos ${side === 'blue' ? 'azul' : 'rojo'}`}>
                {[0, 1, 2, 3, 4].map((i) => {
                  const id = f.bans[side][i];
                  return <span key={i} className={`cs-ban${id ? ' on' : ''}`}>{id ? <img src={lol.iconById(id)} alt="" /> : null}</span>;
                })}
              </div>
            </div>
          ))}
          <div className={`cs-strip-mid${actingSide ? ` ${actingSide}` : ''}`}>
            <span className="cs-phase bo-disp">{phaseLabel(f)}</span>
            <span className="cs-timer bo-disp">{localSecs}</span>
            <span className="cs-bar"><i style={{ width: `${pct}%` }} /></span>
          </div>
        </div>

        {/* Fila: 5 tarjetas azules · centro · 5 rojas */}
        <div className="cs-row">
          {bySide('blue').map((c, i) => <Card key={c.cellId} c={c} side="blue" index={i} />)}
          <div className="cs-center">
            <div className="cs-teams">
              {(['blue', 'red'] as Side[]).map((side) => (
                <div key={side} className={`cs-team ${side}`}>
                  {teamLogo(side)
                    ? <img className="cs-logo" src={teamLogo(side)} alt="" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                    : <span className="cs-logo ph bo-disp">{initials(teamName(side))}</span>}
                  <span className="cs-team-name bo-disp">{teamName(side)}</span>
                </div>
              ))}
            </div>
            <span className="cs-vs bo-disp">vs</span>
            <div className="cs-game">
              <span className="cs-game-n bo-disp">Juego {f.game}</span>
              {f.matchLabel && <span className="cs-match">{f.matchLabel}</span>}
            </div>
            <img className="cs-brand" src={theme.logo} alt={theme.brand} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          </div>
          {bySide('red').map((c, i) => <Card key={c.cellId} c={c} side="red" index={i} />)}
        </div>
      </div>
    </div>
  );
}

function Card({ c, side, index }: { c: CsCell; side: Side; index: number }) {
  const has = c.championId > 0;
  const key = c.championKey || c.championName;
  const state = !has ? 'empty' : c.locked ? 'locked' : 'hover';
  return (
    <div className={`cs-card ${side} ${state}${c.acting ? ' acting' : ''}`} style={{ ['--i' as any]: index }}>
      {has && <img key={c.championId} className="cs-art" src={lol.loading(key)} alt="" />}
      {!has && <img className="cs-role" src={lol.lane(c.position)} alt="" />}
      <div className="cs-shade" />
      {state === 'hover' && <span className="cs-picking bo-disp">Eligiendo</span>}
      <div className="cs-name">
        <span className="cs-player bo-disp">{c.summonerName || `Jugador ${c.cellId + 1}`}</span>
        <span className="cs-sub">{has ? c.championName : ROLE_LABEL[c.position] || '—'}</span>
      </div>
    </div>
  );
}
