// ATAK AI query hooks — wrap the deployed /api/ai-* endpoints that turn a
// player's / match's stats into a few short, colored tag chips (LLM-backed,
// cached server-side). Responses can take a few seconds, so cache them well and
// only fire once we actually have stats to send.
import { useQuery } from "@tanstack/react-query";
import { axiosInstance } from "@/lib/axios";
import { qk } from "./keys";

// Chip color intent, mirrored by <AiTags/>.
export type AiKind = "pos" | "warn" | "gold" | "dim";
export interface AiTag {
  label: string;
  kind: AiKind;
}

// ── Player insights ──────────────────────────────────────────────────────────
export interface AiInsightsStats {
  rank?: string | null;
  winRate?: number | null;
  kda?: number | null;
  mostPlayed?: string | null;
  totalGames?: number | null;
}

export interface AiInsightsInput {
  riotId: string;
  region: string;
  stats: AiInsightsStats;
}

export interface AiInsightsResponse {
  tags: AiTag[];
  insights?: string;
  unavailable?: boolean;
}

// POST /api/ai-insights — enabled only when we have an input with stats.
export function useAiInsights(input: AiInsightsInput | null) {
  return useQuery({
    queryKey: qk.ai.insights(input?.riotId ?? ""),
    enabled: Boolean(input && input.stats),
    staleTime: 10 * 60_000, // 10 min — LLM output is stable + cached server-side
    queryFn: async () => {
      const { data } = await axiosInstance.post<AiInsightsResponse>(
        "/api/ai-insights",
        input,
      );
      return data;
    },
  });
}

// ── Per-match tags ───────────────────────────────────────────────────────────
export interface AiMatchData {
  matchId: string;
  win: boolean;
  kda: number;
  cs: number;
  role: string;
  kills: number;
  deaths: number;
  assists: number;
  championName: string;
}

export interface AiMatchTagsResponse {
  tags: AiTag[];
  unavailable?: boolean;
}

// POST /api/ai-match-tags — keyed by matchId, enabled once we have one.
export function useAiMatchTags(matchData: AiMatchData | null) {
  return useQuery({
    queryKey: qk.ai.matchTags(matchData?.matchId ?? ""),
    enabled: Boolean(matchData?.matchId),
    staleTime: 60 * 60_000, // 1 h — a finished match never changes
    queryFn: async () => {
      const { data } = await axiosInstance.post<AiMatchTagsResponse>(
        "/api/ai-match-tags",
        { matchData },
      );
      return data;
    },
  });
}
