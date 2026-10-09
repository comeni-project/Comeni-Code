# 2026-10-09 — M4.8b, the workbench

## Where things stand

- **M4.8b is built** on `feat/m4-8b-workbench`, from the agreed spec
  (`docs/superpowers/specs/2026-10-07-m4-workbench-design.md`) and its plan, sub-issues #238–#247
  of #221. The boards S19 Drafts, S3 Workbench and the Settings, Links and Resources boards were
  approved before the build; the build was compared with the committed `.design` boards, which the
  operator confirmed match the canvas.
- **Checked.** 1039 Python tests pass with CI's environment, with mypy, ruff, Django's checks and
  the migration check; the web app's lint, typecheck, 370 tests and build pass in `node:24-alpine`.
- **Walked** in headless Chrome (puppeteer-core over the debugging port; Claude in Chrome was not
  connected) against `runserver` and the production build: an author invited by an invite minted
  in the shell joins and creates a node from Drafts; writes a text block, a try question and a
  callout; adds a resource, a *needs* link; Checks passes everything but the exam pool; four exam
  questions seeded through `POST …/exam`; the checklist passes; Submit; the draft reads *In
  review*, read only; Withdraw reopens it. Opening the draft is one GET; each save one write and no
  refetch; Checks one GET when shown. Light at 1440 and dark compared with the boards (the
  differences are in the spec's notes).

## What changed

- M4.8b.1 (69baa11): the checklist carries Verify's problems; the index its regions.
- M4.8b.2 (24b1425): one edit path — `edits.ts` commands, `useDraftEdit` (scoped, the revision
  read at send time, the answer written into the cache), the drafts module.
- M4.8b.3–4 (a451666, 6528326): Drafts; the workbench page, header, tabs, states and preview.
- M4.8b.5–9 (1595de3, 71e9532, 6f9737d, 0748fa9, bfb7a38): Content, try questions, Settings and
  Links, Resources, Checks and Submit.
- #255 (40b7329): the whole-branch review's findings — clicks during a save in flight, typing lost
  in Settings, refusals lost with their editor, presses that take no focus, the leave warning, the
  Drafts lists, the race test, Reload asking for hidden Checks.
- #256 (0ff8f16), #257 (184ecac): from the walk — a block's text is sent with its last line ended;
  a try option offers no misconception.

## Decisions, and why

The rulings are in the spec's *Notes from the build*. The ones that cost the most to reconstruct:
**a click during a save waits for it** (`useAfterSaves`) rather than being disabled, because the
blur that starts the save comes from that very click; it acts on the blocks where they then are
(`follow`), and does nothing if the save was refused, so the editor keeps the text and the
problem. **The tests share the app's `staleTime`**: the stale Drafts list could not fail in a
client that refetched on every mount. **The stored format beats the plan** where they disagree
(misconceptions on try options). The stubbed tests met neither code-schema rule the walk found;
walking against the API caught both.

## What is next

1. **#258 (protocol)**: adjacent text blocks merge with no paragraph break; the operator chooses
   an option, then it is built (recommended: join with a blank line, and *+ text* beside a text
   block opens that block).
2. The pull request for this branch, merged on the operator's yes; then compact this entry
   (M4.8b closes) and update #74.
3. M4.8c, the exam pool (#222): its brainstorm against the QuestionBuilder board.
4. The deferred minors, listed in the pull request.
