import { describe, expect, it } from "vitest";
import { pageAt, pagesFor } from "./pages";

describe("Studio's pages", () => {
  it("finds the page a path is on", () => {
    expect(pageAt("/studio/team")?.label).toBe("Team");
    expect(pageAt("/studio")).toBeUndefined();
  });

  it("gives each role the pages it can open", () => {
    expect(pagesFor("operator").map((page) => page.label)).toEqual(["Team"]);
    expect(pagesFor("author")).toEqual([]);
    expect(pagesFor("")).toEqual([]);
  });
});
