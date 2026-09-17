# Contributing

Thank you for considering it. Comeni Code is at the design stage: there is no application code
yet. This document says what is useful now, how a change is shaped, and how the project records
its decisions.

## What helps most right now

**Critique of the design.** Read the specs in
[`docs/superpowers/specs/`](../docs/superpowers/specs/) and the screens in
[`docs/design/`](../docs/design/). An issue that says *this will not work for a wet-lab
biologist, because…* is worth more than a pull request that polishes wording.

**Topic requests.** What would you want to learn, and what would it need first? Use the
*Topic request* issue template. Until the app's own request queue exists, these issues are that
queue — and, as in the app, nothing moves from a request to being written without a person
deciding.

**Corrections.** A claim in a spec that is wrong, uncited, or out of date. Cite what you know.

If a change is larger than a paragraph, open an issue first so we can agree on the shape before
you spend time on it.

## Kinds of change

| Change | Where | What review looks for |
|---|---|---|
| A design decision | a spec in `docs/superpowers/specs/` | the decision, **the alternatives rejected and why**, and what it supersedes |
| A screen | `.design/build_pages.mjs` (or `_identity.mjs` for tokens), then rebuild | the spec it follows, and what a user is trying to do on that screen |
| A record of a working session | a new file in `docs/notes/journal/` | the journal's own rules (below) |
| Everything else in `docs/` | the file itself | that it matches the specs, or says it doesn't |

Code arrives phase by phase (architecture spec R4). Each part of a phase gets a short spec and a
specific plan before its code; there is no plan for a whole phase. This table will grow then.

## How the project records decisions

**Specs are the decision records.** A spec states what was decided, on what date, by whom (a
role, not a name), and **what was rejected and why** — the part that is expensive to reconstruct
later. A new decision that changes an earlier one edits the earlier spec only to point at the
new one; the reasoning lives where it was made.

**The journal is append-only.** One dated entry per working session, in
[`docs/notes/journal/`](../docs/notes/journal/). Corrections go in a later entry, never by
editing an earlier one. Read its README before writing an entry.

**Research is cited.** A design claim that rests on a study or on another product's behaviour
links to it in the spec's sources.

## Commits

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/)
with the house style already in the history: a type, an optional scope, and a subject that
says what is now true, in plain words.

```
docs(spec): tracks are woven from goals — pages, figures, AI and identity
design: the hybrid identity and the key pages, from one generator
```

| Type | For |
|---|---|
| `docs` | specs, journal, guides |
| `design` | the design canvas and its generator |
| `feat`, `fix`, `test`, `refactor`, `build`, `ci`, `chore` | as usual, once there is code |

The body explains *why*. Keep one logical change per commit, so a reviewer can read the history
as an argument.

## Pull requests

- Branch from `main`; name the branch after the change (`docs/…`, `design/…`, `feat/…`).
- Fill in the template. The *Why* section is the one that matters.
- If you changed a screen, rebuild the boards (`node .design/build_pages.mjs`) and commit the
  generated files with the change.
- If you changed a decision, update the spec in the same pull request.
- Expect review within a week. If a pull request goes quiet, a comment asking is welcome.

## Conduct and security

Everyone taking part follows the [Code of Conduct](../CODE_OF_CONDUCT.md). Security problems —
including ways learner data or model keys could leak — go through
[private reporting](SECURITY.md), not public issues.

## Licensing of contributions

By contributing, you agree that code is licensed under [Apache-2.0](../LICENSE) and learning
content under [CC BY 4.0](../LICENSE-CONTENT.md). Only contribute material you have the right to
license that way; images need their author and licence recorded beside them.
