import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { queryKeys } from "../../api/queries";
import type { DraftOut } from "../../api/schema";
import { answering } from "../../test-kit";
import { deleteBlock, fields, insertBlock, moveBlock, sendEdit } from "./edits";
import { refusalOf } from "./refusal";
import { useDraftEdit } from "./useDraftEdit";

afterEach(() => vi.unstubAllGlobals());

const draft = (revision: number) => ({ public_id: "d-1", revision }) as DraftOut;

describe("edit commands", () => {
  it("adds the revision to the body", async () => {
    const fake = answering({
      "PATCH /api/studio/drafts/d-1/fields": { body: { draft: draft(4) } },
    });
    await sendEdit("d-1", 3, fields({ title: "k-mers" }));
    expect(fake.mock.calls[0]?.[1]?.body).toBe('{"title":"k-mers","revision":3}');
  });

  it("puts a delete's revision in the query", async () => {
    const fake = answering({
      "DELETE /api/studio/drafts/d-1/blocks/2?revision=5": { body: { draft: draft(6) } },
    });
    await sendEdit("d-1", 5, deleteBlock(2));
    expect(fake).toHaveBeenCalledOnce();
  });

  it("names a block's place in the path", () => {
    expect(moveBlock(1, 3)).toEqual({ method: "POST", path: "blocks/1/move", body: { to: 3 } });
    expect(insertBlock(0, { kind: "text", markdown: "Hi" })).toEqual({
      method: "POST",
      path: "blocks",
      body: { at: 0, block: { kind: "text", markdown: "Hi" }, question: null },
    });
  });
});

describe("useDraftEdit", () => {
  const wrapper = (client: QueryClient) =>
    function Wrapper({ children }: { children: ReactNode }) {
      return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    };

  it("writes the saved draft into the cache, and the next edit carries its revision", async () => {
    const client = new QueryClient();
    client.setQueryData(queryKeys.draft("d-1"), draft(3));
    const fake = answering({
      "PATCH /api/studio/drafts/d-1/fields": (init) => ({
        body: { draft: draft(JSON.parse(String(init?.body)).revision + 1), warnings: [] },
      }),
    });
    const { result } = renderHook(() => useDraftEdit("d-1"), { wrapper: wrapper(client) });
    await act(() => result.current.mutateAsync(fields({ title: "a" })));
    await act(() => result.current.mutateAsync(fields({ title: "b" })));
    expect(client.getQueryData<DraftOut>(queryKeys.draft("d-1"))?.revision).toBe(5);
    expect(fake.mock.calls.map(([, init]) => JSON.parse(String(init?.body)).revision)).toEqual([
      3, 4,
    ]);
    expect(fake.mock.calls.every(([url]) => url.endsWith("/fields"))).toBe(true);
  });

  it("says a stale save is stale, keeping the API's sentence", async () => {
    const client = new QueryClient();
    client.setQueryData(queryKeys.draft("d-1"), draft(3));
    answering({
      "PATCH /api/studio/drafts/d-1/fields": {
        status: 409,
        body: { detail: "This draft has moved on.", code: "CA0203" },
      },
    });
    const { result } = renderHook(() => useDraftEdit("d-1"), { wrapper: wrapper(client) });
    act(() => result.current.mutate(fields({ title: "a" })));
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(refusalOf(result.current.error)).toEqual({
      sentence: "This draft has moved on.",
      problems: [],
      stale: true,
    });
  });
});
