import { sendJson } from "./client";
import type { SearchOut } from "./schema";

export const suggestGoals = (query: string): Promise<SearchOut> =>
  sendJson<SearchOut>("POST", "/api/goals/suggest", { query });
