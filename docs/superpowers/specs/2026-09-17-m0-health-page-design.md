# M0 part 7 — the health page

**Status: agreed 2026-09-17.** This is part 7 of phase M0 (architecture spec R4). The parts list
is in [`2026-09-17-m0-in-parts.md`](../../notes/journal/2026-09-17-m0-in-parts.md). It builds on
part 3's `/api/health` ([P3.2](2026-09-17-m0-ninja-api-and-health-design.md)), part 4's checks
([P4.3](2026-09-17-m0-celery-beat-redis-design.md)) and part 6's identity
([P6.3](2026-09-17-m0-identity-tokens-design.md)). This spec decides what R7 leaves to this part:

- where pages live before a router is chosen;
- how the web app reaches the API in development;
- where the web app's API types come from;
- how the health states are shown and tested.

The operator made every decision here on 2026-09-17, section by section. An agent proposed them
and checked them in a scratch build against a real API, worker and beat.

---

## P7.1 What this part does

The web app's first data page: `/` shows the API's health through Vite's proxy, refreshed every
10 seconds, with every state in words as well as colour.

**Done when:**

- `npm run lint`, `typecheck`, `test` and `build` pass locally and in CI's `web` job; `python`
  still passes;
- vitest covers the loading, ok, down, unreachable and stale states, *Check now*, and the three
  routes;
- `src/api/schema.ts` is generated from `apps/api/openapi.json`, and a test fails with
  *"run npm run api-types"* when it is stale, seen once and then undone;
- with `runserver`, the worker, beat and `vite` running, a request through the proxy returns 200
  and Firefox screenshots show **all ok**; after the worker stops, **1 needs you: worker**; after
  the API stops, **Can't reach the API · HTTP 502**. The screenshots go in the journal.

Out of scope: a router (M3), a typed API client (M1), Compose (part 8).

## P7.2 Routes, proxy and API types

```
apps/web/scripts/generate-api-types.ts  npm run api-types: openapi.json → src/api/schema.ts
apps/web/src/api/schema.ts              generated and committed
apps/web/src/api/schema.test.ts         the drift test
apps/web/src/api/health.ts              fetchHealth and HealthUnreachable
apps/web/src/health/HealthPage.tsx      the page
apps/web/src/layout/TopBar.tsx          the mark and name, shared by every page
apps/web/src/App.tsx                    / → health, /identity → specimen, else Not found
```

