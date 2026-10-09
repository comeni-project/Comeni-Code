# M4.8b — The workbench: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The S19 Drafts page and the S3 workbench: an author creates a node, writes its blocks,
resources, links and settings, watches the checks, and submits it.

**Architecture:** Every editor produces an edit command (`studio/workbench/edits.ts`); one
executor (`useDraftEdit`) adds the revision, sends it with `sendJson`, and writes the answer into
the draft's cache entry, so everything redraws with no refetch. An edit saves when you leave what
you changed (`LeaveToSave`). Checks are one GET, fetched only while shown. The API gains two
fields: the checklist's `problems`, the index's `regions`.

**Tech Stack:** Django + Ninja, React 19, React Router 8, TanStack Query 5, Tailwind 4, vitest +
Testing Library, Biome.

**Spec:** `docs/superpowers/specs/2026-10-07-m4-workbench-design.md` (M4K.1–M4K.7).

## Global Constraints

- Web commands run in Node 24 under podman from the repository root. `$WEB` stands for
  `podman run --rm --userns=keep-id -e NPM_CONFIG_UPDATE_NOTIFIER=false -v "$PWD":/w:Z -w /w/apps/web node:24-alpine`
  (zsh does not split a variable: keep it in a script).
- API commands need `.env` and `podman start code-dev-postgres code-dev-redis`.
- **Requests (the operator's rule):** opening the workbench is one GET; a save is one write and
  no refetch; Checks is one GET, only while shown; the preview is drawn in the browser; no polling.
- **One edit path:** no component calls `sendJson` for a draft edit except `useDraftEdit`.
- **Saves happen when you leave** (`LeaveToSave`) or press *Done*; unchanged text sends nothing.
- Errors are shown in the API's words (`sentenceOf`, `ErrorNotice`, the refusal's problems).
- Colours only from tokens; small files, one component each; `queries.ts` alone makes query keys.
- After any API change: export `openapi.json`, then `npm run api-types` in `apps/web`.
- Commits: house style, ending `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **A save racing another save** in the same draft (two editors left quickly): the second must
   carry the revision the first returned, not a stale one. Pinned in Task 2 (the executor reads
   the revision from the cache at send time).
2. **Leaving an editor with nothing changed** sends no request. Pinned in Task 5.
3. **A new block closed empty** sends nothing and leaves no block. Pinned in Task 5.
4. **A read-only draft** (submitted, approved, landed, discarded) offers no editor and no write.
   Pinned in Task 4.
5. **Checks hidden** never fetch, and a save while they are hidden sends no GET. Pinned in Task 9.

---

### Task 1: The checklist carries Verify's problems; the index carries the regions

**Files:**
- Modify: `apps/api/src/code_api/studio/drafts.py` (`checks`), `apps/api/src/code_api/studio/api.py`
  (`checklist`), `apps/api/src/code_api/studio/schemas.py` (`ChecklistOut`, `IndexOut`,
  `RegionChoiceOut`), `apps/api/src/code_api/studio/index_api.py`
- Test: `apps/api/tests/test_draft_checks.py`, `apps/api/tests/test_index_api.py`
- Regenerate: `apps/api/openapi.json`, `apps/web/src/api/schema.ts`

**Interfaces:**
- Produces: `ChecklistOut.problems: list[ProblemOut]`; `IndexOut.regions: list[RegionChoiceOut]`
  with `id`, `name`.

- [x] **Step 1: Write the failing tests.** In `test_draft_checks.py`:

```python
def test_the_checklist_carries_verifys_problems(client: Client) -> None:
    # One request for the workbench's Checks (M4K.6): the items and the problems behind them.
    draft = opened(client, {"node_id": "tpm"})
    links = [{"node": "no-such-node", "reason": "A reason for the test."}]
    call(client, "put", f"/api/studio/drafts/{draft}/links/needs", {"revision": 1, "links": links})
    body = call(client, "get", f"/api/studio/drafts/{draft}/checklist").json()
    verified = call(client, "get", f"/api/studio/drafts/{draft}/verify").json()
    assert body["problems"] == verified["problems"]
    assert any("no-such-node" in problem["text"] for problem in body["problems"])
```

  In `test_index_api.py`:

```python
def test_the_index_route_lists_the_regions_in_order(ada: User) -> None:
    follow.follow(GitHubSource(FakeGitHub(main="c1", trees={"c1": FIXTURES})))
    regions = signed_in(ada).get("/api/studio/index").json()["regions"]
    assert len(regions) == 6
    assert set(regions[0]) == {"id", "name"}
```

- [x] **Step 2: Run them to see them fail.**
  Run: `uv run pytest apps/api/tests/test_draft_checks.py apps/api/tests/test_index_api.py -q`
  Expected: two failures, `KeyError: 'problems'` and `KeyError: 'regions'`.

- [x] **Step 3: Implement.** In `drafts.py`, split the checklist so one check serves both answers:

```python
def checks(draft: Draft) -> tuple[list[Item], list[Problem]]:
    """M4's bar before submitting (M4W.5) and the problems behind it, from one check (M4K.6):
    it verifies clean, a level, a resource, four exam questions."""
    node, problems = _checked(draft)
    errors = [problem for problem in problems if problem.refuses]
    resources = 0 if node is None else len(node.resources)
    exam = 0 if node is None else len(node.exam)
    items = [
        Item(
            "verifies clean",
            not errors,
            "no problems" if not errors else f"{len(errors)} problem(s); see verify",
        ),
        Item("a level", node is not None, "" if node is None else f"{node.level.value}"),
        Item("a resource", resources >= 1, f"{resources} resource(s)"),
        Item("four exam questions", exam >= MIN_EXAM, f"{exam} of {MIN_EXAM}"),
    ]
    return items, problems


def checklist(draft: Draft) -> list[Item]:
    """The checklist alone, as submitting and approving read it (M4.5)."""
    return checks(draft)[0]
```

  In `schemas.py`: `ChecklistOut` gains `problems: list[ProblemOut] = []`; add

```python
class RegionChoiceOut(Schema):
    id: str
    name: str
