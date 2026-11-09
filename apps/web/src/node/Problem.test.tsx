// The learner's problem (M6.8a spec, M6LP.5), as the NodeProblem board draws it: ready, wrong
// with a mapped mistake, wrong with none, right; a draft's preview with neither Download nor answer.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from "vitest";
import { forgetSeed, SEED_KEY } from "../api/problem";
import type { CalloutBlockOut, LearnerProblemOut } from "../api/schema";
import { answering, holding } from "../test-kit";
import { Body } from "./Body";

const PROBLEM: LearnerProblemOut = {
  title: "Construct a de Bruijn graph",
  rung: 3,
  statement: "Given a set of reads and an integer k, return the edges.",
  given: "k on the first line, then the reads, one per line",
  returns: 'edges as "A -> B", one per line, sorted, no duplicates',
  sample_dataset: "3\nACGTT\nCGTTA\nGTTAG\n",
  sample_output: "ACG -> CGT\nCGT -> GTT\n",
  hints: ["The same k-mer can come from many reads.", "Each read adds one edge per pair."],
  callouts: ["Every edge appears once"],
  kit: "de-bruijn-edges",
  size: 2482,
  version: "0123456789ab",
};
const CALLOUT: CalloutBlockOut = {
  kind: "callout",
  callout: "misconception",
  title: "Every edge appears once",
  markdown: "An edge many reads hold is still one edge.",
};
const ANSWER = "/api/nodes/de-bruijn-graphs/problem/answer";
const DATASET = `/api/nodes/de-bruijn-graphs/problem/dataset?seed=42&version=${PROBLEM.version}`;

function draw({ live = true, rung = 3 }: { live?: boolean; rung?: number } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = vi.spyOn(client, "invalidateQueries");
  const shown = { ...PROBLEM, rung };
  render(
    <QueryClientProvider client={client}>
      <Body
        blocks={[CALLOUT, { kind: "problem" }]}
        questions={[]}
        problem={
          live ? { shown, live: { node: "de-bruijn-graphs", version: PROBLEM.version } } : { shown }
        }
      />
    </QueryClientProvider>,
  );
  return { invalidate, region: screen.getByRole("region", { name: PROBLEM.title }) };
}

const verdict = (body: unknown, status = 200) => ({ [`POST ${ANSWER}`]: { status, body } });

