/** LQC 2026 team logo resolver. Exact roster names + light aliases. */
const LQC_LOGOS: Record<string, string> = {
  "2 DOPE": "/teams/lqc/2-dope.webp",
  "DinoRatas": "/teams/lqc/dinoratas.webp",
  "False Promise Gaming": "/teams/lqc/false-promise-gaming.webp",
  "Galaxy Gaming": "/teams/lqc/galaxy-gaming.webp",
  "Heralds Of Cthulhu": "/teams/lqc/heralds-of-cthulhu.webp",
  "Game Over Qro": "/teams/lqc/game-over-qro.webp",
  "Requiem": "/teams/lqc/requiem.webp",
  "Los Rokosos": "/teams/lqc/los-rokosos.webp",
  "Nephyx Esports": "/teams/lqc/nephyx-esports.webp",
  "RAKU": "/teams/lqc/raku.webp",
  "REV505": "/teams/lqc/rev505.webp",
  "Tlacuaches": "/teams/lqc/tlacuaches.webp",
  "Mythical Dragons": "/teams/lqc/mythical-dragons.webp",
  "The Town Boys": "/teams/lqc/the-town-boys.webp",
};

const ALIASES: Record<string, string> = {
  "Nephtys": "Nephyx Esports",
  "Nephyx": "Nephyx Esports",
  "Game Over": "Game Over Qro",
  "Los Tlacuaches": "Tlacuaches",
  "2D": "2 DOPE",
  "2Dope": "2 DOPE",
};

export function normalizeTeamName(name?: string | null): string {
  return (name ?? "").trim().replace(/\s+/g, " ");
}

export function resolveTeamLogo(name?: string | null): string | undefined {
  const n = normalizeTeamName(name);
  if (!n) return undefined;
  if (LQC_LOGOS[n]) return LQC_LOGOS[n];
  const aliased = ALIASES[n];
  if (aliased && LQC_LOGOS[aliased]) return LQC_LOGOS[aliased];
  const lower = n.toLowerCase();
  for (const [k, v] of Object.entries(LQC_LOGOS)) {
    if (k.toLowerCase() === lower) return v;
  }
  for (const [k, canon] of Object.entries(ALIASES)) {
    if (k.toLowerCase() === lower && LQC_LOGOS[canon]) return LQC_LOGOS[canon];
  }
  return undefined;
}
