# M4.8b — The workbench

**Status: agreed 2026-10-07.** The second slice of M4.8 (#126), issue #221, after M4.8a's sign-in,
team and Studio shell (archived spec `2026-10-07-m4-sign-in-and-team-design.md`). Designed with the
operator in conversation on 2026-10-07, section by section; the new S19 Drafts board was approved
on the M4.8 canvas beside the S3 Workbench board. The drafts API is M4.4's and M4.5's (archived
specs `2026-10-05-m4-drafts-design.md`, `2026-10-06-m4-review-design.md`): open, edit, verify, the
checklist, submit and withdraw. This part draws them.

It decides:

- the scope, against the S3 board (M4K.1);
- one edit path: commands and one executor (M4K.2);
- when an edit saves (M4K.3);
- the request budget (M4K.4);
- the states and edge cases (M4K.5);
- the two small API changes (M4K.6);
- the boards, the build and *done when* (M4K.7).

---

## M4K.1 Scope

**Built:**

- **S19 Drafts** (`/studio/drafts`, authors and above, a new `STUDIO_PAGES` entry): the open
  drafts with *Mine*, *All open* and *In review* views, each row naming the node id, its region
  (the folder's first part), revision, contributors and state — a draft's summary carries no
  title, and reading every draft's files to show one is not worth the request; **New node** (id, title, claim, region,
  level, minutes); **Edit a node that exists** (find it, open a draft of its live version).
- **S3 Workbench** (`/studio/drafts/:id`), as on the board minus what later phases bring:
  - the header: breadcrumb, title, *Draft* and level tags, *Saved … ago*, *Open preview in a new
    tab*, **Submit for review** with the board's *Before you submit* list (the checklist);
  - tabs **Content**, **Resources**, **Links** (needs, goes deeper, related, each with its reason),
    **Settings** (the fields, and Discard), and **Exam pool**, which says it is not built yet
    (M4.8c) and that exam questions are added through the API meanwhile;
  - **Content**: the outline (kind and first words), the blocks edited in place (text as Markdown
    with B, I and Link; try with its question editor; callout), add between blocks (text, try,
    callout), ↑ ↓ and a drag handle to move, delete;
  - the right panel: **Preview** (desktop or phone, drawn by the Node page's `Body`) and **Checks**
    (Verify's problems and the checklist items, in the API's words). A block opens from the
    outline; a click in the preview would land on its try questions' own buttons.

Links and Settings are not named in #126; a new node cannot pass its checks without them, so the
operator put them in.

**Not built** (the board shows them; their phase brings them): the Drafts table's title and level
columns; judge scores, the rubric strip and
*Redraft with AI* (M5); figure, image, math, example and problem blocks (refused by the format
until M6); Cite and Term; *[Reviewer B] is viewing*; History; the Problem tab (hidden); the
outline's per-block problem dots (they need each block's line range from the API).

## M4K.2 One edit path

Every editor produces an **edit command**; one executor sends it — the Command pattern, so no
editor talks to the API.

- **`studio/workbench/edits.ts`** builds each `Edit`: a method, a path under the draft and a body
  without the revision — `fields(change)`, `links(kind, links)`, `insertBlock(at, block, question?)`,
  `updateBlock(at, block, question?)`, `moveBlock(at, to)`, `deleteBlock(at)`, `resources(list)`.
- **`useDraftEdit(id)`** adds the draft's current revision, sends the edit with `sendJson`, and
  writes the answer (`SavedOut.draft`) into the draft's cache entry: the outline, blocks, preview
  and header redraw from it, with no refetch. It marks Checks stale.
- A refusal comes back to the editor that sent it (M4K.3).

## M4K.3 When an edit saves

**An edit saves when you leave what you changed** (the operator chose this over saving while
typing and over Save buttons): a field when it loses focus, a block when its editor closes or you
move to another block. Each editor keeps its text locally and calls one `commit()`; no change, no
request. The header shows *Saved just now*.

- **Someone saved first** (409 CA0203): the editor keeps your text and says *Someone else saved
  this draft; reload to see their change*, with **Reload**. Nothing is merged.
- **The edit would not validate** (422): its problems show inside the editor, which stays open.
- **Unsaved text when leaving the page**: the browser asks first (`beforeunload`).
- **Deleting a try block deletes its question** (the API pairs them); the confirm says so.

## M4K.4 The request budget

The operator's rule: what can run in the browser stays there; requests are few and small.

- Opening the workbench: **one GET** of the draft.
- Each save: **one write**, whose answer redraws everything.
- **Checks: one GET**, `GET /checklist`, which now also carries Verify's problems (M4K.6), fetched
  only while the Checks tab or the Submit list is open; a save only marks it stale.
- **Preview** is drawn in the browser from the cached draft.
- **Regions** come once from `GET /api/studio/index` (M4K.6), cached for good; levels are the
  generated type's five values.
- **Drafts**: one GET of the open drafts; *Mine* is filtered in the browser from contributors;
  *In review* asks `?state=submitted` only when chosen. Finding a node uses `/api/search`.
- **No polling.** The query client's default `staleTime` becomes 60 seconds, so returning to a tab
  does not re-ask every query.

## M4K.5 States

- **Open**: everything edits.
- **Submitted, approved**: read only, with a line naming the state; a submitted draft's
  contributors and operators get **Withdraw** (the API's rule), which reopens it.
- **Landed, discarded**: read only, with a link to the node or back to Drafts.
- **Discard** (Settings): someone who saved the draft or an operator (the API's CA0206 otherwise);
  asks once, in place.
- **Submit** is enabled only when the checklist passes; it says what is missing otherwise.

## M4K.6 Two small API changes

- **`GET /api/studio/drafts/{id}/checklist`** also returns Verify's `problems` (the checklist
  already runs Verify), so Checks is one request.
- **`GET /api/studio/index`** also returns `regions` (`id`, `name`, in `regions.yaml`'s order).

*Rejected:* a `?mine` filter (the browser filters the list it already has); a separate regions
route (the index answer is where the team reads the index).

## M4K.7 The boards, the build and *done when*

**Boards:** S19 Drafts was added to `.design/build_pages.mjs` (with a Drafts entry in every
Studio board's rail) and approved; the Content tab follows S3. **Settings, Links and Resources**
have boards of their own (`WorkbenchSettings`, `WorkbenchLinks`, `WorkbenchResources`), drawn by
`workbench({ tab, body })` inside the S3 board's header and preview, without what this part
leaves out (the writing guide, presence, Problem, Score and the other preview tabs, click to
edit). They were designed on the canvas (https://claude.ai/artifact/1NUmoDUfo1x2oZ7ywhvCxx) from
the S3 board's own markup, then ported to the generator, with the design audit's fixes (#249).

**Folders:** `studio/drafts/` (the page, the new-node form, the open-existing finder);
`studio/workbench/` (the page and header, `Outline`, `BlockList`, `BlockEditor`, `TryEditor`,
`CalloutEditor`, `ResourcesTab`, `LinksTab`, `SettingsTab`, `PreviewPanel`, `ChecksPanel`,
`SubmitButton`, `edits.ts`); small files, one job each.

**Tests:** vitest with `answering` — each command's method, path and body with the revision
added; a save written into the cache with no refetch; Checks asked only while shown; stale and
refused saves keep the text; the states; the preview drawn from the cache; Drafts' create, open
and *already has a draft*. pytest for the checklist's problems and the index's regions.

**Done when**, in a browser against the running stack, beside the S19 and S3 boards (light at
1440, and dark): an invited author creates a node from Drafts; writes text, a try question and a
callout; adds a resource, a *needs* link and the settings; the Checks tab passes every item but
the exam pool's; four exam questions are seeded through the API; the checklist passes and the
author submits; the draft then reads as submitted, and Withdraw reopens it.

## Not in this part

The exam pool's builder (M4.8c); review and land screens (M4.9); scores and AI (M5); the blocks M6
brings; per-block problem dots; History; presence.
