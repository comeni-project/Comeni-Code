# M0 part 8 — the Compose stack

**Status: agreed 2026-09-17; built in PR #28.** This is part 8 of phase M0 (architecture spec R4). The parts list
is in [`2026-09-17-m0-in-parts.md`](../../notes/journal/2026-09-17-m0-in-parts.md). It builds on
the API and settings of parts 2–4 and the web app of parts 5–7, and settles two things earlier
parts left here: serving static files with `DEBUG` off in a container
([P2 note](2026-09-17-m0-django-project-design.md)), and allowing for the worker check's first
seconds ([P4.3](2026-09-17-m0-celery-beat-redis-design.md)). This spec decides what R7 leaves to
this part:

- the images and the services;
- the application server;
- how migrations run;
- the health checks and startup order;
- how CI starts the stack and checks it.

The operator made every decision here on 2026-09-17, section by section. An agent proposed them
and checked them in a scratch build under a separate Compose project.

---

## P8.1 What this part does

`docker compose up -d --wait` runs the whole stack — Postgres, Redis, a one-off migration, the
API, a Celery worker, beat, and the built web app — and `http://127.0.0.1:8090` shows the health
page with all checks ok. CI starts the same stack on every pull request.

**Done when:**

- `docker compose up -d --wait` brings every service up healthy (and `migrate` exited 0) on this
  machine, `ops/stack-check.sh` passes, and a Firefox screenshot of `http://127.0.0.1:8090/` shows
  **All 3 checks ok**;
- with the worker stopped, `/api/health` through `web` answers 503 naming the worker within about
  40 seconds, the `api` container stays healthy, and `ops/stack-check.sh` fails with the logs;
- recreating `api` while `web` keeps running gives 200 again within seconds (no lasting 502);
- the API image contains no `.env` and runs as a non-root user;
- CI's new `stack` job passes on the pull request; `python` and `web` still pass;
- the journal records that M0's done-when now holds except the content repository (part 9).

Out of scope: hosting and production settings (R4 leaves hosting for later), HTTPS, image
registries, build caching.

## P8.2 Services and images

| Service | Image | Runs |
|---|---|---|
| `postgres`, `redis` | as before | as before; host ports 5433 and 6380 stay for native development |
| `migrate` | `comeni-code-api` (`Dockerfile.api`) | `manage.py migrate --noinput`, then exits |
| `api` | same | **gunicorn 26**, 2 workers, `DEBUG` off; WhiteNoise serves `/static/` |
| `worker` | same | `celery -A code_api worker` |
| `beat` | same | `celery -A code_api beat -s /tmp/celerybeat-schedule` |
| `web` | `apps/web/Dockerfile` | nginx 1.29 with the built app; `/api/` and `/static/` go to `api:8000` |

- **`Dockerfile.api`** at the repository root (the workspace is its build context):
  - built on `ghcr.io/astral-sh/uv:python3.14-trixie-slim`, run on `python:3.14-slim-trixie`;
  - copies `pyproject.toml`, `uv.lock`, **the whole `packages/` and `apps/api/` folders** — never
    a list of members, which broke Labs' build three times — then
    `uv sync --locked --no-dev --package code-api`;
  - runs `collectstatic` at build time with placeholder settings that never reach a container,
    so the docs page's files are in the image;
  - runs as user `code` (uid 10001);
  - gunicorn runs with `--no-control-socket`: gunicorn 26's control socket defaults to a home
    directory the user doesn't have, and logged *Permission denied* in the scratch build.
