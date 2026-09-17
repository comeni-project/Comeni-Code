# 2026-09-17 — exam questions built like pages, and who Code is for

Two additions from the operator after self-tests were merged. Both are small, and neither changes
the tutor loop.

---

## Where things stand

| Claim | Check |
|---|---|
| Exam questions are block documents built in the same editor as a page | `grep -n "Authoring questions" docs/superpowers/specs/2026-09-17-code-as-tutor-design.md` |
| The audience is stated: university students and researchers; Khan Academy serves school-age learners | `grep -n "Who Code is for" docs/superpowers/specs/2026-09-17-code-as-tutor-design.md` |
| The canvas has 27 boards, including S3 Exam pool (question builder) | `node .design/build_pages.mjs` |
| The current canvas is published | https://claude.ai/artifact/WGDwxV8gHZwSxyzSQAJKPa (republished with the new board) |

## Decisions made, and why

1. **Questions are built like pages** (operator: "cms style building of questions, with images,
   diagrams etc."). A question has:
   - a stem made of the same blocks as a page (text, figure, image, math, table, code,
     sequence);
   - an answer type: choice with options that can hold figures or images, number, sequence,
     figure interaction, or order;
   - optional seeded variants, checked across 20 seeds;
   - distractors mapped to misconceptions, so a wrong answer can step back;
   - a rationale shown only in the results.

   **Rejected:** a plain text-and-options form, which cannot hold the diagrams bioinformatics
   questions need.
2. **Audience** (operator): Khan Academy is mainly for children and teenagers getting into
   college; Code is for university students and researchers. The operator then narrowed it:
   **this shapes page content, not the overall design**. AP-level nodes stay, as catch-up
   written for adults. This restates the first spec's §4 learner; it is not a change of
   direction.

## Traps

- **A stem figure must not give the answer away.** The question-builder board first reused a
  figure with its labels on (*bubble*, *tip*) and error colours. Exam figures are drawn with
  labels off and neutral colours.
- **Audience ≠ interface.** Don't redesign screens for "researchers". The screens already are;
  the note is about how nodes are written.

## What is next

Resume M0 with part 3 (Ninja API and health route).
