# 2026-09-17 — M0 part 1: the workspace and both purity guards

**Part 1 of M0 is built.** The repository has a Python workspace, two empty pure packages, a
static and a runtime purity guard, a relative-link check, and CI that runs all of it. A canary PR
showed the guard failing on GitHub, as R4 asks. **Next is part 2's spec**, which needs the
operator's approval before its plan.

The operator approved the spec and the plan, and allowed the agent to push and merge. The agent
built the part test-first from the plan.

---

## Where things stand

| Claim | Check |
|---|---|
| The workspace installs on Python 3.14 | `uv sync --locked --all-packages` |
| Lint, formatting and types are clean | `uv run ruff check . && uv run ruff format --check . && uv run mypy` |
| All tests pass: 10 guard tests, 2 link-helper tests, and one link test per tracked Markdown file (35 in CI before this entry was added) | `uv run pytest` |
| Each guard rejects its planted package | `uv run pytest tests/guards -v` (the `rejects…` and `misses…` tests) |
| CI passes on the part's PR (Python 3.14.7, 35 passed) | [run 35203365468](https://github.com/comeni-project/Comeni-Code/actions/runs/35203365468), PR #4 |
| **The purity guard fails CI when a pure package imports Django** | canary PR #5, closed unmerged. Lint, format and types passed; Tests failed with `code_schema/__init__.py:3: imports django` ([run 35203436996](https://github.com/comeni-project/Comeni-Code/actions/runs/35203436996)) |

Of M0's *done when*, the purity-guard check now holds. The health page (part 8) and the content
repository's refusal of a direct push (part 9) remain.

## What changed this session

- `66c1a79`, `96f3998`, `699e116`, `1b55446`: CLAUDE.md for the build phase, the parts list,
  and part 1's spec and plan (PR #3, merged as `997dce9`).
- `c3b9a45`: the workspace, `code-schema`, `code-weaver`, the static guard and its fixtures.
- `b9bc077`: a plan snippet fixed so `ruff format` accepts it (see *Traps*).
- `b049501`: the runtime guard.
- `3025a5d`: the relative-link check.
- `a7de01e`: CI, and the commands in CLAUDE.md.
- PR #5: the canary, red in CI, closed unmerged, branch deleted.
- This entry and the spec's status: this entry's commit.

## Decisions made, and why

The spec's decisions held; none moved during the build. Two details it left open were settled:

1. **The canary suppresses ruff and mypy on its planted line** (`# type: ignore[import-not-found]
   # noqa: F401`). CI runs lint and types before tests, and a canary that fails at lint proves
   nothing about the guard. Found while checking the plan against a scratch build, before any
   code was written.
2. **`bad_runtime` calls `pathlib.os.system`** instead of reaching a socket through
   `typing.sys.modules`. On 3.14, `socket` is only in `sys.modules` if something already
   imported it, so the socket route was not reliable. The spec was corrected before approval.

## What is next

1. **Part 2, Django project boots**: its spec first (brainstorming), then the operator's
   approval, then its plan. It decides the settings approach, how pytest-django reaches Postgres
   locally and in CI, and where `apps/api` sits in the uv workspace (the root's `members` will
   need `apps/*` or an explicit entry).
2. **Part 9** can run at any time. Each change to GitHub settings needs the operator's
   confirmation.
3. **Consider requiring the `python` check on `Comeni-Code`'s `main`.** CI runs, but nothing
   stops a red PR from merging. It is a settings change, so it needs confirmation, and it fits
   naturally beside part 9.

## Open questions

- **The shared sign-in with Labs** (from the parts entry) is still to be added to R8.

## Traps

- **`uv sync` needs `--all-packages`.** The root is a virtual workspace, so without the flag
  only the dev tools are installed.
- **`ruff format` also formats Python code blocks inside Markdown** (ruff 0.16). A plan or spec
  with a badly spaced Python block fails `ruff format --check`.
- **The fixture files' line numbers are asserted by tests.** Adding a line to `bad_static`
  breaks `test_rejects_a_planted_django_import_and_dynamic_import`.
- **The runtime guard only imports packages** until M2 makes it run a weave. A green runtime
  guard today says little about behaviour.
- **The link check reads only files tracked by git.** A new Markdown file is checked once it is
  added.
- **Local branches `docs/seed-repository`, `docs/architecture-roadmap` and `docs/m0-parts` are
  merged** and can be deleted, both locally and on the remote.
