// src/pages/SummonerPage.tsx
import { useEffect, useMemo, useState, useRef } from "react";
import { useLocation, useParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Bot, Zap, Crown, Swords, Target, TrendingUp, Clock, Skull, Shield } from "lucide-react";
import { axiosInstance } from "@/lib/axios";
import axios from "axios";
import { useChampions, useStaticData } from "@/hooks/use-ddragon";
import { MatchRow } from "@/components/MatchRow";
import { motion } from "framer-motion";

// ---------- Tipos auxiliares ----------
type Platform = "la1" | "la2" | "na1" | "br1" | "oc1" | "euw1" | "eun1" | "tr1" | "ru" | "jp1" | "kr";
type Continent = "americas" | "europe" | "asia";
type MatchDetail = {
  matchId: string;
  championId: number;
  championName: string;
  win: boolean;
  kills: number;
  deaths: number;
  assists: number;
  kda: number;
  gameDuration: number;
  gameMode: string;
  gameStartTimestamp: number;
  items: number[];
  role: string;
  lane: string;
  totalMinionsKilled?: number;
};

const CDRAGON = "https://raw.communitydragon.org/latest";
const championSquare = (champKey?: number | string) =>
  champKey != null ? `${CDRAGON}/plugins/rcp-be-lol-game-data/global/default/v1/champion-icons/${champKey}.png` : "";
const RANKED_EMBLEM = (tier?: string) =>
  tier ? `https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/images/ranked-emblems/emblem-${tier.toLowerCase()}.png` : "";

const normalizePlatform = (pf?: string): Platform | undefined => {
  if (!pf) return undefined;
  const p = pf.toLowerCase();
  if (p === "la1") return "la1";
  if (p === "la2" || p === "las" || p === "la") return "la2";
  return p as Platform;
};
const platformToContinent = (pf: Platform): Continent => {
  if (["la1", "la2", "na1", "br1"].includes(pf)) return "americas";
  if (["euw1", "eun1", "tr1", "ru"].includes(pf)) return "europe";
  return "asia";
};
const splitRiotId = (s: string) => {
  const [gameName = "", tagLine = ""] = decodeURIComponent(s).split("#");
  return { gameName, tagLine };
};

