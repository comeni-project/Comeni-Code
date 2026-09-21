// @vitest-environment node
import { describe, expect, it } from "vitest";
import { headingsOf, slugOf, splitBody } from "./body";
import { DE_BRUIJN } from "./debruijn.fixture";

describe("splitBody", () => {
  it("cuts the body at each try marker, in the author's order", () => {
    const pieces = splitBody(DE_BRUIJN.body);
    expect(pieces.map((piece) => (piece.kind === "try" ? piece.id : "text"))).toEqual([
      "text",
      "kmers-per-read",
      "text",
      "shared-unitig",
      "text",
    ]);
    expect(pieces[0]).toMatchObject({ kind: "text", markdown: expect.stringContaining("4-mers") });
  });

  it("gives one piece when there is no marker", () => {
    expect(splitBody("Just prose.\n")).toEqual([{ kind: "text", markdown: "Just prose.\n" }]);
  });

  it("leaves a marker inside a fenced block alone", () => {
    const body = "Before\n\n```text\n{% try x %}\n```\n\nAfter\n";
    expect(splitBody(body)).toEqual([{ kind: "text", markdown: body }]);
  });

  it("drops text pieces that are only blank lines", () => {
    expect(splitBody("{% try a %}\n\n{% try b %}\n")).toEqual([
      { kind: "try", id: "a" },
      { kind: "try", id: "b" },
    ]);
  });
});

describe("headingsOf", () => {
  it("lists the second-level headings, outside fences", () => {
    const body =
      "Intro\n\n## The problem it solves\n\n```md\n## not one\n```\n\n## Further reading\n";
    expect(headingsOf(body)).toEqual([
      { id: "the-problem-it-solves", text: "The problem it solves" },
      { id: "further-reading", text: "Further reading" },
    ]);
  });

  it("finds de Bruijn graphs' reading list", () => {
    expect(headingsOf(DE_BRUIJN.body)).toEqual([
      { id: "further-reading", text: "Further reading" },
    ]);
  });
});

describe("slugOf", () => {
  it("makes a heading an id", () => {
    expect(slugOf("Cost and choosing k")).toBe("cost-and-choosing-k");
    expect(slugOf("From reads to k-mers!")).toBe("from-reads-to-k-mers");
    expect(slugOf("  What’s `quant.sf`?  ")).toBe("whats-quantsf");
  });
});
