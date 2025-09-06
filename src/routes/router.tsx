import { Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';

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
      <Route path="/dashboard" element={
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      } />
      <Route path="/social" element={
        <ProtectedRoute>
          <Social />
        </ProtectedRoute>
      } />
      <Route path="/tournaments" element={
        <ProtectedRoute>
          <Tournaments />
        </ProtectedRoute>
      } />
      
      {/* 404 */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};