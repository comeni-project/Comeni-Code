# M0 part 2: the Django project boots — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task by task, driven by one agent. Subagents are for review only (the operator's rule in CLAUDE.md). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `apps/api`, a Django 6.1 project (`code_api`) that validates its environment,
has a custom user model, migrates Postgres 18 and passes database tests, locally and in CI.

**Architecture:** `apps/api` is a uv workspace member. `code_api.config.env.Env`
(pydantic-settings) is the only reader of `CODE_*` variables, and `settings.py` copies its
values into Django's names. `compose.yaml` starts with a single `postgres` service. The
existing CI job gains a Postgres service and the `manage.py` checks.

**Tech Stack:** Django 6.1, psycopg 3.3 (binary), pydantic-settings 2.15, pytest-django 4.14,
django-stubs 6.1 with mypy 2.3, Postgres 18, Docker Compose.

**Spec:** [`docs/superpowers/specs/2026-09-17-m0-django-project-design.md`](../specs/2026-09-17-m0-django-project-design.md)
(agreed 2026-09-17).

**Tested before writing:** every file below was built in a scratch clone of `main` at
`4f07d86` on 2026-09-17.

- With Postgres from `compose.yaml` running, all of these passed: `manage.py check`,
  `makemigrations --check --dry-run`, `migrate`, `ruff check`, `ruff format --check`, `mypy`,
  and `pytest`.
- With Postgres stopped, the tests that don't use the database passed.
- Task 1's intermediate state (Env only, no settings yet) passed on its own.
- The scratch build found three things the plan now handles:
  1. pydantic repeats a rejected secret in its error, so `hide_input_in_errors` is on;
  2. mypy needs the pydantic plugin and `apps/api/src` on `mypy_path`;
  3. Django's generated migration fails E501, so migrations are exempt from that one rule.

## Global Constraints

- Python 3.14. The new package has `requires-python = ">=3.14"`, and dependencies are pinned
  to a minor range: `django>=6.1,<6.2`, `psycopg[binary]>=3.3,<3.4`, `pydantic-settings>=2.15,<3`.
- Names: distribution `code-api`, import package `code_api`, project wiring in
  `code_api.config`, the Django app `code_api.accounts` with label `accounts`.
- Environment variables are `CODE_SECRET_KEY` (required, at least 50 characters),
  `CODE_DATABASE_URL` (required, `postgres` or `postgresql` scheme), `CODE_DEBUG` (default
  `false`) and `CODE_ALLOWED_HOSTS` (comma-separated, default empty). **No other module reads
  the environment.**
- `.env` is read from the working directory. **Every command runs from the repository root.**
- Postgres: the `postgres:18` image, with user, password and database all `code`, on host port
  `127.0.0.1:5433`. The volume is mounted at `/var/lib/postgresql`.
- `mypy` stays `>=2.3,<2.4`, the limit django-stubs 6.1 supports.
- Migrations are exempt from **E501 only**.
- The purity guard stays as it is. `code_api` is not under `packages/`.
- The API is not built here. Part 3 must meet spec P2.5 (OpenAPI, and a mandatory,
  self-hosted docs page).
- Commits: `type(scope): what is now true`, a body that says why, ending with
  `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`. PR descriptions end with
  `🤖 Generated with [Claude Code](https://claude.com/claude-code)`. **Never commit to `main`.**

## Files

| Path | Responsibility |
|---|---|
| `pyproject.toml` (root) | members, dev group, pytest, ruff and mypy settings |
| `apps/api/pyproject.toml` | the `code-api` package and its dependencies |
| `apps/api/manage.py` | Django's command line |
| `apps/api/src/code_api/__init__.py`, `py.typed` | the package |
| `apps/api/src/code_api/config/env.py` | `Env` and `database_from_url` |
| `apps/api/src/code_api/config/settings.py` | Django settings from `Env` |
| `apps/api/src/code_api/config/{urls,wsgi,asgi}.py` | routing (none yet) and server entry points |
| `apps/api/src/code_api/accounts/{__init__,apps,models}.py`, `migrations/` | the custom user |
| `apps/api/tests/test_env.py` | the environment's contract |
| `apps/api/tests/test_database.py` | Postgres, UTC, the user model |
| `compose.yaml` | the `postgres` service |
| `.env.example` | local values for every variable |
| `.github/workflows/ci.yml` | the Postgres service, the `CODE_*` variables and the `manage.py` steps |
| `CLAUDE.md` | setup and commands |

