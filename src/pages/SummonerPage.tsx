// src/pages/SummonerPage.tsx
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/Card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Trophy, Target, Clock, Star, Swords, TrendingUp, Zap, BarChart3, Crown, MessageCircle, Users, Heart, Skull, Sword, Shield, GitGraph } from 'lucide-react';
import { axiosInstance } from '@/lib/axios';
import { useChampions, useStaticData } from '@/hooks/use-ddragon';

type Platform = 'la1'|'la2'|'na1'|'br1'|'oc1'|'euw1'|'eun1'|'tr1'|'ru'|'jp1'|'kr';
type Continent = 'americas'|'europe'|'asia';

// Imágenes de fondo (reemplaza con tus propias URLs)
const SUMMONER_BG = 'https://images.unsplash.com/photo-1542751371-adc38448a05e?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80';
const RANKED_BADGE = 'https://static.wikia.nocookie.net/leagueoflegends/images/9/9a/Emblem_Gold.png/revision/latest?cb=20200511203643';
const CHALLENGER_BADGE = 'https://static.wikia.nocookie.net/leagueoflegends/images/0/03/Emblem_Challenger.png/revision/latest?cb=20200511203618';

const normalizePlatform = (pf?: string) => {
  if (!pf) return undefined;
  const p = pf.toLowerCase();
  if (p === 'lal') return 'la1';
  if (p === 'la' || p === 'las') return 'la2';
  return p;
};

const platformToContinent = (pf: Platform): Continent => {
  if (['la1','la2','na1','br1'].includes(pf)) return 'americas';
  if (['euw1','eun1','tr1','ru'].includes(pf)) return 'europe';
  return 'asia';
};

const splitRiotId = (s: string) => {
  const [gameName='', tagLine=''] = decodeURIComponent(s).split('#');
  return { gameName, tagLine };
};

type TeamMini = { teamId: number; championId: number };

