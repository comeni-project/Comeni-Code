# M0 part 7: the health page — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task by task, driven by one agent. Subagents are for review only (the operator's rule in CLAUDE.md). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/` shows the API's health through Vite's proxy, every 10 seconds, each state in words;
the web app's API types are generated from `apps/api/openapi.json` with a drift test.

**Architecture:** A pathname switch in `App` serves `/` (health), `/identity` (specimen) and a
worded *Not found*. `HealthPage` runs one TanStack query over `fetchHealth`, which treats 200 and
503 as data and everything else as `HealthUnreachable`. Types come from a small script around
json-schema-to-typescript.

**Tech Stack:** json-schema-to-typescript 16.0.0 (new dev dependency) on part 6's React 19,
TanStack Query 5, Tailwind 4, vitest 5 and TypeScript 7.

**Spec:** [`docs/superpowers/specs/2026-09-17-m0-health-page-design.md`](../specs/2026-09-17-m0-health-page-design.md)
(agreed 2026-09-17).

**Tested before writing:** every file below was built in a scratch clone of `main`.
- `lint`, `typecheck`, `test` (19 tests) and `build` passed.
- Against a real `runserver` (:8010), worker and beat, the proxy returned 200, then 503 after the
  worker stopped, then 502 after the API stopped; screenshots showed each state.
- **Trap found** (spec P7.5): the check names stayed invisible until both fonts were started in
  `main.tsx`.

## Global Constraints

- **Node 24** for every `npm` and `node` command. Exact versions, lockfile committed, `.npmrc`
  unchanged.
- **Never hand-edit `src/api/schema.ts`** (or `tokens.css`). After an API change: export the
  OpenAPI schema (CLAUDE.md), then `npm run api-types`.
- **Only token classes** for colour; every state in words.
- **Background processes** start from a script file, one command per line (`cd` on its own line),
  keep `$!`, and stop by that PID and its children. Check ports first. Never `pkill -f` or
  `pgrep -f` with a pattern in your own command line. Confirm nothing is left.
- **Commits:** `type(scope): what is now true`, a body that says why, ending with
  `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`. PR descriptions end with
  `🤖 Generated with [Claude Code](https://claude.com/claude-code)`. Never commit to `main`.

---

### Task 0: Land the spec and plan, then branch

- [ ] **Step 1: Commit on `docs/m0-part-7`, push, PR, merge after CI**

```bash
git add docs/superpowers/specs/2026-09-17-m0-health-page-design.md docs/superpowers/specs/README.md docs/superpowers/plans/2026-09-17-m0-health-page.md
git commit -m "docs(spec): M0 part 7 — the health page

Settles the web app's first data page: health at / and the specimen at /identity without a router
yet, Vite's /api proxy with CODE_WEB_API_ORIGIN, API types generated from openapi.json with
json-schema-to-typescript and a drift test, and five worded states.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git push -u origin docs/m0-part-7
gh pr create --base main --title "M0 part 7: spec and plan — the health page" --body "Spec and plan for M0 part 7, agreed section by section on 2026-09-17.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
gh pr checks --watch && gh pr merge --merge
git checkout main && git pull --ff-only && git checkout -b feat/m0-health-page
```

---

### Task 1: API types from `openapi.json`

**Files:**
- Create: `apps/web/scripts/generate-api-types.ts`, `apps/web/src/api/schema.ts` (generated)
- Modify: `apps/web/package.json`, `apps/web/package-lock.json`
- Test: `apps/web/src/api/schema.test.ts`

- [ ] **Step 1: Install** (in `apps/web`): `npm install --save-dev json-schema-to-typescript@16.0.0`
Expected: 0 vulnerabilities; `npm ls typescript` still shows only 7.0.2.

- [ ] **Step 2: Write the failing test** `apps/web/src/api/schema.test.ts`:

