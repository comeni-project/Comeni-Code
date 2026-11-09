// The Problem tab (M6.8b spec, M6PB.1–M6PB.5), as the WorkbenchProblem and WorkbenchProblemNew
// boards draw it, through the real workbench page.
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DraftNodeOut, DraftOut, NodeProblemOut } from "../../api/schema";
import { type Answer, answering, renderAt, signedInAs } from "../../test-kit";
import { DRAFT, NODE } from "../workbench/fixtures";
import { WorkbenchPage } from "../workbench/WorkbenchPage";
import { KITS, PROBLEM_TEXT } from "./kits.fixture";

afterEach(() => vi.unstubAllGlobals());

const CALLOUT = {
  kind: "callout" as const,
  callout: "misconception" as const,
  title: "Every edge appears once",
  markdown: "One edge.",
};
const WITH_PROBLEM: DraftNodeOut = {
  ...NODE,
  blocks: [...NODE.blocks, CALLOUT, { kind: "problem" }],
  problem: {
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
  },
};
const WITHOUT: DraftNodeOut = { ...NODE, blocks: [...NODE.blocks, CALLOUT] };
const PUT = "PUT /api/studio/drafts/d-1/problem";

function bench(
  node: DraftNodeOut,
  more: Record<string, Answer | ((init?: RequestInit) => Answer)> = {},
  draft: Partial<DraftOut> = {},
) {
  const fake = answering({
    "GET /api/me": signedInAs("author"),
    "GET /api/studio/drafts/d-1": { body: { ...DRAFT, ...draft, node } },
    "GET /api/studio/problem-kits": { body: KITS },
    ...more,
  });
  renderAt(
    "/studio/drafts/d-1?tab=problem",
    <Route path="/studio/drafts/:id" element={<WorkbenchPage />} />,
  );
  return fake;
}
const sent = (fake: ReturnType<typeof answering>) =>
  fake.mock.calls
    .filter(([url, init]) => url === "/api/studio/drafts/d-1/problem" && init?.method === "PUT")
    .map(([, init]) => JSON.parse(String(init?.body)) as { revision: number; text: string });
const saved = (node: DraftNodeOut): Answer => ({
  body: { draft: { ...DRAFT, revision: 4, node }, warnings: [] },
});

describe("a node with no problem", () => {
  it("offers each kit with its sample, and starts a problem from one", async () => {
    bench(WITHOUT);
    const card = await screen.findByRole("region", { name: "de-bruijn-edges" });
    expect(within(card).getByText(/every edge of their de Bruijn graph/)).toBeTruthy();
    expect(within(card).getByText(/ACG -> CGT/)).toBeTruthy();
    await userEvent.click(within(card).getByRole("button", { name: "Start from this kit" }));
    expect(screen.getByLabelText("Title")).toHaveValue("");
    expect(screen.getByRole("button", { name: "Save problem" })).toBeDisabled();
  });
});

