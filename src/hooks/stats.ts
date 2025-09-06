// src/hooks/stats.ts
import { useMutation, useQuery } from "@tanstack/react-query";
import { axiosInstance } from "../lib/axios";
import type { Platform, Continent } from "../lib/utils";

type ResolveParams = { region: Platform; gameName: string; tagLine: string };
type ResolveResp = { puuid: string; gameName: string; tagLine: string };

export const useResolveSummoner = () =>
  useMutation<ResolveResp, any, ResolveParams>({
    mutationKey: ["resolveSummoner"],
    mutationFn: async (p) => {
      const { data } = await axiosInstance.get<ResolveResp>("/api/stats/resolve", {
        params: { region: p.region, gameName: p.gameName, tagLine: p.tagLine },
      });
      return data;
    },
  });

type SummaryResp = {
  summoner: { name: string; level: number };
  rank: { queue: string; tier: string; rank: string; lp: number }[] | null;
  masteryTop:
    | { championId: number; championName: string; level: number; points: number }[]
    | null;
};

export const useSummary = (platform?: Platform, puuid?: string) =>
  useQuery({
    queryKey: ["summary", platform, puuid],
    enabled: Boolean(platform && puuid),
    queryFn: async () => {
      const { data } = await axiosInstance.get<SummaryResp>(
        `/api/stats/summary/${platform}/${puuid}`
      );
      return data;
    },
  });

type MatchesResp = { ids: string[] };

export const useMatches = (continent?: Continent, puuid?: string, count = 10) =>
  useQuery({
    queryKey: ["matches", continent, puuid, count],
    enabled: false, // se dispara manualmente (botón)
    queryFn: async () => {
      const params = { start: 0, count };
      const { data } = await axiosInstance.get<MatchesResp>(
        `/api/stats/matches/${continent}/${puuid}`,
        { params }
      );
      return data;
    },
  });
