// src/pages/BroadcastIntroPage.tsx — cinemática de INTRO de la serie para OBS
// (/broadcast/:canal/intro, 1920×1080, fondo transparente o completo con ?bg=1).
//
// Se dispara sola: cuando aparece el champ select en el canal (el companion del
// caster lo manda desde el lobby) toca una vez por juego: equipos entrando por
// los lados con logo, récord y plantilla, el "VS" al centro, ronda y juego; a
// los ~14 s se va. Datos reales de la serie por GET /api/live-feed/:canal/series.
//   ?demo=1     bucle con datos de muestra       ?play=1   tocar ahora (una vez)
//   ?hold=1     se queda hasta que acabe la selección   ?auto=0  solo manual
//   ?bg=1       fondo opaco (escena completa, sin captura detrás)   ?theme=atak|lqc
import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { axiosInstance } from '@/lib/axios';
import { lol } from '@/lib/lolAssets';
import { broadcastThemeFor, broadcastVars, ensureBroadcastFont } from '@/lib/broadcastTheme';
import { useSeo } from '@/lib/seo';
import '@/styles/pages/broadcast-overlay.css';
import '@/styles/pages/broadcast-intro.css';

interface Player { name: string; riotId: string; role: string }
interface Team { name: string; slug: string; captain: string; roster: Player[]; record: { wins: number; losses: number; position: number | null } | null }
interface Series {
  tournament: { id: string; name: string; season: string | null; fearless: boolean } | null;
  match: { id: string; round: number; matchNumber: number; status: string; seriesTo: number; gamesPlayed: number; score: { team1: number; team2: number } } | null;
  team1: Team; team2: Team;
}
type Side = 'blue' | 'red';
const LANES = ['top', 'jungle', 'middle', 'bottom', 'utility'];
const laneOf = (role: string) => {
  const r = role.toLowerCase();
  if (/top/.test(r)) return 'top'; if (/jung|jg/.test(r)) return 'jungle'; if (/mid/.test(r)) return 'middle';
  if (/adc|bot|tirador/.test(r)) return 'bottom'; if (/sup|apoyo|utility/.test(r)) return 'utility'; return '';
};

const DEMO: Series = {
  tournament: { id: 'lqc-2026', name: 'Liga Querétaro Championship 2026', season: '2026', fearless: true },
  match: { id: 'r8m7', round: 8, matchNumber: 7, status: 'active', seriesTo: 2, gamesPlayed: 1, score: { team1: 1, team2: 0 } },
  team1: { name: 'Axolotl', slug: 'axolotl', captain: 'Ghoul#LQC', record: { wins: 6, losses: 1, position: 2 }, roster: [{ name: 'Ghoul', riotId: '', role: 'top' }, { name: 'Leavyathan', riotId: '', role: 'jungla' }, { name: 'Paulownia', riotId: '', role: 'mid' }, { name: 'Sh4d0w518', riotId: '', role: 'adc' }, { name: 'Moowum', riotId: '', role: 'soporte' }] },
  team2: { name: 'The Town Boys', slug: 'the-town-boys', captain: '', record: { wins: 5, losses: 2, position: 4 }, roster: [{ name: 'GelAwA', riotId: '', role: 'top' }, { name: 'Kister', riotId: '', role: 'jungla' }, { name: 'Clantoz', riotId: '', role: 'mid' }, { name: 'Venom', riotId: '', role: 'adc' }, { name: 'Nami Masoquista', riotId: '', role: 'soporte' }] },
};

const DURATION_MS = 14_000;