```

  and `IndexOut` gains `regions: list[RegionChoiceOut]`. In `api.py`'s `checklist` route, call
  `items, problems = drafts.checks(draft)` and pass
  `problems=[ProblemOut.of(problem) for problem in problems]`. In `index_api.py`, add
  `regions=[RegionChoiceOut(id=r.id, name=r.name) for r in Region.objects.order_by("position")]`
  (import `Region` from `code_api.content.models`).

- [x] **Step 4: Run the tests, the schema, the types.**
  Run: `uv run pytest apps/api/tests/test_draft_checks.py apps/api/tests/test_index_api.py apps/api/tests/test_review.py -q` — Expected: all pass.
  Run: `uv run python apps/api/manage.py export_openapi_schema --api code_api.api.api --sorted --indent 2 --output apps/api/openapi.json`
  then `$WEB npm run api-types`. Run `uv run ruff check . && uv run ruff format --check . && uv run mypy`.

- [x] **Step 5: Commit.**

```bash
git add apps/api apps/web/src/api/schema.ts
git commit -m "feat(api): the checklist carries Verify's problems; the index its regions — M4.8b.1"
```

---

### Task 2: The edit path — `edits.ts`, `useDraftEdit`, and the drafts module

**Files:**
- Modify: `apps/web/src/api/client.ts` (`ApiUnreachable.body`), `apps/web/src/api/queries.ts`,
  `apps/web/src/main.tsx` (`staleTime`)
- Create: `apps/web/src/api/drafts.ts`, `apps/web/src/studio/workbench/edits.ts`,
  `apps/web/src/studio/workbench/useDraftEdit.ts`, `apps/web/src/studio/workbench/refusal.ts`
- Test: `apps/web/src/api/client.test.ts`, `apps/web/src/studio/workbench/edits.test.tsx`

**Interfaces:**
- Produces:
  - `ApiUnreachable.body: unknown` (the error's JSON body, when there was one).
  - `drafts.ts`: `fetchDrafts(state, signal?)`, `fetchDraft(id, signal?)`, `openDraft(body: OpenIn)`,
    `fetchChecks(id, signal?)` (`ChecklistOut`), `submitDraft(id, revision)`, `withdrawDraft(id)`,
    `discardDraft(id)`.
  - `queries.ts`: keys `drafts(state)`, `draft(id)`, `draftChecks(id)`, `studioIndex`; hooks
    `useDrafts(state, enabled?)`, `useDraft(id)`, `useDraftChecks(id, enabled)`, `useRegions()`.
  - `edits.ts`: `type Edit`, `fields`, `links`, `insertBlock`, `updateBlock`, `moveBlock`,
    `deleteBlock`, `resources`, `sendEdit(id, revision, edit)`.
  - `useDraftEdit(id)`: a TanStack mutation over `Edit`, key `["draft-edit", id]`.
  - `refusal.ts`: `refusalOf(error) -> { sentence, problems, stale }`.

- [x] **Step 1: Write the failing tests.** Append to `client.test.ts`:

```ts
  it("keeps an error's body", async () => {
    answers({ detail: "Refused.", code: "CA0208", problems: [] }, 422);
    await expect(getJson("/api/x")).rejects.toMatchObject({
      status: 422,
      body: { detail: "Refused.", code: "CA0208", problems: [] },
    });
  });
```

  `studio/workbench/edits.test.tsx`:

```tsx
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
    const fake = answering({ "PATCH /api/studio/drafts/d-1/fields": { body: { draft: draft(4) } } });
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
```

- [x] **Step 2: Run them to see them fail.**
  Run: `$WEB npx vitest run src/api/client.test.ts src/studio/workbench` — Expected: FAIL (no
  `body`; the modules are missing).

- [x] **Step 3: Implement.** In `client.ts`, `ApiUnreachable` takes a third constructor argument
  `body?: unknown` stored as `readonly body: unknown`; `readAnswer`'s refusal passes `body`.

  `api/drafts.ts`:

```ts
// The drafts API (M4.4 spec, M4W; M4.5, M4R): list, open, read, check, and the review steps a
// workbench takes. Edits go through the workbench's one executor, never from here.
import { getJson, sendJson } from "./client";
import type { ChecklistOut, DraftOut, DraftSummaryOut, OpenIn } from "./schema";

const BASE = "/api/studio/drafts";
export type DraftState = "open" | "submitted";

export const fetchDrafts = (state: DraftState, signal?: AbortSignal) =>
  getJson<DraftSummaryOut[]>(`${BASE}?state=${state}`, signal);

export const fetchDraft = (id: string, signal?: AbortSignal) =>
  getJson<DraftOut>(`${BASE}/${id}`, signal);

export const openDraft = (body: OpenIn) => sendJson<DraftOut>("POST", BASE, body);

/** The checklist and the problems behind it: one request for Checks (M4K.6). */
export const fetchChecks = (id: string, signal?: AbortSignal) =>
  getJson<ChecklistOut>(`${BASE}/${id}/checklist`, signal);

export const submitDraft = (id: string, revision: number) =>
  sendJson<DraftOut>("POST", `${BASE}/${id}/submit`, { revision });

export const withdrawDraft = (id: string) => sendJson<DraftOut>("POST", `${BASE}/${id}/withdraw`);

export const discardDraft = (id: string) => sendJson<DraftOut>("POST", `${BASE}/${id}/discard`);
```

  `queries.ts` gains keys and hooks:

```ts
  drafts: (state: DraftState) => ["drafts", state] as const,
  draft: (id: string) => ["draft", id] as const,
  draftChecks: (id: string) => ["draft", id, "checks"] as const,
  studioIndex: ["studio-index"] as const,
```

```ts
export const useDrafts = (state: DraftState, enabled = true) =>
  useQuery({
    queryKey: queryKeys.drafts(state),
    queryFn: ({ signal }) => fetchDrafts(state, signal),
    enabled,
    retry: false,
  });

export const useDraft = (id: string) =>
  useQuery({ queryKey: queryKeys.draft(id), queryFn: ({ signal }) => fetchDraft(id, signal), retry: false });

/** Checks, asked only while something shows them (M4K.4). */
export const useDraftChecks = (id: string, enabled: boolean) =>
  useQuery({
    queryKey: queryKeys.draftChecks(id),
    queryFn: ({ signal }) => fetchChecks(id, signal),
    enabled,
    retry: false,
  });

/** The regions, once: they change only with a content change. */
export const useRegions = () =>
  useQuery({
    queryKey: queryKeys.studioIndex,
    queryFn: ({ signal }) => getJson<IndexOut>("/api/studio/index", signal),
    select: (index) => index.regions,
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
  });
```

  `main.tsx`: `new QueryClient({ defaultOptions: { queries: { staleTime: 60_000 } } })`, with a
  comment: a tab coming back does not re-ask every question (M4K.4).

  `studio/workbench/edits.ts`:

```ts
// Every change a workbench makes, as a command (M4K.2): a method, a path under the draft and a
// body without the revision. `sendEdit` adds the revision and sends it; nothing else writes.
import { sendJson } from "../../api/client";
import type { BlockIn, FieldsIn, LinkIn, ResourceIn, SavedOut, TryQuestionIn } from "../../api/schema";

