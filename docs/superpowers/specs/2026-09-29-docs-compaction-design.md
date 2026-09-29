# 2026-09-29 — Compacting the docs, and issues first

**Status:** agreed 2026-09-29 (operator), after a brainstorm comparing this repository with
Comeni Labs. Built by [the plan of the same date](../plans/2026-09-29-docs-compaction.md).

## The problem

A new session reads `CLAUDE.md`, then the journal. By M3's close both had grown by accretion:

- `CLAUDE.md` was 320 lines, and its status paragraph gained a sentence per part — the way Labs'
  brief reached 1,441 lines before Labs compacted it (Labs issue 118).
- The journal README's box was a chain of about 60 lines of named pointers (*before it … before
  it …*). Labs stopped pointing at entries by name because such pointers went stale.
- 38 journal entries, none consolidated: *what is true now* had to be rebuilt from a chain.
- Specs and plans for finished parts sat beside the live ones, 30 and 26 of them.
- Defects and decisions lived in journal prose. The repository had one open issue and GitHub's
  default labels.

## What changes

Labs' system, adapted where Code differs. Each item names what it borrows.

**C1. Two layers of notes** (Labs `docs/notes/compaction.md`). `docs/notes/journal/` stays the
raw, append-only log. A new `docs/notes/now.md` says what is true today, by topic, each line citing
the entry it came from, at most 150 lines. Compaction folds each fact of an entry into `now.md` as
ADD, UPDATE, DELETE or NOOP and moves the entry, unedited, into `journal/archive/`. It runs when a
part or phase closes, or at five pending entries. All 38 entries are compacted in this change.

**C2. `CLAUDE.md` is a brief**, at most 300 lines: the claim, the invariants, the words, how to
work, commands, layout. No history; the status paragraph moves to `now.md`. The version before
this change is `git show 23da290:CLAUDE.md`.

**C3. Guards, as tests** (Labs `tools/check_doc_sizes.py`, `tools/check_doc_paths.py`). Code has
no Makefile and CI runs pytest, so both are tests in `tests/repo/` beside the link check:
`test_doc_sizes.py` (the two budgets) and `test_doc_paths.py` (every backticked repository path
in `CLAUDE.md` and `now.md` exists). Each is watched failing against the current files first.

**C4. Archives.** Finished specs and plans move to `archive/` beside them. The four product
specs (2026-09-02, 2026-09-16, the architecture spec, the tutor spec) stay live.

**C5. The link check skips `archive/` folders, by name and with a test.** Archived files are
records: their relative links were right where they were written, and editing them to follow a
move would break append-only. `test_links.py` states the skip in its docstring, and a test pins
that only paths under an `archive/` folder are skipped.

**C6. Issues first** (Labs `docs/internals/walking.md`). `docs/internals/walking.md` holds the
loop: every defect gets an issue before code; *mechanical* is fixed test-first and closed citing
the commit; *protocol* is brainstormed, the operator chooses, the decision is commented and
labelled `decided`, then built. A **walk** in Code is driving the running app beside the published
canvas, which the M3 parts already did. Two issue templates, *Walk: mechanical* and *Walk:
protocol*, and Labs' six labels with the same names: `walk`, `mechanical`, `protocol`, `decided`,
`deferred`, `prediction`.

**C7. A task tree in issues.** A parent issue per phase, starting with M4; each part becomes a
sub-issue when the phase is split. The parts list still goes in a journal entry (R5) — the issue
tree is where the work is tracked, the journal where it is argued.

## Decided with the operator

- **Label names are Labs' own**, so both repositories read the same. *Rejected:* `decision` for
  `protocol`.
- **The link check skips archives** (C5). *Rejected:* archiving journal entries only, leaving
  specs and plans flat; no archive for specs and plans at all.
- **GitHub changes are made in this change**: the labels, the templates, the M4 parent issue.

## Also fixed

Stale lines found while reading: `CLAUDE.md`'s *Environment* named another machine's Python path;
its *Pending questions* item is already R8 item 5; `docs/index.md` still said *phase M0*; the bug
template still said *there is no application yet*.

## Not changed

The four product specs, the research notes, the design generator, and any code outside
`tests/repo/`.
