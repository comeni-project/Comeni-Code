# M0 part 8: the Compose stack — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task by task, driven by one agent. Subagents are for review only (the operator's rule in CLAUDE.md). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `docker compose up -d --wait` runs Postgres, Redis, a migration, the API (gunicorn),
the worker, beat and the built web app (nginx); `http://127.0.0.1:8090` shows all checks ok; CI
starts and checks the same stack.

**Architecture:** One API image for `migrate`, `api`, `worker` and `beat`; one web image. Only
`web` is published, forwarding `/api/` and `/static/` to `api`. Health checks gate the startup
order, and `ops/stack-check.sh` checks the stack through `web`, locally and in CI.

**Tech Stack:** Docker Compose 5, uv's Python 3.14 image, gunicorn 26.2, nginx 1.29, Node 24.

**Spec:** [`docs/superpowers/specs/2026-09-17-m0-compose-stack-design.md`](../specs/2026-09-17-m0-compose-stack-design.md)
(agreed 2026-09-17).

**Tested before writing:** every file below ran in a scratch clone as Compose project
`code-p8-scratch`, with the host ports removed or moved (8091) by an override file.
- `build` cold 40 s; `up -d --wait` 23 s, exit 0 with `migrate` exited 0; `stack-check.sh` passed.
- Worker stopped: 503 naming the worker after 21 s, `api` still healthy, the check failed with
  logs. `api` recreated with `web` running: 200 after 4 s.
- Screenshot through `web`: *All 3 checks ok*. The image has no `.env` and runs as uid 10001.
- **Found:** gunicorn 26's control socket needs a home directory (`--no-control-socket`).

## Global Constraints

- **The real Postgres and Redis containers stay running and keep their data.** The stack uses the
  same project name (`comeni-code`) and services, so `up` adopts them. When a check is finished,
  remove only the new services: `docker compose rm -sf migrate api worker beat web`. Never
  `docker compose down -v` on the real project.
- **No secret in an image:** `.env` stays out (`.dockerignore`).
- **Host ports:** only `web` on `127.0.0.1:8090` is new. Check it's free first.
- **Background processes** start from a script file, one command per line, keep `$!`, and stop by
  that PID. Never `pkill -f` or `pgrep -f` with a pattern in your own command line.
- **Commits:** `type(scope): what is now true`, a body that says why, ending with
  `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`. PR descriptions end with
  `🤖 Generated with [Claude Code](https://claude.com/claude-code)`. Never commit to `main`.

---

### Task 0: Land the spec and plan, then branch

- [ ] **Step 1: Commit on `docs/m0-part-8`, push, PR, merge after CI**

```bash
git add docs/superpowers/specs/2026-09-17-m0-compose-stack-design.md docs/superpowers/specs/README.md docs/superpowers/plans/2026-09-17-m0-compose-stack.md
git commit -m "docs(spec): M0 part 8 — the Compose stack

Settles how the whole stack runs: one API image for migrate, api (gunicorn), worker and beat, an
nginx image for the built web app, health checks that gate startup without blaming the API for a
stopped worker, and a stack check that runs through web locally and in CI.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git push -u origin docs/m0-part-8
gh pr create --base main --title "M0 part 8: spec and plan — the Compose stack" --body "Spec and plan for M0 part 8, agreed section by section on 2026-09-17.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
gh pr checks --watch && gh pr merge --merge
git checkout main && git pull --ff-only && git checkout -b feat/m0-compose-stack
```

---

### Task 1: The API's health probe, and gunicorn

**Files:**
- Create: `apps/api/src/code_api/health/probe.py`
- Modify: `apps/api/pyproject.toml`, `uv.lock`
- Test: `apps/api/tests/test_probe.py`

- [ ] **Step 1: Write the failing test** `apps/api/tests/test_probe.py`:

