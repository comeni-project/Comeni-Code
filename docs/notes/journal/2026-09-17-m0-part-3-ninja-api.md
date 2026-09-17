# 2026-09-17 — M0 part 3: the Ninja API and the health route

**Part 3 of M0 is built.**
- `code_api` has its JSON API: Django Ninja at `/api/`.
- `/api/health` answers 200 or 503, never 500.
- The docs page is served from Ninja's own files through WhiteNoise in every environment.
- The OpenAPI schema is committed, and a test keeps it current.

**Next is part 4** (Celery, beat and Redis), whose checks join the same registry.

The operator agreed the design section by section and told the agent to execute.

---

## Where things stand

| Claim | Check |
|---|---|
| `/api/health` answers 200 with Postgres up, with `Cache-Control: no-store` | `uv run python apps/api/manage.py runserver 127.0.0.1:8001`, then `curl -si http://127.0.0.1:8001/api/health` (checked: `{"status": "ok", "checks": [{"name": "database", …}]}`) |
| 503 when a check is down, never 500, no error text | `uv run pytest apps/api/tests/test_health.py` |
| The schema lists health with 200 and 503; the committed file is current | `uv run pytest apps/api/tests/test_openapi_and_docs.py` |
| A stale schema fails, naming the regenerate command | change `version` in `code_api/api.py` and run that test (done during the build) |
| With DEBUG off, `/api/docs` and every file it references load; no CDN | the same test file |
| CI passes with 69 tests | PR #17 |

## What changed this session

- PR #16: part 3's spec and plan.
- Part 3's commits, oldest first: bfe0882 499ece1 e46e0e9 (PR #17).

## Decisions made, and why

The spec holds the rejected alternatives. In order:

1. **WhiteNoise in part 3, not part 8** (operator). It makes "the docs page loads with DEBUG off"
   provable in pytest. The operator asked why not nginx. A reverse proxy for TLS still comes
   with hosting and can cache or take over static files then, without code changes.
2. **`/api/` unversioned** (operator). The only client is our own web app, generated from the
   committed schema.
3. **Health design** (operator, section 1):
   - a registry of named checks, where any exception means down;
   - errors are logged, never returned;
   - 503 rather than a 200 carrying "down";
   - a 3-second database connection timeout.
4. **Found in the scratch build:**
   - Ninja 1.7 deprecates `(status, body)` tuples, so routes return `Status[...]`;
   - WhiteNoise warns when `STATIC_ROOT` doesn't exist, so pytest ignores only that warning;
   - `staticfiles/` wasn't git-ignored.

## What is next

1. **Part 4, Celery, beat and Redis.** The spec comes first. Its Redis and worker checks join
   `code_api.health.checks.CHECKS`. It also finds out whether Celery works on Python 3.14
   (part 1, P1.7).
2. Part 9 (content repo guardrails) can still run at any time, with confirmation before each
   settings change.

## Open questions

- R8 item 7 in the architecture spec: how much of S11 Quality is in v1. It is decided when M5
  is split into parts.

## Traps

- **Regenerate the schema after any API change,** or the test fails. The command is in
  CLAUDE.md.
- **Don't return `(status, body)` tuples from Ninja routes;** use `Status`.
- **Port 8000 is taken on this machine;** run the dev server on 8001.
- **`pkill -f` with a pattern that also appears in your own shell command kills that shell.**
  The done-when check lost its second half this way; use `pgrep` to find the process first.
- **The docs page is public in every environment, by design** (part 2, P2.5).