```ts
// @vitest-environment node
// The committed API types are exactly what openapi.json generates (M0 part 7 spec, P7.4).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { API_TYPES, readOpenApi, renderApiTypes } from "../../scripts/generate-api-types.ts";

describe("src/api/schema.ts", () => {
  it("matches apps/api/openapi.json", async () => {
    expect(
      readFileSync(API_TYPES, "utf8"),
      "src/api/schema.ts is stale: run npm run api-types",
    ).toBe(await renderApiTypes(readOpenApi()));
  });
});
```

- [ ] **Step 3: Run it to see it fail**

Run: `npx vitest run src/api`
Expected: FAIL, cannot find `../../scripts/generate-api-types.ts`.

- [ ] **Step 4: The generator** `apps/web/scripts/generate-api-types.ts`:

```ts
// npm run api-types: regenerate src/api/schema.ts from apps/api/openapi.json (M0 part 7 spec, P7.2).
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { compile, type JSONSchema } from "json-schema-to-typescript";

export const OPENAPI_JSON = fileURLToPath(new URL("../../api/openapi.json", import.meta.url));
export const API_TYPES = fileURLToPath(new URL("../src/api/schema.ts", import.meta.url));

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

// Pydantic gives every property a title; json-schema-to-typescript would turn each into a type
// alias (DurationMs, Status1, …). Refs move from the OpenAPI location to $defs.
function prepare(value: Json): Json {
  if (Array.isArray(value)) return value.map(prepare);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== "title")
      .map(([key, v]) => [
        key,
        key === "$ref" && typeof v === "string"
          ? v.replace("#/components/schemas/", "#/$defs/")
          : prepare(v),
      ]),
  );
}

export async function renderApiTypes(openapi: {
  components: { schemas: Record<string, Json> };
}): Promise<string> {
  const defs = prepare(openapi.components.schemas) as Record<string, Json>;
  const names = Object.keys(defs);
  const root = {
    type: "object",
    additionalProperties: false,
    required: names,
    properties: Object.fromEntries(names.map((name) => [name, { $ref: `#/$defs/${name}` }])),
    $defs: defs,
  } as JSONSchema;
  const body = await compile(root, "ApiSchemas", {
    bannerComment: "",
    additionalProperties: false,
    style: { printWidth: 100, trailingComma: "all" },
  });
  return `// Generated from apps/api/openapi.json by \`npm run api-types\`. Do not edit (M0 part 7 spec, P7.2).\n${body}`;
}

export const readOpenApi = () => JSON.parse(readFileSync(OPENAPI_JSON, "utf8"));

if (import.meta.url === `file://${process.argv[1]}`) {
  writeFileSync(API_TYPES, await renderApiTypes(readOpenApi()));
  console.log("wrote src/api/schema.ts");
}
```

Add the script `"api-types": "node scripts/generate-api-types.ts"` after `tokens` in
`package.json`.

- [ ] **Step 5: Generate, then see it pass**

```bash
npm run api-types && cat src/api/schema.ts
npx vitest run src/api && npm run lint && npm run typecheck
```
Expected: `schema.ts` holds exactly:

```ts
// Generated from apps/api/openapi.json by `npm run api-types`. Do not edit (M0 part 7 spec, P7.2).
export interface ApiSchemas {
  CheckOut: CheckOut;
  HealthOut: HealthOut;
}
export interface CheckOut {
  duration_ms: number;
  name: string;
  status: "ok" | "down";
}
export interface HealthOut {
  checks: CheckOut[];
  status: "ok" | "down";
}
```

and the test, lint and typecheck pass.

- [ ] **Step 6: See the drift test fail once**

```bash
cp src/api/schema.ts /tmp/schema.ts.bak
sed -i 's/duration_ms: number;/duration_ms: string;/' src/api/schema.ts
npx vitest run src/api; cp /tmp/schema.ts.bak src/api/schema.ts && npx vitest run src/api
```
Expected: first FAIL with `src/api/schema.ts is stale: run npm run api-types`, then pass.

- [ ] **Step 7: Commit**

```bash
git add apps/web
git commit -m "feat(web): API types are generated from openapi.json

Spec P7.2. json-schema-to-typescript needs no TypeScript API, which TypeScript 7 lacks; titles are
stripped so the output is plain interfaces. A test fails when src/api/schema.ts is stale.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: The health client, the page and the routes

