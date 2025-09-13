// src/pages/SummonerPage.tsx
import { useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/Card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { MessageCircle, Zap, BarChart3, Crown, Swords, Target, TrendingUp, Clock, Star, Sword, Skull, Shield } from "lucide-react";
import { axiosInstance } from "@/lib/axios";
import { useChampions, useStaticData } from "@/hooks/use-ddragon";
import { MatchRow } from "@/components/MatchRow";

// ---------- Tipos auxiliares ----------
type Platform = "la1" | "la2" | "na1" | "br1" | "oc1" | "euw1" | "eun1" | "tr1" | "ru" | "jp1" | "kr";
type Continent = "americas" | "europe" | "asia";

type TeamMini = { teamId: number; championId: number; summonerName?: string; puuid?: string };

type MatchDetail = {
  matchId: string;
  championId: number;
  championName: string;
  win: boolean;
  kills: number;
  deaths: number;
  assists: number;
  kda: number;
  cs?: number;
  gameDuration: number;
  gameMode: string;
  gameStartTimestamp: number;
  items: number[];
  trinket?: number;
  summonerSpells: number[];
  perks: any;
  role: string;
  lane: string;
  queueId?: number;
  championLevel?: number;
  gold?: number;
  totalDamageDealtToChampions?: number;
  totalMinionsKilled?: number;
  neutralMinionsKilled?: number;
  killParticipation?: number;
  playerAugments?: number[];
  teamParticipants?: TeamMini[];
};

// ---------- Constantes UI ----------
const SUMMONER_BG =
  "https://images.unsplash.com/photo-1542751371-adc38448a05e?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80";

// Emblema oficial (CommunityDragon)
const RANKED_EMBLEM = (tier?: string) => {
  const t = (tier || "unranked").toLowerCase();
  return `https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/images/ranked-emblems/emblem-${t}.png`;
};

// ---------- Helpers ----------
const normalizePlatform = (pf?: string): Platform | undefined => {
  if (!pf) return undefined;
  const p = pf.toLowerCase();
  if (p === "lal") return "la1";
  if (p === "la" || p === "las") return "la2";
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

const qLabel = (qid?: number, fallback?: string) =>
  ({ 420: "Ranked Solo", 440: "Ranked Flex", 450: "ARAM", 1700: "Arena" } as Record<number, string>)[qid ?? -1] ||
  (fallback ?? "Normal");

const timeAgo = (t: number) => {
  const diff = Date.now() - t;
  const mins = Math.max(0, Math.round(diff / 60000));
  if (mins < 60) return `hace ${mins}m`;
  const hrs = Math.round(mins / 60);
  if (hrs < 48) return `hace ${hrs}h`;
  const days = Math.round(hrs / 24);
  return `hace ${days}d`;
};

// ---------- WinRate circle ----------
const WinRateCircle = ({ winRate, size = 100 }: { winRate: number; size?: number }) => {
  const radius = size / 2 - 5;
  const circumference = 2 * Math.PI * radius;
  const dash = circumference - (winRate / 100) * circumference;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="rgba(255,255,255,.12)" strokeWidth="8" fill="transparent" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={winRate >= 50 ? "url(#winGradient)" : "url(#lossGradient)"}
          strokeWidth="8"
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={dash}
          strokeLinecap="round"
        />
        <defs>
          <linearGradient id="winGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="100%" stopColor="#34d399" />
          </linearGradient>
          <linearGradient id="lossGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ef4444" />
            <stop offset="100%" stopColor="#f87171" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <span className="text-white font-bold text-lg">{Math.round(winRate)}%</span>
      </div>
    </div>
  );
};

const StatBar = ({ label, value, max = 10, color = "red" }: { label: string; value: number; max?: number; color?: string }) => {
  const pct = Math.min(100, (value / max) * 100);
  const colorClass = color === "red" ? "bg-red-500" : color === "blue" ? "bg-blue-500" : "bg-green-500";
  return (
    <div className="mb-3">
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-300">{label}</span>
        <span className="font-medium text-white">{value.toFixed(1)}</span>
      </div>
      <div className="w-full bg-gray-700 rounded-full h-2">
        <div className={`h-2 rounded-full ${colorClass}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

// ===================================================================
//                              PAGE
// ===================================================================
export default function SummonerPage() {
  const { data: champs } = useChampions();
  const staticData = useStaticData();

  const { region, riotId } = useParams<{ region: string; riotId: string }>();
  const platform = normalizePlatform(region);
  const continent: Continent = platform ? platformToContinent(platform) : "americas";

  const { state } = useLocation() as { state?: { puuid?: string } };
  const { gameName, tagLine } = splitRiotId(riotId || "");

  const [puuid, setPuuid] = useState<string | undefined>(state?.puuid);
  const [summary, setSummary] = useState<null | {
    summoner: { name: string; level: number; profileIconId?: number };
    rank: { queue: string; tier: string; rank: string; lp: number; wins: number; losses: number }[] | null;
    masteryTop: { championId: number; championName: string; level: number; points: number }[] | null;
  }>(null);

  const [recent, setRecent] = useState<
    { championId: number; championName: string; games: number; wins: number; losses: number; winRate: number; kda: string; avgKills: string; avgDeaths: string; avgAssists: string }[]
  >([]);
  const [matchHistory, setMatchHistory] = useState<MatchDetail[]>([]);
  const [liveGame, setLiveGame] = useState<{
    gameMode: string;
    gameStartTime: number;
    participants: { summonerName: string; championId: number; teamId: number; puuid?: string }[];
  } | null>(null);
  const [championStats, setChampionStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("resumen");

  const profileIconUrl =
    summary?.summoner.profileIconId != null && champs?.version
      ? `https://ddragon.leagueoflegends.com/cdn/${champs.version}/img/profileicon/${summary.summoner.profileIconId}.png`
      : undefined;

  // 1) Resolver PUUID (si llega vacío)
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
          if (!(e as any)?.name?.includes("Abort")) console.error("[SUMMONER] resolve error", e);
        }
      }
    })();
    return () => ac.abort();
  }, [puuid, platform, gameName, tagLine]);

  // 2) Cargar summary, recent, live, champion-stats en paralelo
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

        const rec = await axiosInstance.get(`/api/stats/recent/${platform}/${puuid}`, {
          params: { count: 8, queues: "420,440" },
          signal: ac.signal,
        });
        setRecent(rec.data?.champions ?? []);

        await sleep(150);

        const live = await axiosInstance.get(`/api/stats/spectator/${platform}/${puuid}`, {
          validateStatus: () => true,
          signal: ac.signal,
        });
        setLiveGame(live.status === 200 ? live.data : null);

        await sleep(150);

        const chstats = await axiosInstance.get(`/api/stats/champion-stats/${platform}/${puuid}`, {
          params: { count: 12 },
          validateStatus: () => true,
          signal: ac.signal,
        });
        setChampionStats(chstats.status === 200 ? chstats.data : null);
      } catch (e) {
        if (!(e as any)?.name?.includes("Abort")) console.warn("[SUMMONER] load warn", e);
      } finally {
        setIsLoading(false);
      }
    })();

    return () => ac.abort();
  }, [puuid, platform]);

  // 3) Historial de partidas
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
        if (!(e as any)?.name?.includes("Abort")) console.error("[SUMMONER] match history error", e);
      }
    })();
    return () => ac.abort();
  }, [puuid, platform, continent]);

  // --------- SOLO/FLEX (calculado DENTRO del componente) ----------
  const solo = useMemo(() => summary?.rank?.find((r) => r.queue === "RANKED_SOLO_5x5"), [summary]);
  const flex = useMemo(() => summary?.rank?.find((r) => r.queue === "RANKED_FLEX_SR"), [summary]);
  const soloWR = useMemo(
    () => (solo ? Math.round((solo.wins / Math.max(solo.wins + solo.losses, 1)) * 100) : null),
    [solo]
  );
  const flexWR = useMemo(
    () => (flex ? Math.round((flex.wins / Math.max(flex.wins + flex.losses, 1)) * 100) : null),
    [flex]
  );

  const rankBadge =
    summary?.rank?.[0] ? `${summary.rank[0].tier} ${summary.rank[0].rank} - ${summary.rank[0].lp} LP` : "Sin clasificar";

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

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-900 to-black">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-300">Cargando datos del invocador...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-900/70 to-black/90 py-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-cover bg-center opacity-20" style={{ backgroundImage: `url(${SUMMONER_BG})` }} />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-80" />

        <div className="container mx-auto px-4 relative z-10">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
            <div className="flex-shrink-0">
              <div className="relative">
                {profileIconUrl ? (
                  <>
                    <img
                      src={profileIconUrl}
                      alt="Icono de invocador"
                      className="w-24 h-24 rounded-full object-cover border-4 border-red-500/50 shadow-lg"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
                      }}
                    />
                    <div className="absolute -bottom-1 -right-1 w-10 h-10 rounded-full bg-gradient-to-r from-red-600 to-red-800 text-white flex items-center justify-center text-sm font-bold shadow-lg border-2 border-gray-900">
                      {summary?.summoner.level ?? "—"}
                    </div>
                  </>
                ) : (
                  <div className="w-24 h-24 rounded-full bg-gradient-to-r from-red-600 to-red-800 animate-pulse" />
                )}
              </div>
            </div>

            <div className="flex-grow">
              <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-red-300 to-red-500 bg-clip-text text-transparent">
                {summary?.summoner.name ?? gameName}
                <span className="text-red-400">#{tagLine}</span>
              </h1>
              <div className="flex flex-wrap gap-3 mb-3">
                <Badge className="bg-gradient-to-r from-red-600 to-red-800 text-white px-3 py-1 flex items-center gap-1">
                  <img
                    src={RANKED_EMBLEM(summary?.rank?.[0]?.tier)}
                    className="w-4 h-4"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
                    }}
                  />
                  {rankBadge}
                </Badge>
                <Badge variant="outline" className="border-red-500 text-red-300">
                  {platform?.toUpperCase()}
                </Badge>
                {liveGame && (
                  <Badge className="bg-green-600/20 text-green-300 border-green-500/30">
                    <Zap className="w-3 h-3 mr-1" /> En partida
                  </Badge>
                )}
              </div>

              {/* Panel Solo/Flex */}
              <div className="flex gap-3">
                {solo && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-900/40 border border-red-700/30">
                    <img src={RANKED_EMBLEM(solo.tier)} className="w-6 h-6" />
                    <span className="text-sm">
                      <span className="text-red-300 font-semibold">SoloQ:</span>{" "}
                      {solo.tier} {solo.rank} • {solo.lp} LP
                      {typeof soloWR === "number" && (
                        <span className="text-gray-400"> • {solo.wins}W/{solo.losses}L ({soloWR}% WR)</span>
                      )}
                    </span>
                  </div>
                )}
                {flex && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-900/40 border border-red-700/30">
                    <img src={RANKED_EMBLEM(flex.tier)} className="w-6 h-6" />
                    <span className="text-sm">
                      <span className="text-red-300 font-semibold">Flex:</span>{" "}
                      {flex.tier} {flex.rank} • {flex.lp} LP
                      {typeof flexWR === "number" && (
                        <span className="text-gray-400"> • {flex.wins}W/{flex.losses}L ({flexWR}% WR)</span>
                      )}
                    </span>
                  </div>
                )}
              </div>

              <p className="text-red-200 text-sm mt-2">PUUID: {puuid ? puuid.slice(0, 12) + "…" : "resolviendo…"}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* KPIs */}
        {overallStats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <Card className="bg-gray-800/50 border-red-700/30 backdrop-blur-sm">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-red-300">
                  {overallStats.wins}W / {overallStats.losses}L
                </div>
                <p className="text-sm text-gray-400">Récord</p>
              </CardContent>
            </Card>
            <Card className="bg-gray-800/50 border-red-700/30 backdrop-blur-sm">
              <CardContent className="p-4 text-center">
                <div className="flex justify-center">
                  <WinRateCircle winRate={overallStats.winRate} size={60} />
                </div>
                <p className="text-sm text-gray-400">Win Rate</p>
              </CardContent>
            </Card>
            <Card className="bg-gray-800/50 border-red-700/30 backdrop-blur-sm">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-yellow-300">{overallStats.avgKDA}:1</div>
                <p className="text-sm text-gray-400">KDA Ratio</p>
              </CardContent>
            </Card>
            <Card className="bg-gray-800/50 border-red-700/30 backdrop-blur-sm">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-purple-300">{matchHistory.length}</div>
                <p className="text-sm text-gray-400">Partidas analizadas</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid grid-cols-2 md:grid-cols-5 gap-2 p-1 bg-gray-800/50 rounded-lg border border-red-700/30">
            <TabsTrigger value="resumen" className="data-[state=active]:bg-red-600 data-[state=active]:text-white">
              <BarChart3 className="w-4 h-4 mr-2" /> Resumen
            </TabsTrigger>
            <TabsTrigger value="partidas" className="data-[state=active]:bg-red-600 data-[state=active]:text-white">
              <Swords className="w-4 h-4 mr-2" /> Partidas
            </TabsTrigger>
            <TabsTrigger value="campeones" className="data-[state=active]:bg-red-600 data-[state=active]:text-white">
              <Crown className="w-4 h-4 mr-2" /> Campeones
            </TabsTrigger>
            <TabsTrigger value="live" className="data-[state=active]:bg-red-600 data-[state=active]:text-white">
              <Zap className="w-4 h-4 mr-2" /> En Vivo
            </TabsTrigger>
            <TabsTrigger value="roasts" className="data-[state=active]:bg-red-600 data-[state=active]:text-white">
              <MessageCircle className="w-4 h-4 mr-2" /> Roasts
            </TabsTrigger>
          </TabsList>

          {/* RESUMEN */}
          <TabsContent value="resumen" className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              {/* Mastery */}
              <Card className="bg-gray-800/30 border-red-700/30 backdrop-blur-sm">
                <CardHeader className="bg-gradient-to-r from-red-900/50 to-red-800/50 border-b border-red-700/30">
                  <CardTitle className="flex items-center gap-2 text-red-200">
                    <Target className="h-5 w-5" />
                    Top Maestría
                  </CardTitle>
                  <CardDescription className="text-gray-400">Campeones con más puntos de maestría</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-red-700/30">
                    {summary?.masteryTop?.slice(0, 5).map((m, i) => {
                      const champ = champs?.byKey[String(m.championId)];
                      return (
                        <div
                          key={m.championId}
                          className="flex items-center justify-between p-4 hover:bg-red-900/20 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <img
                              src={champ?.image}
                              alt={champ?.name ?? String(m.championId)}
                              className="w-12 h-12 rounded-lg object-cover border border-red-600/30"
                            />
                            <div>
                              <p className="font-semibold text-white">{champ?.name ?? String(m.championId)}</p>
                              <p className="text-sm text-gray-400">
                                Nivel {m.level} • {m.points.toLocaleString()} pts
                              </p>
                            </div>
                          </div>
                          <div className="w-10 h-10 bg-gradient-to-b from-yellow-700 to-yellow-500 rounded-lg grid place-items-center text-white font-bold">
                            #{i + 1}
                          </div>
                        </div>
                      );
                    }) || <p className="p-4 text-sm text-gray-400">Sin datos de maestría</p>}
                  </div>
                </CardContent>
              </Card>

              {/* Rendimiento reciente */}
              <Card className="bg-gray-800/30 border-red-700/30 backdrop-blur-sm">
                <CardHeader className="bg-gradient-to-r from-red-900/50 to-red-800/50 border-b border-red-700/30">
                  <CardTitle className="flex items-center gap-2 text-red-200">
                    <TrendingUp className="h-5 w-5" />
                    Rendimiento Reciente
                  </CardTitle>
                  <CardDescription className="text-gray-400">Últimas partidas (SoloQ/Flex)</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-red-700/30">
                    {recent.slice(0, 5).map((c, idx) => (
                      <div
                        key={c.championId}
                        className="flex items-center justify-between p-4 hover:bg-red-900/20 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-b from-red-700 to-red-500 rounded-lg grid place-items-center text-white font-bold">
                            #{idx + 1}
                          </div>
                          <div>
                            <p className="font-semibold text-white">{c.championName}</p>
                            <p className="text-xs text-gray-400">
                              {c.games} juegos • {c.wins}W/{c.losses}L • KDA {c.kda}
                            </p>
                          </div>
                        </div>
                        <Badge
                          className={
                            c.winRate >= 60
                              ? "bg-green-600/20 text-green-300 border-green-500/30"
                              : c.winRate >= 50
                              ? "bg-yellow-600/20 text-yellow-300 border-yellow-500/30"
                              : "bg-red-600/20 text-red-300 border-red-500/30"
                          }
                        >
                          {c.winRate}%
                        </Badge>
                      </div>
                    ))}
                    {!recent.length && <p className="p-4 text-sm text-gray-400">Sin partidas recientes</p>}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* KPIs extendidos */}
            {overallStats && (
              <Card className="bg-gray-800/30 border-red-700/30 backdrop-blur-sm">
                <CardHeader className="bg-gradient-to-r from-red-900/50 to-red-800/50 border-b border-red-700/30">
                  <CardTitle className="flex items-center gap-2 text-red-200">
                    <TrendingUp className="h-5 w-5" />
                    Estadísticas de Desempeño
                  </CardTitle>
                  <CardDescription className="text-gray-400">Rendimiento en las últimas partidas</CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div className="flex justify-center">
                        <WinRateCircle winRate={overallStats.winRate} size={120} />
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-bold text-white">
                          {overallStats.wins} Victorias / {overallStats.losses} Derrotas
                        </p>
                        <p className="text-sm text-gray-400">Récord total</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="font-medium text-white mb-4">Promedios por partida</h3>
                      <StatBar label="Asesinatos" value={parseFloat(overallStats.avgKills)} max={15} color="red" />
                      <StatBar label="Muertes" value={parseFloat(overallStats.avgDeaths)} max={10} color="blue" />
                      <StatBar label="Asistencias" value={parseFloat(overallStats.avgAssists)} max={15} color="green" />

                      <div className="grid grid-cols-3 gap-4 mt-6">
                        <div className="text-center p-3 bg-red-900/30 rounded-lg border border-red-700/30">
                          <Sword className="w-6 h-6 text-red-400 mx-auto mb-2" />
                          <div className="text-xl font-bold text-red-300">{overallStats.avgKills}</div>
                          <div className="text-xs text-gray-400">Kills</div>
                        </div>
                        <div className="text-center p-3 bg-red-900/30 rounded-lg border border-red-700/30">
                          <Skull className="w-6 h-6 text-red-400 mx-auto mb-2" />
                          <div className="text-xl font-bold text-red-300">{overallStats.avgDeaths}</div>
                          <div className="text-xs text-gray-400">Deaths</div>
                        </div>
                        <div className="text-center p-3 bg-red-900/30 rounded-lg border border-red-700/30">
                          <Shield className="w-6 h-6 text-red-400 mx-auto mb-2" />
                          <div className="text-xl font-bold text-red-300">{overallStats.avgAssists}</div>
                          <div className="text-xs text-gray-400">Assists</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* PARTIDAS */}
          <TabsContent value="partidas" className="space-y-4">
            <Card className="bg-gray-800/30 border-red-700/30 backdrop-blur-sm">
              <CardHeader className="bg-gradient-to-r from-red-900/50 to-red-800/50 border-b border-red-700/30">
                <CardTitle className="flex items-center gap-2 text-red-200">
                  <Clock className="h-5 w-5" />
                  Historial de Partidas
                </CardTitle>
                <CardDescription className="text-gray-400">Últimas partidas jugadas</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 p-4">
                {matchHistory.length ? (
                  matchHistory.map((m) => (
                    <MatchRow key={m.matchId} match={m as any} champs={champs} staticData={staticData} mePuuid={puuid} />
                  ))
                ) : (
                  <p className="text-sm text-gray-400">No hay partidas recientes</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* CAMPEONES */}
          <TabsContent value="campeones" className="space-y-4">
            <Card className="bg-gray-800/30 border-red-700/30 backdrop-blur-sm">
              <CardHeader className="bg-gradient-to-r from-red-900/50 to-red-800/50 border-b border-red-700/30">
                <CardTitle className="flex items-center gap-2 text-red-200">
                  <Crown className="h-5 w-5" /> Estadísticas por Campeón
                </CardTitle>
                <CardDescription className="text-gray-400">Rendimiento con cada campeón</CardDescription>
              </CardHeader>
              <CardContent>
                {championStats ? (
                  <div className="grid gap-4">
                    {Object.entries(championStats)
                      .slice(0, 10)
                      .map(([championId, stats]: [string, any]) => {
                        const champ = champs?.byKey[championId];
                        if (!champ) return null;
                        return (
                          <div
                            key={championId}
                            className="flex items-center gap-4 p-3 bg-red-900/20 rounded-lg border border-red-700/30"
                          >
                            <img
                              src={champ.image}
                              alt={champ.name}
                              className="w-12 h-12 rounded-lg object-cover border border-red-600/30"
                            />
                            <div className="flex-grow">
                              <h3 className="font-bold text-white">{champ.name}</h3>
                              <div className="flex gap-4 text-xs text-gray-400">
                                <span>{stats.games} partidas</span>
                                <span className={stats.winRate >= 50 ? "text-green-300" : "text-red-300"}>
                                  {stats.winRate}% WR
                                </span>
                                <span>KDA: {stats.kda}</span>
                              </div>
                            </div>
                            <div className="w-20">
                              <div className="flex justify-between text-xs mb-1">
                                <span className="text-gray-400">WR</span>
                                <span>{stats.winRate}%</span>
                              </div>
                              <Progress
                                value={stats.winRate}
                                className="h-2 bg-gray-700 [&>div]:bg-gradient-to-r [&>div]:from-red-500 [&>div]:to-red-700"
                              />
                            </div>
                          </div>
                        );
                      })}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">No hay estadísticas de campeones disponibles</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* LIVE */}
          <TabsContent value="live" className="space-y-4">
            <Card className="bg-gray-800/30 border-red-700/30 backdrop-blur-sm">
              <CardHeader className="bg-gradient-to-r from-red-900/50 to-red-800/50 border-b border-red-700/30">
                <CardTitle className="flex items-center gap-2 text-red-200">
                  <Zap className="h-5 w-5" /> Partida en Curso
                </CardTitle>
                <CardDescription className="text-gray-400">
                  {liveGame ? "Información de la partida actual" : "No está en partida actualmente"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {liveGame ? (
                  <div>
                    <div className="mb-4 p-3 bg-red-900/20 rounded-lg border border-red-700/30">
                      <h3 className="font-bold text-white">{liveGame.gameMode}</h3>
                      <p className="text-sm text-gray-400">Inició: {new Date(liveGame.gameStartTime).toLocaleTimeString()}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <h4 className="font-medium text-blue-300 mb-2">Equipo Azul</h4>
                        <div className="space-y-2">
                          {liveGame.participants
                            .filter((p) => p.teamId === 100)
                            .map((p, i) => (
                              <div
                                key={`blue-${i}`}
                                className="flex items-center gap-2 text-sm p-2 bg-blue-900/20 rounded border border-blue-700/30"
                              >
                                <span className="text-white">{p.summonerName}</span>
                              </div>
                            ))}
                        </div>
                      </div>
                      <div>
                        <h4 className="font-medium text-red-300 mb-2">Equipo Rojo</h4>
                        <div className="space-y-2">
                          {liveGame.participants
                            .filter((p) => p.teamId === 200)
                            .map((p, i) => (
                              <div
                                key={`red-${i}`}
                                className="flex items-center gap-2 text-sm p-2 bg-red-900/20 rounded border border-red-700/30"
                              >
                                <span className="text-white">{p.summonerName}</span>
                              </div>
                            ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Zap className="w-12 h-12 text-red-600 mx-auto mb-4" />
                    <p className="text-gray-400">No se encuentra en partida actualmente</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ROASTS */}
          <TabsContent value="roasts" className="space-y-4">
            <Card className="bg-gray-800/30 border-red-700/30 backdrop-blur-sm">
              <CardHeader className="bg-gradient-to-r from-red-900/50 to-red-800/50 border-b border-red-700/30">
                <CardTitle className="flex items-center gap-2 text-red-200">
                  <MessageCircle className="h-5 w-5" /> Roasts de la Comunidad
                </CardTitle>
                <CardDescription className="text-gray-400">Deja tu comentario sobre este invocador</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 bg-red-900/20 rounded-lg border border-red-700/30">
                    <p className="text-gray-400 text-center">Sistema de roasts en desarrollo...</p>
                  </div>
                  <div className="bg-gray-800 p-4 rounded-lg border border-red-700/30">
                    <h3 className="font-medium text-white mb-2">Deja tu roast</h3>
                    <textarea
                      className="w-full bg-gray-700 text-white p-3 rounded-lg border border-red-700/30 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none"
                      rows={3}
                      placeholder="Escribe tu comentario sobre este jugador..."
                    />
                    <div className="flex justify-end mt-3">
                      <Button className="bg-gradient-to-r from-red-600 to-red-800 hover:from-red-700 hover:to-red-900">
                        <Star className="w-4 h-4 mr-2" /> Publicar Roast
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-4 mt-6">
                    <h3 className="font-medium text-white">Roasts recientes</h3>
                    <div className="p-4 bg-red-900/20 rounded-lg border border-red-700/30 text-center">
                      <p className="text-gray-400">Aún no hay roasts para este invocador</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
