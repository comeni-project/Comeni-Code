# M0 part 4: Celery, beat and Redis — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task by task, driven by one agent. Subagents are for review only (the operator's rule in CLAUDE.md). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Celery app with a Redis broker and a beat-scheduled heartbeat, and extend
`/api/health` with `redis` and `worker` checks. The proof is tests with a real worker and a
recorded manual check.

**Architecture:**
- `code_api/celery.py` configures Celery from Django settings.
- `code_api/redis.py` holds one Redis client with short timeouts.
- `health/heartbeat.py` holds the timing and the typed reads and writes.
- `health/tasks.py` is the heartbeat task. Beat schedules it every 10 seconds, and the `worker`
  check reads it and calls it stale after 30 seconds.

**Tech Stack:** Celery 5.6 with the redis extra (kombu 5.6, redis-py 6.4), celery-types 0.26,
Redis 8, on the part 3 project.

**Spec:** [`docs/superpowers/specs/2026-09-17-m0-celery-beat-redis-design.md`](../specs/2026-09-17-m0-celery-beat-redis-design.md)
(agreed 2026-09-17).

**Tested before writing:**
- **Probe:** a throwaway probe ran a real worker and beat on Python 3.14.2 against Redis 8.
- **Scratch build:** every file below was built in a scratch clone of `main` with Compose Redis on
  6380. `ruff check`, `ruff format --check`, `mypy` and `pytest` (80 tests, also with
  `-W error::DeprecationWarning`) all passed.
- **Manual check:** worker, beat and dev server running → health 200; worker stopped → 503 with
  `worker: down` after 34 seconds.

The scratch build found three things the plan now handles:
1. **Autodiscovery misses tasks outside `INSTALLED_APPS`.** A real worker rejected the heartbeat
   as unregistered while every test passed, so `CELERY_IMPORTS` names the module, and a
   subprocess test proves a fresh worker knows the task.
2. **Types:** Celery is untyped (fixed with `celery-types` 0.26), and redis-py's return types are
   loose (narrowed in two typed functions).
3. **Part 3's database-only health test** must restrict `CHECKS` to `database`.

## Global Constraints

- **Dependencies:**
  - `apps/api/pyproject.toml` gains `celery[redis]>=5.6,<5.7`;
  - the root dev group gains `celery-types>=0.26,<0.27`.
- **`CODE_REDIS_URL`** is required, with scheme `redis` or `rediss`, never echoed, and no default.
  Locally `redis://localhost:6380/0`; in CI `redis://localhost:6379/0`.
- **Compose `redis`:** the `redis:8` image, `127.0.0.1:6380:6379`, no persistence, and a
  `redis-cli ping` health check.
- **Heartbeat:** key `code:health:heartbeat`; interval 10 seconds; stale after 30 seconds; expiry
  300 seconds.
- **Checks in order** `database`, `redis`, `worker`. Redis client timeouts are 2 seconds. Reasons
  are logged, never returned.
- **Celery:** no result backend, one default queue, and `CELERY_IMPORTS = ("code_api.health.tasks",)`.
  The worker and beat run as separate processes.
- Every command runs from the repository root, with `docker compose up -d --wait postgres redis`.
- **Commits:** `type(scope): what is now true`, a body that says why, ending with
  `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`. PR descriptions end with
  `🤖 Generated with [Claude Code](https://claude.com/claude-code)`. Never commit to `main`.
- **Stop background processes by their saved PID, never with `pkill -f`,** which killed the agent's
  own shell twice today.

---

### Task 0: Land the spec and plan, then branch

- [ ] **Step 1: Commit on `docs/m0-part-4`, push, PR, merge after CI**

