// Every question the pages ask the API, and the one place their cache keys are made (spec M4R.5).
//
// A key holds each part of the question by name, so two different questions never share a cache
// entry: Start's goals salmon and kallisto are not the Route page's goal salmon with kallisto known
// (#137). The same question from two pages is one entry, on purpose: Start's preview is the route
// with nothing known, which the Route page reuses.
import { useQuery } from "@tanstack/react-query";
import { fetchHealth } from "./health";
import { fetchNode } from "./nodes";
import { fetchRoute } from "./routes";
import { fetchSearch } from "./search";

export const queryKeys = {
  health: ["health"] as const,
  node: (id: string) => ["node", id] as const,
  route: (goals: readonly string[], known: readonly string[]) =>
    ["route", { goals: [...goals], known: [...known] }] as const,
  search: (words: string) => ["search", words] as const,
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
