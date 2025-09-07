// src/routes/router.tsx
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/features/auth/useAuth';

// Pages
import Home from '@/pages/Home';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import StatsSearch from '@/pages/StatsSearch';
import SummonerPage from '@/pages/SummonerPage';
import Social from '@/pages/Social';
import Tournaments from '@/pages/Tournaments';
import Dashboard from '@/pages/Dashboard';
import NotFound from '@/pages/NotFound';

// Guard que permite entrar si ya estás autenticado
// o si vienes con ?payload=... (OAuth callback)
function RequireAuth({ children }: { children: JSX.Element }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const hasPayload = new URLSearchParams(location.search).has('payload');

  if (isAuthenticated || hasPayload) return children;
  return <Navigate to="/login" state={{ from: location }} replace />;
}

export const AppRouter = () => {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/stats" element={<StatsSearch />} />
      <Route path="/stats/:region/:riotId" element={<SummonerPage />} />

      {/* Protected Routes */}
      <Route
        path="/dashboard"
        element={
          <RequireAuth>
            <Dashboard />
          </RequireAuth>
        }
      />
      <Route
        path="/social"
        element={
          <RequireAuth>
            <Social />
          </RequireAuth>
        }
      />
      <Route
        path="/tournaments"
        element={
          <RequireAuth>
            <Tournaments />
          </RequireAuth>
        }
      />

      {/* 404 */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};