export interface Edit {
  method: "PATCH" | "PUT" | "POST" | "DELETE";
  path: string;
  body?: Record<string, unknown>;
}

export type LinkKind = "needs" | "goes_deeper" | "related";

export const fields = (change: Omit<FieldsIn, "revision">): Edit => ({
  method: "PATCH",
  path: "fields",
  body: change,
});

export const links = (kind: LinkKind, list: LinkIn[]): Edit => ({
  method: "PUT",
  path: `links/${kind}`,
  body: { links: list },
});

export const insertBlock = (at: number, block: BlockIn, question?: TryQuestionIn): Edit => ({
  method: "POST",
  path: "blocks",
  body: { at, block, question: question ?? null },
});

export const updateBlock = (at: number, block: BlockIn, question?: TryQuestionIn): Edit => ({
  method: "PUT",
  path: `blocks/${at}`,
  body: { block, question: question ?? null },
});

export const moveBlock = (at: number, to: number): Edit => ({
  method: "POST",
  path: `blocks/${at}/move`,
  body: { to },
});

export const deleteBlock = (at: number): Edit => ({ method: "DELETE", path: `blocks/${at}` });

export const resources = (list: ResourceIn[]): Edit => ({
  method: "PUT",
  path: "resources",
  body: { resources: list },
});

export function sendEdit(id: string, revision: number, edit: Edit): Promise<SavedOut> {
  const url = `/api/studio/drafts/${id}/${edit.path}`;
  if (edit.method === "DELETE") return sendJson<SavedOut>("DELETE", `${url}?revision=${revision}`);
  return sendJson<SavedOut>(edit.method, url, { ...edit.body, revision });
}
```

  `studio/workbench/useDraftEdit.ts`:

```ts
// The one executor (M4K.2): the revision is read from the cache when the edit is sent, so two
// quick saves chain; the answer is the new draft, written in place, and Checks go stale.
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../api/queries";
import type { DraftOut } from "../../api/schema";
import { type Edit, sendEdit } from "./edits";

export function useDraftEdit(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationKey: ["draft-edit", id],
    scope: { id: `draft-edit:${id}` }, // edits to one draft run one after another
    mutationFn: (edit: Edit) => {
      const draft = client.getQueryData<DraftOut>(queryKeys.draft(id));
      if (draft === undefined) throw new Error("The draft is not loaded.");
      return sendEdit(id, draft.revision, edit);
    },
    onSuccess: (saved) => {
      client.setQueryData(queryKeys.draft(id), saved.draft);
      return client.invalidateQueries({ queryKey: queryKeys.draftChecks(id) });
    },
  });
}
```

  `studio/workbench/refusal.ts`:

```ts
// What an editor shows when its save was refused (M4K.3): the API's sentence, the problems the
// files would have (a 422), and whether someone else saved first (CA0203).
import { ApiUnreachable, sentenceOf } from "../../api/client";
import type { ProblemOut } from "../../api/schema";

export interface Refusal {
  sentence: string;
  problems: ProblemOut[];
  stale: boolean;
}

export function refusalOf(error: Error | null): Refusal | null {
  if (error === null) return null;
  const body = error instanceof ApiUnreachable ? (error.body as Record<string, unknown>) : {};
  const problems = Array.isArray(body?.problems) ? (body.problems as ProblemOut[]) : [];
  return { sentence: sentenceOf(error), problems, stale: body?.code === "CA0203" };
}
```

- [x] **Step 4: Run the tests and checks.**
  Run: `$WEB npx vitest run src/api src/studio/workbench` — Expected: all pass.
  Run: `$WEB npm run -s lint` and `$WEB npm run -s typecheck` — Expected: clean.

- [x] **Step 5: Commit.**

```bash
git add apps/web/src
git commit -m "feat(web): one edit path — commands, one executor, and the drafts module — M4.8b.2"
```

---

### Task 3: Drafts (S19)

**Files:**
- Modify: `apps/web/src/studio/pages.ts` (Drafts entry), `pages.test.ts`,
  `apps/web/src/studio/StudioHome.tsx`, `StudioShell.test.tsx`, `apps/web/src/App.tsx`
- Create: `apps/web/src/studio/drafts/DraftsPage.tsx`, `DraftsTable.tsx`, `NewNodeForm.tsx`,
  `OpenExisting.tsx`, `DraftsPage.test.tsx`

**Interfaces:**
- Consumes: `useDrafts`, `openDraft`, `useRegions`, `useSearch`, `useMe`, `Field`, `PRIMARY`.
- Produces: `STUDIO_PAGES` gains `{ path: "/studio/drafts", label: "Drafts", minRole: "author",
  place: "top" }`; `DraftsPage`; the workbench route is `/studio/drafts/:id` (Task 4).

- [x] **Step 1: Write the failing tests.** `pages.test.ts`'s expectations become
  `pagesFor("operator")` → `["Drafts", "Team"]`, `pagesFor("author")` → `["Drafts"]`, and
  `pageAt("/studio/drafts/d-1")?.label` → `"Drafts"`. In `StudioShell.test.tsx`, *says when there
  is nothing for a role yet* becomes:

```tsx
  it("opens Drafts for an author", async () => {
    answering({ "GET /api/me": signedInAs("author") });
    studio("/studio");
    expect(await screen.findByTestId("where")).toHaveTextContent("/studio/drafts");
  });
```

  `studio/drafts/DraftsPage.test.tsx`:

```tsx
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { answering, renderAt, signedInAs } from "../../test-kit";
import { DraftsPage } from "./DraftsPage";

afterEach(() => vi.unstubAllGlobals());

const ME = signedInAs("author");
const mine = {
  public_id: "d-1",
  node_id: "k-mers",
  folder: "algorithms/k-mers",
  state: "open",
  base_digest: "",
  revision: 6,
  submitted_revision: null,
  contributors: [{ public_id: "u-1", email: "ada@example.org", name: "Ada", role: "author" }],
};
const theirs = { ...mine, public_id: "d-2", node_id: "tpm", folder: "quantification/tpm",
  contributors: [{ public_id: "u-9", email: "bo@example.org", name: "Bo", role: "author" }] };
const REGIONS = { body: { live: null, latest: null, main_head: null, checked_at: null,
  behind: false, regions: [{ id: "algorithms", name: "Algorithms" }] } };
const page = () => renderAt("/studio/drafts", <Route path="/studio/drafts" element={<DraftsPage />} />);

