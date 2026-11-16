# M5.3 — Block scores: implementation plan

**Goal:** score valid M5.2 proposals with versioned rubrics, perform bounded redrafts, present
score history to authors and reviewers, and collect per-reviewer agreement.

**Branch:** `feat/m5-3-block-scores`, stacked on `feat/m5-1-gateway` (M5.1 and M5.2). Keep the PR
open for review; do not merge it.

**Spec:** [`2026-11-16-m5-block-scores-design.md`](../specs/2026-11-16-m5-block-scores-design.md).

## Sequence

1. [x] **Update the product contract.** Amend invariant 5 and T8.2–T8.3 for #451, update the M5.3
   decision, and link the part spec from the spec index.
2. [x] **Define versioned rubrics and typed replies.** Add closed schemas for score parts, an immutable
   rubric registry, prompts, and refusal/shape diagnostics.
3. [x] **Persist evaluation history.** Store per-attempt candidate digest, score, rubric version, model
   settings, and call references; bind the accepted final score to its revision and target.
4. [x] **Add bounded judging to the proposal worker.** Validate first, call the judge with a fresh
   context, retain valid attempt history, and redraft below threshold no more than `N` times.
5. [x] **Expose score history to the author API.** Return rubric parts and attempt summaries from the
   existing proposal endpoints, without exposing private prompts, excerpts, or raw messages.
6. [x] **Add operator settings.** Persist and validate threshold and redraft limit for the evaluation
   site; expose them through AI settings and the existing Models page.
7. [x] **Show score and attempt comparison.** Extend the Draft AI proposal comparison states with final
   score, parts, reasons, prior attempts, unscored and judge-stopped states.
8. [x] **Connect scoring to Review.** Add private score summaries to review schemas, sort low scores
   before unscored blocks, and remove the existing placeholders.
9. [x] **Record reviewer agreement.** Extend the existing verdict answer for scored keys, preserving
   each reviewer's answer independently; include it in review read-back only.
10. **Close out.** Update OpenAPI/types, docs, journal and this checklist; inspect the diff and open
    a PR against `feat/m5-1-gateway`.

## Boundaries

- No score reaches learner schemas, landed content or public receipts.
- No automatic draft acceptance, live model sign-in, M7 skeleton scoring or Quality dashboard.
- Never stage `.env.walk-aside` or other user-local environment files.
- CI runs the required Python, web and stack checks after publication; the PR remains open.

## Acceptance checks

- Gateway records show separate page-drafting and block-evaluation calls for every attempt.
- Scores are typed, tied to the exact content and rubric, and do not survive content changes as
  current scores.
- A low score causes at most `N` new draft calls; zero disables redrafting.
- Judge receives no requester instructions, private excerpts, or drafting conversation.
- Only public source references and the approved candidate are supplied to the judge.
- Queue ordering is deterministic for scored, unscored, and tied drafts.
- Reviewer agreement is per review and key, with old reviews still readable.
- Existing proposal acceptance, provenance and learner API privacy remain intact.
