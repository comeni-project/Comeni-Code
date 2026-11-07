import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { QuestionOut } from "../api/schema";
import { ERROR_BUBBLE, OPTIONS, PATH, TRACE_PATH } from "../figures/answer/answers.fixture";
import { TryQuestion } from "./TryQuestion";

const COUNT: QuestionOut = {
  id: "kmers-per-read",
  kind: "number",
  ask: "How many 4-mers does an 8-letter transcript contain?",
  options: null,
  answer: 5,
  unit: null,
  tolerance: null,
  accept: [],
  exact: false,
  steps: null,
  hints: [
    "Slide a window of width k along the sequence and count the places where it still fits.",
    "The first row above lists them for transcript A.",
  ],
  rationale: "A sequence of length L has L − k + 1 k-mers, so 8 − 4 + 1 = 5.",
};

const CHOICE: QuestionOut = {
  id: "shared-unitig",
  kind: "choice",
  ask: "Which stretch can be merged into one unitig for both transcripts?",
  options: [
    { text: "ACGTTG", right: true },
    { text: "TTGCA", right: false },
    { text: "ACGTTGCA", right: false },
  ],
  answer: null,
  unit: null,
  tolerance: null,
  accept: [],
  exact: false,
  steps: null,
  hints: ["A unitig is a stretch with no branch in it."],
  rationale: "Both transcripts share ACGT → CGTT → GTTG, which merges to ACGTTG.",
};

const opened = async (question: QuestionOut, number = 1) => {
  render(<TryQuestion question={question} number={number} />);
  await userEvent.click(screen.getByRole("button", { name: /Try it/ }));
};

describe("a try question", () => {
  it("starts folded, with its number, its ask and what kind it is", () => {
    render(<TryQuestion question={COUNT} number={2} />);
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText(COUNT.ask)).toBeInTheDocument();
    expect(screen.getByText("1 min · a count")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Try it/ })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
  });

  it("says right, and why, for the right count", async () => {
    await opened(COUNT);
    await userEvent.type(screen.getByRole("spinbutton", { name: "Your answer" }), "5");
    await userEvent.click(screen.getByRole("button", { name: "Check" }));
    expect(screen.getByText("Right — 5.")).toBeInTheDocument();
    expect(screen.getByText(COUNT.rationale)).toBeInTheDocument();
  });

  it("says not quite for a wrong count, and keeps why back until a second try", async () => {
    await opened(COUNT);
    const field = screen.getByRole("spinbutton", { name: "Your answer" });
    await userEvent.type(field, "6");
    await userEvent.click(screen.getByRole("button", { name: "Check" }));
    expect(screen.getByText(/Not quite/)).toBeInTheDocument();
    expect(screen.queryByText(COUNT.rationale)).not.toBeInTheDocument();
    await userEvent.clear(field);
    await userEvent.type(field, "7");
    await userEvent.click(screen.getByRole("button", { name: "Check" }));
    expect(screen.getByText(COUNT.rationale)).toBeInTheDocument();
    expect(screen.getByText("The answer is 5.")).toBeInTheDocument();
  });

  it("accepts a count within its tolerance", async () => {
    await opened({ ...COUNT, answer: 0.5, tolerance: 0.05, unit: "TPM" });
    expect(screen.getByText("TPM")).toBeInTheDocument();
    await userEvent.type(screen.getByRole("spinbutton", { name: "Your answer" }), "0.53");
    await userEvent.click(screen.getByRole("button", { name: "Check" }));
    expect(screen.getByText("Right — 0.5 TPM.")).toBeInTheDocument();
  });

  it("checks a choice as soon as one is picked", async () => {
    await opened(CHOICE);
    await userEvent.click(screen.getByRole("button", { name: "TTGCA" }));
    expect(screen.getByText(/Not quite/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "ACGTTG" }));
    expect(screen.getByText("Right — ACGTTG.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ACGTTG" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText(CHOICE.rationale)).toBeInTheDocument();
  });

  it("gives its hints one at a time", async () => {
    await opened(COUNT);
    await userEvent.click(screen.getByRole("button", { name: "Show a hint" }));
    expect(screen.getByText("Hint 1 of 2 used")).toBeInTheDocument();
    expect(screen.getByText(COUNT.hints[0] ?? "")).toBeInTheDocument();
    expect(screen.queryByText(COUNT.hints[1] ?? "")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Show a hint" }));
    expect(screen.getByText("Hint 2 of 2 used")).toBeInTheDocument();
    expect(screen.getByText(COUNT.hints[1] ?? "")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Show a hint" })).not.toBeInTheDocument();
  });

  it("shows the answer and why when asked", async () => {
    await opened(CHOICE);
    await userEvent.click(screen.getByRole("button", { name: "Show the answer" }));
    expect(screen.getByText("The answer is ACGTTG.")).toBeInTheDocument();
    expect(screen.getByText(CHOICE.rationale)).toBeInTheDocument();
  });
});

const SPELL: QuestionOut = {
  id: "spell-the-path",
  kind: "sequence",
  ask: "What sequence does the path spell?",
  options: null,
  answer: "ACGTTGA",
  unit: null,
  tolerance: null,
  accept: [],
  exact: false,
  steps: null,
  hints: [],
  rationale: "Each edge adds one letter.",
};

const STEPS: QuestionOut = {
  id: "assembly-order",
  kind: "order",
  ask: "Put the steps in order.",
  options: null,
  answer: null,
  unit: null,
  tolerance: null,
  accept: [],
  exact: false,
  steps: ["A", "B", "C", "D"],
  hints: [],
  rationale: "Each needs the one before.",
};

