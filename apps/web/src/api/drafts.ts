// The drafts API (M4.4 spec, M4W; M4.5, M4R): list, open, read, check, and the review steps a
// workbench takes. Edits go through the workbench's one executor, never from here.
import { getJson, sendJson } from "./client";
import type { ChecklistOut, DraftOut, DraftSummaryOut, OpenIn } from "./schema";

const BASE = "/api/studio/drafts";
export type DraftState = "open" | "submitted";

export const fetchDrafts = (state: DraftState, signal?: AbortSignal) =>
  getJson<DraftSummaryOut[]>(`${BASE}?state=${state}`, signal);

export const fetchDraft = (id: string, signal?: AbortSignal) =>
  getJson<DraftOut>(`${BASE}/${id}`, signal);

export const openDraft = (body: OpenIn) => sendJson<DraftOut>("POST", BASE, body);

/** The checklist and the problems behind it: one request for Checks (M4K.6). */
export const fetchChecks = (id: string, signal?: AbortSignal) =>
  getJson<ChecklistOut>(`${BASE}/${id}/checklist`, signal);

export const submitDraft = (id: string, revision: number) =>
  sendJson<DraftOut>("POST", `${BASE}/${id}/submit`, { revision });

export const withdrawDraft = (id: string) => sendJson<DraftOut>("POST", `${BASE}/${id}/withdraw`);

export const discardDraft = (id: string) => sendJson<DraftOut>("POST", `${BASE}/${id}/discard`);
