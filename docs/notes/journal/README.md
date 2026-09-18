# Working journal

One entry per working session, dated, **append-only**. A new session — a person's or an agent's —
reads the newest entry first and is productive in five minutes.

## Reading it

> **The newest entry is
> [`2026-09-18-m1-part-3-graph-rules.md`](2026-09-18-m1-part-3-graph-rules.md)**: M1 part 3 is
> built — `code-schema validate` checks a whole content folder; next is wiring it into the content
> repository, then part 4, the Salmon fixtures. Links are
> [part 2's entry](2026-09-18-m1-part-2-links.md); part 1 (the node folder) is
> [`2026-09-18-m1-part-1-node-folder.md`](2026-09-18-m1-part-1-node-folder.md); M1's six parts are
> in [`2026-09-18-m1-in-parts.md`](2026-09-18-m1-in-parts.md). For what a node's links mean and why there are
> three, read [`2026-09-18-node-neighbours.md`](2026-09-18-node-neighbours.md) — the peer test and
> the reason each kind exists — which also records the Dependabot narrowing. **M0 is done** —
> [`2026-09-17-m0-part-9-repository-guardrails.md`](2026-09-17-m0-part-9-repository-guardrails.md)
> says so, and `main` in both repositories takes only green pull
> requests. For the Compose stack and merging safely, read
> [part 8's entry](2026-09-17-m0-part-8-compose-stack.md); for the health page,
> [part 7's](2026-09-17-m0-part-7-health-page.md); for the product direction,
> [`2026-09-17-code-as-tutor.md`](2026-09-17-code-as-tutor.md). Fifteen entries share this date.

**Newest first, and stop when you have enough.** The top third of each entry — where things stand
and what is next — is enough for most sessions. The rest explains *why*.

**When a day has more than one entry, name the one to read first in the box above.** A directory
listing sorts by filename, not by the order the sessions happened.

If an entry disagrees with the specs or the code, the specs and the code are right. Say so in a new
entry.

## Writing one

At the end of a session that changed anything a future session needs to know:

```
docs/notes/journal/YYYY-MM-DD-a-short-title.md
```

Cover, in this order:

1. **Where things stand** — claims a reader can check, with the command that checks them
2. **What changed this session** — with commit hashes, not prose summaries
3. **Decisions made, and why** — especially the alternatives rejected. This is the part that is
   expensive to reconstruct and the reason the journal exists.
4. **What is next** — in recommended order, with the reason for the order
5. **Open questions** — things genuinely undecided, so nobody assumes they were settled
6. **Traps** — what a fresh reader would get wrong

Do not summarise the specs. The journal is for what the specs do not hold: sequence, intent, and
what was ruled out along the way.

Then update the box at the top of this file to point at the new entry.

## Entries

| Date | Session |
|---|---|
| [2026-09-18](2026-09-18-m1-part-3-graph-rules.md) | **M1 part 3 built.** `code-schema validate`: near misses, unique ids, targets, *related* on both nodes, levels, one ring per tangle of cycles; GitHub annotations; the content repository will pin a commit |
| [2026-09-18](2026-09-18-m1-part-2-links.md) | **M1 part 2 built.** Every link is `node` + `reason`; *needs* a list, *related* on both nodes, at most four; twelve per-node rules; *helps* and *any-of* designed in W3.2, refused until wired |
| [2026-09-18](2026-09-18-m1-part-1-node-folder.md) | **M1 part 1 built.** `code-schema` reads a node folder, reports every problem with file, line and field, and writes it back byte for byte; key lines kept per mapping (a plan bug, fixed) |
| [2026-09-18](2026-09-18-m1-in-parts.md) | **M1 in parts.** Six parts; `body.md` opaque in M1; horizontal parts, not vertical slices. No code |
| [2026-09-18](2026-09-18-node-neighbours.md) | **Node neighbours.** Three link kinds, one reason each; *related* is the peer test, capped at four; a side-doors toggle on maps; Dependabot narrowed |
| [2026-09-17](2026-09-17-m0-part-9-repository-guardrails.md) | **M0 part 9 built; M0 done.** `validate`, squash auto-merge and a no-bypass ruleset on `comeni-code-content`; a no-bypass ruleset requiring python, web and stack on Comeni-Code; every proof recorded |
| [2026-09-17](2026-09-17-m0-part-8-compose-stack.md) | **M0 part 8 built.** Compose runs migrate, api (gunicorn), worker, beat and web (nginx) on 127.0.0.1:8090; a CI `stack` job; M0 done except part 9; a PR merged red, fixed |
| [2026-09-17](2026-09-17-m0-part-7-health-page.md) | **M0 part 7 built.** The health page at `/` through Vite's proxy, five worded states, API types from `openapi.json` with json-schema-to-typescript; fonts start at load |
| [2026-09-17](2026-09-17-m0-part-6-identity-tokens.md) | **M0 part 6 built.** `.design/tokens.json` feeds the boards and a generated Tailwind 4 theme; CSS-first dark mode; bundled fonts; the identity specimen at `/`; light chip contrast kept |
| [2026-09-17](2026-09-17-m0-part-5-web-toolchain.md) | **M0 part 5 built.** `apps/web`: Vite 8, React 19, TypeScript 7 strict, Biome, vitest; a web CI job; jsdom 29 until Fedora ships Node 24.15 |
| [2026-09-17](2026-09-17-m0-part-4-celery.md) | **M0 part 4 built.** Celery on Python 3.14, Redis 8, a beat heartbeat, `redis` and `worker` health checks; process-handling traps recorded |
| [2026-09-17](2026-09-17-m0-part-3-ninja-api.md) | **M0 part 3 built.** `/api/health` (200/503), the docs page via WhiteNoise, the committed OpenAPI schema |
| [2026-09-17](2026-09-17-first-steps-in-mvp.md) | **First steps in the MVP.** A design round before M3; a few First steps nodes under the Salmon route |
| [2026-09-17](2026-09-17-levels.md) | **Levels.** Five content levels (First steps → Advanced); learners at every level; accounts 13+ until a consent spec |
| [2026-09-17](2026-09-17-questions-and-audience.md) | **Questions and audience.** Exam questions as block documents (question builder drawn); Code is for university students and researchers |
| [2026-09-17](2026-09-17-self-tests.md) | **Self-tests.** Exams from node pools join v1 as the mastery system (tutor spec T7.1); L13 Exam drawn |
| [2026-09-17](2026-09-17-code-as-tutor.md) | **Code as tutor.** Khan Academy research; the tutor spec (resources, skeletons, step backs, evidence, block scores); four new and four revised boards |
| [2026-09-17](2026-09-17-m0-part-2-django-project.md) | **M0 part 2 built.** `code_api` on Django 6.1 with a validated `CODE_*` environment, a custom user, Postgres 18 in Compose, CI with Postgres; part 3 must follow OpenAPI with a mandatory docs page |
| [2026-09-17](2026-09-17-m0-part-1-workspace-and-guards.md) | **M0 part 1 built.** The uv workspace, empty pure packages, static and runtime purity guards (the canary was red in CI), the link check, CI |
| [2026-09-17](2026-09-17-m0-in-parts.md) | **M0 in parts.** The design PRs are merged; CLAUDE.md now covers the build phase; M0 is split into nine parts. No code |
| [2026-09-16](2026-09-16-the-design-before-the-code.md) | **Tracks become woven routes.** The second spec; every key page drawn and redrawn against research; the hybrid identity; the AI pages; the repository seeded. No code |