```python
"""The api container's health check (M0 part 8 spec, P8.3)."""

import socket
import threading
from collections.abc import Iterator
from http.server import BaseHTTPRequestHandler, HTTPServer

import pytest

from code_api.health import probe


@pytest.fixture
def answering() -> Iterator[tuple[HTTPServer, list[int]]]:
    """A local server that answers with whatever status the test puts in the list."""
    reply = [200]

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self) -> None:
            self.send_response(reply[0])
            self.end_headers()

        def log_message(self, format: str, *args: object) -> None:
            pass

    server = HTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    yield server, reply
    server.shutdown()
    server.server_close()


def _url(server: HTTPServer) -> str:
    return f"http://127.0.0.1:{server.server_address[1]}/api/health"


@pytest.mark.parametrize(("code", "exit_code"), [(200, 0), (503, 0), (500, 1), (404, 1)])
def test_serving_means_200_or_503(
    answering: tuple[HTTPServer, list[int]], code: int, exit_code: int
) -> None:
    server, reply = answering
    reply[0] = code
    assert probe.main(_url(server)) == exit_code


def test_nothing_listening_is_unhealthy() -> None:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        port = s.getsockname()[1]
    assert probe.main(f"http://127.0.0.1:{port}/api/health") == 1
```

- [ ] **Step 2: Run it to see it fail**

Run: `uv run pytest apps/api/tests/test_probe.py -q`
Expected: FAIL, `ImportError: cannot import name 'probe' from 'code_api.health'`.

- [ ] **Step 3: The probe** `apps/api/src/code_api/health/probe.py`:

```python
"""The api container's health check: is the server answering? (M0 part 8 spec, P8.3)

200 and 503 both count. A 503 means a check is down, which the health page reports; the API
itself is serving, and a stopped worker must not make Docker call the API unhealthy.
Run as `python -m code_api.health.probe`.
"""

import sys
import urllib.error
import urllib.request

URL = "http://127.0.0.1:8000/api/health"
SERVING = {200, 503}


def status(url: str = URL, timeout: float = 5) -> int | None:
    """The HTTP status the URL answers with, or None if nothing answers."""
    try:
        with urllib.request.urlopen(url, timeout=timeout) as response:
            return int(response.status)
    except urllib.error.HTTPError as error:
        return error.code
    except OSError:  # URLError, refused connections and timeouts
        return None


def main(url: str = URL) -> int:
    return 0 if status(url) in SERVING else 1


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 4: See it pass, add gunicorn, run the Python checks**

```bash
uv run pytest apps/api/tests/test_probe.py -q
uv add --package code-api 'gunicorn>=26.2,<27'
uv run ruff check . && uv run ruff format --check . && uv run mypy && uv run pytest -q
```
Expected: 5 probe tests pass; `apps/api/pyproject.toml` lists `gunicorn>=26.2,<27`; all checks
pass (Postgres and Redis running).

- [ ] **Step 5: Commit**

```bash
git add apps/api uv.lock
git commit -m "feat(api): a health probe for the container, and gunicorn

Spec P8.2–P8.3. The probe counts 200 and 503 as serving, so Docker never calls the API unhealthy
because the worker stopped. gunicorn serves the API in Compose.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: The images

**Files:**
- Create: `Dockerfile.api`, `.dockerignore`, `apps/web/Dockerfile`, `ops/nginx/default.conf`

- [ ] **Step 1: `.dockerignore`**

```
# Nothing secret and nothing built on the host goes into an image (M0 part 8 spec, P8.2).
.env
.git
.venv
**/__pycache__
**/node_modules
**/dist
staticfiles
.mypy_cache
.pytest_cache
.ruff_cache
celerybeat-schedule*
```

- [ ] **Step 2: `Dockerfile.api`**