describe("DraftsPage", () => {
  it("shows my drafts first, and all open ones on asking", async () => {
    answering({ "GET /api/me": ME, "GET /api/studio/drafts?state=open": { body: [mine, theirs] },
      "GET /api/studio/index": REGIONS });
    page();
    expect(await screen.findByText("k-mers")).toBeInTheDocument();
    expect(screen.queryByText("tpm")).toBeNull();
    await userEvent.click(screen.getByRole("tab", { name: /All open/ }));
    expect(screen.getByText("tpm")).toBeInTheDocument();
  });

  it("asks for drafts in review only when that view is chosen", async () => {
    const fake = answering({ "GET /api/me": ME, "GET /api/studio/drafts?state=open": { body: [] },
      "GET /api/studio/index": REGIONS,
      "GET /api/studio/drafts?state=submitted": { body: [] } });
    page();
    await screen.findByRole("tab", { name: /In review/ });
    expect(fake.mock.calls.some(([url]) => url.endsWith("state=submitted"))).toBe(false);
    await userEvent.click(screen.getByRole("tab", { name: /In review/ }));
    expect(fake.mock.calls.some(([url]) => url.endsWith("state=submitted"))).toBe(true);
  });

  it("creates a new node and opens its workbench", async () => {
    const fake = answering({ "GET /api/me": ME, "GET /api/studio/drafts?state=open": { body: [] },
      "GET /api/studio/index": REGIONS,
      "POST /api/studio/drafts": { status: 201, body: { ...mine, public_id: "d-7" } } });
    page();
    await userEvent.type(await screen.findByLabelText("Node id"), "k-mer-counting");
    await userEvent.type(screen.getByLabelText("Title"), "Counting k-mers");
    await userEvent.type(screen.getByLabelText("Claim"), "Count every k-mer in a read set.");
    await userEvent.click(screen.getByRole("button", { name: "Create the draft" }));
    expect(await screen.findByTestId("where")).toHaveTextContent("/studio/drafts/d-7");
    const sent = JSON.parse(String(fake.mock.calls.find(([, i]) => i?.method === "POST")?.[1]?.body));
    expect(sent).toEqual({ node_id: "k-mer-counting", new: { title: "Counting k-mers",
      claim: "Count every k-mer in a read set.", region: "algorithms", level: "introductory",
      minutes: 20 } });
  });

  it("says in the API's words when a node already has a draft", async () => {
    answering({ "GET /api/me": ME, "GET /api/studio/drafts?state=open": { body: [] },
      "GET /api/studio/index": REGIONS,
      "GET /api/search?q=tpm": { body: { query: "tpm", unmatched: [], results: [
        { id: "tpm", title: "TPM", claim: "", level: "intermediate", minutes: 5,
          region: { id: "quantification", name: "Quantification" } }] } },
      "POST /api/studio/drafts": { status: 409, body: {
        detail: "tpm already has a draft (open), d-2, by bo@example.org.", code: "CA0202" } } });
    page();
    await userEvent.type(await screen.findByLabelText("Find a node by name or id"), "tpm");
    await userEvent.click(await screen.findByRole("button", { name: /TPM/ }));
    expect(await screen.findByText("tpm already has a draft (open), d-2, by bo@example.org."))
      .toBeInTheDocument();
  });
});
```

- [x] **Step 2: Run to see them fail.** Run: `$WEB npx vitest run src/studio` — Expected: FAIL.

- [x] **Step 3: Implement.** `pages.ts` adds the Drafts entry first, with the board's icon path
  `M4 1.5h5.5l3 3v10H4zM9.5 1.5v3h3M6 8h5M6 10.5h5M6 13h3`. `StudioHome` loses its empty branch
  (every role the gate lets in has Drafts):

```tsx
// /studio: the first page the member's role can open (M4S.4) — Drafts, for every role.
import { Navigate } from "react-router";
import { useMe } from "../api/queries";
import { pagesFor } from "./pages";

export function StudioHome() {
  const first = pagesFor(useMe().data?.user?.role ?? "")[0];
  return first === undefined ? null : <Navigate to={first.path} replace />;
}
```

  `DraftsPage.tsx`:

```tsx
// S19 · Drafts (M4.8b spec, M4K.1): the open drafts, a new node, and a node that exists. One GET
// of the open drafts; Mine is filtered here; In review is asked only when chosen (M4K.4).
import { useState } from "react";
import { useDrafts, useMe } from "../../api/queries";
import { ErrorNotice } from "../../layout/ErrorNotice";
import { DraftsTable } from "./DraftsTable";
import { NewNodeForm } from "./NewNodeForm";
import { OpenExisting } from "./OpenExisting";

const VIEWS = ["Mine", "All open", "In review"] as const;
type View = (typeof VIEWS)[number];

