// @vitest-environment node
import { describe, expect, it } from "vitest";
import { shownLevel, shownStops, shownTime } from "./format";

describe("the words a route is described in", () => {
  it("says a time the way the command does", () => {
    expect(shownTime(184)).toBe("about 3 h 4 min");
    expect(shownTime(45)).toBe("about 45 min");
    expect(shownTime(120)).toBe("about 2 h");
  });

  it("says a level the way the command does", () => {
    expect(shownLevel("first-steps")).toBe("First steps");
    expect(shownLevel("intermediate")).toBe("Intermediate");
  });

  it("counts stops in the singular when there is one", () => {
    expect(shownStops(1)).toBe("1 stop");
    expect(shownStops(17)).toBe("17 stops");
  });
});
