# M4.1.2 — the block document, thin

**Status: agreed 2026-09-29.** The second substep of M4.1 (#119), after diagnostic codes
(M4.1.1, [`2026-09-29-m4-diagnostic-codes-design.md`](2026-09-29-m4-diagnostic-codes-design.md)),
so every refusal here is born with a `CS04xx` code. The parts list is the journal entry *M4 in
parts* (2026-09-29). It brings W5.1's block document into the format — thin — so the workbench
(M4.8) and the content API (M4.4) edit a node block by block from the start, and M5's assistant
finds the block calls W5.2 promises. It decides:

- the syntax of a block on disk;
- the block model, and how it is read and written;
- how blocks reach the index, the API and the page;
- which blocks are wired now, and which wait.

The operator made every decision here on 2026-09-29, question by question and section by
section; an agent proposed them.

---

## M4B.1 Why thin, and why now

Invariant 6 says content is validated blocks; W5.1 lists them; W5.2's content API edits them one
at a time. A workbench built on a Markdown text box would be built again for blocks, and content
written in plain Markdown would need migrating — cheapest now, with 26 fixture nodes and no real
content. It is one substep, not a phase's worth, because `body.md` already splits into prose and
`try` questions (M3P1.3): that is a block document with two kinds.

**Thin** means: `body.md` stays Markdown on disk; the app reads it as typed blocks; only `text`,
`try` and `callout` are wired. `figure`, `math`, `image`, `example`, `problem` and `claim` stay
designed in W5.1 and **refused by name** until M6 builds them — the pattern *helps* and *any-of*
already follow (M1P2.3).

*Rejected:* keeping Markdown for M4 (the agent's first recommendation, on cost alone — it pays
later with a second editor and a migration); the full block document now (designing figure and
problem shapes before M6 builds a component).

## M4B.2 The syntax on disk: MyST colon fences

`body.md` is Markdown plus **MyST directives written as colon fences**, at the top level only:

```markdown
DNA is two strands of nucleotides, each carrying one of four bases…

:::{try} base-pairing
:::

A gene is a region of DNA whose sequence a cell uses as instructions…

:::{misconception} A gene is not a chromosome
A chromosome holds thousands of genes; a gene is one stretch of one strand.
:::
```

- A **question** is placed with `:::{try} <question-id>` and `:::` on the next line, nothing
  between. The question itself stays in `node.yaml`.
- A **callout** is `:::{misconception}`, `:::{caveat}` or `:::{convention}`, an optional title after
  it, then Markdown, then `:::`.
- **Everything between directives is one `text` block** — always the longest run, so writing blocks
  and reading them back gives the same blocks. Headings (`##`) are part of text.
- **Inside a code fence, a directive is text**, as markers are today (M3P1.3).

This is what R1 chose — "MyST Markdown accepting only our directives and roles" — and the markers
M3 wrote in Markdoc's syntax come back in line with it. Standard MyST ([syntax
overview](https://mystmd.org/guide/syntax-overview)): Jupyter Book authors know it, and MyST tools
can read our files; GitHub shows a fence as a plain line. The boards' sample strings in
`.design/build_pages.mjs` (`{% figure component=… %}`) are illustrations, not the format.

*Rejected:* keeping the Markdoc-style `{% try %}` (Markdoc's syntax without its parser, which is
JavaScript-only, and only we can read it); MyST backtick fences (meant for code-like bodies,
drawn as code boxes on GitHub, and nesting callouts full of Markdown needs ever more backticks).

## M4B.3 What is refused

Each with its `CS04xx` code, the file and the line:

| Refused | Because |
|---|---|
| a directive inside a directive | no nesting in M4; the first block kind that needs it brings it |
| an option line (`:key: value`) | no directive has options yet |
| an unclosed fence | the rest of the body would silently become one block |
| a `try` with a body, or without an id | the question lives in `node.yaml` |
| a callout with no body | a box with nothing in it |
| an unknown directive | closest known name suggested |
| `figure`, `math`, `image`, `example`, `problem`, `claim` | designed (W5.1), not built — named, with the phase that brings it |
| the old `{% try id %}` line | pointed at `:::{try} id` |

The rules M3 already had carry over with their codes: every `try` names a question in `node.yaml`,
every question is placed exactly once, and a question that did not parse has its placement check
skipped, so one mistake is one problem.

## M4B.4 The model in `code-schema`

```python
@dataclass(frozen=True)
class Text:
    markdown: str


@dataclass(frozen=True)
class Try:
    question: str


@dataclass(frozen=True)
class Callout:
    kind: Literal["misconception", "caveat", "convention"]
    title: str  # "" when none
    markdown: str


Block = Text | Try | Callout
```

- **`parse_blocks(body) -> (blocks, problems)`** scans lines, tracking code fences as
  `find_markers` does now. `markers.py` becomes this module; `find_markers` goes.
- **`write_blocks(blocks) -> str`** writes a body back. The workbench needs it (M4.4), and it is
  defined now so the round-trip law covers it: **for every fixture, `write_blocks(parse_blocks(body))`
  is the body.**
- **`Node.blocks`** holds the parsed blocks in page order. **`Node.body` stays**, and the writer
  still returns `body.md` byte for byte (M1's law); blocks are derived from it, never the reverse,
  until a draft (M4.4) is written from blocks.
- **Purity:** only `re`, `dataclasses` and `typing`, already on the allowlist. No parser library.
- The public API gains `Block`, `Text`, `Try`, `Callout`, `parse_blocks` and `write_blocks`.

## M4B.5 Blocks through the index, the API and the page

**One parser, and its blocks travel** — the rule now lives only in the validator.

- **Index.** `Node` gains a `blocks` JSON column, filled by `rebuild_index` from `Node.blocks`:
  `{"kind": "text", "markdown": …}`, `{"kind": "try", "question": …}`,
  `{"kind": "callout", "callout": …, "title": …, "markdown": …}`. One migration; the rebuild stays
  all or nothing; `body` is still stored (M1P5.4).
- **API.** `GET /api/nodes/{id}` gains `blocks`, typed in `openapi.json` as a union of the three
  shapes, and **drops `body`**: once the pages draw blocks nothing reads it, and serving it invites
  a second parser. Still five queries.
- **Web.** `NodePage` and `FirstSteps` draw `node.blocks`. `splitBody` and its marker regex go;
  `headingsOf` reads the text blocks for *On this page*. A **`Callout`** component draws a titled
  panel labelled with its kind — *Misconception*, *Caveat*, *Convention* — in the existing panel
  styles and **no new colour** (W10: callouts carry no meaning of their own). **No board draws a
  learner's callout** (only S3's outline names one, *callout · Common mix-up*), so it is recorded
  as unboarded, for the end-of-MVP pass.

*Rejected:* blocks in the schema while the API still serves `body` (the page keeps its own parser,
and M4.4's content API would speak a different shape from the page); blocks as rows of their own
table (a body is read whole; JSON becomes a table if Quality ever needs to query one).

## M4B.6 Fixtures

One commit converts the three `{% try %}` lines to `:::{try} …` / `:::` — the only change to the 26
nodes' bodies — and adds **one callout**: a *misconception* on a node where it is true, so every
wired kind is exercised by real content. Tests that pin the fixtures follow, and the web's node
fixtures are captured again from the API.

## M4B.7 What the tests prove

Each watched failing first.

- **`code-schema`:** each wired kind parses; each refusal in M4B.3 with its code, message and line;
  a directive in a code fence stays text; the old marker is refused with its pointer;
  `write_blocks(parse_blocks(body)) == body` for every fixture; the writer still round-trips
  `body.md` byte for byte.
- **Index:** a rebuild stores blocks equal to `code-schema`'s; a second rebuild replaces them.
- **API:** `blocks` in page order, each shape; no `body`; five queries.
- **Web:** the Node page and the First steps page draw from blocks; *On this page* lists the same
  headings; `Callout` draws each kind with its title.

## M4B.8 The content repository

Nothing breaks there: it has no nodes, and its pinned validator reads a body as opaque apart from
`{%` lines, so colon fences pass it. **The pin moves in M4.2**, once, for the codes, the blocks and
exam pools together.

## M4B.9 Done when

- Every fixture round-trips through blocks.
- An unwired block is refused, naming its code, file and line.
- The Node page and the First steps page look as they do now — walked on the audit stack at 1440
  in light and dark, and at 360 — and the new callout is drawn.

## M4B.10 Not in this part

Nesting; options; `figure`, `math`, `image`, `example`, `problem` and `claim` (M6 and later); a
misconception's `step_back_to` and its answering of wrong submissions (M8); editing blocks (M4.4
and M4.8); `cite` marks in text (M5, with provenance).
