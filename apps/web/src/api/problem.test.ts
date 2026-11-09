// The seed per browser and the problem's two calls (M6.8a spec, M6LP.1, M6LP.3, M6LP.4).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiUnreachable } from "./client";
import {
  ANSWER_BYTES,
  browserSeed,
  datasetUrl,
  fetchDataset,
  forgetSeed,
  SEED_KEY,
  sendAnswer,
  tooLong,
} from "./problem";

beforeEach(() => {
  window.localStorage.clear();
  forgetSeed();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("browserSeed", () => {
  it("makes a seed of digits once, keeps it, and reuses it", () => {
    const seed = browserSeed();
    expect(seed).toMatch(/^[0-9]{1,20}$/);
    expect(BigInt(seed) < 2n ** 64n).toBe(true);
    expect(window.localStorage.getItem(SEED_KEY)).toBe(seed);
    forgetSeed();
    expect(browserSeed()).toBe(seed);
  });

  it("takes a kept seed only if it is digits", () => {
    window.localStorage.setItem(SEED_KEY, "not a seed");
    expect(browserSeed()).toMatch(/^[0-9]{1,20}$/);
  });

  it("keeps one seed for the page when storage throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const seed = browserSeed();
    expect(seed).toMatch(/^[0-9]{1,20}$/);
    expect(browserSeed()).toBe(seed);
  });
});

describe("the calls", () => {
  it("names the dataset by node, seed and version", () => {
    expect(datasetUrl("de bruijn", "42", "abc")).toBe(
      "/api/nodes/de%20bruijn/problem/dataset?seed=42&version=abc",
    );
  });

  it("gives the dataset's text", async () => {
    vi.stubGlobal("fetch", async () => new Response("4\nACGT\n", { status: 200 }));
    await expect(fetchDataset("n", "42", "abc")).resolves.toBe("4\nACGT\n");
  });

  it("rejects with the API's sentence and status on 409", async () => {
    vi.stubGlobal(
      "fetch",
      async () =>
        new Response(JSON.stringify({ detail: "The problem changed.", code: "CA0010" }), {
          status: 409,
        }),
    );
    const failed = fetchDataset("n", "42", "abc");
    await expect(failed).rejects.toThrow("The problem changed.");
    await expect(failed).rejects.toBeInstanceOf(ApiUnreachable);
    await failed.catch((error: ApiUnreachable) => expect(error.status).toBe(409));
  });

  it("posts the answer with its seed and version", async () => {
    const fetched = vi.fn(
      async (_url: string, _init?: RequestInit) =>
        new Response(JSON.stringify({ right: true, said: "", callouts: [], rationale: "Why." }), {
          status: 200,
        }),
    );
    vi.stubGlobal("fetch", fetched);
    await expect(
      sendAnswer("n", { seed: "42", version: "abc", answer: "A -> B" }),
    ).resolves.toEqual({ right: true, said: "", callouts: [], rationale: "Why." });
    const [url, init] = fetched.mock.calls[0] ?? [];
    expect(url).toBe("/api/nodes/n/problem/answer");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({
      seed: "42",
      version: "abc",
      answer: "A -> B",
    });
  });
});

describe("tooLong", () => {
  it("counts UTF-8 bytes, not characters", () => {
    expect(ANSWER_BYTES).toBe(1_000_000);
    expect(tooLong("x".repeat(1_000_000))).toBe(false);
    expect(tooLong("é".repeat(500_001))).toBe(true);
  });
});
