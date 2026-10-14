# M4.9b — The review screen

**Status: written 2026-10-14, for the operator's review.** The second slice of M4.9 (#127).
Designed with the operator in conversation on 2026-10-14, section by section, from the board
*S6 · Review — as M4.9 builds it* (`reviewM4()` in `.design/build_pages.mjs`, approved on the M4
canvas, its last view renamed *Approved* in this brainstorm). It builds on M4.9a's verdicts per
block (`docs/superpowers/specs/2026-10-14-m4-verdicts-per-block-design.md`, M4V.1–M4V.5).

It decides:

- the review queue, in one request (M4RS.1);
- what a block was before the draft, matched on the server (M4RS.2);
- requests that follow their blocks through the author's edits (M4RS.3);
- the review screen (M4RS.4);
- the requests in the workbench (M4RS.5);
- the build and *done when* (M4RS.6).

**No scores or judge** (M5), **no Land** (M4.9c), **no real landing** (M4.9d).

---

## M4RS.1 The queue

The board's left list holds the blocks of **every** draft under review, grouped by draft, with
counts. **`GET /api/studio/review`** answers it in one request: every submitted draft the caller
may judge (a reviewer or above who did not contribute, or an operator), oldest submission first,
each with `public_id`, `node_id`, `title`, `revision`, `contributors`, `submitted_at`, and its keys
in reading order, each key with `kind`, a short `label` and the caller's `verdict`. No content:
opening a block loads its draft's review (M4.9a's `GET …/review`) once.

A key's label: a text block's first words; a callout's title; a sequence block's first letters; a
question's title (exam) or ask (try); a resource's provider and kind; *Title, claim, level, links*
for `node`. Labels are cut to 60 characters on the server.

Rejected:

- **No new endpoint**, one group open at a time from `?state=submitted`. Cheaper, but the list
  departs from the board and *To review* counts drafts, not blocks.
- **One endpoint with every draft's content.** One request, but it grows with every draft in
  review, and most of it is never opened. *Operator: A, the queue endpoint.*

## M4RS.2 Changes: what a block was

The board's *Standalone | Changes*. **Each item of `GET …/review` gains `change`** (`new`,
`changed` or `same`) **and `before`** (the item's content as the live index has it, when changed),
in the shape the item's content already has.

- Compared with the live index's node; with none (a new node) every key is `new`.
- **One pure function aligns two revisions' keys**: `align(before, after) -> {after_key:
  before_key | None}`, in `studio/keys.py`. Questions match by id, resources by URL, `node` with
  `node`; body blocks are aligned by their text with `difflib.SequenceMatcher`, so an inserted
  block does not mark the rest as changed. A matched pair whose content differs is `changed`.
- **A question's `before` hides its key** until the reviewer answered, as the current version does
  (M4R.4, #189).
- The screen draws a word diff for text and *before / after* for the rest.

Rejected:

- **A file diff** of the draft against the live files: `exam.yaml` would show the answers before
  the reviewer answers.
- **Changed or not, with no before.** Least work, short of the board. *Operator: A.*

## M4RS.3 Requests that follow their blocks

M4.9a's `DraftOut.requests` are keyed to the revision that was sent back; an author's edit can
move a position (`block/1` becomes `block/2`). **Each request gains `now`**: its key in the
draft's latest revision, by `align` from the sent-back revision, or `null` when the author deleted
that block. No storage changes.

Rejected:

- **A banner only**, no mapping. The author finds each block alone.
- **Marking a request done**, stored per request. More work; resubmitting already clears them.
  *Operator: A.*

## M4RS.4 The review screen

`/studio/review`, a Studio page for reviewers and above; *Review* in the rail with the number of
keys still without the caller's verdict.

- **Left: the queue.** A group per draft (title, revision, author, *3 of 8*); its keys with kind,
  the score placeholder (—, *Scores arrive with the judge in M5*) and the caller's verdict. Views
  filter by verdict: **To review** (none yet), **Changes requested**, **Approved** (blocks approved
  in drafts still under review; approved drafts are in Drafts and Land). Filters: *+ Node*,
  *+ Block type*. **Ticks and the dark bar approve in bulk**; a ticked question not yet answered is
  left out, with *Q2 is skipped: answer it first*.
- **Middle: the open block**, as a learner reads it, drawn by the Node page's own pieces (`Body`,
  `Callout`, `SequenceBlock`; a resource as in *Learn it*). **Standalone | Changes** (M4RS.2); a
  new node says *New in this draft*. **A question is answered in place** by `TestQuestion`, which
  gains an answer action; the answer goes to M4.9a's `PUT …/review/answers/{id}`, and only then do
  the right answer, whether you were right and the rationale show. A try question shows its hints.
  The dashed judge placeholder.
- **Right: your verdict.** The conditions (*Read standalone*, *Answered it yourself* for a
  question, *You didn't write it*), **Approve this block**, **Request changes…** (a note). **This
  draft**: progress, **Approve the draft** (when every key is approved; it asks a reason when an
  operator approves their own), **Send back · n requests** with an optional note. *Was the score
  right?* as a placeholder. Keys: **A** approve, **R** request changes, **J/K** next and previous.
- **Requests made**: one GET opens the page; a draft's review is fetched once, when one of its
  blocks is first opened; each verdict is one `PUT …/review/verdicts` whose answer replaces the
  cached review, so nothing is fetched again. A draft approved or sent back leaves the queue.

## M4RS.5 Requests in the workbench

- **A banner under the header**: *Sent back by [Reviewer]: reason · 2 requests*, each request with
  its block's label; choosing one opens the tab that holds it.
- **The note beside each block** whose `now` points at it: in Content's block list, on Resources'
  cards, in the Exam pool's list and its editor. A request whose block was deleted shows in the
  banner only, *block removed*.
- Read only, from the `DraftOut` the workbench already holds: no new request. Requests go when the
  draft is submitted again (M4.9a).

## M4RS.6 The build and done when

Test-first. The back end first: `align` (pure; an insert, a delete, an edit, a move, a new node),
the queue route (who sees which drafts, labels, verdicts), `change`/`before` (a question's before
hides its key), `now` (after an insert and a delete). Then the web: the page and its queue views,
one and bulk approval, answering before approving, Approve the draft and Send back, Changes, the
workbench banner and notes. A fresh reviewer over the branch at the end.

**Done when**, in a browser against the real API: a reviewer opens Review, answers TPM's
questions, requests a change on a block and sends the draft back; the author sees the banner and
the note beside that block, edits and resubmits; the reviewer approves every block, some in bulk,
and approves the draft. Compared with the board at 1680 px, in light and in dark.

## Not in this part

Land (M4.9c); the first real landing (M4.9d); scores, the judge and redraft history (M5);
assigning reviews (*Assigned to me*); saved views and search in the review list.
