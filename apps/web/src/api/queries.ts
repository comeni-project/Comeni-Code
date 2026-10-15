// Every question the pages ask the API, and the one place their cache keys are made (spec M4R.5).
//
// A key holds each part of the question by name, so two different questions never share a cache
// entry: Start's goals salmon and kallisto are not the Route page's goal salmon with kallisto known
// (#137). The same question from two pages is one entry, on purpose: Start's preview is the route
// with nothing known, which the Route page reuses.
import { type QueryClient, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { fetchInvite, fetchInvites, fetchMe, fetchMembers } from "./accounts";
import { fetchProviders } from "./auth";
import { getJson } from "./client";
import { type DraftState, fetchChecks, fetchDraft, fetchDrafts } from "./drafts";
import { fetchHealth } from "./health";
import { fetchLanding, fetchLandings, fetchReady, moving } from "./landing";
import { fetchNode } from "./nodes";
import { fetchQueue, fetchReview } from "./review";
import { fetchRoute } from "./routes";
import type {
  DraftOut,
  IndexOut,
  LandingOut,
  QueuedDraftOut,
  ReviewOut,
  ReviewQuestionOut,
} from "./schema";
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
  reviewQueue: ["review-queue"] as const,
  review: (id: string) => ["review", id] as const,
  landReady: ["land", "ready"] as const,
  landings: ["land", "landings"] as const,
  landing: (id: string) => ["land", "landing", id] as const,
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

/** The drafts to review and their keys: one GET opens the review page (M4.9b spec, M4RS.1). */
export const useReviewQueue = () =>
  useQuery({
    queryKey: queryKeys.reviewQueue,
    queryFn: ({ signal }) => fetchQueue(signal),
    retry: false,
  });

/** A draft's review, asked once, when one of its blocks is first opened (M4RS.4). */
export const useReview = (id: string | null) =>
  useQuery({
    queryKey: queryKeys.review(id ?? ""),
    queryFn: ({ signal }) => fetchReview(id ?? "", signal),
    enabled: id !== null,
    retry: false,
  });

/** A review a write answered with: in its own cache, and its verdicts and answers in the queue. */
export function reviewed(client: QueryClient, draftId: string, review: ReviewOut) {
  client.setQueryData(queryKeys.review(draftId), review);
  const by = new Map(review.items.map((item) => [item.key, item]));
  client.setQueryData<QueuedDraftOut[]>(queryKeys.reviewQueue, (queue) =>
    queue?.map((draft) =>
      draft.public_id !== draftId
        ? draft
        : {
            ...draft,
            keys: draft.keys.map((key) => {
              const now = by.get(key.key);
              if (now === undefined) return key;
              const answered = now.question === null ? null : now.question.given !== null;
              return { ...key, verdict: now.verdict, answered };
            }),
          },
    ),
  );
}

/** A draft approved or sent back leaves the queue (M4RS.4). Its review is marked stale, not
 * removed: removing it while the open block still watches it would ask for it again, and a draft
 * no longer submitted has none (#294). It is asked afresh when next opened. */
export function decided(client: QueryClient, draft: DraftOut) {
  client.setQueryData<QueuedDraftOut[]>(queryKeys.reviewQueue, (queue) =>
    queue?.filter((queued) => queued.public_id !== draft.public_id),
  );
  void client.invalidateQueries({
    queryKey: queryKeys.review(draft.public_id),
    refetchType: "none",
  });
  return draftMoved(client, draft);
}

/** One answered question, into the cached review and the queue (M4RS.4): nothing is asked again. */
export function answeredInto(client: QueryClient, draftId: string, question: ReviewQuestionOut) {
  const key = `${question.pool}/${question.id}`;
  client.setQueryData<ReviewOut>(queryKeys.review(draftId), (review) =>
    review === undefined
      ? review
      : { ...review, items: review.items.map((i) => (i.key === key ? { ...i, question } : i)) },
  );
  client.setQueryData<QueuedDraftOut[]>(queryKeys.reviewQueue, (queue) =>
    queue?.map((d) =>
      d.public_id !== draftId
        ? d
        : { ...d, keys: d.keys.map((k) => (k.key === key ? { ...k, answered: true } : k)) },
    ),
  );
}

/** A landing is asked for again this often, only while it moves (M4.9c spec, M4LS.2). */
export const LANDING_POLL_MS = 15_000;

/** Approved drafts no landing holds: Land's table (M4LS.1). */
export const useReadyDrafts = () =>
  useQuery({
    queryKey: queryKeys.landReady,
    queryFn: ({ signal }) => fetchReady(signal),
    retry: false,
  });

/** Every landing, newest first: Land's other views, filtered here. */
export const useLandings = () =>
  useQuery({
    queryKey: queryKeys.landings,
    queryFn: ({ signal }) => fetchLandings(signal),
    retry: false,
  });

/** The index and main, whole; `useRegions` reads the same entry. */
export const useStudioIndex = () =>
  useQuery({
    queryKey: queryKeys.studioIndex,
    queryFn: ({ signal }) => getJson<IndexOut>("/api/studio/index", signal),
    retry: false,
  });

/** The ready list, the landings and the index asked again: a landing started, closed or settled. */
function landChanged(client: QueryClient) {
  void client.invalidateQueries({ queryKey: queryKeys.landReady });
  void client.invalidateQueries({ queryKey: queryKeys.landings });
  void client.invalidateQueries({ queryKey: ["drafts"] });
  void client.invalidateQueries({ queryKey: queryKeys.studioIndex }); // a landing landed (#321)
}

/** A write's answer in place, and the lists asked again. */
export function landingMoved(client: QueryClient, made: LandingOut) {
  client.setQueryData(queryKeys.landing(made.public_id), made);
  landChanged(client);
}

/**
 * One landing, starting from the list's copy (no GET on open), asked again every 15 s while it
 * moves. When it settles, the lists are asked once. Key the component by the landing's id, so a
 * new landing starts its own watch.
 */
export function useLanding(listed: LandingOut) {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: queryKeys.landing(listed.public_id),
    queryFn: ({ signal }) => fetchLanding(listed.public_id, signal),
    initialData: listed,
    staleTime: Number.POSITIVE_INFINITY,
    refetchInterval: (q) =>
      q.state.data !== undefined && moving(q.state.data) ? LANDING_POLL_MS : false,
    retry: false,
  });
  // The list's copy wins once it has settled and the one held has not: a card opened again
  // after its landing moved on unwatched (#320).
  useEffect(() => {
    const key = queryKeys.landing(listed.public_id);
    const held = client.getQueryData<LandingOut>(key);
    if (held !== undefined && moving(held) && !moving(listed)) client.setQueryData(key, listed);
  }, [listed, client]);
  const was = useRef(moving(query.data));
  useEffect(() => {
    const now = moving(query.data);
    if (was.current && !now) landChanged(client);
    was.current = now;
  }, [query.data, client]);
  return query;
}
