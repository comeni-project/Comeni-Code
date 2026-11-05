import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DraftNodeOut } from "../../api/schema";
import { type Answer, answering, renderAt, signedInAs } from "../../test-kit";
import { addFigureFile, removeFigure, setFigure } from "./edits";
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
  // The composer is its own page: the test kit's Where shows where a click went.
  return fake;
};
const writes = (fake: ReturnType<typeof answering>) =>
  fake.mock.calls.filter(([, init]) => (init?.method ?? "GET") !== "GET");
const sent = (fake: ReturnType<typeof answering>, n = 0) =>
  JSON.parse(String(writes(fake)[n]?.[1]?.body));

describe("figure edits", () => {
  it("name a figure by its stem in the path (M6FG.5, M6CO.2)", () => {
    expect(addFigureFile(2, FLOW_TEXT, "Steps.\n")).toEqual({
      method: "POST",
      path: "figures",
      body: { at: 2, text: FLOW_TEXT, caption: "Steps.\n" },
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

describe("the workbench's figures open the composer (M6CO.1)", () => {
  it("edits a figure block in the composer, with its place", async () => {
    bench();
    await userEvent.click(await screen.findByRole("button", { name: "Edit block 2" }));
    expect(await screen.findByTestId("where")).toHaveTextContent(
      "/studio/drafts/d-1/figures/flow?block=1",
    );
  });

  it("adds a figure in the composer, at the place chosen", async () => {
    bench({}, NODE);
    await screen.findByRole("heading", { level: 1 });
    await userEvent.click(
      screen.getAllByRole("button", { name: "Add a figure" })[1] as HTMLElement,
    );
    expect(await screen.findByTestId("where")).toHaveTextContent(
      "/studio/drafts/d-1/figures/new?at=1",
    );
  });

  it("has no YAML box in the workbench", async () => {
    bench();
    await screen.findByRole("button", { name: "Edit block 2" });
    expect(screen.queryByLabelText("Figure file")).toBeNull();
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
    figure: null as string | null,
  };
  const asking = (figure: string | null): DraftNodeOut => ({
    ...WITH_FLOW,
    blocks: [...WITH_FLOW.blocks, { kind: "try", question: "k-mers-q1" }],
    questions: [{ ...question, figure }],
  });

  it("a try question picks one of the node's figures", async () => {
    const node = asking(null);
    const fake = bench({ "PUT /api/studio/drafts/d-1/blocks/2": saved(4, node) }, node);
    await userEvent.click(await screen.findByRole("button", { name: "Edit block 3" }));
    const picker = screen.getByLabelText("Figure");
    expect(picker).toHaveValue("");
    expect(screen.queryByRole("button", { name: "Edit in the composer" })).toBeNull();
    await userEvent.selectOptions(picker, "flow");
    await userEvent.click(screen.getByRole("button", { name: "Done" }));
    await vi.waitFor(() => expect(writes(fake)).toHaveLength(1));
    expect(sent(fake).question.figure).toBe("flow");
  });

  it("a try question's figure opens in the composer, its edit saved first", async () => {
    const node = asking("flow");
    const fake = bench({ "PUT /api/studio/drafts/d-1/blocks/2": saved(4, node) }, node);
    await userEvent.click(await screen.findByRole("button", { name: "Edit block 3" }));
    await userEvent.type(screen.getByLabelText("Question"), " Count them.");
    await userEvent.click(screen.getByRole("button", { name: "Edit in the composer" }));
    expect(await screen.findByTestId("where")).toHaveTextContent("/studio/drafts/d-1/figures/flow");
    expect(screen.getByTestId("where")).not.toHaveTextContent("block=");
    expect(sent(fake).question.ask).toBe("How many k-mers? Count them.");
  });
});
