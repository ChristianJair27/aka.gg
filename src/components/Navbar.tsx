// src/components/Navbar.tsx — ATAK.GG red/black brand nav
import { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ChartNoAxesColumn, ChevronDown, Clock, Flame, LayoutDashboard, LogOut, Menu,
  Plus, Search, Swords, Trophy, User, Users, X, Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/useAuth';
// Nombres guardados por el `atob` viejo llegan con acentos rotos: se reparan al mostrar.
import { fixMojibakeUtf8 } from '@/lib/utf8';
import { useChampionMatches, type ChampionMatch } from '@/hooks/useChampionSearch';
import { useOverview } from '@/hooks/queries/players';
import { resolveRiotIdQueryOptions } from '@/hooks/queries/stats';
import { getRecentSearches, saveRecentSearch, REGIONS } from '@/components/SummonerPrompt';
import { usePlayerSuggestions, type PlayerSuggestion } from '@/hooks/usePlayerSuggestions';
import { dd } from '@/lib/dataDragon';

// ── Búsqueda rápida de invocador (compacta, para la pastilla) ────────────────
// Mientras escribes sugiere jugadores reales (índice del backend, estilo
// League of Graphs) con su icono de perfil, además de tus búsquedas recientes.
function NavSearch({ className = '', onDone }: { className?: string; onDone?: () => void }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [bad, setBad] = useState(false);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const rootRef = useRef<HTMLFormElement>(null);

  const players = usePlayerSuggestions(value, open);
  // Campeones que matchean el texto (local, DDragon) — también se buscan aquí.
  const champMatches = useChampionMatches(value, 3);
  const recents = getRecentSearches().filter(
    (r) => !value.trim() || r.id.toLowerCase().includes(value.trim().toLowerCase()),
  ).slice(0, 3);

  // Lista plana para la navegación con teclado: campeones → recientes → jugadores.
  const options: Array<
    | { kind: 'champ'; c: ChampionMatch }
    | { kind: 'recent'; id: string; region: string }
    | { kind: 'player'; p: PlayerSuggestion }
  > = [
    ...champMatches.map((c) => ({ kind: 'champ' as const, c })),
    ...recents.map((r) => ({ kind: 'recent' as const, id: r.id, region: r.region })),
    ...players
      // sin duplicar lo que ya está en recientes
      .filter((p) => !recents.some((r) => r.id.toLowerCase() === `${p.gameName}#${p.tagLine}`.toLowerCase()))
      .map((p) => ({ kind: 'player' as const, p })),
  ];

  const goChamp = (c: ChampionMatch) => {
    setOpen(false); setHighlight(-1); setValue(''); onDone?.();
    navigate(`/champion/${c.id}`);
  };

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) { setOpen(false); setHighlight(-1); }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const go = async (riotId: string, region: string, puuid?: string) => {
    setBusy(true);
    setBad(false);
    setOpen(false);
    try {
      const [gameName = '', tagLine = ''] = riotId.split('#');
      // Con puuid del índice no hace falta resolver; sin él, resolvemos.
      let finalPuuid = puuid;
      if (!finalPuuid) {
        const data = await qc.fetchQuery(resolveRiotIdQueryOptions(region, gameName, tagLine));
        finalPuuid = data.puuid;
        riotId = `${data.gameName || gameName}#${data.tagLine || tagLine}`;
      }
      saveRecentSearch(riotId, region);
      setValue('');
      setHighlight(-1);
      onDone?.();
      navigate(`/stats/${region}/${encodeURIComponent(riotId)}`, { state: { puuid: finalPuuid } });
    } catch {
      setBad(true);
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (highlight >= 0 && options[highlight]) {
      const o = options[highlight];
      if (o.kind === 'champ') goChamp(o.c);
      else if (o.kind === 'recent') void go(o.id, o.region);
      else void go(`${o.p.gameName}#${o.p.tagLine}`, o.p.platform, o.p.puuid);
      return;
    }
    const raw = value.trim();
    const [gameName = '', tagLine = ''] = raw.split('#');
    if (!gameName || !tagLine) { setBad(true); return; }
    let region = 'la1';
    try { region = localStorage.getItem('atakgg_last_region') || 'la1'; } catch { /* noop */ }
    void go(raw, region);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { setOpen(false); setHighlight(-1); return; }
    if (!open || !options.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight((h) => (h + 1) % options.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight((h) => (h <= 0 ? options.length - 1 : h - 1)); }
  };

  const showDrop = open && options.length > 0;

  return (
    <form ref={rootRef} onSubmit={submit} className={`relative ${className}`}>
      <Search className={`absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none ${
        bad ? 'text-red-400' : 'text-white/30'
      }`} />
      <input
        value={value}
        onChange={(e) => { setValue(e.target.value); setHighlight(-1); if (bad) setBad(false); if (!open) setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder="Nombre#Tag"
        autoComplete="off"
        spellCheck={false}
        role="combobox"
        aria-expanded={showDrop}
        aria-label="Buscar invocador"
        title={bad ? 'Formato: Nombre#Tag — o no se encontró el invocador' : 'Buscar invocador'}
        className={`w-full h-9 rounded-[6px] pl-9 pr-8 text-sm text-white placeholder:text-white/40
          bg-white/[0.05] border outline-none transition-all duration-200
          focus:bg-white/[0.07] ${
            bad ? 'border-red-500/60' : 'border-white/[0.10] focus:border-[#e8323c]'
          }`}
      />
      {busy && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 rounded-full border-2 border-white/60 border-t-transparent animate-spin" />
      )}

      {/* Sugerencias */}
      {showDrop && (
        <div
          role="listbox"
          className="absolute left-0 right-0 top-full mt-2 z-50 min-w-[260px] overflow-hidden rounded-[10px]
            border border-white/[0.14] bg-[#121216] shadow-[0_16px_48px_rgba(0,0,0,0.6)]"
          style={{ backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}
        >
          {champMatches.length > 0 && (
            <>
              <div className="flex items-center gap-2 px-3.5 pt-3 pb-1.5 text-[10px] uppercase tracking-[0.22em] text-white/25">
                <Swords className="h-3 w-3" /> Campeones
              </div>
              {champMatches.map((c, i) => (
                <button
                  key={`c-${c.id}`}
                  type="button"
                  role="option"
                  aria-selected={highlight === i}
                  onMouseEnter={() => setHighlight(i)}
                  onMouseDown={(e) => { e.preventDefault(); goChamp(c); }}
                  className={`flex w-full items-center gap-2.5 px-3.5 py-2 text-left transition-colors ${
                    highlight === i ? 'bg-white/[0.07]' : ''
                  }`}
                >
                  <img
                    src={c.image} alt="" loading="lazy"
                    className="h-7 w-7 rounded-lg object-cover flex-shrink-0 ring-1 ring-white/10"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }}
                  />
                  <span className="text-sm text-white/85 truncate">{c.name}</span>
                  <span className="ml-auto text-[10px] text-[#c8aa6e]/70 uppercase flex-shrink-0">Análisis</span>
                </button>
              ))}
            </>
          )}

          {recents.length > 0 && (
            <>
              <div className="flex items-center gap-2 px-3.5 pt-3 pb-1.5 text-[10px] uppercase tracking-[0.22em] text-white/25">
                <Clock className="h-3 w-3" /> Recientes
              </div>
              {recents.map((r, ri) => {
                const i = champMatches.length + ri;
                return (
                <button
                  key={`r-${r.id}`}
                  type="button"
                  role="option"
                  aria-selected={highlight === i}
                  onMouseEnter={() => setHighlight(i)}
                  onMouseDown={(e) => { e.preventDefault(); void go(r.id, r.region); }}
                  className={`flex w-full items-center gap-2.5 px-3.5 py-2 text-left transition-colors ${
                    highlight === i ? 'bg-white/[0.07]' : ''
                  }`}
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.06] flex-shrink-0">
                    <Clock className="h-3 w-3 text-white/35" />
                  </span>
                  <span className="text-sm text-white/75 truncate">{r.id}</span>
                  <span className="ml-auto text-[10px] text-white/30 uppercase flex-shrink-0">
                    {REGIONS.find(rg => rg.value === r.region)?.label || r.region}
                  </span>
                </button>
                );
              })}
            </>
          )}

          {options.length > champMatches.length + recents.length && (
            <>
              <div className="px-3.5 pt-3 pb-1.5 text-[10px] uppercase tracking-[0.22em] text-white/25">
                Jugadores
              </div>
              {options.slice(champMatches.length + recents.length).map((o, idx) => {
                if (o.kind !== 'player') return null;
                const i = champMatches.length + recents.length + idx;
                const p = o.p;
                return (
                  <button
                    key={`p-${p.puuid}`}
                    type="button"
                    role="option"
                    aria-selected={highlight === i}
                    onMouseEnter={() => setHighlight(i)}
                    onMouseDown={(e) => { e.preventDefault(); void go(`${p.gameName}#${p.tagLine}`, p.platform, p.puuid); }}
                    className={`flex w-full items-center gap-2.5 px-3.5 py-2 text-left transition-colors ${
                      highlight === i ? 'bg-white/[0.07]' : ''
                    }`}
                  >
                    {p.profileIconId ? (
                      <img
                        src={dd.profileIcon(p.profileIconId)}
                        alt=""
                        loading="lazy"
                        className="h-7 w-7 rounded-full object-cover flex-shrink-0 ring-1 ring-white/10"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }}
                      />
                    ) : (
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-red-700/50 to-red-900/50 text-[11px] font-bold text-red-200 flex-shrink-0">
                        {p.gameName[0]?.toUpperCase() || '?'}
                      </span>
                    )}
                    <span className="min-w-0">
                      <span className="block text-sm text-white/85 truncate">
                        {p.gameName}<span className="text-white/35">#{p.tagLine}</span>
                      </span>
                      {p.level ? <span className="block text-[10px] text-white/30">Nivel {p.level}</span> : null}
                    </span>
                    <span className="ml-auto text-[10px] text-white/30 uppercase flex-shrink-0">
                      {REGIONS.find(rg => rg.value === p.platform)?.label || p.platform}
                    </span>
                  </button>
                );
              })}
            </>
          )}
        </div>
      )}
    </form>
  );
}

