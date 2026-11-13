# 2026-11-09 — M6.7 merged; M6.8: boards, the split, M6.8a's spec

## Where things stand

- **M6.7 is merged**: PR #422 (merge commit `8135943`), closing #334 and #417–#420, its checks
  green (`gh pr checks 422`). Its minors stay in #421.
- **M6.8's boards** are on a canvas of their own, https://claude.ai/artifact/NQcPg7GbVi5pEAhJeszewF
  (three boards from `.design/build_pages.mjs`: `nodeProblem`, `benchProblem` in the workbench's
  Problem tab, `benchProblemNew`), committed on `feat/m6-8a-learner-problem` (`7bc6d72`).
- **M6.8a's spec** is written (`docs/superpowers/specs/2026-11-09-m6-learner-problem-design.md`,
  M6LP.1–M6LP.8), waiting for the operator's approval. No plan, no code.

## M6.8 is two parts

| Part | Issue | What |
|---|---|---|
| **M6.8a** the learner's problem | #423 | the block on the node page (L6), a seed per browser, the dataset download and the answer endpoint, feedback from the kit's sentence and mapped callouts |
| **M6.8b** the problem builder | #424 | the workbench's Problem tab (S5): a form over `problem.yaml`, params from the kit's schema, Edit as YAML; save is the server's check |

The learner's part first: it finishes the de Bruijn page with the fixture's problem, which M6's
*done when* needs, and the builder then has a page to preview against. Both are sub-issues of #335.

## Decisions made, and why

- **Boards first, then fixed after the operator asked to check them visually**: Given and Return
  were monospace boxes (they are prose); the block tag read `{% problem %}` (it is
  `:::{problem}`); at 390 px the title squeezed beside its tag, a file name broke mid-word and the
  answer's placeholder ran out of its box; Studio's preview claimed 81 lines under a 4-line sample
  and Checks showed 3 beside a passed self-test.
- **A kit stays Python, written by a developer and reviewed** (operator: "its fine … we will do it
  later"). Asked how an author adds a mistake or a kind of dataset: today they can't from Studio;
  a mistake is what a kit's checker knows, a dataset what its params allow. Two ideas went to #425,
  deferred: mistakes declared in the problem file as settings of solver switches, matched exactly;
  and the M5 assistant drafting a kit as a pull request. A rule language in Studio was rejected.
- **No % solved or solutions** on the boards: they need learner records (M8).

## What is next

1. The builder check's questions over M6.8a's spec, then the operator's approval.
2. M6.8a's plan, test-first, then the build, a walk on the Compose stack, a fresh review.
3. M6.8b's spec (#424), from its two boards.

## Open questions

- A rate limit on the learner's answer and download endpoints before the site is public.

## Traps

- **The workbench board takes `view.h` and `view.checks`** now; other boards keep 1060 and 3.
- **A canvas from the Design type needs `<title>`, `lang` and a `data-dc-script` block** added to
  each generated board; the generator writes none (`docs/design/README.md`).
