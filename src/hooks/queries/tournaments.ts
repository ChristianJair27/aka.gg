// Tournament query + mutation hooks — wrap the existing /api/tournaments endpoints.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { axiosInstance } from "@/lib/axios";
import { qk } from "./keys";

export interface Standing {
  position: number;
  team: string;
  wins: number;
  losses: number;
  points: number;
}

export interface BracketMatch {
  id: string;
  round: number;
  matchNumber: number;
  team1: string | null;
  team2: string | null;
  winner: string | null;
  code: string | null;
  matchStatus: string;
  score1?: number;
  score2?: number;
  gameId?: number;
  gameRegion?: string;
}

export type ViewerAccess = "owner" | "participant" | "public";

export interface Tournament {
  id: string;
  name: string;
  phase: "registration" | "checkin" | "active" | "complete";
  status: string;
  participants: number;
  maxParticipants: number;
  prize: string;
  startDate: string;
  format: string;
  description: string;
  riotTournamentId?: number;
  codesAvailable?: number;
  standings?: Standing[];
  bracket?: BracketMatch[];
  checkinDeadline?: string;
  createdBy?: number;
  viewerAccess?: ViewerAccess;
}

export interface TournamentDashboardData {
  invitations: TournamentInvitation[];
  myTeams: Array<{
    tournamentId: string;
    tournamentName: string;
    phase: string;
    teamName: string;
    captainRiotId: string;
    players: RosterPlayer[];
    checkedIn: boolean;
    activeMatchCode: string | null;
    activeMatchId: string | null;
    isCaptain: boolean;
  }>;
  administrating: Array<{
    id: string;
    name: string;
    phase: string;
    participants: number;
    maxParticipants: number;
    startDate: string;
    codesAvailable?: number;
  }>;
  linkedRiotId: string | null;
}

export function useTournaments() {
  return useQuery({
    queryKey: qk.tournaments(),
    queryFn: async () => {
      const { data } = await axiosInstance.get<Tournament[]>("/api/tournaments");
      return Array.isArray(data) ? data : [];
    },
  });
}

export function useTournament(id?: string, options?: { pollWhenActive?: boolean }) {
  return useQuery({
    queryKey: id ? qk.tournament(id) : qk.tournament("_"),
    enabled: Boolean(id),
    queryFn: async () => {
      const { data } = await axiosInstance.get<Tournament>(`/api/tournaments/${id}`);
      return data;
    },
    refetchInterval: (query) => {
      if (!options?.pollWhenActive) return false;
      const phase = query.state.data?.phase;
      return phase === "active" ? 20_000 : false;
    },
  });
}

// ── Tournament dashboard (detail view) — one aggregated payload ───────────────
export interface TdTeamRef { id: string; name: string; mono: string; color: string; score?: number | null; picks?: number[]; }
export interface TdBoardPayload {
  tournament: {
    id: string; name: string; season: string | null; startDate: string; endDate: string | null;
    format: string; patch: string; region: string; phase: string; status: string;
    prizePool: string; prizeFinal: string | null; teamsRegistered: number; teamsMax: number;
    checkinDeadline: string | null; logoUrl?: string | null; bannerUrl?: string | null;
  };
  bracket: Array<{ round: number; label: string; matches: Array<{
    id: string; round: number; matchStatus: string; teamA: TdTeamRef | null; teamB: TdTeamRef | null; winnerId: string | null; scheduledAt: string | null;
  }> }>;
  standings: Array<{ teamId: string; name: string; mono: string; color: string; wins: number; losses: number; winratePct: number; streak: { count: number; type: "W" | "L" } | null; points: number; position: number }>;
  liveMatch: { matchId: string; game: number; timer: number | null; code: string | null; teamA: TdTeamRef; teamB: TdTeamRef; goldDiffSeries: number[] } | null;
  myTeam: { tag: string; checkinDeadline: string | null; checkedIn: boolean; roster: Array<{ playerName: string; role: string | null; mainChampionId: number | null; rank: { tier: string; division: string; color: string } | null }> } | null;
  schedule: Array<{ matchId: string; scheduledAt: string | null; teamA: TdTeamRef | null; teamB: TdTeamRef | null; roundLabel: string; reminded: boolean }>;
  activityByDay: Array<{ day: string; games: number }>;
  version: string;
  viewerAccess: ViewerAccess;
}

export function useTournamentDashboard(id?: string) {
  return useQuery({
    queryKey: id ? qk.tournamentBoard(id) : qk.tournamentBoard("_"),
    enabled: Boolean(id),
    queryFn: async () => {
      const { data } = await axiosInstance.get<TdBoardPayload>(`/api/tournaments/${id}/dashboard`);
      return data;
    },
    refetchInterval: (query) => (query.state.data?.tournament.phase === "active" ? 15_000 : false),
  });
}