export function DraftsPage() {
  const [view, setView] = useState<View>("Mine");
  const you = useMe().data?.user?.public_id;
  const open = useDrafts("open");
  const review = useDrafts("submitted", view === "In review");
  const mine = (open.data ?? []).filter((d) => d.contributors.some((c) => c.public_id === you));
  const shown = view === "Mine" ? mine : view === "All open" ? open.data : review.data;
  const count = { Mine: mine.length, "All open": open.data?.length, "In review": review.data?.length };
  const failed = view === "In review" ? review.error : open.error;
  return (
    <>
      <header className="flex flex-col gap-1">
        <h1 className="text-[26px] font-semibold tracking-[-0.02em]">Drafts</h1>
        <p className="text-[13.5px] text-ink-2">
          Nodes being written. Open one to keep working, or start a new node.
        </p>
      </header>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section className="flex min-w-0 flex-col gap-3">
          <div role="tablist" aria-label="Drafts" className="flex gap-0.5 border-b border-border">
            {VIEWS.map((name) => (
              <button key={name} type="button" role="tab" aria-selected={view === name}
                onClick={() => setView(name)}
                className={`px-3.5 py-2 text-[13.5px] ${view === name
                  ? "font-semibold text-ink shadow-[inset_0_-2px_0_var(--ink)]" : "text-ink-2"}`}>
                {name} <span className="text-[11.5px] text-ink-3">{count[name] ?? ""}</span>
              </button>
            ))}
          </div>
          {failed !== null && <ErrorNotice error={failed} />}
          <DraftsTable drafts={shown ?? []} />
        </section>
        <aside className="flex flex-col gap-4">
          <NewNodeForm />
          <OpenExisting />
        </aside>
      </div>
    </>
  );
}
```

  `DraftsTable.tsx`: a `<table>` of node id (a `Link` to `/studio/drafts/{public_id}`, monospace),
  region (`folder.split("/")[0]`), `rev {revision}`, contributors' names or emails joined, and a
  state tag (`open` green *Open*, `submitted` blue *In review*, `approved` grey *Approved*); an
  empty list says *No drafts here.* `NewNodeForm.tsx`: `Field`s *Node id* (hint *Lowercase words
  joined by dashes; it names the folder.*), *Title*, *Claim*; selects *Region* (from
  `useRegions`, first by default) and *Level* (the five `Level` values with readable names,
  default `introductory`); *Minutes* (number, default 20); *Create the draft* → `openDraft({
  node_id, new: {...} })` → `navigate(/studio/drafts/{public_id})`; a refusal shows with
  `ErrorNotice` and, for a 422, the problems' `text`s. `OpenExisting.tsx`: a search field labelled
  *Find a node by name or id* using `useSearch(words)`; each result is a button `{title} · {id}`
  → `openDraft({ node_id: id })` → navigate; a refusal shows with `ErrorNotice`.

  In `App.tsx`, under `/studio`: `<Route path="drafts" element={<DraftsPage />} />`.

- [x] **Step 4: Run, lint, commit.**
  Run: `$WEB npx vitest run src/studio` — Expected: all pass. Lint and typecheck clean.

```bash
git add apps/web/src
git commit -m "feat(web): Drafts — the open drafts, a new node, and a node that exists — M4.8b.3"
```

---

### Task 4: The workbench page — header, tabs, states, preview

**Files:**
- Create: `apps/web/src/studio/workbench/WorkbenchPage.tsx`, `Header.tsx`, `StateLine.tsx`,
  `PreviewPanel.tsx`, `PreviewPage.tsx`, `ExamPoolTab.tsx`, `WorkbenchPage.test.tsx`
- Modify: `apps/web/src/App.tsx` (`drafts/:id`, `drafts/:id/preview`)

**Interfaces:**
- Consumes: `useDraft`, `withdrawDraft`, `Body` (`node/Body`), `ROLE`s via `canActAs`, `useMe`.
- Produces: `WorkbenchPage` with tabs from `?tab=` (`content` default, `resources`, `links`,
  `settings`, `exam`); `editable(draft)` = `draft.state === "open" && draft.node !== null`;
  `ContentTab`, `ResourcesTab`, `LinksTab` and `SettingsTab` are plugged into their tab slots by
  Tasks 5–8; until each lands, its slot renders nothing.

- [x] **Step 1: Write the failing tests.** `WorkbenchPage.test.tsx`:

```tsx
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { answering, renderAt, signedInAs } from "../../test-kit";
import { WorkbenchPage } from "./WorkbenchPage";

afterEach(() => vi.unstubAllGlobals());

export const NODE = {
  title: "k-mers", claim: "A read's k-mers are its substrings of length k.",
  region: "algorithms", level: "introductory", minutes: 10,
  needs: [], goes_deeper: [], related: [], resources: [], exam: [],
  blocks: [{ kind: "text", markdown: "The trick is to stop treating reads as units." }],
  questions: [],
};
export const DRAFT = { public_id: "d-1", node_id: "k-mers", folder: "algorithms/k-mers",
  state: "open", base_digest: "", revision: 3, submitted_revision: null,
  contributors: [{ public_id: "u-1", email: "ada@example.org", name: "Ada", role: "author" }],
  node: NODE, problems: [] };
const bench = (draft = DRAFT, path = "/studio/drafts/d-1") => {
  const fake = answering({ "GET /api/me": signedInAs("author"),
    "GET /api/studio/drafts/d-1": { body: draft },
    "POST /api/studio/drafts/d-1/withdraw": { body: { ...draft, state: "open" } } });
  renderAt(path, <Route path="/studio/drafts/:id" element={<WorkbenchPage />} />);
  return fake;
};