```bash
git add docs/superpowers/specs/2026-09-17-m0-celery-beat-redis-design.md docs/superpowers/specs/README.md
git commit -m "docs(spec): M0 part 4 — Celery, beat and Redis

Settles what R7 leaves to part 4: a Celery app configured from Django settings, Redis in Compose,
a beat heartbeat every 10 seconds, and redis and worker health checks. It closes part 1's risk:
Celery runs on Python 3.14.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git add docs/superpowers/plans/2026-09-17-m0-celery-beat-redis.md
git commit -m "docs(plan): M0 part 4 — Celery, beat and Redis

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git push -u origin docs/m0-part-4
gh pr create --base main --title "M0 part 4: spec and plan — Celery, beat and Redis" --body "Spec and plan for M0 part 4, agreed section by section on 2026-09-17.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
gh pr checks --watch && gh pr merge --merge
git checkout main && git pull --ff-only && git checkout -b feat/m0-celery
```

---

### Task 1: Redis in Compose, `CODE_REDIS_URL`, and CI's Redis service

**Files:**
- Modify: `compose.yaml`, `apps/api/src/code_api/config/env.py`, `apps/api/tests/test_env.py`, `.env.example`, `.env` (local, not committed), `.github/workflows/ci.yml`

- [ ] **Step 1: Replace `apps/api/tests/test_env.py`** with the version that requires
  `redis_url` and tests its scheme:

```python
"""The environment is validated once, and only `CODE_*` variables count (spec P2.3)."""

import pytest
from pydantic import ValidationError

from code_api.config.env import Env, database_from_url

KEY = "k" * 50
URL = "postgresql://code:code@localhost:5433/code"
REDIS = "redis://localhost:6380/0"


@pytest.fixture(autouse=True)
def _clean_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    """Each test starts from no `CODE_*` variables, whatever the shell or `.env` holds."""
    for name in (
        "SECRET_KEY",
        "DATABASE_URL",
        "REDIS_URL",
        "DEBUG",
        "ALLOWED_HOSTS",
        "STATIC_ROOT",
    ):
        monkeypatch.delenv(f"CODE_{name}", raising=False)


def make_env(monkeypatch: pytest.MonkeyPatch, **values: str) -> Env:
    for name, value in values.items():
        monkeypatch.setenv(f"CODE_{name.upper()}", value)
    return Env(_env_file=None)


def test_reads_prefixed_variables(monkeypatch: pytest.MonkeyPatch) -> None:
    env = make_env(
        monkeypatch,
        secret_key=KEY,
        database_url=URL,
        redis_url=REDIS,
        debug="true",
        allowed_hosts=" code.example , localhost ,",
    )
    assert env.secret_key.get_secret_value() == KEY
    assert env.database_url.get_secret_value() == URL
    assert env.debug is True
    assert env.allowed_hosts == ["code.example", "localhost"]


def test_defaults_are_the_safe_ones(monkeypatch: pytest.MonkeyPatch) -> None:
    env = make_env(monkeypatch, secret_key=KEY, database_url=URL, redis_url=REDIS)
    assert env.debug is False
    assert env.allowed_hosts == []


def test_ignores_unprefixed_variables(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DATABASE_URL", "postgresql://other:other@elsewhere/other")
    with pytest.raises(ValidationError) as caught:
        make_env(monkeypatch, secret_key=KEY, redis_url=REDIS)
    assert "database_url" in str(caught.value)


def test_a_missing_variable_is_named(monkeypatch: pytest.MonkeyPatch) -> None:
    with pytest.raises(ValidationError) as caught:
        make_env(monkeypatch, database_url=URL, redis_url=REDIS)
    assert "secret_key" in str(caught.value)


def test_a_short_secret_key_is_refused_without_being_shown(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    with pytest.raises(ValidationError) as caught:
        make_env(monkeypatch, secret_key="too-short-to-be-a-key", database_url=URL, redis_url=REDIS)
    assert "secret_key" in str(caught.value)
    assert "too-short-to-be-a-key" not in str(caught.value)


def test_only_postgres_urls_are_accepted_and_none_is_shown(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    with pytest.raises(ValidationError) as caught:
        make_env(
            monkeypatch,
            secret_key=KEY,
            database_url="mysql://root:hunter2@db/code",
            redis_url=REDIS,
        )
    assert "must be a postgresql:// URL" in str(caught.value)
    assert "hunter2" not in str(caught.value)


def test_only_redis_urls_are_accepted_and_none_is_shown(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    with pytest.raises(ValidationError) as caught:
        make_env(
            monkeypatch,
            secret_key=KEY,
            database_url=URL,
            redis_url="http://user:hunter2@cache/0",
        )
    assert "must be a redis:// URL" in str(caught.value)
    assert "hunter2" not in str(caught.value)


def test_database_from_url() -> None:
    assert database_from_url("postgresql://code:p%40ss%2Fword@db.internal:6543/code_db") == {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": "code_db",
        "USER": "code",
        "PASSWORD": "p@ss/word",
        "HOST": "db.internal",
        "PORT": "6543",
        "OPTIONS": {"connect_timeout": 3},
    }


def test_database_from_url_without_port_or_password() -> None:
    database = database_from_url("postgres://code@localhost/code")
    assert (database["HOST"], database["PORT"], database["PASSWORD"]) == ("localhost", "", "")


def test_database_from_url_needs_a_database_name() -> None:
    with pytest.raises(ValueError, match="names no database"):
        database_from_url("postgresql://code:code@localhost:5433/")
```

