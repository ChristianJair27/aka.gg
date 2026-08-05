// src/routes/router.tsx — code-split lazy routes
import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/features/auth/useAuth';
import KataLoader from '@/components/KataLoader';

// Eagerly load the two most visited pages
import Home        from '@/pages/Home';
// ProfilePage is the unified summoner profile used for BOTH /stats and /profile.
import ProfilePage from '@/pages/ProfilePage';

// Lazy-load everything else (split into separate chunks)
const Login                = lazy(() => import('@/pages/Login'));
const Register             = lazy(() => import('@/pages/Register'));
const ForgotPassword       = lazy(() => import('@/pages/ForgotPassword'));
const MetaPage             = lazy(() => import('@/pages/MetaPage'));
const ChampionPage         = lazy(() => import('@/pages/ChampionPage'));
const StatsSearch          = lazy(() => import('@/pages/StatsSearch'));
const Social               = lazy(() => import('@/pages/Social'));
const TournamentsPage      = lazy(() => import('@/pages/Tournaments'));
const TournamentDashboardPage = lazy(() => import('@/pages/TournamentDashboardPage'));
const TournamentLivePage   = lazy(() => import('@/pages/TournamentLivePage'));
const Dashboard            = lazy(() => import('@/pages/Dashboard'));
const NotFound             = lazy(() => import('@/pages/NotFound'));
const MatchDetailPage      = lazy(() => import('@/pages/MatchDetailPage'));
const LiveSpectatePage     = lazy(() => import('@/pages/LiveSpectatePage'));

function PageLoader() {
  return (
    <div className="min-h-screen bg-[#08080b] flex items-center justify-center">
      <KataLoader size={220} />
    </div>
  );
}

function RequireAuth({ children }: { children: JSX.Element }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const hasPayload = new URLSearchParams(location.search).has('payload');
  if (isAuthenticated || hasPayload) return children;
  return <Navigate to="/login" state={{ from: location }} replace />;
}

export const AppRouter = () => (
  <Suspense fallback={<PageLoader />}>
    <Routes>
      {/* Eager */}
      <Route path="/"                         element={<Home />} />
      {/* Unified profile: /stats and /profile both render the new ProfilePage. */}
      <Route path="/stats/:region/:name"      element={<ProfilePage />} />
      <Route path="/profile/:region/:name"    element={<ProfilePage />} />

      {/* Lazy public */}
      <Route path="/login"                    element={<Login />} />
      <Route path="/register"                 element={<Register />} />
      <Route path="/forgot-password"          element={<ForgotPassword />} />
      <Route path="/reset-password"           element={<ForgotPassword />} />
      <Route path="/stats"                    element={<StatsSearch />} />
      <Route path="/meta"                     element={<MetaPage />} />
      <Route path="/champion/:slug"           element={<ChampionPage />} />
      <Route path="/match/:regional/:matchId" element={<MatchDetailPage />} />
      {/* Espectador universal: partida en vivo de CUALQUIER invocador, en el navegador. */}
      <Route path="/live/:region/:name"       element={<LiveSpectatePage />} />
      <Route path="/tournaments"              element={<TournamentsPage />} />
      <Route path="/tournaments/:id"          element={<TournamentDashboardPage />} />
      <Route path="/tournaments/:id/live"    element={<TournamentLivePage />} />
      <Route path="/social"                   element={<Social />} />

      {/* Protected lazy */}
      <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />

      <Route path="*" element={<NotFound />} />
    </Routes>
  </Suspense>
);
