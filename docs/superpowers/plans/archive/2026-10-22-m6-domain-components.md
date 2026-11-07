# M6.6a Domain components — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The five de Bruijn components (`read-tiling`, `kmer-window`, `kmer-graph`,
`compare-graphs`, `graph-artifacts`) as `code-figures` kits whose values are computed from the
reads, twinned in TypeScript, drawn on the page and offered in the composer.

**Architecture:** Each kit is a Python module beside M6.4's (`check`, `derive`, `STARTER`, a
schema); `derive` is the authority and flows through the existing `derived` field to the index, the
Studio API and the page. A TypeScript twin of every `check` and `derive` lives in
`apps/web/src/figures/domain/`, held to a new `derived` list in `tests/fixtures/figures/cases.json`
by both suites. Renderers draw in our SVG (dagre for the graphs, as the flow does). The composer
gains the domain row in Choose, FASTA for `format: dna` fields and sheets, and a Computed block.

**Tech Stack:** Python 3.14 (pure `code-figures`), PyYAML; React, TypeScript 7, vitest,
`@dagrejs/dagre` (have it).

**Spec:** `docs/superpowers/specs/2026-10-22-m6-domain-components-design.md` (M6DC.1–M6DC.7), #333.
Boards: https://claude.ai/artifact/JL1PkAjBQKv6o493XDgCoR (row *M6.6a*: *Choose, with the de Bruijn
components*, *Data: a kmer-graph*), and the L5 de Bruijn page (`.design/Node.dc.html`, Figures 1–4
and the `kmer-graph` try).

## Global Constraints

- DNA only: letters `^[ACGT]+$`, upper case; anything else is CS1010 at the field's path.
- Bounds (CS1004 via the schema): `genome` ≤ 60; a read ≤ 20; reads ≤ 8 (and ≥ 1); `kmer-window`
  read ≤ 16, `range` within 2–8 with `min ≤ k ≤ max`; `k` 2–8; a read's note ≤ 40.
- New codes CS1012–CS1016 exactly as M6DC.2; never renumber; each in `diagnostics.yml` with
  `explain`, a test, and a `cases.json` case.
- Edges: two k-mers that follow each other in some read; k-mers in first-seen order (reads in
  order, left to right); edges in first-seen order; nothing else sorted.
- A graph kit draws at most 12 k-mers (`compare-graphs`: 16 across both halves), else CS1016.
- `code-figures` imports stay within its allowlist (`__future__`, `collections.abc`,
  `dataclasses`, `json`, `pathlib`, `re`, `typing`).
- Colour (W10): the path is the only teal; tips amber, bubbles red, always also in words;
  everything else neutral.
- Fixtures are test data; nothing goes to `comeni-code-content`.
- Web on Node 24; after a schema change `npm run figure-types`; after a code change
  `uv run code-schema diagnostics --write docs/reference/diagnostics.md`.

## Review Focus

1. **A read that repeats a k-mer** (`ACGACGA`, k = 3): a cycle in the graph; `derive` must
   terminate, the k-mer listed once, the edge ACG→CGA recorded once, and dagre must lay it out —
   `test_kmer_graph.py::test_a_repeat_makes_a_cycle_once` and its `derived` case.
2. **A highlighted path that revisits a k-mer** (reads 1–2 both pass ACG): the path keeps each
   k-mer once in first-seen order and is still checked as a walk; CS1014 only when two consecutive
   k-mers do not overlap — `test_path_with_a_shared_kmer_is_one_walk`.
3. **Duplicate reads, or a read shorter than k**: duplicates add support (two reads) but no new
   k-mers; a read with fewer than k letters is CS1013 at its path — tests in Task 2 and Task 3.
4. **`kmer-window` with `k` outside `range`, or `range` past the read's length**: CS1013 (range
   against the read) or CS1003 (k outside its range) at its path, never a crash in the slider —
   `test_kmer_window.py` and `KmerWindow.test.tsx` "a k outside its range is not drawn".
5. **An empty reads sheet in the composer** (every row removed): the schema's `minItems: 1` gives
   CS1004 at `data.reads`; the preview keeps the last good drawing; the TS twins never throw on
   `[]` — `domain.cases.test.ts` "every twin survives the empty and the minimal data".

---

### Task 1: The shared k-mer graph and `kmer-graph` (Python)

