# Comeni Code documentation

Comeni Code is building its skeleton (phase M0). The documentation is four things: the
decisions, the screens, the research the decisions rest on, and the record of how they were
reached.

| Book | What it is | Start with |
|---|---|---|
| [Specs](superpowers/specs/) | The design documents. Each records what was decided and what was rejected. | [the tutor spec](superpowers/specs/2026-09-17-code-as-tutor-design.md) (the current statement of the product), then [the architecture spec](superpowers/specs/2026-09-17-comeni-code-architecture-and-roadmap-design.md) |
| [Plans](superpowers/plans/) | One implementation plan per part of a phase. | the newest plan |
| [Design](design/) | How the screens are drawn, rebuilt and published. | [design/README.md](design/README.md) |
| [Notes](notes/) | Dated, append-only records of working sessions, and the research decisions rest on. | [the journal](notes/journal/) — newest entry first; [research](notes/research/) |

**When two documents disagree, the newer spec wins**, and the older one says so where it has been
superseded. When a spec and the code disagree — once there is code — the code is right and the
spec needs a new decision.

Guides for learners and authors, reference for the content API, and internals for the platform
will be added as each part is built. Until then, a page that describes something unbuilt would
be a promise, and this repository prefers not to make those.