```dockerfile
# The API, the Celery worker and beat: one image, three commands (M0 part 8 spec, P8.2). They run
# the same code with the same settings, so one image keeps one set of versions.
# Build from the repository root: docker build -f Dockerfile.api .

FROM ghcr.io/astral-sh/uv:python3.14-trixie-slim AS build
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_PYTHON_DOWNLOADS=never
WORKDIR /app
# Whole folders, never a list of packages: a new workspace member can't be forgotten here.
COPY pyproject.toml uv.lock ./
COPY packages/ packages/
COPY apps/api/ apps/api/
RUN uv sync --locked --no-dev --package code-api

# The API docs page's files go into the image. Settings need every CODE_* value to load; these are
# placeholders for this one command and never reach a running container.
RUN CODE_SECRET_KEY=build-time-placeholder-only-never-used-at-run-time-0000000000 \
    CODE_DATABASE_URL=postgresql://build@placeholder/build \
    CODE_REDIS_URL=redis://placeholder:6379/0 \
    CODE_STATIC_ROOT=/app/staticfiles \
    .venv/bin/python apps/api/manage.py collectstatic --noinput

FROM python:3.14-slim-trixie
RUN useradd --system --uid 10001 --no-create-home code
WORKDIR /app
COPY --from=build /app /app
ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    CODE_STATIC_ROOT=/app/staticfiles
USER code
EXPOSE 8000
# No control socket: nothing uses gunicorn's control interface (Compose restarts the container), and
# its default path is under a home directory this user doesn't have.
CMD ["gunicorn", "code_api.config.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "2", \
     "--access-logfile", "-", "--no-control-socket"]
```

- [ ] **Step 3: `apps/web/Dockerfile`**

```dockerfile
# The web app, built and served by nginx (M0 part 8 spec, P8.2).
# Build from the repository root: docker build -f apps/web/Dockerfile .

FROM node:24-alpine AS build
WORKDIR /web
# The lockfile first, so editing a component doesn't reinstall everything. .npmrc refuses install
# scripts, as it does locally.
COPY apps/web/package.json apps/web/package-lock.json apps/web/.npmrc ./
RUN npm ci
COPY apps/web/ ./
RUN npm run build

FROM nginx:1.29-alpine
COPY ops/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /web/dist /usr/share/nginx/html
```

- [ ] **Step 4: `ops/nginx/default.conf`**

```nginx
# The web service: the built app, with /api/ and /static/ forwarded to the API on the same origin,
# as Vite's proxy does in development (M0 part 8 spec, P8.2).
server {
  listen 80;

  # Docker's DNS, and the upstream in a variable, so nginx looks `api` up on each request.
  # A literal upstream is resolved once at startup, and every request 502s after `api` is
  # recreated with a new address (Labs measured this).
  resolver 127.0.0.11 valid=10s ipv6=off;

  location /api/ {
    set $api http://api:8000;
    proxy_pass $api$request_uri;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  # The API docs page's files, served by WhiteNoise inside the API.
  location /static/ {
    set $api http://api:8000;
    proxy_pass $api$request_uri;
    proxy_set_header Host $host;
  }

  # Every other path is the app; it picks the page from the path.
  location / {
    root /usr/share/nginx/html;
    try_files $uri /index.html;
  }
}
```

- [ ] **Step 5: Build both and inspect the API image**

```bash
docker build -f Dockerfile.api -t comeni-code-api .
docker build -f apps/web/Dockerfile -t comeni-code-web .
docker run --rm comeni-code-api sh -c 'id; ls -a /app; ls /app/staticfiles; gunicorn --version; celery --version'
```
Expected: both build; `uid=10001(code)`; `/app` holds `.venv apps packages pyproject.toml
staticfiles uv.lock` and **no `.env`**; `staticfiles` holds `ninja`; gunicorn 26.2.x, Celery 5.6.x.

- [ ] **Step 6: Commit**

```bash
git add Dockerfile.api .dockerignore apps/web/Dockerfile ops/nginx/default.conf
git commit -m "build: images for the API and the web app

Spec P8.2. One API image serves migrate, api, worker and beat, copying whole folders so no workspace
member can be missed, with the docs page's static files collected at build time. The web image
serves the build with nginx, which looks api up per request so a recreated API doesn't 502.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: The stack, and seeing it work

**Files:**
- Modify: `compose.yaml`
- Create: `ops/stack-check.sh` (executable)

- [ ] **Step 1: `compose.yaml`** (replace the file; `postgres` and `redis` are unchanged):

```yaml
# Comeni Code's stack (M0 part 8 spec). `docker compose up -d --wait` runs all of it; open
# http://127.0.0.1:8090. For development, `docker compose up -d --wait postgres redis` and run the
# API, worker, beat and `npm run dev` natively (CLAUDE.md).
name: comeni-code

