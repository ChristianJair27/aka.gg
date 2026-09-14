// src/pages/TournamentDashboardPage.tsx — cáscara de la vista de torneo.
// Aquí solo viven: parámetros de ruta, la consulta del dashboard, el estado de
// la URL (?tab= / ?register=1 y los enlaces profundos ?round= ?team= ?match=)
// y la composición del marco. Cada pestaña y cada tarjeta viven en
// src/components/tournament/dashboard/.
import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useTournamentDashboard } from '@/hooks/queries/tournaments';
import {
  DiscoveryBanner, GuiaRapidaButton, type DiscoverySamplesData,
} from '@/components/tournament/DiscoveryHints';
import Aurora from '@/components/Aurora';
import { TournamentRegisterModal } from '@/components/TournamentRegisterModal';
import {
  ErrorCard, type Tab,
  Hero, Tiles, Breadcrumbs, BroadcastBanner,
  SideNav, BottomNav,
  ResumenGrid, BracketTab, EquiposTab, PartidasTab, StatsTab, ReglasTab,
  AdminPanel, DashboardSkeleton, ResponsiveStyles,
} from '@/components/tournament/dashboard';
import '@/styles/tournament-dashboard.css';

export default function TournamentDashboardPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const go = (to: string) => navigate(to);
  const [params, setParams] = useSearchParams();
  const { data, isLoading, isError, error, refetch } = useTournamentDashboard(id);

  // Sin ?tab= explícito: durante inscripciones/check-in lo que importa son los
  // equipos; con el torneo ya en marcha (bracket generado), el resumen.
  const defaultTab: Tab =
    data && (data.tournament.phase === 'registration' || data.tournament.phase === 'checkin')
      ? 'equipos'
      : 'resumen';
  const tab = (params.get('tab') as Tab) || defaultTab;
  const setTab = (t: Tab) =>
    setParams((prev) => { const p = new URLSearchParams(prev); p.set('tab', t); return p; }, { replace: true });

  // Muestras del descubrimiento: se calculan del payload real para que cada
  // chip aterrice en algo que existe (equipo inscrito, serie ya jugada, ronda
  // en juego) y nunca en una pantalla vacía.
  const discovery: DiscoverySamplesData = useMemo(() => {
    const rounds = data?.bracket ?? [];
    const all = rounds.flatMap((r) => r.matches.map((m) => ({ ...m, round: r.round })));
    const complete = all.filter((m) => m.matchStatus === 'complete' && m.teamA && m.teamB);
    const sampleMatch =
      complete.find((m) => m.round === 2) ?? complete[complete.length - 1] ?? null;
    const active = all.filter((m) => m.matchStatus === 'active');
    return {
      sampleTeam: data?.myTeam?.tag ?? data?.standings?.[0]?.name ?? null,
      sampleMatch: sampleMatch ? { id: sampleMatch.id, round: sampleMatch.round } : null,
      liveRound: active.length ? Math.min(...active.map((m) => m.round)) : null,
    };
  }, [data]);

  // Inscripción SIN salir de la página: modal propio. `?register=1` lo abre
  // solo (así el flujo "acepté la invitación → inscribe tu equipo" es directo).
  const [registerOpen, setRegisterOpen] = useState(false);
  useEffect(() => {
    if (!data || params.get('register') !== '1') return;
    if (data.tournament.phase === 'registration') setRegisterOpen(true);
    setParams((prev) => { const p = new URLSearchParams(prev); p.delete('register'); return p; }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, params]);

  return (
    <div
      className="td-root"
      style={{
        position: 'relative', minHeight: '100vh',
        // Lienzo "vision": negro profundo con sangrado crimson y toque de oro,
        // el mismo lenguaje que el dashboard de usuario.
        background:
          'radial-gradient(1200px 700px at 85% -10%, rgba(225,36,46,0.15), transparent 60%),' +
          'radial-gradient(900px 600px at -10% 30%, rgba(120,20,30,0.18), transparent 60%),' +
          'radial-gradient(1000px 500px at 50% 115%, rgba(200,170,110,0.06), transparent 60%),' +
          'linear-gradient(180deg, #08070a 0%, #0b070b 48%, #060608 100%)',
      }}
    >
      {/* Aurora crimson→oro (React Bits, WebGL) respirando tras el glass */}
      <div aria-hidden style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', opacity: 0.5 }}>
        <Aurora colorStops={['#7a1d24', '#e8323c', '#c8aa6e']} amplitude={1.1} blend={0.55} speed={0.55} />
      </div>
      <div
        aria-hidden
        style={{
          position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
          background: 'linear-gradient(180deg, rgba(8,7,10,0.05) 0%, rgba(8,7,10,0.40) 45%, rgba(6,6,8,0.72) 100%)',
        }}
      />
      <ResponsiveStyles />
      <div className="td-dash" style={{ position: 'relative', zIndex: 1, maxWidth: 1560, margin: '0 auto', padding: '80px 24px 96px' }}>
        {isError ? (
          <ErrorCard
            message={(error as any)?.response?.data?.error ?? (error as any)?.message ?? 'No se pudo cargar el torneo'}
            onRetry={() => refetch()}
          />
        ) : isLoading || !data ? (
          <DashboardSkeleton />
        ) : (
          <>
            <Breadcrumbs name={data.tournament.name} tab={tab} onHome={() => go('/tournaments')} />
            <Hero data={data} onBracket={() => setTab('bracket')} onRegister={() => setRegisterOpen(true)} />
            {/* Descubrimiento: banner descartable con muestras reales (no bloquea) */}
            <DiscoveryBanner tournamentId={id} data={discovery} />
            <BroadcastBanner channel={id} navigate={go} />
            <Tiles t={data.tournament} />
            {data.viewerAccess === 'owner' && (
              <AdminPanel id={id} phase={data.tournament.phase} bracketType={data.tournament.bracketType}
                seriesTo={data.tournament.seriesTo} finalSeriesTo={data.tournament.finalSeriesTo}
                swissRounds={data.tournament.swissRounds ?? null}
                isPrivate={(data.tournament as any).isPrivate}
                discordWebhookUrl={(data.tournament as any).discordWebhookUrl}
                playoffsSize={(data.tournament as any).playoffsSize} />
            )}
            <div className="td-shell">
              <aside className="td-side">
                <SideNav value={tab} onChange={setTab} live={data.tournament.status === 'live'} />
              </aside>
              <main style={{ minWidth: 0 }}>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={tab}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                  >
                    {tab === 'resumen' && (
                      <ResumenGrid data={data} id={id} navigate={go} onStats={() => setTab('stats')}
                        onRound={(r) => setParams((prev) => {
                          const p = new URLSearchParams(prev); p.set('tab', 'partidas'); p.set('round', r); return p;
                        }, { replace: true })} />
                    )}
                    {tab === 'bracket' && <BracketTab id={id} data={data} />}
                    {tab === 'equipos' && (
                      <EquiposTab id={id} region={data.tournament.region} standings={data.standings} />
                    )}
                    {tab === 'partidas' && <PartidasTab id={id} swissRounds={data.tournament.swissRounds ?? null} />}
                    {tab === 'stats' && (
                      <StatsTab id={id} name={data.tournament.name} standings={data.standings} />
                    )}
                    {tab === 'reglas' && <ReglasTab data={data} />}
                  </motion.div>
                </AnimatePresence>
              </main>
            </div>
            {/* Nav flotante inferior (móvil / tablet) */}
            <BottomNav value={tab} onChange={setTab} live={data.tournament.status === 'live'} />
            {/* Reabre las muestras a petición del jugador — nunca solo */}
            <GuiaRapidaButton data={discovery} />

            {/* Modal de inscripción in-page — roster del tamaño del formato */}
            <TournamentRegisterModal
              tournamentId={id}
              tournamentName={data.tournament.name}
              teamSize={(data.tournament as any).teamSize}
              open={registerOpen}
              onOpenChange={setRegisterOpen}
              onRegistered={() => refetch()}
            />
          </>
        )}
      </div>
    </div>
  );
}

// ── BROADCAST BANNER ─────────────────────────────────────────────────────────
// Si el Spectator Companion está transmitiendo en el canal de este torneo
// (canal = id del torneo), aparece el acceso directo al broadcast en vivo.
// Chequeo ligero cada 30s; si no hay transmisión no se renderiza nada.
