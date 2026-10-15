import { describe, expect, it } from "vitest";
import { pageAt, pagesFor } from "./pages";

describe("Studio's pages", () => {
  it("finds the page a path is on", () => {
    expect(pageAt("/studio/team")?.label).toBe("Team");
    expect(pageAt("/studio/drafts/d-1")?.label).toBe("Drafts");
    expect(pageAt("/studio")).toBeUndefined();
  });

  it("gives each role the pages it can open", () => {
    expect(pagesFor("operator").map((page) => page.label)).toEqual([
      "Drafts",
      "Review",
      "Land",
      "Team",
    ]);
    expect(pagesFor("author").map((page) => page.label)).toEqual(["Drafts"]);
    expect(pagesFor("")).toEqual([]);
  });

  it("offers Review to reviewers and above", () => {
    expect(pagesFor("author").map((p) => p.label)).not.toContain("Review");
    expect(pagesFor("reviewer").map((p) => p.label)).toContain("Review");
    expect(pageAt("/studio/review")?.minRole).toBe("reviewer");
  });

  it("offers Land to operators only", () => {
    expect(pagesFor("reviewer").map((p) => p.label)).not.toContain("Land");
    expect(pageAt("/studio/land")?.minRole).toBe("operator");
  });
});