**Files:**
- Create: `apps/web/src/api/health.ts`, `apps/web/src/layout/TopBar.tsx`, `apps/web/src/health/HealthPage.tsx`
- Modify: `apps/web/src/App.tsx`, `apps/web/src/identity/Specimen.tsx`, `apps/web/src/main.tsx`, `apps/web/vite.config.ts`
- Test: `apps/web/src/health/HealthPage.test.tsx`, `apps/web/src/App.test.tsx`

- [ ] **Step 1: Write the failing tests.** `apps/web/src/health/HealthPage.test.tsx`:

```tsx
// Every health state, in words (M0 part 7 spec, P7.4). fetch is stubbed; no API runs.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
      <HealthPage pollMs={false} />
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
    const fetch = vi.fn(async () => json(200, report("ok")));
    vi.stubGlobal("fetch", fetch);
    renderPage();
    await waitFor(() => expect(status()).toHaveTextContent("All 3 checks ok"));
    fireEvent.click(screen.getByRole("button", { name: "Check now" }));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
  });
});
```

Replace `apps/web/src/App.test.tsx` with:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

const renderAt = (path: string) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <App path={path} />
    </QueryClientProvider>,
  );

afterEach(() => vi.unstubAllGlobals());

describe("App", () => {
  it("shows the health page at /", () => {
    vi.stubGlobal("fetch", () => new Promise(() => {}));
    renderAt("/");
    expect(screen.getByRole("heading", { level: 1, name: "Health" })).toBeInTheDocument();
  });

  it("shows the identity specimen at /identity", () => {
    renderAt("/identity");
    expect(
      screen.getByRole("heading", { level: 1, name: "Identity specimen" }),
    ).toBeInTheDocument();
  });

  it("says not found anywhere else, under the Comeni Code bar", () => {
    renderAt("/nowhere");
    expect(screen.getByText("Comeni Code")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Not found" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npm test`
Expected: FAIL, `Failed to resolve import "./HealthPage"`, and `App.test.tsx` finds no *Health* or
*Not found* heading.

- [ ] **Step 3: The client** `apps/web/src/api/health.ts`:

```ts
// GET /api/health (M0 part 7 spec, P7.3). 200 and 503 both carry a HealthOut: 503 is an answer.
import type { HealthOut } from "./schema";

export const HEALTH_URL = "/api/health";

/** The API gave no health answer; `reason` says why, in words. */
export class HealthUnreachable extends Error {
  readonly reason: string;
  constructor(reason: string) {
    super(`Can't reach the API: ${reason}`);
    this.name = "HealthUnreachable";
    this.reason = reason;
  }
}

export async function fetchHealth(signal?: AbortSignal): Promise<HealthOut> {
  let response: Response;
  try {
    response = await fetch(HEALTH_URL, {
      headers: { Accept: "application/json" },
      signal: signal ?? null,
    });
  } catch {
    throw new HealthUnreachable("network error");
  }
  if (response.status !== 200 && response.status !== 503) {
    throw new HealthUnreachable(`HTTP ${response.status}`);
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new HealthUnreachable("the response wasn't JSON");
  }
  if (!isHealthOut(body)) {
    throw new HealthUnreachable("the response wasn't a health report");
  }
  return body;
}

// The types come from openapi.json; this only guards against something else answering on /api.
function isHealthOut(body: unknown): body is HealthOut {
  return (
    typeof body === "object" &&
    body !== null &&
    "status" in body &&
    "checks" in body &&
    Array.isArray(body.checks)
  );
}
```

- [ ] **Step 4: The shared bar** `apps/web/src/layout/TopBar.tsx`:

```tsx
// The top bar every page shares: the transit-line mark and the name (W10).
import type { ReactNode } from "react";

export function TopBar({ children }: { children?: ReactNode }) {
  return (
    <header className="flex h-15 items-center justify-between border-b border-border px-7">
      <a href="/" className="flex items-center gap-2.5">
        <svg width="30" height="16" viewBox="0 0 30 16" aria-hidden="true">
          <line
            x1="3"
            y1="8"
            x2="27"
            y2="8"
            className="stroke-line"
            strokeWidth="4"
            strokeLinecap="round"
          />
          {[4, 15, 26].map((cx) => (
            <circle
              key={cx}
              cx={cx}
              cy="8"
              r="3.5"
              className="fill-surface stroke-ink"
              strokeWidth="2"
            />
          ))}
        </svg>
        <span className="text-[17px] font-bold tracking-[-0.01em]">Comeni Code</span>
      </a>
      {children}
    </header>
  );
}
```

and in `Specimen.tsx` replace the inline `<header>` with it:

```diff
diff --git a/apps/web/src/identity/Specimen.tsx b/apps/web/src/identity/Specimen.tsx
index 48cd29b..704ba47 100644
--- a/apps/web/src/identity/Specimen.tsx
+++ b/apps/web/src/identity/Specimen.tsx
@@ -1,5 +1,6 @@
 // The identity specimen: every token in use, beside the Identity boards (M0 part 6 spec, P6.3).
 import { useState } from "react";
+import { TopBar } from "../layout/TopBar";
 
 type Theme = "system" | "light" | "dark";
 
@@ -44,31 +45,7 @@ export function Specimen() {
 
   return (
     <div className="min-h-screen">
-      <header className="flex h-15 items-center justify-between border-b border-border px-7">
-        <div className="flex items-center gap-2.5">
-          <svg width="30" height="16" viewBox="0 0 30 16" aria-hidden="true">
-            <line
-              x1="3"
-              y1="8"
-              x2="27"
-              y2="8"
-              className="stroke-line"
-              strokeWidth="4"
-              strokeLinecap="round"
-            />
-            {[4, 15, 26].map((cx) => (
-              <circle
-                key={cx}
-                cx={cx}
-                cy="8"
-                r="3.5"
-                className="fill-surface stroke-ink"
-                strokeWidth="2"
-              />
-            ))}
-          </svg>
-          <span className="text-[17px] font-bold tracking-[-0.01em]">Comeni Code</span>
-        </div>
+      <TopBar>
         <fieldset className="flex gap-0.5 rounded-control border border-border bg-bg p-[3px]">
           <legend className="sr-only">Theme</legend>
           {(["system", "light", "dark"] as const).map((option) => (
@@ -85,7 +62,7 @@ export function Specimen() {
             </button>
           ))}
         </fieldset>
-      </header>
+      </TopBar>
 
       <main className="mx-auto flex max-w-5xl flex-col gap-8 px-7 py-8">
         <div className="flex flex-col gap-1.5">
```

- [ ] **Step 5: The page** `apps/web/src/health/HealthPage.tsx`:

```tsx
// The health page (M0 part 7 spec, P7.3): every state in words, colour only as the law allows.
import { useQuery } from "@tanstack/react-query";
import { fetchHealth, HealthUnreachable } from "../api/health";
import type { CheckOut } from "../api/schema";
import { TopBar } from "../layout/TopBar";

/** The beat heartbeat's interval (part 4); checking more often shows nothing new. */
export const HEALTH_POLL_MS = 10_000;

const time = (ms: number) => new Date(ms).toLocaleTimeString("en-GB", { hour12: false });

const reasonOf = (error: Error) =>
  error instanceof HealthUnreachable ? error.reason : "unexpected error";

function summary(checks: CheckOut[]): { text: string; tone: "ok" | "down" } {
  const down = checks.filter((c) => c.status === "down").map((c) => c.name);
  if (down.length === 0) {
    return { text: `All ${checks.length} checks ok`, tone: "ok" };
  }
  return {
    text: `${down.length} ${down.length === 1 ? "needs" : "need"} you: ${down.join(", ")}`,
    tone: "down",
  };
}

function Dot({ tone }: { tone: "ok" | "down" | "stale" | "none" }) {
  const colour = { ok: "bg-line", down: "bg-open", stale: "bg-meas-bar", none: "bg-rail" }[tone];
  return <span aria-hidden="true" className={`size-2.5 shrink-0 rounded-pill ${colour}`} />;
}

export function HealthPage({ pollMs = HEALTH_POLL_MS }: { pollMs?: number | false }) {
  const query = useQuery({
    queryKey: ["health"],
    queryFn: ({ signal }) => fetchHealth(signal),
    refetchInterval: pollMs,
    retry: false,
  });

  return (
    <div className="min-h-screen">
      <TopBar />
      <main className="mx-auto flex max-w-2xl flex-col gap-6 px-7 py-8">
        <h1 className="text-[30px] font-semibold tracking-[-0.02em]">Health</h1>

        <div role="status" className="flex flex-col gap-3">
          {query.isPending ? (
            <p className="flex items-center gap-2.5 text-[17px] font-semibold text-ink-2">
              <Dot tone="none" />
              Checking…
            </p>
          ) : query.data === undefined ? (
            <p className="flex items-center gap-2.5 text-[17px] font-semibold text-open">
              <Dot tone="down" />
              Can't reach the API · {reasonOf(query.error)}
            </p>
          ) : (
            <>
              {query.isError ? (
                <p className="flex items-center gap-2.5 rounded-control bg-meas-soft px-3 py-2 text-[14px] font-medium text-meas">
                  <Dot tone="stale" />
                  Stale · last checked {time(query.dataUpdatedAt)} · can't reach the API ·{" "}
                  {reasonOf(query.error)}
                </p>
              ) : null}
              <p
                className={`flex items-center gap-2.5 text-[17px] font-semibold ${
                  summary(query.data.checks).tone === "ok" ? "text-ink" : "text-open"
                }`}
              >
                <Dot tone={summary(query.data.checks).tone} />
                {summary(query.data.checks).text}
              </p>
            </>
          )}
        </div>

        {query.data === undefined ? null : (
          <ul className="flex flex-col divide-y divide-border rounded-panel border border-border bg-surface">
            {query.data.checks.map((check) => (
              <li key={check.name} className="flex items-center gap-3 px-4 py-3 text-[14px]">
                <span className="flex-1 font-mono text-[13px]">{check.name}</span>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-pill px-2.5 py-0.5 text-[12.5px] font-medium ${
                    check.status === "ok" ? "bg-line-soft text-btn" : "bg-open-soft text-open"
                  }`}
                >
                  <Dot tone={check.status} />
                  {check.status}
                </span>
                <span className="w-14 text-right font-mono text-[12px] text-ink-3">
                  {check.duration_ms} ms
                </span>
              </li>
            ))}
          </ul>
        )}

        <footer className="flex items-center justify-between text-[13px] text-ink-2">
          <span>{query.dataUpdatedAt > 0 ? `Checked at ${time(query.dataUpdatedAt)}` : ""}</span>
          <button
            type="button"
            onClick={() => void query.refetch()}
            disabled={query.isFetching}
            className="rounded-[9px] border border-border-2 bg-surface px-3.5 py-2 text-[13px] font-medium text-ink disabled:text-ink-3"
          >
            Check now
          </button>
        </footer>
      </main>
    </div>
  );
}
```

- [ ] **Step 6: Routes, fonts and proxy.** Replace `apps/web/src/App.tsx`:

```tsx
// Two pages until M3 chooses a router (M0 part 7 spec, P7.2): health at /, the specimen at /identity.
import { HealthPage } from "./health/HealthPage";
import { Specimen } from "./identity/Specimen";
import { TopBar } from "./layout/TopBar";

export function App({ path = window.location.pathname }: { path?: string }) {
  if (path === "/") return <HealthPage />;
  if (path === "/identity") return <Specimen />;
  return (
    <div className="min-h-screen">
      <TopBar />
      <main className="mx-auto flex max-w-2xl flex-col gap-2 px-7 py-8">
        <h1 className="text-[30px] font-semibold tracking-[-0.02em]">Not found</h1>
        <p className="text-[15px] text-ink-2">
          Nothing lives at <code className="font-mono text-[13px]">{path}</code>. Try{" "}
          <a className="text-sel underline" href="/">
            the health page
          </a>
          .
        </p>
      </main>
    </div>
  );
}
```

Replace `apps/web/src/main.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles/app.css";

const root = document.getElementById("root");
if (root === null) {
  throw new Error("index.html has no #root element");
}

// Start both fonts now. A font otherwise loads only when its first text renders, and text that
// arrives with data (the check names in Geist Mono) stayed invisible (M0 part 7 spec, P7.5).
for (const family of ['"Lexend Variable"', '"Geist Mono Variable"']) {
  void document.fonts.load(`1em ${family}`);
}

const queryClient = new QueryClient();

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
```

Replace `apps/web/vite.config.ts`:

```ts
/// <reference types="vitest/config" />
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// M0 part 5 spec, P5.2–P5.3; the /api proxy is part 7's (P7.2).
// Where the Django API listens; Compose sets this to its api service (part 8).
const apiOrigin = process.env.CODE_WEB_API_ORIGIN ?? "http://127.0.0.1:8000";
const proxy = { "/api": { target: apiOrigin } };

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { host: "127.0.0.1", port: 5173, strictPort: true, proxy },
  preview: { host: "127.0.0.1", port: 4173, strictPort: true, proxy },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test-setup.ts"],
  },
});
```

- [ ] **Step 7: Run everything to see it pass**

```bash
npm run lint && npm run typecheck && npm test && npm run build
```
Expected: clean; 19 tests pass.

- [ ] **Step 8: Commit**

```bash
git add apps/web
git commit -m "feat(web): the health page shows every check in words at /

Spec P7.2–P7.4. One query polls /api/health every 10 s through Vite's proxy; 503 is data, anything
else says why the API can't be reached, and a failure after a result keeps it, marked stale. The
specimen moves to /identity, and both fonts start loading with the app so data text isn't blank.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: See it against the real stack, update the docs, open the PR

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: The manual check.** Postgres and Redis up (`docker compose up -d --wait postgres
  redis`). Write the two files below to a scratch directory and run the script with `bash`, in a
  separate command. If :8010 is busy, pick another port in both places.

`shotwrap.py` (frames the dev server; the load event waits 3 s for the first health answer):

```python
import http.server, time

GIF = bytes.fromhex(
    "47494638396101000100800000000000ffffff21f90401000000002c00000000010001000002024401003b"
)


class H(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/slow.gif":
            time.sleep(3)
            ctype, body = "image/gif", GIF
        else:
            ctype, body = (
                "text/html",
                b'<!doctype html><body style="margin:0"><iframe src="http://127.0.0.1:5173/" style="border:0;width:1000px;height:720px"></iframe><img src="/slow.gif" style="position:absolute;width:1px">',
            )
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *a):
        pass


http.server.ThreadingHTTPServer(("127.0.0.1", 4175), H).serve_forever()
```

The script (set `SCRATCH` and `REPO`):

```bash
#!/usr/bin/env bash
set -u
SCRATCH=<scratch directory>
REPO=<repository root>
for port in 8010 5173 4175; do ss -ltn | grep -q ":$port " && { echo "port $port busy"; exit 1; }; done
killtree() { local p=$1 c; for c in $(pgrep -P "$p"); do killtree "$c"; done; kill "$p" 2>/dev/null; }
shot() {
  local P; P=$(mktemp -d -p $SCRATCH)
  timeout 60 firefox --headless --no-remote --profile "$P" --window-size 1000,720 --screenshot "$SCRATCH/health-$1.png" http://127.0.0.1:4175/shot.html >/dev/null 2>&1
}
python3 $SCRATCH/shotwrap.py > /dev/null 2>&1 &
WRAP=$!
cd $REPO
uv run python apps/api/manage.py runserver 127.0.0.1:8010 --noreload > $SCRATCH/api.log 2>&1 &
API=$!
uv run celery -A code_api worker -l info > $SCRATCH/worker.log 2>&1 &
WORKER=$!
uv run celery -A code_api beat -l info -s $SCRATCH/beat-schedule > $SCRATCH/beat.log 2>&1 &
BEAT=$!
cd $REPO/apps/web
CODE_WEB_API_ORIGIN=http://127.0.0.1:8010 ./node_modules/.bin/vite > $SCRATCH/vite.log 2>&1 &
VITE=$!
for i in $(seq 1 60); do curl -s -o /dev/null http://127.0.0.1:5173/ && curl -s -o /dev/null http://127.0.0.1:8010/api/health && break; sleep 0.5; done
sleep 15
curl -s -i http://127.0.0.1:5173/api/health | head -1; shot ok
killtree $WORKER; sleep 40
curl -s -i http://127.0.0.1:5173/api/health | head -1; shot down
killtree $API; sleep 2
curl -s -i http://127.0.0.1:5173/api/health | head -1; shot unreachable
killtree $BEAT; killtree $VITE; kill $WRAP; sleep 2
for p in $API $WORKER $BEAT $VITE $WRAP; do ps -p $p >/dev/null && echo "$p still running"; done
ss -ltn | grep -E ':8010 |:5173 |:4175 ' || echo "ports free"
```
Expected: `200 OK`, `503 Service Unavailable`, `502 Bad Gateway`; screenshots showing *All 3
checks ok* with names and durations, *1 needs you: worker*, and *Can't reach the API · HTTP 502*;
`ports free` and no line saying a PID is still running.

- [ ] **Step 2: CLAUDE.md**
- *Status:* the web app shows the health page at `/` and the identity specimen at `/identity`.
- *Web commands:* add `npm run api-types   # regenerate src/api/schema.ts from apps/api/openapi.json`.
- After the `export_openapi_schema` line in *Commands*, add to its comment: `then npm run api-types in apps/web`.
- After *Web commands*, add: "**`npm run dev` proxies `/api` to `CODE_WEB_API_ORIGIN`** (default
  `http://127.0.0.1:8000`, where `runserver` listens)."

Run (root): `uv run pytest -q tests/repo && uv run ruff format --check .`
Expected: clean.

- [ ] **Step 3: Commit, push, PR, CI**

```bash
git add CLAUDE.md
git commit -m "docs: the health page, the /api proxy and npm run api-types

Spec P7.2. CLAUDE.md names the two pages, the proxy's origin variable, and the step after exporting
the OpenAPI schema.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git push -u origin feat/m0-health-page
gh pr create --base main --title "M0 part 7: the health page" --body "M0 part 7 per docs/superpowers/specs/2026-09-17-m0-health-page-design.md: the health page at / through Vite's proxy with five worded states, API types generated from openapi.json with a drift test, and the specimen at /identity.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
gh pr checks --watch
```
Expected: `python` and `web` pass.

---

### Task 4: Check against *done when*, and record the part

- [ ] **Step 1: Check spec P7.1**

| Item | How |
|---|---|
| The four commands pass locally and in CI; `python` passes | Task 2 Step 7; the PR's jobs |
| vitest covers every state, *Check now* and routes | `HealthPage.test.tsx`, `App.test.tsx` |
| Types generated; drift test fails when stale | Task 1 Steps 5–6 |
| Proxy and screenshots of ok, down, unreachable | Task 3 Step 1 |

- [ ] **Step 2: Mark the spec as built** (`**Status: agreed 2026-09-17; built in PR <number>.**`;
specs README row `agreed; built`).

- [ ] **Step 3: Journal entry** `docs/notes/journal/2026-09-17-m0-part-7-health-page.md` (use the
finishing date if different), in the README's order: where things stand (the P7.1 checks with the
curl results and the three screenshots described), what changed (commits and PRs), decisions
(json-schema-to-typescript over the tool folder, no router yet, polling and states), what is next
(part 8, Compose), and traps (P7.5). Update the journal README box and table.

- [ ] **Step 4: Commit, push, merge**

```bash
git add docs
git commit -m "docs(journal): M0 part 7 built — the health page

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git push && gh pr checks --watch && gh pr merge --merge
git checkout main && git pull --ff-only
```
