// src/pages/ProfilePage.tsx
// Perfil de invocador — sistema de diseño "Arena" (design-system/atak-gg/MASTER.md).
// La capa de datos (/api/stats/* vía hooks, OP.GG, spectator) no cambia: aquí solo
// se decide cómo se pinta. Estilos de página en src/styles/pages/profile.css.
import React, { useMemo, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { useChampions } from '@/hooks/use-ddragon';
import {
  useResolveRiotId,
  useSummary,
  useMatches,
  useLeagueRank,
  useRecentTeammates,
  useBestPlayers,
  useEnemyAvg,
} from '@/hooks/queries/stats';
import { qk } from '@/hooks/queries/keys';
import { axiosInstance } from '@/lib/axios';
import { useDominantColor } from '@/lib/dominantColor';
import { ProfileComments } from '@/components/ProfileComments';
import { PlayerTournamentsCard } from '@/components/tournament/PlayerTournamentsCard';
import { TierEmblem } from '@/components/tournament/MicroViz';
import {
  dd,
  rankEmblem,
  spellIcon,
  fmtNumber,
  keystoneIcon,
  runePathIcon,
} from '@/lib/dataDragon';
import { regionLabel } from '@/lib/regions';
import {
  RefreshCw, Star, Sparkles, Swords, Trophy, Crown, ChevronDown, ChevronUp, Users, BarChart3, History, Compass,
} from 'lucide-react';
import { KataLoaderOverlay } from '@/components/KataLoader';
import { Tip } from '@/components/ui/Tip';
import { ShareProfileButton } from '@/components/ShareProfileCard';
import {
  ArenaPage, SplashBackdrop, Champion3D, Reveal, Button, StatusChip, SectionHead, FilterPills, ProgressBar,
  RoleIcon, UiIcon, ChampIcon, stagger,
} from '@/components/arena';
import '@/styles/pages/profile.css';

// ─── Region / platform helpers ──────────────────────────────────────────────
type Platform = 'la1'|'la2'|'na1'|'br1'|'oc1'|'euw1'|'eun1'|'tr1'|'ru'|'jp1'|'kr';
type Continent = 'americas'|'europe'|'asia';

const platformToContinent = (p: Platform): Continent =>
  ['la1','la2','na1','br1','oc1'].includes(p) ? 'americas' :
  ['euw1','eun1','tr1','ru'].includes(p) ? 'europe' : 'asia';

const normalizePlatform = (s?: string): Platform => {
  const m: Record<string, Platform> = {
    lan:'la1', la1:'la1', las:'la2', la2:'la2', na:'na1', na1:'na1',
    br:'br1', br1:'br1', oce:'oc1', oc1:'oc1', euw:'euw1', euw1:'euw1',
    eune:'eun1', eun1:'eun1', tr:'tr1', tr1:'tr1', ru:'ru',
    kr:'kr', jp:'jp1', jp1:'jp1',
  };
  return m[(s || '').toLowerCase()] || (s as Platform) || 'la1';
};

// Default tagLine per platform when the route omits one (bare name). Riot accepts
// these as sensible regional defaults for resolution.
const DEFAULT_TAG: Record<Platform, string> = {
  la1: 'LAN', la2: 'LAS', na1: 'NA1', br1: 'BR1', oc1: 'OCE',
  euw1: 'EUW', eun1: 'EUNE', tr1: 'TR1', ru: 'RU', jp1: 'JP1', kr: 'KR1',
};

// Route param `:name` may arrive as "Name#TAG" (from /stats links), "Name-TAG"
// (from /profile links), or a bare "Name" (no tag). Parse all three. When no tag
// is present we fall back to a per-region default so resolution can still work.
const splitNameTag = (raw: string | undefined, platform: Platform) => {
  const s = decodeURIComponent(raw || '').trim();
  if (!s) return { gameName: '', tagLine: '' };
  // Prefer an explicit '#' separator (canonical Riot ID).
  if (s.includes('#')) {
    const i = s.indexOf('#');
    return { gameName: s.slice(0, i).trim(), tagLine: s.slice(i + 1).trim() };
  }
  // Otherwise treat the LAST hyphen as the tag separator (names may contain '-').
  const i = s.lastIndexOf('-');
  if (i !== -1) {
    const candidateTag = s.slice(i + 1).trim();
    // A real tag is short & alphanumeric; if it looks like part of the name, ignore.
    if (candidateTag.length >= 2 && candidateTag.length <= 5 && /^[A-Za-z0-9]+$/.test(candidateTag)) {
      return { gameName: s.slice(0, i).trim(), tagLine: candidateTag };
    }
  }
  // Bare name → default regional tag.
  return { gameName: s, tagLine: DEFAULT_TAG[platform] || 'NA1' };
};

// Build the profile route for a co-player / participant.
const profileHref = (region: string, gameName?: string, tagLine?: string) => {
  const g = (gameName || '').trim();
  const t = (tagLine || '').trim();
  if (!g) return null;
  const slug = t ? `${encodeURIComponent(g)}-${encodeURIComponent(t)}` : encodeURIComponent(g);
  return `/profile/${region}/${slug}`;
};

// ─── Queue & role maps ──────────────────────────────────────────────────────
const QUEUE_NAMES: Record<number, string> = {
  400: 'Normal Draft', 420: 'Solo/Dúo', 430: 'Normal Blind',
  440: 'Flex', 450: 'ARAM', 700: 'Clash',
  830: 'Co-op IA', 840: 'Co-op IA', 850: 'Co-op IA',
  900: 'URF', 1700: 'Arena', 1900: 'URF',
};
const queueName = (qid?: number, fallback?: string) =>
  QUEUE_NAMES[qid ?? 0] || fallback || 'Personalizada';

const ROLES = ['Central', 'Jungla', 'Tirador', 'Soporte', 'Superior'] as const;
type Role = typeof ROLES[number];

// teamPosition / role / lane → Spanish role
const toRole = (m: any): Role | null => {
  const pos = String(m.teamPosition || m.role || '').toUpperCase();
  const lane = String(m.lane || '').toUpperCase();
  if (pos === 'MIDDLE' || lane === 'MIDDLE' || pos === 'MID') return 'Central';
  if (pos === 'JUNGLE' || lane === 'JUNGLE') return 'Jungla';
  if (pos === 'BOTTOM' || pos === 'CARRY' || pos === 'ADC' || (lane === 'BOTTOM' && pos !== 'SUPPORT')) return 'Tirador';
  if (pos === 'UTILITY' || pos === 'SUPPORT') return 'Soporte';
  if (pos === 'TOP' || lane === 'TOP') return 'Superior';
  return null;
};

// Rol en español → clave de carril de los iconos de LoL (<RoleIcon lane>).
const ROLE_LANE: Record<Role, string> = {
  Central: 'middle', Jungla: 'jungle', Tirador: 'bottom', Soporte: 'support', Superior: 'top',
};

// ─── Piezas pequeñas ────────────────────────────────────────────────────────
type Tone = 'pos' | 'neg' | 'gold' | 'dim' | undefined;

/** Tono de una tasa de victorias: mismos cortes que <ProgressBar kind="wr">. */
const wrTone = (wr: number | null | undefined): Tone =>
  wr == null ? undefined : wr >= 60 ? 'pos' : wr < 45 ? 'neg' : undefined;

const tierName = (tier?: string | null) => (tier ? tier[0] + tier.slice(1).toLowerCase() : '');

const hideImg = (e: React.SyntheticEvent<HTMLImageElement>) => { e.currentTarget.style.visibility = 'hidden'; };

function Skel({ h = 16, w = '100%', style }: { h?: number | string; w?: number | string; style?: React.CSSProperties }) {
  return <span className="pf-skel" aria-hidden style={{ height: h, width: w, ...style }} />;
}

/** Panel del sistema (`td-panel`) que entra al aparecer en pantalla. */
function Panel({ children, className, index = 0 }: { children: React.ReactNode; className?: string; index?: number }) {
  return (
    <Reveal as="section" index={index} className={`td-panel pf-panel${className ? ` ${className}` : ''}`}>
      {children}
    </Reveal>
  );
}

/** Chips de insights: mismos datos que antes ({ label, kind }), con las piezas del sistema. */
function Insights({ tags, loading, unavailable }: {
  tags: { label: string; kind: 'pos' | 'warn' | 'gold' | 'dim' }[]; loading: boolean; unavailable: boolean;
}) {
  if (!loading && (unavailable || !tags.length)) return null;
  return (
    <div className="pf-insights ax-rise" style={stagger(2)}>
      <span className="td-over pf-insights-label"><Sparkles size={13} aria-hidden /> ATAK Insights</span>
      {loading
        ? [0, 1, 2].map((i) => <Skel key={i} h={22} w={68 + i * 16} style={{ borderRadius: 4 }} />)
        : tags.map((t, i) => {
            const lane = ROLE_LANE[t.label as Role];
            // Los iconos son de LoL o de lucide: el emoji de la etiqueta se queda fuera.
            const label = t.label.replace(/\s*\p{Extended_Pictographic}️?/gu, '');
            return (
              <StatusChip key={`${t.label}-${i}`} kind={t.kind} dot={!lane}>
                {lane && <RoleIcon lane={lane} size={15} />}
                {label}
              </StatusChip>
            );
          })}
    </div>
  );
}

// ─── Types of state ─────────────────────────────────────────────────────────
interface RankEntry { queue: string; tier: string; rank: string; lp: number; wins?: number; losses?: number; }

// ─── Page ───────────────────────────────────────────────────────────────────
export default function ProfilePage() {
  const { region, name } = useParams<{ region: string; name: string }>();
  const { data: champs } = useChampions();

  const platform = normalizePlatform(region);
  const continent = platformToContinent(platform);
  const { gameName, tagLine } = useMemo(() => splitNameTag(name, platform), [name, platform]);

  const qc = useQueryClient();
  // 20 partidas por defecto: el análisis (recap/IA/roles) se corta a los últimos
  // 30 días, así que necesitamos más muestra que las 10 clásicas.
  const [count, setCount] = useState(20);
  const [filter, setFilter] = useState<'all' | 420 | 440 | 450>('all');

  const champByKey = champs?.byKey;

  // ── Dependent React Query chain ──────────────────────────────────────────────
  // resolve (riotId → puuid) → summary / matches / league-rank / teammates /
  // best-players. Each downstream query is `enabled` only once `puuid` resolves,
  // so the flow self-orchestrates and everything is cached + deduped.
  const hasRiotId = Boolean(gameName && tagLine);
  const resolveQ = useResolveRiotId(hasRiotId ? platform : undefined, gameName, tagLine);
  const puuid = resolveQ.data?.puuid;
  const resolveErr = !hasRiotId || resolveQ.isError;

  const summaryQ = useSummary(platform, puuid);
  const summary = summaryQ.data ?? null;
  const summaryLoading = summaryQ.isPending; // pending while disabled or in-flight

  const matchesQ = useMatches(continent, puuid, count);
  const matches: any[] = matchesQ.data ?? [];
  // While "Cargar más" refetches with a new count we still have the prior page.
  const matchesLoading = matchesQ.isPending;
  const loadingMore = matchesQ.isFetching && !matchesQ.isPending;

  const leagueRankQ = useLeagueRank(platform, puuid);
  const leagueRank = leagueRankQ.data ?? null;

  const teammatesQ = useRecentTeammates(continent, puuid, 20);
  const teammates = teammatesQ.data ?? null;
  const teammatesLoading = teammatesQ.isPending;

  const bestPlayersQ = useBestPlayers(platform, puuid, 15);
  const bestPlayers = bestPlayersQ.data ?? null;

  // Elo promedio de rivales (últimos 30 días; el backend muestrea y cachea 1h).
  const enemyAvgQ = useEnemyAvg(platform, puuid);
  const enemyAvg = enemyAvgQ.data ?? null;

  // OP.GG regional rank + champion stats (independent of PUUID — uses Riot ID directly)
  const opggQ = useQuery({
    queryKey: ['opgg', 'profile', platform, gameName, tagLine],
    queryFn: async () => {
      // axiosInstance usa VITE_API_URL — antes había un localhost:4000 hardcodeado
      // que rompía este panel en producción (solo funcionaba con backend local).
      const { data } = await axiosInstance.get('/api/opgg/summoner-full', {
        params: { game_name: gameName, tag_line: tagLine, region: platform },
      });
      return data?.ok ? data : null;
    },
    enabled: !!gameName && !!tagLine,
    staleTime: 5 * 60 * 1000,
  });
  const opggData = opggQ.data ?? null;

  // ¿Está en partida AHORA? Chequeo ligero (Spectator-V5) → botón EN VIVO que
  // lleva al espectador universal /live/:region/:name. Re-chequea cada 60s.
  const liveCheckQ = useQuery({
    queryKey: ['live-check', platform, puuid],
    enabled: !!puuid,
    staleTime: 55_000,
    refetchInterval: 60_000,
    retry: false,
    queryFn: async () => {
      const { data, status } = await axiosInstance.get(`/api/stats/spectator/${platform}/${puuid}`, {
        params: { rank: 0 },
        validateStatus: (s) => s < 500,
        timeout: 12000,
      });
      return status === 200 && Array.isArray(data?.participants) && data.participants.length > 0;
    },
  });
  const isLive = liveCheckQ.data === true;

  const loadMore = () => setCount((n) => n + 10);

  // "Actualizar" — invalidate every stats query for this invocador (resolve
  // through the dependent chain). React Query then refetches the mounted ones.
  const refresh = () => {
    qc.invalidateQueries({ queryKey: qk.stats.resolve(platform, gameName, tagLine) });
    if (puuid) {
      qc.invalidateQueries({ queryKey: qk.stats.summary(platform, puuid) });
      qc.invalidateQueries({ queryKey: qk.stats.matches(continent, puuid, count) });
      qc.invalidateQueries({ queryKey: qk.stats.leagueRank(platform, puuid) });
      qc.invalidateQueries({ queryKey: qk.stats.recentTeammates(continent, puuid) });
      qc.invalidateQueries({ queryKey: qk.stats.bestPlayers(platform, puuid) });
    }
  };

  // ── Derived ────────────────────────────────────────────────────────────────
  const rankArr: RankEntry[] = summary?.rank || [];
  const soloRank = rankArr.find((r) => r.queue === 'RANKED_SOLO_5x5') || null;
  const flexRank = rankArr.find((r) => r.queue === 'RANKED_FLEX_SR' || r.queue === 'RANKED_TEAM_5x5') || null;

  const masteryTop = (summary?.masteryTop || []).slice(0, 6);

  // Highest-mastery champion → splash de fondo y modelo 3D del héroe.
  const topMasteryChamp = useMemo(() => {
    const top = (summary?.masteryTop || [])[0];
    if (!top) return null;
    const c = champByKey?.[String(top.championId)];
    // c.id is the DDragon slug (e.g. "Pantheon"); championId habilita el modelo 3D del CDN.
    return c ? { slug: c.id, name: c.name, id: top.championId } : null;
  }, [summary, champByKey]);

  // Splash del main (mismo arte que pinta <SplashBackdrop>).
  const heroSplash = topMasteryChamp ? dd.championSplash(topMasteryChamp.slug) : null;

  // Tinte ambiental: color dominante del splash del main → la luz del modelo 3D
  // combina con el campeón (fallback: rojo de marca).
  const champTint = useDominantColor(heroSplash);

  const filtered = useMemo(() => {
    if (filter === 'all') return matches;
    return matches.filter((m) => m.queueId === filter);
  }, [matches, filter]);

  // Ventana de análisis: últimos 30 días. El listado muestra todo lo cargado,
  // pero recap / IA / roles / campeones se calculan sobre esta ventana para que
  // el análisis refleje el nivel ACTUAL del jugador, no partidas viejas.
  const THIRTY_D = 30 * 86400_000;
  const inWindow = (m: any) => !m.gameStartTimestamp || (Date.now() - m.gameStartTimestamp) <= THIRTY_D;
  const last30 = useMemo(() => matches.filter(inWindow), [matches]);

  const recap = useMemo(() => {
    const pool = filtered.filter(inWindow);
    if (!pool.length) return null;
    const wins = pool.filter((m) => m.win).length;
    const k = pool.reduce((s, m) => s + (m.kills || 0), 0);
    const d = pool.reduce((s, m) => s + (m.deaths || 0), 0);
    const a = pool.reduce((s, m) => s + (m.assists || 0), 0);
    return {
      n: pool.length, wins, losses: pool.length - wins,
      wr: Math.round((wins / pool.length) * 100),
      kda: d === 0 ? (k + a).toFixed(2) : ((k + a) / d).toFixed(2),
      k: (k / pool.length).toFixed(1), d: (d / pool.length).toFixed(1), a: (a / pool.length).toFixed(1),
    };
  }, [filtered]);

  // Role performance (últimos 30 días; Solo/Flex/normals)
  const rolePerf = useMemo(() => {
    const map: Record<Role, { games: number; wins: number }> = {
      Central: { games: 0, wins: 0 }, Jungla: { games: 0, wins: 0 }, Tirador: { games: 0, wins: 0 },
      Soporte: { games: 0, wins: 0 }, Superior: { games: 0, wins: 0 },
    };
    for (const m of last30) {
      const r = toRole(m);
      if (!r) continue;
      map[r].games += 1;
      if (m.win) map[r].wins += 1;
    }
    return map;
  }, [last30]);

  // Champions table (últimos 30 días; Solo/Dúo preferred, falls back to ranked-ish)
  const champRows = useMemo(() => {
    const pool = last30.filter((m) => m.queueId === 420);
    const src = pool.length ? pool : last30.filter((m) => m.queueId === 420 || m.queueId === 440);
    const agg = new Map<number, { games: number; wins: number; k: number; d: number; a: number }>();
    for (const m of src) {
      const id = Number(m.championId);
      const row = agg.get(id) || { games: 0, wins: 0, k: 0, d: 0, a: 0 };
      row.games += 1; if (m.win) row.wins += 1;
      row.k += m.kills || 0; row.d += m.deaths || 0; row.a += m.assists || 0;
      agg.set(id, row);
    }
    return Array.from(agg.entries())
      .map(([id, r]) => ({
        id,
        games: r.games,
        wr: Math.round((r.wins / r.games) * 100),
        kda: r.d === 0 ? (r.k + r.a).toFixed(2) : ((r.k + r.a) / r.d).toFixed(2),
      }))
      .sort((a, b) => b.games - a.games)
      .slice(0, 6);
  }, [matches]);

  // Player tags — use OP.GG full-season data as primary source, recent matches as fallback
  const tags = useMemo(() => {
    const t: string[] = [];
    if (opggData?.is_hot_streak) t.push('Racha ganadora 🔥');
    if (opggData?.is_veteran) t.push('Veterano');
    if (opggData?.is_fresh_blood) t.push('Recién llegado');

    // WR tag: prefer season WR from OP.GG ranked stats
    const seasonWr = (opggData?.rank as any)?.win_rate ?? null;
    const wrSrc = seasonWr ?? (recap ? recap.wr : null);
    if (wrSrc != null) {
      if (wrSrc >= 56) t.push('En racha');
      else if (wrSrc <= 42) t.push('En slump');
    }

    // KDA / deaths tag: derive from season champion totals (career totals ÷ play = per-game avg)
    const champStats = opggData?.champion_stats as any[] | undefined;
    if (champStats?.length) {
      const totalPlay   = champStats.reduce((s, c) => s + (c.play   || 0), 0);
      const totalKills  = champStats.reduce((s, c) => s + (c.kill   || 0), 0);
      const totalDeaths = champStats.reduce((s, c) => s + (c.death  || 0), 0);
      const totalAssist = champStats.reduce((s, c) => s + (c.assist || 0), 0);
      if (totalPlay > 0 && totalDeaths > 0) {
        const seasonKDA    = (totalKills + totalAssist) / totalDeaths;
        const avgDeathsPG  = totalDeaths / totalPlay;
        if (seasonKDA   >= 4) t.push('KDA alto');
        if (avgDeathsPG <  4) t.push('Juega seguro');
      }
    } else if (recap) {
      if (Number(recap.kda) >= 4) t.push('KDA alto');
      if (Number(recap.d)   <= 4) t.push('Juega seguro');
    }

    // Main champion from OP.GG (most played this season)
    const opggTop = champStats?.length
      ? [...champStats].sort((a, b) => b.play - a.play)[0]
      : null;
    if (opggTop?.champion_name) {
      const displayName = opggTop.champion_name.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase());
      t.push(`Main ${displayName}`);
    } else {
      const best = champRows[0];
      if (best && champByKey?.[String(best.id)]) t.push(`Main ${champByKey[String(best.id)].name}`);
    }

    const topRole = (Object.entries(rolePerf) as [Role, any][]).sort((a, b) => b[1].games - a[1].games)[0];
    if (topRole && topRole[1].games > 0) t.push(topRole[0]);
    if (soloRank) t.push(`${soloRank.tier[0]}${soloRank.tier.slice(1).toLowerCase()} ${soloRank.rank}`);
    return t.length ? t : ['Sin datos suficientes'];
  }, [recap, champRows, rolePerf, soloRank, champByKey, opggData]);

  // ── ATAK AI insights ─────────────────────────────────────────────────────
  // Assemble the `stats` payload from data the page already loaded (recent-match
  // recap + top champion + solo/flex rank + OP.GG season WR) — no new heavy
  // fetches. Only fires once we have a recap to send.
  const aiInput = useMemo(() => {
    if (!hasRiotId || !recap) return null;
    const tierLabel = (r: RankEntry | null) =>
      r ? `${r.tier[0] + r.tier.slice(1).toLowerCase()} ${r.rank}` : null;
    const rankStr = tierLabel(soloRank)
      || (tierLabel(flexRank) ? `${tierLabel(flexRank)} (Flex)` : 'Sin clasificar');
    const topChamp = champRows[0] && champByKey?.[String(champRows[0].id)]
      ? champByKey[String(champRows[0].id)].name
      : null;
    const seasonWr = opggData?.season_win_rate ?? null;
    return {
      riotId: `${gameName}#${tagLine}`,
      region: platform,
      stats: {
        rank: rankStr,
        winRate: seasonWr ?? recap.wr,
        kda: Number(recap.kda),
        mostPlayed: topChamp,
        totalGames: opggData?.season_play || recap.n,
      },
    };
  }, [hasRiotId, recap, soloRank, flexRank, champRows, champByKey, gameName, tagLine, platform, opggData]);

  // Insights determinísticos desde datos reales de OP.GG MCP (el Ollama
  // self-hosted que generaba estas etiquetas ya no está desplegado y producía
  // tags desactualizadas). `tags` ya combina racha, WR, KDA, main y rol.
  void aiInput; // conservado por si volvemos a activar el coach de IA
  // AiTags espera { label, kind } — mapear el string a su intención de color
  const aiTags = useMemo(() => {
    const kindOf = (t: string): 'pos' | 'warn' | 'gold' | 'dim' =>
      t.startsWith('Racha') || t === 'En racha' || t === 'Juega seguro' ? 'pos'
      : t === 'En slump' ? 'warn'
      : t.startsWith('Main') || t === 'KDA alto' || t === 'Veterano' ? 'gold'
      : 'dim';
    return tags
      .filter((t) => t !== 'Sin datos suficientes')
      .slice(0, 6)
      .map((label) => ({ label, kind: kindOf(label) }));
  }, [tags]);
  const aiUnavailable = false;
  // Puntos de carga SOLO mientras no haya nada que mostrar Y algo siga cargando.
  // (Antes quedaba atorado en "..." si la query de partidas tardaba/fallaba,
  // aunque las etiquetas de OP.GG ya estuvieran listas.)
  const aiLoading = aiTags.length === 0 && (opggQ.isLoading || (matchesLoading && !matches.length));

  const profileIconUrl = summary?.summoner?.profileIconId != null ? dd.profileIcon(summary.summoner.profileIconId) : '';

  // ── Datos para la share card ───────────────────────────────────────────────
  // Nombre visible → entry de DDragon (champion_stats de OP.GG solo trae nombre).
  const champByName = useMemo(() => {
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const m: Record<string, { key: string; name: string }> = {};
    for (const e of Object.values(champs?.byId || {})) m[norm(e.name)] = e;
    return { get: (name: string) => m[norm(name)] };
  }, [champs]);

  const shareData = useMemo(() => {
    // Temporada ranked completa (totales de OP.GG) — muestra mucho mayor que 30d.
    const cs: any[] = opggData?.champion_stats || [];
    const r: any = opggData?.rank;
    let season: { games: number; wr: number; kda: string; wins: number; losses: number } | null = null;
    if (cs.length) {
      const games = cs.reduce((s, c) => s + (c.play || 0), 0);
      const k = cs.reduce((s, c) => s + (c.kill || 0), 0);
      const d = cs.reduce((s, c) => s + (c.death || 0), 0);
      const a = cs.reduce((s, c) => s + (c.assist || 0), 0);
      const wins = r?.wins ?? cs.reduce((s, c) => s + (c.win || 0), 0);
      const losses = r?.losses ?? cs.reduce((s, c) => s + (c.lose || 0), 0);
      if (games > 0) {
        season = {
          games,
          wr: wins + losses > 0 ? Math.round((wins / (wins + losses)) * 100) : 0,
          kda: d === 0 ? (k + a).toFixed(2) : ((k + a) / d).toFixed(2),
          wins, losses,
        };
      }
    }

    // Top campeones: temporada completa si hay OP.GG; si no, últimos 30 días.
    const champIcon = (key?: string | number) =>
      key != null ? `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-icons/${key}.png` : '';
    const topChamps = cs.length
      ? cs.slice(0, 3).map((c) => ({
          iconUrl: champIcon(champByName.get(c.champion_name || '')?.key),
          name: c.champion_name || '',
          games: c.play || 0,
          wr: c.play ? Math.round(((c.win || 0) / c.play) * 100) : 0,
        }))
      : champRows.map((row) => ({
          iconUrl: champIcon(row.id),
          name: champByKey?.[String(row.id)]?.name || `Campeón ${row.id}`,
          games: row.games,
          wr: row.wr,
        }));

    // Maestría del main: puntos DE POR VIDA (único total de carrera que da Riot).
    const m0: any = (summary?.masteryTop || [])[0];
    const mChamp = m0 ? champByKey?.[String(m0.championId)] : null;
    const mastery = m0 && mChamp && m0.points ? { champ: mChamp.name, points: Number(m0.points) } : null;

    // Mejor daño a campeones dentro de las partidas cargadas.
    let bestDamage: { value: number; champ: string } | null = null;
    for (const m of matches) {
      const dmg = m?.totalDamageDealtToChampions;
      if (dmg != null && (!bestDamage || dmg > bestDamage.value)) {
        bestDamage = { value: dmg, champ: champByKey?.[String(m.championId)]?.name || '' };
      }
    }

    // Wards de las partidas recientes (el campo llega cuando el backend nuevo
    // está desplegado; con caché viejo simplemente no se muestra el chip).
    const withWards = matches.filter((m) => m?.wardsPlaced != null);
    const wardsRecent = withWards.length >= 5
      ? { wards: withWards.reduce((s, m) => s + (m.wardsPlaced || 0), 0), games: withWards.length }
      : null;

    return { season, topChamps, mastery, bestDamage, wardsRecent };
  }, [opggData, champRows, champByKey, champByName, summary, matches]);

  // KPIs arriba del fold (estilo SaaS landing: métricas primero).
  const kpiWr = recap?.wr ?? (opggData as any)?.season_win_rate ?? null;
  const kpiKda = recap?.kda ?? null;
  const kpiGames = recap?.n ?? (opggData as any)?.season_play ?? null;
  const kpiLp = soloRank?.lp ?? null;
  const kpiTier = soloRank
    ? `${soloRank.tier}${soloRank.rank ? ` ${soloRank.rank}` : ''}`
    : null;

  // ── Render ─────────────────────────────────────────────────────────────────
  // Luz del escenario 3D: color dominante del splash del main (respaldo: crimson).
  const stageAccent = champTint ? `rgb(${champTint.r}, ${champTint.g}, ${champTint.b})` : undefined;
  const notFound = resolveErr && !puuid;
  const mainMastery: any = (summary?.masteryTop || [])[0];
  const kpiPending = summaryLoading && !recap;

  return (
    <ArenaPage
      width="wide"
      flush
      className="pf"
      backdrop={<SplashBackdrop champion={topMasteryChamp?.slug} opacity={0.4} />}
    >
      {/* 3D Katarina loader while resolving the invocador (initial load). */}
      {!puuid && !resolveErr && <KataLoaderOverlay show label="Cargando invocador" />}

      {/* ── Héroe: identidad a la izquierda, campeón principal en 3D a la derecha ── */}
      <header className="pf-hero">
        <div className="pf-hero-main">
          <div className="pf-eyebrow ax-rise">
            <span className="td-over ax-kicker">Perfil de invocador</span>
            <StatusChip kind="dim" dot={false}>{regionLabel(platform)}</StatusChip>
            <Star size={16} className="pf-fav" aria-hidden />
            {isLive && (
              <Link to={`/live/${region}/${encodeURIComponent(name || '')}`} aria-label="Ver la partida en vivo">
                <StatusChip kind="live">En vivo</StatusChip>
              </Link>
            )}
          </div>

          <div className="pf-id ax-rise" style={stagger(1)}>
            {!notFound && (
              <div className="pf-avatar">
                {summaryLoading && !summary ? (
                  <span className="pf-skel" aria-hidden />
                ) : profileIconUrl ? (
                  <img src={profileIconUrl} alt="" width={108} height={108} decoding="async" onError={hideImg} />
                ) : (
                  <span className="pf-skel" aria-hidden style={{ animation: 'none' }} />
                )}
                <span className="pf-level td-num">Nv. {summary?.summoner?.level ?? '—'}</span>
              </div>
            )}
            <h1 className="ax-pagehero-title pf-name">
              {gameName || '—'}
              <span className="pf-tag">#{tagLine}</span>
            </h1>
          </div>

          <Insights tags={aiTags} loading={aiLoading && !notFound} unavailable={aiUnavailable} />

          {/* Maestría: los campeones con más puntos del jugador */}
          {!notFound && (masteryTop.length > 0 || (summaryLoading && !summary)) && (
            <div className="pf-mastery ax-rise" style={stagger(3)}>
              <span className="td-over">Maestría</span>
              {summaryLoading && !summary
                ? Array.from({ length: 5 }).map((_, i) => <Skel key={i} h={44} w={44} />)
                : masteryTop.map((m: any, i: number) => {
                    const c = champByKey?.[String(m.championId)];
                    return (
                      <Tip key={i} label={`${c?.name || m.championId} · Nv. ${m.level} · ${fmtNumber(m.points)} pts`}>
                        <span className="pf-mastery-item" data-top={i === 0}>
                          {c?.image
                            ? <ChampIcon src={c.image} size={44} />
                            : <Skel h={44} w={44} style={{ animation: 'none' }} />}
                          <span className="pf-mastery-lvl td-num">{m.level}</span>
                        </span>
                      </Tip>
                    );
                  })}
            </div>
          )}

          <div className="ax-pagehero-actions pf-actions ax-rise" style={stagger(4)}>
            {!!gameName && !notFound && (
              <ShareProfileButton
                data={{
                  gameName,
                  tagLine,
                  platform,
                  level: summary?.summoner?.level ?? null,
                  profileIconUrl: profileIconUrl || null,
                  splashUrl: topMasteryChamp ? dd.championSplash(topMasteryChamp.slug) : null,
                  emblemUrl: soloRank ? rankEmblem(soloRank.tier) : null,
                  soloRank,
                  flexRank: flexRank ? { tier: flexRank.tier, rank: flexRank.rank, lp: flexRank.lp } : null,
                  topPercent: leagueRank?.topPercent ?? null,
                  recap,
                  season: shareData.season,
                  mastery: shareData.mastery,
                  bestDamage: shareData.bestDamage,
                  wardsRecent: shareData.wardsRecent,
                  topChamps: shareData.topChamps,
                }}
              />
            )}
            <Tip label="Volver a cargar los datos del invocador">
              <span style={{ display: 'inline-flex' }}>
                <Button
                  variant="secondary"
                  icon={<RefreshCw size={15} className={summaryQ.isFetching ? 'pf-spin' : undefined} />}
                  onClick={refresh}
                >
                  Actualizar
                </Button>
              </span>
            </Tip>
          </div>
        </div>

        {/* Modelo 3D del campeón de mayor maestría: sin caja, sobre su propio splash. */}
        <div className="pf-hero-stage">
          {topMasteryChamp && (
            <Champion3D
              slug={topMasteryChamp.slug}
              champId={topMasteryChamp.id}
              clip="idle"
              art="none"
              accent={stageAccent}
              className="pf-stage"
            >
              <div className="ax-stage-label pf-stage-label">
                <span className="td-over">Maestría principal</span>
                <b>{topMasteryChamp.name}</b>
                {mainMastery?.points ? (
                  <small className="td-num">Nivel {mainMastery.level} · {fmtNumber(mainMastery.points)} pts</small>
                ) : null}
              </div>
            </Champion3D>
          )}
        </div>
      </header>

      {notFound ? (
        <div className="ax-empty pf-block" role="status">
          <Compass size={30} color="var(--td-muted)" aria-hidden />
          <h3>No se encontró al invocador</h3>
          <p style={{ margin: 0 }}>
            Verifica el Riot ID (Nombre#TAG) y la región. Buscado: <b>{gameName || '—'}#{tagLine || '—'}</b> en {platform.toUpperCase()}.
          </p>
        </div>
      ) : (
        <>
          {/* ── Tira de datos clave ──────────────────────────────────────────── */}
          <dl className="td-panel ax-bug pf-bug ax-rise" style={{ ['--cols' as string]: 4, ...stagger(5) }}>
            <div className="ax-bug-cell">
              <dt className="td-over">Win rate · 30 d</dt>
              <dd className="ax-bug-value pf-tone" data-tone={wrTone(kpiWr)}>
                {kpiPending ? '—' : kpiWr != null ? `${kpiWr}%` : '—'}
              </dd>
              <dd className="pf-bug-hint">{recap ? `${recap.wins}V · ${recap.losses}D` : 'Últimas partidas'}</dd>
            </div>
            <div className="ax-bug-cell">
              <dt className="td-over">KDA medio</dt>
              <dd className="ax-bug-value">{kpiPending ? '—' : (kpiKda ?? '—')}</dd>
              <dd className="pf-bug-hint">{recap ? `${recap.k} / ${recap.d} / ${recap.a}` : 'Kills · Muertes · Asist.'}</dd>
            </div>
            <div className="ax-bug-cell">
              <dt className="td-over">Partidas</dt>
              <dd className="ax-bug-value">{kpiPending ? '—' : (kpiGames ?? '—')}</dd>
              <dd className="pf-bug-hint">Ventana de análisis 30 días</dd>
            </div>
            <div className="ax-bug-cell" data-accent={soloRank ? 'gold' : undefined}>
              <dt className="td-over">Solo / Dúo</dt>
              <dd className="pf-bug-rank">
                {soloRank?.tier && <TierEmblem tier={soloRank.tier} division={soloRank.rank} size={46} showLabel={false} />}
                <div>
                  <div className="ax-bug-value">{summaryLoading && !soloRank ? '—' : (kpiTier || 'Sin clasificar')}</div>
                  <div className="pf-bug-hint">
                    {kpiLp != null ? `${kpiLp} LP` : 'Clasificatoria actual'}
                    {leagueRank?.topPercent != null ? ` · Top ${leagueRank.topPercent}%` : ''}
                  </div>
                </div>
              </dd>
            </div>
          </dl>

          {/* Torneos de ATAK en los que está inscrito: región, posición y rango */}
          <PlayerTournamentsCard
            riotId={gameName && tagLine ? `${gameName}#${tagLine}` : undefined}
            style={{ marginTop: 16 }}
          />

          {/* ── Dos columnas: partidas | rango, roles, campeones, temporadas, compañeros ── */}
          <div className="pf-grid">
            <div className="pf-col">
              <RecentGames
                matches={filtered} loading={matchesLoading && !matches.length}
                recap={recap} filter={filter} setFilter={setFilter}
                champByKey={champByKey} puuid={puuid}
                onLoadMore={loadMore} loadingMore={loadingMore}
                hasMore={loadingMore || matches.length >= count}
                region={platform} continent={continent}
              />
            </div>

            <div className="pf-col">
              <PersonalScore
                solo={soloRank} flex={flexRank}
                loading={summaryLoading && !summary}
                leagueRank={leagueRank}
                opggData={opggData}
                enemyAvg={enemyAvg}
                enemyAvgLoading={enemyAvgQ.isPending}
              />
              <RolePerformance perf={rolePerf} loading={matchesLoading && !matches.length} />
              <ChampionsTable rows={champRows} champByKey={champByKey} loading={matchesLoading && !matches.length} bestPlayers={bestPlayers} region={platform} opggChampStats={opggData?.champion_stats ?? null} puuid={puuid} />
              <SeasonHistory seasons={(opggData as any)?.previous_seasons ?? []} loading={opggQ.isLoading} />
              <RecentlyPlayedWith
                players={teammates} loading={teammatesLoading}
                champByKey={champByKey} region={platform}
              />
            </div>
          </div>

          {/* Comentarios de la comunidad — ancho completo bajo la rejilla. */}
          {puuid && (
            <Panel className="pf-block">
              <ProfileComments puuid={puuid} />
            </Panel>
          )}
        </>
      )}
    </ArenaPage>
  );
}

// ─── Puntuación personal (rango Solo/Dúo destacado) ─────────────────────────
function PersonalScore({ solo, flex, loading, leagueRank, opggData, enemyAvg, enemyAvgLoading }: {
  solo: RankEntry | null; flex: RankEntry | null; loading: boolean;
  leagueRank: { regionalRank: number | null; topPercent: number | null } | null;
  enemyAvg?: { tier: string | null; rank: string | null; sample: number } | null;
  enemyAvgLoading?: boolean;
  opggData?: any;
}) {
  const ladderRank = opggData?.rank?.ladder_rank ?? null;
  const ladderTotal = opggData?.rank?.ladder_total ?? null;
  const seasonPlay = opggData?.season_play ?? 0;
  const seasonWR = opggData?.season_win_rate ?? null;
  const isHotStreak = opggData?.is_hot_streak ?? false;
  const isVeteran = opggData?.is_veteran ?? false;

  return (
    <Panel className="pf-order-1">
      <SectionHead icon={<Trophy size={15} />} title="Puntuación personal" />
      {loading ? (
        <div className="pf-rank">
          <Skel h={96} w={96} style={{ flexShrink: 0 }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Skel h={30} w="60%" /><Skel h={16} w="40%" /><Skel h={8} />
          </div>
        </div>
      ) : solo ? (
        <FeaturedRank rank={solo} leagueRank={leagueRank} />
      ) : (
        <Unranked label="Solo/Dúo sin clasificar" />
      )}

      {/* Posición regional (OP.GG) + pico de la temporada */}
      {ladderRank != null && (
        <div className="td-sub pf-facts">
          <div className="pf-fact" data-wide>
            <div className="td-over">Posición regional</div>
            <b>
              <span className="td-num">#{ladderRank.toLocaleString()}</span>
              {ladderTotal != null && <small>de {(ladderTotal / 1_000_000).toFixed(1)}M</small>}
              {ladderTotal != null && ladderTotal > 0 && (
                <StatusChip kind="gold" dot={false}>
                  TOP {Math.max(0.1, (ladderRank / ladderTotal) * 100) < 1
                    ? ((ladderRank / ladderTotal) * 100).toFixed(1)
                    : Math.round((ladderRank / ladderTotal) * 100)}%
                </StatusChip>
              )}
            </b>
          </div>
          {/* Peak de la temporada por cola (elo más alto alcanzado) */}
          {(opggData?.season_peaks ?? []).map((p: any) => (
            <div key={p.queue} className="pf-fact">
              <div className="td-over">Peak {p.queue === 'FLEXRANKED' ? 'Flex' : 'Solo/Dúo'}</div>
              <b className="pf-tone" data-tone="gold">
                {`${p.tier[0]}${p.tier.slice(1).toLowerCase()} ${p.division ?? ''}`.trim()}
              </b>
            </div>
          ))}
          {seasonPlay > 0 && (
            <div className="pf-fact">
              <div className="td-over">Partidas temporada</div>
              <b>
                <span className="td-num">{seasonPlay}</span>
                {seasonWR != null && <small className="pf-tone" data-tone={wrTone(seasonWR)}>{seasonWR}% WR</small>}
              </b>
            </div>
          )}
          {(isHotStreak || isVeteran) && (
            <div className="pf-fact-chips">
              {isHotStreak && <StatusChip kind="pos">Racha ganadora</StatusChip>}
              {isVeteran && <StatusChip kind="gold" dot={false}>Veterano</StatusChip>}
            </div>
          )}
        </div>
      )}

      {/* Flex + elo promedio de los rivales */}
      <div className="pf-rank-duo">
        <MiniRank label="Flex" rank={flex} loading={loading} />
        <EnemyAvgSlot data={enemyAvg} loading={enemyAvgLoading} />
      </div>
    </Panel>
  );
}

function FeaturedRank({ rank, leagueRank }: {
  rank: RankEntry;
  leagueRank?: { regionalRank: number | null; topPercent: number | null } | null;
}) {
  const wins = rank.wins || 0, losses = rank.losses || 0;
  const total = wins + losses;
  const wr = total ? Math.round((wins / total) * 100) : 0;
  return (
    <div className="pf-rank">
      <TierEmblem tier={rank.tier} division={rank.rank} lp={rank.lp} size={104} showLabel={false} />
      <div className="pf-rank-info">
        <div className="td-over">Solo / Dúo</div>
        <div className="pf-rank-tier">{tierName(rank.tier)} {rank.rank}</div>
        <div className="pf-rank-lp td-num">{rank.lp} LP</div>
        {(leagueRank?.regionalRank != null || leagueRank?.topPercent != null) && (
          <div className="pf-rank-meta">
            {leagueRank?.regionalRank != null && (
              <span>Rank regional: <b className="td-num">#{fmtNumber(leagueRank.regionalRank)}</b></span>
            )}
            {leagueRank?.topPercent != null && (
              <span>Top %: <b className="td-num">{leagueRank.topPercent}%</b></span>
            )}
          </div>
        )}
        <div className="pf-wl td-num">
          <span className="pf-tone" data-tone="pos">{wins}V</span>
          <span className="pf-tone" data-tone="neg">{losses}D</span>
          <ProgressBar kind="wr" pct={wr} />
          <span className="pf-tone" data-tone={wrTone(wr)}>{wr}%</span>
        </div>
      </div>
    </div>
  );
}

function MiniRank({ label, rank, loading }: { label: string; rank: RankEntry | null; loading: boolean }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div className="td-over">{label}</div>
      {loading ? <Skel h={22} w="70%" style={{ marginTop: 12 }} /> : rank ? (
        <div className="pf-minirank">
          <TierEmblem tier={rank.tier} division={rank.rank} lp={rank.lp} size={56} showLabel={false} />
          <div style={{ minWidth: 0 }}>
            <div className="pf-minirank-tier">{tierName(rank.tier)} {rank.rank}</div>
            <div className="pf-minirank-sub td-num">{rank.lp} LP</div>
          </div>
        </div>
      ) : (
        <div className="pf-minirank">
          <div className="pf-minirank-tier pf-tone" data-tone="dim">Sin clasificar</div>
        </div>
      )}
    </div>
  );
}

// Elo promedio de los rivales de los últimos 30 días (mismo lenguaje que MiniRank).
function EnemyAvgSlot({ data, loading }: {
  data?: { tier: string | null; rank: string | null; sample: number } | null;
  loading?: boolean;
}) {
  const tier = data?.tier ?? null;
  return (
    <div style={{ minWidth: 0 }}>
      <div className="td-over">Promedio enemigos</div>
      {loading ? <Skel h={22} w="70%" style={{ marginTop: 12 }} /> : tier ? (
        <div className="pf-minirank">
          <TierEmblem tier={tier} division={data?.rank} size={56} showLabel={false} />
          <div style={{ minWidth: 0 }}>
            <div className="pf-minirank-tier">{tierName(tier)}{data?.rank ? ` ${data.rank}` : ''}</div>
            <div className="pf-minirank-sub">últimos 30 días · {data?.sample} rivales</div>
          </div>
        </div>
      ) : (
        <div className="pf-minirank">
          <div>
            <div className="pf-minirank-tier pf-tone" data-tone="dim">—</div>
            <div className="pf-minirank-sub">Sin ranked reciente</div>
          </div>
        </div>
      )}
    </div>
  );
}

function Unranked({ label }: { label: string }) {
  return (
    <div className="pf-rank">
      <TierEmblem tier={null} size={72} showLabel={false} />
      <div className="pf-rank-info">
        <div className="pf-minirank-tier">{label}</div>
        <div className="pf-minirank-sub">Juega partidas clasificatorias</div>
      </div>
    </div>
  );
}

// ─── Partidas recientes ─────────────────────────────────────────────────────
type QueueFilter = 'all' | 420 | 440 | 450;
const QUEUE_PILLS: { key: string; label: string }[] = [
  { key: 'all', label: 'Todas' }, { key: '420', label: 'Solo/Dúo' },
  { key: '440', label: 'Flex' }, { key: '450', label: 'ARAM' },
];

function RecentGames({
  matches, loading, recap, filter, setFilter, champByKey, puuid, onLoadMore, loadingMore, hasMore, region, continent,
}: {
  matches: any[]; loading: boolean; recap: any;
  filter: QueueFilter; setFilter: (f: any) => void;
  champByKey: any; puuid?: string; onLoadMore: () => void; loadingMore: boolean; hasMore: boolean;
  region: string; continent: string;
}) {
  return (
    <Panel className="pf-order-2 pf-games">
      <SectionHead
        size="lg"
        icon={<Swords size={19} />}
        title="Partidas recientes"
        right={
          <FilterPills
            ariaLabel="Filtrar partidas por cola"
            items={QUEUE_PILLS}
            value={String(filter)}
            onChange={(k) => setFilter(k === 'all' ? 'all' : Number(k))}
          />
        }
      />

      {/* Resumen de la ventana de análisis */}
      {recap && (
        <div className="pf-recap">
          <div>
            <div className="td-over">Últimos 30 días · {recap.n} partidas</div>
            <div className="pf-recap-value td-num">
              <span className="pf-tone" data-tone="pos">{recap.wins}V</span>{' '}
              <span className="pf-tone" data-tone="neg">{recap.losses}D</span>
            </div>
          </div>
          <div>
            <div className="td-over">KDA prom.</div>
            <div className="pf-recap-value td-num">
              {recap.k} / <span className="pf-tone" data-tone="neg">{recap.d}</span> / {recap.a}{' '}
              <small>({recap.kda})</small>
            </div>
          </div>
          <div className="pf-recap-bar">
            <div className="td-over" style={{ marginBottom: 8 }}>Victorias {recap.wr}%</div>
            <ProgressBar kind="wr" pct={recap.wr} />
          </div>
        </div>
      )}

      {loading ? (
        <div className="pf-matches">
          {Array.from({ length: 5 }).map((_, i) => <Skel key={i} h={76} style={{ borderRadius: 8 }} />)}
        </div>
      ) : matches.length === 0 ? (
        <p className="pf-note" style={{ padding: '24px 0', textAlign: 'center' }}>
          No hay partidas recientes para este filtro.
        </p>
      ) : (
        <div className="pf-matches">
          {matches.map((m, i) => <MatchRowMini key={m.matchId} m={m} champByKey={champByKey} puuid={puuid} region={region} continent={continent} index={i} />)}
        </div>
      )}

      {hasMore && matches.length > 0 && (
        <div className="pf-more">
          <Button variant="secondary" onClick={onLoadMore} disabled={loadingMore}>
            {loadingMore ? 'Cargando…' : 'Cargar más'}
          </Button>
        </div>
      )}
    </Panel>
  );
}

function timeAgo(ms?: number) {
  if (!ms) return '';
  const diff = Date.now() - ms;
  const m = Math.floor(diff / 60000);
  if (m < 60) return `hace ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h}h`;
  const d = Math.floor(h / 24);
  return `hace ${d}d`;
}

function MatchRowMini({ m, champByKey, puuid, region, continent, index = 0 }: {
  m: any; champByKey: any; puuid?: string; region: string; continent: string; index?: number;
}) {
  const navigate = useNavigate();
  const c = champByKey?.[String(m.championId)];
  const minutes = Math.max(1, Math.floor((m.gameDuration || 0) / 60));
  const cs = m.cs ?? 0;
  const csPerMin = (cs / minutes).toFixed(1);
  const kp = m.killParticipation != null ? Math.round(m.killParticipation * 100) : null;
  const kda = m.deaths === 0 ? (m.kills + m.assists).toFixed(2) : ((m.kills + m.assists) / m.deaths).toFixed(2);
  const spells: number[] = m.summonerSpells || [];
  const win = m.win;

  // 5v5 team comp mini-grid
  const myTeamId = m.teamParticipants?.find((x: any) => x.puuid === puuid)?.teamId;
  const team1 = (m.teamParticipants || []).filter((p: any) => p.teamId === (myTeamId ?? 100));
  const team2 = (m.teamParticipants || []).filter((p: any) => p.teamId !== (myTeamId ?? 100));
  const isSR = (m.teamParticipants || []).length === 10;

  const openDetail = () =>
    navigate(`/match/${continent}/${m.matchId}`, { state: { puuid, region } });

  // ── Solo presentación ──
  // Carril de la partida (icono de LoL); ARAM y modos sin carriles no llevan.
  const role = isSR && m.queueId !== 450 ? toRole(m) : null;
  const level = m.champLevel ?? m.championLevel;
  // El backend manda las runas en formato Match-V5 (perks.styles[]); los campos
  // planos se siguen leyendo primero por si el payload los trae.
  const keystoneId: number | undefined = m.perks?.keystoneId ?? m.perks?.styles?.[0]?.selections?.[0]?.perk;
  const subStyleId: number | undefined = m.perks?.secondaryStyleId ?? m.perks?.styles?.[1]?.style;
  const keystoneUrl = keystoneId ? keystoneIcon(keystoneId) : '';
  const subStyleUrl = subStyleId ? runePathIcon(subStyleId) : '';
  const duration = m.gameDuration || 0;
  const clock = `${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, '0')}`;
  const items: number[] = Array.from({ length: 6 }, (_, i) => (m.items || [])[i] ?? 0);
  const trinket: number = m.trinket ?? 0;
  const augments: number[] = (m.playerAugments as number[] | undefined) || [];
  const kdaTone: Tone = Number(kda) >= 3 ? 'gold' : Number(kda) >= 2 ? undefined : 'dim';
  const queue = queueName(m.queueId, m.gameMode);

  return (
    <div
      className="pf-match ax-rise"
      style={stagger(Math.min(index, 8))}
      data-win={win ? 'true' : 'false'}
      role="link"
      tabIndex={0}
      title="Ver detalle de la partida"
      aria-label={`${win ? 'Victoria' : 'Derrota'} con ${c?.name || 'campeón'} · ${queue} · ${m.kills}/${m.deaths}/${m.assists}. Ver detalle de la partida`}
      onClick={openDetail}
      onKeyDown={(e) => { if (e.key === 'Enter' && e.target === e.currentTarget) openDetail(); }}
    >
      {/* Campeón + hechizos + runas */}
      <div className="pf-m-champ">
        <span className="pf-m-portrait">
          {c?.image ? <ChampIcon src={c.image} size={56} /> : <Skel h={56} w={56} style={{ animation: 'none' }} />}
          {level ? <span className="pf-m-lvl td-num">{level}</span> : null}
        </span>
        <span className="pf-m-loadout">
          {[0, 1].map((i) => {
            const url = spells[i] != null ? spellIcon(spells[i]) : '';
            return url ? <img key={i} src={url} alt="" loading="lazy" onError={hideImg} /> : <span key={i} />;
          })}
          {keystoneUrl ? (
            <Tip label={`Keystone: ${keystoneId}`}>
              <img data-rune="main" src={keystoneUrl} alt="" loading="lazy" onError={hideImg} />
            </Tip>
          ) : null}
          {subStyleUrl ? <img data-rune="sub" src={subStyleUrl} alt="" loading="lazy" onError={hideImg} /> : null}
        </span>
      </div>

      {/* Resultado + cola */}
      <div className="pf-m-result">
        <span className="pf-m-outcome">{win ? 'Victoria' : 'Derrota'}</span>
        <span className="pf-m-queue">
          {role && <RoleIcon lane={ROLE_LANE[role]} size={16} title={role} />}
          {queue}
        </span>
        <span className="pf-m-when td-num">{timeAgo(m.gameStartTimestamp)} · {clock}</span>
      </div>

      {/* KDA */}
      <Tip label="Asesinatos / Muertes / Asistencias (KDA)">
        <div className="pf-m-kda">
          <b className="td-num">{m.kills}<u>/</u><i>{m.deaths}</i><u>/</u>{m.assists}</b>
          <span className="pf-m-sub td-num">
            <strong className="pf-tone" data-tone={kdaTone}>{kda} KDA</strong>
            {kp != null ? ` · KP ${kp}%` : ''}
          </span>
        </div>
      </Tip>

      {/* Súbditos + oro */}
      <Tip label={`Súbditos (por minuto)${m.gold != null ? ' · Oro obtenido' : ''}`}>
        <div className="pf-m-farm td-num">
          <span><UiIcon name="minion" size={18} /><b>{cs}</b> ({csPerMin}/min)</span>
          {m.gold != null && <span><UiIcon name="gold" size={18} /><b>{fmtNumber(m.gold)}</b></span>}
        </div>
      </Tip>

      {/* Objetos (6) + talismán; aumentos de Arena cuando existen */}
      <div className="pf-m-items">
        {items.map((id, i) => (
          id > 0
            ? <img key={i} src={dd.item(id)} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.opacity = '0'; }} />
            : <span key={i} />
        ))}
        {trinket > 0
          ? <img data-trinket src={dd.item(trinket)} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.opacity = '0'; }} />
          : <span data-trinket />}
        {augments.map((id, i) => (
          <span key={`a${i}`} className="pf-m-aug" title={`Augment ${id}`}>A{i + 1}</span>
        ))}
      </div>

      {/* Los diez jugadores: aliados | rivales, con enlace a su perfil */}
      {isSR && (
        <div className="pf-m-teams">
          {[team1, team2].map((teamArr, ti) => (
            <div key={ti} className="pf-m-team" data-side={ti === 0 ? 'ally' : 'enemy'}>
              {teamArr.slice(0, 5).map((p: any, i: number) => {
                const pc = champByKey?.[String(p.championId)];
                const isMe = p.puuid === puuid;
                const href = profileHref(region, p.gameName ?? p.summonerName, p.tagLine);
                const pname = p.gameName || p.summonerName || '';
                const inner = (
                  <>
                    <img src={pc?.image} alt="" loading="lazy" onError={hideImg} />
                    <span>{pname}</span>
                  </>
                );
                return href ? (
                  <Link key={i} to={href} className="pf-m-player" data-me={isMe}
                    onClick={(e) => e.stopPropagation()} title={`Ver perfil de ${pname}`}>
                    {inner}
                  </Link>
                ) : <div key={i} className="pf-m-player" data-me={isMe}>{inner}</div>;
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Historial de temporadas (OP.GG MCP: elo final por season) ──────────────
const ROMAN = ['', 'I', 'II', 'III', 'IV'];
const TIER_ORDER: Record<string, number> = {
  CHALLENGER: 10, GRANDMASTER: 9, MASTER: 8, DIAMOND: 7, EMERALD: 6,
  PLATINUM: 5, GOLD: 4, SILVER: 3, BRONZE: 2, IRON: 1,
};
type SeasonEntry = { season_id: number; display?: string; tier: string | null; division: number | null; lp: number | null; tier_image_url?: string | null };
// Valor comparable: tier > división (menor es mejor) > LP
const seasonScore = (s: SeasonEntry) =>
  (TIER_ORDER[s.tier ?? ''] ?? 0) * 10_000 + (5 - (s.division ?? 4)) * 1_000 + (s.lp ?? 0);

function SeasonHistory({ seasons, loading }: { seasons: SeasonEntry[]; loading: boolean }) {
  const peakId = useMemo(() => {
    if (!seasons.length) return null;
    return [...seasons].sort((a, b) => seasonScore(b) - seasonScore(a))[0].season_id;
  }, [seasons]);
  if (!loading && !seasons.length) return null;
  const fmtTier = (t: string | null) => t ? t[0] + t.slice(1).toLowerCase() : '—';

  return (
    <Panel>
      <SectionHead icon={<History size={15} />} title="Historial de temporadas" />
      {loading ? (
        <div className="pf-seasons">
          {Array.from({ length: 4 }).map((_, i) => <Skel key={i} h={104} w="100%" style={{ borderRadius: 8 }} />)}
        </div>
      ) : (
        <div className="pf-seasons">
          {seasons.map((s) => {
            const isPeak = s.season_id === peakId;
            const tierText = `${fmtTier(s.tier)} ${ROMAN[s.division ?? 0] ?? ''}`.trim();
            return (
              // Detalle en tooltip (OP.GG solo conserva Solo/Dúo por temporada)
              <Tip
                key={s.season_id}
                label={
                  <span style={{ display: 'block', lineHeight: 1.6 }}>
                    <b>Season {s.display || s.season_id}{isPeak ? ' · Peak histórico' : ''}</b><br />
                    Solo/Dúo: {tierText} · {s.lp ?? 0} LP<br />
                    <span style={{ opacity: 0.6 }}>Flex: sin histórico (OP.GG solo conserva Solo/Dúo)</span>
                  </span>
                }
              >
                <div className="td-sub pf-season" data-peak={isPeak} tabIndex={0}>
                  {isPeak && <span className="pf-season-peak">Peak</span>}
                  <span className="td-over">S{s.display || s.season_id}</span>
                  {s.tier_image_url
                    ? <img src={s.tier_image_url} alt={s.tier ?? ''} loading="lazy"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).src = rankEmblem(s.tier ?? ''); }} />
                    : <img src={rankEmblem(s.tier ?? '')} alt="" loading="lazy" />}
                  <b>{tierText}</b>
                </div>
              </Tip>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

// ─── Jugó recientemente con ─────────────────────────────────────────────────
function RecentlyPlayedWith({ players, loading, champByKey, region }: {
  players: any[] | null; loading: boolean; champByKey: any; region: string;
}) {
  return (
    <Panel>
      <SectionHead icon={<Users size={15} />} title="Jugó recientemente con" />
      {loading && !players ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {Array.from({ length: 5 }).map((_, i) => <Skel key={i} h={44} />)}
        </div>
      ) : !players || players.length === 0 ? (
        <p className="pf-note">Sin compañeros recurrentes en las últimas partidas.</p>
      ) : (
        <div className="pf-mates">
          {players.map((p) => {
            const href = profileHref(region, p.gameName, p.tagLine);
            const wr = p.winRate;
            const topCid = p.champions?.[0]?.championId;
            const tc = topCid != null ? champByKey?.[String(topCid)] : null;
            const inner = (
              <>
                {tc?.image
                  ? <ChampIcon src={tc.image} size={38} />
                  : <Skel h={38} w={38} style={{ animation: 'none', flexShrink: 0 }} />}
                <div className="pf-mate-main">
                  <div className="pf-mate-name">
                    {p.gameName}<span>{p.tagLine ? ` #${p.tagLine}` : ''}</span>
                  </div>
                  <div className="pf-sub">
                    {p.games} {p.games === 1 ? 'partida' : 'partidas'} juntos
                  </div>
                </div>
                <div className="pf-mate-side">
                  {wr != null
                    ? <b className="td-num pf-tone" data-tone={wrTone(wr)}>{wr}%</b>
                    : <b className="pf-tone" data-tone="dim">—</b>}
                  <span className="pf-sub td-num">{p.asAlly} aliado · {p.asEnemy} rival</span>
                </div>
              </>
            );
            return href ? (
              <Link key={p.puuid} to={href} className="pf-mate">{inner}</Link>
            ) : (
              <div key={p.puuid} className="pf-mate">{inner}</div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

// ─── Rendimiento por rol ────────────────────────────────────────────────────
function RolePerformance({ perf, loading }: { perf: Record<Role, { games: number; wins: number }>; loading: boolean }) {
  const total = ROLES.reduce((s, r) => s + perf[r].games, 0);
  return (
    <Panel>
      <SectionHead icon={<Compass size={15} />} title="Rendimiento por rol" />
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {Array.from({ length: 5 }).map((_, i) => <Skel key={i} h={26} />)}
        </div>
      ) : total === 0 ? (
        <p className="pf-note">Sin datos de roles.</p>
      ) : (
        <table className="ax-table pf-table">
          <thead>
            <tr><th>Rol</th><th>Partidas</th><th>Tasa de victorias</th></tr>
          </thead>
          <tbody>
            {ROLES.map((r) => {
              const d = perf[r];
              const wr = d.games ? Math.round((d.wins / d.games) * 100) : 0;
              return (
                <tr key={r}>
                  <td>
                    <span className="pf-role">
                      <RoleIcon lane={ROLE_LANE[r]} size={22} style={{ opacity: d.games ? 1 : 0.45 }} />
                      {r}
                    </span>
                  </td>
                  <td className="td-num pf-tone" data-tone={d.games ? undefined : 'dim'}>{d.games}</td>
                  <td>
                    <div className="pf-wr">
                      <ProgressBar kind="wr" pct={d.games ? wr : 0} />
                      <span className="td-num pf-tone" data-tone={d.games ? wrTone(wr) : 'dim'}>
                        {d.games ? `${wr}%` : '—'}
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </Panel>
  );
}

// ─── Campeones de la temporada ──────────────────────────────────────────────
function ChampionsTable({ rows, champByKey, loading, bestPlayers, region, opggChampStats, puuid }: {
  rows: any[]; champByKey: any; loading: boolean;
  bestPlayers?: Record<string, any> | null; region: string;
  opggChampStats?: any[] | null;
  puuid?: string;
}) {
  const [showAll, setShowAll] = useState(false);

  // Ranking ATAK por campeón (estilo League of Graphs): posición por puntos
  // de maestría dentro de la base ATAK — regional y global. La base crece
  // con cada perfil visitado.
  const ranksQ = useQuery({
    queryKey: ['champion-ranks', region, puuid],
    enabled: !!puuid,
    staleTime: 5 * 60_000,
    retry: false,
    queryFn: async () => {
      const { data } = await axiosInstance.get(`/api/stats/champion-ranks/${region}/${puuid}`);
      return data as { ranks: Array<{ championId: number; points: number; regionRank: number; regionTotal: number; globalRank: number; globalTotal: number }> };
    },
  });
  const rankByChampId = useMemo(() => {
    const m = new Map<number, { points: number; regionRank: number; regionTotal: number; globalRank: number; globalTotal: number }>();
    for (const r of ranksQ.data?.ranks || []) m.set(r.championId, r);
    return m;
  }, [ranksQ.data]);

  // Build name → DDragon champion lookup (for OP.GG name matching)
  const champByName = useMemo(() => {
    if (!champByKey) return {};
    const m: Record<string, any> = {};
    Object.values(champByKey).forEach((c: any) => {
      const key = (c.name || '').toLowerCase().replace(/[_'\s.&]/g, '');
      m[key] = c;
    });
    return m;
  }, [champByKey]);

  // Build display rows: OP.GG (all-season) as primary; local matches as fallback
  const displayRows = useMemo(() => {
    if (opggChampStats?.length) {
      return [...opggChampStats]
        .filter((cs: any) => cs.play > 0)
        .sort((a: any, b: any) => b.play - a.play)
        .map((cs: any) => {
          const nameKey = cs.champion_name.toLowerCase().replace(/[_'\s.&]/g, '');
          const champData = champByName[nameKey];
          const play = cs.play || 1;
          const wr = Math.round((cs.win / play) * 100);
          // OP.GG always returns career totals for kill/death/assist — divide by play
          const avgK = parseFloat((cs.kill   / play).toFixed(1));
          const avgD = parseFloat((cs.death  / play).toFixed(1));
          const avgA = parseFloat((cs.assist / play).toFixed(1));
          const kda = avgD === 0 ? '∞' : ((avgK + avgA) / avgD).toFixed(2);
          return { champData, championName: cs.champion_name, play: cs.play, win: cs.win, lose: cs.lose, wr, kda, avgK, avgD, avgA, serverRank: cs.server_rank ?? null };
        });
    }
    // Fallback: rows from local match history
    return rows.map((r: any) => {
      const c = champByKey?.[String(r.id)];
      return { champData: c, championName: c?.name || String(r.id), play: r.games, win: Math.round(r.games * r.wr / 100), lose: r.games - Math.round(r.games * r.wr / 100), wr: r.wr, kda: r.kda };
    });
  }, [opggChampStats, rows, champByKey, champByName]);

  const visibleRows = showAll ? displayRows : displayRows.slice(0, 8);
  const usingOpgg = (opggChampStats?.length ?? 0) > 0;

  return (
    <Panel>
      <SectionHead
        icon={<BarChart3 size={15} />}
        title={`Campeones · ${usingOpgg ? 'Clasificatoria' : 'Solo/Dúo'}`}
        right={usingOpgg ? <span className="td-over">Toda la temporada</span> : undefined}
      />
      {loading && !displayRows.length ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {Array.from({ length: 4 }).map((_, i) => <Skel key={i} h={40} />)}
        </div>
      ) : displayRows.length === 0 ? (
        <p className="pf-note">Sin campeones clasificados aún.</p>
      ) : (
        <>
          <div className="ax-table-scroll">
            <table className="ax-table pf-table pf-champs">
              <thead>
                <tr><th>Campeón</th><th>KDA</th><th>Partidas · WR</th><th>Mejor jug.</th></tr>
              </thead>
              <tbody>
                {visibleRows.map((r: any, idx: number) => {
                  const c = r.champData;
                  // Best player for this champ (from local match data — best by champion ID)
                  const localId = c ? Object.keys(champByKey || {}).find(k => champByKey[k] === c) : null;
                  const best = localId ? bestPlayers?.[localId] : null;
                  const bestTier = best?.tier ? `${best.tier[0]}${best.tier.slice(1).toLowerCase()} ${best.rank || ''}`.trim() : null;
                  const bestHref = best ? profileHref(region, best.gameName, best.tagLine) : null;
                  const bestInner = best ? (
                    <>
                      <b>{best.gameName}</b>
                      {bestTier && <small>{bestTier}</small>}
                    </>
                  ) : null;
                  const ar = c?.key != null ? rankByChampId.get(Number(c.key)) : null;
                  const top1 = !!ar && (ar.regionRank === 1 || ar.globalRank === 1);
                  const kdaTone: Tone = r.kda === '∞' || Number(r.kda) >= 3 ? 'gold' : Number(r.kda) >= 2 ? undefined : 'dim';

                  return (
                    <tr
                      key={r.championName + idx}
                      data-click={c ? 'true' : undefined}
                      title={c ? `Ver análisis de ${c.name}` : undefined}
                      tabIndex={c ? 0 : undefined}
                      onClick={(e) => {
                        if ((e.target as HTMLElement).closest('a')) return; // respeta el link de "mejor jugador"
                        if (c?.id) window.location.assign(`/champion/${c.id}`);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && e.target === e.currentTarget && c?.id) window.location.assign(`/champion/${c.id}`);
                      }}
                    >
                      {/* Campeón + K/D/A medio */}
                      <td>
                        <div className="pf-champ-cell">
                          {c?.image
                            ? <ChampIcon src={c.image} size={38} />
                            : <Skel h={38} w={38} style={{ animation: 'none', flexShrink: 0 }} />}
                          <div>
                            <span className="pf-champ-name">
                              {c?.name || r.championName.toLowerCase().replace(/\b\w/g, (s: string) => s.toUpperCase()).replace(/_/g, ' ')}
                            </span>
                            {usingOpgg && r.avgK != null && (
                              <span className="pf-sub td-num">{r.avgK} / <i>{r.avgD}</i> / {r.avgA}</span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* KDA */}
                      <td className="td-num pf-tone" data-tone={kdaTone} style={{ fontSize: 15.5, fontWeight: 700 }}>{r.kda}</td>

                      {/* Partidas + WR + rankings (OP.GG servidor + ranking ATAK) */}
                      <td>
                        <div className="td-num" style={{ whiteSpace: 'nowrap' }}>
                          {r.play}P · <b className="pf-tone" data-tone={wrTone(r.wr)}>{r.wr}%</b>
                        </div>
                        {r.serverRank != null ? (
                          <span className="pf-sub td-num">#{r.serverRank.toLocaleString()} servidor</span>
                        ) : (
                          <span className="pf-sub td-num">{r.win}V · {r.lose}D</span>
                        )}
                        {ar && (
                          <div
                            className="pf-atak-rank td-num"
                            data-top={top1}
                            title={`Ranking ATAK.GG por puntos de maestría (${ar.points.toLocaleString()} pts) entre los invocadores de la comunidad — crece con cada perfil visitado`}
                          >
                            {top1 && <Crown size={12} aria-hidden />}
                            #{ar.regionRank.toLocaleString()} {region.toUpperCase().replace(/\d+$/, '')}
                            <span style={{ opacity: 0.5 }}>·</span>
                            #{ar.globalRank.toLocaleString()} Global
                            <span style={{ opacity: 0.55 }}>ATAK</span>
                          </div>
                        )}
                      </td>

                      {/* Mejor jugador con ese campeón */}
                      <td>
                        {bestHref ? (
                          <Link to={bestHref} className="pf-best" title={`Mejor con ${c?.name || ''}`}>{bestInner}</Link>
                        ) : bestInner ? (
                          <span className="pf-best">{bestInner}</span>
                        ) : (
                          <span className="pf-tone" data-tone="dim">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {displayRows.length > 8 && (
            <div className="pf-more" style={{ marginTop: 12 }}>
              <Button
                variant="ghost"
                icon={showAll ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                onClick={() => setShowAll((s) => !s)}
              >
                {showAll ? 'Mostrar menos' : `Ver todos los ${displayRows.length} campeones`}
              </Button>
            </div>
          )}
        </>
      )}
    </Panel>
  );
}