describe("WorkbenchPage", () => {
  it("opens with one request and draws the preview from it", async () => {
    const fake = bench();
    expect(await screen.findByRole("heading", { level: 1, name: "k-mers" })).toBeInTheDocument();
    expect(screen.getAllByText("The trick is to stop treating reads as units.").length).toBeGreaterThan(0);
    const studio = fake.mock.calls.filter(([url]) => url.startsWith("/api/studio"));
    expect(studio.map(([url]) => url)).toEqual(["/api/studio/drafts/d-1"]);
  });

  it("keeps the tab in the address", async () => {
    bench(DRAFT, "/studio/drafts/d-1?tab=exam");
    expect(await screen.findByText(/The exam pool's builder is not built yet/)).toBeInTheDocument();
  });

  it("reads as submitted, offers Withdraw to a contributor, and no editor", async () => {
    const fake = bench({ ...DRAFT, state: "submitted", submitted_revision: 3 });
    expect(await screen.findByText(/submitted for review/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add a text block" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Withdraw" }));
    expect(fake.mock.calls.some(([url, i]) => url.endsWith("/withdraw") && i?.method === "POST"))
      .toBe(true);
  });

  it("switches the preview to phone width", async () => {
    bench();
    await userEvent.click(await screen.findByRole("button", { name: "Phone" }));
    expect(screen.getByTestId("preview")).toHaveClass("max-w-[390px]");
  });
});
```

- [x] **Step 2: Run to see them fail.** `$WEB npx vitest run src/studio/workbench` — FAIL.

- [x] **Step 3: Implement.**
  - `WorkbenchPage.tsx` reads `:id`, `useDraft(id)`; while pending, *Loading the draft…*; on
    error, `ErrorNotice`; a draft with `node === null` shows its `problems`' text and nothing
    editable. Otherwise: `Header`, `StateLine`, a tab row (`role="tablist"`, each tab a
    `role="tab"` button setting `?tab=`), and a two-column body (`lg:grid-cols-[minmax(0,1fr)_480px]`):
    the active tab, and the right panel with *Preview* / *Checks* tabs (Checks is Task 9).
  - `Header.tsx`: breadcrumb `Drafts › {region} › {title}` (Drafts links back), the title as
    `h1`, a *Draft* tag (or the state's name), a level tag, and `Revision {n}` — after a save in
    this page, *Saved {seconds}s ago* from `useMutationState({ filters: { mutationKey:
    ["draft-edit", id], status: "success" }, select: (m) => m.state.submittedAt })` — and *Open
    preview in a new tab* (`target="_blank"` to `/studio/drafts/{id}/preview`).
  - `StateLine.tsx`: nothing for `open`; *Submitted for review — read only.* with **Withdraw**
    for a contributor or an operator (`withdrawDraft` → `setQueryData(draft)`); *Approved — read
    only.*; *Landed.* with a link to `/node/{node_id}`; *Discarded.* with a link to Drafts.
  - `PreviewPanel.tsx`: *Desktop* / *Phone* buttons (`aria-pressed`), and
    `<div data-testid="preview" className={phone ? "max-w-[390px]" : ""}>` holding the node's
    title, claim and `<Body blocks={node.blocks} questions={node.questions} />` — draft
    questions already fit `QuestionOut`.
  - `PreviewPage.tsx`: the same preview, full width, for the new tab.
  - `ExamPoolTab.tsx`: *The exam pool's builder is not built yet (M4.8c). Until then, exam
    questions are added through the API.* and the pool's size, `{node.exam.length} of 4`.
  - `App.tsx`: `<Route path="drafts/:id" element={<WorkbenchPage />} />` and
    `<Route path="drafts/:id/preview" element={<PreviewPage />} />` under `/studio`.

- [x] **Step 4: Run, lint, commit.**

```bash
git add apps/web/src
git commit -m "feat(web): the workbench page — header, tabs, states and the preview — M4.8b.4"
```

---

### Task 5: Content — the outline and text and callout blocks, saved when you leave

**Files:**
- Create: `apps/web/src/studio/workbench/LeaveToSave.tsx`, `ContentTab.tsx`, `Outline.tsx`,
  `BlockList.tsx`, `BlockEditor.tsx`, `MarkdownField.tsx`, `markdown.ts`, `markdown.test.ts`,
  `CalloutFields.tsx`, `RefusalNotice.tsx`, `ContentTab.test.tsx`
- Modify: `WorkbenchPage.tsx` (the content slot)

**Interfaces:**
- Consumes: `useDraftEdit`, `insertBlock`, `updateBlock`, `moveBlock`, `deleteBlock`,
  `refusalOf`, `useDraft`.
- Produces: `LeaveToSave({ onLeave, children })` (calls `onLeave` when focus leaves it);
  `wrap(text, start, end, before, after) -> { text, start, end }`; `RefusalNotice({ refusal,
  onReload })`; `BlockEditor({ draftId, at, insert, initial, question?, onClose })`.

- [x] **Step 1: Write the failing tests.** `markdown.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { wrap } from "./markdown";

describe("wrap", () => {
  it("wraps the selection", () =>
    expect(wrap("reads as units", 9, 14, "**", "**")).toEqual({
      text: "reads as **units**", start: 11, end: 16 }));
  it("inserts the marks at the cursor with nothing selected", () =>
    expect(wrap("ab", 1, 1, "*", "*")).toEqual({ text: "a**b", start: 2, end: 2 }));
});
```

  `ContentTab.test.tsx` (reuse `DRAFT` and `NODE` from `WorkbenchPage.test.tsx` by moving them
  into `studio/workbench/fixtures.ts`):

```tsx
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { answering, renderAt, signedInAs } from "../../test-kit";
import { DRAFT } from "./fixtures";
import { WorkbenchPage } from "./WorkbenchPage";

afterEach(() => vi.unstubAllGlobals());

const saved = (revision: number, blocks = DRAFT.node.blocks) => ({
  body: { draft: { ...DRAFT, revision, node: { ...DRAFT.node, blocks } }, warnings: [] } });
const bench = (extra = {}) => {
  const fake = answering({ "GET /api/me": signedInAs("author"),
    "GET /api/studio/drafts/d-1": { body: DRAFT }, ...extra });
  renderAt("/studio/drafts/d-1", <Route path="/studio/drafts/:id" element={<WorkbenchPage />} />);
  return fake;
};
const writes = (fake: ReturnType<typeof answering>) =>
  fake.mock.calls.filter(([, init]) => (init?.method ?? "GET") !== "GET");

describe("ContentTab", () => {
  it("saves a changed block when you leave it, once", async () => {
    const fake = bench({ "PUT /api/studio/drafts/d-1/blocks/0":
      saved(4, [{ kind: "text", markdown: "Slide a window of width k." }]) });
    await userEvent.click(await screen.findByRole("button", { name: /Edit block 1/ }));
    const box = screen.getByLabelText("Markdown");
    await userEvent.clear(box);
    await userEvent.type(box, "Slide a window of width k.");
    await userEvent.click(screen.getByRole("heading", { level: 1 })); // focus leaves the block
    expect(writes(fake)).toHaveLength(1);
    expect(JSON.parse(String(writes(fake)[0]?.[1]?.body))).toEqual({
      block: { kind: "text", markdown: "Slide a window of width k." }, question: null, revision: 3 });
  });

  it("sends nothing when you leave a block unchanged", async () => {
    const fake = bench();
    await userEvent.click(await screen.findByRole("button", { name: /Edit block 1/ }));
    await userEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(writes(fake)).toHaveLength(0);
  });

  it("adds a text block on leaving it, and sends nothing for one closed empty", async () => {
    const fake = bench({ "POST /api/studio/drafts/d-1/blocks": saved(4) });
    await userEvent.click((await screen.findAllByRole("button", { name: "Add a text block" }))[0] as HTMLElement);
    await userEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(writes(fake)).toHaveLength(0);
    await userEvent.click(screen.getAllByRole("button", { name: "Add a text block" })[0] as HTMLElement);
    await userEvent.type(screen.getByLabelText("Markdown"), "First words.");
    await userEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(JSON.parse(String(writes(fake)[0]?.[1]?.body)).at).toBe(0);
  });

  it("keeps the text and offers Reload when someone else saved first", async () => {
    bench({ "PUT /api/studio/drafts/d-1/blocks/0": { status: 409,
      body: { detail: "This draft has moved on to revision 4.", code: "CA0203" } } });
    await userEvent.click(await screen.findByRole("button", { name: /Edit block 1/ }));
    await userEvent.type(screen.getByLabelText("Markdown"), " More.");
    await userEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(await screen.findByText(/Someone else saved this draft/)).toBeInTheDocument();
    expect(screen.getByLabelText("Markdown")).toHaveValue(
      "The trick is to stop treating reads as units. More.");
    expect(screen.getByRole("button", { name: "Reload" })).toBeInTheDocument();
  });

  it("moves a block with one request", async () => {
    const two = [...DRAFT.node.blocks, { kind: "text", markdown: "Second." }];
    const fake = answering({ "GET /api/me": signedInAs("author"),
      "GET /api/studio/drafts/d-1": { body: { ...DRAFT, node: { ...DRAFT.node, blocks: two } } },
      "POST /api/studio/drafts/d-1/blocks/1/move": saved(4) });
    renderAt("/studio/drafts/d-1", <Route path="/studio/drafts/:id" element={<WorkbenchPage />} />);
    await userEvent.click(await screen.findByRole("button", { name: "Move block 2 up" }));
    expect(writes(fake).map(([url]) => url)).toEqual(["/api/studio/drafts/d-1/blocks/1/move"]);
  });

  it("deletes a block after confirming in place", async () => {
    const fake = bench({ "DELETE /api/studio/drafts/d-1/blocks/0?revision=3": saved(4, []) });
    await userEvent.click(await screen.findByRole("button", { name: "Delete block 1" }));
    expect(writes(fake)).toHaveLength(0);
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(writes(fake)).toHaveLength(1);
  });
});
```

- [x] **Step 2: Run to see them fail.** `$WEB npx vitest run src/studio/workbench` — FAIL.

- [x] **Step 3: Implement.**
  - `LeaveToSave.tsx`:

```tsx
// An edit saves when you leave what you changed (M4K.3): focus moving outside this box calls
// `onLeave`; moving within it does not.
import type { ReactNode } from "react";

export function LeaveToSave({ onLeave, children }: { onLeave: () => void; children: ReactNode }) {
  return (
    <fieldset
      className="m-0 flex min-w-0 flex-col gap-2.5 border-0 p-0"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) onLeave();
      }}
    >
      {children}
    </fieldset>
  );
}
```

  - `markdown.ts`: `wrap` as tested (returns the new text and the selection moved inside the
    marks). `MarkdownField.tsx`: a labelled textarea (*Markdown*) with B (`**`), I (`*`) and
    Link (`[`, `](https://)`) buttons that apply `wrap` to the selection.
  - `CalloutFields.tsx`: a select of *Misconception*, *Caveat*, *Convention*, a *Title* field and
    a `MarkdownField`.
  - `RefusalNotice.tsx`: the refusal's sentence (stale: *Someone else saved this draft; reload
    to see their change.* with a **Reload** button calling `onReload`, which refetches the draft
    query), and each problem's `text`.
  - `BlockEditor.tsx` keeps the block (and, for a try, its question) in local state; `commit()`:
    unchanged (or a new block left empty) → `onClose()`, no request; else `mutate(insert ?
    insertBlock(at, block, question) : updateBlock(at, block, question), { onSuccess: onClose })`.
    It renders inside `LeaveToSave onLeave={commit}`, with **Done** calling `commit`, and
    `RefusalNotice` on error. A `beforeunload` listener is set while its text differs from the
    saved block.
  - `BlockList.tsx`: for each block, a row with its kind tag, first words, **Edit block N**,
    **Move block N up/down** (`moveBlock`, disabled at the ends), **Delete block N** (confirm in
    place: *Delete this block?* — for a try, *Delete this block and its question?* — **Delete** /
    **Cancel**; `deleteBlock`), a native drag handle (`draggable`; a drop calls `moveBlock(from,
    to)`); between rows and at both ends, **Add a text block**, **Add a try block**, **Add a
    callout** opening a new `BlockEditor` with `insert`. One editor is open at a time; opening
    another commits the first by leaving it.
  - `Outline.tsx`: the blocks as a list (kind, first words); a click opens that block's editor.
  - `ContentTab.tsx`: `Outline` and `BlockList` side by side, holding which editor is open.
  - Read only (`!editable(draft)`): `BlockList` shows rows without Edit, Move, Delete or Add.

