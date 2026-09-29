# M0 part 1 — workspace, pure packages and purity guard

**Status: agreed 2026-09-17; built in PR #4.** Written 2026-09-17. This is part 1 of phase
M0 (architecture spec R4). The parts list is in the journal,
[`2026-09-17-m0-in-parts.md`](../../notes/journal/2026-09-17-m0-in-parts.md). It decides what R7
leaves to a part spec: the Python version, the workspace tool, the test runner, lint and type
checking, the package names, and the shape of the purity guard.

The operator made every decision here on 2026-09-17; an agent proposed them.

---

## P1.1 What this part does

It gives the repository a Python workspace, with two empty pure packages (`code-schema` and
`code-weaver`, R2). It adds the guards that keep those packages pure and a check for broken
documentation links. A CI workflow runs all of it on every pull request.

**Done when:**

- the commands in P1.3 pass locally and in CI;
- the guards' self-tests pass, showing each guard rejecting a planted bad package;
- a throwaway pull request that adds `import django` to `code_schema` is red in CI because of the
  purity guard (this is R4's check). It is closed unmerged, and the journal links it;
- CLAUDE.md lists the commands.

Out of scope: any schema or weaver logic (M1, M2), and the Django project (part 2).

## P1.2 Layout

```
pyproject.toml            virtual uv workspace root; members packages/*; tool configuration
.python-version           3.14
uv.lock
packages/code-schema/     pyproject.toml (uv_build), src/code_schema/__init__.py, py.typed
packages/code-weaver/     pyproject.toml (uv_build), src/code_weaver/__init__.py, py.typed
tests/guards/             purity.py, test_purity_static.py, test_purity_runtime.py, fixtures/
tests/repo/               test_links.py
.github/workflows/ci.yml
```

- **Import names:** `code_schema` and `code_weaver`.
- **The root is a virtual workspace**, with no package of its own. Its `dev` dependency group
  holds pytest, ruff and mypy. Part 2 adds `apps/api` as a member.
- **`code-weaver` does not depend on `code-schema` yet.** M2 adds that dependency when the weaver
  first reads a node.

## P1.3 Tooling

| Choice | Decision | Rejected, and why |
|---|---|---|
| Python | **3.14 only** | **3.12 floor with a test matrix, as in Labs.** Code is an application, and its images pin one version; a matrix would cost CI time and keep compatibility code. **3.13.** It is more cautious about third-party wheels, but only Celery and kombu lack a 3.14 classifier (see P1.7). |
| Workspace | **uv workspace** | **Poetry, PDM or Hatch.** Labs already uses uv, and uv's workspace support is the most mature of the four. |
| Tests | **pytest** | **unittest.** The self-tests need fixtures and parametrisation. |
| Lint and format | **`ruff check` and `ruff format --check`**: line length 100, target py314, rule sets `E F I UP B SIM` | **flake8 with black and isort.** Three tools where one does the job. **Lint without format checking, as in Labs.** Labs skipped the formatter only because 28 files were already hand-wrapped. Here there is no code yet, so enforcing it from the start costs nothing. |
| Types | **mypy `strict`** over `packages/` and `tests/` | **pyright.** The operator chose mypy. **Adding strict later.** Every existing file would have to be fixed at once. **Checking `packages/` only.** The guard code matters as much as the code it guards. |
| A task runner | **None.** The command set below is short enough to list. | **A Makefile.** Five commands don't need a wrapper yet. |

The command set, identical locally and in CI:

```
uv sync --locked --all-packages
uv run ruff check .
uv run ruff format --check .
uv run mypy
uv run pytest
```

## P1.4 The purity guard

**Pure** means what R2 says: no Django, no HTTP client, no model library. The guard is two partial
checks, and **the honest claim is their union**. That is the lesson of Labs' 2026-08-03 audit,
recorded in Labs' `tests/guards/test_purity.py` and `test_purity_runtime.py`, which we read and do
not import.

**The static guard** (`test_purity_static.py`, helpers in `purity.py`):

- It parses every `.py` file under `packages/*/src` and checks each absolute `import` and
  `from … import` against a **closed allowlist for that package**. The allowlists are kept in
  the test file, so every new import is a reviewed change. They start as the package's own name
  plus `__future__` and `typing`. Relative imports are allowed.
- It rejects any call written in our own source to `__import__`, `importlib.import_module`,
  `exec`, `eval` or `compile`, whatever the imports look like.
- **A directory under `packages/` that is missing from the allowlist map fails the test.** A new
  package must be declared, so nobody can forget it.
- A failure names the file, the line and the offending import or call.

**The runtime guard** (`test_purity_runtime.py`):

- It starts a fresh Python subprocess, because audit hooks cannot be removed once installed. The
  subprocess installs `sys.addaudithook`, and the hook raises on these events:
  - network: `socket.*` and `urllib.Request`;
  - process execution: `subprocess.Popen`, `os.system`, `os.exec`, `os.posix_spawn` and `os.fork`;
  - foreign function calls: `ctypes.dlopen`, `ctypes.dlsym`, `ctypes.call_function` and
    `ctypes.cdata`.
- In M0 the subprocess imports each pure package under the hook. **From M2 it also runs a real
  weave**, so the hook watches behaviour and not only imports. The operator chose to have this
  guard now, even with little to exercise, so that it is not forgotten later.
- A failure names the event and the package.

**Seen failing, in every run.** `tests/guards/fixtures/` holds two planted packages:

- `bad_static` imports `django` and calls `importlib.import_module`;
- `bad_runtime` imports only allowed modules, but calls `pathlib.os.system`. That is an allowed
  import reaching a forbidden call, the shape Labs' audit A1 used. It does not reach a socket
  through `typing.sys.modules`, because `socket` is only there if something already imported
  it (checked on 3.14).

Self-tests assert that each guard rejects its planted package with the expected message. A guard
that quietly stops detecting anything therefore fails CI. The static guard's scan of the real
packages never reads `fixtures/`.

**Rejected:**

- **A banned-names list.** Labs' audit defeated it with standard-library transports and dynamic
  imports.
- **import-linter.** It sees only static imports, so it can neither express a closed allowlist
  over the standard library nor catch `__import__` or `exec`.
- **A standalone script with its own CI step.** It is one more step CI has to remember, and the
  self-tests would need pytest anyway.
- **A pre-commit hook in place of CI.** Anyone can skip it.
- **Static guard only in M0.** The operator judged that a runtime guard added later might never
  be added.

## P1.5 The link check

`tests/repo/test_links.py` looks at every Markdown file tracked by git. It checks that each
relative link, ignoring any `#fragment`, points at a file or directory that exists. It skips
external URLs, pure `#anchor` links and fenced code blocks. It needs no network, so it never
flakes. No relative link is broken today, checked by a one-off scan on 2026-09-17.

This closes item 4 of the 2026-09-16 journal's *What is next*.

**Rejected:**

- **lychee or markdown-link-check.** They need the network or an extra binary, and external sites
  make them flaky.
- **Checking anchors.** GitHub's heading slugs are easy to get subtly wrong, and a false failure
  teaches people to ignore the check.

## P1.6 CI

`.github/workflows/ci.yml`:

- It runs on `pull_request`, on `push` to `main`, and on `workflow_dispatch`.
- Its permissions are `contents: read`, with a concurrency group per ref.
- It has one job, `python`: `actions/checkout`, then `astral-sh/setup-uv` with its cache, both
  **pinned to verified commit SHAs** with the version in a comment. Then it runs the P1.3
  commands in order.
- Parts 2–8 add their own jobs to this file.

**Rejected:** **Action version tags without SHAs.** A tag can move and run code nobody reviewed.
The 2026-09-16 journal deferred pinning until the SHAs could be verified; the plan verifies them
with `gh api`.

## P1.7 Risks

- **Celery and kombu on 3.14.** Both are pure Python and require ≥3.9, but on 2026-09-17 neither
  listed 3.14 among its classifiers. Part 4 finds out. If they fail, the fallback is 3.13
  everywhere, decided in part 4's spec.
- **The runtime guard's event list** will grow when M2 gives it behaviour to watch. Labs found
  that `exec` and `compile` fire from template engines, so they are caught statically, not at
  runtime.
