# 2026-11-16 — M5.4 goal suggestions implemented

## Where things stand

- M5.4 is implemented on a branch stacked on M5.3. M5.3 PR #477 remains open and all three CI jobs pass. M5.4 publication follows after this entry; M5.5 is the remaining M5 part.
- Focused Python checks: 30 passed across goal suggestions, plain search and repository path documentation. Ruff, mypy, Django checks and migration check pass. The full Python suite is deferred until the end of M5 per operator direction.
- Web lint, strict TypeScript, the full web test suite and production build pass.

## What changed

- Added anonymous `POST /api/goals/suggest`, using the declared `goal-suggestions` gateway site and a versioned prompt. The model chooses up to three IDs from a deterministic search set plus its human-authored related peers; the API resolves every returned ID against that set and current index records.
- Missing configuration, cap, provider errors, malformed output, and invalid IDs use the existing plain-search result. Queries are capped at 240 characters. Gateway records remain anonymous and store no query or reply.
- Wired Start's explicit submit action to goal suggestions. Results remain unselected cards, the learner still confirms each target, and route computation remains deterministic. Re-submitting the same query asks again.
- Updated diagnostics, OpenAPI, generated web types, the current state page, and the spec index.

## Decisions made, and why

- Candidates come from lexical search plus indexed `related` links, not free-form model output. This follows W3.3's human-reviewed peer set and keeps the model from inventing target nodes.
- The learner sees normal search results when the model refuses or returns unusable data. AI availability does not become a prerequisite for Start.

## What is next

1. Open a PR stacked on M5.3 and leave it open; address CI.
2. Complete M5.5 (#450), the author assistant, then run the full Python and web suites once at the end of M5.
3. M4's first real landing (#324) remains required after M5 and before M7–M9.
