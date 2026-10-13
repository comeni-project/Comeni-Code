import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { AnswerEditor, type AnswerFields, switchedKind } from "./AnswerEditor";

function Harness({
  start,
  exam = false,
  seen,
}: {
  start: AnswerFields;
  exam?: boolean;
  seen: AnswerFields[];
}) {
  const [value, setValue] = useState(start);
  return (
    <AnswerEditor
      value={value}
      exam={exam}
      onChange={(next) => {
        seen.push(next);
        setValue(next);
      }}
    />
  );
}

const CHOICE: AnswerFields = {
  kind: "choice",
  options: [
    { text: "A", right: true, misconception: "" },
    { text: "B", right: false, misconception: "" },
  ],
};

describe("AnswerEditor", () => {
  it("offers the four kinds", () => {
    render(<Harness start={CHOICE} seen={[]} />);
    for (const name of ["Choice", "Number", "Sequence", "Order"]) {
      expect(screen.getByRole("radio", { name })).toBeInTheDocument();
    }
  });

  it("switching kind clears the other kinds' fields (CS0337)", () => {
    const back = switchedKind(
      switchedKind({ ...CHOICE, answer: 3 }, "number", false),
      "choice",
      false,
    );
    expect(back.answer ?? null).toBeNull();
    expect(switchedKind(CHOICE, "order", false)).toMatchObject({
      options: null,
      answer: null,
      steps: ["", "", ""],
    });
    expect(switchedKind(CHOICE, "sequence", false)).toMatchObject({
      options: null,
      answer: "",
      accept: [],
      exact: false,
    });
  });

  it("switches kind from its radio", () => {
    const seen: AnswerFields[] = [];
    render(<Harness start={CHOICE} seen={seen} />);
    fireEvent.click(screen.getByRole("radio", { name: "Order" }));
    expect(seen.at(-1)).toMatchObject({ kind: "order", options: null });
  });

  it("edits a sequence's answer, accepted answers and exact", () => {
    const seen: AnswerFields[] = [];
    render(<Harness start={switchedKind(CHOICE, "sequence", false)} seen={seen} />);
    fireEvent.change(screen.getByLabelText("Answer"), { target: { value: "ACGTT" } });
    fireEvent.change(screen.getByLabelText("Also accepted"), {
      target: { value: "acgtt\nAC GTT" },
    });
    fireEvent.click(screen.getByLabelText("Exact: letter for letter"));
    expect(seen.at(-1)).toMatchObject({
      answer: "ACGTT",
      accept: ["acgtt", "AC GTT"],
      exact: true,
    });
  });

  it("edits an order's steps, in their right order", () => {
    const seen: AnswerFields[] = [];
    render(<Harness start={switchedKind(CHOICE, "order", false)} seen={seen} />);
    fireEvent.change(screen.getByLabelText("Step 1"), {
      target: { value: "Cut reads into k-mers" },
    });
    fireEvent.click(screen.getByRole("button", { name: "+ Step" }));
    expect(seen.at(-1)?.steps).toEqual(["Cut reads into k-mers", "", "", ""]);
    expect(screen.getByRole("button", { name: "Remove step 1" })).toBeEnabled();
  });

  it("keeps at least three steps", () => {
    render(<Harness start={switchedKind(CHOICE, "order", false)} seen={[]} />);
    expect(screen.getByRole("button", { name: "Remove step 1" })).toBeDisabled();
  });

  it("in the exam pool, a wrong option names a misconception or is plain", () => {
    const seen: AnswerFields[] = [];
    render(<Harness start={CHOICE} exam seen={seen} />);
    fireEvent.change(screen.getByLabelText("Misconception of option B"), {
      target: { value: "reads a repeat as an error" },
    });
    expect(seen.at(-1)?.options?.[1]).toMatchObject({
      misconception: "reads a repeat as an error",
      plain: false,
    });
    fireEvent.click(screen.getByLabelText("Option B is plain on purpose"));
    expect(seen.at(-1)?.options?.[1]).toMatchObject({ misconception: "", plain: true });
    expect(screen.queryByLabelText("Misconception of option A")).toBeNull();
    expect(screen.getByText("Options are shuffled per learner.")).toBeInTheDocument();
  });

  it("marking an option right clears its misconception and plain", () => {
    const seen: AnswerFields[] = [];
    const start = {
      ...CHOICE,
      options: [
        { text: "A", right: true, misconception: "", plain: false },
        { text: "B", right: false, misconception: "", plain: true },
      ],
    };
    render(<Harness start={start} exam seen={seen} />);
    fireEvent.click(screen.getByLabelText("Option B is the right answer"));
    expect(seen.at(-1)?.options?.[1]).toMatchObject({
      right: true,
      misconception: "",
      plain: false,
    });
  });

  it("a try question's options have no misconception (#257)", () => {
    render(<Harness start={CHOICE} seen={[]} />);
    expect(screen.queryByLabelText(/Misconception of option/)).toBeNull();
    expect(screen.queryByText("Options are shuffled per learner.")).toBeNull();
  });
});
