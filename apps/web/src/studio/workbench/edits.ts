// Every change a workbench makes, as a command (M4K.2): a method, a path under the draft and a
// body without the revision. `sendEdit` adds the revision and sends it; nothing else writes.
import { sendForm, sendJson } from "../../api/client";
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
  /** A multipart body in place of `body`: an image's file (M6IM.4). */
  form?: Record<string, string | Blob>;
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

/** An image from Commons: its file and credit fetched by the API, placed at `at` (M6IM.4). */
export const addImageFromCommons = (
  at: number,
  link: string,
  alt: string,
  caption: string,
): Edit => ({ method: "POST", path: "images/commons", body: { at, link, alt, caption } });

/** An uploaded image: its file, its record and its block, one save (M6IM.4). */
export const addImageUpload = (
  at: number,
  upload: Blob,
  // A source is optional (#360): none is sent when there is none.
  record: { file: string; alt: string; author: string; source?: string; licence: string },
  caption: string,
): Edit => ({
  method: "POST",
  path: "images",
  form: { ...record, at: String(at), caption, upload },
});

export const editImageRecord = (
  file: string,
  record: { alt: string; author: string; source: string | null; licence: string },
): Edit => ({ method: "PUT", path: `images/${encodeURIComponent(file)}`, body: record });

/** The image whole: its block, its record and its file (M6IM.3). */
export const removeImage = (file: string): Edit => ({
  method: "DELETE",
  path: `images/${encodeURIComponent(file)}`,
});

/** A new figure of `component`: its starter file under a free stem, and its block at `at`
 * (M6FG.5). Alt text and caption come first, as an image's do: a starter without alt would not
 * validate. */
export const addFigure = (at: number, component: string, alt: string, caption: string): Edit => ({
  method: "POST",
  path: "figures",
  body: { at, component, alt, caption },
});

/** A figure's file replaced by `text`, kept as written; refused unless it validates. */
export const setFigure = (stem: string, text: string): Edit => ({
  method: "PUT",
  path: `figures/${encodeURIComponent(stem)}`,
  body: { text },
});

/** The figure whole: its file, its blocks, a try question's figure and each stem's (M6FG.5). */
export const removeFigure = (stem: string): Edit => ({
  method: "DELETE",
  path: `figures/${encodeURIComponent(stem)}`,
});

export function sendEdit(id: string, revision: number, edit: Edit): Promise<SavedOut> {
  const url = `/api/studio/drafts/${id}/${edit.path}`;
  if (edit.method === "DELETE") return sendJson<SavedOut>("DELETE", `${url}?revision=${revision}`);
  if (edit.form !== undefined) {
    const form = new FormData();
    for (const [key, value] of Object.entries(edit.form)) form.append(key, value);
    form.append("revision", String(revision));
    return sendForm<SavedOut>(url, form);
  }
  return sendJson<SavedOut>(edit.method, url, { ...edit.body, revision });
}