beforeEach(() => {
  window.localStorage.setItem(SEED_KEY, "42");
  forgetSeed();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe("ready", () => {
  it("draws the statement, Given and Return, the sample, the rung and the dataset", () => {
    const { region } = draw();
    const inside = within(region);
    expect(inside.getByText("Proves this node")).toBeTruthy();
    expect(inside.getByText("Rung 3 · a few lines of code")).toBeTruthy();
    expect(inside.getByText(PROBLEM.given)).toBeTruthy();
    expect(inside.getByText("Sample dataset")).toBeTruthy();
    expect(inside.getByText("de-bruijn-edges-42.txt")).toBeTruthy();
    expect(inside.getByText(/about 2\.5 KB/)).toBeTruthy();
    expect(inside.getByText(/made for this browser, so its answer is yours alone/)).toBeTruthy();
    expect(inside.getByRole("textbox", { name: "Your answer" })).toBeTruthy();
  });

  it.each([
    [1, "Rung 1 · read it off the file"],
    [2, "Rung 2 · one command"],
    [4, "Rung 4 · it has to be efficient"],
  ])("words rung %i", (rung, words) => {
    const { region } = draw({ rung });
    expect(within(region).getByText(words)).toBeTruthy();
  });

  it("shows the hints one at a time", async () => {
    const { region } = draw();
    await userEvent.click(within(region).getByRole("button", { name: "Show a hint (2)" }));
    expect(within(region).getByText(/The same k-mer can come from many reads\./)).toBeTruthy();
    expect(within(region).queryByText(/Each read adds one edge per pair\./)).toBeNull();
    await userEvent.click(within(region).getByRole("button", { name: "Show the next hint" }));
    expect(within(region).getByText(/Each read adds one edge per pair\./)).toBeTruthy();
  });
});

describe("answering", () => {
  it("wrong with a mapped mistake: the sentence and the callout quoted", async () => {
    const fake = answering(
      verdict({
        right: false,
        said: "Your list has 214 lines.",
        callouts: [CALLOUT.title],
        rationale: null,
      }),
    );
    const { region } = draw();
    await userEvent.type(
      within(region).getByRole("textbox", { name: "Your answer" }),
      "ACG -> CGT",
    );
    await userEvent.click(within(region).getByRole("button", { name: "Submit answer" }));
    const said = await within(region).findByText("Your list has 214 lines.");
    const shown = said.closest("[aria-live]") as HTMLElement;
    expect(within(shown).getByText("Not yet")).toBeTruthy();
    expect(within(shown).getByText(CALLOUT.title)).toBeTruthy();
    expect(within(shown).getByText(CALLOUT.markdown)).toBeTruthy();
    expect(within(shown).getByRole("button", { name: "Read it in the page ↑" })).toBeTruthy();
    expect(within(shown).queryByText("ACG -> CGT")).toBeNull();
    const [, init] = fake.mock.calls[0] ?? [];
    expect(JSON.parse(String(init?.body))).toEqual({
      seed: "42",
      version: PROBLEM.version,
      answer: "ACG -> CGT",
    });
  });

  it("wrong with no mapped mistake: the sentence alone", async () => {
    answering(
      verdict({ right: false, said: "Some edges are missing.", callouts: [], rationale: null }),
    );
    const { region } = draw();
    await userEvent.type(within(region).getByRole("textbox", { name: "Your answer" }), "x");
    await userEvent.click(within(region).getByRole("button", { name: "Submit answer" }));
    expect(await within(region).findByText("Some edges are missing.")).toBeTruthy();
    expect(within(region).queryByRole("button", { name: "Read it in the page ↑" })).toBeNull();
  });

  it("right: why, from the rationale", async () => {
    answering(verdict({ right: true, said: "", callouts: [], rationale: "Each edge once." }));
    const { region } = draw();
    await userEvent.type(within(region).getByRole("textbox", { name: "Your answer" }), "x");
    await userEvent.click(within(region).getByRole("button", { name: "Submit answer" }));
    expect(await within(region).findByText("Each edge once.")).toBeTruthy();
    expect(within(region).getByText(/^Right/)).toBeTruthy();
  });

  it("sends once while a submit is in flight", async () => {
    const fake = answering(verdict({ right: true, said: "", callouts: [], rationale: "Why." }));
    const answer = holding(fake, `POST ${ANSWER}`);
    const { region } = draw();
    await userEvent.type(within(region).getByRole("textbox", { name: "Your answer" }), "x");
    const submit = within(region).getByRole("button", { name: "Submit answer" });
    await userEvent.click(submit);
    await userEvent.click(submit);
    expect(fake.mock.calls.filter(([url]) => url === ANSWER)).toHaveLength(1);
    answer({ body: { right: true, said: "", callouts: [], rationale: "Why." } });
    expect(await within(region).findByText("Why.")).toBeTruthy();
  });

  it("refuses an answer over 1 MB before any request", async () => {
    const fake = answering({});
    const { region } = draw();
    const file = new File(["x".repeat(1_000_001)], "answer.txt", { type: "text/plain" });
    await userEvent.upload(within(region).getByLabelText("Choose a file"), file);
    await userEvent.click(within(region).getByRole("button", { name: "Submit answer" }));
    expect(within(region).getByText(/at most 1 MB/)).toBeTruthy();
    expect(fake).not.toHaveBeenCalled();
  });

  it("reads a chosen file into the answer", async () => {
    answering({});
    const { region } = draw();
    const file = new File(["AAC -> ACG\n"], "answer.txt", { type: "text/plain" });
    await userEvent.upload(within(region).getByLabelText("Choose a file"), file);
    const area = within(region).getByRole("textbox", {
      name: "Your answer",
    }) as HTMLTextAreaElement;
    await vi.waitFor(() => expect(area.value).toBe("AAC -> ACG\n"));
  });

  it("a changed problem on Submit: the sentence, and the node read again", async () => {
    answering(verdict({ detail: "This problem was updated.", code: "CA0010" }, 409));
    const { region, invalidate } = draw();
    await userEvent.type(within(region).getByRole("textbox", { name: "Your answer" }), "x");
    await userEvent.click(within(region).getByRole("button", { name: "Submit answer" }));
    expect(
      await within(region).findByText(
        "This problem was updated after you downloaded your dataset. Download it again.",
      ),
    ).toBeTruthy();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["node", "de-bruijn-graphs"] });
  });

  it("a changed problem on Download: the sentence, and the node read again", async () => {
    answering({ [`GET ${DATASET}`]: { status: 409, body: { detail: "x", code: "CA0010" } } });
    const { region, invalidate } = draw();
    await userEvent.click(within(region).getByRole("button", { name: "Download" }));
    expect(
      await within(region).findByText(
        "This problem was updated after you downloaded your dataset. Download it again.",
      ),
    ).toBeTruthy();
    expect(invalidate).toHaveBeenCalled();
  });

  it("Download saves the file made for this browser", async () => {
    const fake = vi.fn(async (_url: string) => new Response("4\nACGT\n", { status: 200 }));
    vi.stubGlobal("fetch", fake);
    const made = vi.fn(() => "blob:made");
    const revoked = vi.fn();
    const { createObjectURL, revokeObjectURL } = URL;
    URL.createObjectURL = made;
    URL.revokeObjectURL = revoked;
    onTestFinished(() => {
      URL.createObjectURL = createObjectURL;
      URL.revokeObjectURL = revokeObjectURL;
    });
    const clicked = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const { region } = draw();
    await userEvent.click(within(region).getByRole("button", { name: "Download" }));
    await vi.waitFor(() => expect(clicked).toHaveBeenCalled());
    expect(fake.mock.calls[0]?.[0]).toBe(DATASET);
    expect(revoked).toHaveBeenCalledWith("blob:made");
  });
});

describe("in Studio", () => {
  it("draws the problem with no Download and no answer", () => {
    const { region } = draw({ live: false });
    expect(within(region).queryByRole("button", { name: "Download" })).toBeNull();
    expect(within(region).queryByRole("textbox")).toBeNull();
    expect(within(region).getByText(/Studio shows the sample only/)).toBeTruthy();
  });
});

it("a body with no problem draws none", () => {
  render(<Body blocks={[{ kind: "text", markdown: "Hi.\n" }]} questions={[]} />);
  expect(screen.queryByRole("region")).toBeNull();
});
