// src/pages/Home.tsx — portada de ATAK.GG (rediseño "Arena").
// El héroe hace tres cosas a la vez sin pedir un clic: buscar un invocador,
// crear un torneo y enseñar de qué va el sitio — con un campeón en 3D entre
// ambas, distinto en cada visita. El resto de la página usa arte de League of Legends
// ligado a cada función en lugar de los cuatro videos en bucle de antes.
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useScroll, useTransform, useReducedMotion, type MotionValue } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { axiosInstance } from '@/lib/axios';
import { SummonerPrompt } from '@/components/SummonerPrompt';
import { HomeCreateTournament } from '@/components/home/HomeCreateTournament';
import { TournamentCreateModal } from '@/components/TournamentCreateModal';
import type { QuickTournamentDraft } from '@/components/home/quickTournamentDraft';
import { ArrowRight, LayoutDashboard, Search, Trophy, User, ShieldCheck, MonitorSmartphone, BadgeCheck } from 'lucide-react';
import { useAuth } from '@/features/auth/useAuth';
import { useOverview } from '@/hooks/queries/players';
import { useChampions } from '@/hooks/use-ddragon';
import { Button, Champion3D, Reveal, SplashBackdrop, lol, stagger } from '@/components/arena';
import { pickStageChampion } from '@/data/stage-champions';
import '@/styles/pages/home.css';

const QUICK_LOOKUPS = ['Faker#KR1', 'Caps#EUW', 'Doublelift#NA1'];

// El campeón del héroe cambia en cada visita (ver src/data/stage-champions.ts).
const HOME_CHAMP_KEY = 'atak_home_champ';

const REASONS = [
  { icon: <ShieldCheck size={22} />, title: 'Sin anuncios. Nunca.', desc: 'Otras plataformas tapan las builds con banners. Aquí tus stats están limpias, en cada página y en cada dispositivo.' },
  { icon: <MonitorSmartphone size={22} />, title: 'Todo en tu navegador', desc: 'Stats, torneos y modo espectador corren en la web. Sin lanzadores pesados ni overlays que tumban tus FPS.' },
  { icon: <BadgeCheck size={22} />, title: 'Datos oficiales de Riot', desc: 'Perfiles y códigos de torneo vía la API oficial. Nada de trucos frágiles que mueren con cada parche.' },
];

// Cada función con el arte de un campeón que la representa.
const ARSENAL = [
  { to: '/stats', champ: 'Jhin', pos: '60% 18%', kicker: 'Stats', title: 'Perfil y partida en vivo',
    desc: 'Rango, historial y análisis de cada rival y aliado de tu partida actual: rachas, campeones y debilidades.' },
  { to: '/tournaments', champ: 'Azir', pos: '50% 12%', kicker: 'Torneos', title: 'Sistema de torneos',
    desc: 'Códigos oficiales de Riot, brackets automáticos, resultados que se detectan solos y stats de cada partida.' },
  { to: '/meta', champ: 'Ahri', pos: '55% 16%', kicker: 'Meta', title: 'Tier list del parche',
    desc: 'Qué campeón gana en cada línea, con runas, build, orden de habilidades y counters.' },
  { to: '/stats', champ: 'Viktor', pos: '50% 14%', kicker: 'Coach', title: 'Coach de IA en vivo',
    desc: 'Analiza tu partida en segundo plano y te avisa de builds, posicionamiento y objetivos. Sin ruido.' },
];

// ── Párrafo que se enciende palabra a palabra con el scroll ───────────────────
// Cada párrafo mide SU propia posición en pantalla: termina de iluminarse cuando
// su borde inferior llega al 55% de la ventana, con el texto todavía bien visible
// en cualquier alto de pantalla (incluidos monitores ultrawide).
function Word({ children, progress, range, hot }: { children: string; progress: MotionValue<number>; range: [number, number]; hot: boolean }) {
  const opacity = useTransform(progress, range, [0.18, 1]);
  return <motion.span style={{ opacity }} className="hm-word" data-hot={hot}>{children} </motion.span>;
}
function ParagraphReveal({ text, highlightWords }: { text: string; highlightWords: string[] }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 0.9', 'end 0.55'] });
  const words = text.split(' ');
  return (
    <p ref={ref} className="hm-mission-text">
      {words.map((word, i) => {
        const start = i / words.length;
        const end = Math.min(1, start + 1.5 / words.length);
        const clean = word.replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, '');
        const hot = highlightWords.some((h) => clean.toLowerCase() === h.toLowerCase());
        return reduce
          ? <span key={i} className="hm-word" data-hot={hot}>{word} </span>
          : <Word key={i} progress={scrollYProgress} range={[start, end]} hot={hot}>{word}</Word>;
      })}
    </p>
  );
}

