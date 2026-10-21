import { describe, expect, it } from "vitest";
import type { FlowData } from "../schemas";
import { layoutFlow } from "./layout";

const SALMON: FlowData = {
  nodes: [
    { id: "transcriptome", label: "transcriptome" },
    { id: "reads", label: "reads" },
    { id: "index", label: "index" },
    { id: "kmers", label: "k-mers" },
    { id: "lookup", label: "lookup", group: "quant" },
    { id: "classes", label: "equivalence classes", group: "quant" },
    { id: "em", label: "EM", group: "quant" },
  ],
  edges: [
    { from: "transcriptome", to: "index" },
    { from: "reads", to: "kmers" },
    { from: "index", to: "lookup" },
    { from: "kmers", to: "lookup" },
    { from: "lookup", to: "classes" },
    { from: "classes", to: "em", label: "counts" },
  ],
  groups: [{ id: "quant", label: "salmon quant" }],
};

const overlap = (a: { x: number; y: number; w: number; h: number }, b: typeof a) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

describe("layoutFlow (M6FG.3)", () => {
  const laid = layoutFlow(SALMON);
  const box = (id: string) => laid.boxes.find((b) => b.id === id);

  it("places every node once, with no two boxes overlapping", () => {
    expect(laid.boxes.map((b) => b.id).sort()).toEqual(SALMON.nodes.map((n) => n.id).sort());
    for (const a of laid.boxes) {
      for (const b of laid.boxes) if (a !== b) expect(overlap(a, b), `${a.id} ${b.id}`).toBe(false);
    }
  });

  it("runs left to right by default, and top to bottom when asked", () => {
    for (const edge of SALMON.edges) {
      expect(box(edge.from)?.x ?? 0).toBeLessThan(box(edge.to)?.x ?? 0);
    }
    const down = layoutFlow({ ...SALMON, direction: "down" });
    const at = (id: string) => down.boxes.find((b) => b.id === id)?.y ?? 0;
    for (const edge of SALMON.edges) expect(at(edge.from)).toBeLessThan(at(edge.to));
  });

  it("draws one path per edge, and keeps an edge's label", () => {
    expect(laid.paths).toHaveLength(SALMON.edges.length);
    expect(laid.paths.every((p) => p.d.startsWith("M"))).toBe(true);
    expect(laid.paths.find((p) => p.to === "em")?.label).toBe("counts");
  });

  it("puts a group's box around its members", () => {
    const [group] = laid.groups;
    expect(group?.label).toBe("salmon quant");
    for (const id of ["lookup", "classes", "em"]) {
      const member = box(id);
      expect(
        member && group && member.x >= group.x && member.x + member.w <= group.x + group.w,
      ).toBe(true);
    }
  });

  it("splits a long label over two lines, and fits everything in its size", () => {
    expect(box("classes")?.lines).toEqual(["equivalence", "classes"]);
    expect(box("em")?.lines).toEqual(["EM"]);
    for (const b of laid.boxes) {
      expect(b.x + b.w).toBeLessThanOrEqual(laid.width);
      expect(b.y + b.h).toBeLessThanOrEqual(laid.height);
    }
  });

  it("is the same for the same data", () => {
    expect(layoutFlow(SALMON)).toEqual(laid);
  });
});
