import { getJson, sendJson } from "./client";
import type { AssistantSessionListOut, AssistantSessionOut, AssistantTurnIn } from "./schema";

const BASE = "/api/studio/assistant/sessions";

export const fetchAssistantSessions = (signal?: AbortSignal) =>
  getJson<AssistantSessionListOut[]>(BASE, signal);

export const fetchAssistantSession = (id: string, signal?: AbortSignal) =>
  getJson<AssistantSessionOut>(`${BASE}/${id}`, signal);

export const createAssistantSession = (draft_id: string) =>
  sendJson<AssistantSessionOut>("POST", BASE, { draft_id });

export const sendAssistantTurn = (id: string, body: AssistantTurnIn) =>
  sendJson<AssistantSessionOut>("POST", `${BASE}/${id}/turns`, body);
