// Every change a workbench makes, as a command (M4K.2): a method, a path under the draft and a
// body without the revision. `sendEdit` adds the revision and sends it; nothing else writes.
import { sendJson } from "../../api/client";
import type {
  BlockIn,
  ExamQuestionIn,
  FieldsIn,
  LinkIn,
  ResourceIn,
  SavedOut,
  TryQuestionIn,
} from "../../api/schema";

export interface Edit {
  method: "PATCH" | "PUT" | "POST" | "DELETE";
  path: string;
  body?: Record<string, unknown>;
}

export type LinkKind = "needs" | "goes_deeper" | "related";

export const fields = (change: Omit<FieldsIn, "revision">): Edit => ({
  method: "PATCH",
  path: "fields",
  body: change,
});

export const links = (kind: LinkKind, list: LinkIn[]): Edit => ({
  method: "PUT",
  path: `links/${kind}`,
  body: { links: list },
});

export const insertBlock = (at: number, block: BlockIn, question?: TryQuestionIn): Edit => ({
  method: "POST",
  path: "blocks",
  body: { at, block, question: question ?? null },
});

export const updateBlock = (at: number, block: BlockIn, question?: TryQuestionIn): Edit => ({
  method: "PUT",
  path: `blocks/${at}`,
  body: { block, question: question ?? null },
});

export const moveBlock = (at: number, to: number): Edit => ({
  method: "POST",
  path: `blocks/${at}/move`,
  body: { to },
});

export const deleteBlock = (at: number): Edit => ({ method: "DELETE", path: `blocks/${at}` });

export const resources = (list: ResourceIn[]): Edit => ({
  method: "PUT",
  path: "resources",
  body: { resources: list },
});

export const addExam = (question: ExamQuestionIn): Edit => ({
  method: "POST",
  path: "exam",
  body: { question },
});

export const updateExam = (id: string, question: ExamQuestionIn): Edit => ({
  method: "PUT",
  path: `exam/${encodeURIComponent(id)}`,
  body: { question },
});

export const deleteExam = (id: string): Edit => ({
  method: "DELETE",
  path: `exam/${encodeURIComponent(id)}`,
});

export function sendEdit(id: string, revision: number, edit: Edit): Promise<SavedOut> {
  const url = `/api/studio/drafts/${id}/${edit.path}`;
  if (edit.method === "DELETE") return sendJson<SavedOut>("DELETE", `${url}?revision=${revision}`);
  return sendJson<SavedOut>(edit.method, url, { ...edit.body, revision });
}
