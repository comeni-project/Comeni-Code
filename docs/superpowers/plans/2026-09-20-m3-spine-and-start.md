# M3 part 3 — the spine and the Start page: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** the first screen — a learner types words, confirms a target and sees the route preview —
on a routed web app that fetches from the real API.

**Architecture:** React Router 7/8 for paths, the page's state in the URL (`?q=`, `?goal=`),
react-query over a small typed fetch client, three stages on one page.

**Tech Stack:** React 19, Vite 8, TypeScript 7 strict, Tailwind 4 with the generated tokens,
vitest + Testing Library, Biome.

**Spec:** [`docs/superpowers/specs/2026-09-20-m3-spine-and-start-design.md`](../specs/2026-09-20-m3-spine-and-start-design.md)

## Global Constraints

- **The identity is the law** (W10): tokens only — `bg-surface`, `text-ink-2`, `border-border`,
  `rounded-control`, `rounded-panel`, `text-line`, `text-sel`, `bg-btn`/`text-btn-ink` — never a
  raw hex. Lexend for text, Geist Mono for data. **Nothing under 11 px.** WCAG AA. **Colour never
  carries meaning alone**: every state is also words.
- **Every state is a sentence.** `HealthPage.tsx` is the precedent; read it before writing a
  state.
- **Types come from `src/api/schema.ts`**, generated from `openapi.json`. Do not hand-write a
  response type.
- **Dependencies are pinned exactly** in `package.json` (no `^`), as every existing one is.
- Tests: `npm run test` (vitest, jsdom), `npm run typecheck`, `npm run lint` (Biome) all clean.
- Conventional Commits with a body ending `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- Never commit to `main`; the branch is `m3-part-3-spine-and-start`.

---

### Task 1: The router and the paths

**Files:**
- Modify: `apps/web/package.json` (add `react-router`), `apps/web/src/main.tsx`,
  `apps/web/src/App.tsx`, `apps/web/src/App.test.tsx`
- Modify: `ops/stack-check.sh`

**Interfaces:**
- Produces: `<App />` rendering `<Routes>`; `/` → `StartPage` (a stub in this task),
  `/health` → `HealthPage`, `/identity` → `Specimen`, `*` → `NotFound`.

- [ ] **Step 1: Install the router**

```bash
cd apps/web && npm install --save-exact react-router@8.4.0
```

- [ ] **Step 2: Write the failing tests**

```tsx
// apps/web/src/App.test.tsx — replaces the path prop with MemoryRouter
const renderAt = (path: string) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  );

it("shows the Start page at /", () => {
  renderAt("/");
  expect(
    screen.getByRole("heading", { level: 1, name: "What do you want to learn?" }),
  ).toBeInTheDocument();
});

it("shows the health page at /health", () => {
  vi.stubGlobal("fetch", () => new Promise(() => {}));
  renderAt("/health");
  expect(screen.getByRole("heading", { level: 1, name: "Health" })).toBeInTheDocument();
});

it("shows the identity specimen at /identity", () => { … });
it("says not found anywhere else, under the Comeni Code bar", () => { … });
```

- [ ] **Step 3: Run them and watch them fail**

Run: `cd apps/web && npm run test`

- [ ] **Step 4: Wire the router**

`main.tsx` wraps `<App />` in `<BrowserRouter>`. `App.tsx` becomes a `<Routes>` table and loses
its `path` prop. `StartPage` is a stub with the h1 and the lede for now; tasks 4 and 5 fill it.

- [ ] **Step 5: Cover the move in the stack check**

`ops/stack-check.sh` gains a line asserting `/health` serves the app, beside the `/identity` one.

- [ ] **Step 6: Run everything and commit**

```bash
cd apps/web && npm run lint && npm run test && npm run typecheck
git add apps/web ops/stack-check.sh
git commit -m "feat(web): React Router, with Start at / and health at /health"
```

---

### Task 2: The fetch client

**Files:**
- Create: `apps/web/src/api/client.ts`, `apps/web/src/api/search.ts`, `apps/web/src/api/routes.ts`
- Create: `apps/web/src/api/client.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export class ApiUnreachable extends Error { readonly reason: string }
  export async function getJson<T>(url: string, signal?: AbortSignal): Promise<T>
  export function searchUrl(words: string, limit?: number): string
  export async function fetchSearch(words: string, signal?: AbortSignal): Promise<SearchOut>
  export function routeUrl(goals: readonly string[], known?: readonly string[]): string
  export async function fetchRoute(goals: readonly string[], signal?: AbortSignal): Promise<RouteOut>
  ```
  `SearchOut` and `RouteOut` are `components["schemas"][…]` from `schema.ts`.

- [ ] **Step 1: Write the failing tests**

```ts
it("carries the API's own sentence out of an error body", async () => {
  vi.stubGlobal("fetch", async () =>
    new Response(JSON.stringify({ detail: "The index has not been built yet." }), { status: 503 }),
  );
  await expect(getJson("/api/search?q=a")).rejects.toThrow("The index has not been built yet.");
});

