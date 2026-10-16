# M6.1 — Linked drafts

**Status: agreed 2026-10-16; built.** The first part of M6 (#325), issue #328.
Designed with the operator on 2026-10-16. It changes M4.4's verify and checklist (archived
`2026-10-05-m4-drafts-design.md`, M4W.5) and M4.6's landing batch (archived
`2026-10-06-m4-landing-design.md`, M4L.3).

**Why.** Today verify places one draft in the index and nothing else, so a link to a node that is
still a draft is CS0501 (*is not a node*; `studio/drafts.py`, `_checked`, says so in its
docstring). With an empty content repository, every first page would need the pages below it
landed first: one merged pull request per layer of the graph. The operator writes several linked
pages and sends **each to review as soon as it is done**.

It decides:

- which drafts verify sees, and what it says about a link to one (M6LD.1);
- whose problems a draft is shown (M6LD.2);
- what landing does with a draft whose links need another draft (M6LD.3);
- the Links tab's suggestions (M6LD.4);
- the build and *done when* (M6LD.5).

No new block kinds (M6.2 onwards), no AI (M5), no change to what learners see: a draft is never
in the index, the weaver or a route until it lands.

---

## M6LD.1 Verify sees every live draft

**Verify, the checklist and Checks run the graph rules with every live draft in place**: the
index, then each live draft (open, submitted or approved; M4.4's *one live draft per node*) at its
latest revision, replacing its indexed node or added as new. `in_place([draft])` becomes
`in_place(live drafts)`, the draft being checked among them (landing's check does not change:
M6LD.3).

**All three link kinds** (*needs*, *goes deeper*, *related*) may name a live draft; the validator
checks every link's target the same way, and *related* must be on both nodes, so both drafts carry
it.

**A link to a draft that has not landed is a warning, never an error**: a new code, **CA0224**,
*needs splicing, a draft that has not landed* (the kind in the message: *needs*, *goes deeper*,
*related*). It is shown on the link's line, like CS0501 today, so author and reviewer both see
that the page leans on unfinished work. Warnings never refuse (M4E.4): the draft still verifies
clean, submits and is approved. A link to a node in the index that also has a live draft is a
link to a node: no warning.

**When the needed draft goes**, the link is CS0501 again, an error: a discarded draft is not
live. *Withdrawn* or *sent back* drafts are still live (open), so they still count.

*Rejected:* counting only drafts of the same author (a team writes one graph); counting only
approved drafts (the operator sends each to review as it is done, so the one below may still be
open); silencing the link entirely (nobody could see the page depends on work not yet landed).

## M6LD.2 A draft shows its own problems

With every live draft in the graph, `in_place` returns problems in other drafts too. **A draft is
shown a problem when the problem is in its own folder, or when it is caused by the draft**: it is
present with the draft in place and gone with the draft taken back out (its indexed node restored,
or a new node removed). So a problem inside *splicing* shows on *splicing*'s draft, never on
*isoforms*'; a *related* link the draft adds, which an indexed node does not return (CS0502, filed
on the indexed node's file), shows on the draft that added it; a level change that turns an
indexed node's *goes deeper* link downhill (CS0503) shows on the draft that changed the level; a
*needs* cycle that breaks when either of two drafts is taken out shows on both. This compares two
runs of the graph rules, so `code-schema` is unchanged. Two runs per verify is fine at team scale;
if it is not, the plan says so (*my call*).

Landing's batch check (M6LD.3) keeps every problem: it is the batch's.

*Rejected:* only the draft's own folder (problems the draft causes in an indexed node's file would
vanish until landing refused them); showing everything (a broken draft elsewhere would block every
author's submit); making `code-schema`'s problems name every node they concern (a change to the
pure package for what a comparison gives).

## M6LD.3 Landing tells you to tick it

A batch must carry every draft its links need. **Starting a landing whose batch links to a live
draft not in the batch is refused, before the in-place check**, with a new code, **CA0312**,
one line per missing draft, naming it and what to do:

| The needed draft is | The line says |
|---|---|
| approved, in no landing | *isoforms needs splicing: tick it too.* |
| open or submitted | *isoforms needs splicing, which is not approved yet.* |
| in a live landing | *isoforms needs splicing, which is landing in <id>: land this after it merges.* |

CA0312 is about **links to new nodes**: a batch draft's link (any of the three kinds) to a node
that is not in the index and whose live draft is not in the batch. A link to an indexed node
whose live draft changes it is already valid against the index; if leaving that draft out breaks
something (the back half of a *related* link, a level), CA0305 names the problem on its node
(*my call*).

**Nothing is added for you** (operator: *tell me to tick it*). The batch then runs the in-place
check as today (CA0305) **over the index and the batch only**, never the other live drafts: that is
what `main` will hold, so a batch cannot pass by leaning on drafts outside it. `in_place` takes the
drafts to place, as now; verify passes every live draft, landing passes the batch.

**The Ready to land table says it before you press Land**: a row whose draft needs another draft
not yet landed shows *needs splicing* under its node, and ticking it without *splicing* shows the
CA0312 lines under the table. The rule lives in the API; the screen asks it (a dry run on the
ready route, or the refusal itself; the plan picks the one that keeps Land at three GETs on open).

*Rejected:* adding the needed drafts automatically (the operator's choice); refusing only through
CA0305 (its *splicing is not a node* does not say what to do).

## M6LD.4 The Links tab suggests nodes and drafts

A link's node box suggests as you type: **landed nodes** (id and title) and **live drafts** (id and
title, marked *draft*). A suggestion fills the id; typing any id still works, and verify still
judges it. The list comes from one Studio route returning both (id, title, `draft: bool`), read
once when the Links tab opens. A draft's title is read from its latest revision's `node.yaml`;
at team scale that is a few files per request (M4.8a let the Drafts table skip titles for the same
cost; here it is one request on one tab).

*Rejected:* search-as-you-type against `/api/search` (it knows only the index); no suggestions
(the operator writes many linked ids; a typo costs a round trip through verify).

## M6LD.5 The build, and done when

Back end first (verify, the checklist, landing, the route), then the Ready table and the Links
tab. Test-first; the new codes declared in `diagnostics.yml` with a test naming each, and
`docs/reference/diagnostics.md` regenerated. The tests build drafts from fixture nodes in the
database, never from the content repository.

**Done when**, walked against the API and the screens (`runserver`, `npm run dev`) as two Studio
users:

1. A new draft *b* needs a new draft *a*: *b* verifies clean with CA0224 on its link; *a*'s
   problems do not show on *b*.
2. *b* is submitted and approved while *a* is open.
3. Landing *b* alone is refused with *b needs a, which is not approved yet*; once *a* is approved,
   with *tick it too*; *a* and *b* together pass the in-place check (CA0301 until the GitHub App's
   settings are set locally, as today).
4. Discarding *a* turns *b*'s link into CS0501.
5. The Links tab suggests *a* (marked *draft*) and the landed nodes.
