import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { QuestionOut } from "../api/schema";
import { TryQuestion } from "./TryQuestion";

const COUNT: QuestionOut = {
  id: "kmers-per-read",
  kind: "number",
  ask: "How many 4-mers does an 8-letter transcript contain?",
  options: null,
  answer: 5,
  unit: null,
  tolerance: null,
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
