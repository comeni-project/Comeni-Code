# M4.1.2 — The block document, thin — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `body.md` is read as typed blocks — `text`, `try`, `callout` — by one parser in
`code-schema`, and those blocks travel through the index and the node API to the page, which drops
its own marker parser.

**Architecture:** A new `code_schema/blocks.py` (replacing `markers.py`) turns a body into blocks and
back, with MyST colon fences for directives. `Node` gains `blocks`; the placement checks read `Try`
blocks. The index stores blocks as JSON; `NodeOut` serves them in place of `body`; the web's `Body`
draws a block list, and a `Callout` component draws a callout.

**Tech Stack:** Python 3.14 (code-schema, pure), Django + Ninja, React 19 + TypeScript 7, vitest.

**Spec:** [`docs/superpowers/specs/2026-09-29-m4-block-document-design.md`](../specs/2026-09-29-m4-block-document-design.md)
(M4B.1–M4B.10). Issue #129 (M4.1.2), under M4.1 (#119).

## Global Constraints

- Directives are **MyST colon fences at the top level only**: `:::{name} argument` … `:::` (M4B.2).
- Wired kinds: `text`, `try`, `callout` (`misconception`, `caveat`, `convention`); `figure`, `math`,
  `image`, `example`, `problem`, `claim` are refused by name until M6 (M4B.1, M4B.3).
