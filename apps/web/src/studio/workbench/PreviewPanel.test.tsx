// Studio's preview draws a draft's problem as the learner page does, without its dataset or an
// answer: a draft is in no index, so it has no version (M6.8a spec, M6LP.5).
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { expect, it } from "vitest";
import type { DraftNodeOut } from "../../api/schema";
import { NODE } from "./fixtures";
import { NodePreview } from "./PreviewPanel";

const WITH_PROBLEM: DraftNodeOut = {
  ...NODE,
  blocks: [...NODE.blocks, { kind: "problem" }],
  problem: {
    text: "title: Construct a de Bruijn graph\n",
    title: "Construct a de Bruijn graph",
    rung: 3,
    statement: "Return the edges.",
    given: "k, then reads",
    returns: "edges",
    sample_dataset: "3\nACGTT\n",
    sample_output: "ACG -> CGT\n",
    hints: [],
    callouts: [],
    kit: "de-bruijn-edges",
    size: 2482,
  },
};

it("draws a draft's problem with no Download and no answer", () => {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <NodePreview node={WITH_PROBLEM} draftId="d-1" />
    </QueryClientProvider>,
  );
  const region = screen.getByRole("region", { name: "Construct a de Bruijn graph" });
  expect(within(region).getByText("Return the edges.")).toBeTruthy();
  expect(within(region).queryByRole("button", { name: "Download" })).toBeNull();
  expect(within(region).queryByRole("textbox")).toBeNull();
});