// ── El meta de hoy: los cinco mejores de mid, con su arte vertical ───────────
function MetaStrip() {
  const navigate = useNavigate();
  const { data: champs } = useChampions();
  // Misma clave de caché que /meta: entrar allí después es instantáneo.
  const q = useQuery({
    queryKey: ['opgg', 'tier', 'mid'],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    queryFn: async () => (await axiosInstance.get('/api/opgg/tier-list?position=mid')).data.picks as any[],
    staleTime: 10 * 60 * 1000,
  });
  const picks = (q.data ?? []).slice(0, 5);
  if (q.isError || (!q.isLoading && !picks.length)) return null;

  return (
    <section className="ax-section" aria-labelledby="hm-meta-title">
      <div className="hm-sec-head">
        <div>
          <span className="td-over ax-kicker">En vivo de OP.GG</span>
          <h2 id="hm-meta-title" className="ax-h2" style={{ marginTop: 10 }}>El meta <em>de hoy</em></h2>
        </div>
        <Button variant="secondary" icon={<ArrowRight size={15} />} onClick={() => navigate('/meta')}>Ver tier list</Button>
      </div>
      <div className="hm-meta">
        {q.isLoading
          ? Array.from({ length: 5 }).map((_, i) => <div key={i} className="ax-artcard hm-meta-card" aria-hidden />)
          : picks.map((p, i) => {
              const slug = champs?.byKey?.[String(p.id)]?.id;
              return (
                <Reveal key={p.name} index={i}>
                  <button type="button" className="ax-artcard hm-meta-card" aria-label={`Ver ${p.name}`}
                    onClick={() => slug && navigate(`/champion/${slug}?pos=MIDDLE`)}>
                    {slug && (
                      <img className="ax-artcard-img" src={lol.loading(slug)} alt="" loading="lazy" decoding="async"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                    )}
                    <span className="ax-pos hm-meta-rank" data-pos={i + 1}>{i + 1}</span>
                    <span className="hm-meta-name">{p.name}</span>
                    <span className="td-num hm-meta-wr">{p.wr != null ? `${p.wr}% WR` : '—'}</span>
                  </button>
                </Reveal>
              );
            })}
      </div>
    </section>
  );
}

