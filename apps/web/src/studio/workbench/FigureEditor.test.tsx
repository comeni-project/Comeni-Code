import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DraftNodeOut } from "../../api/schema";
import { type Answer, answering, renderAt, signedInAs } from "../../test-kit";
import { addFigure, removeFigure, setFigure } from "./edits";
import { DRAFT, FLOW, FLOW_TEXT, NODE } from "./fixtures";
import { WorkbenchPage } from "./WorkbenchPage";

afterEach(() => vi.unstubAllGlobals());

const PLACED = { kind: "figure", file: "flow", caption: "Reads become k-mers.\n" } as const;
const WITH_FLOW: DraftNodeOut = { ...NODE, blocks: [...NODE.blocks, PLACED], figures: [FLOW] };
const saved = (revision: number, node: DraftNodeOut = WITH_FLOW): Answer => ({
  body: { draft: { ...DRAFT, revision, node }, warnings: [] },
});
const bench = (extra: Record<string, Answer> = {}, node: DraftNodeOut = WITH_FLOW) => {
  const fake = answering({
    "GET /api/me": signedInAs("author"),
    "GET /api/studio/drafts/d-1": { body: { ...DRAFT, node } },
    ...extra,
  });
  renderAt("/studio/drafts/d-1", <Route path="/studio/drafts/:id" element={<WorkbenchPage />} />);
  return fake;
};
const writes = (fake: ReturnType<typeof answering>) =>
  fake.mock.calls.filter(([, init]) => (init?.method ?? "GET") !== "GET");
const sent = (fake: ReturnType<typeof answering>, n = 0) =>
  JSON.parse(String(writes(fake)[n]?.[1]?.body));

describe("figure edits", () => {
  it("name a figure by its stem in the path (M6FG.5)", () => {
    expect(addFigure(2, "flow", "A flow.", "Steps.")).toEqual({
      method: "POST",
      path: "figures",
      body: { at: 2, component: "flow", alt: "A flow.", caption: "Steps." },
    });
    expect(setFigure("salmon-steps", FLOW_TEXT)).toEqual({
      method: "PUT",
      path: "figures/salmon-steps",
      body: { text: FLOW_TEXT },
    });
    expect(removeFigure("salmon-steps")).toEqual({
      method: "DELETE",
      path: "figures/salmon-steps",
    });
  });
});

describe("the workbench's figures (S3)", () => {
  it("adds a flow with its alt and caption, then opens its editor", async () => {
    const fake = bench({ "POST /api/studio/drafts/d-1/figures": saved(4) }, NODE);
    await screen.findByRole("heading", { level: 1 });
    await userEvent.click(
      screen.getAllByRole("button", { name: "Add a figure" })[1] as HTMLElement,
    );
    await userEvent.selectOptions(screen.getByLabelText("Component"), "flow");
    await userEvent.type(screen.getByLabelText("Alt text"), "A flow. Reads become k-mers.");
    await userEvent.type(screen.getByLabelText("Caption"), "Reads become k-mers.");
    await userEvent.click(screen.getByRole("button", { name: "Add the figure" }));
    await vi.waitFor(() => expect(writes(fake)).toHaveLength(1));
    expect(sent(fake)).toEqual({
      at: 1,
      component: "flow",
      alt: "A flow. Reads become k-mers.",
      caption: "Reads become k-mers.",
      revision: 3,
    });
    expect(await screen.findByLabelText("Figure file")).toHaveValue(FLOW_TEXT);
  });

  it("shows the component and stem, and sends nothing when left unchanged", async () => {
    const fake = bench();
    await userEvent.click(await screen.findByRole("button", { name: "Edit block 2" }));
    expect(screen.getByText("flow · flow.yaml")).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText("Figure file"));
    await userEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.queryByLabelText("Figure file")).toBeNull();
    expect(writes(fake)).toHaveLength(0);
  });

  it("saves a changed file once, as written", async () => {
    const text = FLOW_TEXT.replace("label: k-mers", "label: k-mers of the read");
    const fake = bench({ "PUT /api/studio/drafts/d-1/figures/flow": saved(4) });
    await userEvent.click(await screen.findByRole("button", { name: "Edit block 2" }));
    const box = screen.getByLabelText("Figure file");
    await userEvent.clear(box);
    await userEvent.click(box);
    await userEvent.paste(text);
    await userEvent.click(screen.getByRole("heading", { level: 1 })); // focus leaves the block
    await vi.waitFor(() => expect(writes(fake)).toHaveLength(1));
    expect(writes(fake)[0]?.[0]).toBe("/api/studio/drafts/d-1/figures/flow");
    expect(sent(fake)).toEqual({ text, revision: 3 });
  });

  it("shows a refused file's problems by code and path, and keeps what was typed", async () => {
    const text = FLOW_TEXT.replace("to: kmers", "to: kmer");
    bench({
      "PUT /api/studio/drafts/d-1/figures/flow": {
        status: 422,
        body: {
          detail: "The figure's file would not validate.",
          code: "CA0208",
          problems: [
            {
              code: "CS1007",
              field: null,
              file: "figures/flow.yaml",
              line: null,
              message: "data.edges[0].to: names no node (kmer)",
              text: "figures/flow.yaml: CS1007 data.edges[0].to: names no node (kmer)",
            },
          ],
        },
      },
    });
    await userEvent.click(await screen.findByRole("button", { name: "Edit block 2" }));
    const box = screen.getByLabelText("Figure file");
    await userEvent.clear(box);
    await userEvent.click(box);
    await userEvent.paste(text);
    await userEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(await screen.findByText(/CS1007 data\.edges\[0\]\.to/)).toBeInTheDocument();
    expect(screen.getByLabelText("Figure file")).toHaveValue(text);
  });

  it("deletes a figure whole: its file and every place it is shown", async () => {
    const fake = bench({
      "DELETE /api/studio/drafts/d-1/figures/flow?revision=3": saved(4, NODE),
    });
    await userEvent.click(await screen.findByRole("button", { name: "Delete block 2" }));
    expect(
      screen.getByText("Delete this figure, its file and every place it is shown?"),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    await vi.waitFor(() => expect(writes(fake)).toHaveLength(1));
  });

  it("a try question picks one of the node's figures", async () => {
    const question = {
      id: "k-mers-q1",
      kind: "number",
      ask: "How many k-mers?",
      options: null,
      answer: 2,
      unit: "",
      tolerance: null,
      accept: [],
      exact: false,
      steps: null,
      hints: [],
      rationale: "",
      figure: null,
    };
    const node: DraftNodeOut = {
      ...WITH_FLOW,
      blocks: [...WITH_FLOW.blocks, { kind: "try", question: "k-mers-q1" }],
      questions: [question],
    };
    const fake = bench({ "PUT /api/studio/drafts/d-1/blocks/2": saved(4, node) }, node);
    await userEvent.click(await screen.findByRole("button", { name: "Edit block 3" }));
    const picker = screen.getByLabelText("Figure");
    expect(picker).toHaveValue("");
    await userEvent.selectOptions(picker, "flow");
    await userEvent.click(screen.getByRole("button", { name: "Done" }));
    await vi.waitFor(() => expect(writes(fake)).toHaveLength(1));
    expect(sent(fake).question.figure).toBe("flow");
  });
});
