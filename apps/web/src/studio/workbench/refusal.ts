// What an editor shows when its save was refused (M4K.3): the API's sentence, the problems the
// files would have (a 422), and whether someone else saved first (CA0203).
import { ApiUnreachable, sentenceOf } from "../../api/client";
import type { ProblemOut } from "../../api/schema";

export interface Refusal {
  sentence: string;
  problems: ProblemOut[];
  stale: boolean;
}

export function refusalOf(error: Error | null): Refusal | null {
  if (error === null) return null;
  const body = (error instanceof ApiUnreachable ? error.body : null) as {
    problems?: unknown;
    code?: unknown;
  } | null;
  const problems = Array.isArray(body?.problems) ? (body.problems as ProblemOut[]) : [];
  return { sentence: sentenceOf(error), problems, stale: body?.code === "CA0203" };
}