export default function Home() {
  const navigate = useNavigate();
  const searchRef = useRef<HTMLDivElement>(null);

  // "Más opciones" del panel de la portada abre el asistente completo con lo
  // que la persona ya escribió, en vez de mandarla a empezar de cero.
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardSeed, setWizardSeed] = useState<QuickTournamentDraft | null>(null);

  // Sesión iniciada → acceso directo al dashboard y al perfil vinculado
  const { user, isAuthenticated } = useAuth();
  const overviewQ = useOverview(isAuthenticated);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const linked = (overviewQ.data as any)?.profile;
  const myProfileHref = linked?.gameName
    ? `/stats/${(linked.platform || 'la1').toLowerCase()}/${encodeURIComponent(`${linked.gameName}#${linked.tagLine}`)}`
    : null;

  // Un campeón distinto en cada carga de la portada (nunca el mismo dos veces seguidas).
  const [mascot] = useState(() => pickStageChampion(HOME_CHAMP_KEY));

  const scrollToSearch = () => {
    searchRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    searchRef.current?.querySelector('input')?.focus({ preventScroll: true });
  };

  return (
    <div className="td-root ax-canvas hm-page">
      <SplashBackdrop champion={mascot.slug} skin={mascot.backdropSkin ?? 0} opacity={0.34} position="50% 22%" height="min(100vh, 940px)" />

      <div className="ax-wrap ax-wrap--wide">
        {/* 1. HÉROE: discurso + búsqueda · campeón en 3D (aleatorio) · crear torneo */}
        <section className="hm-hero">
          <div className="hm-hero-copy">
            <span className="td-over ax-kicker ax-rise">18,000+ invocadores · API oficial de Riot</span>
            <h1 className="ax-pagehero-title hm-title ax-rise" style={stagger(1)}>
              Domina la Grieta <em>con precisión</em>
            </h1>
            <p className="ax-lede ax-rise" style={stagger(2)}>
              Organiza tu torneo en minutos y sigue cada partida en vivo. O busca a cualquier invocador.
            </p>

            <div ref={searchRef} className="hm-search ax-rise" style={stagger(3)}>
              <SummonerPrompt quickLookups={QUICK_LOOKUPS} />
            </div>

            {isAuthenticated && user && (
              <div className="hm-welcome ax-rise" style={stagger(4)}>
                <span className="hm-welcome-text">
                  Hola de nuevo, <b>{user.name}</b>
                  {linked?.gameName && <span className="hm-welcome-id"> · {linked.gameName}#{linked.tagLine}</span>}
                </span>
                <span className="hm-welcome-actions">
                  <Button variant="secondary" icon={<LayoutDashboard size={15} />} onClick={() => navigate('/dashboard')}>Mi dashboard</Button>
                  {myProfileHref && (
                    <Button variant="ghost" icon={<User size={15} />} onClick={() => navigate(myProfileHref)}>Mi perfil</Button>
                  )}
                </span>
              </div>
            )}
          </div>

          <Champion3D slug={mascot.slug} champId={mascot.id} clip="idle" art="none" facing={-0.25} fit={1.05}
            className="hm-stage" eager />

          <div className="hm-hero-form ax-rise" style={stagger(2)}>
            <HomeCreateTournament onExpand={(draft) => { setWizardSeed(draft); setWizardOpen(true); }} />
          </div>
        </section>

        {/* 2. Tres razones (las tres quejas más repetidas sobre otras webs de stats) */}
        <section className="hm-reasons" aria-label="Por qué ATAK.GG">
          {REASONS.map((r, i) => (
            <Reveal key={r.title} index={i} className="hm-reason">
              <span className="hm-reason-ico" aria-hidden>{r.icon}</span>
              <div>
                <h3 className="ax-h3">{r.title}</h3>
                <p>{r.desc}</p>
              </div>
            </Reveal>
          ))}
        </section>

        {/* 3. El arsenal */}
        <section className="ax-section" aria-labelledby="hm-arsenal-title">
          <div className="hm-sec-head">
            <div>
              <span className="td-over ax-kicker">El arsenal</span>
              <h2 id="hm-arsenal-title" className="ax-h2" style={{ marginTop: 10 }}>
                Las estadísticas han cambiado. <em>¿Y tú?</em>
              </h2>
            </div>
            <p className="ax-prose hm-sec-lede">
              Las webs convencionales solo te muestran el pasado. ATAK.GG sigue tus partidas en tiempo real,
              arma torneos a medida y te entrena con IA.
            </p>
          </div>
          <div className="hm-arsenal">
            {ARSENAL.map((a, i) => (
              <Reveal key={a.title} index={i}>
                <button type="button" className="ax-artcard hm-arsenal-card" style={{ ['--pos' as string]: a.pos }} onClick={() => navigate(a.to)}>
                  <img className="ax-artcard-img" src={lol.splash(a.champ)} alt="" loading="lazy" decoding="async"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                  <span className="td-over hm-arsenal-kicker">{a.kicker}</span>
                  <span className="hm-arsenal-title">{a.title}</span>
                  <span className="hm-arsenal-desc">{a.desc}</span>
                  <span className="hm-arsenal-go" aria-hidden><ArrowRight size={18} /></span>
                </button>
              </Reveal>
            ))}
          </div>
        </section>

        {/* 4. El meta de hoy (datos reales) */}
        <MetaStrip />

        {/* 5. Misión: texto que se enciende con el scroll sobre la Grieta */}
        <section className="ax-section hm-mission">
          <img className="hm-mission-art" src={lol.map('summoners-rift')} alt="" aria-hidden loading="lazy" decoding="async" />
          <div className="hm-mission-in">
            <span className="td-over ax-kicker">Nuestra misión</span>
            <ParagraphReveal
              text="Creamos un espacio donde la competitividad se une con la claridad, donde los jugadores encuentran dirección, los equipos encuentran torneos y cada partida competitiva se convierte en una oportunidad de ascenso."
              highlightWords={['competitividad', 'claridad', 'dirección', 'torneos', 'oportunidad', 'ascenso']}
            />
            <ParagraphReveal
              text="Una plataforma interactiva en la web y compañera in-game donde los datos de Riot, la comunidad y los consejos de inteligencia artificial fluyen sin fricciones. Menos ruido, más ELO."
              highlightWords={['plataforma', 'in-game', 'riot', 'inteligencia', 'artificial', 'fricciones', 'elo']}
            />
          </div>
        </section>

        {/* 6. Cierre: la misma acción principal que el héroe */}
        <section className="ax-section hm-cta">
          <div className="ax-hero-art" aria-hidden>
            <div className="ax-hero-slab" />
            <div className="ax-hero-hatch" />
          </div>
          <span className="td-over ax-kicker">Gratis · sin tarjeta</span>
          <h2 className="ax-pagehero-title hm-cta-title" data-size="md">Comienza tu <em>ascenso</em></h2>
          <p className="ax-prose" style={{ margin: '14px auto 0', textAlign: 'center' }}>
            Arma tu torneo, busca tus estadísticas o descarga el Companion de ATAK para recibir consejos mientras juegas.
          </p>
          <div className="ax-pagehero-actions" style={{ justifyContent: 'center' }}>
            <Button variant="primary" icon={<Trophy size={16} />} onClick={() => navigate('/crear-torneo')}>Crear torneo</Button>
            <Button variant="secondary" icon={<Search size={16} />} onClick={scrollToSearch}>Buscar invocador</Button>
          </div>
        </section>
      </div>

      <TournamentCreateModal
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        onCreated={() => { /* el panel de la portada ya muestra su propio éxito */ }}
        initial={wizardSeed ?? undefined}
      />
    </div>
  );
}
