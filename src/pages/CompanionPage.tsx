// src/pages/CompanionPage.tsx — página de descarga del ATAK Companion (Windows).
// Es el destino de los anuncios de "companion": una sola acción (descargar),
// con la versión real leída de GitHub Releases y la descarga medida en GA4.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, Github, Swords, Wand2, Package, Layers, Users, Film, Radio, Gauge, ShieldCheck, ArrowRight } from 'lucide-react';
import { useSeo } from '@/lib/seo';
import { trackEvent } from '@/lib/analytics';
import { ArenaPage, SplashBackdrop, PageHero, Champion3D, stagger } from '@/components/arena';
import { Button } from '@/components/tournament/ui';
import '@/styles/pages/companion.css';

const REPO = 'ChristianJair27/atak-companion';
export const COMPANION_DOWNLOAD_URL = `https://github.com/${REPO}/releases/latest/download/ATAK-Companion-Setup.exe`;
const RELEASES_URL = `https://github.com/${REPO}/releases/latest`;

// El campeón de la página: Ryze, el que lee runas.
const STAGE = { slug: 'Ryze', id: 13 };

const FEATURES = [
  { icon: Swords, title: 'Coach en la selección', text: 'Counters y sugerencias según el draft de los dos equipos, tu pool y el tier del campeón en tu rol. Cambia el pick con un clic.' },
  { icon: Wand2, title: 'Runas ajustadas al rival', text: 'La página de runas se adapta a lo que hay enfrente (daño físico o mágico, poke, tanques) y te dice por qué cambió cada una.' },
  { icon: Package, title: 'Build por partida', text: 'Items, botas y orden de habilidades con datos de OP.GG del parche actual, afinados para esa composición.' },
  { icon: Layers, title: 'Overlay in-game', text: 'HUD con tu build y objetivos (F9) y marcador 5v5 en vivo (Ctrl+Shift+S). Ligero y sin tapar el juego.' },
  { icon: Users, title: 'Panel de jugadores', text: 'F8 muestra el elo, winrate y runas de los diez jugadores, aliados y rivales, en cualquier fase.' },
  { icon: Film, title: 'Post-partida', text: 'Resumen enriquecido con tu campeón en 3D, cambio de LP, línea de tiempo en el minimapa y enlace al análisis completo.' },
  { icon: Radio, title: 'Modo caster', text: 'Overlay de torneo para OBS con marcador, oro, objetivos y repeticiones. Es el que usa la LQC 2026 en sus transmisiones.' },
  { icon: Gauge, title: 'No baja tus FPS', text: 'La inteligencia corre en los servidores de ATAK; las ventanas se congelan detrás del juego y no usan tu GPU.' },
];

const FAQ = [
  { q: '¿Es seguro con Vanguard?', a: 'Sí. El Companion no lee la memoria del juego ni modifica archivos: usa la API local del cliente de League (la misma que Riot da a Blitz u OP.GG) y la Live Client Data API, ambas permitidas por Riot.' },
  { q: 'Windows dice "aplicación no reconocida"', a: 'El instalador aún no lleva firma de código. Pulsa "Más información" y luego "Ejecutar de todas formas". Puedes verificar el archivo en la página de GitHub del proyecto.' },
  { q: '¿Qué necesito?', a: 'Windows 10 u 11 de 64 bits y el cliente de League of Legends instalado. Pesa menos de 120 MB y se actualiza solo.' },
  { q: '¿Cuesta algo?', a: 'No. Es gratis y lo seguirá siendo; vive del mismo proyecto que los torneos y las stats de ATAK.GG.' },
];

