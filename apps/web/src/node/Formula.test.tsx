import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Body } from "./Body";
import { Formula, InStudio } from "./Formula";

describe("Formula (M6MX.3)", () => {
  it("draws TeX with KaTeX", () => {
    const { container } = render(<Formula tex="\frac{a}{b}" display={false} />);
    expect(container.querySelector(".katex")).not.toBeNull();
  });

  it("shows a formula KaTeX cannot read as plain mono source to learners", () => {
    render(<Formula tex="\notacommand" display={false} />);
    const source = screen.getByText("\\notacommand");
    expect(source).toHaveClass("font-mono");
    expect(source).not.toHaveClass("text-open");
  });

  it("marks it in Studio's problem colour, with KaTeX's message, in Studio", () => {
    render(
      <InStudio.Provider value={true}>
        <Formula tex="\notacommand" display={false} />
      </InStudio.Provider>,
    );
    const source = screen.getByText("\\notacommand");
    expect(source).toHaveClass("text-open");
    expect(source.getAttribute("title")).toMatch(/notacommand/);
  });

  it("never draws a link from a formula, nor KaTeX's error red (#346)", () => {
    const { container } = render(<Formula tex="\href{https://example.org}{x}" display={false} />);
    expect(container.querySelector("a")).toBeNull();
    expect(container.innerHTML).not.toMatch(/#cc0000|color:/i);
    expect(screen.getByText("\\href{https://example.org}{x}")).toHaveClass("font-mono");
  });

  it("bounds a formula's size (#346)", () => {
    const { container } = render(<Formula tex="\rule{5000em}{1em}" display={false} />);
    // The source stays in KaTeX's MathML annotation; the drawn rule is clamped.
    expect(container.innerHTML).not.toMatch(/width:\s*5000em/);
    expect(container.innerHTML).toMatch(/width:\s*20em/);
  });

  it("keeps no macro from one formula to the next", () => {
    const { container } = render(
      <>
        <Formula tex="\gdef\twice{2}" display={false} />
        <Formula tex="\twice" display={false} />
      </>,
    );
    expect(container.textContent).toContain("\\twice");
  });
});

describe("Body — math and examples (M6MX.4)", () => {
  it("draws $…$ in text as a formula, and leaves it alone in code", () => {
    const { container } = render(
      <Body
        blocks={[{ kind: "text", markdown: "Count $k$-mers with `echo $x$`.\n" }]}
        questions={[]}
      />,
    );
    expect(container.querySelectorAll(".katex")).toHaveLength(1);
    expect(screen.getByText("echo $x$")).toBeInTheDocument();
  });

  it("draws a math block as a display formula in the board's panel (#344)", () => {
    const { container } = render(
      <Body blocks={[{ kind: "math", tex: "G_k(R) = (V, E)\n" }]} questions={[]} />,
    );
    const formula = container.querySelector(".katex-display");
    expect(formula).not.toBeNull();
    const panel = formula?.closest("[data-block='math']");
    expect(panel).toHaveClass("rounded-xl", "border", "bg-surface");
  });

  it("draws an example as a titled panel, its code in mono", () => {
    render(
      <Body
        blocks={[
          {
            kind: "example",
            title: "Three reads into one sequence",
            markdown: "Walk them:\n\n```text\nspells ACGTTAG\n```\n",
          },
        ]}
        questions={[]}
      />,
    );
    const panel = screen.getByRole("region", {
      name: "Worked example: Three reads into one sequence",
    });
    expect(panel).toHaveTextContent("Worked example");
    expect(screen.getByText("spells ACGTTAG").closest("pre")).toHaveClass("font-mono");
  });
});
