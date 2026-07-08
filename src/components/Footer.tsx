// src/components/Footer.tsx — footer premium unificado.
// Blade-line dorada como umbral, columnas mínimas de navegación, y el wordmark
// gigante fantasma al fondo (momento de marca, estilo Flowty). Solo rutas reales.
import { Link } from 'react-router-dom';
import { Sword, Swords, Users, LayoutDashboard } from 'lucide-react';

const NAV = [
  { label: 'Stats',      href: '/stats',       Icon: Sword },
  { label: 'Torneos',    href: '/tournaments', Icon: Swords },
  { label: 'Social',     href: '/social',      Icon: Users },
  { label: 'Dashboard',  href: '/dashboard',   Icon: LayoutDashboard },
];

export const Footer = () => {
  return (
    <footer className="relative mt-auto overflow-hidden bg-[#050505]">
      {/* Umbral: filo dorado */}
      <hr className="blade-line" />

      <div className="relative max-w-7xl mx-auto px-5 md:px-10 pt-14 pb-10">
        <div className="grid grid-cols-1 md:grid-cols-[1.4fr_1fr_1fr] gap-10 md:gap-8">

          {/* Marca */}
          <div className="max-w-sm">
            <span className="font-serif text-2xl tracking-wide text-white">
              ATAK<span className="text-red-500">.GG</span>
            </span>
            <p className="mt-3 text-sm leading-relaxed text-white/55">
              Centro de mando para jugadores de League of Legends.
              Stats, coach de IA y torneos con códigos oficiales — LATAM.
            </p>
            <p className="mt-5 inline-flex items-center gap-2 text-xs text-white/45">
              <span className="w-1.5 h-1.5 rotate-45 bg-red-500 inline-block" aria-hidden="true" />
              Forjado en Querétaro · Revolution505
            </p>
          </div>

          {/* Navegación */}
          <nav aria-label="Footer">
            <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c8aa6e] mb-4">Plataforma</h3>
            <ul className="space-y-2.5">
              {NAV.map(({ label, href, Icon }) => (
                <li key={href}>
                  <Link
                    to={href}
                    className="group inline-flex items-center gap-2.5 text-sm text-white/60 hover:text-white transition-colors duration-200"
                  >
                    <Icon className="h-3.5 w-3.5 text-red-500/70 group-hover:text-red-400 transition-colors" aria-hidden="true" />
                    <span className="relative">
                      {label}
                      <span className="absolute -bottom-0.5 left-0 h-px w-0 bg-gradient-to-r from-red-500 to-[#c8aa6e] transition-all duration-300 group-hover:w-full" />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Cuenta / companion */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c8aa6e] mb-4">Tu cuenta</h3>
            <ul className="space-y-2.5">
              <li>
                <Link to="/login" className="text-sm text-white/60 hover:text-white transition-colors duration-200">
                  Iniciar sesión
                </Link>
              </li>
              <li>
                <Link to="/register" className="text-sm text-white/60 hover:text-white transition-colors duration-200">
                  Crear cuenta
                </Link>
              </li>
            </ul>
            <p className="mt-6 text-xs leading-relaxed text-white/40">
              Companion in-game disponible vía Overwolf para overlays en vivo.
            </p>
          </div>
        </div>

        {/* Legal */}
        <div className="mt-12 pt-6 border-t border-white/[0.06] flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <p className="text-xs text-white/45">© 2026 ATAK.GG — Todos los derechos reservados.</p>
          <p className="text-xs text-white/40 max-w-xl md:text-right leading-relaxed">
            ATAK.GG no está afiliado con Riot Games. League of Legends y Riot Games son
            marcas comerciales de Riot Games, Inc.
          </p>
        </div>
      </div>

      {/* Wordmark fantasma — momento de marca al fondo del scroll */}
      <div aria-hidden="true" className="pointer-events-none select-none relative h-[clamp(70px,12vw,150px)] overflow-hidden">
        <span
          className="absolute left-1/2 -translate-x-1/2 top-0 font-serif whitespace-nowrap leading-none text-[clamp(90px,16vw,210px)] text-transparent"
          style={{ WebkitTextStroke: '1px rgba(239,68,68,0.14)' }}
        >
          ATAK.GG
        </span>
      </div>
    </footer>
  );
};