describe("a sequence or an order try (M4Q.6)", () => {
  it("checks a typed sequence", async () => {
    await opened(SPELL);
    await userEvent.type(screen.getByLabelText("Your answer"), "acg ttga");
    await userEvent.click(screen.getByRole("button", { name: "Check" }));
    expect(screen.getByText(/Right — ACGTTGA/)).toBeInTheDocument();
  });

  it("puts the steps in order with Move up, and checks them", async () => {
    render(<TryQuestion question={STEPS} number={1} shuffle={(s) => [...s].reverse()} />);
    await userEvent.click(screen.getByRole("button", { name: /Try it/ }));
    const items = () => screen.getAllByRole("listitem").map((li) => li.textContent ?? "");
    for (const [at, step] of ["A", "B", "C", "D"].entries()) {
      while (items().findIndex((text) => text.startsWith(step)) > at) {
        await userEvent.click(screen.getByRole("button", { name: `Move ${step} up` }));
      }
    }
    await userEvent.click(screen.getByRole("button", { name: "Check" }));
    expect(screen.getByText(/Right — A → B → C → D/)).toBeInTheDocument();
  });

  it("says how many pairs were in order when an order is not right", async () => {
    render(
      <TryQuestion
        question={{ ...STEPS, steps: ["A", "B", "C"] }}
        number={1}
        shuffle={(s) => [...s].reverse()}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /Try it/ }));
    await userEvent.click(screen.getByRole("button", { name: "Check" }));
    expect(screen.getByText("0 of 3 pairs in order.")).toBeInTheDocument();
  });
});

describe("a try answered by the figure (M6.6b spec, M6FA.4)", () => {
  const TRACE_TRY: QuestionOut = {
    id: "trace-the-path",
    kind: "figure",
    ask: "Trace the path that spells ACGTTAG.",
    options: null,
    answer: null,
    unit: null,
    tolerance: null,
    accept: [],
    exact: false,
    steps: null,
    hints: ["ACGTTAG has 7 letters, so its path has 7 − 3 + 1 = 5 k-mers."],
    rationale: "Each step to the next k-mer adds its last letter.",
    figure: "trace-path",
  };
  const pick = (name: string) =>
    userEvent.click(screen.getByRole("button", { name: new RegExp(`^${name}$`) }));

  it("goes through its four states: start, midway, wrong answer, answered", async () => {
    render(<TryQuestion question={TRACE_TRY} number={3} figures={[TRACE_PATH]} big />);
    expect(screen.getByRole("button", { name: "Check" })).toBeDisabled();
    for (const name of ["ACG", "CGT", "GTC"]) await pick(name);
    await userEvent.click(screen.getByRole("button", { name: "Check" }));
    expect(screen.getByText(/Not quite/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^GTC$/ })).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(screen.getByRole("button", { name: "Undo" }));
    for (const name of ["GTT", "TTA", "TAG"]) await pick(name);
    await userEvent.click(screen.getByRole("button", { name: "Check again" }));
    expect(screen.getByText(`Right — ${PATH.join(" → ")}.`)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^ACG$/ })).toBeNull();
  });

  it("draws its figure once, as the answer, not above it", () => {
    const { container } = render(
      <TryQuestion question={TRACE_TRY} number={3} figures={[TRACE_PATH]} big />,
    );
    expect(container.querySelectorAll("svg[role=img]")).toHaveLength(1);
  });

  it("shows the computed path when the answer is shown", async () => {
    render(<TryQuestion question={TRACE_TRY} number={3} figures={[TRACE_PATH]} big />);
    await userEvent.click(screen.getByRole("button", { name: "Show the answer" }));
    expect(screen.getByText(`The answer is ${PATH.join(" → ")}.`)).toBeInTheDocument();
  });

  it("offers figures as options, each named by its alt text", async () => {
    const which: QuestionOut = {
      ...CHOICE,
      id: "which-graph",
      ask: "In which graph does a read have a wrong base in its middle?",
      options: OPTIONS.map((o) => ({
        text: "",
        right: o.stem === "options-bubble",
        figure: o.stem,
      })),
    };
    render(<TryQuestion question={which} number={1} figures={OPTIONS} big />);
    await userEvent.click(screen.getByRole("button", { name: "options-tip: a graph of k-mers." }));
    expect(screen.getByText(/Not quite/)).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "options-bubble: a graph of k-mers." }),
    );
    expect(screen.getByText(/^Right/)).toBeInTheDocument();
  });
});

describe("a figure try's meta and focus (#414)", () => {
  const PICK_TRY: QuestionOut = {
    id: "error-pick",
    kind: "figure",
    ask: "Click a k-mer only the wrong read holds.",
    options: null,
    answer: null,
    unit: null,
    tolerance: null,
    accept: [],
    exact: false,
    steps: null,
    hints: ["The wrong read leaves the path."],
    rationale: "The bubble's k-mers are one read's.",
    figure: "error-bubble",
  };

  it("names its task in the meta: a pick is not a trace", () => {
    render(<TryQuestion question={PICK_TRY} number={1} figures={[ERROR_BUBBLE]} />);
    expect(screen.getByText("1 min · a pick")).toBeInTheDocument();
  });

  it("moves focus to the feedback once answered right, so the keyboard is not lost", async () => {
    render(<TryQuestion question={PICK_TRY} number={1} figures={[ERROR_BUBBLE]} big />);
    await userEvent.click(screen.getByRole("button", { name: /^TCA$/ }));
    await userEvent.click(screen.getByRole("button", { name: "Check" }));
    expect(document.activeElement).toHaveTextContent(/^Right — TCA\./);
  });
});
