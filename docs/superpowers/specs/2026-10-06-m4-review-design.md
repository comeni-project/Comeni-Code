# M4.5 — Review

**Status: agreed 2026-10-06.** The fifth part of M4 (#74), issue
#123. Designed with the operator in conversation on 2026-10-06, section by section. It builds on
M4.4's drafts (archived spec `2026-10-05-m4-drafts-design.md`): a draft, its revisions, its
contributors and its checklist.

It decides:

- which of S6's conditions M4 enforces (M4R.1);
- what a solo operator may do, and invariant 5's new wording (M4R.2);
- the review states and their transitions (M4R.3);
- the review, the reviewer's answers and their grading (M4R.4);
- the storage: a state column and an event log (M4R.5);
- the API and its codes (M4R.6);
- the build and *done when* (M4R.7).

**No screens** (S6, the review screen, is M4.9), **no AI** (M5), **no landing** (M4.6).

---

## M4R.1 Which of S6's conditions, without AI

S6 (W7.3) makes Approve inert until *every unsourced assertion is marked, the node's checks are
answered, and the claim is locked*. Two of those are for model-drafted prose: sources per sentence
arrive with M5's drafting, and a claim lock is a screen interaction. One works today, and §5.5 of
the first spec names it as a defence against rubber-stamping, which is measured, not speculated:
**the reviewer answers the node's own questions before approving.**

**Decided: the checklist, plus the reviewer's answers.** Approve needs M4.4's checklist to pass
and the reviewer to have answered every question the submitted revision has. *Operator: B; "we
can change this later if it's too complicated."*

Rejected:

- **The checklist only**, with S6's conditions waiting for M5. Cheaper, but a lone Approve over a
  passing checklist is the screen §5.5 says will be rubber-stamped.
- **Also the claim lock** (the reviewer writes the claim before seeing the draft). Mostly a screen
  interaction; it fits M4.9 or M5 better.

## M4R.2 A team of one

Invariant 5 says **nobody approves what they drafted**, and M4.4 reads that as *nobody approves a
draft they contributed to*. With one person on the team, nothing could be approved, and nothing
would land through Studio. *Operator: "a solo operator should work, we will have little man
power."*

**Decided: an operator may approve their own draft, with a stated reason.** The approval is
logged and marked **self-approved**, and M4.6's landing pull request says so. Everything else
still applies: the checklist, and the operator answering every question. It is available to an
operator at any time, not only when nobody else could review. *Operator: A.*

Invariant 5 in `CLAUDE.md` gains: *an operator may approve their own draft with a stated reason;
it is logged and marked self-approved.* A reviewer who is not an operator never may.

Rejected:

- **Strict**: a second account always required. Holds the invariant, but blocks a team of one.
- **Only when nobody else could review** (no other active, non-contributing reviewer or
  operator). The invariant would return by itself when someone joins; the operator chose the
  simpler rule.
- **Also a cooling-off wait** before a self-approval. A sound habit, but it slows a solo operator;
  it can be added if self-approved content turns out worse.

## M4R.3 States and transitions

`Draft.state` gains `submitted` and `approved` (M4.6 adds `landed`). **A draft is saved only while
it is `open`**: M4.4's save already refuses every other state, so an approved draft cannot be
edited in place. Submitting freezes the draft, so what is reviewed and approved is exactly one
revision. *Operator: A, the pull-request lifecycle.*

| Transition | From → to | Who | Needs |
|---|---|---|---|
| **open** | — → open | author+ | as M4.4 |
| **submit** | open → submitted | author+ | the checklist passes at the latest revision; the call names that revision |
| **withdraw** | submitted → open | a contributor, or an operator | — |
| **reject** | submitted → open | reviewer+ who is not a contributor, or an operator | a **reason**; the call names the submitted revision |
| **approve** | submitted → approved | reviewer+ who is not a contributor, or an operator (then *self-approved*) | the checklist still passes; this reviewer has answered every question of the submitted revision; the call names that revision; a **reason** when self-approving |
| **send back** | approved → open | operator | a **reason** |
| **discard** | open → discarded | as M4.4 (a contributor, or an operator) | — |

- **The checklist is checked twice**, at submit and at approve: a rebuild in between can change
  the registries or the graph.
- **Approve and reject name the revision** they act on. If the draft was withdrawn, edited and
  resubmitted meanwhile, the call is 409 rather than acting on a revision the reviewer did not see.
- **A rejected or withdrawn draft reopens as the same draft**, its history in one place. Edits
  then make new revisions, and a new submission starts a new review.
- **One approval is enough.** A number set per team waits for a team.
- **One live draft per node.** M4.4's partial unique constraint covers `open` only; it now covers
  `open`, `submitted` and `approved`, so a node under review cannot gain a second draft.
- **Every transition locks the draft row**, as M4.4's save does: two reviewers acting at once run
  one after the other, and the second finds the state moved (CA0211).

Rejected: **editing stays open during review**, a save sending the draft back to open (a reviewer
loses their place mid-review); **a rejection closes the draft** (history splits across drafts, and
the one-draft-per-node rule makes reopening awkward).

## M4R.4 The review, and the reviewer's answers

**What a reviewer answers:** every question of the submitted revision — its try questions
(`node.questions`) and its exam pool (`node.exam`) — by question id. A choice question takes an
option's index; a number question takes a value.

**`Review`**: one reviewer's answers for one submitted revision. `draft`, `number` (the revision),
`reviewer`, `answers` (a JSON map from question id to what was given), `started_at`; unique on
(draft, number, reviewer). Answers are given one at a time and may change until the approval. A
new submission is a new revision, so a new `Review`; old ones stay as history and no longer count.

**Grading** is pure: `code_schema.grading.is_right(answer, given)`, the web app's rule
(`apps/web/src/node/TryQuestion.tsx`) in Python. A choice is right when its index is the correct
option. A number is right within `tolerance` (none means exact), with the web's `1e-9` slack.
Tests pin the two rules to the same cases, so the web or a self-test could later grade on it.

**What the reviewer sees:** a question's key and rationale **only after answering it**, then
whether they were right. A wrong answer **does not block** approval: it is a sign the question is
ambiguous or its key wrong, and the reviewer may reject with that reason.

**At approval**, the server checks the reviewer's `Review` for that revision answers every
question id the revision has, and the approval event records the tally (answered, wrong) and the
`Review`: how engaged the review was, which §5.5 asks to measure.

## M4R.5 Storage: a state column and an event log

**`DraftEvent`**, append-only: `draft`, `kind` (`opened`, `submitted`, `withdrawn`, `rejected`,
`approved`, `sent_back`, `discarded`), `by`, `at`, `revision` (the number it concerned, if any),
`reason` (blank when none), `self_approved`, and for an approval its `review`, `answered` and
`wrong`. Each transition writes the state and its event in one transaction. A test replays every
draft's events and checks they give its state. The migration writes one `opened` event per
existing draft from its revision 1, so every log starts at the start.

Rejected:

- **Event sourcing**, the state computed only from events. State and log could never disagree, but
  every list and filter needs a replay, and the one-live-draft constraint needs a column. The
  replay test buys most of that guarantee.
- **Transitions as fields on `Revision`** (submitted at, approved by). One revision is submitted,
  rejected, resubmitted over time; a row cannot hold that history without overwriting it.

## M4R.6 The API

Under M4.4's router, `/api/studio/drafts/{id}` (author and above). Who may do what past that is
checked in `studio`'s functions, as M4R.3 says; too low a role stays M4.3's **CA0102**, 403.

| Route | Body | Does |
|---|---|---|
| `POST …/submit` | `revision` | open → submitted |
| `POST …/withdraw` | — | submitted → open |
| `POST …/reject` | `revision`, `reason` | submitted → open |
| `POST …/approve` | `revision`, `reason` (required only when self-approving) | submitted → approved |
| `POST …/send-back` | `reason` | approved → open |
| `GET …/review` | — | your review of the submitted revision: each question's prompt and options, and for each one answered, what you gave, whether it was right, its key and its rationale |
| `PUT …/review/answers/{question_id}` | `given` | stores or changes one answer; returns the same for that question |
| `GET …/events` | — | the log, oldest first |

`DraftOut` gains `state` and `submitted_revision`; the list takes `?state=` (`submitted` is
M4.9's review queue).

New codes in the drafts band:

| Code | HTTP | When |
|---|---|---|
| CA0211 | 409 | the draft is not in the state this step needs; names the state it is in |
| CA0212 | 422 | the checklist fails, at submit or approve; lists the failed items |
| CA0213 | 403 | a contributor, not an operator, approves or rejects |
| CA0214 | 422 | a reason is missing or blank where one is required |
| CA0215 | 422 | approving with questions unanswered; names their ids |
| CA0216 | 409 | the named revision is not the submitted one |
| CA0217 | 404 | the submitted revision has no question with that id |
| CA0218 | 422 | an answer of the wrong kind, or an option index out of range |

## M4R.7 The build and done when

Test-first, in this order, each step a sub-issue of #123:

1. `code_schema.grading.is_right`.
2. The models and migration: the new states, the widened constraint, `DraftEvent`, `Review`, the
   backfill.
3. Submit, withdraw, reject and send back, each with its event.
4. Reviews and answers.
5. Approve, self-approval included.
6. The routes, the codes and `openapi.json`.
7. Docs: invariant 5 in `CLAUDE.md`, the layout line, the diagnostics reference.

A fresh reviewer at the checkpoint after step 4 and over the branch, as in M4.4.

**Done when** #123's checks pass: an author's own approval is refused (and an operator's
self-approval goes through only with a reason, marked); a rejection without a reason is refused;
an approved draft cannot be edited in place; the log reads back in order. Also: approval is
refused with a question unanswered or on a revision not submitted; the review hides a key until
its question is answered; `is_right` agrees with the web's rule; two approvals racing leave one.

## Not in this part

Comments on single blocks, and the review screen (M4.9); more than one approval; the claim lock
(M4.9 or M5); landing (M4.6); notifications.
