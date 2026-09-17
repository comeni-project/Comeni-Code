# 2026-09-17 — self-tests join the design

**Exams are in v1, as self-tests.** The operator asked for an exam system before freezing the
design: each node has a pool of questions, and at any point a learner can generate an
automatically graded exam from the nodes done so far or from the whole route. It is now T7.1 of
the [tutor spec](../../superpowers/specs/2026-09-17-code-as-tutor-design.md), and it is the
mastery system for v1. This supersedes the same day's decision to defer exams (in
[`2026-09-17-code-as-tutor.md`](2026-09-17-code-as-tutor.md)).

The operator decided; an agent designed and drew.

---

## Where things stand

| Claim | Check |
|---|---|
| The tutor spec holds self-tests: pools, assembly, per-node results, what they are not | `grep -n "### T7.1" docs/superpowers/specs/2026-09-17-code-as-tutor-design.md` |
| Exams are no longer in T12's deferred list; certified exams are | `grep -n "Certified" docs/superpowers/specs/2026-09-17-code-as-tutor-design.md` |
| The architecture spec's M1 holds exam pools in the schema, and M8's *done when* includes a self-test | `grep -n "T7.1" docs/superpowers/specs/2026-09-17-comeni-code-architecture-and-roadmap-design.md` |
| The canvas has 26 boards, including L13 Exam set up and results | `node .design/build_pages.mjs` |
| **The regenerated canvas is still not published** | the operator starts `/design` |

## Decisions made, and why

1. **Self-tests in v1, not deferred.** The pieces already existed: evidence (T7), the review
   engine, and scored drafting. Exams give *known* a real check. **Rejected:** deferring past
   v1 (the earlier answer), and certified exams (unsupervised tests prove nothing to others).
2. **Results per node, never a grade.** The results are confirmed, shaky and not yet, drawn on
   the metro map. Confirmed spends no colour, shaky is amber and not yet is red, which keeps
   invariants 10–12.
3. **Separate exam pools of 4–6 questions**, seeded where possible, so a test never replays the
   page's inline checks and retakes differ. A node without a reviewed pool is left out, and the
   setup page names it.

## What is next

1. The operator publishes the canvas (`/design`).
2. Resume M0 with part 3.

## Open questions

The tutor spec's T14 questions 6 and 7: the pool size and the confirmed rule, and whether *not
yet* returns a node to the route without asking.

## Traps

- **A self-test is not placement.** Placement (L2) asks one question per candidate node, before
  a route starts. A whole-route self-test is placement at depth, but it uses exam pools.
- **Exam pools are not `try` checks.** Keep them separate, or exams replay what the learner just
  read.
