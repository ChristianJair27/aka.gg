// Daga de marca ATAK — única daga permitida (DESIGN.md: no inventar nuevas).
// Extraída de Navbar para reutilizarla en Login/Register.
import { useId } from 'react';

export function DaggerLogo({ className = 'h-8 w-8' }: { className?: string }) {
  const uid = useId().replace(/:/g, '');
  const blade = `blade-${uid}`, glow = `glow-${uid}`;
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M32 4L12 40L32 60L52 40L32 4Z" fill={`url(#${glow})`} opacity="0.15" />
      <path d="M32 8L22 38L32 50L42 38L32 8Z" fill={`url(#${blade})`} stroke="#ef4444" strokeWidth="2" />
      <path d="M32 8V50" stroke="#fff" strokeWidth="1" opacity="0.6" />
      <path d="M16 46H48" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" />
      <path d="M14 46L10 50" stroke="#b91c1c" strokeWidth="3" strokeLinecap="round" />
      <path d="M50 46L54 50" stroke="#b91c1c" strokeWidth="3" strokeLinecap="round" />
      <path d="M32 46V58" stroke="#111" strokeWidth="4" strokeLinecap="round" />
      <path d="M32 58V62" stroke="#b91c1c" strokeWidth="6" strokeLinecap="round" />
      <defs>
        <linearGradient id={blade} x1="32" y1="8" x2="32" y2="50" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ff4d4d" />
          <stop offset="100%" stopColor="#3b0000" />
        </linearGradient>
        <radialGradient id={glow} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ef4444" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
      </defs>
    </svg>
  );
}
