// @vitest-environment node
import { describe, expect, it } from "vitest";
import { fastaLetters } from "./fasta";
import { parsePaste } from "./paste";

describe("a paste into a sheet (M6CO.4)", () => {
  it("reads tab-separated rows", () => {
    expect(parsePaste("3\t64\n5\t812\n", 2)).toEqual({
      header: null,
      rows: [
        ["3", "64"],
        ["5", "812"],
      ],
      dropped: 0,
    });
  });

  it("reads CSV with a quoted comma and a doubled quote", () => {
    expect(parsePaste('a,"b, c"\n"say ""hi""",d', 2).rows).toEqual([
      ["a", "b, c"],
      ['say "hi"', "d"],
    ]);
  });

  it("takes a first row naming the columns as a header, in any order", () => {
    expect(parsePaste("label\tid\nreads\tr\n", 2, ["id", "Label"])).toEqual({
      header: [1, 0],
      rows: [["reads", "r"]],
      dropped: 0,
    });
  });

  it("drops the cells past the sheet's last column and counts them", () => {
    expect(parsePaste("1\t2\t3\n4\t5\n", 2)).toEqual({
      header: null,
      rows: [
        ["1", "2"],
        ["4", "5"],
      ],
      dropped: 1,
    });
  });

  it("ignores a trailing blank line and Windows line ends", () => {
    expect(parsePaste("1\t2\r\n3\t4\r\n\r\n", 2).rows).toEqual([
      ["1", "2"],
      ["3", "4"],
    ]);
  });

  it("starts at a later column with fewer room", () => {
    expect(parsePaste("1\t2\t3", 2).dropped).toBe(1);
  });
});

describe("a pasted FASTA sequence", () => {
  it("drops the header line and the line breaks", () => {
    expect(fastaLetters(">chr1 a primer\nACGT\nacgt \n")).toBe("ACGTacgt");
  });

  it("takes bare letters as they are", () => {
    expect(fastaLetters("ACGT")).toBe("ACGT");
  });
});
