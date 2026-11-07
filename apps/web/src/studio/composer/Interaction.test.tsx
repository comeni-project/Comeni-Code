// The composer's Interaction step (M6.6b spec, M6FA.6): the task written into the figure's file,
// the right answer and a wrong one computed and named, and every state drawn.
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ERROR_BUBBLE, TRACE_PATH } from "../../figures/answer/answers.fixture";
import { Interaction } from "./Interaction";
import { StateStrip } from "./StateStrip";
import { useWorkingCopy } from "./useWorkingCopy";

const TEXT = `component: kmer-graph
alt: A de Bruijn graph of six 3-mers.
data:
  # four reads, one a branch
  reads:
    - {sequence: ACGTT}
    - {sequence: CGTTA}
    - {sequence: GTTAG}
    - {sequence: CGTC}
  k: 3
  highlight: path
  path: [1, 3]
`;
const PICK_TEXT = `component: graph-artifacts
alt: Tips and bubbles.
data:
  reads:
    - {sequence: ACGTTAGC}
    - {sequence: ACGTTAGC}
    - {sequence: ACGTCAGC}
    - {sequence: ACGTTAGG}
  k: 3
interact: {task: pick, artifact: bubble}
`;

function Harness({ text }: { text: string }) {
  const copy = useWorkingCopy("f", text);
  return (
    <>
      <Interaction copy={copy} component={copy.figure?.component ?? "kmer-graph"} />
      <pre data-testid="text">{copy.text}</pre>
      <span data-testid="codes">{copy.problems.map((p) => p.code).join(" ")}</span>
    </>
  );
}
const text = () => screen.getByTestId("text").textContent ?? "";

describe("Interaction", () => {
  it("writes the task into the file, keeping every other line, and draws nothing as the answer", () => {
    render(<Harness text={TEXT} />);
    fireEvent.click(screen.getByRole("radio", { name: /Trace a path/ }));
    expect(text()).toContain("  # four reads, one a branch\n");
    expect(text()).toContain("interact:\n  task: trace\n  spells: ACGTT\n");
    expect(text()).toContain("  highlight: none\n");
    expect(screen.getByText(/highlight set to none/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("The path spells"), { target: { value: "ACGTTAG" } });
    expect(text()).toContain("  spells: ACGTTAG\n");
    expect(screen.getByTestId("computed-right")).toHaveTextContent("ACG → CGT → GTT → TTA → TAG");
    expect(screen.getByTestId("computed-wrong")).toHaveTextContent("ACG → CGT → GTC");
  });

  it("removes the task with Nothing", () => {
    render(<Harness text={PICK_TEXT} />);
    expect(screen.getByRole("radio", { name: /Pick a k-mer/ })).toBeChecked();
    fireEvent.click(screen.getByRole("radio", { name: /Nothing/ }));
    expect(text()).not.toContain("interact");
  });

  it("names a task the data does not fit", () => {
    render(<Harness text={TEXT} />);
    fireEvent.click(screen.getByRole("radio", { name: /Trace a path/ }));
    fireEvent.change(screen.getByLabelText("The path spells"), { target: { value: "ACGTCAG" } });
    expect(screen.getByTestId("codes")).toHaveTextContent("CS1030");
    expect(screen.getByText(/ACGTCAG needs TCA, which no read holds/)).toBeInTheDocument();
  });

  it("a task the data no longer fits is a problem, so Save waits (Review Focus 2)", () => {
    const withoutTheError = PICK_TEXT.replace("    - {sequence: ACGTCAGC}\n", "");
    render(<Harness text={withoutTheError.replace("artifact: bubble", "artifact: bubble")} />);
    expect(screen.getByTestId("codes")).toHaveTextContent("CS1032");
  });
});

describe("StateStrip", () => {
  it("draws the four states, each by the page's component", () => {
    const onDrawn = vi.fn();
    render(<StateStrip record={TRACE_PATH} onDrawn={onDrawn} />);
    for (const name of ["start", "midway", "wrong answer", "answered"]) {
      expect(screen.getByRole("figure", { name })).toBeInTheDocument();
    }
    expect(onDrawn).toHaveBeenLastCalledWith(4);
    expect(
      screen.getByRole("figure", { name: "midway" }).querySelectorAll("[data-order]"),
    ).toHaveLength(3);
  });

  it("counts a state that cannot be drawn", () => {
    const onDrawn = vi.fn();
    render(<StateStrip record={{ ...ERROR_BUBBLE, derived: {} }} onDrawn={onDrawn} />);
    expect(onDrawn).toHaveBeenLastCalledWith(0);
  });
});
