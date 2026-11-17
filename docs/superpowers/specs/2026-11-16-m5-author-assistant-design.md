# M5.5 — The author assistant

Part of M5 (#450), completing the first AI authoring loop. The S15 chat is tied to one open draft
node. It uses the declared `assistant` site to turn author requests into a short list of proposed
block actions. Each action runs through M5.2's existing proposal API and worker; it remains private
and requires the author to compare and keep or discard it.

## What it does

An author chooses an open draft and starts or resumes a private conversation about that node. The
assistant receives the node claim, level, current revision and a bounded outline of existing blocks,
along with the recent turns. It may answer in words and propose up to three replacements for
existing blocks. A proposed action names an exact block target and a short instruction. The API
checks the target against the current revision before creating a normal M5.2 proposal.

The existing worker validates the candidate, M5.3 scores it, and the author sees the normal
revision-bound comparison and Keep/Discard controls in the conversation card. No chat response or
proposal edits a draft by itself. A kept proposal creates exactly one normal revision and continues
through existing checks, Review and landing.

## Scope and permissions

- `/studio/assistant` is available to authors and higher roles. Each session belongs to one open
  draft and its creator; another team member cannot read that transcript through this page.
- One turn can propose at most three edits to existing `block/<ordinal>` targets. It cannot create
  or remove blocks, change node fields, links, resources, images, figures, questions, problems,
  approval, publication or landing state. Authors use the existing editors for those operations.
- Every action is a standard `page-drafting` proposal, with its existing validation, score,
  provenance and revision checks. A stale draft makes the action fail visibly and asks the author
  to reload.
- The assistant uses the operator-configured `assistant` gateway site. Calls are recorded with the
  author and draft, but no message or reply is added to `AICall`. Conversation text is stored in
  private Studio session rows for continuity.

## Conversation and bounded work

- A user turn is plain text, 1–4,000 characters. A session holds at most 20 turns; each call sees
  the most recent 12 turns plus current draft context.
- The model reply is a closed schema: an answer of at most 2,000 characters and zero to three
  actions. Each action has an existing target and an instruction of at most 1,000 characters.
- The server rejects unknown, duplicated and stale targets. It does not repair or retry malformed
  replies. A provider refusal is shown as a short assistant response and creates no action.
- Messages and actions are persisted before the response returns. Action creation is idempotent;
  polling or retrying a request cannot enqueue a second proposal for the same action.
- Each proposal uses the existing drafting cap and worker. Total calls per turn are bounded by one
  assistant call plus three draft calls and three judge calls; each has its normal timeout and cap.

## Surface

Use the existing S15 / Studio visual language: a draft picker and recent sessions, a readable turn
list, a single message composer, and action cards showing target, instruction and proposal state.
Ready cards open the existing comparison/Keep/Discard UI, so the assistant does not introduce a
second acceptance flow. Loading, no-model, stale-draft and failure states preserve the normal
workbench and remain actionable.

## Privacy and safety

- No learner data, account secrets, unrelated drafts, private source excerpts or arbitrary external
  URLs enter the prompt. The assistant has no network tools and cannot name a target outside the
  current draft's block list.
- The prompt treats node content and user messages as untrusted text. Reply shape and target allowlist
  are enforced by the server.
- The session is scoped to its creator and draft. Only normal proposal content reaches the existing
  author/reviewer API, with existing permissions and provenance rules.
- The assistant cannot call arbitrary endpoints. It can only create standard proposals for current
  blocks; every proposed edit still needs the author to keep it.

## Acceptance checks

1. An author can create, read and continue a private session attached to an open draft; other users
   cannot read it, and submitted/closed drafts cannot receive turns.
2. A typed assistant reply creates at most three idempotent M5.2 block proposals for exact current
   targets. Invalid targets and malformed replies create none.
3. The author can inspect each proposal and use existing Keep/Discard behavior; no proposal is
   accepted automatically, and Keep uses the normal revision-bound save.
4. The model receives only bounded recent turns and public draft content needed for the task; the
   gateway record contains author/draft metadata but no prompt or reply text.
5. Call caps and timeouts bound every call. Provider refusal leaves the conversation usable and the
   draft untouched.
6. The Studio Assistant page is reachable for authors, presents prior sessions and proposal states,
   and keeps ordinary editing and review paths intact.

## Decisions

- Sessions attach to one open draft node. Requests and route chats stay outside this first slice:
  M5.2 exposes reliable revision-bound edits for drafts, while those other contexts do not yet have
  equivalent proposal targets.
- The assistant proposes replacements for existing blocks only. New nodes, graph changes and
  direct saves are rejected because the normal authoring API already gives each a distinct review
  path.
- Proposal generation runs through M5.2 instead of returning free-form edits from the assistant.
  This reuses schema validation, bounded judging, provenance, conflict handling and explicit Keep.