export default function CompanionPage() {
  useSeo({
    title: 'ATAK Companion: coach de draft, runas y overlay para League of Legends',
    description: 'App gratis para Windows: counters y runas ajustadas al draft en la selección de campeón, build por partida, overlay in-game y modo caster para torneos. Compatible con Vanguard.',
    canonical: '/companion',
  });
  const [release, setRelease] = useState<{ tag: string; size: number | null } | null>(null);
  useEffect(() => {
    // Versión y tamaño reales desde GitHub (público, con CORS). Si falla, el botón sigue funcionando.
    const ctrl = new AbortController();
    fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { signal: ctrl.signal, headers: { Accept: 'application/vnd.github+json' } })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!j) return;
        const asset = Array.isArray(j.assets) ? j.assets.find((a: any) => /Setup-\d/.test(String(a?.name))) : null;
        setRelease({ tag: String(j.tag_name || '').replace(/^v/, ''), size: asset?.size ? Number(asset.size) : null });
      })
      .catch(() => { /* sin red o límite de GitHub: se muestra sin versión */ });
    return () => ctrl.abort();
  }, []);
  const onDownload = () => trackEvent('companion_download', { version: release?.tag || 'latest' });
  const sizeMb = release?.size ? `${(release.size / 1048576).toFixed(0)} MB` : null;

  return (
    <ArenaPage
      className="cp-page"
      backdrop={<SplashBackdrop champion={STAGE.slug} opacity={0.34} side="right" position="60% 18%" />}
    >
      <PageHero
        kicker="ATAK Companion · Windows 10/11 · gratis"
        title={<>Tu coach <em>en la selección</em></>}
        lede="Counters, runas ajustadas al draft y build por partida, directo en tu selección de campeón. Overlay in-game, post-partida y modo caster para torneos. Compatible con Vanguard."
        actions={<>
          <a className="cp-dl" href={COMPANION_DOWNLOAD_URL} onClick={onDownload} data-testid="companion-download">
            <Download size={18} aria-hidden />
            <span>Descargar para Windows</span>
            <small>{release ? `v${release.tag}${sizeMb ? ` · ${sizeMb}` : ''}` : 'instalador .exe'}</small>
          </a>
          <Button variant="secondary" icon={<Github size={16} />} onClick={() => window.open(RELEASES_URL, '_blank', 'noopener')}>Ver en GitHub</Button>
        </>}
        aside={<Champion3D slug={STAGE.slug} champId={STAGE.id} clip="idle" art="none" facing={-0.3} className="cp-stage" />}
      >
        <ul className="cp-trust ax-rise" style={stagger(4)}>
          <li><ShieldCheck size={15} aria-hidden />Sin leer memoria del juego</li>
          <li><Gauge size={15} aria-hidden />Sin usar tu GPU en partida</li>
          <li><Download size={15} aria-hidden />Se actualiza solo</li>
        </ul>
      </PageHero>

      <section className="cp-grid" aria-label="Qué hace el Companion">
        {FEATURES.map((f, i) => {
          const Icon = f.icon;
          return (
            <article key={f.title} className="td-panel ax-card cp-feat ax-rise" style={stagger(5 + i)}>
              <Icon size={20} aria-hidden className="cp-feat-icon" />
              <h3>{f.title}</h3>
              <p>{f.text}</p>
            </article>
          );
        })}
      </section>

      <section className="cp-steps td-panel ax-card">
        <span className="td-over ax-kicker">En 3 pasos</span>
        <ol>
          <li><b>Descarga</b> el instalador con el botón de arriba.</li>
          <li><b>Instala</b>: si Windows pregunta, "Más información" y "Ejecutar de todas formas".</li>
          <li><b>Abre League</b>. El Companion detecta el cliente y aparece solo en la selección de campeón.</li>
        </ol>
        <a className="cp-dl cp-dl--inline" href={COMPANION_DOWNLOAD_URL} onClick={onDownload}>
          <Download size={18} aria-hidden /><span>Descargar para Windows</span>
        </a>
      </section>

      <section className="cp-faq" aria-label="Preguntas frecuentes">
        {FAQ.map((f) => (
          <details key={f.q} className="td-panel ax-card">
            <summary>{f.q}</summary>
            <p>{f.a}</p>
          </details>
        ))}
      </section>

      <p className="cp-foot ax-prose">
        ¿Organizas torneos? El modo caster del Companion es el overlay oficial de los torneos de ATAK.GG.
        <Link to="/crear-torneo">Crea el tuyo <ArrowRight size={14} aria-hidden /></Link>
      </p>
    </ArenaPage>
  );
}