# The API image's settings, shared by migrate, api, worker and beat. .env supplies the secret key;
# the rest point at the services inside Compose's network.
x-api-settings: &api-settings
  image: comeni-code-api
  env_file: .env
  environment:
    CODE_DATABASE_URL: postgresql://code:code@postgres:5432/code
    CODE_REDIS_URL: redis://redis:6379/0
    CODE_DEBUG: "false"
    CODE_ALLOWED_HOSTS: localhost,127.0.0.1

x-after-migrate: &after-migrate
  postgres:
    condition: service_healthy
  redis:
    condition: service_healthy
  migrate:
    condition: service_completed_successfully

services:
  postgres:
    image: postgres:18
    environment:
      POSTGRES_USER: code
      POSTGRES_PASSWORD: code
      POSTGRES_DB: code
    ports:
      # 5433 on the host: 5432 is often taken by another project's database.
      - "127.0.0.1:5433:5432"
    volumes:
      # From 18 the image keeps data in a versioned directory under /var/lib/postgresql.
      - postgres-data:/var/lib/postgresql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U code -d code"]
      interval: 2s
      timeout: 3s
      retries: 30

  redis:
    image: redis:8
    ports:
      # 6380 on the host: 6379 is often taken by another project's Redis.
      - "127.0.0.1:6380:6379"
    # A broker holds nothing that must survive a restart.
    command: ["redis-server", "--save", "", "--appendonly", "no"]
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 2s
      timeout: 3s
      retries: 30

  # Runs once and exits, so the three services after it never race to migrate.
  migrate:
    <<: *api-settings
    build:
      context: .
      dockerfile: Dockerfile.api
    command: ["python", "apps/api/manage.py", "migrate", "--noinput"]
    depends_on:
      postgres:
        condition: service_healthy

  api:
    <<: *api-settings
    depends_on: *after-migrate
    healthcheck:
      # Serving means 200 or 503: a stopped worker is the health page's news, not Docker's.
      test: ["CMD", "python", "-m", "code_api.health.probe"]
      interval: 10s
      timeout: 6s
      retries: 3
      start_period: 20s

  worker:
    <<: *api-settings
    command: ["celery", "-A", "code_api", "worker", "-l", "info"]
    depends_on: *after-migrate
    healthcheck:
      # The worker itself answers; the heartbeat would also fail when beat is down.
      test: ["CMD-SHELL", "celery -A code_api inspect ping -d celery@$$HOSTNAME --timeout 5"]
      interval: 30s
      timeout: 15s
      retries: 3
      start_period: 30s

  beat:
    <<: *api-settings
    # The schedule file goes where the non-root user can write; it holds nothing to keep.
    command: ["celery", "-A", "code_api", "beat", "-l", "info", "-s", "/tmp/celerybeat-schedule"]
    depends_on: *after-migrate

  web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
    ports:
      # 8090 on the host: 8000 and 8080 are often taken.
      - "127.0.0.1:8090:80"
    depends_on:
      api:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://127.0.0.1/"]
      interval: 5s
      timeout: 3s
      retries: 10

volumes:
  postgres-data:
```

- [ ] **Step 2: `ops/stack-check.sh`** (then `chmod +x ops/stack-check.sh`):

```bash
#!/usr/bin/env bash
# Checks a running Compose stack through the web service, as a browser would (M0 part 8 spec,
# P8.3). Run after `docker compose up -d --wait`; CI runs exactly this.
set -euo pipefail

BASE="${CODE_STACK_URL:-http://127.0.0.1:8090}"
HEALTH_WAIT_S="${CODE_STACK_HEALTH_WAIT_S:-60}"

