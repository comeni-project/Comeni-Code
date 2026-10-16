# M6.1 Linked drafts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verify, the checklist and Checks see every live draft as a node; landing refuses a batch
missing a draft it links to and says to tick it; Land and the Links tab show what links to drafts.

**Architecture:** `studio/drafts.py` gains one helper that finds a node's links to drafts not
landed, and verify runs the graph rules twice (with and without the draft) to keep only the
problems the draft carries or causes. `landing.start` uses the same helper before its unchanged
in-place check. Two read additions (a ready row's `needs`, `GET /api/studio/index/nodes`) feed the
Ready table's hint and the Links tab's suggestions.

**Tech Stack:** Django + Django Ninja, pytest (Compose's Postgres), React + TanStack Query, vitest.

**Spec:** `docs/superpowers/specs/2026-10-16-m6-linked-drafts-design.md` (M6LD.1–M6LD.5), #328.

## Global Constraints

- Live drafts are `LIVE_STATES` (open, submitted, approved); discarded and landed are not.
- CA0224: `emitted_by: api`, `concern: drafts`, `refuses: false`; message
  `<kind> <target>, a draft that has not landed`, kind written with a space (`goes deeper`).
- CA0312: `emitted_by: api`, `concern: landing`, `refuses: true`; one problem per missing link, on
  the needing draft's `node.yaml` at the link's line, worded exactly:
  `<b> needs <a>: tick it too.` · `<b> needs <a>, which is not approved yet.` ·
  `<b> needs <a>, which is landing in <landing public id>: land this after it merges.`
  (`needs` is the kind's verb: `needs`, `goes deeper to`, `is related to`.)
- Landing's in-place check stays index + batch; CA0312 is checked before it, after CA0302/CA0303.
- `code-schema` is not changed (purity, pinned messages).
- After any API change: export `apps/api/openapi.json`, then `npm run api-types`.
- Tests never read the content repository; they rebuild the index from `tests/fixtures/salmon`.

## Review Focus

1. A draft that no longer parses (`node_of` returns `None`) among the live drafts: it stays out of
   the graph and does not crash anyone else's verify.
2. A live draft of an *indexed* node linked from another draft: a link to a node, no CA0224.
3. Two drafts each `needs` the other (a cycle of new nodes): CS0504 shows on both drafts.
4. A batch where the needed draft is itself in the batch: no CA0312.
5. A discarded needed draft: CS0501 returns on the needing draft, and the suggestion list drops it.

---

### Task 1: Verify sees every live draft (M6LD.1, M6LD.2)

**Files:**
- Modify: `apps/api/src/code_api/studio/drafts.py` (`in_place`, `_checked`; new helpers)
- Modify: `packages/code-schema/src/code_schema/diagnostics.yml` (CA0224 after CA0223)
- Regenerate: `docs/reference/diagnostics.md`
- Test: `apps/api/tests/test_linked_drafts.py` (new)

**Interfaces:**
- Produces: `unlanded_links(node: Node, indexed: set[str], live: dict[str, Draft]) -> list[tuple[str, str]]`
  — `(kind, target)` for each link whose target is not in `indexed` and is a live draft's node id,
  in link order (needs, goes-deeper, related).
- Produces: `live_drafts() -> dict[str, Draft]` — node id → live draft.
- Produces: `indexed_ids() -> set[str]`.
- `in_place(standing: list[Draft]) -> list[Problem]` keeps its signature and meaning.

- [ ] **Step 1: Write the failing tests** in `test_linked_drafts.py`, with the index rebuilt from
  the fixtures, an author `ada`, and two new drafts opened by `drafts.open_new` in region
  `transcriptomics` (`a`, then `b` whose `needs` is `[Link("a", "B needs A for the test.")]` saved
  with `code_schema.edits.set_links`):
  - `test_a_link_to_a_live_draft_is_a_warning`: `drafts.verify(b)` has exactly one problem, code
    `CA0224`, message `needs a, a draft that has not landed`, file `transcriptomics/b/node.yaml`,
    a line number, `refuses` false.
  - `test_another_drafts_own_problem_does_not_show`: give `a` a `related` link to `no-such-node`;
    `verify(b)` has no CS0501; `verify(a)` has it.
  - `test_a_problem_a_draft_causes_elsewhere_shows_on_it`: open `tpm` from the index and add a
    `related` link to `salmon` (which does not list `tpm`); `verify(tpm)` has CS0502.
  - `test_a_cycle_of_two_drafts_shows_on_both`: `a` needs `b`, `b` needs `a`; both verify with
    CS0504.
  - `test_a_discarded_draft_is_not_a_node`: discard `a`; `verify(b)` has CS0501 for `a`.
  - `test_a_live_draft_of_an_indexed_node_is_just_a_node`: open `tpm` from the index; `b` needs
    `tpm`; `verify(b)` is empty.
  - `test_a_draft_that_does_not_read_stays_out`: corrupt `a`'s latest revision's `node_yaml` to
    `"title: [\n"` directly in the database; `verify(b)` returns CS0501 for `a`, no exception.
  - `test_the_checklist_passes_verify_with_a_warning`: `drafts.checklist(b)`'s *verifies clean*
    item passes.

- [ ] **Step 2: Run them, expect failures** —
  `uv run pytest apps/api/tests/test_linked_drafts.py -q`: the CA0224 and CS0501-for-`a` tests
  fail (verify sees only the index today), and `diagnostic("CA0224")` raises.

- [ ] **Step 3: Declare CA0224** in `diagnostics.yml` after CA0223 (`says: a link to a draft that
  has not landed`, a `fix` saying it lands with that draft or after it, an `explanation` citing
  M6.1, M6LD.1), then `uv run code-schema diagnostics --write docs/reference/diagnostics.md`.

- [ ] **Step 4: Implement** in `drafts.py`:
  - split `in_place`'s index read into `_index_nodes() -> tuple[dict[str, Node], dict[str, str]]`
    (under the shared rebuild lock, as now) and a `_graph(nodes, folders) -> list[Problem]` that
    locates link lines and runs `graph_problems`; `in_place` composes them unchanged;
  - `_checked(draft)`: `node_of(draft)`; if `None`, return its own problems. Else place every
    other live draft that reads (`node_of`, own problems dropped) over the index, then
    `with_draft = _graph(...)` with the draft placed and `without = _graph(...)` with the draft's
    indexed node restored (or its id removed when new). Shown = own problems + every problem of
    `with_draft` whose file starts with `f"{draft.folder}/"` or that is not in `set(without)`,
    + one CA0224 per `unlanded_links(node, indexed_ids(), live_drafts())`, at
    `locate_links(write_node_yaml(node), file=...)`'s line; sorted by `Problem.sort_key`.

- [ ] **Step 5: Run** `uv run pytest apps/api/tests/test_linked_drafts.py apps/api/tests/test_draft_checks.py tests/schema/test_diagnostics.py -q` — all pass.

- [ ] **Step 6: Commit** — `feat(studio): verify sees every live draft (#328)`.

### Task 2: Landing tells you to tick it (M6LD.3)

**Files:**
- Modify: `apps/api/src/code_api/studio/landing.py` (`start`; a `NeedsDrafts` exception)
- Modify: `apps/api/src/code_api/studio/landing_api.py` (422 `RefusedOut`, code CA0312)
- Modify: `packages/code-schema/src/code_schema/diagnostics.yml` (CA0312), regenerate the reference
- Test: `apps/api/tests/test_landing_start.py`, `apps/api/tests/test_landing_api.py`

**Interfaces:**
- Consumes: `drafts.unlanded_links`, `drafts.live_drafts`, `drafts.indexed_ids` (Task 1).
- Produces: `class NeedsDrafts(Exception)` with `problems: list[Problem]` (dataclass, like
  `BatchFails`).

- [ ] **Step 1: Write the failing tests** in `test_landing_start.py`, with two new drafts `a` and
  `b` (b needs a) built as in Task 1 and approved with the file's `approved`-style helper:
  - `test_a_batch_missing_an_approved_draft_says_tick_it`: start `[b]` → `NeedsDrafts`, one
    problem, CA0312, message `b needs a: tick it too.`, file `transcriptomics/b/node.yaml`.
  - `test_a_needed_draft_not_yet_approved_is_named`: `a` open → `b needs a, which is not approved yet.`
  - `test_a_needed_draft_in_a_live_landing_says_wait`: start `[a]` first, then `[b]` → message
    ends `which is landing in <a's landing public_id>: land this after it merges.`
  - `test_the_needed_draft_in_the_batch_lands_together`: start `[b, a]` → a pending landing.
  - In `test_landing_api.py`, `test_a_missing_needed_draft_is_422_ca0312`: POST `[b]` → 422,
    `code == "CA0312"`, one problem whose `text` contains `tick it too`.

- [ ] **Step 2: Run them, expect failures** (today CA0305 with CS0501).

- [ ] **Step 3: Declare CA0312** (`says: a batch without a draft it links to`, `concern: landing`)
  and regenerate the reference.

- [ ] **Step 4: Implement** in `start`, after the approval and live-landing checks and before
  `in_place(batch)`: for each batch draft that reads, each `unlanded_links` target not among the
  batch's node ids gives one CA0312 problem worded by the target's state (`live_landing(target)`
  first, then approved, else not approved); raise `NeedsDrafts` if any. The API maps it to
  `Status(422, RefusedOut(detail="The batch needs drafts it does not carry.", code="CA0312",
  problems=[...]))`.

- [ ] **Step 5: Run** `uv run pytest apps/api/tests/test_landing_start.py apps/api/tests/test_landing_api.py -q` — pass.

- [ ] **Step 6: Commit** — `feat(studio): landing names the drafts a batch needs (#328)`.

### Task 3: The reads Land and Links need (M6LD.3, M6LD.4)

**Files:**
- Modify: `apps/api/src/code_api/studio/landing.py` (`Ready.needs: list[str]`)
- Modify: `apps/api/src/code_api/studio/landing_api.py` (`ReadyDraftOut.needs`)
- Modify: `apps/api/src/code_api/studio/schemas.py` (`ReadyDraftOut.needs: list[str]`,
  new `LinkTargetOut(id: str, title: str, draft: bool)`)
- Modify: `apps/api/src/code_api/studio/index_api.py` (`GET /nodes`)
- Regenerate: `apps/api/openapi.json`, `apps/web/src/api/schema.ts`
- Test: `apps/api/tests/test_landing_ready.py`, `apps/api/tests/test_index_api.py`

**Interfaces:**
- Produces: `GET /api/studio/index/nodes` (any member) → `list[LinkTargetOut]`: every indexed
  node (`draft: false`, title from the index) and every live draft of a node not in the index that
  reads (`draft: true`, title from its latest revision), sorted by id.
- Produces: ready rows carry `needs`: target ids of `unlanded_links` for the draft, in link order,
  without duplicates.

- [ ] **Step 1: Write the failing tests**: `test_a_ready_row_names_the_drafts_it_needs` (b needs
  a, both approved → b's row `needs == ["a"]`, a's `[]`); `test_link_targets_list_nodes_and_drafts`
  (26 fixture nodes with `draft: false`, a new draft `a` with `draft: true` and its title; a
  discarded draft absent; an author may read it).
- [ ] **Step 2: Run them, expect failures.**
- [ ] **Step 3: Implement**, export the schema
  (`uv run python apps/api/manage.py export_openapi_schema --api code_api.api.api --sorted --indent 2 --output apps/api/openapi.json`),
  then `npm run api-types` in `apps/web`.
- [ ] **Step 4: Run** the two test files and `uv run pytest apps/api/tests/test_openapi_and_docs.py -q` — pass.
- [ ] **Step 5: Commit** — `feat(studio): ready rows name their needed drafts; link targets (#328)`.

### Task 4: The screens (M6LD.3, M6LD.4)

**Files:**
- Modify: `apps/web/src/studio/land/ReadyTable.tsx` (a *needs a, b* line under the node id)
- Modify: `apps/web/src/api/drafts.ts` (`fetchLinkTargets`), `apps/web/src/api/queries.ts`
  (`queryKeys.linkTargets`, `useLinkTargets()`)
- Modify: `apps/web/src/studio/workbench/LinksTab.tsx` (one `<datalist id="link-targets">`),
  `LinkList.tsx` (`list="link-targets"` on the Node input)
- Test: `apps/web/src/studio/land/LandPage.test.tsx`, `apps/web/src/studio/workbench/LinksTab.test.tsx`

**Interfaces:**
- Consumes: `ReadyDraftOut.needs`, `LinkTargetOut`, `GET /api/studio/index/nodes` (Task 3).
- Option label: `${title} · draft` for a draft, `title` for a node; value is the id.

- [ ] **Step 1: Write the failing tests**: a ready row with `needs: ["a"]` shows `needs a`; a
  422 CA0312 refusal's problem shows under the row whose folder it names (the existing `under`
  path); the Links tab renders a datalist with an option `a` labelled `A · draft` and the Node
  inputs point at it.
- [ ] **Step 2: Run** `npm test -- --run src/studio/land src/studio/workbench/LinksTab` — fail.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm run lint && npm run typecheck && npm test -- --run` — pass.
- [ ] **Step 5: Commit** — `feat(web): Land names needed drafts; links suggest nodes and drafts (#328)`.

### Task 5: The walk, and done when (M6LD.5)

- [ ] **Step 1:** Run CI's commands (CLAUDE.md) with CI's `env:`; all green.
- [ ] **Step 2:** Walk *done when* 1–5 against `runserver` and `npm run dev` with the fixtures'
  folder index (GitHub App settings unset for the walk) as an author and an operator; defects
  found get an issue each and a test-first fix.
- [ ] **Step 3:** Journal entry; the spec's status line to *built*; commit
  `docs: M6.1 — the build in the journal (#328)`.