- [ ] **Step 2: Run it and watch it fail**

Run: `uv run pytest apps/api/tests/test_env.py -q`
Expected: `test_only_redis_urls_are_accepted_and_none_is_shown` fails: without the field and its
validator, no error names `must be a redis:// URL`. The other tests still pass, because `Env`
ignores unknown variables.

- [ ] **Step 3: Add `redis_url` to `Env`.** In `apps/api/src/code_api/config/env.py`, add the
field after `database_url: SecretStr`:

```python
    redis_url: SecretStr
```

and this validator before `_split_hosts`:

```python
    @field_validator("redis_url")
    @classmethod
    def _redis_only(cls, value: SecretStr) -> SecretStr:
        if urlsplit(value.get_secret_value()).scheme not in {"redis", "rediss"}:
            raise ValueError("must be a redis:// URL")
        return value
```

- [ ] **Step 4: Compose.** Replace `compose.yaml` with:

```yaml
# Comeni Code's local stack. M0 part 2 starts it with Postgres; part 8 adds the rest.
name: comeni-code

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

volumes:
  postgres-data:
```

- [ ] **Step 5: Local environment.** Append to `.env.example`:

```
# Compose's Redis listens on 6380.
CODE_REDIS_URL=redis://localhost:6380/0
```

Add the same `CODE_REDIS_URL` line to your local `.env`, then run
`docker compose up -d --wait postgres redis`.
Expected: both containers `(healthy)`.

- [ ] **Step 6: CI.** In `.github/workflows/ci.yml`, under `services:` after the `postgres` block, add:

```yaml
      redis:
        image: redis:8
        ports:
          - 6379:6379
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 2s
          --health-timeout 3s
          --health-retries 30
```

and under the job's `env:` add `CODE_REDIS_URL: redis://localhost:6379/0`.

- [ ] **Step 7: Tests pass, full check, commit**

Run: `uv run pytest -q && uv run ruff check . && uv run ruff format --check . && uv run mypy`
Expected: all clean.

