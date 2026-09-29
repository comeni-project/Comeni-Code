# M3 part 1 — resources and try questions

**Status: agreed 2026-09-20.** The first of phase M3's six parts (architecture spec R4).
The parts list is in [`2026-09-20-m3-in-parts.md`](../../notes/journal/2026-09-20-m3-in-parts.md).
It gives the Node page (part 5) what R4's *done when* requires it to show — a **Learn it** section
with an embedded and a linked resource, and `try` questions with hints and a rationale — by adding
them to the schema, the validator, the fixtures, the index and the read API. It decides:

- where a node's resources and questions are written, and what they hold;
- how a provider and its licences are allowed;
- how a question is placed in the prose;
- what the index stores and what the endpoint returns.

The operator made every decision here on 2026-09-20, question by question; an agent proposed them.

---

## M3P1.1 What this part does

```
providers.yaml ─┐
node.yaml ──────┼── code-schema ──► Node with resources and questions
body.md ────────┘                        │
                                   rebuild_index
                                         ▼
                              GET /api/nodes/{id}
```

**Done when:**

- `node.yaml` may carry `resources:` and `try:`, and `code-schema validate` checks both as it
  checks links — every problem naming the file, the line and the field;
- `providers.yaml` sits beside `regions.yaml`; an unknown provider, a licence that provider does
  not list, or `display: embed` where it is not allowed is a problem;
- a hint containing the answer is a problem;
- every `{% try %}` marker in `body.md` names a question in `node.yaml`, and every question has
  exactly one marker;
- the Salmon fixtures carry one embedded resource, one linked resource, and both a choice and a
  number question with hints and a rationale;
- `rebuild_index` stores them, `GET /api/nodes/{id}` returns them, and `openapi.json` and
  `apps/web/src/api/schema.ts` are regenerated;
- every test in M3P1.6 passes, and CI is green.

