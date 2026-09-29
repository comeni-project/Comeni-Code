# Comeni Code documentation

What is true today is [`notes/now.md`](notes/now.md). Beyond that, the documentation is five
things: the decisions, the plans that built them, the screens, how work is run, and the record of
how it was reached.

| Book | What it is | Start with |
|---|---|---|
| [Specs](superpowers/specs/) | The design documents. Each records what was decided and what was rejected. | [the tutor spec](superpowers/specs/2026-09-17-code-as-tutor-design.md) (the current statement of the product), then [the architecture spec](superpowers/specs/2026-09-17-comeni-code-architecture-and-roadmap-design.md) |
| [Plans](superpowers/plans/) | One implementation plan per part of a phase; finished ones in `archive/`. | the newest plan |
| [Design](design/) | How the screens are drawn, rebuilt and published. | [design/README.md](design/README.md) |
| [Internals](internals/) | How work is run: issues, labels and decisions. | [internals/walking.md](internals/walking.md) |
| [Notes](notes/) | What is true now, the append-only journal, and the research decisions rest on. | [now.md](notes/now.md); [research](notes/research/) |

**When two documents disagree, the newer spec wins**, and the older one says so where it has been
superseded. When a spec and the code disagree, the code is right and the spec needs a new decision.

Guides for learners and authors, and reference for the content API, will be added as each part is
built. Until then, a page that describes something unbuilt would be a promise, and this repository
prefers not to make those.