// Cada entrada lleva su icono SVG (lucide). Nada de emojis: se ven distintos
// en cada sistema operativo, no heredan el color de marca y no escalan con la
// tipografía. Las etiquetas van en español como el resto de la app.
const NAV_LINKS: Array<{ label: string; href: string; Icon: LucideIcon }> = [
  { label: 'Stats',   href: '/stats',       Icon: ChartNoAxesColumn },
  { label: 'Meta',    href: '/meta',        Icon: Flame            },
  { label: 'Torneos', href: '/tournaments', Icon: Trophy           },
  { label: 'Social',  href: '/social',      Icon: Users            },
];

// Logo oficial HD (public/atak-logo-mark.png; fondo removido por
// scripts/process-logo.py). Mismo nombre/props que el SVG que reemplaza.
const DaggerLogo = ({ className = "h-8 w-8" }) => (
  <img
    src="/atak-logo-mark.png"
    alt="ATAK.GG"
    className={className}
    style={{ objectFit: 'contain' }}
    draggable={false}
  />
);

export const Navbar = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const [mobileOpen, setMobileOpen]     = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [scrolled, setScrolled]         = useState(false);
  // Hide-on-scroll: la pastilla se esconde al bajar y reaparece al primer
  // gesto hacia arriba (o cerca del top). Nunca se esconde con menús abiertos.
  const [hidden, setHidden]             = useState(false);
  const lastY = useRef(0);
  const location = useLocation();
  const menuRef  = useRef<HTMLDivElement>(null);

  // Cuenta de LoL vinculada → "Mi Perfil" lleva DIRECTO a su perfil de
  // invocador, no al buscador. Sin cuenta vinculada, cae al dashboard.
  const overviewQ = useOverview(isAuthenticated);
  const linked = (overviewQ.data as any)?.profile;
  const myProfileHref = linked?.gameName
    ? `/stats/${(linked.platform || 'la1').toLowerCase()}/${encodeURIComponent(`${linked.gameName}#${linked.tagLine}`)}`
    : '/dashboard';

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 20);
      const delta = y - lastY.current;
      if (y < 80) setHidden(false);          // cerca del top siempre visible
      else if (delta > 8) setHidden(true);   // bajando → esconder
      else if (delta < -8) setHidden(false); // subiendo → mostrar
      lastY.current = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setUserMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  const initial = user?.name?.[0]?.toUpperCase() || '?';
  const isHome  = location.pathname === '/';

  const navHidden = hidden && !mobileOpen && !userMenuOpen;

  // Las barras pegajosas de cada página (p. ej. las pestañas del torneo) leen
  // este atributo para subir al hueco que deja la pastilla al esconderse.
  useEffect(() => {
    const root = document.documentElement;
    if (navHidden) root.setAttribute('data-nav-hidden', 'true');
    else root.removeAttribute('data-nav-hidden');
    return () => root.removeAttribute('data-nav-hidden');
  }, [navHidden]);

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 px-3 pt-3 md:px-5 pointer-events-none"
      style={{
        transform: navHidden ? 'translateY(calc(-100% - 16px))' : 'translateY(0)',
        opacity: navHidden ? 0 : 1,
        transition: 'transform 0.5s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.35s ease',
      }}
    >
      {/* Pastilla flotante (estilo React Bits): cápsula con blur separada del
          borde, más presente al scrollear. El hairline pasa a ser el borde. */}
      <div className={`ax-nav pointer-events-auto max-w-6xl 2xl:max-w-[1440px] min-[2200px]:max-w-[1680px] mx-auto rounded-[12px] border transition-all duration-500 ${
        scrolled || !isHome
          ? 'bg-black/85 border-white/[0.10] shadow-[0_12px_40px_rgba(0,0,0,0.55)]'
          : 'bg-black/45 border-white/[0.07] shadow-[0_8px_32px_rgba(0,0,0,0.35)]'
      }`}
        style={{ backdropFilter: 'blur(18px) saturate(150%)', WebkitBackdropFilter: 'blur(18px) saturate(150%)' }}
      >
        <div className="px-4 md:px-6">
        <div className="flex items-center justify-between h-14">

          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 group shrink-0">
            <div className="relative shrink-0">
              <DaggerLogo className="h-8 w-8 transition-all duration-300 group-hover:scale-110 group-hover:drop-shadow-[0_0_12px_rgba(239,68,68,0.8)]" />
              <div className="absolute inset-0 rounded-full bg-red-500/20 blur-md opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="ax-nav-mark">ATAK<em>.GG</em></span>
              <span className="ax-nav-sub">Powered by Riot API</span>
            </div>
          </Link>

          {/* Desktop nav — icono + palabra. El icono da reconocimiento rápido
              y la palabra evita adivinanzas; ninguno de los dos solo. */}
          <nav className="hidden md:flex items-center gap-0.5 lg:gap-1">
            {NAV_LINKS.map(({ label, href, Icon }) => {
              const active = location.pathname === href ||
                             (href !== '/' && location.pathname.startsWith(href));
              return (
                <Link key={href} to={href} aria-current={active ? 'page' : undefined}
                  className="ax-nav-link" data-active={active}>
                  <Icon className="h-4 w-4" aria-hidden />
                  {label}
                </Link>
              );
            })}
          </nav>

          {/* Desktop auth + búsqueda rápida */}
          <div className="hidden md:flex items-center gap-3">
            <NavSearch className="hidden lg:block w-44 xl:w-52" />
            {/* Acción destacada de la barra: la misma que manda en la portada. */}
            <Link
              to="/crear-torneo"
              className="ax-nav-cta hidden lg:inline-flex"
            >
              <Plus className="h-4 w-4" aria-hidden />
              Crear torneo
            </Link>
            {isAuthenticated && user ? (
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  aria-expanded={userMenuOpen} aria-haspopup="menu"
                  className="ax-nav-user"
                >
                  <div className="ax-nav-avatar">
                    {initial}
                  </div>
                  <span className="text-sm font-medium text-white/80 max-w-[120px] truncate">{fixMojibakeUtf8(user.name)}</span>
                  <ChevronDown className={`h-3.5 w-3.5 text-gray-500 transition-transform duration-200 ${userMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-[#121216] border border-white/[0.14] rounded-[10px] shadow-2xl shadow-black/70 overflow-hidden z-50">
                    <div className="px-4 py-3 border-b border-white/[0.05]">
                      <p className="text-sm font-semibold text-white truncate">{fixMojibakeUtf8(user.name)}</p>
                      <p className="text-xs text-gray-400 truncate">{user.email}</p>
                    </div>
                    <div className="py-1">
                      <Link to="/dashboard" onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-red-600/10 transition-colors">
                        <LayoutDashboard className="h-4 w-4 text-red-500" />Dashboard
                      </Link>
                      <Link to={myProfileHref} onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-red-600/10 transition-colors">
                        <User className="h-4 w-4 text-red-500" />
                        <span className="min-w-0">
                          Mi Perfil
                          {linked?.gameName && (
                            <span className="block text-[12px] text-[#c8aa6e] truncate">
                              {linked.gameName}#{linked.tagLine}
                            </span>
                          )}
                        </span>
                      </Link>
                    </div>
                    <div className="border-t border-white/[0.05] py-1">
                      <button onClick={() => { setUserMenuOpen(false); logout(); }}
                        className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-gray-500 hover:text-red-400 hover:bg-red-600/10 transition-colors">
                        <LogOut className="h-4 w-4" />Cerrar sesión
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <>
                {/* Un solo botón rojo en la barra: "Crear torneo". Cuenta y
                    sesión van sobrias para no competir con la acción principal. */}
                <Link to="/login" className="ax-nav-link">Entrar</Link>
                <Link to="/register" className="ax-nav-ghost">
                  <Zap className="h-3.5 w-3.5" aria-hidden />Crear cuenta
                </Link>
              </>
            )}
          </div>

          {/* Mobile hamburger */}
          <button onClick={() => setMobileOpen(!mobileOpen)} aria-label={mobileOpen ? 'Cerrar menú' : 'Abrir menú'} aria-expanded={mobileOpen}
            className="md:hidden grid place-items-center w-11 h-11 -mr-2 text-white/80 hover:text-white transition-colors">
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
        </div>
      </div>

      {/* Menú móvil: panel propio bajo la pastilla (la cápsula no se deforma) */}
      {mobileOpen && (
        <div
          className="ax-nav pointer-events-auto md:hidden max-w-6xl mx-auto mt-2 rounded-[12px] border border-white/[0.12] bg-[#0e0e11]/95 shadow-[0_16px_48px_rgba(0,0,0,0.6)] px-4 py-4"
          style={{ backdropFilter: 'blur(18px) saturate(150%)', WebkitBackdropFilter: 'blur(18px) saturate(150%)' }}
        >
          {/* Búsqueda primero: es a lo que más se viene */}
          <NavSearch className="mb-3" onDone={() => setMobileOpen(false)} />
          {/* Crear torneo primero: es la acción que empuja toda la app. */}
          <Link
            to="/crear-torneo"
            className="ax-nav-cta mb-3 flex w-full" style={{ height: 46 }}
          >
            <Plus className="h-4 w-4" /> Crear torneo
          </Link>
          <div className="flex flex-col space-y-1">
            {NAV_LINKS.map(({ label, href, Icon }) => {
              const active = location.pathname === href ||
                             (href !== '/' && location.pathname.startsWith(href));
              return (
                <Link key={href} to={href} aria-current={active ? 'page' : undefined}
                  className="ax-nav-link ax-nav-link--block" data-active={active}>
                  <Icon className="h-4 w-4" aria-hidden />
                  {label}
                </Link>
              );
            })}
          </div>
          <div className="mt-4 pt-4 border-t border-white/[0.06] flex flex-col gap-2">
            {isAuthenticated && user ? (
              <>
                <Link to="/dashboard" className="flex items-center gap-2 text-sm text-gray-300 hover:text-white py-2 px-3 rounded-xl hover:bg-red-600/10 transition-colors">
                  <LayoutDashboard className="h-4 w-4 text-red-500" />Dashboard
                </Link>
                <button onClick={logout} className="flex items-center gap-2 text-sm text-gray-500 hover:text-red-400 py-2 px-3 rounded-xl hover:bg-red-600/10 transition-colors w-full text-left">
                  <LogOut className="h-4 w-4" />Cerrar sesión
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="ax-nav-ghost justify-center" style={{ height: 46 }}>Iniciar sesión</Link>
                <Link to="/register" className="ax-nav-cta flex w-full" style={{ height: 46 }}>Crear cuenta</Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};
