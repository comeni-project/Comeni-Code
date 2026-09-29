# 2026-09-29 — the docs compacted, and issues first

**The journal has a *now*, `CLAUDE.md` is a brief, and work is tracked in issues.** The operator
asked to look at how Comeni Labs had reorganised its notes and issues, and to bring that here. An
agent read Labs' system and proposed a migration; the operator approved it in full, chose Labs'
label names, and chose that the link check skip archive folders. The
[spec](../../superpowers/specs/2026-09-29-docs-compaction-design.md) and the
[plan](../../superpowers/plans/2026-09-29-docs-compaction.md) are in the same branch.

---

## Where things stand

| Claim | Check |
|---|---|
| `CLAUDE.md` ≤ 300 lines and `now.md` ≤ 150, or a test fails | `uv run pytest tests/repo/test_doc_sizes.py` |
| Every backticked path in both exists | `uv run pytest tests/repo/test_doc_paths.py` |
| Only files under an `archive/` folder escape the link check | `uv run pytest tests/repo/test_links.py -k archived` |
| All 38 earlier entries are compacted into `now.md` and archived unedited | `ls docs/notes/journal/archive/`; `git log --follow --stat` on any of them shows a rename only |
| The M0–M3 part specs and plans are archived; four product specs stay live | `ls docs/superpowers/specs docs/superpowers/plans` |
| Labs' six labels exist; issue 32 is `deferred` | `gh label list`; `gh issue view 32` |
| M4's parent issue is #74; the connector defect is #73 | `gh issue view 74`, `gh issue view 73` |

## What changed

On branch `docs/compaction`, cut from `m3-part-6-first-steps` (the M3 entries for parts 4–6 exist
only on that stack): the spec and plan; `tests/repo/` gains the size and path guards and the
archive skip; `docs/notes/now.md`, `compaction.md` and the journal README; `CLAUDE.md` trimmed;
`docs/internals/walking.md` and the two *Walk* templates; `docs/index.md`, the notes and specs
READMEs. On GitHub: the six labels, #73 and #74.

## Decisions made, and why

1. **Labs' system, adapted, not copied.** Labs' guards are scripts behind `make`; Code has no
   Makefile and CI runs pytest, so they are tests in `tests/repo/`. A walk in Code is the running
   app beside the published canvas, which M3 already did every part.
2. **Labs' label names** (operator), so both repositories read the same. *Rejected:* `decision`
   for `protocol`.
3. **The link check skips `archive/` folders** (operator), with a test pinning exactly that.
   *Rejected:* archiving journal entries only; no archive for specs and plans.
4. **No copy of the old `CLAUDE.md` in the tree.** Labs kept one as a fixture; here
   `git show 23da290:CLAUDE.md` is the record, and a copy would be one more file for the link and
   path checks to special-case.
5. **The path guard learned this repository's shapes**: module paths under `apps/*/src`, sibling
   checkouts (`../`), double extensions (`.dc.html`) and `…` placeholders. Each has a unit test.
6. **The attribution rule names the model in use** rather than a fixed model.

## What is next

1. **Merge the M3 stack bottom-up** (#65, #66, #67), then this branch, which is based on #67.
2. **Split M4 into parts** in a journal entry, for the operator's approval; each part becomes a
   sub-issue of #74.

## Traps

- **The guards were watched failing against the real files**: 320 lines; `now.md` missing; the
  elided `2026-09-17-…-architecture…` path; the specs linking into moved entries. Keep that in
  mind before loosening one.
- **`now.md` has little room**: compact by writing less. Rules that `CLAUDE.md` holds do not
  belong in `now.md` too.
- **Archived entries' relative links are stale by design.** Follow them from the entry's old
  place, or search for the file name.
