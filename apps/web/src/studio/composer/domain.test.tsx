// The de Bruijn components in the composer (M6.6a spec, M6DC.5): Choose's two groups, FASTA into
// a `format: dna` column or field, and what was computed, in words.
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { STARTERS } from "../../figures/kits";
import { Choose } from "./Choose";
import { parseFasta } from "./fasta";
import { SchemaForm } from "./SchemaForm";
import { pasteOps, sheetsOf } from "./sheets";
import { headline, summary } from "./summary";

const FOUR = ">r1 first\nACG\nTT\n>r2\nCGTTA\n>r3 third\nGTTAG\n>r4 another read\nCGTC\n";

describe("Choose (the M6.6a board)", () => {
  it("shows the de Bruijn components above the general kits", () => {
    render(<Choose chosen={null} onChoose={vi.fn()} />);
    const groups = screen.getAllByRole("group");
    expect(groups.map((g) => g.querySelector("legend > span")?.textContent)).toEqual([
      "de Bruijn graphs",
      "General",
    ]);
    const tiles = (group: HTMLElement) =>
      within(group)
        .getAllByRole("button")
        .map((b) => b.getAttribute("aria-label")?.split(":")[0]);
    expect(tiles(groups[0] as HTMLElement)).toEqual([
      "read-tiling",
      "kmer-window",
      "kmer-graph",
      "compare-graphs",
      "graph-artifacts",
    ]);
    expect(tiles(groups[1] as HTMLElement)).toEqual(["table", "chart", "flow", "sequence-track"]);
  });
});

describe("FASTA (M6DC.5)", () => {
  it("reads records, each its header and its lines joined", () => {
    expect(parseFasta(FOUR)).toEqual([
      { header: "r1 first", letters: "ACGTT" },
      { header: "r2", letters: "CGTTA" },
      { header: "r3 third", letters: "GTTAG" },
      { header: "r4 another read", letters: "CGTC" },
    ]);
  });

  it("fills a row per record from the cell pasted into, headers into notes", () => {
    const [reads] = sheetsOf("kmer-graph", STARTERS["kmer-graph"]);
    expect(reads?.columns.map((c) => [c.key, c.dna === true])).toEqual([
      ["sequence", true],
      ["note", false],
    ]);
    const { ops } = pasteOps(reads as NonNullable<typeof reads>, 0, 0, FOUR);
    expect(ops).toEqual([
      { op: "set", path: ["data", "reads", 0, "sequence"], value: "ACGTT" },
      { op: "set", path: ["data", "reads", 0, "note"], value: "r1 first" },
      { op: "set", path: ["data", "reads", 1, "sequence"], value: "CGTTA" },
      { op: "set", path: ["data", "reads", 1, "note"], value: "r2" },
      { op: "set", path: ["data", "reads", 2, "sequence"], value: "GTTAG" },
      { op: "set", path: ["data", "reads", 2, "note"], value: "r3 third" },
      { op: "set", path: ["data", "reads", 3, "sequence"], value: "CGTC" },
      { op: "set", path: ["data", "reads", 3, "note"], value: "r4 another read" },
    ]);
  });

  it("drops the headers where the sheet has no note, adding rows as needed", () => {
    const [reads] = sheetsOf("compare-graphs", STARTERS["compare-graphs"]);
    const { ops } = pasteOps(reads as NonNullable<typeof reads>, 0, 0, ">a\nACGTT\n>b\nCGTTA\n");
    expect(ops).toEqual([
      { op: "set", path: ["data", "reads", 0, "sequence"], value: "ACGTT" },
      { op: "insert", path: ["data", "reads"], at: 1, item: { sequence: "" } },
      { op: "set", path: ["data", "reads", 1, "sequence"], value: "CGTTA" },
    ]);
  });

  it("takes a letters field's FASTA by its format, a genome as a track's sequence", () => {
    const onOps = vi.fn();
    render(
      <SchemaForm
        component="read-tiling"
        data={STARTERS["read-tiling"] as unknown as Record<string, unknown>}
        problems={[]}
        onOps={onOps}
      />,
    );
    fireEvent.change(screen.getByRole("textbox", { name: "genome" }), {
      target: { value: ">chr1 a piece\nACGT\nTTAG\n" },
    });
    expect(onOps).toHaveBeenLastCalledWith([
      { op: "set", path: ["data", "genome"], value: "ACGTTTAG" },
    ]);
  });

  it("still takes a track's sequence as FASTA, now by its format", () => {
    const onOps = vi.fn();
    render(
      <SchemaForm
        component="sequence-track"
        data={STARTERS["sequence-track"] as unknown as Record<string, unknown>}
        problems={[]}
        onOps={onOps}
      />,
    );
    fireEvent.change(screen.getByRole("textbox", { name: "sequence" }), {
      target: { value: ">x\nAC\nGT\n" },
    });
    expect(onOps).toHaveBeenLastCalledWith([
      { op: "set", path: ["data", "sequence"], value: "ACGT" },
    ]);
  });
});

describe("what was computed, in words (M6DC.5)", () => {
  it("names a kmer-graph's k-mers, edges and branch, and what its path spells", () => {
    expect(summary("kmer-graph", STARTERS["kmer-graph"])).toEqual([
      { label: "k-mers", value: "ACG CGT GTT TTA TAG GTC" },
      { label: "edges", value: "5 · one branch at CGT" },
      { label: "path of 1–3", value: "spells ACGTTAG" },
    ]);
  });

  it("gives Checks one line on it", () => {
    expect(headline("kmer-graph", STARTERS["kmer-graph"])).toBe(
      "6 k-mers, 5 edges; the path of 1–3 spells ACGTTAG",
    );
    expect(headline("flow", STARTERS.flow)).toBeNull();
  });

  it("says something for every domain component, and nothing for a general kit", () => {
    for (const component of [
      "read-tiling",
      "kmer-window",
      "compare-graphs",
      "graph-artifacts",
    ] as const) {
      expect(summary(component, STARTERS[component]).length).toBeGreaterThan(0);
    }
    expect(summary("graph-artifacts", STARTERS["graph-artifacts"])).toContainEqual({
      label: "found",
      value: "a bubble (GTC TCA CAG) · a tip (AGG)",
    });
    expect(summary("flow", STARTERS.flow)).toEqual([]);
  });
});