- [x] **Step 4: Run, lint, commit.**

```bash
git add apps/web/src
git commit -m "feat(web): Content — the outline, text and callout blocks, saved when you leave — M4.8b.5"
```

---

### Task 6: Try questions

**Files:**
- Create: `apps/web/src/studio/workbench/TryEditor.tsx`, `question.ts`, `question.test.ts`,
  `TryEditor.test.tsx`
- Modify: `BlockEditor.tsx` (a try block renders `TryEditor`)

**Interfaces:**
- Produces: `newQuestion(nodeId, questions) -> TryQuestionIn` (id `{nodeId}-q{n}`, the first
  unused n; a choice with two empty options, the first right); `questionIn(out: StudioQuestionOut)
  -> TryQuestionIn`.

- [x] **Step 1: Write the failing tests.** `question.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { newQuestion, questionIn } from "./question";

describe("question", () => {
  it("names a new question by the first free number", () => {
    expect(newQuestion("k-mers", [{ id: "k-mers-q1" }, { id: "k-mers-q3" }] as never).id)
      .toBe("k-mers-q2");
  });

  it("turns a draft's question into what an edit sends", () => {
    expect(questionIn({ id: "q", kind: "number", ask: "How many?", options: null, answer: 96,
      unit: "k-mers", tolerance: null, hints: ["n − k + 1"], rationale: "Each start." }))
      .toEqual({ id: "q", kind: "number", ask: "How many?", answer: 96, unit: "k-mers",
        tolerance: null, hints: ["n − k + 1"], rationale: "Each start.", options: null });
  });
});
```

  `TryEditor.test.tsx`: in the workbench (fixtures plus a try block and its question), editing
  the ask and leaving sends `PUT .../blocks/{at}` whose body has `block: { kind: "try", question:
  id }` and `question` with the new `ask`; *Add a try block*, typing an ask and two options,
  marking the second right, and **Done** sends `POST .../blocks` with `question.options[1].right
  === true`; switching *Choice* to *Number* shows *Answer*, *Unit*, *Tolerance* and sends
  `kind: "number"` with `answer` as a number.

- [x] **Step 2: Run to see them fail.** FAIL: `TryEditor` missing.

- [x] **Step 3: Implement.** `question.ts` as tested. `TryEditor.tsx`: *Question* (textarea);
  *Choice* / *Number* (radio inputs, as `RoleSwitch` draws them); for a choice, one row per
  option (*Option N* text, *Right answer* radio, *Misconception* text) with *+ Option* and
  *Remove*; for a number, *Answer* (number), *Unit*, *Tolerance*; *Hints* (one per line);
  *Rationale*. It edits the question held by `BlockEditor`, which sends it with the block.

- [x] **Step 4: Run, lint, commit.**

```bash
git add apps/web/src
git commit -m "feat(web): try questions in the workbench — M4.8b.6"
```

---

### Task 7: Settings and Links

The layouts are the `WorkbenchSettings` and `WorkbenchLinks` boards: one card of fields with the
*Each field saves when you leave it.* note and a Discard card under it; three link lists, each a
node id and a reason with *Remove* and *+ Link*.

**Files:**
- Create: `apps/web/src/studio/workbench/SettingsTab.tsx`, `LinksTab.tsx`, `LinkList.tsx`,
  `SettingsTab.test.tsx`, `LinksTab.test.tsx`
- Modify: `WorkbenchPage.tsx` (two slots)

**Interfaces:**
- Consumes: `fields`, `links`, `useRegions`, `discardDraft`, `useDraftEdit`, `LeaveToSave`.