```bash
git add compose.yaml apps/api/src/code_api/config/env.py apps/api/tests/test_env.py .env.example .github/workflows/ci.yml
git commit -m "feat(api): Redis joins Compose and CI, and CODE_REDIS_URL is required and validated

M0 part 4 (spec P4.2). Redis 8 listens on 6380 locally, following Postgres on 5433, with no
persistence because a broker holds nothing that must survive a restart. The URL is validated
like the database's and never echoed.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: The Celery app, the heartbeat, and the `redis` and `worker` checks

**Files:**
- Modify: `apps/api/pyproject.toml`, `pyproject.toml` (root), `apps/api/src/code_api/__init__.py`, `apps/api/src/code_api/config/settings.py`, `apps/api/src/code_api/health/checks.py`, `apps/api/tests/test_health.py`
- Create: `apps/api/src/code_api/celery.py`, `apps/api/src/code_api/redis.py`, `apps/api/src/code_api/health/heartbeat.py`, `apps/api/src/code_api/health/tasks.py`
- Test: `apps/api/tests/test_worker_health.py`

**Interfaces:**
- Produces:
  - `code_api.celery.app`;
  - `code_api.redis.client() -> Redis`;
  - in `code_api.health.heartbeat`: `HEARTBEAT_KEY`, `HEARTBEAT_INTERVAL_SECONDS`,
    `HEARTBEAT_STALE_AFTER_SECONDS`, `HEARTBEAT_EXPIRES_SECONDS`,
    `write_heartbeat(at: float) -> None` and `last_heartbeat() -> float | None`;
  - `code_api.health.tasks.heartbeat`;
  - `checks.redis()` and `checks.worker()`.
- **Part 8** starts the worker and beat as services, and its health check allows the first
  10 seconds.

- [ ] **Step 1: Dependencies.** `apps/api/pyproject.toml` gains `"celery[redis]>=5.6,<5.7",`.
The root dev group gains `"celery-types>=0.26,<0.27",`. Run: `uv lock && uv sync --locked --all-packages`

- [ ] **Step 2: Write the failing tests.** `apps/api/tests/test_worker_health.py`:

```python
"""Redis and worker health, the heartbeat, and a real worker (M0 part 4 spec, P4.3–P4.4)."""

import json
import subprocess
import sys
import time
from collections.abc import Iterator
from typing import cast

import pytest
from celery.contrib.testing.worker import start_worker
from django.conf import settings
from django.test import Client
from redis import Redis

from code_api import redis as redis_client
from code_api.celery import app
from code_api.health import checks
from code_api.health.heartbeat import (
    HEARTBEAT_INTERVAL_SECONDS,
    HEARTBEAT_KEY,
    HEARTBEAT_STALE_AFTER_SECONDS,
    last_heartbeat,
    write_heartbeat,
)
from code_api.health.tasks import heartbeat


@pytest.fixture
def no_heartbeat() -> Iterator[Redis]:
    r = redis_client.client()
    r.delete(HEARTBEAT_KEY)
    yield r
    r.delete(HEARTBEAT_KEY)


def test_the_heartbeat_task_writes_a_fresh_timestamp(no_heartbeat: Redis) -> None:
    heartbeat()
    last = last_heartbeat()
    assert last is not None
    assert time.time() - last < 5
    assert 0 < cast(int, no_heartbeat.ttl(HEARTBEAT_KEY)) <= 300


def test_worker_is_ok_with_a_fresh_heartbeat(no_heartbeat: Redis) -> None:
    write_heartbeat(time.time())
    assert checks.run("worker", checks.worker).status == "ok"


def test_worker_is_down_with_a_stale_heartbeat(no_heartbeat: Redis) -> None:
    write_heartbeat(time.time() - HEARTBEAT_STALE_AFTER_SECONDS - 1)
    assert checks.run("worker", checks.worker).status == "down"


def test_worker_is_down_with_no_heartbeat(no_heartbeat: Redis) -> None:
    assert checks.run("worker", checks.worker).status == "down"


def test_redis_down_makes_health_503(client: Client, monkeypatch: pytest.MonkeyPatch) -> None:
    closed = Redis.from_url("redis://127.0.0.1:1/0", socket_connect_timeout=2, socket_timeout=2)
    monkeypatch.setattr(redis_client, "client", lambda: closed)
    monkeypatch.setitem(checks.CHECKS, "database", lambda: None)
    response = client.get("/api/health")
    assert response.status_code == 503
    statuses = {c["name"]: c["status"] for c in response.json()["checks"]}
    assert statuses == {"database": "ok", "redis": "down", "worker": "down"}


