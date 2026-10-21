# M6.5 — The figure composer

**Status: draft 2026-10-21.** The fifth part of M6 (#325), issue #332. Designed with the operator
on 2026-10-21. Boards on the M6 canvas (https://claude.ai/artifact/JL1PkAjBQKv6o493XDgCoR:
*S4 · Figure composer — Choose*, *Data: a chart* and *Data: a flow with a problem*), drawn for
this scope beside the whole S4 board (`.design/FigureComposer.dc.html`), which stays the target
for what comes later. Builds on M6.4 (`docs/superpowers/specs/2026-10-20-m6-figures-design.md`).

M6.4 left the workbench editing a figure as its YAML file in a text box. The composer replaces
that box: an author fills a figure's data in sheets and a form, sees it drawn as they type, is
told exactly which cell is wrong, and saves once. The file stays the source of truth, kept as
written.

**In M6.5**: the steps **Choose**, **Data** and **Describe**; a preview at desktop, phone and
dark; checks that go to the field to fix; **Edit as YAML** beneath the sheets.

**Left out, and where each went** (operator, 2026-10-21: *"document what you are leaving out
correctly so it does not get lost"*):

| Left out | Why | Where it is now |
|---|---|---|
| The **Interaction** step, interaction states in the preview, the *Every state draws* check | nothing is interactive until domain components | M6.6, #333 (commented there) |
| The **Ask** box: a described change made by a model | a model call; needs M5's gateway, judge and *not yet reviewed* label | #383 (`deferred`), for M5 |
| The **pinned component version** (*v1.3 · Try v1.4*) | dropped, not deferred: M6.4 ruled a schema only widens, and a change that would refuse a valid file is a new component name (M6FG.2) | this spec; M6.4's spec |
| **Used in N nodes** | a figure belongs to one node's folder; it is never shared across nodes | replaced by *placed N times in this node* (M6CO.6) |
| Domain components in the gallery (`kmer-graph`, `read-tiling`, …) | M6.6 | #333 |
| Layered charts (`layer`) in the form | the form edits one mark and its encoding; a layered chart opens in **Edit as YAML** | this spec (M6CO.3); widened when content needs it |

## M6CO.1 Where it lives

**A page of its own**: `/studio/drafts/:id/figures/:stem?block=<n>` to edit, and
`/studio/drafts/:id/figures/new?at=<n>` to add, with Studio's rail collapsed (W-spec S-section:
focused-work pages are drawn collapsed). It replaces M6.4's figure arm of `BlockEditor` (the YAML
text box) and `FigureAdder`.

Reached from:

- a figure block's **Edit** in the workbench's block list (`block` is that block's place, so its
  caption is the one edited);
- **+ figure** between blocks (`new`, `at` the place);
- a try question's figure picker: **Edit in the composer** beside the chosen figure (*my call*:
  the operator left it to me; the board's breadcrumb implies it);
- an exam stem's figure in the exam builder: **Edit in the composer** beside its file (*my call*:
  otherwise a figure placed only in a stem could not be reached once the YAML box goes). The stem's
  caption stays in the exam builder.

Opened from a try question or a stem there is no `block`, so the composer edits the file only and
Describe shows alt text and source.

*Rejected*: the composer as a panel inside the block list. The board is a full page, and three
columns (data, preview, checks) do not fit in a block row.

## M6CO.2 One working copy, one save

The composer holds **a working copy of the figure's file in the browser** (operator's standing
rule: work stays in the browser, few small requests). Every keystroke edits the copy; the preview
and the checks follow it with no request. **Save to the page** sends it once; **Cancel**
discards it; leaving with unsaved changes warns, as the workbench does (`useLeaveWarning`).

- **Editing a figure** saves through the draft's one edit queue, in order: the file
  (`PUT /figures/{stem}`, M6.4) if it changed, then the block's caption (`PUT /blocks/{at}`) if
  it changed. The last save returns to the workbench.
