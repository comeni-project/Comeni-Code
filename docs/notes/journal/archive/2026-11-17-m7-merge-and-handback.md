# 2026-11-17 — Codex hands back; M5 and M7 merged into `main`

## Where things stand

- `main` holds M5 and M7: the stack #465 → #498 merged bottom-up at `6b81fcd`, each PR retargeted
  to `main` on its green checks (`gh pr list --state merged --limit 12`). CI on `main` passed.
- Part issues #447–#450 and #485–#494 are closed citing their PRs. Still open: #445 (M5), M5.2's
  steps #466–#475, #481 (M7), #496 (integration), until checked against their *done when*.
- Branch `feat/m7-acceptance`: #499's fix and a request-to-approved-draft test.

## What changed

- `f890e8d`, `4166d4c`: Codex's uncommitted integration work, committed as found, with one test
  fix (`exact` is not a `getByRole` option). PR #498.
- `ac62d04`: a refused reviewer assignment names the reviewer role (#499).
- `b72f2ca`: one test walks intake, triage, assignment, a new node's draft, submission, the
  reviewer's answers and verdicts, and approval; the receipt says approved, never live.

## Decisions made, and why

- **The operator moved browser walks to the end**: build everything, then walk and fix in rounds.
- **The operator approved merging the whole stack** rather than stacking M8 on twelve open PRs.
- Migrations 0018 and 0019 stay two files; merging them could strand a database that applied 0019.

## What is next

1. The fresh review of M7's diff; issues for what it finds.
2. M8's parts list, with learner identity, M4E.7's self-test questions and `step_back_to` put to
   the operator first.

## Open questions

- Where the local `.env` went. Only an older `.env.walk-aside` remains. The GitHub App's key and
  `CODE_SETTINGS_KEY` may need reissuing before M4.9d; keys saved on the AI page with the old
  settings key cannot be read.

## Traps

- M7's part specs are about 20 lines and its plans about 8; no approval of them is recorded on the
  issues. Read the code, not the plans, for what M7 does.