---

### Task 0: Land the spec and plan, then branch

- [ ] **Step 1: Commit both on `docs/m0-part-2`**

```bash
git add docs/superpowers/specs/2026-09-17-m0-django-project-design.md docs/superpowers/specs/README.md
git commit -m "docs(spec): M0 part 2 — the Django project boots

Settles what R7 leaves to part 2: code_api as a workspace package, pydantic-settings reading
CODE_* variables, a custom user model from the first migration, Postgres 18 in Compose, and
Django under pytest-django and django-stubs. It also records the operator's requirement that
part 3 follow OpenAPI and keep a mandatory, self-hosted docs page.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"

git add docs/superpowers/plans/2026-09-17-m0-django-project.md
git commit -m "docs(plan): M0 part 2 — the Django project boots

Test-first steps for part 2, each tried in a scratch clone first. That build found the
secret echoed in validation errors, the mypy plugins needed, and the E501 exemption that
migrations need.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

- [ ] **Step 2: Push, open the PR, and merge once CI passes** (only with the operator's
  go-ahead for this part)

```bash
git push -u origin docs/m0-part-2
gh pr create --base main --title "M0 part 2: spec and plan — the Django project boots" --body "$(cat <<'EOF'
## What

The spec and plan for M0 part 2: `apps/api` as `code_api`, settings from `CODE_*` variables,
a custom user model, Postgres 18 in Compose, and Django under pytest-django and django-stubs.

## Why

