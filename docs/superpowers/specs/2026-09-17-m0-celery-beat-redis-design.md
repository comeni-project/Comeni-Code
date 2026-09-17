# M0 part 4 — Celery, beat and Redis

**Status: agreed 2026-09-17.** This is part 4 of phase M0 (architecture spec R4). The parts list
is in [`2026-09-17-m0-in-parts.md`](../../notes/journal/2026-09-17-m0-in-parts.md). It builds on
part 3's health route ([P3.2](2026-09-17-m0-ninja-api-and-health-design.md)). This spec decides
what R7 leaves to this part:

- the Celery app's layout and configuration;
- the queues;
- where Redis comes from;
- what "worker health" means;
- how a real worker is tested.

It also closes part 1's risk P1.7: Celery on Python 3.14.

The operator made every decision here on 2026-09-17, section by section. An agent proposed them
and checked them in a throwaway probe and a scratch build first.

---

## P4.1 What this part does

It adds background work: a Celery app with Redis as its broker, beat scheduling a heartbeat, and
two new health checks, `redis` and `worker`.

**Done when:**

- `docker compose up -d --wait postgres redis` becomes healthy;
- Celery runs on Python 3.14, with the worker and beat started from `code_api`;
- `/api/health` reports `database`, `redis` and `worker`: 200 when all are ok, and tests prove 503
  for Redis down and for a missing or stale heartbeat;
- a fresh worker process knows every scheduled task (a test), and a test with a real worker
  passes, locally and in CI;
- the manual check is recorded in the journal: with the worker, beat and server running, health
  is 200; after the worker stops, it is 503 with `worker: down` within about 30 seconds.

Out of scope: named queues and rate limits (M5), and Compose services for the API, worker, beat
and web app (part 8).

## P4.2 The Celery app and configuration

```
apps/api/src/code_api/
  celery.py            the Celery app, configured from Django settings
  __init__.py          imports it, so `celery -A code_api` works
  redis.py             one Redis client with short timeouts
  health/heartbeat.py  the heartbeat's timing, plus typed read and write
  health/tasks.py      the heartbeat task
```

- **`CODE_REDIS_URL`, required,** validated like the database URL:
  - the scheme must be `redis` or `rediss`;
  - a rejected value is never echoed (`hide_input_in_errors`, P2.3);
  - there is no default.
- **`code_api/celery.py`:** `Celery("code_api")`, configured from Django settings with the
  `CELERY_` prefix, with autodiscovery for Django apps.
- **Settings:**
  - `CELERY_BROKER_URL` comes from `CODE_REDIS_URL`;
  - retrying the broker connection on startup is on;
  - **no result backend** (`CELERY_TASK_IGNORE_RESULT = True`);
  - the time zone is UTC;
  - `CELERY_BEAT_SCHEDULE` has one entry, `health-heartbeat`, every 10 seconds.
- **`CELERY_IMPORTS` names task modules that live outside a Django app,** starting with
  `code_api.health.tasks`. Autodiscovery only searches `INSTALLED_APPS`. The scratch build's
  manual check found a real worker rejecting the heartbeat as an *unregistered task* while every
  test passed, because the tests had imported the module themselves.
- **One default queue.** Named queues arrive with M5, when model calls need rate limits.
- **The worker and beat run as separate processes:** `celery -A code_api worker` and
  `celery -A code_api beat`, matching part 8's separate services. `worker -B` is for development
  only.
- **Compose gains `redis`:**
  - the `redis:8` image, on `127.0.0.1:6380`, following Postgres on 5433;
  - a `redis-cli ping` health check;
  - no persistence (`--save "" --appendonly no`), because the broker holds nothing that must
    survive a restart.
- **Python 3.14 is confirmed** (closing P1.7). The probe ran Celery 5.6.3, kombu 5.6.2 and redis-py
  6.4.0 on Python 3.14.2 with a real worker and beat.
- **Types:** Celery ships no type information, so the dev group gains **`celery-types` 0.26**
  (stubs, March 2026), and mypy strict passes. redis-py annotates its sync and async clients with
  one loose return type, so the heartbeat's reads and writes go through two typed functions in
  `health/heartbeat.py`.

