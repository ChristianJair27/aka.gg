// Barril del sistema "Arena": las páginas importan todo de aquí.
export * from './primitives';
export { default as Champion3D, type Champion3DProps, type ChampClip } from './Champion3D';
export {
  Button, StatusChip, SectionHead, FilterPills, ProgressBar, StatTile, TeamBadge,
} from '@/components/tournament/ui';
export { lol, mapArtFor, normalizeLane, normalizeClass, LANE_LABELS, CLASS_LABELS } from '@/lib/lolAssets';
