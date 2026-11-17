# 2026-11-16 — M5.3 implemented and locally verified

## Where things stand

- M5.3 is implemented on `feat/m5-3-block-scores`, stacked on `feat/m5-1-gateway`. M5.2 PR #476 is merged into #465's head branch; M5.1 PR #465 remains open. This M5.3 PR is to target that same head branch and stay open for review.
- Python: 1,950 tests pass. Ruff lint/format, mypy (313 source files), Django system check and migration check pass. Web: 971 tests pass with Biome, TypeScript and production build.
- Local checks do not cover the isolated stack; PR CI must still run the stack job.

## What changed

- Added immutable, versioned block rubrics with a typed fresh-call judge. The evaluator sees the validated candidate and approved public references, not the drafting conversation or private excerpts.
- Added bounded redrafting below an operator-set threshold, with attempt history and per-attempt call/model settings. A judge failure leaves the valid proposal available instead of replacing it.
- Bound accepted scores to the exact proposal revision, target and content digest. The author view shows scores, parts, reasons and earlier candidates; Review shows current private scores, sorts low scores first, and marks stale scores when content changes.
- Added a per-reviewer, per-key agree/disagree answer. Scored keys require an answer before approval, including bulk approval.
- Updated T8.2/T8.3, invariant 5, diagnostics, migrations and generated API types.

## Decisions made, and why

- The judge can use the drafter's selected model only through a separate fresh gateway call, as approved in #451. Agreement is recorded independently per reviewer and key.
- Score data remains inside Studio and is not included in learner schemas, landed content or public receipts.
- Live model sign-in is not an acceptance gate, per operator direction.

## What is next

1. Push the branch, open the stacked PR against `feat/m5-1-gateway`, and keep it open. Repair any CI failures.
2. Start M5.4 (#449), learner goal suggestions with a plain-search fallback, on a branch stacked on M5.3.
3. M5.5 (#450), the author assistant, remains the last approved M5 part. M4's first real landing (#324) is still required after M5 and before M7–M9.

## Traps

- `.env.walk-aside` is inherited user-local state; it was not read, changed or staged.
- Vite reports the existing large-chunk advisory; production build succeeds.
