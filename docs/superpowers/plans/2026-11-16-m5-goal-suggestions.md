# M5.4 — Learner goal suggestions: implementation plan

**Goal:** wire the declared learner goal-suggestions site into Start, validating model output
against human-reviewed node candidates and falling back to deterministic search.

**Branch:** `feat/m5-4-goal-suggestions`, stacked on `feat/m5-3-block-scores`. Keep its PR open.

**Spec:** [`2026-11-16-m5-goal-suggestions-design.md`](../specs/2026-11-16-m5-goal-suggestions-design.md).

## Sequence

1. [x] Record the bounded behavior, privacy rules and candidate-set decision in the part spec.
2. [x] Add a versioned prompt and closed reply schema for selecting candidate IDs.
3. [x] Build candidates from deterministic search and their indexed `related` links; resolve model IDs
   only against that set and return current ordinary result records.
4. [x] Add the anonymous API endpoint and silent deterministic fallback for all gateway refusals or
   invalid replies.
5. [x] Wire Start's submit action to the endpoint without changing URL/selection/route semantics.
6. [x] Add tests for candidates, invalid IDs, every fallback, anonymous records, and Start interactions.
7. [x] Regenerate OpenAPI and web types; update diagnostics, docs and journal; run focused checks. The full suite is deferred to the end of M5 as requested.
8. Open a stacked PR against `feat/m5-3-block-scores`, leave it open, and repair CI failures.

## Boundaries

- No route selection or ordering by the model; no auto-selected goals.
- No free-form node IDs, generated reasons, conversation history or stored learner identity.
- No new screen, authoring path or content graph writes.
- Keep `.env.walk-aside` and other user-local environment files untouched.
