import { describe, expect, it } from "vitest";
import { withRoute } from "./url";

describe("withRoute", () => {
  it("carries the goals and what is known", () => {
    expect(withRoute("/node/k-mers", ["salmon"], ["tpm"])).toBe(
      "/node/k-mers?goal=salmon&known=tpm",
    );
  });

  it("is the bare path with no route", () => {
    expect(withRoute("/node/k-mers", [], [])).toBe("/node/k-mers");
  });
});
