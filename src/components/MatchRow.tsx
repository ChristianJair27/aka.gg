// src/components/MatchRow.tsx
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type TeamEntry = {
  teamId: 100 | 200;
  championId: number;
  summonerName?: string;
  puuid?: string;
};

type MatchDetail = {
  matchId: string;
  win: boolean;
  championId: number;
  championLevel?: number;
  gameStartTimestamp: number;      // ms
  gameDuration: number;            // s
  gameMode?: string;
  queueId?: number;
  kills: number; deaths: number; assists: number;
  kda: number;
  cs?: number;
  totalMinionsKilled?: number;
  neutralMinionsKilled?: number;
  killParticipation?: number;      // 0..1
  totalDamageDealtToChampions?: number;
  gold?: number;
  items?: number[];                // 0..6
  trinket?: number;
  summonerSpells?: number[];       // [id,id]
  perks?: { styles?: { selections?: { perk: number }[]; style?: number }[] };
  playerAugments?: number[];
  teamParticipants?: TeamEntry[];  // (tu shape actual)
};

export function MatchRow({
  match,
  champs,
  staticData,
  mePuuid,               // <-- opcional: resalta al dueño del perfil
}: {
  match: MatchDetail;
  champs: any; // tu useChampions (espera champs.byKey[key].image/name)
  staticData: ReturnType<typeof useStaticData>;
  mePuuid?: string;
}) {
  const c = champs?.byKey[String(match.championId)];
  const minutes = Math.max(1, Math.round(match.gameDuration / 60));
  const time = new Date(match.gameStartTimestamp);
  const cs = match.cs ?? (match.totalMinionsKilled ?? 0) + (match.neutralMinionsKilled ?? 0);
  const csPerMin = (cs / minutes).toFixed(1);
  const kp = match.killParticipation ? Math.round(match.killParticipation * 100) : undefined;
  const itemIds = (match.items ?? []).slice(0, 6);
  const trinket = match.trinket ?? match.items?.[6];
  const keystone = match.perks?.styles?.[0]?.selections?.[0]?.perk;
  const secondary = match.perks?.styles?.[1]?.style;

  const qLabel = (qid?: number) =>
    ({ 420: "Ranked Solo", 440: "Ranked Flex", 450: "ARAM", 1700: "Arena" } as any)[qid ?? -1] ||
    match.gameMode ||
    "Partida";

  const timeAgo = (ms: number) => {
    const diff = Date.now() - ms;
    const m = Math.floor(diff / 60000);
    if (m < 60) return `hace ${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `hace ${h}h`;
    const d = Math.floor(h / 24);
    return `hace ${d}d`;
  };
  const fmtDur = (s: number) => `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;

  const team = (tid: 100 | 200) => (match.teamParticipants ?? []).filter((t) => t.teamId === tid);

  return (
    <div
      className={cn(
        "p-4 rounded-xl relative overflow-hidden backdrop-blur-sm",
        "border border-gray-700/60",
        match.win ? "bg-emerald-900/10 ring-1 ring-emerald-500/20" : "bg-rose-900/10 ring-1 ring-rose-500/20"
      )}
    >
      {/* top row */}
      <div className="flex items-center gap-4">
        <div className="relative">
          <img src={c?.image} className="w-14 h-14 rounded-lg border border-gray-600 object-cover" />
          {match.championLevel != null && (
            <span className="absolute -bottom-1 -right-1 text-[10px] px-1.5 py-0.5 rounded bg-gray-900/80 border border-gray-700">
              {match.championLevel}
            </span>
          )}
        </div>

        <div className="flex-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-semibold">{c?.name ?? "Campeón"}</span>
              <span
                className={cn(
                  "text-xs px-2 py-0.5 rounded",
                  match.win ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300"
                )}
              >
                {match.win ? "Victoria" : "Derrota"}
              </span>
              <span className="text-xs text-gray-400">{qLabel(match.queueId)}</span>
            </div>
            <div className="text-xs text-gray-400">
              {timeAgo(match.gameStartTimestamp)} · {fmtDur(match.gameDuration)}
            </div>
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs">
            <span className="text-blue-300 font-semibold">
              {match.kills}/{match.deaths}/{match.assists}
            </span>
            <span className="text-gray-400">KDA {match.kda.toFixed(2)}</span>
            <span className="text-gray-400">
              CS {cs} ({csPerMin}/m)
            </span>
            {typeof kp === "number" && <span className="text-gray-400">KP {kp}%</span>}
            {match.totalDamageDealtToChampions != null && (
              <span className="text-gray-400">
                Daño {match.totalDamageDealtToChampions.toLocaleString?.()}
              </span>
            )}
            {match.gold != null && <span className="text-gray-400">Oro {match.gold.toLocaleString?.()}</span>}
          </div>
        </div>

        {/* spells + runas */}
        <div className="flex flex-col items-center gap-1">
          <div className="flex gap-1">
            {match.summonerSpells?.map((id) => {
              const s = staticData.spells[String(id)];
              return (
                <TooltipProvider key={id}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <img src={s?.icon} className="w-7 h-7 rounded border border-gray-600" />
                    </TooltipTrigger>
                    <TooltipContent>{s?.name}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              );
            })}
          </div>
          <div className="flex gap-1">
            {keystone && (
              <img src={staticData.runes[keystone]?.icon} className="w-7 h-7 rounded-full border border-gray-600" />
            )}
            {secondary && (
              <img
                src={staticData.runes[secondary]?.icon}
                className="w-7 h-7 rounded-full border border-gray-600 opacity-80"
              />
            )}
          </div>
        </div>
      </div>

      {/* items + trinket */}
      <div className="mt-3 flex items-center gap-2 overflow-x-auto">
        {Array.from({ length: 6 }).map((_, i) => {
          const id = itemIds[i];
          const it = id ? staticData.items[String(id)] : null;
          return it ? (
            <TooltipProvider key={i}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <img src={it.icon} className="w-8 h-8 rounded border border-gray-600 shrink-0" />
                </TooltipTrigger>
                <TooltipContent className="max-w-[240px]">
                  <p className="font-medium">{it.name}</p>
                  <p className="text-xs opacity-80">{it.desc}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <div key={i} className="w-8 h-8 rounded border border-dashed border-gray-700 bg-gray-800/40 shrink-0" />
          );
        })}
        <div className="ml-2">
          {trinket && staticData.items[String(trinket)] ? (
            <img
              src={staticData.items[String(trinket)].icon}
              className="w-8 h-8 rounded border border-yellow-600/60"
            />
          ) : (
            <div className="w-8 h-8 rounded border border-dashed border-gray-700 bg-gray-800/40" />
          )}
        </div>
      </div>

      {/* ROSTERS completos con nombres */}
      {!!match.teamParticipants?.length && (
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          {/* Equipo Azul */}
          <div className="rounded-lg bg-black/10 p-2">
            <div className="mb-1 text-xs font-medium text-sky-200/90">Equipo Azul</div>
            <div className="grid grid-cols-1 gap-1">
              {team(100).map((p, i) => {
                const cc = champs?.byKey[String(p.championId)];
                const highlight = mePuuid && p.puuid && p.puuid === mePuuid;
                return (
                  <div
                    key={`${p.puuid ?? i}-blue`}
                    className={cn(
                      "flex items-center gap-2 truncate",
                      highlight && "font-semibold text-red-200"
                    )}
                    title={p.summonerName ?? "Invocador"}
                  >
                    <img src={cc?.image} className="w-5 h-5 rounded border border-gray-700" />
                    <span className="text-xs text-gray-300 truncate">{p.summonerName ?? "Invocador"}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Equipo Rojo */}
          <div className="rounded-lg bg-black/10 p-2">
            <div className="mb-1 text-xs font-medium text-rose-200/90">Equipo Rojo</div>
            <div className="grid grid-cols-1 gap-1">
              {team(200).map((p, i) => {
                const cc = champs?.byKey[String(p.championId)];
                const highlight = mePuuid && p.puuid && p.puuid === mePuuid;
                return (
                  <div
                    key={`${p.puuid ?? i}-red`}
                    className={cn(
                      "flex items-center gap-2 truncate",
                      highlight && "font-semibold text-red-200"
                    )}
                    title={p.summonerName ?? "Invocador"}
                  >
                    <img src={cc?.image} className="w-5 h-5 rounded border border-gray-700" />
                    <span className="text-xs text-gray-300 truncate">{p.summonerName ?? "Invocador"}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Arena augments */}
      {match.gameMode?.toLowerCase()?.includes("arena") && match.playerAugments?.length ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {match.playerAugments.map((id) => {
            const a = staticData.augments[id];
            return (
              <div
                key={id}
                className="px-2 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-200 text-xs flex items-center gap-2"
              >
                {a?.icon && <img src={a.icon} className="w-4 h-4 rounded" />}
                <span>{a?.name || `Augment ${id}`}</span>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}