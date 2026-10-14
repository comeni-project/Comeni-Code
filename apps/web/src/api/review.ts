// The review API (M4.9a, M4.9b): the queue, a draft's review, verdicts, answers, and the two
// decisions on a draft. The review page never reads GET …/drafts/{id}: it shows answers (#189).
import { getJson, sendJson } from "./client";
import type { DraftOut, QueuedDraftOut, ReviewOut, ReviewQuestionOut } from "./schema";

const DRAFTS = "/api/studio/drafts";

export interface VerdictIn {
  key: string;
  verdict: "approved" | "changes" | null;
  note?: string;
}

export const fetchQueue = (signal?: AbortSignal) =>
  getJson<QueuedDraftOut[]>("/api/studio/review", signal);

export const fetchReview = (id: string, signal?: AbortSignal) =>
  getJson<ReviewOut>(`${DRAFTS}/${id}/review`, signal);

export const putVerdicts = (id: string, revision: number, verdicts: VerdictIn[]) =>
  sendJson<ReviewOut>("PUT", `${DRAFTS}/${id}/review/verdicts`, { revision, verdicts });

export const putAnswer = (id: string, questionId: string, given: unknown) =>
  sendJson<ReviewQuestionOut>("PUT", `${DRAFTS}/${id}/review/answers/${questionId}`, { given });

export const approveDraft = (id: string, revision: number, reason: string) =>
  sendJson<DraftOut>("POST", `${DRAFTS}/${id}/approve`, { revision, reason });

export const sendBack = (id: string, revision: number, reason: string) =>
  sendJson<DraftOut>("POST", `${DRAFTS}/${id}/send-back`, { revision, reason });