- **Two pages, no router yet.** `App` picks the page from `location.pathname`: `/` is the health
  page (M0's done-when is "`docker compose up` shows a health page"), `/identity` the specimen,
  anything else a worded *Not found*. The router is chosen in M3, with real pages and their data
  loading. TanStack Router and React Router 8 both run on Node 24.
- **`TopBar`** is taken out of the specimen so every page shares it; the mark links to `/`.
- **The proxy:** Vite's dev server and `vite preview` send `/api` to `CODE_WEB_API_ORIGIN`,
  default `http://127.0.0.1:8000`. Part 8's Compose points it at the `api` service. The scratch
  build found :8000 taken by another project on this machine and ran the API on :8010 through
  this variable.
- **API types from the committed schema,** with **json-schema-to-typescript 16** (MIT; a dev
  dependency that needs no TypeScript):
  - `npm run api-types` reads `components.schemas` from `apps/api/openapi.json`, removes
    Pydantic's `title`s (each would become an alias such as `Status1`), and writes plain
    interfaces (`HealthOut`, `CheckOut`, and an `ApiSchemas` map) in Biome's style;
  - a vitest test fails with *"src/api/schema.ts is stale: run npm run api-types"*;
  - with the Python test that keeps `openapi.json` current, a backend change can't silently
    break the web types.
- **Only schemas are generated.** The URL and the rule that 200 and 503 both carry `HealthOut` are
  written by hand in `src/api/health.ts`. A typed client is reconsidered in M1, when there is more
  than one endpoint.

**Rejected:**

| Alternative | Why not |
|---|---|
| openapi-typescript in the app's dependencies | it builds its output with TypeScript's JS API (`ts.factory`), which TypeScript 7 doesn't ship (`factory` is undefined); `npm install` fails with ERESOLVE on its `typescript ^5` peer, even with an override |
| openapi-typescript in its own locked tool folder with TypeScript 5 | works, but a second lockfile and install for one file (operator chose the simpler dependency) |
| TypeScript 6 for the whole app | openapi-typescript's peer is `^5`, so it wouldn't help |
| Our own schema-to-TypeScript generator | we would maintain it as the API grows |
| Hand-written types checked by a test | scales worst |
| A router library now | chosen before the pages that need it |
| Health at `/health`, specimen at `/` | M0's done-when names the health page as what Compose shows |

## P7.3 The page and its states

- **One query,** key `["health"]`:
  - 200 and 503 are both data, since 503 is a real answer that something is down;
  - any other status, a failed request, a body that isn't JSON, or JSON without `checks` is a
    `HealthUnreachable` error with a reason in words (`HTTP 502`, `network error`, …);
  - `refetchInterval` 10 seconds (part 4's heartbeat interval), paused in a hidden tab
    (TanStack's default); `retry: false`, so a failure shows at once and the next poll retries.
- **States,** each in words; colour follows the law (W10):

| State | Summary (in a `role="status"` region) | Colour |
|---|---|---|
| First request pending | *Checking…* | none (rail dot) |
| 200 | *All 3 checks ok* | route green dot |
| 503 | *1 needs you: worker* | needs-you red |
| Error, no earlier result | *Can't reach the API · HTTP 502* | needs-you red |
| Error after a result | the last rows stay, under *Stale · last checked 14:03:22 · can't reach the API · network error* | measured amber |

- **Rows,** one per check in the API's order: the name in Geist Mono, a worded `ok`/`down` chip,
  the duration in milliseconds.
- **Footer:** *Checked at 14:03:40* and a **Check now** button (disabled while fetching).
- **Both fonts start loading when the app starts** (`document.fonts.load` in `main.tsx`). See
  P7.5.

## P7.4 Tests

- **`src/health/HealthPage.test.tsx`,** with `fetch` stubbed by `vi.stubGlobal` and a fresh
  `QueryClient` per test (`retry: false`), polling off through the page's `pollMs` prop:
  - loading: *Checking…* while the request is pending;
  - ok: the summary, and each row's name, status and duration;
  - down: the summary names the worker, and its row says `down`;
  - unreachable: HTTP 502, a network failure and a non-JSON body each give their reason, with no
    rows;
  - stale: a success, then a failure after *Check now*, keeps the rows under *Stale · last
    checked hh:mm:ss*;
  - *Check now* fetches again.
- **`src/App.test.tsx`:** `/` shows *Health*, `/identity` the specimen, `/nowhere` *Not found*
  under the bar. `App` takes the path as a prop for this.
- **`src/api/schema.test.ts`:** the drift test, in vitest's `node` environment.
- **No MSW:** stubbing `fetch` covers one endpoint without another dependency.

## P7.5 Found in the scratch build

- **Text that arrives with data stayed invisible.** Geist Mono is used only in the check rows,
  which render after the request returns. The browser starts loading a font only when its first
  text renders, and the screenshots showed blank names and durations; with the font disabled,
  the fallback showed them. Starting both fonts in `main.tsx` fixed it. Pages whose data text uses
  a font that nothing on first paint uses would hit the same thing.
- **Screenshots fire on the load event,** before the first health answer. The manual check frames
  the page in a local wrapper whose load waits three seconds.
- **`cd dir && command &` backgrounds a subshell,** so `$!` isn't the command's PID and killing it
  leaves the server running (part 4's trap, met again). Put `cd` on its own line.
- **Vite's proxy answers 502** when the API is down, which the page reports as *HTTP 502*.
- **Something else may hold :8000;** `CODE_WEB_API_ORIGIN` points the proxy elsewhere.

## P7.6 Risks

- **json-schema-to-typescript formats with Prettier.** Its output matches Biome today for these
  shapes; if a new shape differs, the drift test and `biome ci` disagree, and the generator (not
  the file) gets a formatting step.
- **Unions and nullable fields** (`anyOf` with `null`) haven't appeared in the schema yet. The
  first endpoint that has them checks the generated type.
- **The page trusts the schema.** `health.ts` only checks that `checks` is an array, which guards
  against something other than our API answering on `/api`.
