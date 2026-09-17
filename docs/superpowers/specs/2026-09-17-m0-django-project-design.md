# M0 part 2 — the Django project boots

**Status: agreed 2026-09-17; built in PR #7.** This is part 2 of phase M0 (architecture spec R4). The parts list
is in [`2026-09-17-m0-in-parts.md`](../../notes/journal/2026-09-17-m0-in-parts.md). Part 1 is
[`2026-09-17-m0-workspace-and-purity-guard-design.md`](2026-09-17-m0-workspace-and-purity-guard-design.md).
This spec decides what R7 leaves to this part: the project layout and module names, how
settings read the environment, the user model, where Postgres comes from, and how Django is
type-checked and tested. It also records a constraint that part 3 must meet (P2.5).

The operator made every decision here on 2026-09-17, section by section, and waived a separate
review of the written spec. An agent proposed the options and checked the risky parts in a
scratch build first.

---

## P2.1 What this part does

It adds `apps/api`, a Django 6.1 project that starts, checks itself, migrates Postgres and
passes database tests, locally and in CI. It has no API routes yet; part 3 adds them.

**Done when:**

- `docker compose up -d postgres` becomes healthy;
- `manage.py check`, `manage.py makemigrations --check --dry-run` and `manage.py migrate`
  pass, locally and in CI;
- `ruff`, `mypy` (with the Django and pydantic plugins) and `pytest`, including the database
  tests, pass locally and in CI;
- CLAUDE.md gives the setup steps and the `manage.py` commands.

## P2.2 Shape and dependencies

```
apps/api/
  pyproject.toml         code-api: django 6.1, psycopg[binary] 3.3, pydantic-settings 2.15
  manage.py
  src/code_api/
    config/env.py        the Env class: the only code that reads the environment
    config/settings.py   Django settings, filled from Env
    config/urls.py       no routes yet; part 3 mounts the API
    config/wsgi.py, config/asgi.py
    accounts/            apps.py, models.py (User), migrations/0001_initial.py
  tests/                 test_env.py, test_database.py
compose.yaml             postgres only (P2.4)
.env.example             every variable, with local-development values
```

- **Names.** The distribution is `code-api` and the import package is `code_api`, like
  `code_schema`. The project wiring lives in `code_api.config`. Each Django app is a
  subpackage: `code_api.accounts` now, and `content`, `studio`, `learn`, `requests` and `ai`
  as later parts need them (R2).
- **The workspace.** The root's `members` become `["packages/*", "apps/api"]`. The dev group
  gains `pytest-django` and `django-stubs[compatible-mypy]`, and mypy is held below 2.4
  because django-stubs 6.1 supports only up to that.
- **Installed apps:** `contenttypes`, `auth`, `sessions`, `staticfiles` and `accounts`.
  `staticfiles` and `TEMPLATES` with `APP_DIRS` are there for part 3 (P2.5).
- **A custom user model from the first migration:** `accounts.User(AbstractUser)`, with no
  added fields until M4, and `AUTH_USER_MODEL = "accounts.User"`.
- **Fixed settings:** `USE_TZ = True`, `TIME_ZONE = "UTC"`,
  `DEFAULT_AUTO_FIELD = BigAutoField`, and Django's four password validators.
- **The purity guard is unchanged.** It scans only `packages/`, and `code_api` is allowed to
  import Django.

**Rejected:**

| Alternative | Why not |
|---|---|
| The layout `startproject` produces: top-level `config` and `accounts` modules, run from inside `apps/api` | generic names collide, and mypy and pytest need extra path settings |
| One workspace package per Django app | too much structure; R2 describes one Django project |
| Deferring the user model to M4 | swapping it after the first migration means hand-migrating every table that refers to it; Django's documentation advises a custom model at project start ([*Using a custom user model when starting a project*](https://docs.djangoproject.com/en/6.1/topics/auth/customizing/#using-a-custom-user-model-when-starting-a-project)) |
| Admin and messages now | nothing uses them yet |
| `psycopg2` | psycopg 3 is its maintained successor |
| `psycopg[c]` | it needs a compiler and libpq headers everywhere; the binary wheel is enough until deployment is designed |

## P2.3 Settings and the environment

`code_api/config/env.py` defines `Env`, a pydantic-settings class. It is the only code that
reads the environment.

| Variable | Type | Default |
|---|---|---|
| `CODE_SECRET_KEY` | secret string, at least 50 characters | **required** |
| `CODE_DATABASE_URL` | secret; must use the `postgres` or `postgresql` scheme | **required** |
| `CODE_DEBUG` | bool | `false` |
| `CODE_ALLOWED_HOSTS` | comma-separated list, trimmed, blanks dropped | empty |

- **Every name starts with `CODE_`,** so an unrelated `DATABASE_URL` in a developer's shell is
  ignored. This machine runs another project's Postgres, so the risk is real.
- **Values come from the process environment first, then from `.env` in the working
  directory.** Commands run from the repository root. A missing `.env` is fine; Compose and CI
  pass real variables. **Rejected:** locating `.env` from the source file's own path, which
  breaks when the package is installed at a different depth, as in a container image.
- **Validation runs once, when `settings.py` builds `Env()`.** A missing or malformed variable
  stops start-up with a message naming it. **`hide_input_in_errors` is on,** because pydantic
  otherwise repeats the rejected value in the error, and the scratch build showed a short
  secret key appearing in the message.