@pytest.mark.django_db
def test_health_lists_database_redis_and_worker_in_order(
    client: Client, no_heartbeat: Redis
) -> None:
    write_heartbeat(time.time())
    response = client.get("/api/health")
    assert response.status_code == 200
    assert [c["name"] for c in response.json()["checks"]] == ["database", "redis", "worker"]


def test_beat_schedules_the_heartbeat() -> None:
    entry = settings.CELERY_BEAT_SCHEDULE["health-heartbeat"]
    assert entry["schedule"] == HEARTBEAT_INTERVAL_SECONDS == 10.0


def test_a_fresh_worker_process_knows_every_scheduled_task() -> None:
    """Load the app as `celery -A code_api worker` does, in a new interpreter.

    In this test process the task module is already imported, which registers its tasks, so
    `app.tasks` here would pass even when a real worker rejects the task as unregistered.
    """
    probe = (
        "import json\n"
        "from code_api.celery import app\n"
        "app.loader.import_default_modules()\n"
        "print(json.dumps(sorted(app.tasks)))\n"
    )
    result = subprocess.run(
        [sys.executable, "-c", probe], capture_output=True, text=True, check=True, timeout=60
    )
    registered = json.loads(result.stdout.strip().splitlines()[-1])
    for entry in settings.CELERY_BEAT_SCHEDULE.values():
        assert entry["task"] in registered, f"a worker would reject {entry['task']}"


@pytest.mark.django_db
def test_a_real_worker_runs_the_heartbeat(client: Client, no_heartbeat: Redis) -> None:
    with start_worker(app, pool="solo", perform_ping_check=False, shutdown_timeout=10):
        heartbeat.delay()
        deadline = time.monotonic() + 10
        while last_heartbeat() is None and time.monotonic() < deadline:
            time.sleep(0.1)
    assert last_heartbeat() is not None, "the worker never ran the heartbeat"
    statuses = {c["name"]: c["status"] for c in client.get("/api/health").json()["checks"]}
    assert statuses["worker"] == "ok"
```

In `apps/api/tests/test_health.py`, make the database-only test restrict the checks:

```python
"""GET /api/health (M0 part 3 spec, P3.2)."""

import pytest
from django.db import OperationalError
from django.test import Client

from code_api.config.env import database_from_url
from code_api.health import checks


@pytest.mark.django_db
def test_healthy_when_the_database_answers(client: Client, monkeypatch: pytest.MonkeyPatch) -> None:
    # Only the database here; Redis and the worker are tested in test_worker_health.py.
    monkeypatch.setattr(checks, "CHECKS", {"database": checks.database})
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert [(c["name"], c["status"]) for c in response.json()["checks"]] == [("database", "ok")]
    assert response["Cache-Control"] == "no-store"
```

- [ ] **Step 3: Run them and watch them fail**

Run: `uv run pytest apps/api/tests/test_worker_health.py -q`
Expected: a collection error, `ModuleNotFoundError: No module named 'code_api.celery'`.

- [ ] **Step 4: Write the app, the client, the heartbeat and the task**

`apps/api/src/code_api/celery.py`:

```python
"""The Celery app. Worker: `celery -A code_api worker`; beat: `celery -A code_api beat`."""

import os

from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "code_api.config.settings")

app = Celery("code_api")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()
```

`apps/api/src/code_api/__init__.py`:

```python
"""Comeni Code's Django project (architecture spec R2)."""

from code_api.celery import app as celery_app

__all__ = ["celery_app"]
```

`apps/api/src/code_api/redis.py`:

```python
"""One Redis client for the app, with short timeouts so health fails fast (P4.3)."""

from functools import cache

from django.conf import settings
from redis import Redis


@cache
def client() -> Redis:
    return Redis.from_url(settings.CELERY_BROKER_URL, socket_connect_timeout=2, socket_timeout=2)
