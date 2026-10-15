# M4.9c — The land screen

**Status: agreed 2026-10-15 in conversation; this spec awaits the operator's review.** The third
slice of M4.9 (#127), the last part of M4 (#74). Designed with the operator on 2026-10-15, section
by section, from the board *S10 · Land* (`land()` in `.design/build_pages.mjs`, approved on the M4
canvas). It puts a screen on M4.6's landing (archived spec `2026-10-06-m4-landing-design.md`,
M4L.1–M4L.6) and M4.7's index (archived `2026-10-06-m4-following-design.md`).

It decides:

- what the screen reads, and the three small additions to the API (M4LS.1);
- how the screen keeps up with a landing in progress (M4LS.2);
- the screen (M4LS.3);
- the build, the walk and *done when* (M4LS.4).

**No real landing** (M4.9d: the GitHub App is registered then, by the operator), **no AI** (M5).

---

## M4LS.1 What the screen reads

Opening Land is three GETs: the ready list, the landings, the index. Nothing else is fetched until
an action.

**`GET /api/studio/landings/ready`**, operators only (the landing router's guard): every approved
draft with no live landing, in node order. Each row:

| Field | From |
|---|---|
| `public_id`, `node_id`, `folder` | the draft |
| `revision` | the approved revision (`submitted_revision`) |
| `region` | the region's name, from the approved revision's fields |
| `approved_by`, `self_approved` | the draft's last approval event |
| `files` | `[{file, change}]`: `file` is `node`, `body` or `exam`; `change` is `new`, `changed` or `removed` |

**Files** compare the approved revision with revision 1, which holds the live node's files as the
draft started from them (`drafts._start`). A new node (no `base_digest`) has every file it carries
`new`. A file equal on both sides is left out. An exam present at revision 1 and empty now is
`removed`. All of it is read from Postgres; the screen draws `+node ~body -exam`.

**`LandingOut` gains `landed`**: true when the landing merged and every draft still in it is
`landed` (M4F.3), so the landing card can mark its last step.

**`IndexOut` gains `follow_seconds`**, from `FOLLOW_SECONDS`, so *Follows main every 5 minutes*
comes from the setting, not from words in the screen.

No new codes: starting answers CA0301–CA0305 and closing CA0309–CA0311, as M4L.5 has them.
`openapi.json` and `schema.ts` are regenerated.

Rejected:

- **Region, approver and files on `DraftSummaryOut`**, read with `?state=approved`. One route
  fewer, but every drafts list would pay for the approval lookup and the comparison. *Operator: A,
  a ready route*, as M4.9b's review queue.
- **Dropping Files and Region**, reading the drafts list as it is. Least code, short of the board.
- **Files against GitHub's `main`**: a call per draft on every open, and the landing checks the
  batch in place when it starts anyway (M4L.3).

## M4LS.2 Keeping up with a landing

The landing runs in the worker; the watcher reads its pull request every 120 s
(`WATCH_LANDINGS_SECONDS`), and a merge asks the index to follow at once.

**The screen asks `GET /landings/{id}` every 15 s, only while that landing is moving**: pending,
open, or merged and not yet `landed`. It stops once the landing settles. When the landing it
watches settles, it refetches the ready list and the landings once. A settled screen asks nothing.

Rejected:

- **No polling, a *Check now* button and a refetch on focus.** Fewest requests, but the steps do
  not move while the operator watches.
- **Polling at the server's pace, 60 s.** The first steps take seconds and would seem to stall.
  *Operator: A, 15 s while moving.*

## M4LS.3 The screen

`apps/web/src/studio/land/`, at `/studio/land`.

**The rail** gains *Land* after Review, operators only: one entry in `STUDIO_PAGES`. No count
beside it: a count of drafts waiting would be a backlog number (invariant 10).

**The views**, as tabs above the table: *Ready to land · Landing · Landed · Failed*. Each count is a
measurement of its list, as on the board.

| View | Lists |
|---|---|
| Ready to land | the ready route's rows |
| Landing | landings pending or open, and merged ones not yet `landed` |
| Landed | merged landings that are `landed` |
| Failed | failed landings first (they hold their drafts until closed), then refused and closed ones, as ended |

**Ready to land** is the board's table: a box, the node (it opens its draft in the workbench),
region, revision, *Approved by* (with *self-approved*), files. Picking rows shows the bulk bar,
*Land N drafts as one pull request*. Starting a landing refetches the ready list and the landings
and selects the new landing. A refusal is said above the bulk bar: CA0305's problems beside the
drafts they name; every refusal in the API's own sentence (CA0301: *Landing is not configured*).

**The other views list landings, one row each**: its pull request (#42, linked), its nodes, who
started it, when, its state. Picking a row shows its card. *Operator: A, a row per landing.*

**The side panel**, as the board:

- **The landing card**: the live landing if there is one, else the picked row's. Its five steps
  follow the state:

  | Step | Done when |
  |---|---|
  | Checked in place against the index | past pending |
  | One commit, opened as a pull request | `pull_number` is set |
  | Its checks are running | the current step while open |
  | Merged into main | merged |
  | The index follows main | `landed` |

  *In this landing* lists its drafts at their revisions; a dropped draft is said in red (`open`)
  with its code and reason, as the board has it. A refused landing shows its reason in place of
  the steps.
- **The failed card**, for each failed landing: its reason and *Close the landing*. Closing
  refetches the landings and the ready list: the drafts come back.
- **Main and the index**: main's head and when it was checked, the live build and its node count,
  *Follows main every {follow_seconds}*, and *Up to date* or *Behind main* from `behind`.

Red is spent only on the *Failed* tag and a dropped draft, as on the board; settled states spend
none (invariant 11).

Rejected:

- **A row per draft in Landed and Failed.** Closing a failed landing would act on several rows at
  once, and the pull request would repeat on each.
- **No tables beyond Ready**, the views only switching cards. Past landings could not be browsed.

## M4LS.4 The build, the walk, and done when

Test-first, in this order, each step a sub-issue of #127's M4.9c:

1. The ready route: rows, approver, self-approval, files (a new node, a changed body, a removed
   exam, an unchanged file left out); operators only.
2. `LandingOut.landed`, `IndexOut.follow_seconds`; `openapi.json` and `schema.ts`.
3. The queries in `queries.ts`, and *Land* in the rail.
4. Ready to land: the table, picking, the bulk bar, starting, the refusals.
5. The landing views and rows, the landing card and its steps, the poll that stops.
6. The failed card and *Close*; the index card.
7. Docs: the spec's notes from the build, the layout line in `CLAUDE.md`.

A fresh reviewer over the branch at the end.

**The walk.** Landing cannot run for real until M4.9d registers the GitHub App; locally, *Land*
answers CA0301. So the walk takes, against `runserver` and `npm run dev`: the ready list with real
files and approvers, picking, and CA0301 said on screen; then landings seeded in the shell in each
state (pending, open with a pull request, merged and `landed`, failed with a dropped draft,
refused) to compare every view, card and step with the board at 1680 px, in light and in dark.
The path from pull request to index is M4.9d's walk.

Rejected: **a fake GitHub wired into the dev server.** It would put a test path in the product's
settings.

**Done when:**

- Through the API, with the tests' fake GitHub: an operator reads the ready list, lands two drafts
  with one dropped and its reason given; the landing reads open, then merged, then `landed`; a
  failed landing is closed and its drafts are back in the ready list. A non-operator is refused.
- In vitest: the same flow on the screen; the poll runs while a landing moves and stops when it
  settles.
- The full checks pass with CI's environment, and the walk above matches the board.

## Not in this part

The first real landing, the app's registration and `providers.yaml` in the content repository
(M4.9d); webhooks; a rebase tool for a stale draft; search and saved views on Land; scores (M5).
