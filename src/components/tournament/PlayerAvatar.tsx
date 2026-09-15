// ATAK.GG — Avatar de jugador para listas de stats.
//
// La identidad de una PERSONA es su icono de perfil de LoL, no el campeón que
// más juega: dos jugadores con el mismo main se veían idénticos en la tabla.
// Orden de preferencia, sin dejar nunca el hueco vacío:
//   1. icono de perfil (Data Dragon) si el batch de useProfileIcons lo trajo,
//   2. icono del campeón más jugado si no hay perfil,
//   3. iniciales sobre fondo hundido si tampoco hay campeón o falla la carga.
// El campeón sigue siendo el sujeto correcto en pools y gráficos de picks: ahí
// NO se usa este componente.
import { useState } from 'react';
import { dd } from '@/lib/dataDragon';
import { cn } from '@/lib/utils';

export function PlayerAvatar({
  riotId, profileIconId, mostPlayedChamp, size = 32, className, ring = true,
}: {
  /** "nombre#tag" — solo para las iniciales del fallback. */
  riotId?: string | null;
  profileIconId?: number | null;
  mostPlayedChamp?: string | null;
  size?: number;
  className?: string;
  /** Aro fino de borde; se quita en celdas muy densas. */
  ring?: boolean;
}) {
  const [profileFailed, setProfileFailed] = useState(false);
  const [champFailed, setChampFailed] = useState(false);

  const profileSrc = profileIconId && !profileFailed ? dd.profileIcon(profileIconId) : null;
  const champSrc = !profileSrc && mostPlayedChamp && !champFailed ? dd.champion(mostPlayedChamp) : null;
  const src = profileSrc ?? champSrc;

  const radius = Math.round(size * 0.3);
  const base: React.CSSProperties = {
    width: size, height: size, borderRadius: radius, flexShrink: 0, objectFit: 'cover',
    background: 'var(--td-sunken)',
    boxShadow: ring ? '0 0 0 1px var(--td-border-hov)' : undefined,
  };

  if (src) {
    return (
      <img
        src={src} alt="" loading="lazy" width={size} height={size}
        className={cn('block', className)}
        style={base}
        onError={() => (profileSrc ? setProfileFailed(true) : setChampFailed(true))}
      />
    );
  }

  const name = (riotId || '').split('#')[0].trim();
  const initials = name ? name.slice(0, 2).toUpperCase() : '?';
  return (
    <span
      className={cn('inline-flex items-center justify-center select-none', className)}
      style={{
        ...base, color: 'var(--td-text-2)', fontFamily: 'var(--td-font-mono)',
        fontWeight: 700, fontSize: Math.max(9, Math.round(size * 0.36)),
      }}
      aria-hidden
    >
      {initials}
    </span>
  );
}

/** Riot ID "nombre#tag" desde un PlayerAggregate (que no trae el id armado). */
export const riotIdOf = (p: { summonerName: string; tagLine?: string | null }) =>
  p.tagLine ? `${p.summonerName}#${p.tagLine}` : p.summonerName;

export default PlayerAvatar;
