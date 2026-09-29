# Docs compaction and issues first — plan

The [spec](../specs/2026-09-29-docs-compaction-design.md). Branch `docs/compaction`, cut from
`m3-part-6-first-steps` because the last three entries exist only there.

## Tasks

1. **The link check skips archives** (C5)
   - [x] a test that a file under an `archive/` folder is not collected, and a live file is; watch
     it fail
   - [x] `tracked_markdown()` drops `archive/` paths; the docstring says why
2. **The size budgets** (C3)
   - [x] `tests/repo/test_doc_sizes.py`: `CLAUDE.md` ≤ 300, `docs/notes/now.md` ≤ 150; watch it fail
     on the 320-line `CLAUDE.md`
3. **Paths in the brief exist** (C3)
   - [x] `tests/repo/test_doc_paths.py`, ported from Labs' `check_doc_paths.py`, with its unit
     tests; watch it fail on `CLAUDE.md`'s `…` path
4. **Compact the journal** (C1)
   - [x] `docs/notes/compaction.md`
   - [x] `docs/notes/now.md` from all 39 entries, oldest first; claims about behaviour checked
     against the code
   - [x] `git mv` the entries into `journal/archive/`; rewrite `journal/README.md` without named
     pointers; update `docs/notes/README.md`
5. **`CLAUDE.md` as a brief** (C2)
   - [x] trim to the brief; tasks 2 and 3 go green
6. **Archive finished specs and plans** (C4)
   - [x] `git mv` the M0–M3 part specs and plans; the specs README and `docs/index.md` follow
7. **Issues first** (C6, C7)
   - [x] `docs/internals/walking.md`; the two templates; the bug template's stale line
   - [x] the six labels; issue 32 labelled `deferred`; the known connector defect filed; the M4
     parent issue
8. **Checks**
   - [x] `uv run ruff check . && uv run ruff format --check . && uv run mypy && uv run pytest tests/repo`

## Execution record

- **Task 3:** the guard first reported noise besides the real dead path — module paths under
  `apps/api/src`, sibling checkouts, `.dc.html`, `feat/…` — so it learned those shapes, each with a
  unit test. `…` is now a placeholder, so the elided architecture-spec path was fixed by writing it
  in full rather than by the guard.
- **Task 4:** the first `now.md` was 171 lines; it was cut by writing less, and by dropping rules
  `CLAUDE.md` already holds. The entry count is 38, not 39 (the 39th file was the README). This
  session's own entry was written and archived with it.
- **Task 5:** `CLAUDE.md` came to 301 lines on the first pass; the Fedora Node recipe became four
  lines. No copy of the old file is kept in the tree: `git show 23da290:CLAUDE.md`.
- **Task 6:** the weaving spec and the specs README linked to part specs; both now point into
  `archive/`.
- **Task 8:** `apps/api/tests` was not run: this machine has no Postgres running, and the change
  touches no code they cover. CI runs them.