```

`apps/api/src/code_api/health/heartbeat.py`:

```python
"""The heartbeat: its timing, shared by beat's schedule, the task and the worker check (P4.3).

Reads and writes go through these two functions, so redis-py's loose return types (one
annotation for its sync and async clients) are narrowed in one place.
"""

from typing import cast

from code_api import redis

HEARTBEAT_KEY = "code:health:heartbeat"
HEARTBEAT_INTERVAL_SECONDS = 10.0
# Three missed beats mean the worker (or beat) is down.
HEARTBEAT_STALE_AFTER_SECONDS = 3 * HEARTBEAT_INTERVAL_SECONDS
# An abandoned key doesn't outlive the setup.
HEARTBEAT_EXPIRES_SECONDS = 300


def write_heartbeat(at: float) -> None:
    redis.client().set(HEARTBEAT_KEY, at, ex=HEARTBEAT_EXPIRES_SECONDS)


def last_heartbeat() -> float | None:
    raw = cast(bytes | None, redis.client().get(HEARTBEAT_KEY))
    return None if raw is None else float(raw)
```

`apps/api/src/code_api/health/tasks.py`:

```python
"""Background tasks for health. Beat schedules `heartbeat`; a worker runs it."""

import time

from celery import shared_task

from code_api.health.heartbeat import write_heartbeat


@shared_task(name="code_api.health.tasks.heartbeat")
def heartbeat() -> None:
    write_heartbeat(time.time())
```

`apps/api/src/code_api/health/checks.py` (whole file):

```python
"""Named health checks. Part 4 adds Redis and the worker."""

import logging
import time
from collections.abc import Callable
from dataclasses import dataclass
from typing import Literal

from django.db import connection

from code_api import redis as redis_client
from code_api.health.heartbeat import HEARTBEAT_STALE_AFTER_SECONDS, last_heartbeat

log = logging.getLogger(__name__)

Status = Literal["ok", "down"]


@dataclass(frozen=True)
class CheckResult:
    name: str
    status: Status
    duration_ms: int


def database() -> None:
    """Open the connection and run a trivial query. Raises if Postgres is unreachable."""
    with connection.cursor() as cursor:
        cursor.execute("SELECT 1")


def redis() -> None:
    """PING Redis. Raises if it doesn't answer within its timeout."""
    redis_client.client().ping()


def worker() -> None:
    """The heartbeat a worker writes must be recent. Raises with a reason that is only logged."""
    last = last_heartbeat()
    if last is None:
        raise RuntimeError("no heartbeat")
    age = time.time() - last
    if age > HEARTBEAT_STALE_AFTER_SECONDS:
        raise RuntimeError(f"last heartbeat {age:.0f} s ago")


CHECKS: dict[str, Callable[[], None]] = {"database": database, "redis": redis, "worker": worker}


def run(name: str, check: Callable[[], None]) -> CheckResult:
    """Run one check. Any exception means down; the reason is logged, never returned."""
    started = time.monotonic()
    try:
        check()
        status: Status = "ok"
    except Exception:
        log.exception("health check %s failed", name)
        status = "down"
    return CheckResult(name, status, round((time.monotonic() - started) * 1000))


def run_all() -> list[CheckResult]:
    return [run(name, check) for name, check in CHECKS.items()]
```

- [ ] **Step 5: Settings, first without `CELERY_IMPORTS`.** Replace
`apps/api/src/code_api/config/settings.py` with the file below, **but leave out the three
`CELERY_IMPORTS` lines** (its comment and the setting) for now:

```python
"""Django settings. Values that differ between environments come from `Env`; nothing else does.

M0 part 2 spec, P2.3.
"""

from code_api.config.env import Env, database_from_url
from code_api.health.heartbeat import HEARTBEAT_INTERVAL_SECONDS

ENV = Env()

SECRET_KEY = ENV.secret_key.get_secret_value()
DEBUG = ENV.debug
ALLOWED_HOSTS = ENV.allowed_hosts