Architecture spec R5. The operator agreed the design section by section on 2026-09-17. The
spec also records the operator's requirement that part 3 follow OpenAPI and keep a mandatory,
self-hosted docs page.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
gh pr checks --watch
gh pr merge --merge
```

- [ ] **Step 3: Branch**

```bash
git checkout main && git pull --ff-only
git checkout -b feat/m0-django-project
```

---

### Task 1: The `code-api` package and its validated environment

**Files:**
- Modify: `pyproject.toml` (root)
- Create: `apps/api/pyproject.toml`, `apps/api/src/code_api/__init__.py`, `apps/api/src/code_api/py.typed`, `apps/api/src/code_api/config/__init__.py`, `apps/api/src/code_api/config/env.py`
- Test: `apps/api/tests/test_env.py`

**Interfaces:**
- Produces:
  - `code_api.config.env.Env`, a pydantic `BaseSettings` with fields `secret_key: SecretStr`,
    `database_url: SecretStr`, `debug: bool` and `allowed_hosts: list[str]`;
  - `code_api.config.env.database_from_url(url: str) -> dict[str, Any]`, which returns Django's
    `DATABASES["default"]` keys `ENGINE`, `NAME`, `USER`, `PASSWORD`, `HOST` and `PORT`
    (`PORT` is a string, empty when absent). It raises `ValueError("the database URL names no
    database")` when there is no database name.
- `Env` validation messages: `"must be a postgresql:// URL"` for a URL with the wrong scheme.
  No rejected value ever appears in an error.

- [ ] **Step 1: Update the root `pyproject.toml`.** This replaces the whole file:

```toml
# A virtual workspace: the root is not a package. `uv sync --all-packages` installs every member.
[tool.uv.workspace]
members = ["packages/*", "apps/api"]

[dependency-groups]
dev = [
    "pytest>=9.1",
    "pytest-django>=4.14",
    "ruff>=0.16",
    "mypy>=2.3,<2.4",
    "django-stubs[compatible-mypy]>=6.1,<6.2",
]

[tool.pytest.ini_options]
testpaths = ["tests", "apps/api/tests"]
# `tests/` is on the path so `guards.purity` imports without making `tests` a package.
pythonpath = ["tests"]
addopts = ["--import-mode=importlib", "--strict-markers"]

[tool.ruff]
line-length = 100
target-version = "py314"
# The planted packages break the rules on purpose (spec P1.4).
extend-exclude = ["tests/guards/fixtures"]

[tool.ruff.lint]
select = ["E", "F", "I", "UP", "B", "SIM"]

[tool.ruff.lint.isort]
known-first-party = ["code_api", "code_schema", "code_weaver", "guards"]

[tool.mypy]
strict = true
files = ["packages", "apps/api", "tests"]
# pydantic's plugin knows that settings fields come from the environment, not from arguments.
plugins = ["pydantic.mypy"]
exclude = ['^tests/guards/fixtures/']
# apps/api/src is listed so each file there has exactly one module name.
mypy_path = ["tests", "apps/api/src"]
explicit_package_bases = true
```

- [ ] **Step 2: Create the package**

`apps/api/pyproject.toml`:

```toml
[project]
name = "code-api"
version = "0.0.0"
description = "Comeni Code's Django project: accounts, content, studio, learn, requests and AI, behind one JSON API."
requires-python = ">=3.14"
license = "Apache-2.0"
dependencies = [
    "django>=6.1,<6.2",
    "psycopg[binary]>=3.3,<3.4",
    "pydantic-settings>=2.15,<3",
]

[build-system]
requires = ["uv_build>=0.11,<0.12"]
build-backend = "uv_build"
```

`apps/api/src/code_api/__init__.py`:

```python
"""Comeni Code's Django project (architecture spec R2)."""
```

`apps/api/src/code_api/config/__init__.py`:

```python
"""Project wiring: the environment, settings, URLs and server entry points."""
```

```bash
touch apps/api/src/code_api/py.typed
uv lock && uv sync --locked --all-packages
```
Expected: this adds django, psycopg, psycopg-binary, pydantic, pydantic-settings,
pytest-django, django-stubs and their dependencies, and installs `code-api`.

- [ ] **Step 3: Write the failing environment tests**

`apps/api/tests/test_env.py`:

```python
"""The environment is validated once, and only `CODE_*` variables count (spec P2.3)."""

import pytest
from pydantic import ValidationError

from code_api.config.env import Env, database_from_url

KEY = "k" * 50
URL = "postgresql://code:code@localhost:5433/code"


@pytest.fixture(autouse=True)
def _clean_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    """Each test starts from no `CODE_*` variables, whatever the shell or `.env` holds."""
    for name in ("SECRET_KEY", "DATABASE_URL", "DEBUG", "ALLOWED_HOSTS"):
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
        debug="true",
        allowed_hosts=" code.example , localhost ,",
    )
    assert env.secret_key.get_secret_value() == KEY
    assert env.database_url.get_secret_value() == URL
    assert env.debug is True
    assert env.allowed_hosts == ["code.example", "localhost"]


def test_defaults_are_the_safe_ones(monkeypatch: pytest.MonkeyPatch) -> None:
    env = make_env(monkeypatch, secret_key=KEY, database_url=URL)
    assert env.debug is False
    assert env.allowed_hosts == []


def test_ignores_unprefixed_variables(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DATABASE_URL", "postgresql://other:other@elsewhere/other")
    with pytest.raises(ValidationError) as caught:
        make_env(monkeypatch, secret_key=KEY)
    assert "database_url" in str(caught.value)


def test_a_missing_variable_is_named(monkeypatch: pytest.MonkeyPatch) -> None:
    with pytest.raises(ValidationError) as caught:
        make_env(monkeypatch, database_url=URL)
    assert "secret_key" in str(caught.value)


def test_a_short_secret_key_is_refused_without_being_shown(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    with pytest.raises(ValidationError) as caught:
        make_env(monkeypatch, secret_key="too-short-to-be-a-key", database_url=URL)
    assert "secret_key" in str(caught.value)
    assert "too-short-to-be-a-key" not in str(caught.value)


def test_only_postgres_urls_are_accepted_and_none_is_shown(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    with pytest.raises(ValidationError) as caught:
        make_env(monkeypatch, secret_key=KEY, database_url="mysql://root:hunter2@db/code")
    assert "must be a postgresql:// URL" in str(caught.value)
    assert "hunter2" not in str(caught.value)


def test_database_from_url() -> None:
    assert database_from_url("postgresql://code:p%40ss%2Fword@db.internal:6543/code_db") == {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": "code_db",
        "USER": "code",
        "PASSWORD": "p@ss/word",
        "HOST": "db.internal",
        "PORT": "6543",
    }


def test_database_from_url_without_port_or_password() -> None:
    database = database_from_url("postgres://code@localhost/code")
    assert (database["HOST"], database["PORT"], database["PASSWORD"]) == ("localhost", "", "")


def test_database_from_url_needs_a_database_name() -> None:
    with pytest.raises(ValueError, match="names no database"):
        database_from_url("postgresql://code:code@localhost:5433/")
```

- [ ] **Step 4: Run them and watch them fail**

Run: `uv run pytest apps/api/tests/test_env.py -v`
Expected: a collection ERROR, `ModuleNotFoundError: No module named 'code_api.config.env'`.

- [ ] **Step 5: Write `apps/api/src/code_api/config/env.py`**

```python
"""The environment, read and validated once (M0 part 2 spec, P2.3).

This is the only module that reads environment variables. Every name starts with `CODE_`, so a
developer's shell cannot leak another project's `DATABASE_URL` into Code.
"""

from typing import Annotated, Any
from urllib.parse import unquote, urlsplit

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Env(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="CODE_",
        # Relative to the working directory: commands run from the repository root.
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        # A rejected value is never echoed: it may be the secret key or a database password.
        hide_input_in_errors=True,
    )

    secret_key: SecretStr = Field(min_length=50)
    database_url: SecretStr
    debug: bool = False
    allowed_hosts: Annotated[list[str], NoDecode] = []

    @field_validator("database_url")
    @classmethod
    def _postgres_only(cls, value: SecretStr) -> SecretStr:
        scheme = urlsplit(value.get_secret_value()).scheme
        if scheme not in {"postgres", "postgresql"}:
            raise ValueError("must be a postgresql:// URL")
        return value

    @field_validator("allowed_hosts", mode="before")
    @classmethod
    def _split_hosts(cls, value: object) -> object:
        if isinstance(value, str):
            return [host.strip() for host in value.split(",") if host.strip()]
        return value


def database_from_url(url: str) -> dict[str, Any]:
    """Django's `DATABASES["default"]` for a `postgresql://user:pass@host:port/name` URL."""
    parts = urlsplit(url)
    name = unquote(parts.path.lstrip("/"))
    if not name:
        raise ValueError("the database URL names no database")
    return {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": name,
        "USER": unquote(parts.username or ""),
        "PASSWORD": unquote(parts.password or ""),
        "HOST": parts.hostname or "",
        "PORT": str(parts.port or ""),
    }
```

- [ ] **Step 6: Run them and watch them pass**

Run: `uv run pytest apps/api/tests/test_env.py -v`
Expected: 9 passed.

- [ ] **Step 7: Full check**

Run: `uv run ruff check . && uv run ruff format --check . && uv run mypy && uv run pytest -q`
Expected: all clean, and every test passes. The link check adds one test per tracked Markdown file, so the count grows with the docs.

- [ ] **Step 8: Commit**

```bash
git add pyproject.toml uv.lock apps/api
git commit -m "feat(api): code_api reads a validated CODE_* environment

M0 part 2 (spec P2.2–P2.3). Env is the only reader of the environment. A missing or malformed
variable stops start-up and is named, and a rejected value is never echoed, because pydantic
would otherwise print a short secret key back. The CODE_ prefix keeps another project's
DATABASE_URL out.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Django settings, the custom user, and Postgres in Compose

**Files:**
- Modify: `pyproject.toml` (root: pytest-django settings, the Django mypy plugin, the E501 exemption for migrations)
- Create: `apps/api/manage.py`, `apps/api/src/code_api/config/{settings,urls,wsgi,asgi}.py`
- Create: `apps/api/src/code_api/accounts/{__init__,apps,models}.py`, `apps/api/src/code_api/accounts/migrations/__init__.py`, `apps/api/src/code_api/accounts/migrations/0001_initial.py` (generated)
- Create: `compose.yaml`, `.env.example`
- Test: `apps/api/tests/test_database.py`

**Interfaces:**
- Consumes: `Env` and `database_from_url` from Task 1.
- Produces:
  - `code_api.config.settings`, containing `ENV`, `INSTALLED_APPS` (which includes
    `django.contrib.staticfiles` and `code_api.accounts`) and `TEMPLATES` with `APP_DIRS`;
  - `code_api.accounts.models.User`, with `AUTH_USER_MODEL = "accounts.User"`;
  - `code_api.config.urls.urlpatterns`, empty, typed `list[URLPattern | URLResolver]`, for
    part 3 to extend.

- [ ] **Step 1: Write the failing database tests**

`apps/api/tests/test_database.py`:

```python
"""The project boots against Postgres, with the custom user model (spec P2.2, P2.4)."""

import pytest
from django.contrib.auth import get_user_model
from django.db import connection

from code_api.accounts.models import User


@pytest.mark.django_db
def test_the_database_is_postgres() -> None:
    assert connection.vendor == "postgresql"


@pytest.mark.django_db
def test_the_database_session_is_in_utc() -> None:
    with connection.cursor() as cursor:
        cursor.execute("SHOW TIME ZONE")
        row = cursor.fetchone()
    assert row is not None
    assert row[0] == "UTC"


def test_the_user_model_is_ours() -> None:
    assert get_user_model() is User


@pytest.mark.django_db
def test_a_user_round_trips() -> None:
    User.objects.create_user(username="ada", email="ada@example.org", password="x" * 16)
    stored = User.objects.get(username="ada")
    assert stored.email == "ada@example.org"
    assert stored.check_password("x" * 16)
```

- [ ] **Step 2: Run them and watch them fail**

Run: `uv run pytest apps/api/tests/test_database.py -v`
Expected: a collection ERROR on `from django.contrib.auth import get_user_model` or on
`code_api.accounts`. Django is not configured yet (`ImproperlyConfigured` or
`ModuleNotFoundError: No module named 'code_api.accounts'`).

- [ ] **Step 3: Configure pytest-django, the Django mypy plugin and the migration exemption in the root `pyproject.toml`**

In `[tool.pytest.ini_options]`, add this line after `testpaths`:

```toml
DJANGO_SETTINGS_MODULE = "code_api.config.settings"
```

Between `[tool.ruff.lint]` and `[tool.ruff.lint.isort]`, add:

```toml
[tool.ruff.lint.per-file-ignores]
# Django writes migrations with help texts no formatter can wrap. E501 only: the rest still applies.
"apps/api/src/code_api/*/migrations/*.py" = ["E501"]
```

In `[tool.mypy]`, replace the `plugins` line with:

```toml
plugins = ["pydantic.mypy", "mypy_django_plugin.main"]
```

At the end of the file, add:

```toml

[tool.django-stubs]
django_settings_module = "code_api.config.settings"
```

- [ ] **Step 4: Write the project files**

`apps/api/manage.py`:

```python
#!/usr/bin/env python
"""Django's command-line utility for Comeni Code's API."""

import os
import sys


def main() -> None:
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "code_api.config.settings")
    from django.core.management import execute_from_command_line

    execute_from_command_line(sys.argv)


if __name__ == "__main__":
    main()
```

`apps/api/src/code_api/config/settings.py`:

```python
"""Django settings. Values that differ between environments come from `Env`; nothing else does.

M0 part 2 spec, P2.3.
"""

from code_api.config.env import Env, database_from_url

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
    "code_api.accounts",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
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
```

`apps/api/src/code_api/config/urls.py`:

```python
"""URL routes. Part 3 mounts the API here."""

from django.urls import URLPattern, URLResolver

urlpatterns: list[URLPattern | URLResolver] = []
```

`apps/api/src/code_api/config/wsgi.py`:

```python
"""WSGI entry point."""

import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "code_api.config.settings")

application = get_wsgi_application()
```

`apps/api/src/code_api/config/asgi.py`:

```python
"""ASGI entry point."""

import os

from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "code_api.config.settings")

application = get_asgi_application()
```

`apps/api/src/code_api/accounts/__init__.py`:

```python
"""People who sign in. The user model exists from the first migration (M0 part 2 spec, P2.2)."""
```

`apps/api/src/code_api/accounts/apps.py`:

```python
from django.apps import AppConfig


class AccountsConfig(AppConfig):
    name = "code_api.accounts"
    label = "accounts"
```

`apps/api/src/code_api/accounts/models.py`:

```python
from django.contrib.auth.models import AbstractUser


class User(AbstractUser):
    """Django's user, swappable from day one. Fields arrive with M4 (accounts)."""
```

```bash
mkdir -p apps/api/src/code_api/accounts/migrations
touch apps/api/src/code_api/accounts/migrations/__init__.py
```

- [ ] **Step 5: Write the local environment and Compose**

`.env.example`:

```
# Local development only. Copy to .env (git ignores it). Compose's postgres listens on 5433.
CODE_SECRET_KEY=insecure-local-development-key-never-use-this-anywhere-else-000000
CODE_DATABASE_URL=postgresql://code:code@localhost:5433/code
CODE_DEBUG=true
CODE_ALLOWED_HOSTS=localhost,127.0.0.1
```

`compose.yaml`:

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

volumes:
  postgres-data:
```

```bash
cp .env.example .env
docker compose up -d --wait postgres
docker compose ps
```
Expected: `comeni-code-postgres-1 … (healthy)`. If port 5433 is taken, stop and report it;
don't change the port silently, because `.env.example` and CLAUDE.md name it.

- [ ] **Step 6: Generate the migration and format it**

```bash
uv run python apps/api/manage.py check
uv run python apps/api/manage.py makemigrations accounts
uv run ruff format apps/api/src/code_api/accounts/migrations
```
Expected: `System check identified no issues (0 silenced).`, then
`accounts/migrations/0001_initial.py — Create model User`, then `1 file reformatted`.

- [ ] **Step 7: Run the database tests and watch them pass**

Run: `uv run pytest apps/api/tests/test_database.py -v`
Expected: 4 passed.

- [ ] **Step 8: Run Django's own checks**

```bash
uv run python apps/api/manage.py makemigrations --check --dry-run
uv run python apps/api/manage.py migrate
```
Expected: `No changes detected`, then every migration applied, ending with
`Applying sessions.0001_initial... OK`.

- [ ] **Step 9: See start-up refuse a missing variable**

```bash
mv .env .env.off
CODE_DATABASE_URL=postgresql://code:code@localhost:5433/code uv run python apps/api/manage.py check 2>&1 | tail -3
mv .env.off .env
```
Expected: `ValidationError: 1 validation error for Env`, then `secret_key`, then
`Field required`.

- [ ] **Step 10: See the tests that don't use the database pass without Postgres**

```bash
docker compose stop postgres
uv run pytest -q tests apps/api/tests/test_env.py
docker compose start postgres && docker compose up -d --wait postgres
```
Expected: every test passes; none of them needs the database.

- [ ] **Step 11: Full check**

Run: `uv run ruff check . && uv run ruff format --check . && uv run mypy && uv run pytest -q`
Expected: all clean, and every test passes, including the 4 database tests.

- [ ] **Step 12: Commit**

```bash
git add pyproject.toml apps/api compose.yaml .env.example
git status --short   # .env must NOT be listed
git commit -m "feat(api): the Django project boots on Postgres 18 with its own user model

M0 part 2 (spec P2.2–P2.4). A custom user now costs nothing; swapping one in after the first
migration is a hand migration. compose.yaml starts with Postgres alone on port 5433, because
5432 is often taken. staticfiles and app templates are there for part 3's self-hosted docs
page. Migrations are exempt from E501 only.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: CI with Postgres, and the setup in CLAUDE.md

**Files:**
- Modify: `.github/workflows/ci.yml`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Replace `.github/workflows/ci.yml`**

```yaml
name: CI

# Every pull request runs the same command set as a local check (M0 part 1 spec, P1.3; part 2
# spec, P2.4). Later M0 parts add their own jobs here.

on:
  push:
    branches: [main]
  pull_request:
  workflow_dispatch:

permissions:
  contents: read

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  python:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:18
        env:
          POSTGRES_USER: code
          POSTGRES_PASSWORD: code
          POSTGRES_DB: code
        ports:
          - 5432:5432
        options: >-
          --health-cmd "pg_isready -U code -d code"
          --health-interval 2s
          --health-timeout 3s
          --health-retries 30

    # Settings load in mypy and pytest too, so every step sees these. CI-only values.
    env:
      CODE_SECRET_KEY: ci-only-insecure-key-for-github-actions-0000000000000000
      CODE_DATABASE_URL: postgresql://code:code@localhost:5432/code
      CODE_DEBUG: "false"
      CODE_ALLOWED_HOSTS: localhost

    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1

      - name: Install uv
        uses: astral-sh/setup-uv@bec219d24cd3e171d82865faccec33120bb574f4 # v10.1.0
        with:
          enable-cache: true

      # uv reads .python-version and fetches 3.14 itself.
      - name: Sync the workspace
        run: uv sync --locked --all-packages

      - name: Django checks
        run: |
          uv run python apps/api/manage.py check
          uv run python apps/api/manage.py makemigrations --check --dry-run
          uv run python apps/api/manage.py migrate

      - name: Lint
        run: uv run ruff check .

      - name: Format
        run: uv run ruff format --check .

      - name: Types
        run: uv run mypy

      - name: Tests
        run: uv run pytest -v
        # Includes both purity guards and their self-tests, the link check, and the API's
        # environment and database tests.
```

- [ ] **Step 2: Update CLAUDE.md**

Replace this paragraph:

```markdown
**Status: phase M0 (Skeleton) in progress.** The parts list is in the journal. The Python
workspace exists; the Django project and the web app do not yet.
```

with:

~~~~markdown
**Status: phase M0 (Skeleton) in progress.** The parts list is in the journal. The Python
workspace and the Django project (`apps/api`, no API routes yet) exist; the web app does not.

**First-time setup** (from the repository root, where every command runs):

```
cp .env.example .env                # local values for every CODE_* variable
docker compose up -d --wait postgres   # Postgres 18 on localhost:5433
uv sync --locked --all-packages
uv run python apps/api/manage.py migrate
```
~~~~

In the **Commands** block, add these lines directly after the `uv sync` line:

```
uv run python apps/api/manage.py check                              # Django's checks
uv run python apps/api/manage.py makemigrations --check --dry-run   # models match migrations
```

Below the *Adding a pure package* paragraph, add:

```markdown
**Settings come only from `CODE_*` variables**, read by `code_api/config/env.py`, and nothing
else reads the environment. mypy and pytest load the settings too, so they need `.env` (or the
variables). Tests marked `django_db` need Postgres running; the rest don't.
```

In *Layout*, add these lines to the code block, in path order:

```
.env.example              local values for every CODE_* variable
apps/api/                 the Django project, code_api (config/, accounts/), and its tests
compose.yaml              the local stack: postgres now, the rest from part 8
```

The outer `~~~~` fence above belongs to this plan only. In CLAUDE.md, the setup block is an
ordinary triple-backtick block.

- [ ] **Step 3: Full local check**

Run: `uv sync --locked --all-packages && uv run python apps/api/manage.py check && uv run python apps/api/manage.py makemigrations --check --dry-run && uv run ruff check . && uv run ruff format --check . && uv run mypy && uv run pytest -q`
Expected: all clean, and every test passes (the link check covers CLAUDE.md too).

- [ ] **Step 4: Commit, push and open the PR**

```bash
git add .github/workflows/ci.yml CLAUDE.md
git commit -m "ci: run Django's checks and the database tests against Postgres 18

Spec P2.4. The existing job gains a Postgres service, so lint, mypy and pytest see the same
Django environment, and the command set stays identical to a local check. CLAUDE.md gives the
first-time setup.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git push -u origin feat/m0-django-project
gh pr create --base main --title "M0 part 2: the Django project boots" --body "$(cat <<'EOF'
## What

- `apps/api`: a Django 6.1 project (`code_api`) with a validated `CODE_*` environment and a
  custom user model.
- `compose.yaml` with Postgres 18 on port 5433, and `.env.example`.
- CI: a Postgres service; `manage.py check`, `makemigrations --check` and `migrate`; the
  database tests.

## Why

M0 part 2, per `docs/superpowers/specs/2026-09-17-m0-django-project-design.md`.

## Checks

- [ ] CI green here, including the Django checks and the database tests

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 5: Watch CI go green**

Run: `gh pr checks --watch`, then
`gh run view --log | grep -E "No changes detected|Applying accounts|passed in|failed"`
Expected: `python` passes. The log shows `No changes detected`,
`Applying accounts.0001_initial... OK`, and a pytest summary with no failures. If the job fails, use
superpowers:systematic-debugging, and commit the fix separately.

---

### Task 4: Check against *done when*, and record the part

- [ ] **Step 1: Check each item of spec P2.1**

| Item | How |
|---|---|
| Postgres becomes healthy | `docker compose ps` shows `(healthy)` |
| The three `manage.py` commands pass locally | Task 2 Steps 6 and 8 |
| The three `manage.py` commands pass in CI | the `Django checks` step in the PR's run |
| ruff, mypy and pytest (with the database tests) pass locally and in CI | Task 3 Steps 3 and 5 |
| CLAUDE.md gives setup and commands | `grep -n "cp .env.example .env" CLAUDE.md` |

If any item fails, the part is not done.

- [ ] **Step 2: Mark the spec as built**

In the spec, change the status line to `**Status: agreed 2026-09-17; built in PR <number>.**`.
In `docs/superpowers/specs/README.md`, change the row's status to `agreed; built`.

- [ ] **Step 3: Write the journal entry**

Create `docs/notes/journal/2026-09-17-m0-part-2-django-project.md`, using the date the work
finishes if it isn't 2026-09-17. Follow the journal README's order, and include:
- **Where things stand:** each P2.1 check with its command, and the CI run link.
- **What changed:** the commit hashes and PR numbers.
- **Decisions:** the operator's OpenAPI requirement (spec P2.5), plus anything that moved
  during the build.
- **What is next, with part 3's objective and check restated, because the parts list is
  append-only:**
  - objective: the API under `/api/`; `/api/health` reports the database; the OpenAPI schema
    at `/api/openapi.json`; the docs page at `/api/docs` in every environment, from Ninja's
    bundled files; the schema committed;
  - check: tests show 200 when the database is up and 503 when it is down; the schema lists
    the route; the docs page loads with `DEBUG` off and makes no request to a CDN; CI fails
    when the committed schema is stale.
- **Traps:**
  - every command runs from the repository root (`.env` is read from the working directory);
  - mypy loads the Django settings, so it needs `CODE_*` variables;
  - Postgres 18's volume path;
  - host port 5433;
  - mypy is capped below 2.4;
  - Django's static files aren't served with `DEBUG` off, which matters for part 8.

Update the box at the top of `docs/notes/journal/README.md` and add the row to its table.

- [ ] **Step 4: Commit and push**

```bash
git add docs/notes/journal docs/superpowers/specs
git commit -m "docs(journal): M0 part 2 built — the Django project boots

Records the done-when checks, the operator's OpenAPI requirement for part 3, and part 3's
updated objective and check.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git push
gh pr checks --watch
```

- [ ] **Step 5: Merge only with the operator's go-ahead for this part** (`gh pr merge --merge`),
  then `git checkout main && git pull --ff-only`, and run the full check once more on `main`.
