import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { QuestionOut } from "../api/schema";
import { Body } from "./Body";
import type { Block } from "./body";

describe("Body", () => {
  it("draws nothing for a text block that is only blank lines", () => {
    const { container } = render(
      <Body blocks={[{ kind: "text", markdown: "\n\n" }]} questions={[]} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("draws nothing for a try whose question the node does not carry", () => {
    const { container } = render(
      <Body blocks={[{ kind: "try", question: "gone" }]} questions={[]} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("keys a question apart from the blocks around it (#134)", () => {
    // Index keys and a question id such as 2 used to collide, and React said so.
    const question: QuestionOut = {
      id: "2",
      kind: "number",
      ask: "How many?",
      options: null,
      answer: 2,
      unit: null,
      tolerance: null,
      accept: [],
      exact: false,
      steps: null,
      hints: ["Count them."],
      rationale: "There are two.",
    };
    const said = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <Body
        blocks={[
          { kind: "text", markdown: "One.\n" },
          { kind: "text", markdown: "Two.\n" },
          { kind: "text", markdown: "Three.\n" },
          { kind: "try", question: "2" },
        ]}
        questions={[question]}
      />,
    );
    expect(said.mock.calls.flat().join(" ")).not.toMatch(/same key/);
    said.mockRestore();
  });

  it("draws a sequence in groups of ten, and nothing for a block it does not know", () => {
    render(
      <Body
        blocks={[
          { kind: "sequence", letters: "ACGTTGCAGGTTAC\n" },
          { kind: "figure", component: "x" } as unknown as Block,
        ]}
        questions={[]}
      />,
    );
    expect(screen.getByText("ACGTTGCAGG TTAC")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