fail() {
  echo "FAIL: $*" >&2
  docker compose ps >&2 || true
  docker compose logs --no-color --tail 80 >&2 || true
  exit 1
}

# The worker check reads down until the first heartbeat (part 4), so wait for 200.
status=""
for _ in $(seq 1 "$HEALTH_WAIT_S"); do
  status=$(curl -s -o /tmp/code-stack-health.json -w '%{http_code}' "$BASE/api/health" || true)
  [ "$status" = "200" ] && break
  sleep 1
done
[ "$status" = "200" ] || fail "/api/health answered ${status:-nothing} after ${HEALTH_WAIT_S}s: $(cat /tmp/code-stack-health.json 2>/dev/null)"
echo "ok   /api/health 200: $(cat /tmp/code-stack-health.json)"

for path in / /identity; do
  curl -sf "$BASE$path" | grep -q '<div id="root">' || fail "$path is not the app's index.html"
  echo "ok   $path serves the app"
done

docs=$(curl -sf "$BASE/api/docs") || fail "/api/docs did not answer 200"
asset=$(printf '%s' "$docs" | grep -o '/static/[^"]*' | head -n 1)
[ -n "$asset" ] || fail "/api/docs names no /static/ file"
curl -sf -o /dev/null "$BASE$asset" || fail "$asset did not load"
echo "ok   /api/docs 200 and $asset loads"
```

- [ ] **Step 3: Start it and check it**

```bash
ss -ltn | grep ':8090 ' && echo "8090 busy"
docker compose config --quiet
docker compose build
docker compose up -d --wait; echo "up exit=$?"
docker compose ps -a
ops/stack-check.sh
```
Expected: `up exit=0`; every service healthy (`beat` running), `migrate` `Exited (0)`; the check
prints four `ok` lines. The existing `postgres` and `redis` containers are kept, not recreated.

- [ ] **Step 4: Screenshot.** Reuse part 7's wrapper (`shotwrap.py`, see its plan) with the iframe
  pointing at `http://127.0.0.1:8090/`, started from a script, and
  `firefox --headless --screenshot` of `http://127.0.0.1:4175/shot.html`.
Expected: *All 3 checks ok* with names and durations.

- [ ] **Step 5: Worker down, then the API recreated**

```bash
docker compose stop worker
for i in $(seq 1 60); do s=$(curl -s -o /tmp/h.json -w '%{http_code}' http://127.0.0.1:8090/api/health); [ "$s" = 503 ] && break; sleep 1; done; echo "after ${i}s: $s $(cat /tmp/h.json)"
docker compose ps api
CODE_STACK_HEALTH_WAIT_S=3 ops/stack-check.sh; echo "check exit=$?"
docker compose start worker
docker compose up -d --force-recreate --no-deps api
for i in $(seq 1 60); do s=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8090/api/health); [ "$s" = 200 ] && break; sleep 1; done; echo "after ${i}s: $s"
docker compose logs --no-color api | grep -iE "error|denied" || echo "api logs clean"
```
Expected: 503 naming `worker` within about 40 s; `api` still `(healthy)`; the check exits 1 and
prints the logs; after recreating `api`, 200 within seconds; api logs clean.

- [ ] **Step 6: Leave the development databases as they were**

```bash
docker compose rm -sf migrate api worker beat web
docker compose ps
```
Expected: only `postgres` and `redis`, still healthy.

- [ ] **Step 7: Commit**

```bash
git add compose.yaml ops/stack-check.sh
git commit -m "feat: docker compose up runs the whole stack behind the health page

Spec P8.2–P8.3. migrate runs once before api, worker and beat; web waits for a serving API and is
the only published port (8090). ops/stack-check.sh checks health, the app's routes and the docs
page's static files through web, and prints the logs when something fails.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: CI and docs, then the PR

**Files:**
- Modify: `.github/workflows/ci.yml`, `CLAUDE.md`, `docs/superpowers/specs/2026-09-17-m0-django-project-design.md`

- [ ] **Step 1: The `stack` job.** Append to `jobs:` after `web`, and add "and stack (part 8,
  P8.4)" to the workflow's top comment:

```yaml
  stack:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1

      # Development values only; CI has no secrets to give the stack.
      - name: Settings
        run: cp .env.example .env

      - name: Build
        run: docker compose build

      - name: Start
        run: docker compose up -d --wait --wait-timeout 180

      - name: Check through the web service
        run: ops/stack-check.sh

      - name: Logs
        if: failure()
        run: docker compose ps -a && docker compose logs --no-color

      - name: Stop
        if: always()
        run: docker compose down -v
