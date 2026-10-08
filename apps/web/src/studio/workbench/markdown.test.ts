import { describe, expect, it } from "vitest";
import { wrap } from "./markdown";

describe("wrap", () => {
  it("wraps the selection", () =>
    expect(wrap("reads as units", 9, 14, "**", "**")).toEqual({
      text: "reads as **units**",
      start: 11,
      end: 16,
    }));
  it("inserts the marks at the cursor with nothing selected", () =>
    expect(wrap("ab", 1, 1, "*", "*")).toEqual({ text: "a**b", start: 2, end: 2 }));
});