**Out of scope:** the Node page (part 5); authoring (M4's workbench); figure-answered questions
(M6); storing a learner's answer as evidence (T7); the *Learn it* Read/Watch choice, which the
page derives from whether a video resource exists; the route endpoint, whose stop cards gain
nothing.

**Three of T4.1's fields are deliberately absent:**

| Field | Why not now |
|---|---|
| `reviewed_by` | nothing can set it until the Studio exists (M4), and a field only a reviewer may write, with no reviewer, is decoration. The board's *Chosen by* waits for M4 |
| whether a `url` resolves | the validator makes no network calls; CI and a scheduled check do that (S11). M3 checks the URL is well formed and `https` |
| per-question minutes (the board's *1 min · a count*) | a node's `minutes` already covers the page with its questions, and M2's route totals are pinned to it. A second number either double-counts or changes the reference route |

## M3P1.2 Resources, and the provider registry

A `resources:` list in `node.yaml`, each entry a closed mapping, parsed by the machinery links
already use (M1P2.2), so an unknown key is a problem rather than a silently ignored one.

| Field | Holds | Checked |
|---|---|---|
| `kind` | `video` · `reading` · `tutorial` · `exercise` | one of the four |
| `provider` | a provider id from `providers.yaml` | in the registry, with a *did you mean* on a near miss |
| `url` | the page | a well-formed `https` URL |
| `part` | `2:10–7:45`, or a section such as `§17.1` | optional; for a `video` a timestamp range that ends after it starts |
| `covers` | one sentence: what this resource teaches that the node needs | a sentence, ≤ 200 — the check a link's reason gets |
| `licence` | the resource's licence or terms | one the provider lists |
| `display` | `embed` or `link` | `embed` only where the provider allows it |
| `level` | one of the five (T10.1) | the `Level` enum |

**Why `part` is checked for a video:** the page embeds with a start and an end, so `2:10–7:45` has
to parse into seconds. A range that ends before it starts is a problem naming the line.

**One rule across the list:** the same `url` twice in a node is a problem. There is no cap on how
many resources a node has — *Learn it* is kept short by editing. (*related* is capped at four
because four peers is a judgement about the graph, not about a section's length.)

**`providers.yaml`**, at the content root beside `regions.yaml`, in the same list-of-entries shape
`regions.yaml` uses:

```yaml
providers:
  - id: khan-academy
    name: Khan Academy
    licences: [YouTube embed]
    embed: true
  - id: openstax
    name: OpenStax
    licences: [CC BY 4.0]
    embed: true
  - id: galaxy-training
    name: Galaxy Training
    licences: [CC BY 4.0]
    embed: true
```

- `id` is a slug, `name` one line, `licences` a non-empty list of one-line strings, `embed` a
  boolean. A duplicate id is a problem, as it is in `regions.yaml`.
- **The file is required only when a resource names a provider.** A content folder with no
  resources never reads it, so `comeni-code-content` stays green until `providers.yaml` is added
  there — a change to that repository, brought to the operator at the end of this part (R1).

Messages, in the house style:

```
node.yaml:14  resources  khan-acadmy is not a provider in providers.yaml — did you mean khan-academy?
node.yaml:19  resources  the resource from OpenStax carries CC BY-NC-SA, which OpenStax does not list
node.yaml:22  resources  the resource from Galaxy Training asks for an embed it does not allow — use display: link
node.yaml:27  resources  the part 7:45–2:10 ends before it starts
```

**Left to review, not checked:** T4.1's *flagged if the resource is two or more levels from the
node's*. `code-schema` has one severity — a problem stops the build — and a resource one level
above a node is often exactly the right resource. That flag belongs with the Studio's review queue
(M4).

**Rejected:**

| Alternative | Why not |
|---|---|
| The provider list as a constant in `code-schema` | adding a publisher would need a release of the validator before the content repository could cite it |
| Providers in content, embed rules in code | two places to look when a resource is refused; the registry already carries the licences, and the licence is the thing the rule is about |
| Resources written in `body.md` | the body stays Markdown in M3 (M3 parts list, decision 3), and a problem's line would come from inside a prose file |

## M3P1.3 Try questions, and where they sit in the prose

```yaml
try:
  - id: kmer-count
    kind: number
    ask: How many 5-mers does a 100-base read contain?
    answer: 96
    hints:
      - Every position where a window of width k still fits gives one k-mer.
      - The last window starts at position L − k + 1.
    rationale: A read of length L has L − k + 1 k-mers, so 100 − 5 + 1 = 96.

  - id: node-or-edge
    kind: choice
    ask: In this definition, is a k-mer a node or an edge?
    options:
      - text: An edge
        right: true
      - text: A node
    hints:
      - Look at what the definition puts in V and what it puts in E.
    rationale: V holds the (k−1)-mers and E holds the k-mers, so a k-mer is an edge.
```

| Field | Holds | Checked |
|---|---|---|
| `id` | a slug, unique within the node | matches exactly one marker in `body.md` |
| `kind` | `choice` · `number` | one of the two; `figure` is refused by name |
| `ask` | the question | a sentence, ≤ 200 |
| `options` | choice only: 2–5, each `text` and optional `right` | exactly one `right: true`; `text` one line, ≤ 120 |
| `answer` | number only: the value | a number; refused on a choice question |
| `unit` | number only, optional | one line, ≤ 20 |
| `tolerance` | number only, optional; absolute | a number ≥ 0 |
| `hints` | 1–3, in order, shown one at a time | each a sentence, ≤ 200; none may contain the answer |
| `rationale` | shown after answering, right or wrong | ≤ 400 characters |

- **`kind` is written, not inferred** from which of `options`/`answer` is present. It makes the
  refusals precise — *a number question has no `answer`* rather than *this question has neither
  options nor an answer* — and lets `kind: figure` be refused by name: **a figure question arrives
  with figures in M6**.
- **Hints and a rationale are both required.** R4's *done when* names them, and a question with no
  hint is a dead end rather than a check that teaches (T6.2).
- **The answer-in-a-hint check:** for a choice question, the right option's text appearing in a
  hint, case-insensitively. For a number, the value appearing as a standalone number — digits not
  touching another digit, a letter or a hyphen — so a hint may say *5-mers* while the answer is 5,
  but not *= 96*.

**The marker**, as the board draws it, a line of its own in `body.md`:

```
A read of length L has L − k + 1 k-mers.

{% try kmer-count %}

## Building the graph
```

- every marker names a question that exists, and every question has **exactly one** marker;
- a marker inside a fenced code block is prose, not a marker;
- **any other `{% … %}` line is a problem.** The board's `{% figure %}`, `{% math %}`, `{% claim %}`
  and `{% image %}` are W5.1 and M6; refusing them by name now is better than rendering braces on
  the page.

## M3P1.4 Through the index and the API

Three new tables. The index is tables derived from files (M1P5.4), and a JSON blob on `Node` would
hide the one thing the Quality page (S11) will query across: every resource, to check its link.

| Table | Holds |
|---|---|
| `Provider` | `id`, `name`, `position` — `providers.yaml`, as `Region` mirrors `regions.yaml` |
| `Resource` | FK node, `position`, `kind`, FK provider, `url`, `part`, `covers`, `licence`, `display`, `level` |
| `Question` | FK node, `position`, `question_id`, `kind`, `ask`, `options`, `answer`, `unit`, `tolerance`, `hints`, `rationale` |

- `options` and `hints` are JSON inside the row: ordered lists of small values with no identity of
  their own, as `IndexBuild.problems` already is.
- `providers.yaml`'s `licences` and `embed` stay in the files. They are checked at build, and
  nothing downstream reads them.
- A rebuild replaces all three wholesale, as it replaces nodes and links.

**`GET /api/nodes/{id}` gains two lists** beside the cards it already returns:

```json
"resources": [
  {"kind": "video", "provider": {"id": "khan-academy", "name": "Khan Academy"},
   "url": "https://…", "part": "2:10–7:45", "covers": "Why overlapping reads…",
   "licence": "YouTube embed", "display": "embed", "level": "introductory"}
],
"questions": [
  {"id": "kmer-count", "kind": "number", "ask": "How many 5-mers…?",
   "answer": 96, "unit": null, "tolerance": null, "options": null,
   "hints": ["Every position where…", "The last window…"],
   "rationale": "A read of length L has…"}
]
```

- Both are in the author's order. The endpoint goes from three queries to five.
- **The page places a question by splitting the body on its marker**, so nothing extra is sent for
  position, and the marker rule stays in one place: the validator.
- **The answer goes to the browser, deliberately.** A try question is formative — the board shows
  the rationale after either answer — and with no learner records there is nothing to protect.
  It is written down because **exam questions (T7.1) must not do this**: those are scored, and
  their answers stay server-side. A comment on `QuestionOut` says so.
- The route endpoint is untouched.

## M3P1.5 Where the fixtures gain content

- ***de Bruijn graphs*** takes the L5 board's three resources — a Khan Academy video embedded with
  a part, an OpenStax reading, a Galaxy Training tutorial linked — and its two questions, one of
  each kind, with their markers in `body.md`.
- One more node takes a single linked resource, so part 5 has both shapes of *Learn it* to draw.
- `tests/fixtures/salmon/providers.yaml` is a copy of what `comeni-code-content` will hold, with
  the comment `regions.yaml` carries: tests never read that repository (R1).
- Galaxy Training appears as a **resource**, which the standing rule allows; no node is about
  Galaxy.

## M3P1.6 What the tests prove

| Test | Proves |
|---|---|
| a node with an embedded and a linked resource parses, and round-trips byte for byte | the writer still matches the reader (M1P1) |
| unknown provider; a licence the provider does not list; an embed where it is not allowed; reversed timestamps; the same url twice | each is one problem naming file, line and field |
| `providers.yaml` missing is a problem **only** when a resource names a provider | the content repository stays green until it is added |
| choice with no right option, with two, with one option; a number question with no `answer`; `answer` on a choice; `kind: figure` | the refusals, with M6 named in the last |
| a hint containing the answer fails; a hint saying *5-mers* with answer 5 passes | the check is a standalone number, not a substring |
| a marker naming no question; a question with no marker; two markers for one question; `{% figure %}`; a marker inside a fence | the marker rules |
| `rebuild_index` stores providers, resources and questions, and a rebuild replaces them | the index is derived (M1P5.4) |
| `GET /api/nodes/de-bruijn-graphs` returns both lists in the author's order, in five queries | the endpoint |
| `openapi.json` and `schema.ts` are current | the web types line up |

The fixtures' 26 nodes, the Salmon route's 17 stops and every M2 pin stay exactly as they are:
nothing here touches `minutes`, links or regions.
