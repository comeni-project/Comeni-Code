# 2026-09-18 — what a node's neighbours are, and Dependabot narrowed

**Before M1 fixes links in a schema, the three kinds of link were re-examined and each given one
reason for existing.** The operator asked the question that started it: a node has neighbours that
are not dependencies — *related*, *more in depth* — so which relations are really relevant? The
answer keeps the three kinds the weaving spec already had, kills the fourth an agent proposed,
and narrows *related* to a test an author can apply. It is W3.2 of the
[weaving spec](../../superpowers/specs/2026-09-16-comeni-code-weaving-and-pages-design.md).

The same session finished the Dependabot triage that followed PR #33.

The operator decided; an agent proposed.

---

## Where things stand

| Claim | Check |
|---|---|
| Three kinds of link, each with a reason and a reader's question | `grep -n "### W3.2" -A 20 docs/superpowers/specs/2026-09-16-comeni-code-weaving-and-pages-design.md` |
| *Related* means the peer test, capped at four | `grep -n "peer test" docs/superpowers/specs/2026-09-16-comeni-code-weaving-and-pages-design.md` |
| W13's open question 8 (*what may related link*) is answered | `grep -n "answered 2026-09-18" docs/superpowers/specs/2026-09-16-comeni-code-weaving-and-pages-design.md` |
| CLAUDE.md's invariant 2 says three kinds and no more | `grep -n "three kinds and no more" CLAUDE.md` |
| Dependabot moves digests and lock entries, not the Python, Node, Postgres or Redis lines | `grep -n "ignore" -A 4 .github/dependabot.yml` |
| No pull request is open in either repository | `gh pr list` |
| **M1 is not started.** No parts list, no schema | `ls docs/notes/journal/ \| grep m1` |

## What changed this session

| Change | Where |
|---|---|
| Dependabot narrowed: `lockfile-only` for uv, majors held for node, python, postgres, redis, jsdom, `@types/node` | PR #39, `6475cbf` |
| Images group merged: uv and node digest bumps, nginx 1.29 → 1.31 | PR #40, `7a1d960` |
| PRs #37 and #38 closed (range floors); #34–#36 closed by Dependabot itself once the config landed | — |
| W3.2 rewritten: reasons, the peer test, derived neighbours, the rejected kinds | weaving spec |
| A side-doors toggle on L4 and L9 | weaving spec, W6.2 |
| Invariant 2 and the vocabulary line | CLAUDE.md |

## Decisions made, and why

**Three kinds, one question each.** An author picks a kind by asking which reader's question the
link answers, which is a decision someone can make in seconds:

| Link | Direction | The reader's question | Why it exists |
|---|---|---|---|
| **needs** | before | *What must I already know?* | the only input to a route; everything computed comes from these edges |
| **goes deeper** | below | *Where do I go for more?* | one claim and one level per node means depth cannot live inside a node — and a finished route needs an exit that is not a new goal |
| **related** | beside | *Am I in the right place?* | a learner can otherwise move sideways only by knowing the word to search for |

**The criterion, agreed first:** a kind exists only if it changes a route, answers a question no
other kind answers, or feeds a health check. Every kind costs a schema field, a validator rule, a
review policy, a slot on two screens, and a word authors must tell apart from its neighbours.
Three kinds authors confuse are worse than two they do not.

**Rejected: *helps, not required*** — an agent proposed it for the soft prerequisite (*Salmon goes
better with some probability*). It is the kind authors would most often confuse with the two either
side of it, and its whole job is a sentence a page can write in prose. A weak *needs* link is worse
than no link: it lengthens every route through it.

***Related* was nearly cut, and the examples saved it.** Its cases looked covered — true
alternatives are an *any of* group, comparisons belong in body prose, browsing is search and
region. Two things changed the answer. Learners have **no node-level browse**: L10 finds by the
word you know, which is what a newcomer lacks, and L12 browses tracks. And **L11 sends a learner
from Labs to a node with no route at all**, where an *any of* group cannot help because there is no
route to resolve one. Goal resolution (W3.3 step 1) also reads these edges, so it proposes targets
from human-approved peers instead of inventing them.

**The peer test, because *see also* is bounded by nothing.** *Needs* is bounded by what a topic
requires, *goes deeper* by the levels of a topic. "Worth reading together" has no limit, which is
how a side panel reaches a dozen entries and stops being read. *Related* now means **what a learner
might be reading instead of this node**; the validator refuses more than four, and a node wanting
eight is telling its author to split it. W13.8 asked whether a region fence should bound it — no:
the fence would have cut *k-mers* ↔ *hash functions*, and the test does the bounding.

**Two relations deliberately excluded**, with somewhere better to go: **transfer** (*k-mers* ↔
*hash functions*) belongs in the prose sentence that explains the connection, which teaches more
than a chip in a panel; **siblings** (*Transcription* ↔ *Translation*) come from a route, or hang
off the need both share.

**Derived, never authored:** *needed by*, *used in* (the same edges read forwards), the way back up
from a *goes deeper*, and *step back to* (a constrained pointer on a misconception callout, T6.1).

**Learners toggle the side-doors on their maps** (the operator's addition). Goes-deeper and related
can be drawn on L4 and L9, distinct from the route, off by default. It changes the picture, never
the route, the time left or the order of stops — invariant 2 holds.

**Dependabot: what it may move, and what it may not.** Digests, lock entries and versions inside
the lines this repository chose; never the lines themselves (Python 3.14, Node 24, Postgres 18,
Redis 8) or the ranges in `pyproject.toml`, which have specs behind them. `versioning-strategy:
lockfile-only` on uv stops a weekly pull request that raises a range's floor and changes nothing we
run; the cost is that transitive entries move only when a direct one does
(dependabot-core#14073). The first run proved the checks work: a `node:26` image failed `npm ci`
against `engines` in the `stack` job rather than reaching `main`.

## What is next

1. **M1's parts list**, in a journal entry of its own (R5: no mega plans). The shape an agent will
   propose: the node format and schema package; the validator and its messages; the Salmon
   fixtures; reading files into the index; the rebuild command and its API.
2. **Part 1's spec**, brainstormed section by section. W3.2 now fixes what the schema must carry:
   *needs* groups (*all of* / *any of*, each with a reason), *goes deeper*, *related* (≤ 4), a
   level, and nothing else pretending to be a link.
3. **The validator's rules follow from W3.2**, and each wants a test: no *needs* cycle, no
   *goes deeper* cycle, at most four peers, every link resolving to a node that exists.

## Open questions

- **Is *related* symmetric in the files, or written on one side?** W3.2 says written once and shown
  on both pages; which file holds it is a schema decision for M1 part 1.
- **Does a *goes deeper* link have to point at a node one level further on**, or may it point
  within a level? T10.1's levels make the question answerable; nothing decides it yet.
- **Transfer links live in body prose** — so nothing machine-readable records that *k-mers* and
  *hash functions* are the same idea. If that turns out to matter for search, it is a new decision.
- Carried over: jsdom 30 waits on Fedora's Node 24.15 (issue #32); review of non-Studio content
  pull requests is decided with landing in M4 (R8).