it("says network error when fetch throws", async () => { … "network error" … });
it("says the response wasn't JSON when it isn't", async () => { … });
it("builds a search url with the words and the limit", () => {
  expect(searchUrl("why my reads don't map")).toBe(
    "/api/search?q=why+my+reads+don%27t+map&limit=10",
  );
});
it("repeats goal for every target", () => {
  expect(routeUrl(["salmon", "kallisto"])).toBe("/api/routes?goal=salmon&goal=kallisto");
});
```

Check the exact encoding `URLSearchParams` produces before pinning those two strings — it encodes
a space as `+` and an apostrophe as `%27`, but confirm rather than trust this plan.

- [ ] **Step 2: Run them and watch them fail**

Run: `cd apps/web && npm run test src/api/client.test.ts`

- [ ] **Step 3: Write the three modules**

`getJson` mirrors `health.ts`'s shape: catch the network error, read the body once, and when the
status is not 200 throw `ApiUnreachable` with the body's `detail` if there is one, otherwise
`HTTP <status>`.

- [ ] **Step 4: Run the tests and commit**

```bash
git add apps/web/src/api
git commit -m "feat(web): a typed fetch client for search and routes"
```

---

### Task 3: The top bar's search

**Files:**
- Modify: `apps/web/src/layout/TopBar.tsx`
- Create: `apps/web/src/layout/TopBar.test.tsx`

**Interfaces:**
- Consumes: React Router's `useNavigate`.
- Produces: a labelled field in the bar that submits to `/?q=…`, and the `/` shortcut.

- [ ] **Step 1: Write the failing tests**

```tsx
it("sends what was typed to the Start page", async () => {
  render(<MemoryRouter><TopBar /><Where /></MemoryRouter>);
  await userEvent.type(screen.getByLabelText("Search topics, tools and goals"), "salmon{Enter}");
  expect(screen.getByTestId("where")).toHaveTextContent("/?q=salmon");
});

it("focuses the field when / is pressed", async () => { … });
it("leaves / alone while a field has focus", async () => { … });
```

`<Where />` is a two-line helper using `useLocation` to print the current URL; put it in the test
file, not in the app.

- [ ] **Step 2: Run them and watch them fail**

- [ ] **Step 3: Build the field**

A `<form role="search">` with a visually-hidden label, the board's placeholder, and a `kbd` hint
showing `/`. The shortcut listens on `document` in a `useEffect` and ignores the key when
`document.activeElement` is an input, a textarea or `isContentEditable`.

- [ ] **Step 4: Run everything and commit**

```bash
git add apps/web/src/layout
git commit -m "feat(web): the top bar searches, and / focuses it"
```

---

### Task 4: Start — ask, and the candidates

**Files:**
- Create: `apps/web/src/start/StartPage.tsx`, `apps/web/src/start/StartPage.test.tsx`
- Create: `apps/web/src/start/examples.ts`

**Interfaces:**
- Consumes: `fetchSearch`, `useSearchParams`.
- Produces: stages 1 and 2 of M3P3.4; `goal` params written on choosing a candidate.

- [ ] **Step 1: Write the failing tests**

```tsx
const found = {
  query: "salmon",
  unmatched: [],
  results: [
    { id: "salmon", title: "Salmon", claim: "Salmon estimates…", level: "intermediate",
      minutes: 15, region: { id: "transcriptomics", name: "Transcriptomics" } },
  ],
};

it("searches what was typed and puts it in the url", async () => { … expect(fetch).toHaveBeenCalledWith(
  expect.stringContaining("/api/search?q=salmon"), expect.anything()) … });

