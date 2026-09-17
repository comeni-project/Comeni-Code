# 2026-09-16 — the design before the code

**Tracks are no longer authored; they are woven.** A learner states a goal, it resolves to one to
three target nodes, and the route is a walk over the nodes' declared *needs* links. Every key
learner and Studio page has been drawn — most of them twice, after critique and research — in a
visual identity now shared with Comeni Labs, and the repository has the foundations an open-source
project needs. **There is still no code and no implementation plan.**

The operator directed the session and made every decision below; an agent researched, drafted and
drew.

---

## Where things stand

| Claim | Check |
|---|---|
| Two specs; the newer one wins where they disagree | `ls docs/superpowers/specs/` |
| The 2026-09-02 spec points at the new one wherever it was superseded | `grep -n "2026-09-16" docs/superpowers/specs/2026-09-02-comeni-code-design.md` |
| The design canvas is generated, not hand-edited | `node .design/build_pages.mjs` rebuilds 20 boards and `canvas.json` |
| Learning content is CC BY 4.0, code is Apache-2.0 | `LICENSE-CONTENT.md`, `LICENSE` |
| Contributing, conduct, security and templates exist | `ls .github .github/ISSUE_TEMPLATE CODE_OF_CONDUCT.md` |
| Nothing is pushed | `git log origin/main..docs/seed-repository --oneline` |

The canvas was also published as private design artifacts on the operator's account (the page set,
the five theme directions, and Labs redrawn in the hybrid style). They are views of `.design/`, not
sources; rebuild from the generator rather than editing them.

## What changed this session

All on branch `docs/seed-repository`:

- `5a4a3cb` — **the second spec**, `2026-09-16-comeni-code-weaving-and-pages-design.md`, and the
  edits to the first that point at it (§6.1 superseded, vocabulary, the v1 slice, the content
  licence decided).
- `7a61b35` — **the design canvas**: the five 2026-09-02 artboards removed; `.design/_identity.mjs`
  (tokens and identity boards) and `.design/build_pages.mjs` (every page) added, with their output.
- The commit that adds this entry — **the repository seed**: README, CHANGELOG, CITATION.cff,
  CODE_OF_CONDUCT.md (Contributor Covenant 3.0), LICENSE-CONTENT.md, `.editorconfig`,
  `.github/` (contributing, security, pull-request and issue templates), `docs/index.md`,
  `docs/notes/`, `docs/design/`, the specs README, `.design/README.md`, and `CLAUDE.md`.

## Decisions made, and why

In the order they were made. Each is in the 2026-09-16 spec with its reasoning; this is the
sequence and what was rejected.

1. **A small invited team writes content**, not open contribution and not course instructors — it
   keeps Studio to roles and review without moderation.
2. **The front door is a goal**, not the map — *What do you want to learn?*, then a route preview,
   then optional placement.
3. **Commands run on the learner's machine**; no in-browser sandbox in v1.
4. **Visual identity: the hybrid.** Five directions were drawn (Observatory, Bench notebook,
   Wayfinding, Gel & stain, Friendly). The operator preferred Friendly; the agent first advised
   keeping Labs on Observatory with a shared core, then reversed after measuring Labs' own labels
   (9.5 px, about 4.1 : 1 contrast) and colour-only status against WCAG. The result takes
   Friendly's legibility, Observatory's precision, and a core shared with Labs. Adopting it in Labs
   is Labs' decision.
5. **Tracks are woven.** The operator corrected the agent's summary of the product: nodes are the
   product, tracks are woven from goals. The route is a deterministic walk; AI proposes targets,
   links and connecting text. Rejected: *fully live per-learner weaving with no review* (breaks
   "a human must see it") and *published tracks only* (learners could only learn what was already
   woven).
6. **Three link kinds** — needs, goes deeper, related — chosen over *needs only*.
7. **A goal is one to three targets**, not exactly one and not free-form.
8. **Routes are shared once reviewed.**
9. **Requests move only when a person decides** — the operator's addition to the weaving model.
10. **A node is one page with inline questions**, at university level. A stepped-screens-first
    design was drawn and rejected by the operator as oversimplified for students and researchers.
11. **Routes are drawn as metro maps that branch and merge.** A box-and-arrow graph was drawn and
    rejected as ugly; the metro form handles branching.
12. **Home shows the last opened route**; the whole network lives on *Your knowledge*, which also
    handles areas that share no nodes.
13. **Content is typed blocks written through a CMS-style API** (Markdoc, Portable Text), so
    figures are components filled with data and images carry licences.
14. **AI follows Labs**: three lanes through one LiteLLM gateway, declared call sites only,
    learners never chat, and an assistant that acts only through the content API.
15. **Studio's editor surfaces were rebuilt after research**: queues as triage tools (Linear),
    the workbench on CMS patterns (Wagtail, WordPress, Sanity, Storyblok, Contentful), the figure
    composer data-first (Datawrapper, Flourish, Storybook), the graph editor search-first around a
    neighbourhood view (Ghoniem et al., Neo4j Bloom, WebProtégé), with a switch to the learner's
    metro view.
16. **Repository**: content under CC BY 4.0; the Code of Conduct reports through GitHub's private
    reporting form; the citation names the comeni-project contributors; work lands on a branch in
    three commits.

## What is next

In this order, because each depends on the one before:

1. **Review and merge this branch.** Push it and open a pull request; the three commits are meant
   to be read in order.
2. **Enable private vulnerability reporting** in the repository settings. `SECURITY.md` and the
   Code of Conduct both point at it, and the link does nothing until it is on.
3. **Write the implementation plan**, starting where W11.2 of the spec says: the node schema and
   the weaver as a pure, tested function with a CLI. It needs no UI and settles the model.
4. **Add a documentation check to CI** once there is a toolchain — link checking at least.
   Deliberately not added today: pinning GitHub Actions needs verified commit SHAs, and a workflow
   with nothing to check is noise.
5. **Draw the remaining pages** when they are next to be built: placement, problem, review,
   weekly, from Labs, inbox, review (Studio), quality.

## Open questions

The spec's W13 list is the full set. The ones this session made more pressing:

- **Which inline questions count toward settling a node** — all, or only the problem.
- **How a partial route behaves when the graph changes mid-route.**
- **Where content lives** — files in git or a database (first spec, §10.6). W5.2's API makes
  either possible; the decision is still open.
- **A dedicated conduct contact.** GitHub's private reporting form is shared with security reports.

## Traps

- **The boards are generated.** Editing a `.dc.html` by hand is lost on the next rebuild; change
  `.design/build_pages.mjs` or `.design/_identity.mjs`.
- **All numbers on the boards are samples** — learner counts, costs, percentages. Names in
  brackets are placeholders. None of it is data.
- **"Track" changed meaning.** In the 2026-09-02 spec a track was authored; now it is a woven route
  that has been reviewed. Read §6.1 there as history.
- **The first spec's §8.1 slice is restated, not replaced**: the v1 slice is two goals that share
  nodes (*learn STAR* and *learn Salmon*).
- **The boards break one of the spec's own rules.** W10 says nothing is smaller than 11 px; the
  map annotations on the boards are 10–10.5 px. Fix the generator, not the rule.
- **The spec's section numbers moved** when W9 (AI) was added: identity is W10, order of work W11,
  the slice W12, open questions W13.
