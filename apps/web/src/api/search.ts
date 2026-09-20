// GET /api/search (M3P2.4): the candidate goals for what someone typed.

import { getJson } from "./client";
import type { SearchOut } from "./schema";

export const SEARCH_LIMIT = 10;

export function searchUrl(words: string, limit = SEARCH_LIMIT): string {
  const query = new URLSearchParams({ q: words, limit: String(limit) });
  return `/api/search?${query}`;
}

export const fetchSearch = (words: string, signal?: AbortSignal): Promise<SearchOut> =>
  getJson<SearchOut>(searchUrl(words), signal);