- [x] **Step 1: Write the failing tests.** `SettingsTab.test.tsx`: changing *Title* and leaving
  the field sends one `PATCH .../fields` with `{ title, revision }` only; leaving it unchanged
  sends nothing; a problem whose `field` is `title` in the draft's `problems` shows under
  *Title*; **Discard this draft** asks once (*Discard this draft? It cannot be reopened.*), and
  **Discard** sends `POST .../discard`, then the page reads *Discarded.* `LinksTab.test.tsx`:
  adding a *needs* link (node id and reason) and leaving the *Needs* list sends one `PUT
  .../links/needs` with the whole list; removing one does the same; *Goes deeper* and *Related*
  send to their own paths.

- [x] **Step 2: Run to see them fail.** FAIL.

- [x] **Step 3: Implement.** `SettingsTab.tsx`: each of *Title*, *Claim*, *Region* (select from
  `useRegions`), *Level* (select), *Minutes* (number) in its own `LeaveToSave` that sends
  `fields({ <name>: value })` when the value differs from the draft's; problems with that
  `field` under it; at the bottom, *Discard this draft* (contributors and operators), confirmed in
  place, → `discardDraft` → `setQueryData`. `LinkList.tsx`: a list of rows (*Node*, *Reason*,
  *Remove*) and *+ Link*, inside one `LeaveToSave` that sends `links(kind, rows)` when the rows
  differ from the draft's (rows with an empty node are dropped). `LinksTab.tsx`: three
  `LinkList`s — *Needs* (what understanding this node requires), *Goes deeper*, *Related* (at most
  four, said under the list).

- [x] **Step 4: Run, lint, commit.**

```bash
git add apps/web/src
git commit -m "feat(web): Settings and Links in the workbench — M4.8b.7"
```

---

### Task 8: Resources

The layout is the `WorkbenchResources` board: *+ Resource* above the cards; one card open with
every field; the others closed with *Edit* and *Remove*.

**Files:**
- Create: `apps/web/src/studio/workbench/ResourcesTab.tsx`, `ResourceCard.tsx`,
  `ResourcesTab.test.tsx`
- Modify: `WorkbenchPage.tsx` (the slot)

**Interfaces:**
- Consumes: `resources`, `useDraftEdit`, `LeaveToSave`, `Field`.

- [x] **Step 1: Write the failing tests.** `ResourcesTab.test.tsx`: **+ Resource** opens an empty
  card; filling *Kind* (video/reading), *Provider*, *URL*, *Covers*, *Licence*, *Display*
  (embed/link), *Level* and leaving the card sends one `PUT .../resources` with the list; a card
  left empty sends nothing; **Remove** sends the list without it; a 422 shows the problems'
  `text` in the card and keeps its values.

- [x] **Step 2: Run to see them fail.** FAIL.

- [x] **Step 3: Implement.** `ResourceCard.tsx`: the fields of `ResourceIn` (*Video id* and *Part*
  shown for a video), in one `LeaveToSave`. `ResourcesTab.tsx`: the cards; leaving a changed
  card sends `resources(all cards)`; the list is the draft's resources plus at most one new card.

- [x] **Step 4: Run, lint, commit.**

```bash
git add apps/web/src
git commit -m "feat(web): Resources in the workbench — M4.8b.8"
```

---

### Task 9: Checks and Submit

**Files:**
- Create: `apps/web/src/studio/workbench/ChecksPanel.tsx`, `SubmitButton.tsx`,
  `ChecksPanel.test.tsx`
- Modify: `WorkbenchPage.tsx` (the right panel's Checks tab), `Header.tsx` (Submit)

**Interfaces:**
- Consumes: `useDraftChecks(id, enabled)`, `submitDraft`.

- [x] **Step 1: Write the failing tests.** `ChecksPanel.test.tsx`:
  - with Checks hidden, no `GET .../checklist` is made, and a save sends no GET after it;
  - opening *Checks* makes one `GET .../checklist` and lists each item (*verifies clean*, *a
    level*, *a resource*, *four exam questions* with their details) and each problem's `text`;
  - after a save with Checks open, one more `GET .../checklist`;
  - **Submit for review** opens *Before you submit* (one GET), listing the items; while
    `passed` is false the submit button reads *Fix {n} items to submit* and is disabled; when
    true, **Submit** sends `POST .../submit` with `{ revision }`, and the page reads *Submitted
    for review — read only.*

- [x] **Step 2: Run to see them fail.** FAIL.

- [x] **Step 3: Implement.** `ChecksPanel.tsx`: `useDraftChecks(id, true)` (mounted only while
  its tab is shown); items with a pass/fail mark and detail; problems as their `text`, refusing
  ones first. `SubmitButton.tsx`: the board's green button; a popover (open state local) that
  mounts `useDraftChecks(id, true)`; **Submit** → `submitDraft(id, draft.revision)` →
  `setQueryData(draft)`; a refusal (422 with `items`) lists them.

- [x] **Step 4: Run, lint, commit.**

```bash
git add apps/web/src
git commit -m "feat(web): Checks and Submit — asked only while shown — M4.8b.9"
```

- [x] **Step 5: Checkpoint review** (after this task, before the walk): a fresh reviewer (opus)
  over `git diff main...HEAD` with the spec, this plan and the ledger; findings filed as one
  issue, Critical and Important fixed test-first.

---

### Task 10: In the browser, docs, and the pull request

**Files:**
- Modify: `CLAUDE.md` (the web layout: `studio/drafts/`, `studio/workbench/`)
- Modify: the spec (*Notes from the build*); this plan (ticks)
- Create: `docs/notes/journal/2026-10-07-m4-8b-workbench.md`

- [x] **Step 1: The whole suite with CI's environment** (pytest, ruff, mypy, Django's checks, the
  migration check; the web's lint, typecheck, tests and build). Expected: all green.

- [x] **Step 2: Walk *done when*** beside the S19, S3, `WorkbenchSettings`, `WorkbenchLinks` and
  `WorkbenchResources` boards on the canvas, with `runserver` and the production build (`vite preview
  --port 5173`), colours compared in headless Chrome (`--user-data-dir` of its own): an invited
  author creates a node from Drafts; writes a text block, a try question and a callout; adds a
  resource, a *needs* link and the settings; Checks passes all but the exam pool; four exam
  questions are seeded with `POST /api/studio/drafts/{id}/exam`; the checklist passes; the author
  submits; the draft reads as submitted; Withdraw reopens it. Count the requests in the browser's
  network panel for one open and one save: one GET, one write.

- [x] **Step 3: Docs.** CLAUDE.md's layout, the spec's notes (each ruling and board difference),
  the journal entry. `uv run pytest tests/repo -q`.

- [x] **Step 4: Final review.** A fresh reviewer (opus) over the branch; findings filed;
  Critical and Important fixed test-first; minors deferred.

- [ ] **Step 5: Commit, push, open the pull request** (one `Closes #n` per line for each M4.8b
  sub-issue). Merge only on the operator's yes.
