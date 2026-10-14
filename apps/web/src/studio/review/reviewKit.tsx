// The review page's tests (M4.9b): TPM in review, as the queue and the review route answer.
import { Route } from "react-router";
import type { QueuedDraftOut, QueueKeyOut, ReviewItemOut, ReviewOut } from "../../api/schema";
import { type Answer, answering, renderAt, signedInAs } from "../../test-kit";
import { ReviewPage } from "./ReviewPage";

const keyOf = (
  key: string,
  kind: string,
  label: string,
  answered: boolean | null = null,
): QueueKeyOut => ({
  key,
  kind,
  label,
  verdict: null,
  answered,
});

export const QUEUE: QueuedDraftOut[] = [
  {
    public_id: "d-1",
    node_id: "tpm",
    title: "What TPM measures",
    revision: 2,
    submitted_at: "2026-10-14T09:00:00Z",
    contributors: [{ public_id: "u-2", email: "bo@example.org", name: "Bo", role: "author" }],
    reads: true,
    keys: [
      keyOf("node", "node", "Title, claim, level, links"),
      keyOf("block/0", "text", "A long transcript gives more fragments…"),
      keyOf("block/1", "callout", "TPM is not a count of reads"),
      keyOf("exam/tpm-or-count", "exam", "What does TPM tell you?", false),
    ],
  },
];

const none = { fields: null, block: null, resource: null, question: null };
const item = (key: string, kind: string, content: Partial<ReviewItemOut>): ReviewItemOut => ({
  ...none,
  key,
  kind,
  verdict: null,
  note: "",
  change: "same",
  before: null,
  ...content,
});

export const REVIEW: ReviewOut = {
  revision: 2,
  items: [
    item("node", "node", {
      fields: {
        title: "What TPM measures",
        claim: "TPM is a share of molecules.",
        region: "transcriptomics",
        level: "introductory",
        minutes: 10,
        needs: [],
        goes_deeper: [],
        related: [],
      },
    }),
    item("block/0", "text", {
      block: { kind: "text", markdown: "A long transcript gives more fragments.\n" },
      change: "changed",
      before: {
        ...none,
        block: { kind: "text", markdown: "A long transcript gives more reads.\n" },
      },
    }),
    item("block/1", "callout", {
      block: {
        kind: "callout",
        callout: "misconception",
        title: "TPM is not a count of reads",
        markdown: "Equal reads, unequal TPM.\n",
      },
    }),
    item("exam/tpm-or-count", "exam", {
      question: {
        id: "tpm-or-count",
        pool: "exam",
        kind: "choice",
        ask: "What does TPM tell you?",
        stem: [{ kind: "text", markdown: "What does TPM tell you?\n" }],
        options: ["A share of molecules", "A count of reads", "A length"],
        unit: "",
        steps: null,
        hints: [],
        given: null,
        right: null,
        right_option: null,
        right_steps: null,
        value: null,
        tolerance: null,
        rationale: null,
      },
    }),
  ],
};

export function renderReview(extra: Record<string, Answer> = {}, role = "reviewer") {
  const fake = answering({
    "GET /api/me": signedInAs(role),
    "GET /api/studio/review": { body: QUEUE },
    "GET /api/studio/drafts/d-1/review": { body: REVIEW },
    ...extra,
  });
  renderAt("/studio/review", <Route path="/studio/review" element={<ReviewPage />} />);
  return fake;
}