export default function BroadcastIntroPage() {
  const { channel } = useParams();
  const [params] = useSearchParams();
  const demo = params.get('demo') === '1';
  const debugBg = params.get('bg') === '1';
  const hold = params.get('hold') === '1';
  const auto = params.get('auto') !== '0';
  const theme = broadcastThemeFor(channel, params.get('theme'));
  useSeo({ title: 'Intro de la serie', noindex: true });
  useEffect(() => { ensureBroadcastFont(theme); }, [theme]);
  useEffect(() => {
    const prevHtml = document.documentElement.style.background, prevBody = document.body.style.background;
    document.documentElement.style.background = 'transparent'; document.body.style.background = 'transparent';
    return () => { document.documentElement.style.background = prevHtml; document.body.style.background = prevBody; };
  }, []);

  // Disparador: el champ select del canal (presente → tocar una vez por juego).
  const csQ = useQuery({
    queryKey: ['intro-cs', channel], enabled: !!channel && !demo && auto, refetchInterval: 2000, retry: false,
    queryFn: async () => { const { data, status } = await axiosInstance.get(`/api/live-feed/${channel}/champselect`, { validateStatus: (s) => s < 500 }); return status === 200 && data?.ok ? data : null; },
  });
  const [playing, setPlaying] = useState(false);
  const [series, setSeries] = useState<Series | null>(null);
  const playedKey = useRef<string>('');
  const timerRef = useRef<number | null>(null);

  const start = async (key: string) => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    try {
      const { data, status } = await axiosInstance.get(`/api/live-feed/${channel}/series`, { params: { t1: params.get('t1') || undefined, t2: params.get('t2') || undefined }, validateStatus: (s) => s < 500 });
      setSeries(status === 200 && data?.ok ? data : null);
    } catch { setSeries(null); }
    playedKey.current = key;
    setPlaying(true);
    if (!hold) timerRef.current = window.setTimeout(() => setPlaying(false), DURATION_MS);
  };
  useEffect(() => {
    if (demo) { setSeries(DEMO); setPlaying(true); return; }
    if (params.get('play') === '1' && !playedKey.current) void start('manual');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (demo || !auto) return;
    const cs = csQ.data;
    if (cs) {
      const key = `${cs.team1}|${cs.team2}|${cs.game}`;
      if (playedKey.current !== key) void start(key);
    } else if (hold && playing) setPlaying(false);
  }, [csQ.data]); // eslint-disable-line react-hooks/exhaustive-deps
  // Demo: reinicia cada 16 s para ver la entrada.
  const [loop, setLoop] = useState(0);
  useEffect(() => { if (!demo) return; const id = window.setInterval(() => setLoop((n) => n + 1), 16_000); return () => window.clearInterval(id); }, [demo]);

  const vars = useMemo(() => broadcastVars(theme), [theme]);
  const s = series;
  const label = s?.match ? `Ronda ${s.match.round} · Juego ${(s.match.gamesPlayed || 0) + 1}${s.match.seriesTo > 1 ? ` · Al mejor de ${s.match.seriesTo * 2 - 1}` : ''}` : '';
  const logoSrc = (t: Team) => (theme.id === 'lqc' ? `/lqc-obs/logos/${t.slug}.png` : '');

  return (
    <div className="bo-root" data-theme={theme.id} data-bg={debugBg ? '1' : undefined} style={vars}>
      {playing && s && (
        <div key={loop} className="in-root">
          <div className="in-bg" />
          <div className="in-hatch" />
          <header className="in-head">
            <img className="in-brand" src={theme.logo} alt={theme.brand} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
            <span className="in-tour bo-disp">{s.tournament?.name || theme.brand}</span>
            {label && <span className="in-round bo-disp">{label}</span>}
            {s.tournament?.fearless && <span className="in-fearless">Fearless draft</span>}
          </header>
          {(['blue', 'red'] as Side[]).map((side) => {
            const t = side === 'blue' ? s.team1 : s.team2;
            const score = s.match ? (side === 'blue' ? s.match.score.team1 : s.match.score.team2) : 0;
            return (
              <section key={side} className={`in-team ${side}`}>
                <div className="in-logo-wrap">
                  {logoSrc(t)
                    ? <img className="in-logo" src={logoSrc(t)} alt="" onError={(e) => { e.currentTarget.replaceWith(Object.assign(document.createElement('span'), { className: 'in-logo ph bo-disp', textContent: t.name.slice(0, 3).toUpperCase() })); }} />
                    : <span className="in-logo ph bo-disp">{t.name.slice(0, 3).toUpperCase()}</span>}
                </div>
                <h1 className="in-name bo-disp">{t.name}</h1>
                <div className="in-meta">
                  {t.record && <span className="in-record bo-disp">{t.record.wins}<i>–</i>{t.record.losses}</span>}
                  {t.record?.position && <span className="in-pos">{t.record.position}.º de la tabla</span>}
                  {s.match && s.match.seriesTo > 1 && <span className="in-score">Serie <b className="bo-disp">{score}</b></span>}
                </div>
                <ul className="in-roster">
                  {t.roster.slice(0, 7).map((p, i) => {
                    const lane = laneOf(p.role) || LANES[i] || '';
                    return (
                      <li key={p.name + i} style={{ ['--i' as any]: i }}>
                        {lane && <img src={lol.lane(lane)} alt="" />}
                        <span className="bo-disp">{p.name}</span>
                        {t.captain && p.riotId && t.captain.toLowerCase() === p.riotId.toLowerCase() && <em>C</em>}
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
          <div className="in-vs">
            <span className="in-vs-slab" />
            <span className="in-vs-text bo-disp">vs</span>
          </div>
        </div>
      )}
    </div>
  );
}
