# 2026-09-17 — M0 part 2: the Django project boots

**Part 2 of M0 is built.** `apps/api` is a Django 6.1 project (`code_api`). It validates a
`CODE_*` environment, has a custom user model, migrates Postgres 18 from `compose.yaml`, and
passes its database tests locally and in CI. It has no API routes yet. **Next is part 3's
spec.** The operator added a requirement for part 3 this session: follow OpenAPI and keep a
mandatory docs page. Part 3's objective and check are restated below.

The operator agreed the design section by section and waived a separate review of the written
spec. They also gave standing permission to push and merge for the rest of the conversation.
The agent built the part test-first from the plan.

---

## Where things stand

| Claim | Check |
|---|---|
| Postgres 18 runs locally on port 5433 | `docker compose up -d --wait postgres && docker compose ps` shows `(healthy)` |
| Django's checks pass, and the models match the migrations | `uv run python apps/api/manage.py check && uv run python apps/api/manage.py makemigrations --check --dry-run` |
| Migrations apply | `uv run python apps/api/manage.py migrate` |
| Lint, formatting and strict types (with the Django and pydantic plugins) are clean | `uv run ruff check . && uv run ruff format --check . && uv run mypy` |
| Every test passes: 51 at merge time, including 4 database tests | `uv run pytest` |
| The tests that don't use the database pass with Postgres stopped | `docker compose stop postgres && uv run pytest tests apps/api/tests/test_env.py` |
| A missing variable stops start-up and is named | move `.env` aside, then `manage.py check` fails with `secret_key … Field required` |
| CI runs all of the above against a Postgres service | [run 35205615273](https://github.com/comeni-project/Comeni-Code/actions/runs/35205615273), PR #7: `No changes detected`, `Applying accounts.0001_initial... OK`, `51 passed` |

## What changed this session

- PR #6 (`a8fb8f6`): part 2's spec and plan.
- `98d5501`: the `code-api` package and `Env`.
- `70f9cad`: settings, the custom user and its migration, `compose.yaml`, `.env.example`.
- `7bd54e0`: CI with Postgres, and the setup in CLAUDE.md.
- This entry, and the spec marked as built: this entry's commit (PR #7).

## Decisions made, and why

All are in the spec with their rejected alternatives. The order they were made in:

1. **Postgres comes from `compose.yaml` now**, with one service on port 5433. **Rejected:**
   testcontainers, and each developer bringing their own Postgres. Port 5432 is taken on the
   operator's machine by another project.
2. **A custom user model from the first migration.** **Rejected:** deferring it to M4, which
   would mean a hand migration later.
3. **pydantic-settings** reading `CODE_*` variables. **Rejected:** django-environ and plain
   `os.environ`.
4. **The operator's requirement: the API follows OpenAPI, and its docs page is mandatory.**
   Reading Ninja 1.7.0 showed that its docs page loads Swagger UI from a CDN unless `ninja` is
   in `INSTALLED_APPS`. So this part installs `staticfiles` and app templates, and part 3 must
   serve the page from Ninja's bundled files in every environment (spec P2.5).
5. **Found while building the scratch copy, before the plan was written:**
   - `hide_input_in_errors`, because pydantic echoed a rejected secret key;
   - the pydantic mypy plugin, and `apps/api/src` on `mypy_path`;
   - migrations exempt from E501 only;
   - `.env` read from the working directory, not located from the source file's path, which
     would break at a different install depth in a container.

## What is next

1. **Part 3, the Ninja API and the health route.** The spec comes first. The parts list in
   [`2026-09-17-m0-in-parts.md`](2026-09-17-m0-in-parts.md) is append-only, so this is part 3
   as it now stands:
   - **Objective:**
     - Django Ninja serves the API under `/api/`;
     - `/api/health` reports the database;
     - the OpenAPI schema is served at `/api/openapi.json`;
     - the docs page at `/api/docs` is on in every environment and served from Ninja's
       bundled files (`ninja` in `INSTALLED_APPS`);
     - the schema is committed to the repo.
   - **Check:**
     - tests show 200 when the database is up and 503 when it is down;
     - the schema lists the route;
     - the docs page loads with `DEBUG` off and references no CDN;
     - CI fails when the committed schema is stale.
2. **Part 9** can run at any time, with confirmation before each settings change. So can
   requiring the `python` check on `main`.

## Open questions

- **The shared sign-in with Labs** still needs adding to R8.
- **How part 8 serves static files with `DEBUG` off** (WhiteNoise is the likely answer). The
  docs page depends on it inside Compose.

## Traps

- **Every command runs from the repository root.** `.env` is read from the working directory,
  so `cd apps/api && python manage.py …` finds no `.env`.
- **mypy loads the Django settings**, so it needs the `CODE_*` variables too. A broken
  `settings.py` shows up as a mypy failure.
- **mypy is held below 2.4** until django-stubs allows newer versions.
- **Postgres 18's volume is mounted at `/var/lib/postgresql`**, not `…/data`.
- **Host port 5433, not 5432.**
- **With `DEBUG` off, Django does not serve static files.** This matters for part 3's docs page
  once it runs in Compose (part 8).
- **Tests marked `django_db` error (not fail) when Postgres is down.** Start Compose first.
