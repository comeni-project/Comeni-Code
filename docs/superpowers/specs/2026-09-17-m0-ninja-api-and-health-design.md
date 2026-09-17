# M0 part 3 — the Ninja API and the health route

**Status: agreed 2026-09-17.** This is part 3 of phase M0 (architecture spec R4). Its objective
and check were restated in
[`2026-09-17-m0-part-2-django-project.md`](../../notes/journal/2026-09-17-m0-part-2-django-project.md),
and it must meet the OpenAPI constraint in
[part 2's spec, P2.5](2026-09-17-m0-django-project-design.md). This spec decides what R7 leaves to
this part:
- the API's layout and URLs;
- the health response and its status codes;
- how the docs page is served;
- how the committed schema is kept current.

The operator made every decision here on 2026-09-17, section by section. An agent proposed them
and checked the risky parts in a scratch build first.

---

## P3.1 What this part does

It gives `code_api` its JSON API: Django Ninja mounted at `/api/`, a health route that reports
the database, the OpenAPI schema and a docs page that works in every environment, and a
committed schema that tests keep current.

**Done when:**

- `GET /api/health` returns **200** with Postgres up; tests prove it returns **503** when a check
  is down, and never a 500;
- `/api/openapi.json` lists the health route with both 200 and 503;
- the committed `apps/api/openapi.json` matches the generated schema, and a test fails when it
  doesn't;
- with `DEBUG` off, `/api/docs` and every static file it references load, and none come from a CDN;
- all of it passes locally and in CI.

Out of scope: Redis and worker checks (part 4), the web app (parts 5–7), Compose services beyond
Postgres (part 8).

## P3.2 The API and the health route

```
apps/api/src/code_api/
  api.py              the one NinjaAPI; each Django app adds a Router
  health/checks.py    named checks; run one, run all
  health/api.py       GET /api/health
  config/urls.py      path("api/", api.urls)
apps/api/openapi.json the committed schema
```

- **One `NinjaAPI`**, titled *Comeni Code API*, version `0.1.0`, mounted at **`/api/`**. The
  schema is at `/api/openapi.json` and the docs page at `/api/docs`, **with no DEBUG switch**, so
  both exist in every environment (P2.5).
- **Checks** are named functions that raise when a service is unreachable. `CHECKS` maps names to
  functions. Part 3 registers `database`, which runs `SELECT 1` on the default connection.
  Running a check records `ok` or `down` and its duration in milliseconds. **Any exception means
  `down`**: the reason is logged server-side and never returned.
- **`GET /api/health`** returns `{"status": "ok" | "down", "checks": [{"name", "status",
  "duration_ms"}]}`:
  - **200** when every check is ok, **503** when any is down; both are declared in the schema;
  - `Cache-Control: no-store`;
  - no login.
- **A dead database fails fast.** `database_from_url` adds `OPTIONS: {"connect_timeout": 3}`,
  so the health route answers 503 within seconds instead of hanging.
- **Status codes use `ninja.Status`.** Ninja 1.7 deprecates returning a `(status, body)` tuple,
  as the scratch build showed.

**Rejected:**

| Alternative | Why not |
|---|---|
| A plain Django view for health | not in the schema or on the docs page, against P2.5 |
| `django-health-check` | a dependency with its own URLs and format, also outside the schema |
| `/api/v1/` | the only client is our own web app, released together and generated from the committed schema; a version is added when an outside consumer needs one |
| Error details in the response | they leak hostnames and driver messages |
| 200 with `"status": "down"` | load balancers and Compose health checks read the status code |
| Separate liveness and readiness routes | nothing consumes two yet; part 8 can split them |

## P3.3 The docs page, static files and the schema

**The docs page is served from our own files.**

- **Ninja's bundled files:** `ninja` joins `INSTALLED_APPS`, so its docs template loads Swagger
  UI through `{% static %}`, not a CDN. That choice is made in Ninja's `render_template` in
  version 1.7.0.
- **Static files with DEBUG off:** **WhiteNoise 6.12** serves `/static/`. Its middleware sits
  directly after `SecurityMiddleware`.
- **`STATIC_ROOT`** comes from a new variable, **`CODE_STATIC_ROOT`**, defaulting to
  `staticfiles` in the working directory, which git ignores. `collectstatic` fills it, and part
  8's image runs that at build time.
- **Storage stays Django's plain one.** WhiteNoise's compressed, fingerprinted storage waits for
  part 8. Its manifest would also break tests that run without `collectstatic`.
- **Test warning:** WhiteNoise warns when `STATIC_ROOT` doesn't exist, which is the case in most
  tests. The pytest settings ignore only that warning.

**Why WhiteNoise rather than nginx.**

- The check can be proved in pytest.
- No extra service or shared volume is needed.
- It behaves the same locally, in CI and in containers.
- The workload is a handful of files.

A reverse proxy for TLS will still come with hosting (R6), and can cache or take over static files
then without changing Django code.

**The committed schema.**

- **The file:** `apps/api/openapi.json` is generated with
  `manage.py export_openapi_schema --api code_api.api.api --sorted --indent 2`.
- **The check is a pytest test,** not a CI step: it builds the schema in memory and compares it
  with the file. A stale schema fails `uv run pytest` locally and in CI, and the message gives
  the command to regenerate it. The scratch build confirmed that changing the API version fails
  it.

**Rejected:**

| Alternative | Why not |
|---|---|
| Ninja's CDN templates | third-party code on every visit; broken offline |
| Serving static files through Django views | slow, and not meant for production |
| nginx now | not testable in pytest; needs another service and a shared volume before hosting is designed |
| A CI-only schema diff | a local check would miss it |
| Generating the schema at build time without committing it | part 7's client needs a file, and reviewers should see API changes in the diff |

## P3.4 Tests and CI

- **Health tests:**
  - with the database up: 200, `ok`, `Cache-Control: no-store`;
  - with the database check raising a connection error: 503, `down`, and no error text in the
    body;
  - with a check raising an unexpected error: 503, not 500;
  - the parsed URL carries `connect_timeout: 3`.

  The failing cases replace the check rather than stopping Postgres.
- **Schema and docs tests:**
  - the committed schema is current;
  - `/api/openapi.json` lists `/api/health` with 200 and 503;
  - `/api/docs` returns 200, references `/static/ninja/…`, and has no `http(s)://` `src` or
    `href`;
  - after `collectstatic` into a temporary `STATIC_ROOT`, with DEBUG off, every file the docs
    page references returns 200.
- **No new CI steps;** the tests carry the checks.
- **Housekeeping:** `CODE_STATIC_ROOT` goes in `.env.example`; `staticfiles/` goes in
  `.gitignore`. CLAUDE.md gains the schema and `collectstatic` commands.

## P3.5 Risks

- **Ninja's Swagger UI files change between Ninja versions.** The docs test reads the page's own
  references, so it follows whatever the installed version uses.
- **The docs page is public in every environment,** as P2.5 requires. It exposes only the schema,
  which is committed to a public repository anyway.
