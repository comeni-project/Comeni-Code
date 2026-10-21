import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { FigureOut } from "../api/schema";
import { Figure } from "./Figure";
import { RENDERERS } from "./registry";
import { SCHEMAS } from "./schemas";

const TABLE: FigureOut = {
  stem: "kmer-counts",
  component: "table",
  alt: "A table of k against distinct k-mers.",
  data: {
    columns: [
      { name: "k", type: "number" },
      { name: "length", type: "number", unit: "bases" },
      { name: "example", type: "sequence" },
    ],
    rows: [
      [3, 6400, "ACG"],
      [11, 1234567, null],
    ],
  },
  derived: {},
  source: null,
};
const TRACK: FigureOut = {
  stem: "primer-on-exon",
  component: "sequence-track",
  alt: "A sequence track.",
  data: {
    alphabet: "dna",
    sequence: "ACGTACGTAC",
    features: [
      { start: 1, end: 6, label: "exon 1", kind: "exon" },
      { start: 3, end: 8, label: "primer", kind: "primer", strand: "+" },
    ],
  },
  derived: { lanes: [0, 1] },
  source: null,
};
const FLOW: FigureOut = {
  stem: "steps",
  component: "flow",
  alt: "A flow of two steps.",
  data: {
    nodes: [
      { id: "a", label: "reads" },
      { id: "b", label: "k-mers" },
    ],
    edges: [{ from: "a", to: "b" }],
  },
  derived: {},
  source: { title: "Compeau et al. 2011", url: "https://doi.org/10.1038/nbt.2023" },
};

describe("Figure (M6FG.6)", () => {
  it("draws a table as the board's Figure 1: numbered, captioned, numbers aligned", () => {
    render(<Figure record={TABLE} caption="Distinct k-mers." number={1} />);
    const figure = screen.getByRole("figure");
    expect(figure).toHaveTextContent("Figure 1.");
    expect(figure).toHaveTextContent("Distinct k-mers.");
    expect(screen.getByRole("columnheader", { name: "length (bases)" })).toBeInTheDocument();
    const cell = screen.getByRole("cell", { name: "1,234,567" });
    expect(cell).toHaveClass("text-right");
    expect(screen.getByRole("table", { name: TABLE.alt })).toBeInTheDocument();
  });

  it("draws a track's features in their computed lanes, each kind a shape", () => {
    const { container } = render(<Figure record={TRACK} caption="A primer." number={2} />);
    expect(screen.getByRole("img", { name: TRACK.alt })).toBeInTheDocument();
    const features = container.querySelectorAll("[data-feature]");
    expect([...features].map((f) => f.getAttribute("data-lane"))).toEqual(["0", "1"]);
    expect([...features].map((f) => f.getAttribute("data-kind"))).toEqual(["exon", "primer"]);
    expect(container.querySelectorAll("[data-letter]")).toHaveLength(10);
  });

  it("draws a flow's boxes and arrows, and credits its data's source", () => {
    const { container } = render(<Figure record={FLOW} caption="Two steps." number={3} />);
    expect(container.querySelectorAll("[data-box]")).toHaveLength(2);
    expect(container.querySelectorAll("[data-edge]")).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Compeau et al. 2011" })).toHaveAttribute(
      "href",
      "https://doi.org/10.1038/nbt.2023",
    );
    expect(screen.getByRole("figure")).toHaveTextContent("Data: Compeau et al. 2011");
  });

  it("never half-draws: data the schema refuses shows the alt text instead", () => {
    const planted = { ...FLOW, data: { ...FLOW.data, href: "javascript:alert(1)" } };
    const { container } = render(<Figure record={planted} caption="Two steps." number={4} />);
    expect(screen.getByText("This figure could not be drawn.")).toBeInTheDocument();
    expect(screen.getByText(FLOW.alt)).toBeInTheDocument();
    expect(container.querySelector("svg")).toBeNull();
    expect(screen.getByRole("figure")).toHaveTextContent("Figure 4.");
  });

  it("a block whose record is missing shows the fallback, as does a component nobody built", () => {
    render(<Figure record={undefined} caption="Gone." number={5} stem="lost" />);
    expect(screen.getByText("This figure could not be drawn.")).toBeInTheDocument();
    render(<Figure record={{ ...FLOW, component: "pie" }} caption="Pie." number={null} />);
    expect(screen.getAllByText("This figure could not be drawn.")).toHaveLength(2);
  });

  it("knows a renderer for exactly the components code-figures has", () => {
    expect(Object.keys(RENDERERS).sort()).toEqual(Object.keys(SCHEMAS).sort());
  });
});
