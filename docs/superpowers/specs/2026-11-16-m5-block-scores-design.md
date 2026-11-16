# M5.3 — Block scores

Part of M5 (#448), after the gateway (M5.1) and drafting with provenance (M5.2). The existing
Review and AI pages remain the surfaces; this part fills their score placeholders. The judge
decision is #451. No new screen or board is needed: S6 and S17 already draw the score, its reasons,
the redraft history, agreement, and the threshold settings.

## What it does

When an author asks Code to draft a block, resource, or figure, Code first checks the candidate
deterministically against the draft's schemas and sources. A candidate that fails validation is
refused as invalid and is not scored. A valid candidate is scored in a **fresh model call** against
the versioned rubric for its kind. The judge gets only the current node claim and level, the
candidate, its cited public source metadata, and the rubric. It does not get the drafting prompt,
requester instruction, private source excerpts, or any prior conversation. The drafter and judge
may resolve to the same model; their settings and call records are retained for every attempt.

Each rubric has named parts, each rated 1–5 with a reason, and an overall 1–5 score. If the overall
score is below the configured threshold, the judge's structured critique may be sent to a new
drafting call. This repeats up to the configured maximum number of redrafts. A refusal, malformed
score, or unavailable judge stops the loop and leaves a valid candidate available when one exists;
the page says it is unscored or that judging stopped. A score never blocks a person from reviewing
or accepting the candidate. Redrafts remain proposals: nothing changes in the draft until the
author compares and keeps one.

The proposal shows the final score, named parts and reasons, the rubric version, and the number of
drafting attempts. Earlier valid candidates and their scores remain in the proposal's private
history for comparison. Each judge and drafter call is separately recorded by the gateway. No
prompt, private source excerpt, or model reply is added to public provenance.

Review shows the latest score for a block next to its content and reasons. The queue sorts scored
drafts by their lowest block score first; unscored drafts follow scored ones, preserving submission
time as the tie-breaker. A reviewer answers the existing *Was the score right?* question for each
scored block. Agreement is stored with that review's verdict and is available for later Quality
reporting. No scores or agreement data are sent to learners.

## Settings

The operator configures the `block-evaluation` site on the existing AI Models page:

- **Minimum score** (`x`), an integer from 1 through 5; the built-in default is 3.
- **Maximum redrafts** (`N`), an integer from 0 through 3; the built-in default is 1.
- Each drafting/judge call is still independently subject to its site's daily call cap and timeout.
  There is no unbounded retry and no hidden background loop.

Changing either setting applies to the next proposal. The captured values are stored with each
proposal so later setting changes cannot rewrite its history. Automatic deployment remains
deferred; every accepted draft still needs a person.

## Durable records and privacy

- A score is attached to the proposal and accepted revision it describes, by target and canonical
  content digest. Editing the target makes that old score stale; a score for another block remains
  current.
- Every score records its rubric id/version, judge model, call settings, prompt id, score parts,
  overall score, and its gateway call id. Every drafting attempt records its call id and candidate
  digest. The gateway remains the sole record of provider usage and contains no prompt or reply.
- A human agreement answer belongs to a review verdict, not the draft globally: reviewers can
  disagree, and each answer is attributable to one submission and one reviewer.
- Public AI provenance keeps its existing compact receipt; private score details stay in Studio.
  Learner API schemas must not gain scores, reasons, reviewer answers, or attempt history.

## Rubrics and deterministic checks

Rubrics are versioned code resources; changing wording or part definitions increments the version.
The initial rubrics cover the current M5 proposal kinds:

- **Block:** source accuracy, clarity at the node's level, and service to the node claim.
- **Resource:** relevance to the node claim, suitability for its level, and completeness of the
  resource record.
- **Figure:** correctness of the data against its component schema, support for the claim, and
  clarity/accessibility of its description.

The judge must return exactly the declared parts and integer scores in range. Any missing,
additional, out-of-range, or malformed part makes that attempt unscored. Before the judge call,
Code validates the candidate with the existing schema and round-trip checks, verifies cited source
ids are declared public sources, and checks component-derived values as it does today. A failed
deterministic check ends that candidate's attempt.

## T8 and invariant updates

- T8.2 permits the judge to use the drafter's model, as a **fresh call** with no draft conversation
  (#451). The fresh judge receives only the block, its public sources, and its rubric. Stored judge
  model/settings and reviewer agreement let Quality measure the bias risk over time.
- T8.3's threshold and redraft count are settings; bounded attempts apply to M5.2's proposals.
  The existing Review queue orders low scores first, then unscored items.
- Invariant 5 remains **AI drafts, people approve**. The prior ban on same-family judges is replaced
  by the #451 rule. Automatic deployment remains deferred under T8.4.

## Done when

1. A valid proposal receives a typed score and durable private history; invalid content is rejected
   before scoring; judge refusal or malformed output leaves the candidate clearly unscored.
2. A below-threshold candidate is redrafted no more than the configured maximum; each call has a
   separate gateway record, and each new attempt has no conversation memory.
3. Authors can compare attempt scores and reasons before keeping a proposal; keeping still creates
   one ordinary revision and preserves the existing provenance contract.
4. Review shows scores and parts, orders the lowest scored blocks first, and records each human
   agreement answer per reviewer without exposing it to learners.
5. The operator can change threshold and redraft limit from AI Models; bounds and defaults are
   enforced by the API.
6. Rubric/version changes, score persistence, stale-score behavior, queue ordering, API privacy,
   and UI states are covered in automated checks; Python and web quality gates pass.

## Decisions and alternatives

- **Same model allowed, fresh call required.** Operator decision #451. Rejected making a same-family
  block score impossible; record judge settings and measure judge–human agreement in Quality.
- **Score drafts but never accept them.** Rejected auto-deploy based on a threshold; T8.4 requires
  measured agreement and a separate decision.
- **A short bounded loop inside the worker.** Rejected an unbounded judge/redraft chain; every call
  is subject to its own gateway cap/timeout, and `N` is at most 3.
- **Keep attempts private to Studio.** Rejected adding judge text or source excerpts to public
  provenance or learner responses.