export default function SummonerPage() {
  const { data: champs } = useChampions();
  const staticData = useStaticData();
  const { region, riotId } = useParams<{ region: string; riotId: string }>();
  const platform = normalizePlatform(region);
  const continent: Continent = platform ? platformToContinent(platform) : "americas";
  const { state } = useLocation() as { state?: { puuid?: string } };
  const { gameName, tagLine } = splitRiotId(riotId || "");
  const [puuid, setPuuid] = useState<string | undefined>(state?.puuid);
  const [summary, setSummary] = useState<any>(null);
  const [matchHistory, setMatchHistory] = useState<MatchDetail[]>([]);
  const [championStats, setChampionStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // IA states
  const [aiTags, setAiTags] = useState<string[]>([]);
  const [matchTags, setMatchTags] = useState<{ [key: string]: string[] }>({});
  const [loadingAI, setLoadingAI] = useState(false);
  const [loadingMatchTags, setLoadingMatchTags] = useState(false); // Nuevo estado

  const [personalScore, setPersonalScore] = useState<number>(0);

  // Spotlight
  const sectionRef = useRef<HTMLDivElement>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (sectionRef.current) {
      const rect = sectionRef.current.getBoundingClientRect();
      setMousePosition({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }
  };

  // Icono de invocador
  const profileIconUrl = summary?.summoner?.profileIconId && champs?.version
    ? `https://ddragon.leagueoflegends.com/cdn/${champs.version}/img/profileicon/${summary.summoner.profileIconId}.png`
    : null;




    const safeTagString = (tag: any): string => {
  if (typeof tag === 'string') return tag;
  if (tag && typeof tag === 'object') {
    // Si es objeto con Label/Value, prioriza Label
    if ('Label' in tag && typeof tag.Label === 'string') return tag.Label;
    if ('Value' in tag && typeof tag.Value === 'string') return tag.Value;
    // Último recurso: stringify
    return String(tag);
  }
  return 'Tag inválido';
};

  // Fetch puuid
  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      if (!puuid && platform && gameName && tagLine) {
        try {
          const { data } = await axiosInstance.get("/api/stats/resolve", {
            params: { region: platform, gameName, tagLine },
            signal: ac.signal,
          });
          setPuuid(data.puuid);
        } catch (e) {
          console.error("[SUMMONER] resolve error", e);
        }
      }
    })();
    return () => ac.abort();
  }, [puuid, platform, gameName, tagLine]);

  // Fetch summary y champion stats
  useEffect(() => {
    if (!puuid || !platform) return;
    const ac = new AbortController();
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    (async () => {
      try {
        setIsLoading(true);
        const sum = await axiosInstance.get(`/api/stats/summary/${platform}/${puuid}`, { signal: ac.signal });
        setSummary(sum.data);
        await sleep(150);
        const chstats = await axiosInstance.get(`/api/stats/champion-stats/${platform}/${puuid}`, {
          params: { count: 12 },
          validateStatus: () => true,
          signal: ac.signal,
        });
        setChampionStats(chstats.status === 200 ? chstats.data : null);
      } catch (e) {
        console.warn("[SUMMONER] load warn", e);
      } finally {
        setIsLoading(false);
      }
    })();
    return () => ac.abort();
  }, [puuid, platform]);

  // Fetch match history
  useEffect(() => {
    if (!puuid || !platform) return;
    const ac = new AbortController();
    (async () => {
      try {
        const { data: matchIds } = await axiosInstance.get(`/api/stats/matches/${continent}/${puuid}/ids`, {
          params: { count: 5 },
          signal: ac.signal,
        });
        const settled = await Promise.allSettled(
          (matchIds || []).slice(0, 5).map((matchId: string) =>
            axiosInstance.get(`/api/stats/matches/${continent}/${matchId}`, { params: { puuid }, signal: ac.signal })
          )
        );
        const details: MatchDetail[] = settled
          .filter((r): r is PromiseFulfilledResult<any> => r.status === "fulfilled")
          .map((r) => r.value.data);
        setMatchHistory(details);
      } catch (e) {
        console.error("[SUMMONER] match history error", e);
      }
    })();
    return () => ac.abort();
  }, [puuid, platform, continent]);

  // Cálculos generales
  const overallStats = useMemo(() => {
    if (!matchHistory.length) return null;
    const totalGames = matchHistory.length;
    const wins = matchHistory.filter((m) => m.win).length;
    const winRate = (wins / totalGames) * 100;
    const avgKills = matchHistory.reduce((s, m) => s + m.kills, 0) / totalGames;
    const avgDeaths = matchHistory.reduce((s, m) => s + m.deaths, 0) / totalGames;
    const avgAssists = matchHistory.reduce((s, m) => s + m.assists, 0) / totalGames;
    const avgKDA = (avgKills + avgAssists) / Math.max(avgDeaths, 1);
    return {
      totalGames,
      wins,
      losses: totalGames - wins,
      winRate,
      avgKills: avgKills.toFixed(1),
      avgDeaths: avgDeaths.toFixed(1),
      avgAssists: avgAssists.toFixed(1),
      avgKDA: avgKDA.toFixed(2),
    };
  }, [matchHistory]);

  const mainRank = useMemo(() => {
    if (!summary?.rank) return null;
    return summary.rank.find((r: any) => r.queue === "RANKED_SOLO_5x5") || summary.rank[0] || null;
  }, [summary]);

  const rankBadge = mainRank ? `${mainRank.tier} ${mainRank.rank} - ${mainRank.lp} LP` : "Sin clasificar";

  // Personal Score
  useEffect(() => {
    if (overallStats) {
      const score = Math.round(
        (overallStats.winRate * 0.5) +
        (parseFloat(overallStats.avgKDA) * 10 * 0.3) +
        20
      );
      setPersonalScore(Math.min(100, Math.max(0, score)));
    }
  }, [overallStats]);

  // IA global tags
  useEffect(() => {
    if (!summary || !matchHistory.length || !championStats) return;

    const fetchAITags = async () => {
      setLoadingAI(true);
      try {
        const topChamps = Object.entries(championStats)
          .slice(0, 3)
          .map(([id, s]: [string, any]) => {
            const champ = champs?.byKey[id];
            return `${champ?.name || id} (${s.winRate}% WR)`;
          })
          .join(', ');

        const response = await axios.post('http://192.168.1.14:4000/api/ai-insights', {
          riotId: `${gameName}#${tagLine}`,
          region: platform?.toUpperCase(),
          stats: {
            rank: mainRank ? `${mainRank.tier} ${mainRank.rank}` : 'Sin clasificar',
            winRate: overallStats?.winRate,
            kda: overallStats?.avgKDA,
            mostPlayed: topChamps,
            totalGames: matchHistory.length,
          },
        });

        setAiTags(JSON.parse(response.data.insights) || ['Análisis no disponible']);
      } catch (err) {
        console.error(err);
        setAiTags(['Error en análisis IA']);
      } finally {
        setLoadingAI(false);
      }
    };

    fetchAITags();
  }, [summary, matchHistory, championStats, overallStats, mainRank, champs, gameName, tagLine, platform]);

  // IA tags por partida (con estado de carga)
  useEffect(() => {
    if (!matchHistory.length) {
      setMatchTags({});
      setLoadingMatchTags(false);
      return;
    }

    const fetchMatchTags = async () => {
      setLoadingMatchTags(true);
      const tags: { [key: string]: string[] } = {};

      for (const m of matchHistory) {
        try {
          const response = await axios.post('http://192.168.1.14:4000/api/ai-match-tags', {
            matchData: m,
          });
          tags[m.matchId] = JSON.parse(response.data.tags) || ["Sin etiquetas"];
        } catch (err) {
          tags[m.matchId] = ["Error en análisis"];
        }
      }

      setMatchTags(tags);
      setLoadingMatchTags(false);
    };

    fetchMatchTags();
  }, [matchHistory]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black">
        <div className="container mx-auto px-6 py-20">
          <div className="flex justify-center mb-12">
            <Skeleton className="w-32 h-32 rounded-full" />
          </div>
          <div className="text-center space-y-4">
            <Skeleton className="h-12 w-80 mx-auto" />
            <Skeleton className="h-8 w-60 mx-auto" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-20">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      {/* Halo rojo */}
      <div className="fixed inset-0 -z-10 pointer-events-none bg-gradient-radial from-red-950/20 via-black/90 to-black" />

      {/* Spotlight */}
      <div
        ref={sectionRef}
        onMouseMove={handleMouseMove}
        className="fixed inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(800px circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(239, 68, 68, 0.15), transparent 40%)`,
        }}
      />

      {/* Header */}
      <header className="py-20 px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <div className="flex justify-center mb-8">
            {profileIconUrl ? (
              <img
                src={profileIconUrl}
                alt="Icono"
                className="w-32 h-32 rounded-full border-4 border-red-600 shadow-2xl shadow-red-600/50 hover:scale-105 transition"
              />
            ) : (
              <div className="w-32 h-32 rounded-full bg-gradient-to-r from-red-600 to-red-800 animate-pulse" />
            )}
          </div>
          <h1 className="text-5xl font-bold bg-gradient-to-r from-red-400 to-red-600 bg-clip-text text-transparent">
            {summary?.summoner.name || gameName}#{tagLine}
          </h1>
          <div className="mt-6 flex justify-center gap-6 flex-wrap">
            <Badge className="bg-gradient-to-r from-red-700 to-red-900 px-6 py-3 text-lg shadow-lg">
              <img src={RANKED_EMBLEM(mainRank?.tier)} className="w-6 h-6 mr-2" alt="Emblema" />
              {rankBadge}
            </Badge>
            <Badge variant="outline" className="border-red-500 text-red-300 px-6 py-3 text-lg shadow-lg">
              {platform?.toUpperCase()}
            </Badge>
          </div>
        </motion.div>
      </header>

      {/* Resumen */}
      <main className="px-6 max-w-6xl mx-auto space-y-16 pb-32">
        {/* Puntuación */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <div className="mb-12">
            <p className="text-gray-400 text-xl mb-4">Puntuación Personal ATAK</p>
            <div className="text-7xl font-bold text-red-400">{personalScore}/100</div>
            <Progress value={personalScore} className="mt-6 h-4 rounded-full bg-gray-800 [&>div]:bg-gradient-to-r [&>div]:from-red-600 [&>div]:to-red-800" />
          </div>

          <div>
            <p className="text-gray-400 text-xl mb-6">Etiquetas IA</p>
            <div className="flex flex-wrap justify-center gap-4">
  {loadingAI ? (
    <p className="text-gray-500 text-lg">Analizando perfil con IA...</p>
  ) : aiTags.length > 0 ? (
    aiTags.map((tag, i) => (
      <Badge 
        key={i} 
        className="bg-red-900/60 text-red-200 px-6 py-3 text-xl rounded-full shadow-xl hover:bg-red-800/70 transition"
      >
        {safeTagString(tag)}
      </Badge>
    ))
  ) : (
    <p className="text-gray-500 text-lg">No disponible</p>
  )}
</div>
          </div>
        </motion.div>

        {/* Mejores campeones */}
        {championStats && Object.keys(championStats).length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="grid grid-cols-2 md:grid-cols-4 gap-8"
          >
            {Object.entries(championStats).slice(0, 4).map(([id, s]: [string, any]) => {
              const champ = champs?.byKey[id];
              return (
                <div key={id} className="text-center">
                  <img src={champ?.image} alt={champ?.name} className="w-24 h-24 mx-auto rounded-xl border-4 border-red-700/50 shadow-2xl shadow-red-600/40 hover:scale-110 transition" />
                  <p className="mt-4 font-bold text-xl text-white">{champ?.name || "Desconocido"}</p>
                  <p className="text-red-300 text-3xl font-bold">{s.winRate}% WR</p>
                  <p className="text-gray-400 text-sm">{s.games} partidas</p>
                </div>
              );
            })}
          </motion.div>
        )}

        {/* Partidas recientes */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="space-y-8"
        >
          <h2 className="text-4xl font-bold text-center text-red-400">Partidas Recientes</h2>
          {matchHistory.map((m) => (
            <div key={m.matchId} className="bg-gray-900/40 rounded-3xl p-8 border border-red-800/40 shadow-2xl shadow-red-900/30 hover:shadow-red-900/50 transition">
              <MatchRow match={m as any} champs={champs} staticData={staticData} mePuuid={puuid} regional={continent} />
              
              {/* Etiquetas por partida - ahora 100% seguras */}
              <div className="mt-6 flex flex-wrap gap-3 justify-center">
  {loadingMatchTags ? (
    <p className="text-gray-500">Analizando partida con IA...</p>
  ) : (matchTags[m.matchId] || []).length > 0 ? (
    (matchTags[m.matchId] || []).map((tag, i) => (
      <Badge
        key={i}
        className="bg-red-900/60 text-red-200 px-5 py-2 text-base rounded-full shadow-md hover:bg-red-800/70 transition"
      >
        {safeTagString(tag)}
      </Badge>
    ))
  ) : (
    <p className="text-gray-500">Análisis no disponible</p>
  )}
</div>
            </div>
          ))}
        </motion.div>
      </main>
    </div>
  );
}