```

- [ ] **Step 2: CLAUDE.md**
- *Status:* `docker compose up` runs the whole stack.
- *First-time setup:* after the Postgres/Redis line, add
  `docker compose up -d --wait            # or the whole stack: open http://127.0.0.1:8090`, and
  say that development runs `postgres redis` in Compose with the API, worker, beat and
  `npm run dev` natively.
- *Commands:* add `ops/stack-check.sh                  # check a running stack through web (CI runs it)`.
- *Layout:* add `Dockerfile.api` (the API image: api, worker, beat, migrate),
  `apps/web/Dockerfile` (the web image: nginx), `ops/` (nginx config and the stack check) and
  `.dockerignore`; change `compose.yaml`'s line to "the whole stack".
- **Trap:** "`docker compose down -v` deletes the development database; to stop the app services
  only, `docker compose rm -sf migrate api worker beat web`."

- [ ] **Step 3: The part 2 spec's static-files note:** add "Resolved: WhiteNoise (part 3), checked
  inside the container by [part 8](2026-09-17-m0-compose-stack-design.md)."

Run (root): `uv run pytest -q tests/repo && uv run ruff format --check .`
Expected: clean.

- [ ] **Step 4: Commit, push, PR, CI**

```bash
git add .github/workflows/ci.yml CLAUDE.md docs/superpowers/specs/2026-09-17-m0-django-project-design.md
git commit -m "ci: a stack job starts Compose and checks the health page through web

Spec P8.4. It builds both images, waits for every health check, runs ops/stack-check.sh, and
always tears the stack down. CLAUDE.md gives both ways to run the app.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git push -u origin feat/m0-compose-stack
gh pr create --base main --title "M0 part 8: the Compose stack" --body "M0 part 8 per docs/superpowers/specs/2026-09-17-m0-compose-stack-design.md: docker compose up runs migrate, api (gunicorn), worker, beat and web (nginx) beside Postgres and Redis; the health page at 127.0.0.1:8090; a CI stack job runs the same check.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
gh pr checks --watch
```
Expected: `python`, `web` and `stack` pass. Note the `stack` job's duration for the journal.

---

### Task 5: Check against *done when*, and record the part

- [ ] **Step 1: Check spec P8.1**

| Item | How |
|---|---|
| Stack up, check passes, screenshot | Task 3 Steps 3–4 |
| Worker down → 503, api healthy, check fails | Task 3 Step 5 |
| API recreated → 200 again | Task 3 Step 5 |
| No `.env`, non-root | Task 2 Step 5 |
| CI `stack` passes; `python` and `web` pass | the PR |

- [ ] **Step 2: Mark the spec as built** (`**Status: agreed 2026-09-17; built in PR <number>.**`;
specs README row `agreed; built`).

- [ ] **Step 3: Journal entry** `docs/notes/journal/2026-09-17-m0-part-8-compose-stack.md` (use
the finishing date if different), in the README's order. *Where things stand* includes M0's
done-when from R4, item by item: the health page, CI green, the purity guard — held; the content
repository refusing a direct push — part 9. Decisions, what is next (part 9, which needs the
operator's confirmation before any GitHub settings change), traps (gunicorn's control socket,
`down -v`, the shared image name). Update the journal README box and table.

- [ ] **Step 4: Commit, push, merge**

```bash
git add docs
git commit -m "docs(journal): M0 part 8 built — the Compose stack

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git push && gh pr checks --watch && gh pr merge --merge
git checkout main && git pull --ff-only
```