type MatchDetail = {
  matchId: string;
  championId: number;
  championName: string;
  win: boolean;
  kills: number;
  deaths: number;
  assists: number;
  kda: number;
  cs: number;
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

// --- UI helpers
const qLabel = (qid?: number, fallback?: string) =>
  ({420:'Ranked Solo',440:'Ranked Flex',450:'ARAM',1700:'Arena'} as Record<number,string>)[qid ?? -1] || (fallback ?? 'Normal');

const timeAgo = (t: number) => {
  const diff = Date.now() - t;
  const mins = Math.round(diff / 60000);
  if (mins < 60) return `hace ${mins}m`;
  const hrs = Math.round(mins / 60);
  if (hrs < 48) return `hace ${hrs}h`;
  const days = Math.round(hrs / 24);
  return `hace ${days}d`;
};

// Componente para gráfica circular de Win Rate
const WinRateCircle = ({ winRate, size = 100 }: { winRate: number; size?: number }) => {
  const radius = size / 2 - 5;
  const circumference = 2 * Math.PI * radius;
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference - (winRate / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Fondo del círculo */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(255, 255, 255, 0.1)"
          strokeWidth="8"
          fill="transparent"
        />
        {/* Círculo de progreso */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={winRate >= 50 ? "url(#winGradient)" : "url(#lossGradient)"}
          strokeWidth="8"
          fill="transparent"
          strokeDasharray={strokeDasharray}
          strokeDashoffset={strokeDashoffset}
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
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-white font-bold text-lg">{winRate.toFixed(0)}%</span>
      </div>
    </div>
  );
};

// Componente para barra de estadísticas
const StatBar = ({ label, value, max = 10, color = "red" }: { label: string; value: number; max?: number; color?: string }) => {
  const percentage = (value / max) * 100;
  const colorClass = color === "red" ? "bg-red-500" : color === "blue" ? "bg-blue-500" : "bg-green-500";
  
  return (
    <div className="mb-3">
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-300">{label}</span>
        <span className="font-medium text-white">{value.toFixed(1)}</span>
      </div>
      <div className="w-full bg-gray-700 rounded-full h-2">
        <div 
          className={`h-2 rounded-full ${colorClass}`}
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
    </div>
  );
};

// --- Fila de partida
function MatchRow({
  match,
  champs,
  staticData
}: {
  match: MatchDetail;
  champs: any;
  staticData: ReturnType<typeof useStaticData>;
}) {
  const champ = champs?.byKey[String(match.championId)];
  const minutes = Math.max(1, Math.round((match.gameDuration ?? 0) / 60));
  const csAll = typeof match.cs === 'number'
    ? match.cs
    : (match.totalMinionsKilled ?? 0) + (match.neutralMinionsKilled ?? 0);
  const csPerMin = (csAll / minutes).toFixed(1);
  const kpPct = typeof match.killParticipation === 'number'
    ? Math.round(match.killParticipation * 100)
    : undefined;

  const keystone = match.perks?.styles?.[0]?.selections?.[0]?.perk as number | undefined;
  const secondary = match.perks?.styles?.[1]?.style as number | undefined;

  const itemIds = (match.items ?? []).slice(0,6);
  const trinket = match.trinket ?? match.items?.[6];

  return (
    <div className={`p-4 rounded-xl border transition-colors backdrop-blur-sm
      ${match.win
        ? 'bg-gradient-to-r from-green-900/10 to-green-800/5 border-green-600/30'
        : 'bg-gradient-to-r from-red-900/10 to-red-800/5 border-red-600/30'}`}>
      <div className="flex items-center gap-4">
        {/* Campeón */}
        <div className="relative">
          <img src={champ?.image} alt={champ?.name} className="w-14 h-14 rounded-lg border border-gray-600 object-cover"/>
          {!!match.championLevel && (
            <span className="absolute -bottom-1 -right-1 text-[10px] px-1 py-0.5 rounded bg-gray-900/90 border border-gray-700">
              {match.championLevel}
            </span>
          )}
        </div>

        {/* Centro */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold truncate text-white">{champ?.name}</h3>
              <span className={`text-xs px-2 py-0.5 rounded
                ${match.win ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
                {match.win ? 'Victoria' : 'Derrota'}
              </span>
              <span className="text-xs text-gray-400">{qLabel(match.queueId, match.gameMode)}</span>
            </div>
            <span className="text-xs text-gray-400">
              {timeAgo(match.gameStartTimestamp)} • {Math.floor(minutes/60)}h{minutes%60}m
            </span>
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            <span className="text-blue-300 font-semibold">{match.kills}/{match.deaths}/{match.assists}</span>
            <span className="text-gray-400">KDA {match.kda.toFixed(2)}</span>
            <span className="text-gray-400">CS {csAll} ({csPerMin}/m)</span>
            {typeof kpPct === 'number' && <span className="text-gray-400">KP {kpPct}%</span>}
            {typeof match.totalDamageDealtToChampions === 'number' && <span className="text-gray-400">Daño {match.totalDamageDealtToChampions.toLocaleString()}</span>}
            {typeof match.gold === 'number' && <span className="text-gray-400">Oro {match.gold.toLocaleString()}</span>}
          </div>
        </div>

        {/* Hechizos + Runas */}
        <div className="flex flex-col items-center gap-1">
          <div className="flex gap-1">
            {match.summonerSpells?.map((id) => {
              const s = staticData.spells?.[String(id)];
              return s ? (
                <TooltipProvider key={id}><Tooltip>
                  <TooltipTrigger asChild>
                    <img src={s.icon} alt={s.name} className="w-7 h-7 rounded border border-gray-600"/>
                  </TooltipTrigger>
                  <TooltipContent>{s.name}</TooltipContent>
                </Tooltip></TooltipProvider>
              ) : <div key={id} className="w-7 h-7 rounded border border-gray-700 bg-gray-800/40" />;
            })}
          </div>
          <div className="flex gap-1">
            {keystone && staticData.runes?.[keystone] && (
              <img src={staticData.runes[keystone].icon} className="w-7 h-7 rounded-full border border-gray-600" />
            )}
            {secondary && staticData.runes?.[secondary] && (
              <img src={staticData.runes[secondary].icon} className="w-7 h-7 rounded-full border border-gray-600 opacity-80" />
            )}
          </div>
        </div>
      </div>

      {/* Items + Trinket */}
      <div className="mt-3 flex items-center gap-2">
        {Array.from({length:6}).map((_, i) => {
          const id = itemIds[i];
          const it = id ? staticData.items?.[String(id)] : null;
          return it ? (
            <TooltipProvider key={i}><Tooltip>
              <TooltipTrigger asChild>
                <img src={it.icon} className="w-8 h-8 rounded border border-gray-600" />
              </TooltipTrigger>
              <TooltipContent className="max-w-[220px]">
                <p className="font-medium">{it.name}</p>
                <p className="text-xs opacity-80">{it.desc}</p>
              </TooltipContent>
            </Tooltip></TooltipProvider>
          ) : (
            <div key={i} className="w-8 h-8 rounded border border-dashed border-gray-700 bg-gray-800/40" />
          );
        })}
        <div className="ml-2">
          {trinket && staticData.items?.[String(trinket)]
            ? <img src={staticData.items[String(trinket)].icon} className="w-8 h-8 rounded border border-yellow-600/60"/>
            : <div className="w-8 h-8 rounded border border-dashed border-gray-700 bg-gray-800/40" />
          }
        </div>
      </div>

      {/* Arena augments */}
      {match.gameMode?.toLowerCase()?.includes('arena') && match.playerAugments?.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {match.playerAugments.map(id => {
            const a = staticData.augments?.[id];
            return (
              <div key={id} className="px-2 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-200 text-xs flex items-center gap-2">
                {a?.icon && <img src={a.icon} className="w-4 h-4 rounded" />}
                <span>{a?.name || `Augment ${id}`}</span>
              </div>
            );
          })}
        </div>
      ) : null}

      {/* Mini rosters */}
      {match.teamParticipants?.length ? (
        <div className="mt-4 grid grid-cols-2 gap-2">
          {[100,200].map(teamId => (
            <div key={teamId} className="flex items-center gap-1">
              {match.teamParticipants!.filter(t => t.teamId === teamId).map((p,i) => {
                const cc = champs?.byKey[String(p.championId)];
                return <img key={i} src={cc?.image} className="w-6 h-6 rounded border border-gray-700" />;
              })}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// --- Página
export default function SummonerPage() {
  const { data: champs } = useChampions();
  const staticData = useStaticData();

  const { region, riotId } = useParams<{ region: Platform | string; riotId: string }>();
  const platform = normalizePlatform(region) as Platform | undefined;
  const continent = platform ? platformToContinent(platform as Platform) : 'americas';

  const { state } = useLocation() as { state?: { puuid?: string } };
  const decoded = decodeURIComponent(riotId || '');
  const { gameName, tagLine } = splitRiotId(decoded);

  const [puuid, setPuuid] = useState<string | undefined>(state?.puuid);
  const [summary, setSummary] = useState<null | {
    summoner: { name: string; level: number; profileIconId?: number };
    rank: { queue: string; tier: string; rank: string; lp: number }[] | null;
    masteryTop: { championId: number; championName: string; level: number; points: number }[] | null;
  }>(null);

  const [recent, setRecent] = useState<
    { championId: number; championName: string; games: number; wins: number; losses: number; winRate: number; kda: string; avgKills: string; avgDeaths: string; avgAssists: string }[]
  >([]);

  const [matchHistory, setMatchHistory] = useState<MatchDetail[]>([]);
  const [liveGame, setLiveGame] = useState<{
    gameMode: string;
    gameStartTime: number;
    participants: { summonerName: string; championId: number; teamId: number }[];
  } | null>(null);

  const [championStats, setChampionStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('resumen');

  const profileIconUrl =
    summary?.summoner.profileIconId != null && champs?.version
      ? `https://ddragon.leagueoflegends.com/cdn/${champs.version}/img/profileicon/${summary.summoner.profileIconId}.png`
      : undefined;

  // 1) Resolver PUUID
  useEffect(() => {
    (async () => {
      if (!puuid && platform && gameName && tagLine) {
        try {
          const { data } = await axiosInstance.get('/api/stats/resolve', { params: { region: platform, gameName, tagLine } });
          setPuuid(data.puuid);
        } catch (err) {
          console.error('[SUMMONER] resolve error', err);
        }
      }
    })();
  }, [puuid, platform, gameName, tagLine]);

  // 2) summary
  useEffect(() => {
    (async () => {
      if (!puuid || !platform) return;
      try {
        setIsLoading(true);
        const url = `/api/stats/summary/${platform}/${puuid}`;
        const { data } = await axiosInstance.get(url);
        setSummary(data);
      } catch (err) {
        console.error('[SUMMONER] summary error', err);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [puuid, platform]);

  // 3) recent
  useEffect(() => {
    (async () => {
      if (!puuid || !platform) return;
      try {
        const url = `/api/stats/recent/${platform}/${puuid}`;
        const { data } = await axiosInstance.get<{ champions: typeof recent }>(url, {
          params: { count: 10, queues: '420,440' },
        });
        setRecent(data.champions);
      } catch (err) {
        console.error('[SUMMONER] recent error', err);
      }
    })();
  }, [puuid, platform]);

  // 4) Historial (IDs + detalle)
  useEffect(() => {
    (async () => {
      if (!puuid || !platform) return;
      try {
        const { data: matchIds } = await axiosInstance.get(
          `/api/stats/matches/${continent}/${puuid}/ids`,
          { params: { count: 5 } }
        );

        const settled = await Promise.allSettled(
          (matchIds || []).slice(0, 5).map((matchId: string) =>
            axiosInstance.get(`/api/stats/matches/${continent}/${matchId}`, { params: { puuid } })
          )
        );

        const details: MatchDetail[] = settled
          .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
          .map((r) => r.value.data);

        setMatchHistory(details);
      } catch (err) {
        console.error('[SUMMONER] match history error', err);
      }
    })();
  }, [puuid, platform, continent]);

  // 5) Live (usa plataforma normalizada)
  useEffect(() => {
    (async () => {
      if (!puuid || !platform) return;
      try {
        const resp = await axiosInstance.get(`/api/stats/spectator/${platform}/${puuid}`, { validateStatus: () => true });
        setLiveGame(resp.status === 200 ? resp.data : null);
      } catch {
        setLiveGame(null);
      }
    })();
  }, [puuid, platform]);

  // 6) Stats por campeón
  useEffect(() => {
    (async () => {
      if (!puuid || !platform) return;
      try {
        const { data } = await axiosInstance.get(`/api/stats/champion-stats/${platform}/${puuid}`, { params: { count: 20 } });
        setChampionStats(data);
      } catch (err) {
        console.error('[SUMMONER] champion stats error', err);
      }
    })();
  }, [puuid, platform]);

  const rankBadge = summary?.rank?.[0]
    ? `${summary.rank[0].tier} ${summary.rank[0].rank} - ${summary.rank[0].lp} LP`
    : 'Sin clasificar';

  const overallStats = useMemo(() => {
    if (!matchHistory.length) return null;
    const totalGames = matchHistory.length;
    const wins = matchHistory.filter((m) => m.win).length;
    const winRate = (wins / totalGames) * 100;
    const avgKills = matchHistory.reduce((sum, m) => sum + m.kills, 0) / totalGames;
    const avgDeaths = matchHistory.reduce((sum, m) => sum + m.deaths, 0) / totalGames;
    const avgAssists = matchHistory.reduce((sum, m) => sum + m.assists, 0) / totalGames;
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
      {/* Header con imagen de fondo */}
      <div className="bg-gradient-to-r from-red-900/70 to-black/90 py-8 relative overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-20"
          style={{ backgroundImage: `url(${SUMMONER_BG})` }}
        ></div>
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-80"></div>
        
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
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }}
                    />
                    <div className="absolute -bottom-1 -right-1 w-10 h-10 rounded-full bg-gradient-to-r from-red-600 to-red-800 text-white flex items-center justify-center text-sm font-bold shadow-lg border-2 border-gray-900">
                      {summary?.summoner.level ?? '—'}
                    </div>
                  </>
                ) : (
                  <div className="w-24 h-24 rounded-full bg-gradient-to-r from-red-600 to-red-800 animate-pulse" />
                )}
              </div>
            </div>

            <div className="flex-grow">
              <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-red-300 to-red-500 bg-clip-text text-transparent">
                {summary?.summoner.name ?? gameName}<span className="text-red-400">#{tagLine}</span>
              </h1>
              <div className="flex flex-wrap gap-3 mb-3">
                <Badge className="bg-gradient-to-r from-red-600 to-red-800 text-white px-3 py-1 flex items-center gap-1">
                  <img src={summary?.rank?.[0]?.tier === "CHALLENGER" ? CHALLENGER_BADGE : RANKED_BADGE} className="w-4 h-4" />
                  {rankBadge}
                </Badge>
                <Badge variant="outline" className="border-red-500 text-red-300">{platform?.toUpperCase()}</Badge>
                {liveGame && (
                  <Badge className="bg-green-600/20 text-green-300 border-green-500/30">
                    <Zap className="w-3 h-3 mr-1" /> En partida
                  </Badge>
                )}
              </div>
              <p className="text-red-200 text-sm">PUUID: {puuid ? puuid.slice(0, 12) + '…' : 'resolviendo…'}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* KPIs con diseño mejorado */}
        {overallStats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <Card className="bg-gray-800/50 border-red-700/30 backdrop-blur-sm">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-red-300">{overallStats.wins}W / {overallStats.losses}L</div>
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

        {/* Tabs con diseño mejorado */}
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
                    <Trophy className="h-5 w-5" />Top Maestría
                  </CardTitle>
                  <CardDescription className="text-gray-400">Campeones con más puntos de maestría</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-red-700/30">
                    {summary?.masteryTop?.slice(0, 5).map((m, i) => {
                      const champ = champs?.byKey[String(m.championId)];
                      return (
                        <div key={m.championId} className="flex items-center justify-between p-4 hover:bg-red-900/20 transition-colors">
                          <div className="flex items-center gap-3">
                            <img src={champ?.image} alt={champ?.name ?? String(m.championId)} className="w-12 h-12 rounded-lg object-cover border border-red-600/30"/>
                            <div>
                              <p className="font-semibold text-white">{champ?.name ?? String(m.championId)}</p>
                              <p className="text-sm text-gray-400">Nivel {m.level} • {m.points.toLocaleString()} pts</p>
                            </div>
                          </div>
                          <div className="w-10 h-10 bg-gradient-to-b from-yellow-700 to-yellow-500 rounded-lg flex items-center justify-center text-white font-bold">
                            #{i+1}
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
                    <Target className="h-5 w-5" />Rendimiento Reciente
                  </CardTitle>
                  <CardDescription className="text-gray-400">Últimas partidas (SoloQ/Flex)</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-red-700/30">
                    {recent.slice(0, 5).map((c, idx) => (
                      <div key={c.championId} className="flex items-center justify-between p-4 hover:bg-red-900/20 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-b from-red-700 to-red-500 rounded-lg flex items-center justify-center text-white font-bold">
                            #{idx+1}
                          </div>
                          <div>
                            <p className="font-semibold text-white">{c.championName}</p>
                            <p className="text-xs text-gray-400">{c.games} juegos • {c.wins}W/{c.losses}L • KDA {c.kda}</p>
                          </div>
                        </div>
                        <Badge className={
                          c.winRate >= 60 ? 'bg-green-600/20 text-green-300 border-green-500/30' : 
                          c.winRate >= 50 ? 'bg-yellow-600/20 text-yellow-300 border-yellow-500/30' : 
                          'bg-red-600/20 text-red-300 border-red-500/30'
                        }>
                          {c.winRate}%
                        </Badge>
                      </div>
                    ))}
                    {!recent.length && <p className="p-4 text-sm text-gray-400">Sin partidas recientes</p>}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* KPIs extendidos con gráficas */}
            {overallStats && (
              <Card className="bg-gray-800/30 border-red-700/30 backdrop-blur-sm">
                <CardHeader className="bg-gradient-to-r from-red-900/50 to-red-800/50 border-b border-red-700/30">
                  <CardTitle className="flex items-center gap-2 text-red-200">
                    <TrendingUp className="h-5 w-5" />Estadísticas de Desempeño
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
                        <p className="text-lg font-bold text-white">{overallStats.wins} Victorias / {overallStats.losses} Derrotas</p>
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
                  <Clock className="h-5 w-5" />Historial de Partidas
                </CardTitle>
                <CardDescription className="text-gray-400">Últimas partidas jugadas</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 p-4">
                {matchHistory.length
                  ? matchHistory.map((m) => (
                      <MatchRow key={m.matchId} match={m} champs={champs} staticData={staticData} />
                    ))
                  : <p className="text-sm text-gray-400">No hay partidas recientes</p>}
              </CardContent>
            </Card>
          </TabsContent>

          {/* CAMPEONES */}
          <TabsContent value="campeones" className="space-y-4">
            <Card className="bg-gray-800/30 border-red-700/30 backdrop-blur-sm">
              <CardHeader className="bg-gradient-to-r from-red-900/50 to-red-800/50 border-b border-red-700/30">
                <CardTitle className="flex items-center gap-2 text-red-200">
                  <Crown className="h-5 w-5" />Estadísticas por Campeón
                </CardTitle>
                <CardDescription className="text-gray-400">Rendimiento con cada campeón</CardDescription>
              </CardHeader>
              <CardContent>
                {championStats ? (
                  <div className="grid gap-4">
                    {Object.entries(championStats).slice(0, 10).map(([championId, stats]: [string, any]) => {
                      const champ = champs?.byKey[championId];
                      if (!champ) return null;
                      return (
                        <div key={championId} className="flex items-center gap-4 p-3 bg-red-900/20 rounded-lg border border-red-700/30">
                          <img src={champ.image} alt={champ.name} className="w-12 h-12 rounded-lg object-cover border border-red-600/30"/>
                          <div className="flex-grow">
                            <h3 className="font-bold text-white">{champ.name}</h3>
                            <div className="flex gap-4 text-xs text-gray-400">
                              <span>{stats.games} partidas</span>
                              <span className={stats.winRate >= 50 ? 'text-green-300' : 'text-red-300'}>{stats.winRate}% WR</span>
                              <span>KDA: {stats.kda}</span>
                            </div>
                          </div>
                          <div className="w-20">
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-gray-400">WR</span>
                              <span>{stats.winRate}%</span>
                            </div>
                            <Progress value={stats.winRate} className="h-2 bg-gray-700 [&>div]:bg-gradient-to-r [&>div]:from-red-500 [&>div]:to-red-700" />
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
                  <Zap className="h-5 w-5" />Partida en Curso
                </CardTitle>
                <CardDescription className="text-gray-400">
                  {liveGame ? 'Información de la partida actual' : 'No está en partida actualmente'}
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
                          {liveGame.participants.filter(p => p.teamId === 100).map((p, i) => (
                            <div key={i} className="flex items-center gap-2 text-sm p-2 bg-blue-900/20 rounded border border-blue-700/30">
                              <span className="text-white">{p.summonerName}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <h4 className="font-medium text-red-300 mb-2">Equipo Rojo</h4>
                        <div className="space-y-2">
                          {liveGame.participants.filter(p => p.teamId === 200).map((p, i) => (
                            <div key={i} className="flex items-center gap-2 text-sm p-2 bg-red-900/20 rounded border border-red-700/30">
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
                  <MessageCircle className="h-5 w-5" />Roasts de la Comunidad
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
                    <textarea className="w-full bg-gray-700 text-white p-3 rounded-lg border border-red-700/30 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none" rows={3} placeholder="Escribe tu comentario sobre este jugador..." />
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