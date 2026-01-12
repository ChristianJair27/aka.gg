// src/components/Navbar.tsx
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import atakLogo from '../../public/atak-logo.png'; // Ajusta la ruta si es necesario

const navLinks = [
  { label: 'Home', href: '/' },
  { label: 'Stats', href: '/stats' },
  { label: 'Tournaments', href: '/tournaments' },
  { label: 'Social', href: '/social' },
];

export const Navbar = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-red-800/30 bg-black/70 backdrop-blur-xl">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-3 group">
            <img
              src={atakLogo}
              alt="ATAK.GG"
              className="h-9 w-9 object-contain transition-transform group-hover:scale-110 group-hover:rotate-12 duration-300"
            />
            <span className="text-xl font-black bg-gradient-to-r from-red-500 to-red-600 bg-clip-text text-transparent">
              ATAK.GG
            </span>
          </Link>

          {/* Desktop Links */}
          <div className="hidden md:flex items-center space-x-8">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                className="text-gray-300 hover:text-white font-medium transition-colors duration-200 relative group"
              >
                {link.label}
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-red-500 transition-all duration-300 group-hover:w-full" />
              </Link>
            ))}
          </div>

          {/* Desktop Auth Buttons */}
          <div className="hidden md:flex items-center space-x-4">
            <Link to="/login">
              <button className="px-5 py-2 text-gray-300 hover:text-white font-medium transition-colors">
                Login
              </button>
            </Link>
            <Link to="/register">
              <button className="px-6 py-2.5 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-semibold rounded-full shadow-lg shadow-red-600/30 transition-all duration-300">
                Register
              </button>
            </Link>
          </div>

          {/* Mobile Hamburger */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden text-white focus:outline-none"
          >
            {mobileMenuOpen ? <X className="h-7 w-7" /> : <Menu className="h-7 w-7" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden pb-4">
            <div className="flex flex-col space-y-4 mt-4">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  to={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-gray-300 hover:text-white font-medium text-lg transition-colors py-2 border-b border-red-800/30"
                >
                  {link.label}
                </Link>
              ))}
              <div className="flex flex-col space-y-3 pt-4">
                <Link to="/login" onClick={() => setMobileMenuOpen(false)}>
                  <button className="w-full py-3 text-gray-300 hover:text-white font-medium transition-colors">
                    Login
                  </button>
                </Link>
                <Link to="/register" onClick={() => setMobileMenuOpen(false)}>
                  <button className="w-full py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-semibold rounded-full shadow-lg shadow-red-600/30 transition-all">
                    Register
                  </button>
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};