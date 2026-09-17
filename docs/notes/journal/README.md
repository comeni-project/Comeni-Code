# Working journal

One entry per working session, dated, **append-only**. A new session — a person's or an agent's —
reads the newest entry first and is productive in five minutes.

## Reading it

> **The newest entry is
> [`2026-09-17-m0-part-2-django-project.md`](2026-09-17-m0-part-2-django-project.md)**: M0
> part 2 is built (the Django project boots on Postgres 18), and it restates part 3's objective
> with the operator's OpenAPI requirement. Three entries share this date; read this one first,
> then [part 1's](2026-09-17-m0-part-1-workspace-and-guards.md), then
> [the parts list](2026-09-17-m0-in-parts.md).

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
| [2026-09-17](2026-09-17-m0-part-2-django-project.md) | **M0 part 2 built.** `code_api` on Django 6.1 with a validated `CODE_*` environment, a custom user, Postgres 18 in Compose, CI with Postgres; part 3 must follow OpenAPI with a mandatory docs page |
| [2026-09-17](2026-09-17-m0-part-1-workspace-and-guards.md) | **M0 part 1 built.** The uv workspace, empty pure packages, static and runtime purity guards (the canary was red in CI), the link check, CI |
| [2026-09-17](2026-09-17-m0-in-parts.md) | **M0 in parts.** The design PRs are merged; CLAUDE.md now covers the build phase; M0 is split into nine parts. No code |
| [2026-09-16](2026-09-16-the-design-before-the-code.md) | **Tracks become woven routes.** The second spec; every key page drawn and redrawn against research; the hybrid identity; the AI pages; the repository seeded. No code |
