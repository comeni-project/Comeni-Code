import { describe, expect, it } from "vitest";
import { safeNext } from "./next";

describe("safeNext", () => {
  it("keeps a path on this site", () => expect(safeNext("/studio/team")).toBe("/studio/team"));

  it("refuses another site", () => {
    expect(safeNext("//evil.example")).toBe("/");
    expect(safeNext("https://evil.example")).toBe("/");
  });

  it("does not come back to the account pages", () => expect(safeNext("/sign-in")).toBe("/"));

  it("is home without one", () => expect(safeNext(null)).toBe("/"));
});
