// GET /api/nodes/{id} (M1P6.3, M3P1.4): one node, with its neighbours, resources and questions.

import { getJson } from "./client";
import type { NodeOut } from "./schema";

export const nodeUrl = (id: string): string => `/api/nodes/${encodeURIComponent(id)}`;

export const fetchNode = (id: string, signal?: AbortSignal): Promise<NodeOut> =>
  getJson<NodeOut>(nodeUrl(id), signal);
