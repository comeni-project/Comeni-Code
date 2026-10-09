// Every question the pages ask the API, and the one place their cache keys are made (spec M4R.5).
//
// A key holds each part of the question by name, so two different questions never share a cache
// entry: Start's goals salmon and kallisto are not the Route page's goal salmon with kallisto known
// (#137). The same question from two pages is one entry, on purpose: Start's preview is the route
// with nothing known, which the Route page reuses.
import { type QueryClient, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchInvite, fetchInvites, fetchMe, fetchMembers } from "./accounts";
import { fetchProviders } from "./auth";
import { getJson } from "./client";
import { type DraftState, fetchChecks, fetchDraft, fetchDrafts } from "./drafts";
import { fetchHealth } from "./health";
import { fetchNode } from "./nodes";
import { fetchRoute } from "./routes";
import type { DraftOut, IndexOut } from "./schema";
import { fetchSearch } from "./search";

// A tab coming back does not re-ask every question; a write's answer updates what it changed (M4K.4).
// The app and the tests share this.
export const QUERIES = { staleTime: 60_000 };

export const queryKeys = {
  health: ["health"] as const,
  node: (id: string) => ["node", id] as const,
  route: (goals: readonly string[], known: readonly string[]) =>
    ["route", { goals: [...goals], known: [...known] }] as const,
  search: (words: string) => ["search", words] as const,
  me: ["me"] as const,
  providers: ["providers"] as const,
  invite: (token: string) => ["invite", token] as const,
  teamMembers: ["team", "members"] as const,
  teamInvites: ["team", "invites"] as const,
  drafts: (state: DraftState) => ["drafts", state] as const,
  draft: (id: string) => ["draft", id] as const,
  draftChecks: (id: string) => ["draft", id, "checks"] as const,
  studioIndex: ["studio-index"] as const,
};

export const useNode = (id: string) =>
  useQuery({
    queryKey: queryKeys.node(id),
    queryFn: ({ signal }) => fetchNode(id, signal),
    retry: false,
  });

/** The route to `goals`; nothing is asked until there is a goal. */
export const useRoute = (goals: readonly string[], known: readonly string[]) =>
  useQuery({
    queryKey: queryKeys.route(goals, known),
    queryFn: ({ signal }) => fetchRoute(goals, known, signal),
    enabled: goals.length > 0,
    retry: false,
  });

/** The candidates for typed words; nothing is asked for blank ones. */
export const useSearch = (words: string) =>
  useQuery({
    queryKey: queryKeys.search(words),
    queryFn: ({ signal }) => fetchSearch(words, signal),
    enabled: words.trim() !== "",
    retry: false,
  });

/** The health report, asked again every `pollMs` (false: once). */
export const useHealth = (pollMs: number | false) =>
  useQuery({
    queryKey: queryKeys.health,
    queryFn: ({ signal }) => fetchHealth(signal),
    refetchInterval: pollMs,
    retry: false,
  });

/** Who is signed in: the one answer the bar, the menu, the gate and Team read (M4S.3). */
export const useMe = () =>
  useQuery({ queryKey: queryKeys.me, queryFn: ({ signal }) => fetchMe(signal), retry: false });

export const useProviders = () =>
  useQuery({
    queryKey: queryKeys.providers,
    queryFn: ({ signal }) => fetchProviders(signal),
    retry: false,
    staleTime: Number.POSITIVE_INFINITY,
  });

export const useInvite = (token: string) =>
  useQuery({
    queryKey: queryKeys.invite(token),
    queryFn: ({ signal }) => fetchInvite(token, signal),
    retry: false,
  });

export const useMembers = () =>
  useQuery({
    queryKey: queryKeys.teamMembers,
    queryFn: ({ signal }) => fetchMembers(signal),
    retry: false,
  });

export const useInvites = () =>
  useQuery({
    queryKey: queryKeys.teamInvites,
    queryFn: ({ signal }) => fetchInvites(signal),
    retry: false,
  });

/** After signing in, up or out: ask again who is signed in. */
export function useAuthChange() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: queryKeys.me });
}

/** After any team change: both of the team's lists are asked again. */
export function useTeamChange() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: ["team"] });
}

export const useDrafts = (state: DraftState, enabled = true) =>
  useQuery({
    queryKey: queryKeys.drafts(state),
    queryFn: ({ signal }) => fetchDrafts(state, signal),
    enabled,
    retry: false,
  });

export const useDraft = (id: string) =>
  useQuery({
    queryKey: queryKeys.draft(id),
    queryFn: ({ signal }) => fetchDraft(id, signal),
    retry: false,
  });

/** Checks, asked only while something shows them (M4K.4). */
export const useDraftChecks = (id: string, enabled: boolean) =>
  useQuery({
    queryKey: queryKeys.draftChecks(id),
    queryFn: ({ signal }) => fetchChecks(id, signal),
    enabled,
    retry: false,
  });

/** The regions, once: they change only with a content change. */
export const useRegions = () =>
  useQuery({
    queryKey: queryKeys.studioIndex,
    queryFn: ({ signal }) => getJson<IndexOut>("/api/studio/index", signal),
    select: (index) => index.regions,
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
  });

/** A draft made, or moved to another state: its answer in place, and the Drafts lists asked again
 * when next shown (#255). */
export function draftMoved(client: QueryClient, draft: DraftOut) {
  client.setQueryData(queryKeys.draft(draft.public_id), draft);
  return client.invalidateQueries({ queryKey: ["drafts"] });
}