INSTALLED_APPS = [
    "django.contrib.contenttypes",
    "django.contrib.auth",
    "django.contrib.sessions",
    # Part 3 serves the API docs page from Ninja's bundled files, which needs staticfiles.
    "django.contrib.staticfiles",
    # Ninja in INSTALLED_APPS serves the docs page from its bundled files, not a CDN (part 2, P2.5).
    "ninja",
    "code_api.accounts",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    # Serves /static/ with DEBUG off, so the API docs page loads in every environment.
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "code_api.config.urls"
WSGI_APPLICATION = "code_api.config.wsgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
            ],
        },
    },
]

DATABASES = {"default": database_from_url(ENV.database_url.get_secret_value())}
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

AUTH_USER_MODEL = "accounts.User"
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = ENV.static_root

# Celery (M0 part 4 spec, P4.2). No result backend: nothing reads task results yet.
CELERY_BROKER_URL = ENV.redis_url.get_secret_value()
CELERY_BROKER_CONNECTION_RETRY_ON_STARTUP = True
CELERY_TASK_IGNORE_RESULT = True
CELERY_TIMEZONE = TIME_ZONE
# Autodiscovery searches INSTALLED_APPS only; task modules outside a Django app are named here, or a
# worker rejects their tasks as unregistered (found by hand in the part 4 scratch build).
CELERY_IMPORTS = ("code_api.health.tasks",)
CELERY_BEAT_SCHEDULE = {
    "health-heartbeat": {
        "task": "code_api.health.tasks.heartbeat",
        "schedule": HEARTBEAT_INTERVAL_SECONDS,
    },
}
```

- [ ] **Step 6: See the registration bug the scratch build found**

Run: `uv run pytest apps/api/tests/test_worker_health.py -q`
Expected: every test passes except `test_a_fresh_worker_process_knows_every_scheduled_task`,
which fails with `a worker would reject code_api.health.tasks.heartbeat`.

- [ ] **Step 7: Add the `CELERY_IMPORTS` lines** exactly as in the file above.

Run: `uv run pytest -q -W error::DeprecationWarning && uv run ruff check . && uv run ruff format --check . && uv run mypy && uv run python apps/api/manage.py check`
Expected: all clean, and all tests passing.

- [ ] **Step 8: Schema.** Regenerate it with the command in CLAUDE.md, then run
`uv run pytest apps/api/tests/test_openapi_and_docs.py -q`.
Expected: passes. The health response shape didn't change, so the file may be unchanged.

- [ ] **Step 9: Commit**

```bash
git add apps/api pyproject.toml uv.lock
git commit -m "feat(api): a beat heartbeat, and health reports Redis and the worker

Spec P4.2–P4.4. Beat schedules a heartbeat every 10 seconds; the worker check calls it stale
after 30. CELERY_IMPORTS names the health tasks, because autodiscovery only searches
INSTALLED_APPS and a real worker rejected the task while every in-process test passed; a
subprocess test now loads the app as a worker does. celery-types gives mypy strict Celery's
types, and two typed functions narrow redis-py's.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Docs, the manual check, and the PR

**Files:**
- Modify: `CLAUDE.md`, `.gitignore`

- [ ] **Step 1: `.gitignore`.** Replace the line `celerybeat-schedule` with `celerybeat-schedule*`
(on Python 3.14 beat also writes `-shm` and `-wal` files).

- [ ] **Step 2: CLAUDE.md.**
- In **First-time setup**, change `docker compose up -d --wait postgres` to
  `docker compose up -d --wait postgres redis`, with the comment
  `# Postgres 18 on :5433, Redis 8 on :6380`.
- In **Commands**, add:

```
uv run celery -A code_api worker -l info                            # background worker
uv run celery -A code_api beat -l info                              # scheduler (separate process)
```

- In the paragraph about settings, after "Tests marked `django_db` need Postgres running", add
  ", and tests that use Redis need Compose's `redis`".
