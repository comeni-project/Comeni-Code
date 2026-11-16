# M5.5 — The author assistant: implementation plan

**Goal:** add a private, draft-scoped assistant chat that creates only normal block proposals and
leaves every acceptance with the author.

**Branch:** `feat/m5-5-author-assistant`, stacked on `feat/m5-4-goal-suggestions`. Keep the PR open.

**Spec:** [`2026-11-16-m5-author-assistant-design.md`](../specs/2026-11-16-m5-author-assistant-design.md).

## Sequence

1. Record the bounded scope, transcript privacy and reuse of M5.2 proposals in the part spec.
2. Add private session, turn and action records with ownership and migration constraints.
3. Add typed assistant reply/actions and a versioned prompt; build bounded draft context and recent
   history without private excerpts or unrelated content.
4. Add author-only session create/list/read and message APIs. Validate exact current block targets,
   persist turns, call the `assistant` site once, and create idempotent M5.2 proposals for valid
   actions only.
5. Add Assistant API helpers and the S15 page: select an open draft, resume a session, chat, and
   inspect each proposal through the existing comparison controls.
6. Add focused tests for ownership, stale/closed drafts, bounded history/actions, malformed replies,
   idempotency, proposal privacy and UI Keep/Discard behavior.
7. Regenerate OpenAPI and web types; update diagnostics, docs and journal. Run focused checks here;
   run the full Python and web suites once at the end of M5.
8. Open a stacked PR against M5.4, leave it open, and repair CI failures.

## Boundaries

- No chat calls to learner-facing sites, no unrestricted tools, web retrieval or model-side writes.
- No automatic acceptance, submission, review, landing or publication.
- No edits outside existing block targets; all generated candidates follow M5.2 and M5.3.
- Keep `.env.walk-aside` and other user-local environment files untouched.
