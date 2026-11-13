// Review's problem key (M6.8b spec, M6PB.6; the ReviewProblem board): the problem as the page draws
// it, what the learner doesn't see until they answer, the file, and Changes as the file's diff.
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import type { NodeProblemOut, QueuedDraftOut, ReviewItemOut } from "../../api/schema";
import { KITS, PROBLEM_TEXT } from "../problem/kits.fixture";
import { QUEUE, REVIEW, renderReview } from "./reviewKit";

afterEach(() => vi.unstubAllGlobals());

const PROBLEM: NodeProblemOut = {
  text: PROBLEM_TEXT,
  title: "Construct a de Bruijn graph",
  rung: 3,
  statement: "Given a set of reads and an integer k, return the edges.\n",
  given: "k on the first line, then the reads, one per line",
  returns: 'edges as "A -> B", one per line, sorted, no duplicates',
  sample_dataset: "3\nACGTT\n",
  sample_output: "ACG -> CGT\n",
  hints: ["The same k-mer can come from many reads."],
  callouts: ["Every edge appears once"],
  kit: "de-bruijn-edges",
  size: 2482,
  rationale: "Each read adds the edges between its consecutive k-mers.",
  mistakes: [{ name: "duplicates", callout: "Every edge appears once" }],
};
const none = { fields: null, block: null, resource: null, question: null };
const ITEM: ReviewItemOut = {
  ...none,
  problem: PROBLEM,
  key: "problem",
  kind: "problem",
  verdict: null,
  note: "",
  change: "changed",
  before: { ...none, problem: { ...PROBLEM, text: PROBLEM_TEXT.replace("k: 4", "k: 5") } },
};
const queue: QueuedDraftOut[] = [
  {
    ...(QUEUE[0] as QueuedDraftOut),
    keys: [
      ...(QUEUE[0] as QueuedDraftOut).keys,
      {
        key: "problem",
        kind: "problem",
        label: "Construct a de Bruijn graph",
        verdict: null,
        answered: null,
      },
    ],
  },
];
const open = async () => {
  renderReview({
    "GET /api/studio/review": { body: queue },
    "GET /api/studio/drafts/d-1/review": { body: { ...REVIEW, items: [...REVIEW.items, ITEM] } },
    "GET /api/studio/problem-kits": { body: KITS },
  });
  await userEvent.click(
    await screen.findByRole("button", { name: /^Construct a de Bruijn graph/ }),
  );
  return screen.findByRole("region", { name: "Open block" });
};

it("draws the problem, what only a reviewer sees, and the file", async () => {
  const panel = await open();
  expect(within(panel).getByRole("region", { name: "Construct a de Bruijn graph" })).toBeTruthy();
  const hidden = within(panel).getByRole("region", {
    name: "What the learner doesn’t see until they answer",
  });
  expect(within(hidden).getByText(PROBLEM.rationale)).toBeTruthy();
  expect(within(hidden).getByText(/duplicates/)).toHaveTextContent(
    "duplicates → the callout Every edge appears once",
  );
  expect(await within(hidden).findByText(/missing, extra, unsorted, reversed/)).toBeTruthy();
  expect(within(hidden).getByText(/passed on the sample and seeds 0–19/)).toBeTruthy();
  expect(within(panel).getByText(/params: \{k: 4/)).toBeTruthy();
});

it("shows Changes as the file's diff", async () => {
  const panel = await open();
  await userEvent.click(within(panel).getByRole("tab", { name: "Changes" }));
  expect(within(panel).getByText(/^5,/, { selector: "del" })).toBeTruthy();
  expect(within(panel).getByText(/^4,/, { selector: "ins" })).toBeTruthy();
});
