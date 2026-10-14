# M4.9a — Verdicts per block

**Status: written 2026-10-14, for the operator's review.** The first slice of M4.9 (#127), the
last part of M4 (#74). Designed with the operator in conversation on 2026-10-14, section by
section, after the M4.9 boards were approved on the canvas: *S6 · Review — as M4.9 builds it* and
*S10 · Land* (`.design/build_pages.mjs`, `reviewM4()` and `land()`). It changes M4.5's review
(archived spec `2026-10-06-m4-review-design.md`, M4R.1–M4R.7) from one decision per draft to a
verdict per block, then a decision on the draft.

It decides:

- why verdicts are per block, and what is a block (M4V.1);
- the rules for a verdict, for approving the draft, and for sending it back (M4V.2);
- the storage (M4V.3);
- the API and its codes (M4V.4);
- the build and *done when* (M4V.5).

**No screens** (the review screen is M4.9b, Land M4.9c), **no AI** (M5).

M4.9 is four slices, each its own spec, plan and pull request: **M4.9a** verdicts per block (this),
**M4.9b** the review screen, **M4.9c** the land screen, **M4.9d** the first real landing.

---

## M4V.1 Why per block, and what a block is

S6's board reviews blocks, not nodes: each block is read on its own, and in M5 the judge scores
each one. **A person's verdict must exist per block** for M5 to measure how often the judge agrees
with a person (the tutor spec's T8.3, shown in Quality), and for an author to see which block a
request is about. *Operator: "do per block … we can leave [the score] as placeholder until we add
M5."*

**A block is one review key**, in the submitted revision's reading order:

| Key | What it covers | Kind |
|---|---|---|
| `node` | the node's fields together: title, claim, level, minutes, region, its links | `node` |
| `block/<n>` | a body block that is not a try block, by its position (from 0) | the block's kind: `text`, `callout`, `sequence` |
| `try/<id>` | a try block, by its question's id | `try` |
| `resource/<n>` | a resource, by its position | `resource` |
| `exam/<id>` | an exam question, by its id | `exam` |

Positions are stable because a submitted draft is frozen (M4R.3). The keys are the ones M5's
scores will attach to; a block's identity across revisions is M5's (its redraft history).

Rejected:

- **Per draft, as M4.5 built it**, with the screen reading block by block. M5 would add per-block
  verdicts and scores in one change, and judge–human agreement could not be measured from M5's
  first day. *Operator: per block.*

## M4V.2 The rules

**Who gives a verdict:** whoever M4R.3 lets approve: a reviewer or above who did not contribute,
or an operator. An operator judging their own draft may give verdicts; the self-approval reason is
asked once, when approving the draft.

**A verdict** is `approved`, or `changes` with a **note** (required). It may be changed or cleared
while the draft is submitted.

**A question** (`try/…`, `exam/…`) is approved only after this reviewer answered it (M4R.4's
answers, unchanged). A wrong answer counts, never blocks. `changes` needs no answer.

**One call sets verdicts for a list of keys**; one verdict is a list of one. **All or nothing**: an
unknown key, an unanswered question approved, or a `changes` without a note refuses the whole call
and names them. The screen knows which questions are answered and leaves those out of a bulk
approval before sending (*"Q2 is skipped: answer it first"* on the board).

**Approve the draft** (submitted → approved) needs **every key of the submitted revision approved
by this reviewer**, none left as `changes`; plus what M4R.3 already needs: the checklist still
passes, the call names the submitted revision, a reason when an operator approves their own
draft. M4R.1's *every question answered* is no longer checked on its own: approving a question
needs its answer. The approval event keeps its tally (answered, wrong) and records the number of
blocks. *Operator: an explicit Approve the draft, not approval when the last block is approved
("that automatic is confusing"), and a bulk approve.*

**Send back** returns a draft to its author, one action from two states:

| From → to | Who | Needs |
|---|---|---|
| submitted → open | as approving (above) | at least one `changes` verdict, or a note, or both; the call names the submitted revision |
| approved → open | an operator | a reason (M4R.3, unchanged) |

It replaces M4R.3's **reject**, which was the same move from submitted. The event (`sent_back`)
points at the review, so the requests are read from it. Old `rejected` events stay in the log and
still replay. *Operator: A, one Send back; the board's Reject the draft goes.*

**Verdicts belong to a submission**, as M4.5's answers do (#188): a draft submitted again starts
an empty review.

Rejected:

- **Approval when the last block is approved.** Confusing (*operator*).
- **Bulk approval that skips what it cannot approve**, server side. All or nothing keeps one rule
  in one place; the screen knows enough to send only what it can.
- **Reject as its own action closing the draft** (submitted → discarded). M4R.3 rejected closing
  on rejection: history splits across drafts, and a reviewer could end an author's work.

## M4V.3 Storage

**`Verdict`**: `review` (M4.5's `Review`, one reviewer's review of one submission), `key`, `kind`
(from the table in M4V.1), `verdict` (`approved` or `changes`), `note`, `at`. Unique on
(`review`, `key`). Clearing a verdict deletes its row. `DraftEvent` gains `blocks` (null except on
an approval).

One schema migration; reviews in progress keep their answers and have no verdicts yet.

Rejected:

- **A JSON map on `Review`**, beside `answers`. Less code, but M5's analysis would unpack JSON for
  every review, and the database could not hold one verdict per key. *Operator: the table.*
- **Verdicts as events in the draft's log.** The log records transitions; a hundred verdicts
  among them would bury its history and its replay.

## M4V.4 The API

Under `/api/studio/drafts/{id}`, as M4R.6.

| Route | Body | Does |
|---|---|---|
| `GET …/review` | — | your review of the submitted revision: every key in order, each with its kind, its content, and your verdict and note; a question as `ReviewQuestionOut`, its answer and rationale only once you answered it |
| `PUT …/review/verdicts` | `revision`, `verdicts: [{key, verdict, note}]` | sets them, all or nothing; `verdict: null` clears one; returns the review |
| `PUT …/review/answers/{question_id}` | `given` | unchanged |
| `POST …/approve` | `revision`, `reason` | unchanged in shape; the rule in M4V.2 |
| `POST …/send-back` | `revision` (from submitted), `reason` | the two rows in M4V.2 |
| `POST …/reject` | — | **removed** |

**The review carries its own content.** M4.5 found that `GET …/drafts/{id}` shows every answer to
the team (#189), so the review screen must not fetch it before the reviewer answers. Each key's
content comes with the review: the fields for `node`, the block as `BlockOut`, the resource as
`ResourceOut`, a question as `ReviewQuestionOut` (key hidden until answered). One GET opens a
review.

**`DraftOut` gains `requests`**: the `changes` notes of the last send-back from submitted, each
with its key, kind and reviewer, and the send-back's reason. Opening a draft stays one GET; M4.9b
shows each request beside its block in the workbench.

New codes in the drafts band:

| Code | HTTP | When |
|---|---|---|
| CA0219 | 404 | a key the submitted revision does not have; names it |
| CA0220 | 422 | a question approved before it is answered; names it |
| CA0221 | 422 | a `changes` verdict without a note |
| CA0222 | 422 | approving the draft with keys not approved; names them |
| CA0223 | 422 | sending back from submitted with no `changes` verdict and no note |

CA0215 (*questions unanswered* at approval) is no longer raised: CA0222 covers it. Codes are never
renumbered, so it stays in `diagnostics.yml`, its explanation saying it is retired and why; the
registry has no retired marker yet, and the plan checks what its tests need.

**The review queue** (every submitted draft and its keys, the screen's left list) is M4.9b's to
decide, with the screen that needs it.

## M4V.5 The build and done when

Test-first, in this order, each step a sub-issue of #127's M4.9a:

1. `review_keys(node)`: a node's keys in order, with their kinds (pure, in `studio`).
2. The model and migration: `Verdict`, `DraftEvent.blocks`.
3. Setting verdicts: the rules in M4V.2, all or nothing, under the draft's row lock.
4. Approve the draft by verdicts; send back from both states; `reject` removed.
5. The routes, the codes, `DraftOut.requests`, `openapi.json` and `schema.ts`.
6. Docs: the diagnostics reference, *send back* in `CLAUDE.md`'s Words, the layout line.

A fresh reviewer over the branch at the end.

**Done when**, through the API in tests: a reviewer gives verdicts to every key of a submitted
draft, one at a time and as a list, and approves it; approving a question before answering it, a
`changes` without a note, and approving the draft with a key left are each refused with their
code; another draft is sent back with two requests and its author reads them on `DraftOut`; a
resubmission starts an empty review; an operator's own draft is approved only with a reason. The
full checks pass with CI's environment.

## Not in this part

The review screen, the review queue and the requests in the workbench (M4.9b); Land (M4.9c); the
first real landing (M4.9d); scores, the judge and *Was the score right?* (M5); a block's identity
across revisions (M5); more than one approval; notifications.
