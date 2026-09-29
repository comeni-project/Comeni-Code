# 2026-09-17 — Code becomes the tutor on top of what exists

**The product changed direction, not its core.** After a study of Khan Academy, the operator
decided that Code complements it rather than competing. Code organises the best existing
teaching into the right order for a learner's goal, checks what they know, and takes them back a
step when an answer shows a gap. Nodes with *needs* links, and routes computed from them, are
still the core. **M0 is paused after part 2** and resumes with part 3, which this does not
change.

The operator made every decision; an agent researched, proposed and drew.

---

## Where things stand

| Claim | Check |
|---|---|
| A fourth spec is the current statement of the product | `docs/superpowers/specs/2026-09-17-code-as-tutor-design.md` |
| Every older spec points at it where it changed something | `grep -n "tutor spec\|code-as-tutor" docs/superpowers/specs/2026-09-*.md` |
| CLAUDE.md carries the new model paragraph, changed invariants 5–8 and 10, a new invariant 13, and new words | `grep -n "^13\." CLAUDE.md` |
| The research report is kept in the repo and published on the operator's current account | `docs/notes/research/2026-09-17-khan-academy.html`; https://claude.ai/artifact/KVwAqX8WTHo2in8124PCDA |
| The canvas has 24 boards: 4 new (L2 Placement, S6 Review, S11 Quality, S18 Skeletons) and 4 revised (L5 Node, L4 Route, S3 Workbench, S17 AI) | `node .design/build_pages.mjs` |
| **The regenerated canvas is not published yet** | the operator starts `/design`; an agent cannot |
| Checks pass | `uv run pytest` |

## What changed this session

On branch `docs/code-as-tutor`:

- **Research:** Khan Academy's philosophy, anatomy, mastery system, Khanmigo, evidence,
  licences and terms, with sources. It was published first on the operator's earlier account
  (https://claude.ai/artifact/7NS7vE6rhvmMMKEHryt3WY), then on the current one.
- **The tutor spec**, plus pointers in the 2026-09-02, 2026-09-16 and architecture specs. The
  architecture spec's R8 gained the shared sign-in question from Labs, which was pending since
  the M0 kickoff.
- CLAUDE.md, README, the docs map, the notes and design READMEs.
- The generator and boards.

## Decisions made, and why

In the order they were made. The spec holds the rejected alternatives.

1. **Complement Khan Academy, don't compete.** The operator's own conclusion after asking for the
   research: a small team cannot out-write it, and trying would repeat its bottleneck.
2. **The operator's framing: Code is "the tutor they never could be"** — organising information
   the way Google did, and winning on presentation. It became T1.
3. **Nodes point outward** (`resource` blocks), **embedded and linked** (operator: "embed and
   link").
4. **Skeletons.** The operator first proposed extracting Khan Academy's course outlines
   automatically. The agent pushed back: Khan Academy's terms forbid scraping and using its
   content to build AI, and its API closed in 2020. The same skeleton comes from the College
   Board framework it follows, and from OpenStax and Galaxy Training (CC BY). The operator
   agreed: AI drafts only from those; people use Khan Academy as a reference and as resources.
5. **Mastery levels deferred.** The operator was unsure. The agent recommended *known* plus
   stored evidence, so levels, decay and exams can be derived later without migration, and the
   operator agreed.
6. **Learner chat and exams deferred past v1** (operator).
7. **AP-level prose accepted** (operator).
8. **Block scores** came from a colleague of the operator: a separate agent rates each block,
   redrafts below x, and deploys above y. Agreed shape:
   - the judge is a different model family from the drafter;
   - deterministic checks come first;
   - redrafts are bounded;
   - reviewers filter by score and record whether the score was right;
   - **automatic deployment is deferred** until judge–human agreement is measured, and then
     only for low-risk block types.

## What is next

1. **The operator publishes the canvas** with `/design` from `.design/` (it was regenerated
   this session).
2. **Answer the exam question the operator raised at the end of the session** (below) and,
   if agreed, add it to the tutor spec and draw L13.
3. **Resume M0 with part 3** (Ninja API and health route). Its objective and check are restated
   in [`2026-09-17-m0-part-2-django-project.md`](2026-09-17-m0-part-2-django-project.md).

## Open questions

- **Exams as self-tests** (raised at the end of the session): each node holds a pool of
  auto-graded questions, and a learner can generate an exam at any point from the nodes done so
  far or from the whole route. It would change T7 and T12 (exams are deferred there), so it
  waits for the operator's decision.
- The tutor spec's T14.
- R8, including the shared sign-in with Labs.

## Traps

- **Published canvas and report URLs belong to two accounts.** The first canvas
  (https://claude.ai/artifact/RxgqwSDJ2N3UTSg4HUotxJ) and the first report are on the earlier
  account; the regenerated report is on the current one. The generator is the source, never a
  published copy.
- **Khan Academy's terms page could not be read by an automated reader.** T5.3 requires a
  person to read it before the first embed.
- **"Skeleton" is not a track.** A skeleton proposes nodes and *needs* links. Tracks come only
  from the weaver.
- **Scores are Studio-only.** Showing one to a learner breaks invariant 10.