**Files:** create `packages/code-figures/src/code_figures/kmers.py`,
`kmer_graph.py`, `schemas/kmer-graph.json`; modify `registry.py` (entry, `CODES`), 
`packages/code-schema/src/code_schema/diagnostics.yml` (CS1013, CS1014, CS1016),
`tests/fixtures/figures/cases.json` (`derived` list, `cases` entries), `tests/figures/test_cases.py`
(runs `derived`); create `tests/figures/test_kmer_graph.py`.

**Interfaces (produced):**
- `kmers.py`: `kmers_of(read: str, k: int) -> list[str]`;
  `graph(reads: Sequence[str], k: int) -> tuple[list[str], list[tuple[str, str]]]` (distinct k-mers
  first-seen; edges first-seen, each once); `support(reads, k) -> dict[str, int]` (reads holding
  each k-mer); `spells(path: Sequence[str]) -> str`; `is_walk(path) -> int | None` (index of the
  first k-mer that does not overlap its predecessor by k − 1, else None);
  `letters_findings(value: str, path: str) -> list[Finding]` (CS1010).
- `kmer_graph.py`: `STARTER` = the board's reads ACGTT, CGTTA, GTTAG, CGTC (note *another read — a
  branch*), k 3, highlight `path`, path `[1, 3]`, spell `shown`; `check(data) -> list[Finding]`
  (CS1010 per read at `data.reads[i].sequence`; CS1013 at `data.k` when k ≥ the shortest read;
  CS1014 at `data.path` when the path is not a walk; CS1016 at `data.reads` past 12 k-mers);
  `derive(data) -> {"kmers", "edges": [[a, b], …], "branches", "path"?, "spells"?, "notes": {kmer: note}}`
  where `notes` maps each noted read's first new k-mer to its note.
- `cases.json` `"derived": [{"name", "component", "data", "derived"}]`; Python asserts
  `derived(component, data) == case["derived"]`.

- [ ] Tests (`test_kmer_graph.py`): the starter derives kmers `[ACG, CGT, GTT, TTA, TAG, GTC]`,
  edges `[[ACG,CGT],[CGT,GTT],[GTT,TTA],[TTA,TAG],[CGT,GTC]]`, branches `[CGT]`, path
  `[ACG,CGT,GTT,TTA,TAG]`, spells `ACGTTAG`, notes `{GTC: "another read — a branch"}`;
  `test_a_repeat_makes_a_cycle_once`; `test_path_with_a_shared_kmer_is_one_walk`; k = 5 with a
  5-letter read is CS1013 at `data.k`; reads 1 and 4 as a path (ACGTT, CGTC) is CS1014; 13 k-mers is
  CS1016; `acgtt` is CS1010 at `data.reads[0].sequence`; `highlight: path` without `path` is CS1003
  (schema: `path` required when `highlight` is `path` — written as a check, since the schema subset
  has no `if`).
- [ ] Run (fail): `uv run pytest tests/figures -q`.
- [ ] Implement; `diagnostics.yml` entries; `cases.json`: `cases` for CS1013, CS1014, CS1016 and
  `derived` for the starter, the cycle, and the shared-k-mer path.
- [ ] `uv run pytest tests/figures tests/schema -q`, `uv run mypy`, the diagnostics reference →
  commit `feat(figures): the k-mer graph, computed from its reads (#333)`.

### Task 2: The other four kits (Python)

**Files:** create `read_tiling.py`, `kmer_window.py`, `compare_graphs.py`, `graph_artifacts.py` and
their `schemas/*.json`; modify `registry.py`, `diagnostics.yml` (CS1012, CS1015), `cases.json`;
create `tests/figures/test_domain_kits.py`.

