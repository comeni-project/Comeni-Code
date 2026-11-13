// The Problem tab's text follows the draft when it changes elsewhere (#439).
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { expect, it } from "vitest";
import { queryKeys } from "../../api/queries";
import type { DraftNodeOut } from "../../api/schema";
import { DRAFT, NODE } from "../workbench/fixtures";
import { KITS, PROBLEM_TEXT } from "./kits.fixture";
import { ProblemTab } from "./ProblemTab";

const node = (text: string): DraftNodeOut => ({
  ...NODE,
  problem: {
    text,
    title: "t",
    rung: 3,
    statement: "s",
    given: "g",
    returns: "r",
    sample_dataset: "3\n",
    sample_output: "",
    hints: [],
    callouts: [],
    kit: "de-bruijn-edges",
    size: 1,
    rationale: "x",
    mistakes: [],
  },
});
const THEIRS = PROBLEM_TEXT.replace("Construct a de Bruijn graph", "Their title");

function draw() {
  const client = new QueryClient();
  client.setQueryData(queryKeys.problemKits, KITS);
  client.setQueryData(queryKeys.draft("d-1"), { ...DRAFT, node: node(PROBLEM_TEXT) });
  let swap: (n: DraftNodeOut) => void = () => {};
  function Harness() {
    const [n, setN] = useState(node(PROBLEM_TEXT));
    swap = setN;
    return <ProblemTab draftId="d-1" node={n} editable />;
  }
  const router = createMemoryRouter([{ path: "*", element: <Harness /> }]);
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return (n: DraftNodeOut) => act(() => swap(n));
}

it("takes a save made elsewhere when nothing was changed here", async () => {
  const redraw = draw();
  redraw(node(THEIRS));
  expect(await screen.findByDisplayValue("Their title")).toBeTruthy();
});

it("with edits here, says so and holds Save until theirs is taken", async () => {
  const redraw = draw();
  await userEvent.type(await screen.findByLabelText("Title"), "!");
  redraw(node(THEIRS));
  expect(await screen.findByText(/saved elsewhere since you began/)).toBeTruthy();
  expect(screen.getByRole("button", { name: "Save problem" })).toBeDisabled();
  await userEvent.click(screen.getByRole("button", { name: "Take the saved one" }));
  expect(screen.getByLabelText("Title")).toHaveValue("Their title");
});
