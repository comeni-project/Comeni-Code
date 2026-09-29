# 2026-09-17 — M0 part 7: the health page

**Part 7 of M0 is built.**
- `/` shows the API's health through Vite's proxy, refreshed every 10 seconds, every state in words.
- The identity specimen moved to `/identity`; anything else says *Not found*. No router until M3.
- The web app's API types are generated from `apps/api/openapi.json`, with a drift test.

**Next is part 8** (Compose: the whole stack, with CI starting it).

The operator agreed the design section by section. Along the way, they asked why the type
generator needed its own TypeScript and whether there was a simpler way; that led to
json-schema-to-typescript instead of a separate tool folder.

---

## Where things stand

| Claim | Check |
|---|---|
| lint, typecheck, test (19) and build pass locally and in CI | in `apps/web`: `npm run lint && npm run typecheck && npm test && npm run build`; PR #25, run 35224992493: `web` and `python` passed |
| vitest covers loading, ok, down, unreachable (502, network, not JSON), stale, *Check now*, and the three routes | `src/health/HealthPage.test.tsx`, `src/App.test.tsx` |
| `src/api/schema.ts` matches `openapi.json` | `src/api/schema.test.ts`; seen failing once with `duration_ms: string` ("run npm run api-types"), then passing |
| The page works against the real stack | a script started `runserver` on :8010, the worker, beat, and `vite` with `CODE_WEB_API_ORIGIN=http://127.0.0.1:8010`. Through the proxy: **200** and a screenshot of *All 3 checks ok* (database 21 ms, redis 1 ms, worker 0 ms); worker stopped, 40 s later **503** and *1 needs you: worker*; API stopped, **502** and *Can't reach the API · HTTP 502*. Every process stopped by PID; ports free |

## What changed this session

- PR #24: part 7's spec and plan.
- Part 7's commits, oldest first: cf7a38d da7e69b 27ed7e3 (PR #25).

## Decisions made, and why

The spec holds the rejected alternatives. In order:

1. **Section 1: health at `/`, specimen at `/identity`, no router yet;** the proxy reads
   `CODE_WEB_API_ORIGIN`.
2. **API types: json-schema-to-typescript** (operator), after a scratch build showed
   openapi-typescript can't run on TypeScript 7 (no `ts.factory`; ERESOLVE even with an
   override). A locked tool folder with TypeScript 5 worked but was more to maintain. Only schemas
   are generated; paths are written by hand until M1 reconsiders a client.
3. **Section 2:** 200 and 503 are data; poll every 10 s with no retry; five worded states,
   *stale* in amber when a later check fails.
4. **Section 3:** `fetch` stubbed rather than MSW; a manual check against the real stack.

## What is next

1. **Part 8, Compose:** postgres, redis, api, worker, beat and web; CI starts the stack; the
   health page shows all healthy. Carry over: WhiteNoise static files in the container, the
   worker check's first 10 s (part 4), and `CODE_WEB_API_ORIGIN=http://api:8000` for the web
   service.
2. Part 9, content repo guardrails (GitHub settings need the operator's confirmation).

## Open questions

- The light chip contrast (part 6), kept for now.
- jsdom 30 once Fedora ships Node 24.15 (part 5).

## Traps

- **Text that arrives with data can stay blank while its font loads.** Geist Mono appeared only in
  the check rows; the screenshots showed empty names until `main.tsx` started both fonts at load.
  Disabling the font proved the cause.
- **`firefox --screenshot` fires on the load event,** before a query answers. The check framed the
  page in a local wrapper whose load waits three seconds.
- **`cd dir && command &` backgrounds a subshell;** `$!` isn't the command, and killing it leaves
  the server up. It happened once in the scratch build (Vite stayed on :5173 until stopped by
  PID). Put `cd` on its own line.
- **Something else on this machine listens on :8000** (a uvicorn server from another project).
  Use `CODE_WEB_API_ORIGIN` and another `runserver` port rather than stopping it.
- **Ruff formats Python blocks in plans** (part 1's trap again, with `shotwrap.py`).
