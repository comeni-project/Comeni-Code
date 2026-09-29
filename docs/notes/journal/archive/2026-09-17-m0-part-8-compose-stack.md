# 2026-09-17 — M0 part 8: the Compose stack

**Part 8 of M0 is built.**
- `docker compose up -d --wait` runs Postgres, Redis, a one-off `migrate`, the API (gunicorn),
  the worker, beat and the web app (nginx). http://127.0.0.1:8090 shows the health page.
- CI's new `stack` job builds and starts the same stack and checks it through `web` (54 s).

**Next is part 9** (content repository guardrails), the last part of M0. It changes GitHub
settings, so it needs the operator's confirmation before anything is applied.

The operator agreed the design section by section. **One process failure:** PR #26 (this part's
spec and plan) was merged with the `python` job red (*Traps*); PR #27 fixed it.

---

## Where things stand

| Claim | Check |
|---|---|
| The stack comes up and passes its check | `docker compose build && docker compose up -d --wait` (exit 0; `migrate` Exited (0), the rest healthy), then `ops/stack-check.sh`: four `ok` lines. The existing `postgres` and `redis` containers were kept, not recreated |
| The health page shows all checks ok through `web` | Firefox screenshot of 127.0.0.1:8090: *All 3 checks ok*, database 23 ms |
| A stopped worker is reported, and the API stays healthy | `docker compose stop worker`: 503 naming `worker` after 20 s; `api` still `(healthy)`; `CODE_STACK_HEALTH_WAIT_S=3 ops/stack-check.sh` exited 1 and printed the logs |
| nginx survives a recreated API | `docker compose up -d --force-recreate --no-deps api`: 200 again after 4 s |
| No `.env` in the image; not root | `docker run --rm comeni-code-api sh -c 'id; ls -a /app'`: uid 10001, no `.env` |
| CI starts the stack | PR #28, run 35232481979: `stack` passed in 54 s with the same four `ok` lines; `python` and `web` passed |

**M0's done-when** (architecture spec R4), item by item:

| Item | State |
|---|---|
| `docker compose up` shows a health page | **holds** (this part) |
| CI is green | **holds** (three jobs) |
| The purity guard fails when a pure package imports Django | **holds** (part 1; its canary runs in CI) |
| The content repository refuses a direct push to main | part 9 |

## What changed this session

- PR #26: part 8's spec and plan (merged red; see *Traps*). PR #27: the broken link fixed.
- Part 8's commits, oldest first: f31d28b 98e86e2 9f555b9 7f4b987 (PR #28).

## Decisions made, and why

The spec holds the rejected alternatives. In order:

1. **Section 1:** one API image for migrate, api, worker and beat; gunicorn; nginx serving the
   build (Labs' precedent); whole-folder copies instead of a member list; only `web` published,
   on 8090.
2. **Section 2:** the API's container check counts 200 *and* 503 as serving; the worker is
   checked with `celery inspect ping`, not the heartbeat; beat has no check; one stack-check
   script for local and CI.
3. **Section 3:** the done-when above, and CLAUDE.md giving both ways to run.
4. **Found in the scratch build:** gunicorn 26 runs with `--no-control-socket`.
5. **No build caching:** the CI job takes 54 s.

## What is next

1. **Part 9, content repository guardrails:** a CI stub in `comeni-code-content`, auto-merge,
   and a no-bypass ruleset on `main`. Its spec comes first, and every GitHub settings change
   waits for the operator. Consider requiring this repository's three CI jobs on `main` in the
   same conversation.
2. Then M0 is done, and M1 (content core) starts with its parts list.

## Open questions

- Image digests instead of tags, with hosting (spec P8.5).
- The light chip contrast (part 6); jsdom 30 once Fedora ships Node 24.15 (part 5).

## Traps

- **`gh pr checks --watch | tail && gh pr merge` merges a red PR.** The pipeline's exit status is
  `tail`'s. Redirect the checks to a file, keep `$?`, and merge only on 0. PR #26 went in with
  a broken link this way.
- **The link check reads tracked files only.** Run it after `git add`, or a new document's broken
  link passes locally and fails in CI. Here, a plan quoted a link valid only from `specs/`.
- **`docker compose down -v` deletes the development database** (the stack shares the project
  with the development Postgres). To stop the app services only:
  `docker compose rm -sf migrate api worker beat web`.
- **`comeni-code-api` is one image name for every checkout.** A scratch build overwrites it.
- **gunicorn 26 wants a control socket in $HOME;** the image's user has none.
- **`stack-check.sh` exiting 1 while the worker is down is correct:** the stack is only "all
  healthy" when every check is ok.
