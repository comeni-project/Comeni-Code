// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiUnreachable, getJson } from "./client";
import { nodeUrl } from "./nodes";
import { routeUrl } from "./routes";
import { searchUrl } from "./search";

const answers = (body: unknown, status = 200) =>
  vi.stubGlobal(
    "fetch",
    async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
      }),
  );

afterEach(() => vi.unstubAllGlobals());

describe("getJson", () => {
  it("returns the body of a 200", async () => {
    answers({ query: "salmon", results: [], unmatched: [] });
    await expect(getJson("/api/search?q=salmon")).resolves.toEqual({
      query: "salmon",
      results: [],
      unmatched: [],
    });
  });

  it("carries the API's own sentence out of an error body", async () => {
    answers({ detail: "The index has not been built yet." }, 503);
    await expect(getJson("/api/search?q=a")).rejects.toThrow("The index has not been built yet.");
  });

  it("falls back to the status when there is no sentence", async () => {
    answers({ nothing: true }, 500);
    await expect(getJson("/api/search?q=a")).rejects.toThrow("HTTP 500");
  });

  it("says network error when fetch throws", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new TypeError("failed");
    });
    await expect(getJson("/api/search?q=a")).rejects.toThrow("network error");
  });

  it("says when the answer wasn't JSON", async () => {
    vi.stubGlobal("fetch", async () => new Response("<html>", { status: 200 }));
    await expect(getJson("/api/search?q=a")).rejects.toThrow("the response wasn't JSON");
  });

  it("keeps the status on the error", async () => {
    answers({ detail: "A search needs a word." }, 422);
    await expect(getJson("/api/search?q=")).rejects.toMatchObject(
      new ApiUnreachable("A search needs a word.", 422),
    );
  });
});

describe("the urls", () => {
  it("builds a search url with the words and the limit", () => {
    expect(searchUrl("why my reads don't map")).toBe(
      "/api/search?q=why+my+reads+don%27t+map&limit=10",
    );
  });

  it("asks for one node by its id", () => {
    expect(nodeUrl("de-bruijn-graphs")).toBe("/api/nodes/de-bruijn-graphs");
  });

  it("repeats goal for every target", () => {
    expect(routeUrl(["salmon", "kallisto"])).toBe("/api/routes?goal=salmon&goal=kallisto");
  });

  it("carries a known topic when there is one", () => {
    expect(routeUrl(["salmon"], ["read-mapping"])).toBe(
      "/api/routes?goal=salmon&known=read-mapping",
    );
  });
});
