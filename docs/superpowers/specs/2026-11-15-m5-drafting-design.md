# M5.2 — Drafting with provenance

**Status: approved by the operator, 2026-11-15; planning authorised.** Part of M5 (#445), issue #447.
Builds on M5.1 (#446, PR #465). The operator approved this design and asked for its implementation
plan; application implementation has not started. The five boards are generated from `.design/_m5_drafting.mjs` through the normal
canvas generator: `DraftBlockAI`, `DraftBlockAIConflict`, `DraftResourceAI`, `DraftFigureAI`, and
`DraftBlockAIDark`. Sample text, model names and call numbers are design fixtures.

## M5D.1 The author asks; the model proposes

Three entry points, on an open draft, for authors and above:

| Entry | Declared site | Result |
|---|---|---|
| **Redraft with AI**, beside a selected block | `page-drafting` | a replacement for that one item, compared with the current item |
| **Suggest a resource**, in Resources | `resource-suggestion` | one resource candidate, with its part, level and recorded licence |
| **Ask**, in the figure composer's Data step | `figure-data` | proposed data for the selected existing component, with its description |

**Nothing is saved because a model answered.** The author chooses Keep or Discard. Keeping a
block or resource runs the ordinary validated draft save, making one revision. A kept figure
proposal enters the composer's working copy; **Save to the page** still validates and saves it.
Keeping means authorship, never approval. Normal submission, review and landing still apply.

Redraft supports text, callout, sequence, math, example, try and exam questions, and an existing
problem's words/parameters through their existing edit operations. It does not generate image
files, new figure components, executable problem kits, node identities or needs links. A figure
block opens the composer's Ask flow. Full-node generation and graph changes belong to later parts.

Out: judge scores and automatic redrafts (M5.3), learner goals (M5.4), conversation and tool
loops (M5.5), skeletons (M7), image search, autonomous web retrieval and a general citation editor.

## M5D.2 What a drafting call may see

Each request names the draft's current revision, the selected item, an instruction and the
source records the author selected. Context contains the node's claim, level, relevant existing
content, the selected item's schema and the allowed operation. It never includes account secrets,
other authors' conversations, learner data or unrelated drafts.

Prompts are versioned files in `code_api/ai/prompts/`, not inline strings in views. Initial ids:
`draft-block@1`, `suggest-resource@1`, `draft-figure@1`. Each request is one fresh gateway call,
with `by`, `draft`, `prompt_id` and a Pydantic reply schema. There is no repair call or retry loop.
The reply may name only its allowed target and the source ids supplied with the request.

**Sources are explicit evidence, not guessed retrieval.** A source has a title, URL when one
exists, licence/permission recorded by the author, an author-supplied excerpt and a visibility
choice (Studio-only by default; public references only when explicitly selected). The current
draft can itself be a source, labelled as author-supplied material. No URL is fetched by this part;
Khan Academy and other forbidden material are not scraped or fed to a model (T5.3).

Resource suggestions select from indexed resource records and candidates supplied by the author.
The model cannot invent a provider, URL, licence or unseen source. The author opens and checks the
suggested resource; ordinary resource validation and human review still apply. Discovering new
resources on the web is explicitly outside this first slice.

Record the source snapshots and their hashes with the proposal. They are available to Studio's
reviewers. A source id is provenance, not proof that a scientific claim is correct. This does not
claim to implement the still-unplaced general inline citation system.

## M5D.3 Jobs and refusal

`code_api.studio.ai_drafting` owns proposals; `code_api.ai` continues to own model access.
`DraftProposal` holds a public UUID, draft, requested-by person, kind/target, base revision,
instruction, selected-source snapshots, prompt id, state, call reference, raw candidate,
replayed candidate, validation findings, conflict report and accepted revision when there is one.
These are draft artifacts; prompt/reply text is still absent from `AICall`.

States: **queued → running → ready**, or **refused / failed**; ready proposals can become
**accepted / discarded**. A ready proposal with unresolved replay conflicts cannot be accepted.
The author can inspect the same proposal after leaving and returning to the page.

Creation checks access, an open draft, current revision and a declared site. Without a model,
return M5.1's refusal immediately. Enqueue only after the transaction commits. A Celery task
claims the proposal once under a row lock, releases the transaction before calling a model, and
stores the result afterwards. Duplicate deliveries do not spend another call. No provider call
runs while a draft row is locked. A worker interrupted mid-call is marked interrupted after its
timeout plus a grace period; a person explicitly requests another proposal rather than an
automatic retry that might spend twice. Removing a user or closing a draft before execution
refuses the queued work.

The worker calls the gateway, then validates the response by applying its single allowed edit to
the captured node snapshot and reading it back with the same validators as a manual save. A bad
shape, unsupported operation, unknown source, invalid figure or unreadable node gives findings;
there is no ready-to-keep invalid candidate. Warnings retain their existing non-blocking meaning.

No model, cap reached, provider refusal or interrupted work leaves the current draft intact.
The page shows the reason and keeps manual editing available. No automatic fallback changes
providers or uses an unconfigured model.

## M5D.4 Preserve human edits; never guess through a conflict

The first AI proposal for an item starts from its current content and requires an explicit
before/after acceptance. For later redrafts, retain the last accepted **raw AI output** as the
AI baseline. Compare that with the current human-edited item and the new raw AI output.

- Text uses deterministic three-way merging of edit ranges. Non-overlapping human changes are
  replayed; identical changes appear once. Overlapping replacements, ambiguous repeated context
  and conflicting insertions produce a conflict, not a best guess.
- Structured content merges by field; arrays are atomic. A human-changed field is preserved when
  the model leaves it alone. Different edits to the same field require an explicit resolution.
- Show raw model changes and replayed human changes separately. A conflict displays all three
  versions and a resolution field. Apply stays disabled until every conflict has an explicit
  choice or edited resolution and the combined result validates. Store the decisions as human
  edits; do not ask the model to adjudicate its own overwrite.

`studio/ai_replay.py` is pure, with no calls or ORM access. It returns a proposed merge and a
machine-readable report. A new redraft replays earlier corrections too, not only edits since the
last save. Discard leaves their history and the current revision unchanged.

**Stale is still stale.** Accept locks the draft, verifies the original revision and open state,
revalidates against today's registries and saves atomically with provenance. If another save or
submission happened while the model ran, refuse with the existing stale/not-open behavior.
Do not silently retarget a moved ordinal or rebase onto a newer draft. The author reloads first.

## M5D.5 Provenance survives editing and landing

Each revision gains an origin map keyed by the same item keys as Review, pointing at accepted
proposal UUIDs and their raw AI baselines. Propagate that map with the **explicit edit operation**:
insert/move/delete remaps keys; editing a surviving item preserves its AI origin and records a
human revision; removing an item removes its current mapping. Resource entries follow their
validated identity. Do not use Review's positional similarity heuristic to infer authorship.
Operations without an unambiguous mapping must report it rather than silently assign an origin.

A receipt records the gateway call, prompt version, model/connection/settings used, source
snapshots, requesting author, applying author and accepted revision. Keep the actual resolved
settings with the call: later changes to the AI settings must not rewrite past provenance.
Only successful model output can be attached, and only to the proposal's own draft and target.

For a figure working copy, carry the proposal UUID and starting-copy digest alongside the
unsaved data. The final save verifies the proposal/target association, runs the normal figure
checks and attaches its origin in the same transaction. Leaving without Save saves no content
or origin. Editing proposed data by hand keeps the AI origin and records the human changes.

Workbench, Review and Studio's learner preview show **AI drafted · not yet reviewed** until
normal review approves that revision. Keep does not clear this label. Changed approved work
requires review again. This part publishes no unreviewed learner content.

Landing includes a validated, versioned `provenance.json` beside the approved node files,
preserved by the reader/writer and index. It records item origins, model/prompt identifiers and
public source references/hashes, not database ids, people’s emails, credentials, private URLs or excerpts.
The reviewed node body remains the artifact; prompts do not promise reproducible prose.
The landing PR can link back to the full Studio receipt. Preserve imported provenance when
opening an indexed node for editing; a new deployment without the original call rows still has
the public receipt. Inline citation presentation remains separate.

## M5D.6 UI and API

The boards specify comparison, conflict, resource and figure states in the existing identity.
The implementation places these panels beside the selected editor; they are not a new rail page.
Wait for pending manual saves before asking. Disable duplicate submission while queued/running.
Poll only an active proposal, once at a time, and stop on leaving or a terminal state.

Author-gated routes below `/api/studio/drafts/{id}/ai`: POST `proposals`, GET `proposals/{uuid}`,
POST `proposals/{uuid}/accept`, POST `proposals/{uuid}/discard`. Accept takes `based_on` and any
explicit conflict resolutions; it returns the updated draft and receipt in one response.
Figure proposals use the normal figure save for final application, carrying their proposal id.
Every route verifies that the proposal belongs to that draft. No approve/land operation is
exposed to a model. New drafting codes use the unallocated CA05xx band; provenance-format
diagnostics use CS12xx, each declared and explained before implementation.

## M5D.7 Done when

1. With no model, all three entry points say why; no call or draft revision is made.
2. A block redraft is queued, validated, compared and kept as one revision with the exact call,
   prompt, sources and settings recorded; Discard makes no draft revision.
3. A human correction survives two redrafts; an overlapping change requires a recorded resolution.
   Duplicate/moved content cannot steal another item's provenance.
4. Editing or submitting while a model runs cannot be overwritten by its late result. Duplicate
   worker deliveries and duplicate Keep requests produce at most one call/application respectively.
5. A resource suggestion uses only declared candidates; an unknown URL/provider/licence is refused.
6. Ask fills the selected figure component's data, with computed fields recomputed by its kit;
   invalid data and a stale working copy cannot silently save. Its final save retains provenance.
7. Review shows the unreviewed origin and sources; approval and landing preserve a public receipt
   which reads back in the index. No private source excerpts or author email enter content files.
8. Gateway-faked API tests, worker/replay tests and web tests cover these paths. A local compatible
   stub exercises the complete flow; walk the boards at 1680 and the app at 1440, light and dark.
   A live ChatGPT plan is not an acceptance gate, as decided for M5.1.

## Decisions and rejected alternatives

- **Proposals before saves.** Rejected: replacing a block when the worker finishes, which can
  overwrite concurrent edits and bypass the author's comparison.
- **Conservative deterministic replay.** Rejected: telling the model to remember corrections,
  which cannot guarantee that they survive; rejected fuzzy auto-resolution of conflicting edits.
- **Explicit source context; candidate resource selection.** Rejected autonomous crawling in this
  part: it needs its own retrieval, permissions and content handling design.
- **Revision-bound receipts plus public provenance.** Rejected: only a call id in Postgres, which
  loses source/model history outside this deployment; rejected mixing AI origin with human saves.
- **One call, no scoring here.** Rejected combining judge/redraft loops with M5.2; that is M5.3.

## Basis

The approved M5 parts list and #447; first design §5.4 (versioned prompts, provenance and human
edit replay); weaving spec W5.2–W5.3 and W9 (validated edits, computed figures, declared sites);
tutor T4, T5.3 and T8 (resources, allowed sources, scoring boundary); M5G.1–M5G.6 (gateway,
caps and call records); the current draft-save transaction and Review key ownership in code.