- **`gunicorn>=26.2,<27`** joins `code-api`'s dependencies.
- **`apps/web/Dockerfile`** (context: the repository root): `node:24-alpine` runs `npm ci` (with
  the app's `.npmrc`) and `npm run build`; `nginx:1.29-alpine` serves `dist` with
  `ops/nginx/default.conf`.
- **`ops/nginx/default.conf`:**
  - `resolver 127.0.0.11` and the upstream in a variable, so `api` is looked up per request. A
    literal upstream is resolved once, and requests 502 after `api` is recreated (Labs measured
    it; the scratch build saw 200 again 4 s after a recreate);
  - `try_files $uri /index.html`, so `/identity` loads the app.
- **Only `web` is published,** on `127.0.0.1:8090` (8000 and 8080 are taken on this machine).
  The API is reached through `web`, the same origin Vite's proxy gives in development.
- **Settings:** `env_file: .env` supplies the secret key; Compose sets `CODE_DATABASE_URL`,
  `CODE_REDIS_URL` to the service names, `CODE_DEBUG=false` and
  `CODE_ALLOWED_HOSTS=localhost,127.0.0.1`.
- **`.dockerignore`** keeps out `.env`, `.git`, `.venv`, `node_modules`, `dist`, `staticfiles`,
  caches and beat schedules.
- **Measured in the scratch build:** a cold build of both images took 40 s; after a Python source
  edit, 28 s (the whole-folder copy re-runs `uv sync`). The API image is 341 MB, the web image
  95 MB.

**Rejected:**

| Alternative | Why not |
|---|---|
| `runserver` in a container | a development server, and not what `DEBUG` off means |
| A Vite dev server as `web` | development already runs natively with `npm run dev`; Compose serves the build |
| Caddy | nginx has Labs' precedent, with its traps already known |
| Migrating when `api` starts | several containers would race |
| Separate images for worker and beat | the same code and settings in two places |
| A per-member `COPY` list for layer caching | Labs' missing-line trap; 28 s rebuilds are acceptable for M0 |
| Publishing the API's port | nothing needs it, and 8000 is taken here |

## P8.3 Startup order, health checks and the stack check

**Order:** `postgres` and `redis` healthy → `migrate` completed successfully → `api`, `worker`,
`beat` → `web` once `api` is healthy. `docker compose up -d --wait` returns 0 with `migrate`
exited 0 (Compose 5.0, checked twice in the scratch build).

| Service | Healthy when | Why |
|---|---|---|
| `api` | `python -m code_api.health.probe` gets **200 or 503** from `/api/health` (every 10 s, 20 s start period) | the process is serving; a stopped worker is the health page's news, not a reason to hold back `web` |
| `worker` | `celery inspect ping` to its own node within 5 s (every 30 s, 30 s start period) | the worker itself answers; the heartbeat would also fail when beat is down |
| `beat` | no check | only the heartbeat shows beat works, and the page shows the heartbeat |
| `web` | `wget --spider http://127.0.0.1/` | nginx serves the app |

- **`code_api/health/probe.py`** is the API's check: the standard library only, with pytest tests
  for 200, 503, 500, 404 and nothing listening.
- **`ops/stack-check.sh`,** run the same way locally and in CI, through `web`
  (`CODE_STACK_URL`, default `http://127.0.0.1:8090`):
  - `/api/health` reaches **200 within 60 s** (the worker check reads down until the first
    heartbeat);
  - `/` and `/identity` return the app's `index.html`;
  - `/api/docs` answers 200 and the first `/static/` file it names loads, which proves WhiteNoise
    inside the container;
  - on failure it prints `docker compose ps` and the services' logs, and exits 1.

**Rejected:**

| Alternative | Why not |
|---|---|
| The API check requires 200 | a stopped worker would mark the API unhealthy |
| A separate liveness route | part 3 left it to this part; the probe needs no new route in the schema |
| A heartbeat check on the worker | blames the worker when beat is down |
| Checking only that containers are up | the done-when is the health page, reached as a browser does |

## P8.4 CI and docs

- **A third CI job, `stack`,** beside `python` and `web`:
  1. `actions/checkout` at the pinned SHA;
  2. `cp .env.example .env` (development values, no secrets);
  3. `docker compose build`;
  4. `docker compose up -d --wait --wait-timeout 180`;
  5. `ops/stack-check.sh`;
  6. on failure, `docker compose logs`; always, `docker compose down -v`.
- **No build caching** until the job's time is measured.
- **CLAUDE.md:**
  - *First-time setup* gives both ways: the whole stack (`docker compose up -d --wait`, open
    `127.0.0.1:8090`) or `postgres redis` with the native commands for development;
  - *Commands* gains `ops/stack-check.sh`;
  - *Layout* gains `Dockerfile.api`, `apps/web/Dockerfile`, `ops/` and `.dockerignore`.
- **The part 2 spec's static-files note** points here: resolved by WhiteNoise (part 3), checked in
  a container by this part.
- **The parts list's part 8 row is met;** the journal says so.

## P8.5 Risks

- **Image tags, not digests.** `python:3.14-slim-trixie`, `node:24-alpine`, `nginx:1.29-alpine`
  and the uv image move within their lines. Pinning digests (and letting Dependabot bump them)
  is a later decision, with hosting. *Resolved 2026-09-17 (operator): all six images are pinned by
  digest with their tags kept, and `.github/dependabot.yml` bumps them, along with Actions, uv and
  npm.* *2026-09-18: its first run showed what it must not move — a `node:26` image fails `npm ci`
  against `apps/web/package.json`'s `engines`, and the uv ecosystem raised range floors
  (`>=5.6,<5.7` → `>=5.6.3,<5.7`) that change nothing we run. The config now holds the Python,
  Node, Postgres and Redis lines and pyproject's ranges (`versioning-strategy: lockfile-only`), and
  moves digests, lock entries and versions inside those lines.*
- **`comeni-code-api` is a fixed image name,** shared by four services. A second checkout of the
  repository building under another project name overwrites it; scratch builds must expect that.
- **The stack uses development settings.** `.env.example`'s key and Postgres's `code/code` are
  for a laptop and CI only; hosting brings its own settings spec.
- **`celery inspect ping` costs a Python start every 30 s** in the worker container. If that
  shows up in resource use, a lighter check replaces it.