**Rejected:**

| Alternative | Why not |
|---|---|
| django-celery-beat (schedules in the database, editable in admin) | the admin and migrations for one fixed 10-second job; perhaps later for the weekly problem (S12) |
| A separate `apps/worker` package | the worker needs the same models and settings |
| A result backend | nothing reads task results yet |
| Named queues now | designed before any workload needs them |
| `worker -B` | for development only |
| A default for `CODE_REDIS_URL` | a forgotten variable in production would start silently |
| Ignoring Celery in mypy | untyped tasks would weaken strict typing across every future task |
| Python 3.13 | not needed: 3.14 works |

## P4.3 The two checks and the heartbeat

- **`code_api/redis.py`:** one shared client from `CODE_REDIS_URL`, with **2-second** connection
  and read timeouts.
- **The heartbeat task** writes the current Unix time to `code:health:heartbeat`, with a 5-minute
  expiry.
- **The timing constants** live in `health/heartbeat.py`: interval 10 seconds, stale after
  30 seconds (3 × the interval), expiry 300 seconds. The schedule, the task, the check and the
  tests share them.
- **The checks** in `health/checks.py`, run in this order: `database`, `redis`, `worker`.

| Check | Does | Down when |
|---|---|---|
| `redis` | `PING` | no answer within 2 seconds |
| `worker` | reads the heartbeat | missing, or older than 30 seconds |

- **The worker check raises with a reason** ("no heartbeat", "last heartbeat 47 s ago"). The reason
  is logged, never returned (P3.2).
- **When Redis is down,** `worker` also reads down. That's accurate, since nothing can run.
- **Right after startup,** `worker` reads down for up to one interval (10 seconds), until the first
  heartbeat. Part 8's Compose health check must allow for it.

**Rejected:**

| Alternative | Why not |
|---|---|
| One heartbeat check for everything | a Redis outage and a dead worker would look the same (operator) |
| A Celery control ping on every health request, plus a separate `beat` check | slower health (it waits for its timeout) and broker traffic on every call (operator) |
| The heartbeat in Postgres | a write every 10 seconds, and Redis must be up for the worker anyway |
| A 60-second threshold | a dead worker would look healthy for a minute |

## P4.4 Tests and CI

Tests that use Redis need it running, as database tests need Postgres.

- **Unit tests:**
  - the heartbeat task writes a fresh timestamp with an expiry;
  - `worker` is ok with a fresh heartbeat, and down with a stale one or none;
  - with Redis unreachable (a client on a closed port), health returns 503 with `redis` and
    `worker` both down;
  - with all three up, health returns 200 and lists them in order;
  - beat's schedule is every 10 seconds;
  - `CODE_REDIS_URL` rejects a non-Redis scheme without echoing it.
- **A fresh worker process knows every scheduled task.** A subprocess loads the app as
  `celery -A code_api worker` does and lists its tasks. This test fails without `CELERY_IMPORTS`,
  which the scratch build confirmed.
- **A real worker:** `celery.contrib.testing.worker.start_worker` runs a worker thread against the
  real Redis broker. The test sends `heartbeat.delay()`, waits up to 10 seconds, and checks health
  shows `worker: ok`.
- **Part 3's database-only health test** restricts `CHECKS` to `database`, so it keeps its intent.
- **CI:** a `redis:8` service with a health check, and `CODE_REDIS_URL=redis://localhost:6379/0`
  in the job. No new steps.
- **Local:**
  - `.env.example` gains `CODE_REDIS_URL=redis://localhost:6380/0`;
  - CLAUDE.md's setup starts `postgres redis` and gains the worker and beat commands;
  - `.gitignore` covers `celerybeat-schedule*`, since on Python 3.14 beat's schedule file comes
    with `-shm` and `-wal` companions.

## P4.5 Risks

- **`celery-types` is a third-party stub package.** If it falls behind Celery, mypy errors appear
  on upgrade; pinning `<0.27` keeps that visible.
- **The real-worker test takes a few seconds** and needs Redis. If it becomes slow or flaky, it
  moves behind a marker, but not before that happens.