- In *Layout*, update the `apps/api/` line to mention `celery.py` and `redis.py`, and the
  `compose.yaml` line to `postgres and redis now, the rest from part 8`.

- [ ] **Step 3: The manual check.** Start the processes, each with its PID saved:

```bash
docker compose exec redis redis-cli del code:health:heartbeat
nohup uv run celery -A code_api worker -l warning > /tmp/code-worker.log 2>&1 & echo $! > /tmp/code-worker.pid
nohup uv run celery -A code_api beat -l warning > /tmp/code-beat.log 2>&1 & echo $! > /tmp/code-beat.pid
nohup uv run python apps/api/manage.py runserver 127.0.0.1:8001 --noreload > /tmp/code-server.log 2>&1 & echo $! > /tmp/code-server.pid
sleep 16; curl -s -w "  %{http_code}\n" http://127.0.0.1:8001/api/health
kill $(cat /tmp/code-worker.pid); sleep 34; curl -s -w "  %{http_code}\n" http://127.0.0.1:8001/api/health
kill $(cat /tmp/code-beat.pid) $(cat /tmp/code-server.pid)
```
Expected: first `200` with all three `ok`; then `503` with `worker: down`. Record both outputs
for the journal. `uv run` starts a child process, so if `kill` leaves one behind, stop it by the
PID `pgrep -P <saved pid>` shows, not by pattern.

- [ ] **Step 4: Commit, push, PR, CI**

```bash
git add CLAUDE.md .gitignore
git commit -m "docs: start Redis, and run the worker and beat

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git push -u origin feat/m0-celery
gh pr create --base main --title "M0 part 4: Celery, beat and Redis" --body "M0 part 4 per docs/superpowers/specs/2026-09-17-m0-celery-beat-redis-design.md: Redis in Compose and CI, a beat heartbeat, and redis and worker health checks, proven with a real worker.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
gh pr checks --watch
```
Expected: `python` passes, including the real-worker test against CI's Redis service.

---

### Task 4: Check against *done when*, and record the part

- [ ] **Step 1: Check spec P4.1**

| Item | How |
|---|---|
| Compose Postgres and Redis healthy | `docker compose ps` |
| Celery on 3.14, worker and beat from `code_api` | the manual check's processes started; `uv run python -c "import celery,sys;print(sys.version, celery.__version__)"` |
| Health reports three checks; 503 proven for Redis down and stale or missing heartbeat | `uv run pytest apps/api/tests/test_worker_health.py -v` |
| Fresh worker knows every scheduled task; real worker test | the same file, locally and in the PR's CI run |
| The manual check is recorded | Task 3 Step 3 outputs in the journal |

- [ ] **Step 2: Mark the spec as built** (`**Status: agreed 2026-09-17; built in PR <number>.**`;
specs README row `agreed; built`).

- [ ] **Step 3: Journal entry** `docs/notes/journal/2026-09-17-m0-part-4-celery.md` (use the
finishing date if different), in the README's order:
- **Where things stand:** the P4.1 checks, the manual check's two outputs, the CI run.
- **What changed:** commit hashes and PR numbers.
- **Decisions:** in the order made:
  - Redis plus a heartbeat (the operator's choice over a single check or a control ping);
  - Python 3.14 confirmed;
  - `celery-types`;
  - `CELERY_IMPORTS`, after the unregistered-task bug.
- **What is next:** part 5 (web toolchain), whose spec comes first.
- **Traps:**
  - task modules outside Django apps go in `CELERY_IMPORTS`;
  - tests that import a task module hide registration bugs;
  - stop background processes by PID;
  - the worker reads down for its first 10 seconds.

Update the journal README box and table.

- [ ] **Step 4: Commit, push, merge**

```bash
git add docs
git commit -m "docs(journal): M0 part 4 built — Celery, beat and Redis

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git push && gh pr checks --watch && gh pr merge --merge
git checkout main && git pull --ff-only
```
