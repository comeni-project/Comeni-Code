// @vitest-environment node
import { describe, expect, it } from "vitest";
import { playerSrc, withRoute } from "./embed";

describe("playerSrc", () => {
  it("plays a YouTube video without cookies", () => {
    expect(playerSrc("youtube:Jnk_4Maf5Fk", "")).toBe(
      "https://www.youtube-nocookie.com/embed/Jnk_4Maf5Fk",
    );
  });

  it("starts and ends where the part says", () => {
    expect(playerSrc("youtube:Jnk_4Maf5Fk", "2:10–7:45")).toBe(
      "https://www.youtube-nocookie.com/embed/Jnk_4Maf5Fk?start=130&end=465",
    );
    expect(playerSrc("youtube:Jnk_4Maf5Fk", "1:02:03-1:03:00")).toBe(
      "https://www.youtube-nocookie.com/embed/Jnk_4Maf5Fk?start=3723&end=3780",
    );
  });

  it("gives nothing for a player it does not know", () => {
    expect(playerSrc("vimeo:123", "")).toBeNull();
  });
});

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
