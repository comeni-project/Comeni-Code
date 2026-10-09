// Test helpers for pages that ask the API: a fetch that answers by method and path, and a render
// inside a fresh query client and router. Unlisted questions never answer.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { vi } from "vitest";
import { QUERIES } from "./api/queries";
import type { MeOut } from "./api/schema";

export interface Answer {
  status?: number;
  body?: unknown;
}

export function answering(answers: Record<string, Answer | ((init?: RequestInit) => Answer)>) {
  const fake = vi.fn((url: string, init?: RequestInit) => {
    const found = answers[`${init?.method ?? "GET"} ${url}`];
    if (found === undefined) return new Promise<Response>(() => {});
    const { status = 200, body = {} } = typeof found === "function" ? found(init) : found;
    const text = status === 204 ? null : JSON.stringify(body);
    return Promise.resolve(new Response(text, { status }));
  });
  vi.stubGlobal("fetch", fake);
  return fake;
}

/** Holds the first request to `key` until the returned function answers it: for what happens
 * while a save is still in flight. */
export function holding(fake: ReturnType<typeof answering>, key: string) {
  const answer = Promise.withResolvers<Response>();
  const through = fake.getMockImplementation();
  let held = false;
  fake.mockImplementation((url, init) => {
    if (held || `${init?.method ?? "GET"} ${url}` !== key) return through?.(url, init) as never;
    held = true;
    return answer.promise;
  });
  return ({ status = 200, body = {} }: Answer) =>
    answer.resolve(new Response(JSON.stringify(body), { status }));
}

export function Where() {
  const { pathname, search } = useLocation();
  return <span data-testid="where">{`${pathname}${search}`}</span>;
}

export const renderAt = (path: string, routes: ReactNode) =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { ...QUERIES, retry: false } } })}
    >
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          {routes}
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

export const SIGNED_OUT: Answer = { body: { user: null } satisfies MeOut };

export const signedInAs = (role: string, name = "Ada"): Answer => ({
  body: {
    user: { public_id: "u-1", email: "ada@example.org", name, role },
  } satisfies MeOut,
});
