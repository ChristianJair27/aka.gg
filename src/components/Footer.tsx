// src/components/Footer.tsx — pie del sitio (rediseño "Arena").
// Vive fuera de .td-root: usa los tokens de :root y las clases .ax-foot de
// src/styles/arena.css. Solo rutas reales.
import { Link } from 'react-router-dom';
import { BarChart3, Flame, Trophy, Users, LayoutDashboard } from 'lucide-react';
import { useAuth } from '@/features/auth/useAuth';

const NAV = [
  { label: 'Stats',     href: '/stats',       Icon: BarChart3 },
  { label: 'Meta',      href: '/meta',        Icon: Flame },
  { label: 'Torneos',   href: '/tournaments', Icon: Trophy },
  { label: 'Social',    href: '/social',      Icon: Users },
  { label: 'Dashboard', href: '/dashboard',   Icon: LayoutDashboard },
];

export const Footer = () => {
  // Mismo store que la barra superior (useSyncExternalStore): ambos cambian a
  // la vez al entrar o salir, así el pie nunca ofrece "Iniciar sesión" a quien
  // ya está dentro.
  const { user, isAuthenticated, logout } = useAuth();

  return (
    <footer className="ax-foot">
      <div className="ax-foot-in">
        <div className="ax-foot-grid">
          <div style={{ maxWidth: 420 }}>
            <div className="ax-foot-mark">ATAK<em>.GG</em></div>
            <p style={{ margin: '14px 0 0', lineHeight: 1.6 }}>
              Centro de mando para jugadores de League of Legends. Stats, coach de IA y torneos
              con códigos oficiales — LATAM.
            </p>
            <p style={{ margin: '16px 0 0', fontSize: 13, color: 'var(--td-muted)' }}>Forjado en Querétaro · Revolution505</p>
          </div>

          <nav aria-label="Pie de página">
            <h3>Plataforma</h3>
            <ul>
              {NAV.map(({ label, href, Icon }) => (
                <li key={href}>
                  <Link to={href}><Icon size={15} aria-hidden style={{ color: 'var(--td-red)' }} />{label}</Link>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <h3>Tu cuenta</h3>
            {isAuthenticated ? (
              <ul>
                {user?.name && (
                  <li style={{ minHeight: 36, display: 'flex', alignItems: 'center', fontWeight: 700, color: 'var(--td-text)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</li>
                )}
                <li><Link to="/dashboard">Dashboard</Link></li>
                <li><Link to="/dashboard">Mi perfil</Link></li>
                <li><button type="button" onClick={logout}>Cerrar sesión</button></li>
              </ul>
            ) : (
              <ul>
                <li><Link to="/login">Iniciar sesión</Link></li>
                <li><Link to="/register">Crear cuenta</Link></li>
              </ul>
            )}
            <p style={{ margin: '14px 0 0', fontSize: 13, lineHeight: 1.55, color: 'var(--td-muted)' }}>
              Companion in-game disponible vía Overwolf para overlays en vivo.
            </p>
          </div>
        </div>

        <div className="ax-foot-legal">
          <span>© 2026 ATAK.GG — Todos los derechos reservados.</span>
          <span style={{ maxWidth: 620 }}>
            ATAK.GG no está afiliado con Riot Games. League of Legends y Riot Games son
            marcas comerciales de Riot Games, Inc.
          </span>
        </div>
      </div>
    </footer>
  );
};
