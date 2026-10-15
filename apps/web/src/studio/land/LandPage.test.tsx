import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderLand } from "./landKit";

afterEach(() => vi.unstubAllGlobals());

describe("LandPage — its place", () => {
  it("opens with three questions and counts each view", async () => {
    const fake = renderLand();
    expect(await screen.findByRole("tab", { name: /Ready to land 2/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Landed 1/ })).toBeInTheDocument();
    const asked = fake.mock.calls.map(([url]) => url).filter((url) => url !== "/api/me");
    expect(asked.sort()).toEqual([
      "/api/studio/index",
      "/api/studio/landings",
      "/api/studio/landings/ready",
    ]);
  });
});
