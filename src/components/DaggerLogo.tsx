// Daga de marca ATAK — única daga permitida (DESIGN.md: no inventar nuevas).
// Ahora es el logo oficial HD (public/atak-logo-mark.png, generado por
// scripts/process-logo.py desde atak-logoHD.png con el fondo removido).
export function DaggerLogo({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <img
      src="/atak-logo-mark.png"
      alt="ATAK.GG"
      className={className}
      style={{ objectFit: 'contain' }}
      draggable={false}
    />
  );
}