export interface RosterPlayer {
  name: string;
  riotId?: string;
  puuid?: string;
  userId?: number;
  inviteEmail?: string;
  inviteStatus?: "pending" | "accepted";
}

export interface Registration {
  teamName: string;
  captainRiotId: string;
  players: RosterPlayer[];
  contact: string;
  registeredAt: string;
  checkedIn: boolean;
  checkedInAt?: string;
}

export interface TournamentInvitation {
  id: number;
  tournamentId: string;
  tournamentName: string;
  teamName: string;
  invitedByUserId: number;
  invitedByName?: string;
  slotIndex: number;
  playerName?: string;
  status: "pending" | "accepted" | "declined";
  createdAt: string;
}

export function useRegistrations(id?: string) {
  return useQuery({
    queryKey: id ? qk.registrations(id) : qk.registrations("_"),
    enabled: Boolean(id),
    queryFn: async () => {
      const { data } = await axiosInstance.get<Registration[]>(`/api/tournaments/${id}/registrations`);
      return Array.isArray(data) ? data : [];
    },
  });
}

// ── Mutations ────────────────────────────────────────────────────────────────
// Tournament writes touch both the tournament (phase/bracket/standings) and its
// registrations. Where a clean optimistic update exists (register, check-in) we
// apply it with rollback; otherwise we do mutation + invalidate + toast so the
// cached reads reconcile with the server. All errors surface a sonner toast.

interface RegisterTeamInput {
  teamName: string;
  captainRiotId?: string;
  players: RosterPlayer[];
  contact: string;
}

export function useRegisterTeam(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: RegisterTeamInput) => {
      const { data } = await axiosInstance.post(`/api/tournaments/${id}/register`, input);
      return data;
    },
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: qk.registrations(id) });
      const prevRegs = qc.getQueryData<Registration[]>(qk.registrations(id));
      const prevTour = qc.getQueryData<Tournament>(qk.tournament(id));
      const optimistic: Registration = {
        teamName: input.teamName,
        captainRiotId: input.captainRiotId,
        players: input.players,
        contact: input.contact,
        registeredAt: new Date().toISOString(),
        checkedIn: false,
      };
      qc.setQueryData<Registration[]>(qk.registrations(id), (old) => [...(old ?? []), optimistic]);
      qc.setQueryData<Tournament>(qk.tournament(id), (old) =>
        old ? { ...old, participants: old.participants + 1 } : old,
      );
      return { prevRegs, prevTour };
    },
    onError: (_e, _input, ctx) => {
      if (ctx?.prevRegs) qc.setQueryData(qk.registrations(id), ctx.prevRegs);
      if (ctx?.prevTour) qc.setQueryData(qk.tournament(id), ctx.prevTour);
      toast.error("No se pudo inscribir el equipo");
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: qk.registrations(id) });
      qc.invalidateQueries({ queryKey: qk.tournament(id) });
      qc.invalidateQueries({ queryKey: qk.tournaments() });
    },
  });
}

interface CheckinInput {
  teamName: string;
  captainRiotId: string;
}

export function useCheckin(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CheckinInput) => {
      const { data } = await axiosInstance.post(`/api/tournaments/${id}/checkin`, input);
      return data as { checkedIn: number; total: number };
    },
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: qk.registrations(id) });
      const prevRegs = qc.getQueryData<Registration[]>(qk.registrations(id));
      qc.setQueryData<Registration[]>(qk.registrations(id), (old) =>
        (old ?? []).map((r) =>
          r.teamName === input.teamName
            ? { ...r, checkedIn: true, checkedInAt: new Date().toISOString() }
            : r,
        ),
      );
      return { prevRegs };
    },
    onError: (_e, _input, ctx) => {
      if (ctx?.prevRegs) qc.setQueryData(qk.registrations(id), ctx.prevRegs);
      toast.error("No se pudo hacer check-in");
    },
    onSettled: () => qc.invalidateQueries({ queryKey: qk.registrations(id) }),
  });
}

// Reconcile-only mutations: the server recomputes phase / bracket / standings, so
// after these we invalidate the affected reads rather than guess an optimistic state.
function invalidateTournament(qc: ReturnType<typeof useQueryClient>, id: string) {
  qc.invalidateQueries({ queryKey: qk.tournament(id) });
  qc.invalidateQueries({ queryKey: qk.registrations(id) });
  qc.invalidateQueries({ queryKey: qk.tournaments() });
}

export function useCloseRegistration(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await axiosInstance.post(`/api/tournaments/${id}/close-registration`);
    },
    onError: (e: any) =>
      toast.error("No se pudieron cerrar las inscripciones", {
        description: e?.response?.data?.error || e?.message,
      }),
    onSettled: () => invalidateTournament(qc, id),
  });
}