- **`settings.py` holds no logic.** It copies `Env` values into Django's names.
- **`database_from_url()`** turns the URL into `DATABASES["default"]` and decodes escaped
  characters in the user and password. It is about fifteen lines with its own tests.
  **Rejected:** `dj-database-url`, a dependency for something this small.
- **`.env.example` is committed** with working local values, including a secret key that says
  it is insecure and for local development only. `.env` is already ignored by git.

**Rejected:**

| Alternative | Why not |
|---|---|
| django-environ | untyped (mypy sees `Any`), and validation happens per call rather than once at start-up |
| Plain `os.environ` | more code to own for the same result; pydantic already arrives with Django Ninja in part 3 |
| Separate `dev`, `test` and `prod` settings modules | differences between environments belong in the environment; several modules drift apart |
| Unprefixed names (`DATABASE_URL`) | they collide with other projects' variables |
| Defaults for the secret key or the database | a forgotten variable in production would start silently with an unsafe value |

## P2.4 Tests, types, Postgres and CI

**Postgres locally.** `compose.yaml` starts now, with one service:

- `postgres`, on the `postgres:18` image, with user, password and database all `code`;
- published on `127.0.0.1:5433`, because 5432 is often taken by another project;
- a `pg_isready` health check;
- a named volume mounted at **`/var/lib/postgresql`**. From version 18 the image keeps its
  data in a versioned directory under that path, so the old `/var/lib/postgresql/data` mount
  is wrong.

Part 8 adds the other services to the same file.

**Tests.**

- pytest-django reads `DJANGO_SETTINGS_MODULE = "code_api.config.settings"` from the root
  pytest settings, and `testpaths` gains `apps/api/tests`.
- **Only tests marked `django_db` touch the database.** The guards, the link check and the
  settings tests pass with Postgres stopped. Every pytest run still needs the `CODE_*`
  variables, because the settings load at start-up.
- `test_env.py` builds `Env(_env_file=None)` from a cleaned environment, so neither the shell
  nor `.env` leaks into it. It checks:
  - prefixed variables are read;
  - the defaults are the safe ones;
  - unprefixed variables are ignored;
  - a missing variable is named;
  - a short key is refused without being shown;
  - a non-Postgres URL is refused without its password being shown;
  - the URL parsing, including escaped characters, a missing port and password, and a
    missing database name.
- `test_database.py` checks that:
  - the connection is Postgres, so a silent switch to SQLite is caught;
  - the database session is in UTC;
  - `get_user_model()` is `accounts.User`;
  - a user round-trips through the database.

**Types.**

- mypy strict gains `apps/api`, the **django-stubs** plugin (which loads the settings, so mypy
  also needs the `CODE_*` variables) and the **pydantic** plugin. Without the pydantic plugin,
  mypy believes `Env()` needs its required fields passed as arguments.
- `mypy_path` gains `apps/api/src`. Without it, `explicit_package_bases` finds each source
  file under two module names.

**Lint.** Migrations are formatted like any other file, and **exempt from E501 only**. Django
writes long `help_text` strings that no formatter can wrap. Every other rule still applies.

**CI.** The existing `python` job gains a `postgres:18` service with a health check, and the
`CODE_*` variables at job level. After the sync and before lint, it runs:

- `manage.py check`;
- `makemigrations --check --dry-run`, which fails if a model changed without a migration;
- `migrate`.

It stays **one job running the same commands as a local check**. The web app (part 5) gets
its own job.

**Rejected:**

| Alternative | Why not |
|---|---|
| testcontainers | every run pays for a container start, and `runserver` still needs its own database |
| Bring your own Postgres | every developer's setup would differ |
| SQLite for tests | it hides Postgres behaviour that later parts rely on (full-text search, R8) |
| A separate CI job for the API | lint, mypy and pytest would need the Django environment in two places, and the local and CI command sets would diverge |
| Pinning the Postgres image by digest | the major-version tag is enough until deployment is designed |
| Excluding migrations from lint entirely | E501 is the only rule they cannot meet |

## P2.5 A constraint on part 3: OpenAPI and the docs page

The operator requires that the API follow OpenAPI, with its documentation page kept and
mandatory. Part 3 must meet this:

- **The schema is generated** by Django Ninja from typed routes and served at
  `/api/openapi.json`.
- **The docs page at `/api/docs` is on in every environment,** not only when `DEBUG` is on.
- **The docs page is served from Ninja's bundled files.** That means `ninja` is in
  `INSTALLED_APPS`, which needs the `staticfiles` and `TEMPLATES` settings from this part.
  Without it, Ninja loads Swagger UI from a public CDN, so every visit would fetch third-party
  code and the page would break offline. Ninja's `render_template` in
  `ninja/openapi/docs.py` makes that choice; read in version 1.7.0.
- **The schema is committed,** and CI fails when it is stale, so part 7's web client can
  generate its types from it.

**A consequence for part 8.** When `DEBUG` is off, Django does not serve static files itself,
so the Compose stack needs something that does (WhiteNoise is the usual choice). Part 8's spec
decides. *Resolved: WhiteNoise (part 3), checked inside the container by
[part 8](2026-09-17-m0-compose-stack-design.md).*

## P2.6 Risks

- **django-stubs caps mypy below 2.4.** A mypy upgrade waits for django-stubs.
- **mypy loads the real settings.** A broken `settings.py` shows up as a mypy failure as well
  as a Django failure.
- **Celery on Python 3.14** (part 1, P1.7) is still open for part 4.
