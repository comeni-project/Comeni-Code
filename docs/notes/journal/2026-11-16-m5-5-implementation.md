# 2026-11-16 — M5.5 author assistant implemented

## Where things stand

- M5.5 is implemented on `feat/m5-5-author-assistant`, stacked on M5.4. M5.4 PR #478 has all three CI jobs green; M5.5 PR publication follows full-suite verification.
- Focused assistant API/OpenAPI checks pass (10 tests); the browser assistant flow passes (1 test). Django checks, migration consistency, Ruff, mypy, web lint, TypeScript and production build pass.
- Full Python suite: 1,973 passed. Full web suite: 973 passed across 103 files. Both were run once at the end of M5 as requested.

## What changed

- Added private draft-scoped assistant sessions, turns and action records. The author-only API bounds messages and history, sends only current draft context to the configured assistant gateway, validates every action against existing blocks, and creates normal idempotent M5.2 proposals.
- Added the Studio Assistant page for open draft selection, session continuation, chat and proposal review through existing DraftAI comparison and Keep/Discard controls.
- Added CA0410 for concurrent/running assistant-turn conflicts, generated OpenAPI and web API types, and added focused API and browser tests.
- Added M5.5's spec and implementation plan.

## Decisions made, and why

- V1 attaches conversations to one open draft and proposes replacements for existing supported blocks only. This keeps every change within the revision-bound M5.2 proposal and M5.3 scoring path.
- Assistant text remains private to its session and is omitted from gateway call records. The model cannot save, approve, submit or land a change.

## What is next

1. Commit M5.5 and open a PR stacked on #478; leave it open and address CI.
2. M5 has no remaining parts after M5.5. M4's first real landing (#324) remains required before M7–M9.
