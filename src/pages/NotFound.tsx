// src/pages/NotFound.tsx — 404 (rediseño "Arena").
// Amumu, la momia triste, hace de anfitrión: nadie quiere jugar con él y aquí
// tampoco hay nadie. El número va en contorno crimson, como los títulos del sitio.
import { Link } from 'react-router-dom';
import { Home, ArrowLeft, Search } from 'lucide-react';
import { Champion3D, SplashBackdrop, stagger } from '@/components/arena';
import '@/styles/pages/auth.css';

const NotFound = () => (
  <div className="td-root ax-canvas">
    <SplashBackdrop champion="Amumu" opacity={0.3} side="right" position="60% 20%" height="100%" />
    <div className="ax-wrap nf-wrap">
      <div style={{ minWidth: 0 }}>
        <span className="td-over ax-kicker ax-rise">Error 404 · sector inexistente</span>
        <p className="nf-code ax-rise" style={stagger(1)} aria-hidden>404</p>
        <h1 className="ax-h2 nf-title ax-rise" style={stagger(2)}>Aquí no hay <em>nadie</em></h1>
        <p className="ax-lede ax-rise" style={stagger(3)}>
          Esta página ya no existe, o nunca existió. Hasta Amumu se quedó solo esperándola.
        </p>
        <div className="ax-pagehero-actions ax-rise" style={stagger(4)}>
          <Link to="/" className="td-btn td-btn--primary"><Home size={16} aria-hidden /> Volver al inicio</Link>
          <Link to="/stats" className="td-btn td-btn--secondary"><Search size={16} aria-hidden /> Buscar invocador</Link>
          <button type="button" className="td-btn td-btn--ghost" onClick={() => window.history.back()}>
            <ArrowLeft size={16} aria-hidden /> Volver atrás
          </button>
        </div>
      </div>
      <Champion3D slug="Amumu" champId={32} clip="idle" art="none" facing={-0.35} className="nf-stage" eager />
    </div>
  </div>
);

export default NotFound;