describe("a problem", () => {
  it("saves the file with only the edited line changed", async () => {
    const fake = bench(WITH_PROBLEM, { [PUT]: saved(WITH_PROBLEM) });
    const title = await screen.findByLabelText("Title");
    await userEvent.clear(title);
    await userEvent.type(title, "Build a de Bruijn graph");
    await userEvent.click(screen.getByRole("button", { name: "Save problem" }));
    await vi.waitFor(() => expect(sent(fake)).toHaveLength(1));
    const [body] = sent(fake);
    expect(body?.revision).toBe(3);
    const before = PROBLEM_TEXT.split("\n");
    const after = (body?.text ?? "").split("\n");
    expect(after).toHaveLength(before.length);
    expect(after.filter((line, at) => line !== before[at])).toEqual([
      "title: Build a de Bruijn graph",
    ]);
  });

  it("flags a param out of bounds under it, and holds Save", async () => {
    bench(WITH_PROBLEM);
    const k = await screen.findByLabelText("k", { selector: "input[data-root='params']" });
    await userEvent.clear(k);
    await userEvent.type(k, "2");
    expect(screen.getAllByText("is less than 3").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Save problem" })).toBeDisabled();
  });

  it("puts a refusal's problems under their fields, and the rest above", async () => {
    bench(WITH_PROBLEM, {
      [PUT]: {
        status: 422,
        body: {
          detail: "The problem would not validate.",
          code: "CA0208",
          problems: [
            {
              file: "p/problem.yaml",
              line: null,
              field: "mistakes.duplicates",
              code: "CS1104",
              message:
                "mistakes.duplicates: seed 3: the mistake duplicates is not caught as itself",
              text: "CS1104 …",
            },
            {
              file: "p/problem.yaml",
              line: null,
              field: "kit",
              code: "CS1103",
              message: "kit: seed 4: the kit failed (boom)",
              text: "CS1103 …",
            },
          ],
        },
      },
    });
    const title = await screen.findByLabelText("Title");
    await userEvent.type(title, "!");
    await userEvent.click(screen.getByRole("button", { name: "Save problem" }));
    const row = await screen.findByRole("group", { name: "duplicates" });
    expect(within(row).getByText(/not caught as itself/)).toBeTruthy();
    expect(screen.getByRole("alert")).toHaveTextContent("the kit failed (boom)");
    expect(screen.getByLabelText("Title")).toHaveValue("Construct a de Bruijn graph!");
  });

  it("goes to Edit as YAML and back, keeping the text", async () => {
    bench(WITH_PROBLEM);
    await userEvent.click(await screen.findByRole("button", { name: "Edit as YAML" }));
    const area = screen.getByLabelText("problem.yaml");
    expect(area).toHaveValue(PROBLEM_TEXT);
    await userEvent.click(screen.getByRole("button", { name: "Back to the form" }));
    expect(screen.getByLabelText("Title")).toHaveValue("Construct a de Bruijn graph");
  });

  it("keeps a file the form cannot hold in YAML, with why", async () => {
    bench({
      ...WITH_PROBLEM,
      problem: {
        ...(WITH_PROBLEM.problem as NodeProblemOut),
        text: `${PROBLEM_TEXT}colour: red\n`,
      },
    });
    expect(await screen.findByText(/colour is a key the form does not show/)).toBeTruthy();
    expect(screen.getByLabelText("problem.yaml")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Back to the form" })).toBeNull();
  });

  it("asks before changing the kit, then takes the new kit's example", async () => {
    const fake = bench(WITH_PROBLEM, { [PUT]: saved(WITH_PROBLEM) });
    await userEvent.selectOptions(await screen.findByLabelText("Kit"), "count-kmers");
    expect(screen.getByText(/Change the kit\?/)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Change the kit" }));
    expect(screen.getByLabelText("genome, longest")).toHaveValue("400");
    expect(screen.queryByRole("group", { name: "duplicates" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Save problem" }));
    await vi.waitFor(() => expect(sent(fake)).toHaveLength(1));
    const text = sent(fake)[0]?.text ?? "";
    expect(text).toContain("kit: count-kmers");
    expect(text).not.toContain("mistakes:");
    expect(text).toContain("# the words a learner reads");
  });

  it("asks before removing the problem, then sends DELETE", async () => {
    const fake = bench(WITH_PROBLEM, {
      "DELETE /api/studio/drafts/d-1/problem?revision=3": saved(WITHOUT),
    });
    await userEvent.click(await screen.findByRole("button", { name: "Remove the problem" }));
    expect(
      screen.getByText(/Remove the problem and its block\? This can.t be undone in the draft\./),
    ).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Remove" }));
    await vi.waitFor(() =>
      expect(fake.mock.calls.some(([, init]) => init?.method === "DELETE")).toBe(true),
    );
    expect(await screen.findByRole("region", { name: "de-bruijn-edges" })).toBeTruthy();
  });

  it("is read-only on a submitted draft", async () => {
    bench(WITH_PROBLEM, {}, { state: "submitted" });
    expect(await screen.findByLabelText("Title")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Save problem" })).toBeNull();
  });
});

it("Content's problem row opens the Problem tab", async () => {
  answering({
    "GET /api/me": signedInAs("author"),
    "GET /api/studio/drafts/d-1": { body: { ...DRAFT, node: WITH_PROBLEM } },
    "GET /api/studio/problem-kits": { body: KITS },
  });
  renderAt("/studio/drafts/d-1", <Route path="/studio/drafts/:id" element={<WorkbenchPage />} />);
  await userEvent.click(await screen.findByRole("link", { name: "Open in the Problem tab" }));
  expect(await screen.findByLabelText("Title")).toBeTruthy();
});
