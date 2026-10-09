# 2026-10-09 — M4.8c, exam questions as the board draws them: the build

## Where things stand

- **M4.8c is built** on `feat/m4-8c-exam-questions`, stacked on `docs/m4-8c-exam-questions-spec`
  (the agreed spec and plan), for #222. The builder screen is M4.8d (#263).
- **Checked.** 1097 Python tests with CI's environment, ruff, mypy, Django's checks, the migration
  check and `code-schema validate`; the web app's lint, typecheck, 383 tests and build.
- **Walked** against `runserver` and the production build (the spec's notes): every step of
  *done when*.
- **Migration `content.0009`** gives the index's question tables their new columns; run
  `rebuild_index` after it, or the exam rows have no title or stem.

## What changed

- M4.8c.1 (c2b2ba5): sequence and order answers, plain options, distinct options, a score.
- M4.8c.2 (5ea44e6): the `:::{sequence}` block.
- M4.8c.3 (3e55967): an exam question's title, claim and block stem; TPM's pool of six.
- M4.8c.4 (5816fe6): the index's columns, by migration 0009.
- M4.8c.5 (d534aea, ba20fde): what the API sends — stems as blocks, a question's state, the new
  kinds to learners and review; the de Bruijn fixture's sequence block and tries.
- M4.8c.6 (b9a05e4): what the API takes.
- M4.8c.7 (9e6ae67): the learner's sequence and order tries; the sequence block drawn.
- M4.8c.8 (3d09932): the workbench edits sequence blocks and counts approved questions.
- #264 (ec9c07c): the review's findings — stems YAML can write (CS0823), the order control's
  focus, an order's key in review. Minors deferred to #265.

## Decisions, and why

In the spec (M4Q.1–M4Q.7) and its notes. In the build: an order is given as step texts, so no
index ever shows the right order; a question's state is compared with the live index on each
draft GET, never stored; a stem that YAML cannot write as a literal block is refused rather than
rewritten (CS0415's rule, applied to stems).

## What is next

1. Push the spec branch and this one; the pull request on the operator's yes (`Closes #222`).
2. M4.8d, the exam pool's builder (#263): its spec against the QuestionBuilder board.
