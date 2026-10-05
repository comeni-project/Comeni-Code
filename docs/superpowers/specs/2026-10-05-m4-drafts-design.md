# M4.4 — Drafts, the content API, and checks

**Status: agreed 2026-10-05.** The fourth part of M4 (#74), issue #122. Designed with the operator
in conversation on 2026-10-05, section by section. It answers the two questions the M4 parts list
left to this spec: whether a draft locks its node (M4W.1) and how a draft relates to the index
(M4W.2).

It decides:

- the design's vocabulary, from known patterns (M4W.0);
- what a draft is, and who may change it (M4W.1);
- where a draft starts (M4W.2);
- what a draft stores, and how a save works (M4W.3);
- the content API (M4W.4);
- verify and the pre-submit checklist (M4W.5);
- the build and *done when* (M4W.6).

**No screens** (the workbench is M4.8), **no AI** (M5), **no review or landing** (M4.5, M4.6).

---

## M4W.0 The vocabulary

The design matches four known patterns, and the code is named after them:

- **A read model (CQRS).** The source of truth is the content repository's files. The index is a
  projection of them — the read side — rebuilt from the files and never edited (R3). A draft is
  the write side: commands change a draft, never the index. Landing is how a write reaches the
  source of truth, and the index catches up by rebuilding.
- **A working copy**, as git's working tree is to `HEAD`: a draft is checked out from a known
  index build, its **base version**.
- **Optimistic concurrency** (HTTP's `If-Match`, compare-and-swap): every save names the revision
  it was based on, and M4.6 will check the base version before landing. Nothing is overwritten
  silently.
- **Snapshots** (memento): each save stores the draft's whole state, so any two versions compare
  and any one restores.

## M4W.1 A draft, one per node, open to the team

**`Draft`**, the working copy: `public_id` (a UUID, as users and invites have); `node_id` and
`folder` (where the node lives in the content repository); `state`, `open` or `discarded` (M4.5
adds `submitted` and `approved`, M4.6 `landed`); `base_digest`, the index build it started from,
empty for a new node; `created_by`, `created_at`.

**One open draft per node**, held by a partial unique constraint in Postgres (`node_id` where the
state is `open`), so two requests racing cannot make a second. Opening a draft of a node that has
one is **409**, naming the draft and its contributors. *Operator: "better to work on versions of
one node than many of the same."*

**`Revision`**, one immutable snapshot per save: `draft`, `number` (1, 2, … within the draft),
`node_yaml`, `body_md` and `exam_yaml` (empty without a pool) — the files exactly as they would
land — `saved_by`, `saved_at`, and `change`, a short line saying what the save did (for M4.8's
History panel). The draft's state is its latest revision. Its **contributors** are everyone who
saved a revision.

**Any author or above may open, edit and discard any open draft.** *Operator: better for the
long-term health of the content.* Two consequences:

- M4.5's *nobody approves what they drafted* reads **nobody approves a draft they contributed to**.
- Two people saving one draft at once: each save names the revision it was based on; a save on a
  stale revision is **409**, naming the current revision and who saved it.

**Discard:** a contributor or an operator. The draft and its revisions stay, and the node is free
for a new draft. Drafts sit outside the index and name nodes by id (R1), so a rebuild never
touches them. Learners never see a draft.

*Rejected:* **several drafts per node**, merged at landing — a git-style merge inside Studio that
nothing in M4 needs. **Only the draft's author edits it** — clearer ownership, but the operator
chose shared drafts.

## M4W.2 A draft starts from the index

A draft of an existing node is read from the index: its rows become a `code-schema` `Node`, and
the canonical writer turns that into exactly the files in the content repository (M4.2 proved the
writer byte for byte). The draft records the build's digest as its base version. **The test that
makes this safe: every fixture node goes index → `Node` → files byte for byte.**

**The index keeps the whole provider registry.** Its `Provider` table holds only id and name
today, but a draft's resources are checked against a provider's licences, embedding and players.
It gains them (a migration), so a draft is validated exactly as CI validates the files.

A **new node** starts as an empty draft from an id, title, claim, region and level; its folder is
the region's, as the fixtures lay them out.

*Rejected:* **starting from a checkout of the content repository** — the literal source, but it
needs M4.7's worker a part early, and the index is already a lossless, versioned projection.

## M4W.3 A draft stores its files; a save re-reads them

A draft stores its node's files as text. **A save:**

1. reads the latest revision, after checking it is the one the caller named;
2. parses its files with `code-schema` into a `Node`;
3. applies the edit — a pure function in **`code_schema.edits`**, `Node` in, `Node` out, with no
   Django, which M5's assistant will call too;
4. writes the files with the canonical writer;
5. **reads them back with `code-schema`**, with the index's regions and providers — the parse
   `validate` and CI run;
6. on any error answers **422** with the problems and saves nothing; otherwise stores a revision,
   answering with it and any warnings.

`code-schema` gains **`parse_node_files(node_yaml, body, exam_yaml, …)`**, the parse of a node
from its three texts, and `read_node` uses it, so a folder and a draft are read by one path.

*Operator:* one format from draft to git, which also eases any later migration.

*Rejected:* **structured JSON** in the draft — a second representation of a node to keep in step
with `code-schema`, and every save would still write files to validate. **A row per block** — the
most tables, and the node is still reassembled and checked whole on every save.

## M4W.4 The content API

Under `/api/studio/drafts`, behind `studio(Role.AUTHOR)`:

- **drafts:** open (an existing node, or a new one); list the open ones; read one — its current
  revision number, contributors, and the node as JSON (fields, links, blocks, resources, try
  questions, exam pool); list its revisions; read one revision's files; discard.
- **edits**, each carrying the revision it was based on:
  - `PATCH …/fields`: title, claim, region, level, minutes;
  - `PUT …/links/{needs|goes-deeper|related}` replaces that list — short lists, and the rule
    across kinds (CS0111) needs the whole picture;
  - blocks, W5.2's calls: insert at a position, update, move, delete, by position checked against
    the revision;
  - **a try question travels with its block**: inserting a `try` block carries its question,
    deleting the block deletes the question, and the question is edited through its block.
    `code-schema` refuses a question without its marker (CS0405) and a marker without its question
    (CS0403), so two separate saves could never pass;
  - `PUT …/resources` replaces the list;
  - the exam pool, a question at a time: add, update, delete. A pool of 1–3 saves with CS0813's
    warning, so it is built a question at a time.
- **errors:** a refused save is **422** listing each problem as `code-schema validate` prints it
  (file, line, code, message); warnings never refuse. Draft codes take a new band,
  **`CA0200–CA0299 · drafts`**: no such open draft, one already open, a stale revision, a block
  position out of range, and so on.

## M4W.5 Verify and the checklist

**`GET …/verify`** runs the rules that need the whole graph (`code-schema`'s graph rules): link
targets exist, *related* is on both nodes, *goes deeper* never points down, no *needs* cycle. It
checks the draft's node in place of its indexed version, against everything else in the index; a
link to another draft's new node is missing until that node lands.

**`GET …/checklist`**, M4's bar, each item passed or not with its reason: it verifies clean; it
has a level; at least one resource; at least four exam questions. Submitting is M4.5's and will
require it.

## M4W.6 The build and done when

One plan of about eight test-first tasks, a fresh reviewer after the core and over the branch:
index → `Node`, with the round-trip test, and the provider registry in the index;
`parse_node_files`; the edits in `code-schema`; `Draft`, `Revision` and the save; *(checkpoint)*;
the edit API; verify and the checklist; wiring and close.

**M4.4 is done when:**

1. Every fixture node goes index → files byte for byte.
2. **A new node built only through the API writes files `code-schema validate` accepts**, beside
   the fixtures (#122's check).
3. A bad save answers with the validator's exact message and makes no revision.
4. **Three exam questions fail the checklist**; four pass.
5. A second open draft of a node is 409; so is a save on a stale revision.
6. Verify catches a link to a missing node, and a *needs* cycle the draft makes.

## Open, for later parts

- **A *related* link is on both nodes**, so adding one needs the other node's draft too, and verify
  reports the missing half until both land. M4.6 decides whether drafts land together, in one
  pull request.
- **The base-version check at landing** is M4.6's: a draft whose node changed in the content
  repository since its base is refused, not overwritten.

## Not in this part

Submitting, review and approval (M4.5); landing (M4.6); the workbench screens (M4.8); AI drafting
(M5); figures and the other block kinds (M6).
