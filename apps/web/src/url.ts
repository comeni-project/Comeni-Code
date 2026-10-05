// The route a page was reached from, kept in its URL (M3P3.2, M3P5.4): goals and what is known.
import { useSearchParams } from "react-router";

/** The goals and known topics in the current URL, in the order they were written. */
export function useRouteParams(): { goals: string[]; known: string[] } {
  const [params] = useSearchParams();
  return { goals: params.getAll("goal"), known: params.getAll("known") };
}

/** A path with the route it was reached from, so the next page knows it too. */
export function withRoute(
  path: string,
  goals: readonly string[],
  known: readonly string[],
): string {
  const query = new URLSearchParams();
  for (const goal of goals) query.append("goal", goal);
  for (const topic of known) query.append("known", topic);
  const tail = query.toString();
  return tail === "" ? path : `${path}?${tail}`;
}
