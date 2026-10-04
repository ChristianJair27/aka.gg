// Marco compartido de las páginas de cuenta (entrar, registrarse, recuperar).
// Formulario en un panel opaco a la izquierda y, a la derecha, un campeón
// distinto en cada visita: su splash de fondo y su modelo 3D en primer plano.
import { ReactNode, useState } from 'react';
import { Link } from 'react-router-dom';
import Champion3D from './Champion3D';
import { SplashBackdrop } from './primitives';

// Solo campeones con modelo ligero (≤ 9 MB): el 3D debe llegar rápido en una
// página cuyo trabajo es que la gente entre.
const POOL = [
  { slug: 'Katarina', id: 55, name: 'Katarina' },
  { slug: 'Garen', id: 86, name: 'Garen' },
  { slug: 'Ryze', id: 13, name: 'Ryze' },
  { slug: 'Azir', id: 268, name: 'Azir' },
  { slug: 'TwistedFate', id: 4, name: 'Twisted Fate' },
  { slug: 'Darius', id: 122, name: 'Darius' },
  { slug: 'Lux', id: 99, name: 'Lux' },
  { slug: 'Zed', id: 238, name: 'Zed' },
  { slug: 'LeeSin', id: 64, name: 'Lee Sin' },
  { slug: 'Ezreal', id: 81, name: 'Ezreal' },
];

export function AuthShell({ title, subtitle, children, footer, stageKicker, stageTitle, compact }: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  stageKicker?: string;
  /** Usa <em> para la palabra en crimson. */
  stageTitle?: ReactNode;
  /** Sin escenario: tarjeta centrada (recuperar contraseña, confirmaciones). */
  compact?: boolean;
}) {
  const [champ] = useState(() => POOL[Math.floor(Math.random() * POOL.length)]);
  return (
    <div className="td-root ax-canvas au-page">
      <SplashBackdrop champion={champ.slug} opacity={compact ? 0.28 : 0.42} side="right" position="66% 16%" height="100%" />
      <div className="ax-wrap au-wrap" data-compact={compact}>
        <section className="td-panel au-card ax-rise" aria-labelledby="au-title">
          <header className="au-head">
            <Link to="/" className="au-mark" aria-label="ATAK.GG, ir al inicio">ATAK<em>.GG</em></Link>
            <h1 id="au-title" className="au-title">{title}</h1>
            {subtitle && <p className="au-sub">{subtitle}</p>}
          </header>
          {children}
          {footer && <div className="au-foot">{footer}</div>}
        </section>

        {!compact && (
          <aside className="au-aside" aria-hidden>
            <Champion3D slug={champ.slug} champId={champ.id} clip="idle" art="none" facing={-0.3} className="au-stage" />
            <div className="au-aside-copy">
              {stageKicker && <span className="td-over ax-kicker">{stageKicker}</span>}
              {stageTitle && <p className="ax-h2 au-aside-title">{stageTitle}</p>}
              <span className="td-over">{champ.name} · La escena competitiva de Querétaro</span>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

// ── Botones de proveedor ─────────────────────────────────────────────────────
function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.57c2.08-1.92 3.27-4.74 3.27-8.09Z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.76c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84Z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.05l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z" />
    </svg>
  );
}
function RiotIcon() {
  // Marca simplificada de Riot Games, monocroma (hereda currentColor)
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" fill="currentColor" aria-hidden="true">
      <path d="M6 13.5 17.6 9l-1.1 19.2-3.9 1.1.4-13.4-2.8.9.6 12.9-3.9 1.1.4-12.4-2.6.9.7 11.9-1.6.4L6 13.5Zm17 18.7L42 27v6.5l-3.4.9.1-2.6-3.3.9.2 2.6-3.2.8.2-2.5-3.2.9.3 2.5-3.3.9.3-2.5-3.5 1 .3 2.6-3 .8.1-3.7Zm.6-23.4L42 12.7l-.6 9.5-18.4 4.9.6-18.3Z" />
    </svg>
  );
}

export function OAuthButtons({ riotLabel, onRiot, onGoogle, disabled }: {
  riotLabel: string; onRiot: () => void; onGoogle: () => void; disabled?: boolean;
}) {
  return (
    <>
      <div className="au-oauth">
        <button type="button" className="td-btn td-btn--primary" data-full="true" onClick={onRiot} disabled={disabled}>
          <RiotIcon /> {riotLabel}
        </button>
        <button type="button" className="td-btn td-btn--secondary" data-full="true" onClick={onGoogle} disabled={disabled}>
          <GoogleIcon /> Continuar con Google
        </button>
      </div>
      <div className="au-divider" role="separator"><span className="td-over">o con email</span></div>
    </>
  );
}
