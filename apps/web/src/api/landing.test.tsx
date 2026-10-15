import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { landingOf } from "../studio/land/landKit";
import { queryKeys, useLanding } from "./queries";

afterEach(() => vi.unstubAllGlobals());

describe("useLanding", () => {
  it("takes a settled copy from the list over a moving one it holds (#320)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>(() => {})),
    );
    const client = new QueryClient();
    client.setQueryData(queryKeys.landing("l-1"), landingOf({ state: "open" }));
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const landed = landingOf({ state: "merged", landed: true });
    const { result } = renderHook(() => useLanding(landed), { wrapper });
    await waitFor(() => expect(result.current.data?.landed).toBe(true));
  });
});