export function useStartTournament(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await axiosInstance.post(`/api/tournaments/${id}/start`);
    },
    onError: (e: any) =>
      toast.error("No se pudo iniciar el torneo", {
        description: e?.response?.data?.error || e?.message,
      }),
    onSettled: () => invalidateTournament(qc, id),
  });
}

export function useGenerateCodes(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (count: number = 20) => {
      const { data } = await axiosInstance.post(`/api/tournaments/${id}/generate-codes`, { count });
      return data as { generated: number; poolSize: number };
    },
    onSuccess: (data) => {
      toast.success(`${data.generated} códigos generados`, {
        description: `Pool disponible: ${data.poolSize}`,
      });
    },
    onError: (e: any) =>
      toast.error("No se pudieron generar los códigos", {
        description: e?.response?.data?.error || e?.message,
      }),
    onSettled: () => invalidateTournament(qc, id),
  });
}

export function useActivateMatch(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (matchId: string) => {
      const { data } = await axiosInstance.post(`/api/tournaments/${id}/matches/${matchId}/activate`);
      return (data?.code ?? null) as string | null;
    },
    onError: (e: any) =>
      toast.error("No se pudo activar el partido", {
        description: e?.response?.data?.error || e?.message,
      }),
    onSettled: () => invalidateTournament(qc, id),
  });
}

interface ReportResultInput {
  matchId: string;
  winner: string;
  score1: number;
  score2: number;
}

export function useMyTournamentDashboard() {
  const isAuth = Boolean(typeof localStorage !== "undefined" && localStorage.getItem("access_token"));
  return useQuery({
    queryKey: qk.tournamentDashboard(),
    enabled: isAuth,
    queryFn: async () => {
      const { data } = await axiosInstance.get<TournamentDashboardData>("/api/tournaments/me/dashboard");
      return data;
    },
    refetchInterval: 25_000,
  });
}

export function useTournamentInvitations() {
  const isAuth = Boolean(typeof localStorage !== "undefined" && localStorage.getItem("access_token"));
  return useQuery({
    queryKey: qk.invitations(),
    enabled: isAuth,
    queryFn: async () => {
      const { data } = await axiosInstance.get<TournamentInvitation[]>("/api/tournaments/invitations/me");
      return Array.isArray(data) ? data : [];
    },
    refetchInterval: 30_000,
  });
}

export function useRespondInvitation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ invId, action }: { invId: number; action: "accept" | "decline" }) => {
      const { data } = await axiosInstance.post(`/api/tournaments/invitations/${invId}/respond`, { action });
      return data;
    },
    onSuccess: (_data, { action }) => {
      toast.success(action === "accept" ? "¡Invitación aceptada!" : "Invitación rechazada");
    },
    onError: (e: any) => {
      const code = e?.response?.data?.code;
      if (code === "RIOT_NOT_LINKED") {
        toast.error("Vincula tu cuenta de LoL primero", {
          description: "Ve a tu Dashboard y conecta tu Riot ID antes de aceptar.",
        });
      } else {
        toast.error("No se pudo responder la invitación", {
          description: e?.response?.data?.error || e?.message,
        });
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: qk.invitations() });
      qc.invalidateQueries({ queryKey: qk.tournamentDashboard() });
      qc.invalidateQueries({ queryKey: qk.tournaments() });
    },
  });
}

export function useSyncGames(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await axiosInstance.post(`/api/tournaments/${id}/sync-games`);
      return data as { synced: number; details: unknown[] };
    },
    onSuccess: (data) => {
      toast.success(`Sincronización completa`, {
        description: `${data.synced} partida(s) actualizada(s)`,
      });
    },
    onError: (e: any) =>
      toast.error("Error al sincronizar", { description: e?.response?.data?.error || e?.message }),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: qk.tournament(id) });
      qc.invalidateQueries({ queryKey: qk.tournaments() });
    },
  });
}

export function useReportResult(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ matchId, winner, score1, score2 }: ReportResultInput) => {
      const { data } = await axiosInstance.post(
        `/api/tournaments/${id}/matches/${matchId}/result`,
        { winner, score1, score2 },
      );
      return data as { tournamentComplete?: boolean; champion?: string };
    },
    onSuccess: (data, { winner }) => {
      if (data.tournamentComplete) {
        toast.success("🏆 ¡Torneo finalizado!", {
          description: `Campeón: ${data.champion}`,
          duration: 8000,
        });
      } else {
        toast.success("Resultado registrado", { description: `${winner} avanza` });
      }
    },
    onError: (e: any) =>
      toast.error("No se pudo registrar el resultado", {
        description: e?.response?.data?.error || e?.message,
      }),
    onSettled: () => invalidateTournament(qc, id),
  });
}
