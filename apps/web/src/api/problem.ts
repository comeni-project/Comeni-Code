// A node's problem, as the learner's page asks for it (M6.8a spec, M6LP.1, M6LP.3, M6LP.4): one
// seed per browser, the dataset made from it, and one answer checked by the server.

import { getText, sendJson } from "./client";
import { nodeUrl } from "./nodes";
import type { AnswerIn, AnswerOut } from "./schema";

export const SEED_KEY = "comeni.problem-seed";
export const ANSWER_BYTES = 1_000_000;
const DIGITS = /^[0-9]{1,20}$/;

let pageSeed: string | null = null;

const fresh = (): string => {
  const drawn = new BigUint64Array(1);
  crypto.getRandomValues(drawn);
  return String(drawn[0] ?? 0n);
};

/**
 * This browser's seed: kept in localStorage, made once. Storage blocked or holding something
 * else: a seed for this page's life, so a reload downloads another dataset (M6LP.1).
 */
export function browserSeed(): string {
  if (pageSeed !== null) return pageSeed;
  let seed: string | null = null;
  try {
    const kept = window.localStorage.getItem(SEED_KEY);
    if (kept !== null && DIGITS.test(kept) && BigInt(kept) < 2n ** 64n) seed = kept;
  } catch {
    // Storage can be blocked; the page keeps its own.
  }
  if (seed === null) {
    seed = fresh();
    try {
      window.localStorage.setItem(SEED_KEY, seed);
    } catch {
      // Nothing to keep it in; it holds for this page.
    }
  }
  pageSeed = seed;
  return seed;
}

/** Drop the page's copy of the seed (tests). */
export function forgetSeed(): void {
  pageSeed = null;
}

export const datasetUrl = (node: string, seed: string, version: string): string =>
  `${nodeUrl(node)}/problem/dataset?${new URLSearchParams({ seed, version })}`;

export const fetchDataset = (node: string, seed: string, version: string): Promise<string> =>
  getText(datasetUrl(node, seed, version));

export const sendAnswer = (node: string, body: AnswerIn): Promise<AnswerOut> =>
  sendJson<AnswerOut>("POST", `${nodeUrl(node)}/problem/answer`, body);

/** Over the 1 MB the server takes, in UTF-8 bytes (M6LP.4). */
export const tooLong = (text: string): boolean =>
  new TextEncoder().encode(text).length > ANSWER_BYTES;
