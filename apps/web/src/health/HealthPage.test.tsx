// Every health state, in words (M0 part 7 spec, P7.4). fetch is stubbed; no API runs.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { HealthOut } from "../api/schema";
import { HealthPage } from "./HealthPage";

const report = (worker: "ok" | "down"): HealthOut => ({
  status: worker,
  checks: [
    { name: "database", status: "ok", duration_ms: 3 },
    { name: "redis", status: "ok", duration_ms: 1 },
    { name: "worker", status: worker, duration_ms: 2 },
  ],
});

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <HealthPage pollMs={false} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const status = () => screen.getByRole("status");

afterEach(() => vi.unstubAllGlobals());

describe("HealthPage", () => {
  it("says it is checking while the first request is pending", () => {
    vi.stubGlobal("fetch", () => new Promise(() => {}));
    renderPage();
    expect(status()).toHaveTextContent("Checking…");
  });

  it("reports all checks ok, with each check in words", async () => {
    vi.stubGlobal("fetch", async () => json(200, report("ok")));
    renderPage();
    await waitFor(() => expect(status()).toHaveTextContent("All 3 checks ok"));
    const rows = screen.getAllByRole("listitem");
    expect(rows.map((r) => r.textContent)).toEqual([
      "databaseok3 ms",
      "redisok1 ms",
      "workerok2 ms",
    ]);
  });

  it("names what is down on a 503", async () => {
    vi.stubGlobal("fetch", async () => json(503, report("down")));
    renderPage();
    await waitFor(() => expect(status()).toHaveTextContent("1 needs you: worker"));
    expect(screen.getAllByRole("listitem")[2]).toHaveTextContent("workerdown2 ms");
  });

  it.each([
    ["an unexpected status", async () => json(502, {}), "HTTP 502"],
    // M4.1.3: an unexpected status says its number, not the body's own sentence.
    [
      "a status with a sentence of its own",
      async () => json(404, { detail: "Not Found" }),
      "HTTP 404",
    ],
    ["a 2xx that is not a report", async () => new Response(null, { status: 204 }), "HTTP 204"],
    [
      "a network failure",
      async () => Promise.reject(new TypeError("fetch failed")),
      "network error",
    ],
    [
      "a body that is not JSON",
      async () => new Response("<html>", { status: 200 }),
      "the response wasn't JSON",
    ],
  ])("says it can't reach the API on %s", async (_, fake, reason) => {
    vi.stubGlobal("fetch", fake);
    renderPage();
    await waitFor(() => expect(status()).toHaveTextContent(`Can't reach the API · ${reason}`));
    expect(screen.queryByRole("listitem")).toBeNull();
  });

  it("keeps the last result, marked stale, when a later check fails", async () => {
    const fetch = vi.fn(async () => json(200, report("ok")));
    vi.stubGlobal("fetch", fetch);
    renderPage();
    await waitFor(() => expect(status()).toHaveTextContent("All 3 checks ok"));
    fetch.mockImplementation(async () => Promise.reject(new TypeError("fetch failed")));
    fireEvent.click(screen.getByRole("button", { name: "Check now" }));
    await waitFor(() => expect(status()).toHaveTextContent(/Stale · last checked \d\d:\d\d:\d\d/));
    expect(status()).toHaveTextContent("network error");
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });

  it("checks again when asked", async () => {
    // The top bar also asks who is signed in (M4.8a); only the health questions are counted.
    const fetch = vi.fn(async (url: string) =>
      url === "/api/me" ? json(200, { user: null }) : json(200, report("ok")),
    );
    vi.stubGlobal("fetch", fetch);
    renderPage();
    await waitFor(() => expect(status()).toHaveTextContent("All 3 checks ok"));
    fireEvent.click(screen.getByRole("button", { name: "Check now" }));
    const asked = () => fetch.mock.calls.filter(([url]) => url === "/api/health");
    await waitFor(() => expect(asked()).toHaveLength(2));
  });
});
