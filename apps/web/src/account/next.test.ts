import { describe, expect, it } from "vitest";
import { safeNext } from "./next";

describe("safeNext", () => {
  it("keeps a path on this site", () => expect(safeNext("/studio/team")).toBe("/studio/team"));

  it("refuses another site", () => {
    expect(safeNext("//evil.example")).toBe("/");
    expect(safeNext("https://evil.example")).toBe("/");
  });

  it("refuses another site written with a backslash or a control character (#234)", () => {
    expect(safeNext("/\\evil.example")).toBe("/");
    expect(safeNext("/\t/evil.example")).toBe("/");
  });

  it("keeps the query and fragment of a path on this site", () =>
    expect(safeNext("/route?goal=salmon#map")).toBe("/route?goal=salmon#map"));

  it("does not come back to an account page however it is written (#234)", () => {
    expect(safeNext("/%73ign-in")).toBe("/");
    expect(safeNext("/sign-in?x=1")).toBe("/");
    expect(safeNext("/join/tok")).toBe("/");
  });

  it("does not come back to the account pages", () => expect(safeNext("/sign-in")).toBe("/"));

  it("is home without one", () => expect(safeNext(null)).toBe("/"));
});
