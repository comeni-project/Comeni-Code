# 2026-09-17 — M0 part 4: Celery, beat and Redis

**Part 4 of M0 is built.**
- Background work runs: a Celery app on a Redis broker, with beat scheduling a heartbeat every
  10 seconds.
- `/api/health` reports `database`, `redis` and `worker`.
- Celery runs on Python 3.14, which closes part 1's risk P1.7.

**Next is part 5** (web toolchain).

The operator agreed the design section by section and told the agent to execute. The execution
also had a process-handling failure, recorded under *Traps*, because it briefly invalidated a
check.

---

## Where things stand

| Claim | Check |
|---|---|
| Compose runs Postgres (:5433) and Redis (:6380), both healthy | `docker compose up -d --wait postgres redis && docker compose ps` |
| Celery 5.6.3 on Python 3.14.2, with the worker and beat from `code_api` | `uv run celery -A code_api worker` and `… beat` |
| Health reports three checks; 503 proven for Redis down, and for a stale or missing heartbeat | `uv run pytest apps/api/tests/test_worker_health.py -v` |
| A fresh worker process knows every scheduled task; a real worker runs the heartbeat | the same file; both passed in CI (run , 82 passed) |
| **Manual check** (12:30–12:31): with the worker, beat and server running, `HTTP 200`, all checks ok; 34 s after the worker stopped, `HTTP 503` with `worker: down`, database and Redis ok | the script in part 4's plan, Task 3 Step 3 |

## What changed this session

- PR #18: part 4's spec and plan.
- Part 4's commits, oldest first: a2b7a3c c748051 06c9f2e (PR #19).

## Decisions made, and why

The spec holds the rejected alternatives. In order:

1. **Python 3.14, not 3.13.** A throwaway probe ran a real worker and beat against Redis 8.
2. **Health checks `redis` and `worker`** (operator). **Rejected:** a single heartbeat check
   (it can't tell a Redis outage from a dead worker), and a control ping plus a separate beat
   check (slower health, and broker traffic on every call).
3. **The Celery app from Django settings.**
   - Required `CODE_REDIS_URL`, no result backend, one default queue.
   - The worker and beat as separate processes.
   - Redis 8 on :6380 with no persistence.
   - A heartbeat every 10 s, stale after 30 s.
4. **Found in the scratch build and kept:**
   - `CELERY_IMPORTS`: a real worker rejected the heartbeat as unregistered while every test
     passed, because the tests had imported the module. A subprocess test now catches it, and
     it was seen failing again during execution before the fix went in.
   - `celery-types` 0.26, for mypy strict.
   - Two typed functions for the heartbeat's Redis reads and writes.
   - Part 3's database-only test restricted to `database`.
   - `celerybeat-schedule*` in `.gitignore`.

## What is next

1. **Part 5, the web toolchain:** `apps/web` with Vite, React and TypeScript, vitest, a linter,
   and a `web` CI job. Its spec comes first; it decides the linter, the Node version and how
   strict TypeScript is.
2. Part 9 can still run at any time, with confirmation before each settings change.

## Traps

- **Task modules outside a Django app must be listed in `CELERY_IMPORTS`,** or a worker rejects
  their tasks.
- **A test that imports a task module hides registration bugs.** Test registration in a fresh
  process.
- **The worker check reads down for the first 10 s after startup,** until the first heartbeat.
  Part 8's Compose health check must allow for it.
- **Process handling went wrong, and it cost a check.**
  1. The scratch build's worker, beat and dev server on :8001 were left running. An earlier
     "all stopped" check was wrong.
  2. When the real Redis came up on :6380, those scratch processes reconnected to it.
  3. The first real manual check therefore talked to the scratch server, and its results were
     invalid.
  4. A script bug (`L=… && … &` puts the assignment in the background subshell) also meant the
     new processes weren't stopped.
  5. All were stopped by explicit PID, and the check was rerun from a script file whose own
     command line couldn't match its guards. That rerun is the result recorded above.

  **Rules:**
  - start background processes in a script and keep `$!`;
  - check the port and existing processes first;
  - never use `pkill -f` or `pgrep -f` with a pattern that appears in your own command line;
  - confirm afterwards that nothing is left.
- **Compose's Redis and any scratch Redis both use :6380** if the scratch copy reuses
  `compose.yaml`. Give scratch copies another project name *and* another port, or stop them
  before starting the real one.
