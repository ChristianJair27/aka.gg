import { Link, useNavigate } from 'react-router-dom';
import { Button } from './Button';
import { useAuth } from '@/features/auth/useAuth';
import { GamepadIcon, LogOut, User } from 'lucide-react';

import atakLogo from '../../public/atak-logo.png';

export const Navbar = () => {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <nav className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-40">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2 group">
            <img
              src={atakLogo}
              alt="ATAK.GG Logo"
              className="h-8 w-auto transition-transform group-hover:scale-105"
            />
            <span className="text-xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              ATAK.GG
            </span>
          </Link>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center space-x-6">
            <Link 
              to="/" 
              className="text-foreground hover:text-accent transition-colors"
            >
              Home
            </Link>
            <Link 
              to="/stats" 
              className="text-foreground hover:text-accent transition-colors"
            >
              Stats
            </Link>
            <Link 
              to="/tournaments" 
              className="text-foreground hover:text-accent transition-colors"
            >
              Tournaments
            </Link>
            <Link 
              to="/social" 
              className="text-foreground hover:text-accent transition-colors"
            >
              Social
            </Link>
          </div>

          {/* Auth Buttons */}
          <div className="flex items-center space-x-4">
            {isAuthenticated ? (
              <>
                <Link to="/dashboard">
                  <Button variant="ghost" size="sm" className="flex items-center space-x-2">
                    <User className="h-4 w-4" />
                    <span className="hidden sm:inline">{user?.name || 'Dashboard'}</span>
                  </Button>
                </Link>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLogout}
                  className="flex items-center space-x-2"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline">Logout</span>
                </Button>
              </>
            ) : (
              <>
                <Link to="/login">
                  <Button variant="ghost" size="sm">
                    Login
                  </Button>
                </Link>
                <Link to="/register">
                  <Button size="sm">
                    Register
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};