**Interfaces (produced):**
- `read-tiling`: data `{genome, reads: [{sequence}]}`; derive `{"starts": [int, …], "lanes": [int, …]}`
  (1-based start of each read's one match; lanes first fit by start, as `track.derive`). Check:
  CS1012 at `data.reads[i].sequence` when a read matches nowhere or more than once (messages *is not
  in the genome* / *is in the genome twice, at 3 and 17*). STARTER: the L5 genome
  `ATGCGTACGTTAGCCTAGGATCCAGTACGTTAGGCATCGA` and seven 9-letter reads at starts 1, 6, 12, 17, 22,
  28, 32 (each unique).
- `kmer-window`: data `{read, k, range: [min, max]}`; derive
  `{"by_k": {"<k>": {"windows": [[start, kmer], …], "count": n}, …}}` for every k in range. Check:
  CS1013 at `data.range` when `max` ≥ len(read); CS1003 at `data.k` when k is outside range.
  STARTER: read `ACGTTAGCAT`, k 4, range [3, 7].
- `compare-graphs`: data `{reads: [{sequence}], k}`; derive
  `{"as_nodes": {"nodes", "edges"}, "as_edges": {"nodes", "edges": [[from, to, kmer], …]}}`; CS1013,
  CS1016 (16 across both). STARTER: reads `[ACGTT]`, k 3 (ACG, CGT, GTT / AC, CG, GT, TT).
- `graph-artifacts`: data `{reads: [{sequence}], k}`; derive
  `{"kmers", "edges", "support": {kmer: n}, "artifacts": [{"kind": "tip"|"bubble", "kmers": […]}]}`.
  Check: CS1015 at `data.reads` when no k-mer has support ≥ 2; CS1013; CS1016. STARTER: chosen so
  the rules give one tip and one bubble at k = 3 with every solid k-mer in two reads (write it in the
  test first, then copy it to `STARTER`).

- [ ] Tests (`test_domain_kits.py`): each starter's derived values written out; a read twice in the
  genome is CS1012 naming both starts; a lone read with no support anywhere is CS1015; a tip and a
  bubble each classified as M6DC.1 says; a duplicate read raises support to 2 without new k-mers;
  `kmer-window` k = 8 on a 10-letter read with range [3, 9] is CS1013 at `data.range`.
- [ ] Run (fail) → implement → `cases.json` (`cases` for CS1012, CS1015; `derived` for each starter
  and the tip/bubble pair) → `uv run pytest tests/figures -q`, mypy, purity guard
  (`uv run pytest tests/guards -q`) → diagnostics reference → commit
  `feat(figures): read tiling, k-mer windows, both conventions and graph artifacts (#333)`.

### Task 3: The TypeScript twins

**Files:** `npm run figure-types` (schemas.ts gains the five); create
`apps/web/src/figures/domain/{kmers,readTiling,kmerWindow,kmerGraph,compareGraphs,graphArtifacts}.ts`
and `domain.cases.test.ts`; modify `apps/web/src/figures/kits.ts` (`CHECKS`, `derive` dispatch,
`STARTERS`, `CODES`), `cases.test.ts` (runs `derived`).

**Interfaces (produced):** each `domain/<kit>.ts` exports `check(data): Finding[]` and
`derive(data): Record<string, unknown>` with Python's names, shapes, order and messages; `kits.ts`
`derive(component, data)` dispatches to them (the track keeps its own).

- [ ] Tests: every `cases.json` `derived` case equals `derive(component, data)` (`toEqual`, order
  included); every `cases` entry already runs through `figureFindings`; "every twin survives the
  empty and the minimal data" (`reads: []`, one 2-letter read, k 2) — no throw, findings only;
  `STARTERS` equal `cases.json` `starters` (existing test).
- [ ] Run (fail) → implement → `npx vitest run src/figures` → lint, typecheck → commit
  `feat(web): the domain kits' checks and computed values, twinned (#333)`.

### Task 4: The renderers, and the boards they are held to

**Files:** create `apps/web/src/figures/domain/{ReadTiling,KmerWindow,KmerGraph,CompareGraphs,GraphArtifacts}Figure.tsx`,
`domain/graphLayout.ts` (dagre for k-mer boxes, as `flow/layout.ts`), tests beside them; modify
`figures/registry.ts` (`RENDERERS`); `.design/build_pages.mjs` (`F.tiling()` and `F.bubble()`
drawn from the data the fixture will hold, written here first and copied into Task 6, lanes by first fit, the bubble a three-k-mer run), regenerate,
republish the L5 board on the main canvas and the M6 canvas's affected boards.

**Interfaces:** each renderer is `KitProps<C>` (`data`, `derived`, `alt`); `KmerWindow` holds the
slider's k in `useState(data.k)`, drawing `derived.by_k[k]`; `KmerGraph` draws `derived.notes`,
the highlight per M6DC.1, and *path spells* with letters or `?`s per `spell`.

- [ ] Tests: `KmerGraph` draws six k-mer boxes for the starter, the path's five in the route
  colour (class or data attribute `data-on-path`), the CGT→GTC edge dashed, `path spells` then
  `A C G T T A G`, and `?`×7 with `spell: hidden`; `KmerWindow` moving the slider to 5 shows six
  windows and `10 − 5 + 1 = 6 k-mers`; "a k outside its range is not drawn" (the fallback); 
  `GraphArtifacts` labels each artifact in words; `ReadTiling` places reads in their lanes; the
  registry test still holds every component.
- [ ] Run (fail) → implement → `npx vitest run src/figures` → `node .design/build_pages.mjs` →
  publish the canvases → commit `feat(web): the domain components drawn (#333)` and
  `design: L5's tiling and bubble as the rules compute them (#333)`.

### Task 5: The composer

**Files:** modify `apps/web/src/studio/composer/Choose.tsx` (two groups, the domain row first),
`sheets.ts` (`SHEETS` for the five: `data.reads`), `paste.ts` (FASTA records), `Sheet.tsx`
(FASTA paste into a `format: dna` column), `SchemaForm.tsx` (the FASTA field chosen by
`format: dna`, not by the path `data.sequence`), `DataPanel.tsx` (Computed block), `ComposerPage.tsx`
(Checks' *Computed from the reads* line); create `domain/summary.ts` (+ test). Add
`"format": "dna"` to the letters fields of the five schemas and to `sequence-track`'s `sequence`
(widening only), then `npm run figure-types`.

**Interfaces (produced):** `summary(component, derived): { label: string; value: string }[]`
(kmer-graph: k-mers, edges with the branch count, *path of 1–3* → *spells ACGTTAG*; the others as
M6DC.5 names); `parseFasta(text): { header: string; letters: string }[]`; `Column` gains
`dna?: boolean`, set from the item schema's `format`.

- [ ] Tests: Choose shows *de Bruijn graphs* above *General* with five tiles; FASTA of four records
  pasted into row 1's sequence fills four rows, headers into notes (kmer-graph) or dropped
  (compare-graphs); a single-record FASTA into the `genome` field gives its letters; the Computed
  block for the starter reads *k-mers ACG CGT GTT TTA TAG GTC*, *edges 5 · one branch at CGT*,
  *path of 1–3 spells ACGTTAG*; the track's sequence still takes FASTA (now by `format`).
- [ ] Run (fail) → implement → `npx vitest run` → lint, typecheck → commit
  `feat(web): domain components in the composer (#333)`.

### Task 6: The de Bruijn fixture

**Files:** `tests/fixtures/salmon/algorithms/de-bruijn-graphs/` (`figures/read-tiling.yaml`,
`kmer-window.yaml`, `compare-graphs.yaml`, `graph-artifacts.yaml`, `kmer-path.yaml`; `body.md`
placements where the L5 board puts Figures 1–4; `node.yaml`: try question `green-path` with
`figure: kmer-path` (`spell: hidden`), the board's ask, options, hint and rationale (M6DC.6)); every
test that counts this node's blocks, questions, figures or review keys (find them with
`grep -rln de-bruijn-graphs apps/api/tests tests apps/web/src`).

- [ ] Tests first: `tests/schema/test_fixtures.py` — the node reads with no problems and holds the
  five domain figures, each placed once; the try `green-path` shows `kmer-path`; then update the
  counting tests to the new numbers, each changed number commented with why.
- [ ] Run (fail) → write the files → `uv run pytest -q` (Postgres up) → `npx vitest run` → commit
  `test(fixtures): the de Bruijn page's domain figures (#333)`.

### Task 7: Walk, boards, journal

- [ ] All checks with CI's `env:`; rebuild the stack (`--build`), `rebuild_index --root` from a
  fresh copy of the fixtures (clear the walk drafts on de Bruijn first, local database only).
- [ ] Walk M6DC.7's *done when* 1–5 in headless Chrome as an author and a reviewer; compare the de
  Bruijn page with the (redrawn) L5 board at 1440 light and dark and at 390, and the composer with
  the two M6.6a boards at 1680.
- [ ] Fresh reviewer over the branch; fixes test-first, each an issue.
- [ ] Journal entry (built, walked, decisions, deviations) → commit; ask before pushing.
