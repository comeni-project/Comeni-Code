# 2026-10-09 — M4.8c, exam questions: the split and the spec

## Where things stand

- **M4.8 is four slices now** (agreed with the operator): M4.8a sign-in and the team (#220, done),
  M4.8b the workbench (#221, done in #259), **M4.8c exam questions as the board draws them, the
  format** (#222), and **M4.8d the exam pool's builder** (#263, new). The exam pool did not fit one
  part once the format had to grow to the board (R5).
- **The M4.8c spec is agreed**: `docs/superpowers/specs/2026-10-09-m4-exam-questions-design.md`, on
  `docs/m4-8c-exam-questions-spec`. Its plan comes next.
- **#262** records the Rosalind/Euler-style `problem` block (M6), raised by the operator: designed
  in the 2026-09-02 spec §5.1.1 and W5.1, not built.

## Decisions, and why

All with the alternatives rejected in the spec (M4Q.1–M4Q.7). The operator's rule for the part:
**the boards are the truth, not the code** — the format grows to the QuestionBuilder board's M4
scope rather than the board being cut to the format. With the operator, one question at a time:
the split (format, then screen); a question's *approved / draft* derived from the live version;
the claim as free text (a quoted phrase was too mechanical); wrong options marked `plain` on
purpose, never random, and three options at least in an exam; forgiving `sequence` matching;
**order with partial credit, by pairs in order**; stems from the page's blocks plus a new
`sequence` block; a stem stored as MyST text inside `exam.yaml`.

## What is next

1. The M4.8c plan, then its build, test-first.
2. M4.8d's spec against the QuestionBuilder board, once M4.8c is merged.
