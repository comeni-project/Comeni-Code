// The de Bruijn components drawn (M6.6a spec, M6DC.4), each from its starter and what code-figures'
// twin computes from it, as the page receives them.
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { derive, STARTERS } from "../kits";
import type { FigureData } from "../schemas";
import { CompareGraphsFigure } from "./CompareGraphsFigure";
import { GraphArtifactsFigure } from "./GraphArtifactsFigure";
import { KmerGraphFigure } from "./KmerGraphFigure";
import { KmerWindowFigure } from "./KmerWindowFigure";
import { ReadTilingFigure } from "./ReadTilingFigure";

const ALT = "The figure's alt text.";
const kmers = (svg: HTMLElement) => [...svg.querySelectorAll("[data-kmer]")];

describe("kmer-graph", () => {
  const data = STARTERS["kmer-graph"];
  const draw = (over: Partial<FigureData["kmer-graph"]> = {}) => {
    const d = { ...data, ...over };
    return render(<KmerGraphFigure data={d} derived={derive("kmer-graph", d)} alt={ALT} />);
  };

  it("draws each k-mer once, the path's in the route colour and every other edge dashed", () => {
    draw();
    const svg = screen.getByRole("img", { name: ALT });
    expect(kmers(svg).map((k) => k.getAttribute("data-kmer"))).toEqual([
      "ACG",
      "CGT",
      "GTT",
      "TTA",
      "TAG",
      "GTC",
    ]);
    expect(
      kmers(svg)
        .filter((k) => k.hasAttribute("data-on-path"))
        .map((k) => k.getAttribute("data-kmer")),
    ).toEqual(["ACG", "CGT", "GTT", "TTA", "TAG"]);
    const branch = svg.querySelector('[data-edge="CGT GTC"]');
    expect(branch).toHaveAttribute("data-dashed");
    expect(svg.querySelector('[data-edge="CGT GTT"]')).toHaveAttribute("data-on-path");
    expect(within(svg).getByText("another read — a branch")).toBeInTheDocument();
  });

  it("spells the path, or a ? per letter when the learner works it out", () => {
    const { unmount } = draw();
    expect(screen.getByTestId("spells")).toHaveTextContent(/^A C G T T A G$/);
    unmount();
    draw({ spell: "hidden" });
    expect(screen.getByTestId("spells")).toHaveTextContent(/^\? \? \? \? \? \? \?$/);
    expect(screen.queryByText(/A C G/)).toBeNull();
  });

  it("marks the branching k-mers, in shape, with highlight: branches", () => {
    const { highlight: _, path: __, spell: ___, ...rest } = data;
    draw({ ...rest, highlight: "branches" } as Partial<FigureData["kmer-graph"]>);
    const svg = screen.getByRole("img", { name: ALT });
    expect(
      kmers(svg)
        .filter((k) => k.hasAttribute("data-branch"))
        .map((k) => k.getAttribute("data-kmer")),
    ).toEqual(["CGT"]);
    expect(svg.querySelector("[data-on-path]")).toBeNull();
    expect(screen.queryByTestId("spells")).toBeNull();
  });

  it("puts a note beneath its k-mer when another box follows it in the row (#403)", () => {
    const d: FigureData["kmer-graph"] = {
      ...data,
      reads: [{ sequence: "ACGTT", note: "first read" }, ...data.reads.slice(1)],
    } as FigureData["kmer-graph"];
    draw(d);
    const svg = screen.getByRole("img", { name: ALT });
    const box = (kmer: string) =>
      svg.querySelector(`[data-kmer="${kmer}"] rect:last-of-type`) as SVGRectElement;
    const at = (el: Element, name: string) => Number(el.getAttribute(name));
    const first = within(svg).getByText("first read");
    const acg = box("ACG");
    expect(at(first, "y")).toBeGreaterThan(at(acg, "y") + at(acg, "height"));
    const branch = within(svg).getByText("another read — a branch");
    const gtc = box("GTC");
    expect(at(branch, "x")).toBeGreaterThan(at(gtc, "x") + at(gtc, "width"));
  });

  it("lays out a read that repeats a k-mer, a cycle, once (Review Focus 1)", () => {
    const d: FigureData["kmer-graph"] = {
      reads: [{ sequence: "ACGACGA" }],
      k: 3,
      highlight: "none",
    };
    render(<KmerGraphFigure data={d} derived={derive("kmer-graph", d)} alt={ALT} />);
    const svg = screen.getByRole("img", { name: ALT });
    expect(kmers(svg).map((k) => k.getAttribute("data-kmer"))).toEqual(["ACG", "CGA", "GAC"]);
    expect(svg.querySelectorAll("[data-edge]")).toHaveLength(3);
  });
});