- A `text` block is the **longest run between directives**; inside a code fence a directive is text.
- `write_blocks(parse_blocks(body)) == body` for every fixture; `body.md` still round-trips byte for
  byte through the writer (M4B.4, M1's law).
- `code-schema` stays pure: no new import beyond the allowlist (`re`, `dataclasses`, `typing` are on it).
- Every refusal carries a declared `CS04xx` code (M4.1.1). **A published code is never renumbered**:
  `CS0402` (Markdoc-style markers) is **retired**, not removed.
- The node API serves `blocks` and **no `body`**; still five queries (M4B.5).
- No new colour for a callout; it is recorded as unboarded (M4B.5).
- Commits end with `Co-Authored-By:` naming the model in use.

## Review Focus

- **A Windows line ending (`\r\n`) in a body** must still parse into the same blocks and write back
  byte for byte — the writer has kept `\r\n` bodies since M1 part 1. Task 1 pins it.
- **A fence opened inside a code block** (a page about MyST printing ```` ```markdown ```` then
  `:::{try} x`) is text, not a block. Task 1 pins it.
- **A body that starts or ends with a directive** has no empty leading or trailing text block that
  the page would draw as a blank paragraph. Task 1 pins what blocks come out; Task 4 pins that the page
  draws no empty piece.
- **An old `{% try id %}` line in real content** is refused with a pointer to `:::{try} id`, never
  silently drawn as braces. Task 2 pins it.
- **"Further reading" on a First steps page** still moves to the footer once the body is blocks
  (`splitReading` worked on text). Task 4 pins it.

## New and changed codes

In `diagnostics.yml`, `CS0400`–`CS0499` (body):

| Code | says | Emitted by |
|---|---|---|
| CS0402 | *(retired 2026-09-29 — the body moved to MyST fences; a Markdoc-style line is CS0414)* | — |
| CS0403 | a question is placed that node.yaml does not have *(message now names `:::{try} id`)* | node |
| CS0404 | a question is placed twice *(message now names `:::{try} id`)* | node |
| CS0405 | a question is never placed *(message now names `:::{try} id`)* | node |
| CS0406 | a directive inside a directive | blocks |
| CS0407 | a directive with options | blocks |
| CS0408 | a directive is never closed | blocks |
| CS0409 | a question placement with a body | blocks |
| CS0410 | a question placement names no question | blocks |
| CS0411 | a callout with no body | blocks |
| CS0412 | a directive this format does not have | blocks |
| CS0413 | a kind of block that is designed, not built | blocks |
| CS0414 | a Markdoc-style tag line | blocks |

---

### Task 1: Blocks in `code-schema`

**Files:**
- Create: `packages/code-schema/src/code_schema/blocks.py`
- Modify: `packages/code-schema/src/code_schema/diagnostics.yml` (CS0406–CS0414)
- Test: `tests/schema/test_blocks.py`

**Interfaces:**
- Produces: `Text(markdown: str)`, `Try(question: str)`, `Callout(kind: str, title: str, markdown: str)`,
  `Block = Text | Try | Callout`; `CALLOUTS = ("misconception", "caveat", "convention")`;
  `parse_blocks(body: str, *, file: str) -> tuple[tuple[Block, ...], tuple[int, ...], list[Problem]]`
  — the blocks, the line each starts on (1-based, for Task 2's placement messages), and the problems
  (each with `file`, `line`, `code`; `field` None); `write_blocks(blocks: Sequence[Block]) -> str`.

- [ ] **Step 1: Write the failing tests** — `tests/schema/test_blocks.py`:

```python
"""A body as typed blocks (spec M4B.2–M4B.4)."""

import pytest

from code_schema.blocks import Callout, Text, Try, parse_blocks, write_blocks

BODY = (
    "DNA is two strands.\n\n"
    ":::{try} base-pairing\n:::\n\n"
    "A gene is a region of DNA.\n\n"
    ":::{misconception} A gene is not a chromosome\n"
    "A chromosome holds thousands of genes.\n"
    ":::\n"
)


def parse(body: str):  # type: ignore[no-untyped-def]
    return parse_blocks(body, file="n/body.md")


def test_a_body_reads_as_text_try_and_callout_blocks() -> None:
    blocks, lines, problems = parse(BODY)
    assert problems == []
    assert blocks == (
        Text("DNA is two strands.\n\n"),
        Try("base-pairing"),
        Text("\nA gene is a region of DNA.\n\n"),
        Callout(
            "misconception",
            "A gene is not a chromosome",
            "A chromosome holds thousands of genes.\n",
        ),
    )
    assert lines == (1, 3, 5, 8)


def test_blocks_write_back_as_the_body() -> None:
    blocks, _, _ = parse(BODY)
    assert write_blocks(blocks) == BODY


def test_windows_line_endings_round_trip() -> None:
    body = BODY.replace("\n", "\r\n")
    blocks, _, problems = parse(body)
    assert problems == []
    assert [type(block).__name__ for block in blocks] == ["Text", "Try", "Text", "Callout"]
    assert write_blocks(blocks) == body


def test_a_callout_may_have_no_title() -> None:
    blocks, _, problems = parse(":::{caveat}\nMind the units.\n:::\n")
    assert (blocks, problems) == ((Callout("caveat", "", "Mind the units.\n"),), [])


def test_a_directive_inside_a_code_fence_is_text() -> None:
    body = "```markdown\n:::{try} x\n:::\n```\n"
    blocks, _, problems = parse(body)
    assert (blocks, problems) == ((Text(body),), [])


def test_a_body_that_starts_and_ends_with_a_directive_has_no_empty_text() -> None:
    blocks, _, _ = parse(":::{try} a\n:::\n")
    assert blocks == (Try("a"),)


@pytest.mark.parametrize(
    ("body", "code", "line"),
    [
        (":::{caveat} A\n:::{try} x\n:::\n:::\n", "CS0406", 2),
        (":::{caveat} A\n:class: wide\nText.\n:::\n", "CS0407", 2),
        (":::{caveat} A\nText.\n", "CS0408", 1),
        (":::{try} x\nWhy.\n:::\n", "CS0409", 1),
        (":::{try}\n:::\n", "CS0410", 1),
        (":::{caveat} A\n:::\n", "CS0411", 1),
        (":::{misconseption} A\nText.\n:::\n", "CS0412", 1),
        (":::{figure} x\n:::\n", "CS0413", 1),
        ("Prose.\n\n{% try base-pairing %}\n", "CS0414", 3),
    ],
)
def test_each_refusal_names_its_code_and_line(body: str, code: str, line: int) -> None:
    _, _, problems = parse(body)
    assert [(problem.code, problem.line) for problem in problems] == [(code, line)]


def test_an_unknown_directive_suggests_the_closest() -> None:
    _, _, problems = parse(":::{misconseption} A\nText.\n:::\n")
    assert problems[0].message.endswith("did you mean misconception?")


def test_the_old_marker_points_at_the_new_one() -> None:
    _, _, problems = parse("{% try base-pairing %}\n")
    assert problems[0].message == (
        "{% try base-pairing %} is written :::{try} base-pairing then ::: on the next line"
    )
```

- [ ] **Step 2: Run** `uv run pytest tests/schema/test_blocks.py -q` — Expected: FAIL, `No module named 'code_schema.blocks'`.

- [ ] **Step 3: Write `blocks.py`**

```python
"""A node's body as typed blocks (spec M4.1.2, M4B).

body.md is Markdown with MyST colon-fence directives at the top level: `:::{try} <id>` then `:::`
places a question; `:::{misconception|caveat|convention} <title>`, Markdown, then `:::` is a callout.
Everything between directives is one text block, so blocks read and written give the same blocks
and the same text. Inside a code fence a directive is prose. W5.1's other blocks are refused by
name until the phase that builds them.
"""

from __future__ import annotations

import difflib
import re
from collections.abc import Sequence
from dataclasses import dataclass

from code_schema.problems import Problem

CALLOUTS = ("misconception", "caveat", "convention")
_LATER = {
    "figure": "M6",
    "math": "M6",
    "image": "M6",
    "example": "M6",
    "problem": "M6",
    "claim": "a later phase",
}
_OPEN = re.compile(r"^:::\{([^}]*)\}(?: (.*))?$")
_CLOSE = re.compile(r"^:::\s*$")
_OPTION = re.compile(r"^:[A-Za-z][\w-]*:")
_FENCE = re.compile(r"^\s*(```|~~~)")
_MARKDOC = re.compile(r"^\s*\{%.*%\}\s*$")
_OLD_TRY = re.compile(r"^\s*\{%\s*try\s+([a-z0-9-]+)\s*%\}\s*$")


@dataclass(frozen=True)
class Text:
    markdown: str


@dataclass(frozen=True)
class Try:
    question: str


@dataclass(frozen=True)
class Callout:
    kind: str
    title: str
    markdown: str


Block = Text | Try | Callout


def _content(line: str) -> str:
    """A line without its ending, whichever ending it has."""
    return line.rstrip("\r\n")


def parse_blocks(
    body: str, *, file: str
) -> tuple[tuple[Block, ...], tuple[int, ...], list[Problem]]:
    """The body's blocks, the line each starts on, and every problem. Never raises."""
    lines = body.splitlines(keepends=True)
    blocks: list[Block] = []
    starts: list[int] = []
    problems: list[Problem] = []
    text: list[str] = []
    text_start = 1
    fence: str | None = None
    index = 0

    def problem(code: str, message: str, line: int) -> None:
        problems.append(Problem(file=file, line=line, code=code, message=message))

    def flush() -> None:
        if text and "".join(text) != "":
            blocks.append(Text("".join(text)))
            starts.append(text_start)
        text.clear()

    while index < len(lines):
        raw = lines[index]
        line = _content(raw)
        number = index + 1
        if (opens := _FENCE.match(line)) is not None and (fence is None or fence == opens.group(1)):
            fence = opens.group(1) if fence is None else None
        if fence is not None or (opens is not None):
            if not text:
                text_start = number
            text.append(raw)
            index += 1
            continue
        if _MARKDOC.match(line):
            found = _OLD_TRY.match(line)
            said = (
                f"{line.strip()} is written :::{{try}} {found.group(1)} then ::: on the next line"
                if found
                else f"{line.strip()} is a Markdoc-style tag; directives are :::{{name}} fences"
            )
            problem("CS0414", said, number)
            index += 1
            continue
        opened = _OPEN.match(line)
        if opened is None:
            if not text:
                text_start = number
            text.append(raw)
            index += 1
            continue
        name, argument = opened.group(1), (opened.group(2) or "").strip()
        flush()
        closing = next(
            (at for at in range(index + 1, len(lines)) if _CLOSE.match(_content(lines[at]))), None
        )
        if closing is None:
            problem("CS0408", f":::{{{name}}} is never closed with :::", number)
            return tuple(blocks), tuple(starts), problems
        inner = lines[index + 1 : closing]
        index = closing + 1
        nested = next((at for at, each in enumerate(inner) if _OPEN.match(_content(each))), None)
        if nested is not None:
            problem("CS0406", "a directive cannot hold another directive", number + 1 + nested)
            continue
        if inner and _OPTION.match(_content(inner[0])):
            problem("CS0407", f":::{{{name}}} takes no options", number + 1)
            continue
        if name == "try":
            if not argument:
                problem("CS0410", ":::{try} names no question", number)
            elif "".join(inner).strip():
                problem(
                    "CS0409", f":::{{try}} {argument} places a question; it holds nothing", number
                )
            else:
                blocks.append(Try(argument))
                starts.append(number)
            continue
        if name in CALLOUTS:
            if not "".join(inner).strip():
                problem("CS0411", f"the {name} callout is empty", number)
            else:
                blocks.append(Callout(name, argument, "".join(inner)))
                starts.append(number)
            continue
        if name in _LATER:
            problem(
                "CS0413",
                f":::{{{name}}} arrives in {_LATER[name]}; until then it is not read",
                number,
            )
            continue
        message = f":::{{{name}}} is not a directive this format reads"
        if close := difflib.get_close_matches(name, ["try", *CALLOUTS], n=1):
            message += f" — did you mean {close[0]}?"
        problem("CS0412", message, number)
    flush()
    return tuple(blocks), tuple(starts), problems
```

Then `write_blocks`. Blocks carry no line ending of their own, so it takes the one their text
already uses — `\r\n` if any text or callout holds one, `\n` otherwise — which keeps a Windows body
byte for byte:

```python
def write_blocks(blocks: Sequence[Block]) -> str:
    """The body the blocks came from: the inverse of parse_blocks on a body it accepts."""
    carried = [block.markdown for block in blocks if not isinstance(block, Try)]
    newline = "\r\n" if any("\r\n" in text for text in carried) else "\n"
    out: list[str] = []
    for block in blocks:
        if isinstance(block, Text):
            out.append(block.markdown)
        elif isinstance(block, Try):
            out.append(f":::{{try}} {block.question}{newline}:::{newline}")
        else:
            title = f" {block.title}" if block.title else ""
            out.append(f":::{{{block.kind}}}{title}{newline}{block.markdown}:::{newline}")
    return "".join(out)
```

- [ ] **Step 4: Declare CS0406–CS0414** in `diagnostics.yml` with the *says* of the table above,
  `concern: body`, `refuses: true`, a `fix` naming the syntax to write, and an `explanation` citing
  M4B.2–M4B.3.

- [ ] **Step 5: Run** `uv run pytest tests/schema/test_blocks.py tests/schema/test_diagnostics.py -q` — Expected: PASS. (The registry guards in `tests/repo` pass once `blocks.py` writes each code.)

- [ ] **Step 6: Commit** — `feat(schema): a body read as text, try and callout blocks — M4.1.2`

### Task 2: A node carries its blocks; the fixtures move to MyST

**Files:**
- Modify: `packages/code-schema/src/code_schema/node.py` (`Node.blocks`; `_marker_problems` → `_placement_problems` over `Try` blocks), `__init__.py` (export `Block`, `Text`, `Try`, `Callout`, `parse_blocks`, `write_blocks`)
- Delete: `packages/code-schema/src/code_schema/markers.py`
- Modify: `diagnostics.yml` (`CS0402` retired; CS0403–CS0405 unchanged but their messages now name `:::{try} id`)
- Modify: the three fixture bodies (`dna-and-genes`, `de-bruijn-graphs` ×2) and `transcriptomics/tpm/body.md` (a misconception callout)
- Modify: `docs/reference/diagnostics.md` (regenerated)
- Test: `tests/schema/test_node.py`, `tests/schema/test_fixtures.py`, `tests/schema/test_public_api.py`

**Interfaces:** Consumes Task 1's `parse_blocks`, `Try`. Produces `Node.blocks: tuple[Block, ...]`.

- [ ] **Step 1: Failing tests** — in `test_node.py`, the marker tests move to fences:
  `"Prose.\n\n:::{try} ghost\n:::\n"` → `(CS0403, "`:::{try} ghost` names no question in node.yaml", line 3)`;
  `"A.\n\n:::{try} kmer-count\n:::\n\nB.\n\n:::{try} kmer-count\n:::\n"` → `CS0404` on line 8;
  `GOOD + TRY` with no placement → `CS0405`, message `"kmer-count has no :::{try} kmer-count in body.md"`;
  `'Prose.\n\n{% figure component="x" %}\n'` → `CS0414`; and a new test:

```python
def test_a_node_carries_its_blocks() -> None:
    node, problems = parse_with_providers(GOOD + TRY, "Prose.\n\n:::{try} kmer-count\n:::\n")
    assert problems == []
    assert node is not None
    assert node.blocks == (Text("Prose.\n\n"), Try("kmer-count"))
```

  In `test_fixtures.py`:

```python
def test_every_body_round_trips_through_blocks(content: Content) -> None:
    for node in content.nodes.values():
        assert write_blocks(node.blocks) == node.body, node.id


def test_the_tpm_node_carries_a_misconception() -> None:
    node = read_content(FIXTURES).nodes["tpm"]
    assert [block.kind for block in node.blocks if isinstance(block, Callout)] == ["misconception"]
```

- [ ] **Step 2: Run** `uv run pytest tests/schema -q` — Expected: FAIL (no `Node.blocks`; old markers still read).
- [ ] **Step 3: Implement.** `parse_node` calls `parse_blocks(body, file=body_file)`, adds its problems,
  and passes `blocks` to `Node`. `_placement_problems(blocks, lines, questions, …)` replaces
  `_marker_problems`, with the same three rules and codes, reading placements from `Try` blocks and
  their start lines; messages say `` `:::{try} <id>` names no question in node.yaml ``,
  `` `:::{try} <id>` appears twice in body.md ``, `` <id> has no :::{try} <id> in body.md ``.
  Delete `markers.py`. Mark `CS0402` `retired: "2026-09-29 — the body moved to MyST fences (M4.1.2); a Markdoc-style line is CS0414"`.
  Convert the fixtures: each `{% try X %}` line becomes `:::{try} X` + a `:::` line. In `tpm/body.md`,
  before "TPM compares transcripts within a sample.", add:

```markdown
:::{misconception} TPM is not a count of reads
Equal reads do not mean equal TPM: a transcript twice as long collects about twice the reads from
the same number of molecules, and TPM divides that length out.
:::

```

  Regenerate the reference page (`uv run code-schema diagnostics --write docs/reference/diagnostics.md`).
- [ ] **Step 4: Run** `uv run pytest tests -q && uv run code-schema validate tests/fixtures/salmon` — Expected: PASS; `26 nodes, no problems`.
- [ ] **Step 5: Commit** — `feat(schema): a node carries its blocks; the fixtures use MyST fences — M4.1.2`

### Task 3: Blocks in the index and the node API

**Files:**
- Modify: `apps/api/src/code_api/content/models.py` (`Node.blocks = models.JSONField(default=list)`), new migration `0004_node_blocks.py`, `index.py` (`_node_rows` fills `blocks`), `api.py` (`TextBlockOut`, `TryBlockOut`, `CalloutBlockOut`; `NodeOut.blocks`; `body` removed), `apps/api/openapi.json`
- Test: `apps/api/tests/test_content_index.py`, `apps/api/tests/test_nodes_api.py`

**Interfaces:** Produces `NodeOut.blocks: list[TextBlockOut | TryBlockOut | CalloutBlockOut]` with
`TextBlockOut(kind: Literal["text"], markdown: str)`, `TryBlockOut(kind: Literal["try"], question: str)`,
`CalloutBlockOut(kind: Literal["callout"], callout: str, title: str, markdown: str)`; a JSON block is
the same dict.

- [ ] **Step 1: Failing tests**

```python
# test_content_index.py
def test_a_rebuild_stores_each_nodes_blocks() -> None:
    rebuild_index(FIXTURES)
    stored = Node.objects.get(id="de-bruijn-graphs").blocks
    assert [block["kind"] for block in stored] == ["text", "try", "text", "try", "text"]
    assert stored[1] == {"kind": "try", "question": "kmers-per-read"}
```

```python
# test_nodes_api.py
def test_a_node_serves_its_blocks_and_no_body(client: Client) -> None:
    rebuild_index(FIXTURES)
    body = get(client, "tpm").json()
    assert "body" not in body
    callouts = [block for block in body["blocks"] if block["kind"] == "callout"]
    assert callouts == [
        {
            "kind": "callout",
            "callout": "misconception",
            "title": "TPM is not a count of reads",
            "markdown": CONTENT.nodes["tpm"].blocks[1].markdown,
        }
    ]
```

  (Adjust the callout's index to where it falls in `tpm`'s blocks when the fixture is converted.)
- [ ] **Step 2: Run** `uv run pytest apps/api/tests -q` (Compose's Postgres up) — Expected: FAIL.
- [ ] **Step 3: Implement** the column and migration (`makemigrations content`), `_node_rows`'
  `blocks=[_block_json(block) for block in node.blocks]`, the three `*BlockOut` schemas and
  `blocks=` in the endpoint, removing `body` from `NodeOut`.
- [ ] **Step 4: Regenerate** `openapi.json` (CLAUDE.md's command); run `uv run pytest apps/api/tests -q` and `makemigrations --check --dry-run` — Expected: PASS, no changes.
- [ ] **Step 5: Commit** — `feat(api): the index and the node API carry blocks, not the body — M4.1.2`

### Task 4: The page draws blocks

**Files:**
- Modify: `apps/web/src/api/schema.ts` (regenerated), `apps/web/src/node/body.ts` (`splitBody` removed; `headingsOf(blocks)`, `splitReading(blocks)`), `Body.tsx` (takes `blocks`), `NodePage.tsx`, `FirstSteps.tsx`
- Create: `apps/web/src/node/Callout.tsx`, `Callout.test.tsx`
- Modify: `debruijn.fixture.ts`, `firststeps.fixture.ts` (captured again from the API), `body.test.ts`, `NodePage.test.tsx`, `FirstSteps.test.tsx`

**Interfaces:** Consumes `NodeOut.blocks` from Task 3 (`schema.ts` types `TextBlockOut`,
`TryBlockOut`, `CalloutBlockOut`). Produces `type Block = TextBlockOut | TryBlockOut | CalloutBlockOut`,
`headingsOf(blocks: Block[])`, `splitReading(blocks: Block[]): { blocks: Block[]; reading: string }`.

- [ ] **Step 1: Failing tests**

```ts
// body.test.ts
describe("headingsOf", () => {
  it("lists the second-level headings of the text blocks", () => {
    const blocks: Block[] = [
      { kind: "text", markdown: "Lead.\n\n## What DNA is\n\nText.\n" },
      { kind: "try", question: "q" },
      { kind: "text", markdown: "\n## Why it matters\n" },
    ];
    expect(headingsOf(blocks).map((heading) => heading.text)).toEqual(["What DNA is", "Why it matters"]);
  });
});

describe("splitReading", () => {
  it("moves Further reading out of the blocks, into its own text", () => {
    const blocks: Block[] = [
      { kind: "text", markdown: "Body.\n\n## Further reading\n\n- [A](https://example.org)\n" },
    ];
    const { blocks: kept, reading } = splitReading(blocks);
    expect(kept).toEqual([{ kind: "text", markdown: "Body.\n" }]);
    expect(reading).toBe("\n- [A](https://example.org)\n");
  });
});
```

```tsx
// Callout.test.tsx
it("draws a callout with its kind and title", () => {
  render(<Callout kind="misconception" title="TPM is not a count of reads" markdown="Equal reads." />);
  const box = screen.getByRole("note", { name: "Misconception: TPM is not a count of reads" });
  expect(within(box).getByText("Misconception")).toBeInTheDocument();
  expect(within(box).getByText("Equal reads.")).toBeInTheDocument();
});
```

  and in `NodePage.test.tsx` / `FirstSteps.test.tsx`, the existing body tests build `blocks` instead
  of `body`, plus: *a text block that is only blank lines draws nothing*.
- [ ] **Step 2: Run** in `apps/web` on Node 24 `npx vitest run src/node` — Expected: FAIL.
- [ ] **Step 3: Implement** — `npm run api-types`; `Body` maps `blocks` (text → `Markdown`, skipping
  blank; try → `TryQuestion`; callout → `Callout`); `Callout.tsx` is a `role="note"` `aside` with an
  accessible name `"<Kind>: <title>"`, a small kind label, the title, and the markdown through the
  same `Markdown` components, in the Learn it card's panel classes (`rounded-xl border border-border
  bg-surface px-4 py-3.5`), no new colour; `NodePage` and `FirstSteps` pass `node.blocks`; capture
  the two node fixtures again from the audit stack.
- [ ] **Step 4: Run** `npm run lint && npm run typecheck && npm test && npm run build` — Expected: PASS.
- [ ] **Step 5: Commit** — `feat(web): the node pages draw blocks, and a callout — M4.1.2`

### Task 5: Walk it, and close

- [ ] Rebuild the audit stack's web image and index; walk `/node/de-bruijn-graphs?goal=salmon`,
  `/node/dna-and-genes?goal=salmon` and `/node/tpm?goal=salmon` at 1440 light and dark and 360: the
  pages look as before; the callout draws. Record what was seen on #129.
- [ ] Journal entry; tick this plan with its execution record; PR `Closes #129`; ask before merging.

## Execution record

(Filled in as tasks complete.)
