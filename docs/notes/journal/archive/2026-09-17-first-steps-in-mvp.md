# 2026-09-17 — First steps is in the MVP

**The operator put the First steps level in the MVP**, answering tutor spec T14 question 8
against the agent's recommendation to defer it.

## Where things stand

| Claim | Check |
|---|---|
| T10.2 says First steps is in the MVP, with a design round before M3 and a few First steps nodes under the Salmon route | `grep -n "First steps is in the MVP" docs/superpowers/specs/2026-09-17-code-as-tutor-design.md` |
| The architecture spec's M3 *done when* includes a First steps node page | `grep -n "First steps" docs/superpowers/specs/2026-09-17-comeni-code-architecture-and-roadmap-design.md` |

## Decisions made, and why

1. **First steps in the MVP** (operator). **Rejected:** deferring it (the agent's
   recommendation: the Salmon demo didn't need it, and it brings interface work).
2. **What that commits to** (agent, following T10.2):
   - a First steps design round before M3;
   - a few First steps nodes under the Salmon route.

   Under-13 accounts still wait for the consent spec, because learning without an account
   already works.

## What is next

1. Draw levels on the boards (L4, L5, L12, S2, S3), including a First steps node page, then
   republish the canvas.
2. Resume M0 with part 3.

## Traps

- **"In the MVP" does not mean under-13 accounts.** Those need the consent spec (R8).
