// @vitest-environment node
import { describe, expect, it } from "vitest";
import { type Block, headingsOf, slugOf, splitReading } from "./body";
import { DE_BRUIJN } from "./debruijn.fixture";

describe("headingsOf", () => {
  it("lists the second-level headings of the text blocks", () => {
    const blocks: Block[] = [
      { kind: "text", markdown: "Lead.\n\n## What DNA is\n\nText.\n" },
      { kind: "try", question: "q" },
      { kind: "text", markdown: "\n## Why it matters\n" },
    ];
    expect(headingsOf(blocks).map((heading) => heading.text)).toEqual([
      "What DNA is",
      "Why it matters",
    ]);
  });

  it("skips headings inside fences", () => {
    const blocks: Block[] = [
      {
        kind: "text",
        markdown:
          "Intro\n\n## The problem it solves\n\n```md\n## not one\n```\n\n## Further reading\n",
      },
    ];
    expect(headingsOf(blocks)).toEqual([
      { id: "the-problem-it-solves", text: "The problem it solves" },
      { id: "further-reading", text: "Further reading" },
    ]);
  });

  it("finds de Bruijn graphs' reading list", () => {
    expect(headingsOf(DE_BRUIJN.blocks)).toEqual([
      { id: "further-reading", text: "Further reading" },
    ]);
  });
});

describe("splitReading", () => {
  it("moves Further reading out of the blocks, into its own text", () => {
    const blocks: Block[] = [
      { kind: "text", markdown: "Body.\n\n## Further reading\n\n- [A](https://example.org)\n" },
    ];
    const { blocks: kept, reading } = splitReading(blocks);
    expect(kept).toEqual([{ kind: "text", markdown: "Body.\n" }]);
    expect(reading).toBe("\n- [A](https://example.org)\n");
  });

  it("keeps the blocks before the list as they are", () => {
    const blocks: Block[] = [
      { kind: "text", markdown: "Lead.\n" },
      { kind: "try", question: "q" },
      { kind: "text", markdown: "\n## Further reading\n\n- one\n" },
    ];
    const { blocks: kept, reading } = splitReading(blocks);
    expect(kept).toEqual([
      { kind: "text", markdown: "Lead.\n" },
      { kind: "try", question: "q" },
      { kind: "text", markdown: "" },
    ]);
    expect(reading).toBe("\n- one\n");
  });

  it("leaves blocks with no reading list whole", () => {
    const blocks: Block[] = [{ kind: "text", markdown: "Just prose.\n" }];
    expect(splitReading(blocks)).toEqual({ blocks, reading: "" });
  });
});

describe("slugOf", () => {
  it("makes a heading an id", () => {
    expect(slugOf("Cost and choosing k")).toBe("cost-and-choosing-k");
    expect(slugOf("From reads to k-mers!")).toBe("from-reads-to-k-mers");
    expect(slugOf("  What’s `quant.sf`?  ")).toBe("whats-quantsf");
  });
});
