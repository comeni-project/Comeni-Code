// GET /api/studio/problem-kits (M6.8b spec, M6PB.4): what the problem builder knows about each kit.
import { getJson } from "./client";
import type { ProblemKitOut } from "./schema";

export const fetchKits = (signal?: AbortSignal): Promise<ProblemKitOut[]> =>
  getJson<ProblemKitOut[]>("/api/studio/problem-kits", signal);
