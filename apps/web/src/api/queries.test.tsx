import { hashKey, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RoutePage } from "../route/RoutePage";
import { StartPage } from "../start/StartPage";
import { queryKeys } from "./queries";
import type { RouteOut } from "./schema";

afterEach(() => vi.unstubAllGlobals());

describe("queryKeys", () => {
  it("never gives two different routes one key (#137)", () => {
    expect(hashKey(queryKeys.route(["salmon", "kallisto"], []))).not.toBe(
      hashKey(queryKeys.route(["salmon"], ["kallisto"])),
    );
  });

  it("gives the same route the same key", () => {
    expect(hashKey(queryKeys.route(["salmon"], []))).toBe(hashKey(queryKeys.route(["salmon"], [])));
  });
});

const both: RouteOut = {
  goals: ["salmon", "kallisto"],
  known: [],
  stops: [],
  span: { lowest: "first-steps", highest: "intermediate" },
  minutes: 0,
};

describe("Start's preview and the Route page", () => {
  it("do not share a route that differs in what is known (#137)", async () => {
    // Start's preview answers; the Route page's own request never does, so only a cache hit
    // could fill it.
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) =>
        url.includes("known=")
          ? new Promise<Response>(() => {})
          : Promise.resolve(
              new Response(JSON.stringify(url.startsWith("/api/routes") ? both : {}), {
                status: 200,
                headers: { "Content-Type": "application/json" },
              }),
            ),
      ),
    );
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const start = render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={["/?goal=salmon&goal=kallisto"]}>
          <StartPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await waitFor(() =>
      expect(
        client
          .getQueryCache()
          .getAll()
          .some((query) => query.queryKey[0] === "route" && query.state.status === "success"),
      ).toBe(true),
    );
    start.unmount();

    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={["/route?goal=salmon&known=kallisto"]}>
          <RoutePage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByText("Weaving your route…")).toBeInTheDocument();
  });
});
