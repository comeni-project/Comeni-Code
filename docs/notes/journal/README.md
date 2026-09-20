# Working journal

One entry per working session, dated, **append-only**. A new session — a person's or an agent's —
reads the newest entry first and is productive in five minutes.

## Reading it

> **The newest entry is
> [`2026-09-20-m2-part-3-route-cli.md`](2026-09-20-m2-part-3-route-cli.md)**: `code-weaver route
> salmon --root tests/fixtures/salmon` prints the route, one line per stop, exiting 0, 1 or 2.
> Part 2 is
> [`2026-09-20-m2-part-2-why-known-and-span.md`](2026-09-20-m2-part-2-why-known-and-span.md): a
> route says why each stop is on it, from the reasons already stored on the links, drops what the
> learner knows, and reports its level span. Part 1 is
> [`2026-09-19-m2-part-1-walk-back-and-order.md`](2026-09-19-m2-part-1-walk-back-and-order.md):
> `code-weaver` weaves — `Graph` checked when built, `weave` gives the fixtures' 17-stop Salmon
> route, the purity guard runs a weave. M2's parts are in
> [`2026-09-19-m2-in-parts.md`](2026-09-19-m2-in-parts.md): **M2, the weaver**, in four parts — walk back and order, why and known, the CLI, the API; the
> fixtures' 17 stops are the reference route. M1's last part is
> [`2026-09-19-m1-part-6-command-and-api.md`](2026-09-19-m1-part-6-command-and-api.md): **M1 is
> done** — `manage.py rebuild_index` and `GET /api/nodes/{node_id}`, with M1's done-when checks;
> next is M2, the weaver. The index itself is
> [part 5's entry](2026-09-19-m1-part-5-index.md). Part 4's 26 fixture nodes are
> [`2026-09-19-m1-part-4-salmon-fixtures.md`](2026-09-19-m1-part-4-salmon-fixtures.md): a route
> from no background to Salmon with *de Bruijn graphs* below it, not on it. The content
> repository runs `code-schema validate` ([`2026-09-18-content-validates-nodes.md`](2026-09-18-content-validates-nodes.md)); M1
> part 3 is [its entry](2026-09-18-m1-part-3-graph-rules.md). Links are
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
> [`2026-09-17-code-as-tutor.md`](2026-09-17-code-as-tutor.md). Six entries share 2026-09-18.

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
| [2026-09-20](2026-09-20-m2-part-3-route-cli.md) | **M2 part 3 built.** `code-weaver route <goal>… --root <folder> [--known <id>]…`: a header with the count, time and span, then one line per stop with its first reason, at a fixed width of 100; exit 0/1/2 |
| [2026-09-20](2026-09-20-m2-part-2-why-known-and-span.md) | **M2 part 2 built.** `needed_by` lists the route stops that need each stop with their stored reasons; the walk stops at known topics; `Graph` takes the level order and the route reports its span |
| [2026-09-19](2026-09-19-m2-part-1-walk-back-and-order.md) | **M2 part 1 built.** `Graph` refuses duplicates, unknown regions, dangling needs and cycles; `weave` orders by region then first-reached; 17 Salmon stops, byte-identical across hash seeds; the runtime guard runs a weave |
| [2026-09-19](2026-09-19-m2-in-parts.md) | **M2 in parts.** Four parts: walk back and order, why/known/level span, the CLI, the API; goal resolution is M5's, *any-of* waits for content; the fixtures' 17 stops replace the board's 13 |
| [2026-09-19](2026-09-19-m1-part-6-command-and-api.md) | **M1 part 6 built; M1 done.** `manage.py rebuild_index` from `--root` or `CODE_CONTENT_ROOT`, exit 0/1/2; `GET /api/nodes/{node_id}` with neighbour cards and derived needed-by; 404, or 503 before any build |
| [2026-09-19](2026-09-19-m1-part-5-index.md) | **M1 part 5 built.** `code_api.content`: Region, Node, Link, IndexBuild; `rebuild_index` all or nothing, every attempt recorded; nodes named by id outside the index; MVP-only, per the operator |
| [2026-09-19](2026-09-19-m1-part-4-salmon-fixtures.md) | **M1 part 4 built.** 26 Salmon fixture nodes: a 17-node route from no background, five goes-deeper nodes below Salmon, kallisto as its peer; W1 corrected; no *helps* or *any-of* needed |
| [2026-09-18](2026-09-18-content-validates-nodes.md) | **Content validates nodes.** comeni-code-content runs `code-schema validate` pinned to `559cbf4`; six regions from research into what Salmon depends on; *de Bruijn graphs* on Salmon's route left for part 4 |
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