it("shows the candidates under 'Is this what you mean?'", async () => { … });
it("names a word nothing is about", async () => { … unmatched: ["nanopore"] … });
it("says Searching… while it waits", async () => { … });
it("prints the API's sentence when there is no index", async () => { … });
it("says it cannot reach the API", async () => { … });
it("searches an example chip's phrase", async () => { … });
```

- [ ] **Step 2: Run them and watch them fail**

- [ ] **Step 3: Build stages 1 and 2**

The h1, the lede, the labelled field with **Build my route**, the five chips from `examples.ts`
(the board's own five), then the candidate cards. `useQuery` keyed `["search", q]`, `enabled`
only when `q` is not blank. Choosing a candidate appends `goal` to the search params, capped at
three.

- [ ] **Step 4: Run everything and commit**

```bash
git add apps/web/src/start
git commit -m "feat(web): the Start page asks, and offers the candidates"
```

---

### Task 5: Start — the route preview

**Files:**
- Modify: `apps/web/src/start/StartPage.tsx`, `apps/web/src/start/StartPage.test.tsx`
- Create: `apps/web/src/start/RoutePreview.tsx`

**Interfaces:**
- Consumes: `fetchRoute`, and `RouteOut` from `schema.ts`.
- Produces: stage 3, and the link to `/route?goal=…`.

- [ ] **Step 1: Write the failing tests**

```tsx
it("shows the route once a target is chosen", async () => {
  // fetch stub answers /api/search then /api/routes with the 17-stop Salmon shape
  expect(await screen.findByText("17 stops")).toBeInTheDocument();
  expect(screen.getByText("about 3 h 4 min")).toBeInTheDocument();
  expect(screen.getByText("First steps → Intermediate")).toBeInTheDocument();
});

it("marks the last stop as the goal", async () => { … });
it("links Start from the beginning to the route page", async () => {
  expect(await screen.findByRole("link", { name: "Start from the beginning" })).toHaveAttribute(
    "href", "/route?goal=salmon",
  );
});
it("stops offering a third target once three are chosen", async () => { … });
it("says Weaving your route… while it waits", async () => { … });
```

The minutes and the span come from `RouteOut`; the wording (`about 3 h 4 min`, the arrow) matches
the command's, so read `packages/code-weaver/src/code_weaver/cli.py` and mirror `_shown_time` and
`_shown_level` in a small `format.ts` rather than inventing a second phrasing.

- [ ] **Step 2: Run them and watch them fail**

- [ ] **Step 3: Build stage 3**

`useQuery` keyed `["route", …goals]`, enabled when at least one goal is chosen. The stats row,
the stops in order with their minutes, the last marked *your goal*, and the primary link.

- [ ] **Step 4: Run everything and commit**

```bash
git add apps/web/src
git commit -m "feat(web): the Start page previews the route it would build"
```

---

### Task 6: The checks, the stack, and the operator's look

- [ ] **Step 1: Run every check**

```bash
cd apps/web && npm run lint && npm run test && npm run typecheck
cd ../.. && uv run ruff check . && uv run mypy && uv run pytest
docker compose up -d --wait --build && ops/stack-check.sh
uv run python apps/api/manage.py rebuild_index --root tests/fixtures/salmon
```

`--build` is not optional (M2 part 4's trap), and the index is rebuilt from the host: the API
image carries no `tests/`.

- [ ] **Step 2: Ask the operator to look**

Give them the URL (`http://127.0.0.1:8090/`) and the board (`.design/Start.dc.html`), and say
what is deliberately missing (M3P3.1's table). **Do not open the pull request as done until they
have answered**; record what they say in the journal.

- [ ] **Step 3: CLAUDE.md, the journal entry and the README box**

Status (part 3 of six), the layout lines for `apps/web`, and
`docs/notes/journal/2026-09-20-m3-part-3-spine-and-start.md`: where things stand, what changed
with hashes, the decisions and their rejections, what is next (part 4, the Route page and the
board's redraw), open questions, traps.

- [ ] **Step 4: The pull request**

```bash
git push -u origin m3-part-3-spine-and-start
gh pr create --title "M3 part 3: the spine, and the Start page" --body "…"
gh pr checks <n> --watch; echo $? > scratchpad/checks<n>.rc
```

Merge only when that file holds 0.
