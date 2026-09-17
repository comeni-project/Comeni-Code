# Comeni Code

**The learning platform of the [comeni-project](https://github.com/comeni-project).** Say what you
want to understand — a tool like Salmon, a method, a problem with your reads — and Code builds a
route to it from standalone, reviewed pages, each of which says where its claims come from. Code
is **the tutor on top of what already exists**: it puts the best existing teaching (Khan Academy,
OpenStax, Galaxy Training, the Carpentries) in the right order for your goal, checks what you
know, and takes you back a step when you need it. It is built for **self-directed learners at
every level**: each page has a level from *First steps* to *Advanced*, so a route reaches as far
down as you need and as far up as research.

> **You learn the thing you are about to run, and every sentence says where it came from.**

**Status: building phase M0 (the skeleton).** The Python workspace, the purity guards and the
Django project exist; there is no learner-facing feature yet. Read the specs and the newest
journal entry before proposing code.

## The idea in five lines

- **Organise, don't out-write.** Nodes point to the best existing videos and readings; the
  first nodes are drafted from public course outlines. Nothing is scraped or copied.
- **Nodes are the product.** One topic per page — *k-mers*, *de Bruijn graphs*, *Salmon* —
  written once, checked by a person, reused by every route that needs it.
- **Routes are woven, not authored.** A goal resolves to one to three target nodes, and the
  route is computed by walking each node's declared *needs* backwards. No model chooses it.
- **AI drafts; people approve.** Models draft pages, figures and the short text that connects a
  route, and a separate judge model scores each draft so reviewers look where it matters.
  Nothing a model writes reaches a learner unreviewed without saying so, and nothing leaves the
  request queue without a person.
- **It ends in a real pipeline.** A route can finish by running the analysis in
  [Comeni Labs](https://github.com/comeni-project/Comeni-Labs).

## Where to read

| If you want | Read |
|---|---|
| **What Code is now: the tutor on top of existing material** | [`2026-09-17-code-as-tutor-design.md`](docs/superpowers/specs/2026-09-17-code-as-tutor-design.md) |
| The research behind it (Khan Academy's strengths and weak spots) | [`docs/notes/research/`](docs/notes/research/) |
| Why this exists, and why two earlier attempts at it died | [`2026-09-02-comeni-code-design.md`](docs/superpowers/specs/2026-09-02-comeni-code-design.md) |
| How routes are woven, every page, figures, AI use, the visual identity | [`2026-09-16-comeni-code-weaving-and-pages-design.md`](docs/superpowers/specs/2026-09-16-comeni-code-weaving-and-pages-design.md) |
| The stack and the order it will be built in | [`2026-09-17-comeni-code-architecture-and-roadmap-design.md`](docs/superpowers/specs/2026-09-17-comeni-code-architecture-and-roadmap-design.md) |
| Where things stand today | [the newest journal entry](docs/notes/journal/) |
| The screens | [`docs/design/`](docs/design/) and the generator in [`.design/`](.design/) |
| Everything else | [`docs/index.md`](docs/index.md) |

## Repository layout

```
.design/                  design canvas: identity tokens, page generator, artboards
.github/                  contributing, security, issue and pull-request templates, CI
apps/api/                 the Django project (code_api)
packages/                 framework-free packages: code-schema, code-weaver
tests/                    purity guards and repository checks
compose.yaml              the local stack (Postgres for now)
docs/
  index.md                map of the documentation
  design/                 how the screens are designed and rebuilt
  notes/journal/          one dated entry per working session, append-only
  notes/research/         studies that decisions were built on
  superpowers/plans/      one implementation plan per part
  superpowers/specs/      design documents: decisions, and the alternatives rejected
```

## Contributing

Start with [`.github/CONTRIBUTING.md`](.github/CONTRIBUTING.md). At this stage the most useful
contributions are critique of the specs and the screens, and topic requests — what you would
want to learn, and what it would need. Please follow the
[Code of Conduct](CODE_OF_CONDUCT.md), and report security problems privately as described in
[`.github/SECURITY.md`](.github/SECURITY.md).

## Licence

- **Code**: [Apache-2.0](LICENSE), as in Comeni Labs.
- **Learning content** — node pages, figure data, problems, and connecting text:
  [CC BY 4.0](LICENSE-CONTENT.md), as in
  [comeni-registry](https://github.com/comeni-project/comeni-registry).
- Images included in content keep their own licence, which is recorded beside each one.

## Citing

GitHub's *Cite this repository* button reads [`CITATION.cff`](CITATION.cff).
