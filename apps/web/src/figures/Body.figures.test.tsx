import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { FigureOut, ImageRecordOut, QuestionOut } from "../api/schema";
import { Body } from "../node/Body";

const table = (stem: string): FigureOut => ({
  stem,
  component: "table",
  alt: `The ${stem} table.`,
  data: { columns: [{ name: "k", type: "number" }], rows: [[3]] },
  derived: {},
  source: null,
});
const IMAGE: ImageRecordOut = {
  file: "graph.png",
  alt: "A graph.",
  author: "Comeni Code",
  source: "own work",
  licence: "CC BY 4.0",
};
const ASKED: QuestionOut = {
  id: "how-many",
  kind: "number",
  ask: "How many k-mers?",
  options: null,
  answer: 5,
  unit: null,
  tolerance: null,
  accept: [],
  exact: false,
  steps: null,
  hints: ["Count them."],
  rationale: "Five.",
  figure: "counts",
};

describe("figures in a body (M6FG.6)", () => {
  it("numbers figures and images in one sequence, in reading order", () => {
    render(
      <Body
        blocks={[
          { kind: "figure", file: "a", caption: "First.\n" },
          { kind: "image", file: "graph.png", caption: "Second.\n" },
          { kind: "text", markdown: "Between.\n" },
          { kind: "figure", file: "b", caption: "Third.\n" },
          { kind: "figure", file: "a", caption: "Again.\n" },
        ]}
        questions={[]}
        pictures={{ records: [IMAGE], url: (f) => `/x/${f}` }}
        figures={[table("a"), table("b")]}
      />,
    );
    const shown = screen
      .getAllByRole("figure")
      .map((f) => f.textContent?.match(/Figure \d+\./)?.[0]);
    expect(shown).toEqual(["Figure 1.", "Figure 2.", "Figure 3.", "Figure 4."]);
    expect(screen.getAllByRole("table", { name: "The a table." })).toHaveLength(2);
  });

  it("draws a try question's figure under its ask once opened, unnumbered", async () => {
    render(
      <Body
        blocks={[{ kind: "try", question: "how-many" }]}
        questions={[ASKED]}
        figures={[table("counts")]}
      />,
    );
    expect(screen.queryByRole("table")).toBeNull(); // folded: the ask alone
    await userEvent.click(screen.getByRole("button", { name: /How many k-mers/ }));
    expect(screen.getByRole("table", { name: "The counts table." })).toBeInTheDocument();
    expect(screen.getByRole("figure")).not.toHaveTextContent(/Figure \d/);
  });
});