- **Adding a figure** is one save: `POST /figures` takes either `text` (the whole file) or, as
  today, `component` and `alt` (the starter is made from them), never both; `at` and `caption` are
  required either way, since a page block needs a caption. With `text`, the component and alt are
  the file's own, and the file is validated as `set_figure` validates it (*my call*). So Choose →
  Data → Describe → Save creates the file and places it together.
- **The server stays the authority**: a refused save (422 with problems) keeps the composer open
  with the copy as typed and the problems in Checks.
- Saving waits until the browser's checks pass (M6CO.5): a figure that would be refused is not
  sent.

*Rejected*: save-on-leave per field, as the workbench does. A figure is one file whose parts must
agree (an edge names a node); half-edited states would be refused constantly.

## M6CO.3 The file stays as written

The file is edited as a YAML **document**, not regenerated: the browser parses the text with the
[`yaml`](https://eemeli.org/yaml/) package's Document API, each edit changes the node it touches,
and the text written back keeps comments, key order, quoting and every line not edited. The
server stores it byte for byte, as M6.4 does. One new web dependency (`yaml`, pure JavaScript,
no transitive dependencies), pinned to an exact version at least two weeks old.

- **A test holds the round trip**: for every figure in the fixtures and `cases.json`, parse and
  write back with no edit gives the same bytes; one edit changes only its own lines.
- **One reading for every file** (operator, 2026-10-21: A, *"we need a single source of truth"*).
  The server reads YAML 1.1 (PyYAML), the browser's `yaml` package 1.2, and they disagree on some
  plain values (`yes`, `on`, `1e3`, `012`, `1:30`, `~`). A plain scalar the two would read
  differently is **refused on both sides** (CS1023: *"quote it"*), so any file that passes has one
  reading. The list of such forms is **data in `code-figures`** beside the schemas, generated into
  the web as `schemas.ts` is, never written twice; `cases.json` gains a case for each, run by both
  suites; the server stays the authority on save. This tightens the format; no fixture uses such a
  value.
  - *Rejected*: B, the server reading the file on each change (a request per pause in typing,
    against the operator's rule that work stays in the browser); C, the browser imitating PyYAML
    with custom tags (every quirk a twin to keep).
- **Values are written in the forms both read alike**: numbers in plain decimal (#376), the forms
  above quoted, no anchors or aliases (#374).
- **A file the form cannot hold** (one that does not parse, a layered chart, a key the form does
  not show) opens in **Edit as YAML**, with a line saying why; it can still be saved from there.

*Rejected*: a canonical writer (Python's or the browser's) that rewrites the file from its data:
simpler, but it erases a hand-written file's comments and order, which M6.4 promised to keep.

## M6CO.4 Choose, Data, Describe

**Choose** (new figures only): the four general kits as a gallery, each drawn by its own renderer
from its starter data, with a line saying what it is for. Choosing loads the starter into the
working copy. The component is fixed once saved (M6.4's ruling); for an existing figure Choose is
shown done and cannot be reopened.

**Data**: one rule for every kit, read from its schema (`code-figures`' schemas, already in the
browser as `src/figures/schemas.ts`):

- **Each array of records is a sheet**: a grid with a row per item and a column per key, the
  key's type deciding its cell (text, number, a select for an `enum`). Rows are added, removed
  and reordered; **pasting** tab- or comma-separated text fills rows from the cell pasted into,
  the first row naming columns when it matches the sheet's keys.
  - table: `columns` (name, type, unit, decimals), then `rows`, whose columns are the table's
    columns;
  - chart: `data.values`, whose columns are the keys its rows use;
  - flow: `nodes`, `edges`, `groups`;
  - sequence-track: `features`.
- **Everything else is a form generated from the schema**: an `enum` is a select, a string an
  input, an integer a number, a boolean a switch, a nested object a group (the chart's
  `encoding`: one row per channel, its field offered from the values' columns), and a `oneOf` a
  switch between its branches by JSON type, as the validator picks them (the chart's `mark`: a
  name, or an object with `type`, `point`, `interpolate`, `opacity`; *my call*). Only what the
  allowlist takes is offered, so the form cannot write a key the schema refuses.
- **The track's sequence** is a text field that takes pasted FASTA (the header line dropped,
  line breaks removed).
- **Edit as YAML** beneath the sheets shows the working copy's text; edits there and in the sheets
  are the same copy.

**Describe**: the caption (the block's, when opened from a block), the alt text (the file's
`alt`, with M6.4's guidance: the figure's type, what it shows, why it is here) and the optional
source (the file's `source`: a title, and a link if there is one).

Sizes stay M6.4's schema limits; sheets are not virtualised (*my call*: the fixtures'
largest figure is 14 rows, and virtualising is added if content needs it).

## M6CO.5 Checks, live, that go to the field

The browser runs **every check the server runs** on the working copy as it changes:

- the file's own checks (`code_schema/figures.py`): its size (CS1027), whether it reads (CS1023,
  with the one-reading rule above), unknown keys (CS1025), its alt text (CS1024), its source
  (CS1026), a component named (CS1001) (*my call*: otherwise Save could unlock for a file the
  server refuses);
- `validate.ts`, the schema (M6.4);
- **each kit's own checks** (`code_figures/table.py`, `chart.py`, `flow.py`, `track.py`: a
  dangling edge, duplicate ids, at most three series, a feature beyond the sequence, …).

All are ported to TypeScript beside `validate.ts` and run `tests/fixtures/figures/cases.json`,
which gains a case for every one of these codes (it covers schema codes alone today), in both
suites, so the twins cannot drift (#375's lesson).

*My call*, over asking the server on each change: the server would need a dry-run route and a
request per pause in typing, and the checks are small. The server still checks on save.

Each problem shows its code and path (`CS1007 data.edges[1].to: no node is kmrs`, as M6.4's
refusals do) and **goes to the field**: a path into a sheet (`data.<sheet>[i].<key>`) selects that
cell and scrolls to it; a path into the form focuses that control; the file's `alt` and `source`
focus their Describe fields; any other path opens Edit as YAML at its line. While any check fails, the preview keeps **the last drawing that checked**,
with a line saying a problem is waiting, and Save is disabled.

## M6CO.6 Preview and this figure

The preview draws the working copy with the page's own `Figure` (M6.4), the caption under it, at
**Desktop** (the page's width), **Phone** (390 px) and **Dark** (the box set `data-theme="dark"`,
as the exam builder's preview is).

**This figure** names its file and every place the node shows it (its blocks on the page, try
questions, exam stems), so the author knows a change reaches all of them.

## M6CO.7 The build, and done when

In order, test-first: the one-reading rule in `code-figures` and the server's loader, with its
cases; `POST /figures` with `text`; the YAML document layer and its round-trip test; the file's
and the kits' checks in TypeScript with `cases.json` extended; the sheets and the generated form;
the page (route, Choose, Data, Describe, preview, checks, save); the workbench and try-question
and exam-stem entries, removing the YAML box and `FigureAdder`.

**Done when**, walked against the Compose stack as an author and a reviewer:

1. An author adds a chart by Choose → Data → Describe and one save; the file lands as written.
2. An author pastes a spreadsheet's rows into a table, and a FASTA sequence into a track.
3. A dangling edge in a flow shows `CS1007` with its path; the check goes to the cell; the
   preview keeps the last good drawing; Save waits until it is fixed.
4. A hand-written figure file with comments is opened, one cell is changed and saved, and the
   file differs from before by that line only.
5. A layered chart opens in Edit as YAML, says why, and saves from there.
6. A file holding `on` or `1e3` unquoted is refused alike by the browser and the server, with
   CS1023 and its path.
7. The composer matches the three M6.5 boards at 1680, in light and dark.
