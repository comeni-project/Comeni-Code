import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { type TestAsk, TestQuestion } from "./TestQuestion";

const choice: TestAsk = {
  stem: [{ kind: "text", markdown: "Which mark does a mid-read error leave?\n" }],
  kind: "choice",
  options: ["A bubble", "A tip", "A clean path"],
  unit: "",
  steps: [],
};

describe("TestQuestion", () => {
  it("asks as a test does: its place, no hints, no feedback (M4P.7)", () => {
    render(<TestQuestion ask={choice} number={2} of={6} />);
    expect(screen.getByText("Question 2 of 6 · no hints in a test")).toBeInTheDocument();
    expect(screen.getByText("Which mark does a mid-read error leave?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "B A tip" }));
    expect(screen.getByRole("button", { name: "B A tip" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("button", { name: /hint/i })).toBeNull();
    expect(screen.queryByText(/Not quite|Right/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Check" })).toBeNull();
  });

  it("takes a number with its unit, and a sequence as text", () => {
    const number = { ...choice, kind: "number" as const, options: [], unit: "reads" };
    const { rerender } = render(<TestQuestion ask={number} number={1} of={1} />);
    expect(screen.getByLabelText("Your answer")).toBeInTheDocument();
    expect(screen.getByText("reads")).toBeInTheDocument();
    rerender(<TestQuestion ask={{ ...choice, kind: "sequence", options: [] }} number={1} of={1} />);
    expect(screen.getByLabelText("Your answer")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Check" })).toBeNull();
  });

  it("deals an order's steps without a Check button", () => {
    const order = { ...choice, kind: "order" as const, options: [], steps: ["a", "b", "c"] };
    render(
      <TestQuestion ask={order} number={1} of={1} shuffle={(steps) => [...steps].reverse()} />,
    );
    expect(screen.getAllByRole("listitem").map((li) => li.textContent?.charAt(0))).toEqual([
      "c",
      "b",
      "a",
    ]);
    expect(screen.queryByRole("button", { name: "Check" })).toBeNull();
  });

  it("draws a sequence block in its stem", () => {
    const stem = [...choice.stem, { kind: "sequence" as const, letters: "ACGT\n" }];
    render(<TestQuestion ask={{ ...choice, stem }} number={1} of={1} />);
    expect(screen.getByText(/ACGT/)).toBeInTheDocument();
  });

  it("gives a choice's index when answered (M4RS.4)", async () => {
    const onAnswer = vi.fn();
    render(<TestQuestion ask={choice} number={1} of={1} onAnswer={onAnswer} />);
    const answer = screen.getByRole("button", { name: "Answer" });
    expect(answer).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "B A tip" }));
    await userEvent.click(answer);
    expect(onAnswer).toHaveBeenCalledWith(1);
  });

  it("gives a number as a number, and keeps Answer off for what is not one", async () => {
    const onAnswer = vi.fn();
    render(
      <TestQuestion
        ask={{ stem: [], kind: "number", options: [], unit: "TPM", steps: [] }}
        number={1}
        of={1}
        onAnswer={onAnswer}
      />,
    );
    const field = screen.getByLabelText("Your answer");
    await userEvent.type(field, "seven");
    expect(screen.getByRole("button", { name: "Answer" })).toBeDisabled();
    await userEvent.clear(field);
    await userEvent.type(field, "7.5e5");
    await userEvent.click(screen.getByRole("button", { name: "Answer" }));
    expect(onAnswer).toHaveBeenCalledWith(750000);
  });

  it("draws no Answer without onAnswer", () => {
    render(<TestQuestion ask={choice} number={1} of={1} />);
    expect(screen.queryByRole("button", { name: "Answer" })).toBeNull();
  });
});
