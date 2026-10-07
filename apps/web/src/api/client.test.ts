// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiUnreachable, csrfToken, getJson, sendJson, sentenceOf } from "./client";
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

  it("does not take a 204 as an answer to a read", async () => {
    vi.stubGlobal("fetch", async () => new Response(null, { status: 204 }));
    await expect(getJson("/api/health")).rejects.toThrow("the response wasn't JSON");
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

describe("getJson's answers that carry a body", () => {
  it("returns the body of a status it was told to accept", async () => {
    answers({ status: "down" }, 503);
    await expect(getJson("/api/health", undefined, [503])).resolves.toEqual({ status: "down" });
  });

  it("says the status when an error answer is not JSON", async () => {
    // nginx's own 502 page, while the API behind it is down.
    vi.stubGlobal("fetch", async () => new Response("<html>bad gateway</html>", { status: 502 }));
    await expect(getJson("/api/health")).rejects.toMatchObject(new ApiUnreachable("HTTP 502", 502));
  });
});

describe("sentenceOf", () => {
  it("prints the API's own sentence when it answered", () => {
    expect(sentenceOf(new ApiUnreachable("No topic with id 'x'.", 404))).toBe(
      "No topic with id 'x'.",
    );
  });

  it("says it cannot reach the API when nothing answered", () => {
    expect(sentenceOf(new ApiUnreachable("network error"))).toBe(
      "Can't reach the API · network error",
    );
    expect(sentenceOf(new Error("boom"))).toBe("Can't reach the API · unexpected error");
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

describe("sendJson", () => {
  it("sends JSON with the CSRF cookie's token", async () => {
    vi.stubGlobal("document", { cookie: "theme=dark; csrftoken=abc%3D1" });
    const fake = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fake);
    await expect(sendJson("POST", "/api/x", { a: 1 })).resolves.toEqual({ ok: true });
    expect(fake).toHaveBeenCalledWith(
      "/api/x",
      expect.objectContaining({
        method: "POST",
        body: '{"a":1}',
        headers: expect.objectContaining({ "X-CSRFToken": "abc=1" }),
      }),
    );
  });

  it("resolves nothing for a 204", async () => {
    vi.stubGlobal("document", { cookie: "" });
    vi.stubGlobal("fetch", async () => new Response(null, { status: 204 }));
    await expect(sendJson("DELETE", "/api/x")).resolves.toBeUndefined();
  });

  it("carries the API's sentence out of a refusal", async () => {
    vi.stubGlobal("document", { cookie: "" });
    answers({ detail: "Studio needs an active operator.", code: "CA0108" }, 409);
    await expect(sendJson("PATCH", "/api/team/members/x", {})).rejects.toMatchObject(
      new ApiUnreachable("Studio needs an active operator.", 409),
    );
  });

  it("returns an accepted status's body", async () => {
    vi.stubGlobal("document", { cookie: "" });
    answers({ status: 401 }, 401);
    await expect(sendJson("DELETE", "/_allauth/x", undefined, [401])).resolves.toEqual({
      status: 401,
    });
  });
});

describe("csrfToken", () => {
  it("is empty without the cookie", () => {
    vi.stubGlobal("document", { cookie: "theme=dark" });
    expect(csrfToken()).toBe("");
  });
});
