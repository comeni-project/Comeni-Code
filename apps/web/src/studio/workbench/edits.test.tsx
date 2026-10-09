import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { queryKeys } from "../../api/queries";
import type { DraftOut } from "../../api/schema";
import { answering } from "../../test-kit";
import { deleteBlock, fields, insertBlock, moveBlock, sendEdit } from "./edits";
import { refusalOf } from "./refusal";
import { follow, useDraftEdit } from "./useDraftEdit";

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

  it("runs two saves left at once one after another, the second on the first's revision (#255)", async () => {
    const client = new QueryClient();
    client.setQueryData(queryKeys.draft("d-1"), draft(3));
    const fake = answering({
      "PATCH /api/studio/drafts/d-1/fields": (init) => ({
        body: { draft: draft(JSON.parse(String(init?.body)).revision + 1), warnings: [] },
      }),
    });
    const { result } = renderHook(() => [useDraftEdit("d-1"), useDraftEdit("d-1")] as const, {
      wrapper: wrapper(client),
    });
    await act(() =>
      Promise.all([
        result.current[0].mutateAsync(fields({ title: "a" })),
        result.current[1].mutateAsync(fields({ claim: "b" })),
      ]),
    );
    expect(fake.mock.calls.map(([, init]) => JSON.parse(String(init?.body)).revision)).toEqual([
      3, 4,
    ]);
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
      items: [],
      stale: true,
    });
  });
});

describe("follow", () => {
  it("follows a block through inserts, moves and deletes as the API makes them", () => {
    const text = { kind: "text", markdown: "x" } as const;
    expect(follow(2, [insertBlock(0, text)])).toBe(3);
    expect(follow(2, [insertBlock(3, text)])).toBe(2);
    expect(follow(2, [moveBlock(0, 4)])).toBe(1);
    expect(follow(2, [moveBlock(4, 0)])).toBe(3);
    expect(follow(2, [moveBlock(2, 0)])).toBe(0);
    expect(follow(2, [deleteBlock(0)])).toBe(1);
    expect(follow(2, [deleteBlock(2)])).toBeNull();
    expect(follow(2, [fields({ title: "a" }), insertBlock(0, text), deleteBlock(1)])).toBe(2);
  });
});