describe("kmer-window", () => {
  const data = STARTERS["kmer-window"];
  const derived = derive("kmer-window", data);

  it("starts at the author's k and follows the slider, counting L − k + 1", () => {
    render(<KmerWindowFigure data={data} derived={derived} alt={ALT} />);
    expect(screen.getAllByTestId("window")).toHaveLength(7);
    expect(screen.getByText("10 − 4 + 1 = 7 k-mers")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("slider", { name: "k" }), { target: { value: "5" } });
    expect(screen.getAllByTestId("window").map((w) => w.textContent)).toEqual([
      "ACGTT",
      "CGTTA",
      "GTTAG",
      "TTAGC",
      "TAGCA",
      "AGCAT",
    ]);
    expect(screen.getByText("10 − 5 + 1 = 6 k-mers")).toBeInTheDocument();
  });

  it("goes back to the author's k when the range narrows past the learner's (#405)", () => {
    const { rerender } = render(<KmerWindowFigure data={data} derived={derived} alt={ALT} />);
    fireEvent.change(screen.getByRole("slider", { name: "k" }), { target: { value: "7" } });
    const narrow = { ...data, range: [3, 5] as [number, number] };
    rerender(<KmerWindowFigure data={narrow} derived={derive("kmer-window", narrow)} alt={ALT} />);
    expect(screen.queryByText("This figure could not be drawn.")).toBeNull();
    expect(screen.getByText("10 − 4 + 1 = 7 k-mers")).toBeInTheDocument();
  });

  it("a k outside its range is not drawn", () => {
    render(<KmerWindowFigure data={{ ...data, k: 8 }} derived={derived} alt={ALT} />);
    expect(screen.getByText("This figure could not be drawn.")).toBeInTheDocument();
    expect(screen.getByText(ALT)).toBeInTheDocument();
    expect(screen.queryByTestId("window")).toBeNull();
  });
});

describe("read-tiling", () => {
  it("places each read where it matches, in its lane", () => {
    const data = STARTERS["read-tiling"];
    render(<ReadTilingFigure data={data} derived={derive("read-tiling", data)} alt={ALT} />);
    const reads = [...screen.getByRole("img", { name: ALT }).querySelectorAll("[data-read]")];
    expect(reads.map((r) => [r.getAttribute("data-start"), r.getAttribute("data-lane")])).toEqual([
      ["1", "0"],
      ["6", "1"],
      ["12", "0"],
      ["17", "1"],
      ["22", "0"],
      ["28", "1"],
      ["32", "0"],
    ]);
  });
});

describe("compare-graphs", () => {
  it("draws k-mers as nodes beside k-mers as edges, each edge named by its k-mer", () => {
    const data = STARTERS["compare-graphs"];
    render(<CompareGraphsFigure data={data} derived={derive("compare-graphs", data)} alt={ALT} />);
    const svg = screen.getByRole("img", { name: ALT });
    const left = svg.querySelector('[data-convention="nodes"]') as HTMLElement;
    const right = svg.querySelector('[data-convention="edges"]') as HTMLElement;
    expect(kmers(left).map((k) => k.getAttribute("data-kmer"))).toEqual(["ACG", "CGT", "GTT"]);
    expect(kmers(right).map((k) => k.getAttribute("data-kmer"))).toEqual(["AC", "CG", "GT", "TT"]);
    expect([...right.querySelectorAll("[data-edge-label]")].map((t) => t.textContent)).toEqual([
      "ACG",
      "CGT",
      "GTT",
    ]);
  });
});

describe("graph-artifacts", () => {
  it("draws a tip and a bubble, each named in words and never by colour alone", () => {
    const data = STARTERS["graph-artifacts"];
    render(
      <GraphArtifactsFigure data={data} derived={derive("graph-artifacts", data)} alt={ALT} />,
    );
    const svg = screen.getByRole("img", { name: ALT });
    const kind = (name: string) =>
      kmers(svg)
        .filter((k) => k.getAttribute("data-artifact") === name)
        .map((k) => k.getAttribute("data-kmer"));
    expect(kind("bubble")).toEqual(["GTC", "TCA", "CAG"]);
    expect(kind("tip")).toEqual(["AGG"]);
    expect(
      within(svg).getByText("bubble: a read with one wrong base rejoins the path"),
    ).toBeInTheDocument();
    expect(within(svg).getByText("tip: an error near a read’s end dead-ends")).toBeInTheDocument();
  });
});

describe("legible at phone width (#402)", () => {
  it("keeps each drawing at least three quarters of its size, scrolling in its frame instead", () => {
    const drawn = [
      ["kmer-graph", KmerGraphFigure],
      ["read-tiling", ReadTilingFigure],
      ["kmer-window", KmerWindowFigure],
      ["compare-graphs", CompareGraphsFigure],
      ["graph-artifacts", GraphArtifactsFigure],
    ] as const;
    for (const [component, Kit] of drawn) {
      const data = STARTERS[component];
      const { unmount } = render(
        <Kit data={data as never} derived={derive(component, data)} alt={ALT} />,
      );
      const svg = screen.getByRole("img", { name: ALT });
      const width = Number(svg.getAttribute("viewBox")?.split(" ")[2]);
      expect(Number.parseFloat(svg.style.minWidth), component).toBeCloseTo(width * 0.75, 0);
      unmount();
    }
  });
});

describe("graph-artifacts with marks hidden (M6.6b spec, M6FA.5)", () => {
  it("draws every k-mer plain and names no tip or bubble", () => {
    const d = { ...STARTERS["graph-artifacts"], marks: "hidden" as const };
    const { container } = render(
      <GraphArtifactsFigure data={d} derived={derive("graph-artifacts", d)} alt={ALT} />,
    );
    expect(container.querySelector("[data-artifact]")).toBeNull();
    expect(container.textContent).not.toMatch(/bubble|tip/);
  });
});
