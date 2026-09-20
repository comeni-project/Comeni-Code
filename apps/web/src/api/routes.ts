// GET /api/routes (M2P4.2): the woven route to one or more goals.

import { getJson } from "./client";
import type { RouteOut } from "./schema";

export function routeUrl(goals: readonly string[], known: readonly string[] = []): string {
  const query = new URLSearchParams();
  for (const goal of goals) query.append("goal", goal);
  for (const topic of known) query.append("known", topic);
  return `/api/routes?${query}`;
}

export const fetchRoute = (
  goals: readonly string[],
  known: readonly string[] = [],
  signal?: AbortSignal,
): Promise<RouteOut> => getJson<RouteOut>(routeUrl(goals, known), signal);
