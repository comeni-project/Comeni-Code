# M1 part 2: links in the schema — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task by task, driven by one agent. Subagents are for review only (the operator's rule in CLAUDE.md). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `node.yaml` carries *needs*, *goes deeper* and *related* links, each with a reason;
`code-schema` reads them, refuses what one file can show is wrong, and writes them back canonically.

**Architecture:** One new module, `links.py`, parses one link list — every link of every kind has
the same shape, `node` + `reason`, so one parser serves all three. `node.py` calls it for each
field present, then checks the one rule that spans kinds (no node under two kinds). The writer
appends the lists after `minutes`, indented under their keys. Part 1's per-mapping key lines are
what let every message name the entry's own line.

**Tech Stack:** Python 3.14, PyYAML 6, pytest 9.1, mypy 2.3 strict, ruff 0.16.

**Spec:** [`docs/superpowers/specs/2026-09-18-m1-links-in-the-schema-design.md`](../specs/2026-09-18-m1-links-in-the-schema-design.md)
(agreed 2026-09-18). Builds on
[part 1's spec](../specs/2026-09-18-m1-node-folder-and-core-fields-design.md) and its code in
`packages/code-schema/`.

## Global Constraints

- **No new imports in `code-schema`.** The allowlist stays exactly as part 1 left it.
- **Nothing raises; no coercion; the message shape is part 1's** (`path[:line][: field]: message`).
- **The messages are the spec's table (M1P2.5), character for character.** If a test and the code
  disagree, fix the code.
- YAML keys: `needs`, `goes-deeper`, `related`. Python attributes: `needs`, `goes_deeper`,
  `related`, each `tuple[Link, ...]`, default `()`.
- *related* holds at most **4** links.
- Same command set, same commit and PR rules as part 1; **never commit to `main`**; merge only when
  `gh pr checks <n> --watch` exits 0, captured to a file, never piped.

## Files

| Path | Responsibility |
|---|---|
| `packages/code-schema/src/code_schema/links.py` | `Link`, `LINK_FIELDS`, `MAX_PEERS`, `parse_links` |
| `packages/code-schema/src/code_schema/node.py` | `Node` gains the three tuples; `parse_node` wires them, adds the cross-kind rule and suggestions for optional fields |
| `packages/code-schema/src/code_schema/writer.py` | writes the links, indented |
| `packages/code-schema/src/code_schema/__init__.py` | exports `Link` |
| `tests/schema/test_links.py`, `test_node.py`, `test_writer.py`, `test_public_api.py` | the tests |
| `docs/notes/journal/2026-09-18-m1-part-2-links.md` | the record |

---

### Task 0: Land the spec, the plan and the spec edits

The branch `docs/m1-part-2` holds this plan, the part 2 spec, and the edits to W3.2, W3.3, S2,
CLAUDE.md's invariant 2 and the architecture spec's R2/M1 lines.

- [ ] **Step 1:** `uv run pytest tests/repo && uv run ruff format --check .` — both pass (ruff
  formats Python blocks in Markdown).
- [ ] **Step 2:** Commit, push, open the PR, wait for `exit=0`, merge.
- [ ] **Step 3:** `git checkout main && git pull && git checkout -b feat/m1-links`

---

### Task 1: `Link` and `parse_links`

**Files:**
- Create: `packages/code-schema/src/code_schema/links.py`
- Create: `tests/schema/test_links.py`

**Interfaces:**
- Consumes: `Problem`; `Lines`, `load_mapping`; `one_sentence`, `shown`, `slug`.
- Produces: `Link(node: str, reason: str)` (frozen); `LINK_FIELDS = ("needs", "goes-deeper", "related")`;
  `MAX_PEERS = 4`;
  `parse_links(value: object, *, kind: str, node_id: str, lines: Lines, file: str) -> tuple[tuple[Link, ...], tuple[int | None, ...], list[Problem]]`
  — the valid links, the line of each, and the problems.

- [ ] **Step 1: Write the failing test**

```python
# tests/schema/test_links.py
"""One link list, every per-node rule of spec M1P2.5."""

from code_schema.links import Link, parse_links
from code_schema.problems import Problem
from code_schema.yaml_lines import load_mapping


def run(text: str, kind: str = "needs") -> tuple[tuple[Link, ...], list[str]]:
    """Parse `text` as a node.yaml fragment and return the links and the rendered problems."""
    data, lines, problems = load_mapping(text, file="salmon/node.yaml")
    assert data is not None, problems
    links, _, found = parse_links(
        data[kind], kind=kind, node_id="salmon", lines=lines, file="salmon/node.yaml"
    )
    return links, [str(p) for p in sorted(found, key=Problem.sort_key)]


GOOD = """\
needs:
  - node: what-tpm-measures
    reason: Salmon reports abundance in TPM.
  - node: selective-alignment
    reason: Salmon maps reads by selective alignment.
"""


def test_links_keep_the_authors_order() -> None:
    links, problems = run(GOOD)
    assert problems == []
    assert links == (
        Link("what-tpm-measures", "Salmon reports abundance in TPM."),
        Link("selective-alignment", "Salmon maps reads by selective alignment."),
    )


def test_the_line_of_each_link_is_returned() -> None:
    data, lines, _ = load_mapping(GOOD, file="salmon/node.yaml")
    assert data is not None
    _, link_lines, _ = parse_links(
        data["needs"], kind="needs", node_id="salmon", lines=lines, file="salmon/node.yaml"
    )
    assert link_lines == (2, 4)


def test_the_field_must_be_a_list() -> None:
    _, problems = run("needs: k-mers\n")
    assert problems == [
        "salmon/node.yaml:1: needs: must be a list of links, each with a node and a reason"
    ]


def test_an_empty_list_is_written_by_leaving_the_field_out() -> None:
    _, problems = run("needs: []\n")
    assert problems == [
        "salmon/node.yaml:1: needs: an empty list is written by leaving the field out"
    ]


def test_an_entry_must_be_a_mapping() -> None:
    _, problems = run("needs:\n  - k-mers\n")
    assert problems == [
        'salmon/node.yaml:1: needs: "k-mers" is not a link — '
        "write node: and reason: on separate lines"
    ]


def test_an_unknown_key_in_a_link_names_its_line() -> None:
    _, problems = run("needs:\n  - node: k-mers\n    reason: Salmon indexes k-mers.\n    why: x\n")
    assert problems == [
        "salmon/node.yaml:4: needs: unknown key `why` in a link (a link has node and reason)"
    ]


def test_a_link_needs_a_node() -> None:
    _, problems = run("needs:\n  - reason: Salmon indexes k-mers.\n")
    assert problems == ["salmon/node.yaml:2: needs: a link has no node"]


def test_the_node_is_a_slug() -> None:
    _, problems = run("needs:\n  - node: K-mers\n    reason: Salmon indexes k-mers.\n")
    assert problems == [
        'salmon/node.yaml:2: needs: "K-mers" is not a node id (lower case, digits and single hyphens)'
    ]


def test_a_link_needs_a_reason() -> None:
    _, problems = run("needs:\n  - node: k-mers\n")
    assert problems == ["salmon/node.yaml:2: needs: the link to k-mers has no reason"]


def test_the_reason_is_one_sentence_and_names_its_own_line() -> None:
    _, problems = run(GOOD + "  - node: k-mers\n    reason: Salmon indexes k-mers\n")
    assert problems == ["salmon/node.yaml:7: needs: the reason for k-mers must end with . ? or !"]


def test_a_reason_that_is_not_text() -> None:
    _, problems = run("needs:\n  - node: k-mers\n    reason: 12\n")
    assert problems == ["salmon/node.yaml:3: needs: the reason for k-mers is not text"]


def test_a_node_listed_twice_names_the_first_line() -> None:
    _, problems = run(GOOD + "  - node: what-tpm-measures\n    reason: Again.\n")
    assert problems == [
        "salmon/node.yaml:6: needs: what-tpm-measures is listed twice (first on line 2)"
    ]


def test_a_node_does_not_link_to_itself() -> None:
    _, problems = run("related:\n  - node: salmon\n    reason: Itself.\n", kind="related")
    assert problems == ["salmon/node.yaml:2: related: salmon links to itself"]


def test_related_holds_at_most_four() -> None:
    peers = "".join(
        f"  - node: peer-{n}\n    reason: Peer {n} does the job differently.\n" for n in range(5)
    )
    _, problems = run("related:\n" + peers, kind="related")
    assert problems == [
        "salmon/node.yaml:10: related: 5 peers, at most 4 — a node with more is probably two nodes"
    ]


def test_needs_has_no_cap() -> None:
    needs = "".join(f"  - node: need-{n}\n    reason: Need {n} comes first.\n" for n in range(6))
    links, problems = run("needs:\n" + needs)
    assert problems == [] and len(links) == 6
```

- [ ] **Step 2: Run it and watch it fail**

Run: `uv run pytest tests/schema/test_links.py -q`
Expected: collection error, `No module named 'code_schema.links'`

- [ ] **Step 3: Write the module**

```python
# packages/code-schema/src/code_schema/links.py
"""A node's links, as written in node.yaml (spec M1P2.2, M1P2.5).

Every link of every kind has one shape, `node` + `reason`, so one parser serves all three. Only
the rules one file can check live here; targets that exist, symmetry, cycles and levels need the
whole graph (part 3).
"""

from __future__ import annotations

from dataclasses import dataclass

from code_schema.fields import one_sentence, shown, slug
from code_schema.problems import Problem
from code_schema.yaml_lines import Lines

LINK_FIELDS = ("needs", "goes-deeper", "related")
MAX_PEERS = 4

_LINK_KEYS = ("node", "reason")
_node_id = slug(noun="node id")
_sentence = one_sentence(max_len=200)


@dataclass(frozen=True)
class Link:
    node: str
    reason: str


def _reason_problem(value: object) -> str | None:
    """Phrased to follow "the reason for <node>"."""
    if not isinstance(value, str):
        return "is not text"
    return _sentence(value)


def parse_links(
    value: object, *, kind: str, node_id: str, lines: Lines, file: str
) -> tuple[tuple[Link, ...], tuple[int | None, ...], list[Problem]]:
    """One link list. Never raises; returns the valid links, their lines, and the problems."""
    field_line = lines.get(kind)

    def problem(message: str, line: int | None = field_line) -> Problem:
        return Problem(file=file, field=kind, line=line, message=message)

    if not isinstance(value, list):
        return (), (), [problem("must be a list of links, each with a node and a reason")]
    if not value:
        return (), (), [problem("an empty list is written by leaving the field out")]

    links: list[Link] = []
    link_lines: list[int | None] = []
    problems: list[Problem] = []
    first_seen: dict[str, int | None] = {}

    for entry in value:
        if not isinstance(entry, dict):
            problems.append(
                problem(f"{shown(entry)} is not a link — write node: and reason: on separate lines")
            )
            continue
        node_line = lines.of(entry, "node")
        entry_line = next((lines.of(entry, str(key)) for key in entry), field_line)
        sound = True

        for key in entry:
            if key not in _LINK_KEYS:
                problems.append(
                    problem(
                        f"unknown key `{key}` in a link (a link has node and reason)",
                        lines.of(entry, str(key)),
                    )
                )
                sound = False

        target = entry.get("node")
        if "node" not in entry:
            problems.append(problem("a link has no node", entry_line))
            continue
        if (wrong := _node_id(target)) is not None or not isinstance(target, str):
            problems.append(problem(wrong or "", node_line))
            continue

        reason = entry.get("reason")
        if "reason" not in entry:
            problems.append(problem(f"the link to {target} has no reason", node_line))
            sound = False
        elif (wrong := _reason_problem(reason)) is not None:
            problems.append(problem(f"the reason for {target} {wrong}", lines.of(entry, "reason")))
            sound = False

        if target == node_id:
            problems.append(problem(f"{target} links to itself", node_line))
            continue
        if target in first_seen:
            first = first_seen[target]
            where = "" if first is None else f" (first on line {first})"
            problems.append(problem(f"{target} is listed twice{where}", node_line))
            continue
        first_seen[target] = node_line

        if sound and isinstance(reason, str):
            links.append(Link(node=target, reason=reason))
            link_lines.append(node_line)

    if kind == "related" and len(value) > MAX_PEERS:
        over = value[MAX_PEERS]
        line = lines.of(over, "node") if isinstance(over, dict) else field_line
        problems.append(
            problem(
                f"{len(value)} peers, at most {MAX_PEERS} — a node with more is probably two nodes",
                line,
            )
        )

    return tuple(links), tuple(link_lines), problems
```

- [ ] **Step 4:** `uv run pytest tests/schema -q && uv run mypy && uv run ruff check . && uv run ruff format --check .` — PASS
- [ ] **Step 5: Commit** — `feat(schema): parse a node's links, one shape for every kind` (body: one
  parser because every kind shares `node` + `reason`; lines are the entry's own; the cap on related
  is a per-file rule because related is written on both nodes).

---

### Task 2: `Node` carries its links

**Files:**
- Modify: `packages/code-schema/src/code_schema/node.py`
- Modify: `tests/schema/test_node.py`

**Interfaces:**
- Consumes: `Link`, `LINK_FIELDS`, `parse_links` (Task 1).
- Produces: `Node.needs`, `Node.goes_deeper`, `Node.related: tuple[Link, ...] = ()`.

- [ ] **Step 1: Write the failing tests** (append to `tests/schema/test_node.py`; add
  `from code_schema.links import Link` to its imports)

```python
LINKED = (
    GOOD
    + """\
needs:
  - node: what-tpm-measures
    reason: Salmon reports abundance in TPM.
goes-deeper:
  - node: pufferfish-index
    reason: How Salmon fits a transcriptome's k-mers into memory, and why that makes it fast.
related:
  - node: kallisto
    reason: kallisto does the same job by pseudoalignment, without Salmon's bias correction.
"""
)


def test_a_node_reads_its_three_kinds_of_link() -> None:
    node, problems = parse(LINKED)
    assert problems == []
    assert node is not None
    assert node.needs == (Link("what-tpm-measures", "Salmon reports abundance in TPM."),)
    assert [link.node for link in node.goes_deeper] == ["pufferfish-index"]
    assert [link.node for link in node.related] == ["kallisto"]


def test_a_node_without_links_has_empty_tuples() -> None:
    node, _ = parse(GOOD)
    assert node is not None
    assert node.needs == node.goes_deeper == node.related == ()


def test_a_node_is_one_kind_of_neighbour_not_two() -> None:
    both = LINKED + ("  - node: what-tpm-measures\n    reason: TPM is another way to count.\n")
    _, problems = parse(both)
    assert [str(p) for p in problems] == [
        "salmon/node.yaml:16: related: what-tpm-measures is also under needs (line 8) — "
        "a node is one kind of neighbour, not two"
    ]


def test_a_typo_of_an_optional_field_is_suggested() -> None:
    _, problems = parse(LINKED.replace("goes-deeper:", "goes_deeper:"))
    assert [str(p) for p in problems] == [
        "salmon/node.yaml:10: unknown field `goes_deeper` — did you mean `goes-deeper`?"
    ]


def test_link_problems_and_field_problems_come_in_one_run() -> None:
    broken = LINKED.replace("level: intermediate", "level: expert").replace(
        "reason: Salmon reports abundance in TPM.", "reason: TPM"
    )
    _, problems = parse(broken)
    assert [str(p) for p in problems] == [
        'salmon/node.yaml:5: level: "expert" is not a level '
        "(first-steps, foundations, introductory, intermediate, advanced)",
        "salmon/node.yaml:9: needs: the reason for what-tpm-measures must end with . ? or !",
    ]
```

- [ ] **Step 2:** Run `uv run pytest tests/schema/test_node.py -q` — FAIL (`cannot import name 'Link'`
  or attribute errors).

- [ ] **Step 3: Change `node.py`**

Imports gain `from code_schema.links import LINK_FIELDS, Link, parse_links`.

`Node` gains, after `body`:

```python
    needs: tuple[Link, ...] = ()
    goes_deeper: tuple[Link, ...] = ()
    related: tuple[Link, ...] = ()
```

In `parse_node`, replace the unknown-field loop with one that suggests any absent known field and
says *required and missing* only when that is true:

```python
    specs = fields(regions)
    required = {spec.name for spec in specs if spec.required}
    known = {spec.name for spec in specs} | set(LINK_FIELDS)
    absent = [name for name in [*(s.name for s in specs), *LINK_FIELDS] if name not in data]
    missing = [name for name in absent if name in required]
    for key in data:
        if key in known:
            continue
        message = f"unknown field `{key}`"
        if close := difflib.get_close_matches(key, absent, n=1):
            message += f" — did you mean `{close[0]}`?"
            if close[0] in missing:
                # A typo of a required field is one mistake, so it is one problem.
                message += f" ({close[0]} is required and missing)"
                missing.remove(close[0])
            absent.remove(close[0])
        problems.append(Problem(file=file, line=lines.get(key), message=message))
```

After the scalar checks, parse the links and apply the cross-kind rule:

```python
    parsed: dict[str, tuple[Link, ...]] = {}
    seen: dict[str, tuple[str, int | None]] = {}
    for kind in LINK_FIELDS:
        if kind not in data:
            parsed[kind] = ()
            continue
        links, link_lines, link_problems = parse_links(
            data[kind], kind=kind, node_id=node_id, lines=lines, file=file
        )
        problems += link_problems
        parsed[kind] = links
        for link, line in zip(links, link_lines, strict=True):
            if link.node in seen:
                other_kind, other_line = seen[link.node]
                at = "" if other_line is None else f" (line {other_line})"
                problems.append(
                    Problem(
                        file=file,
                        field=kind,
                        line=line,
                        message=(
                            f"{link.node} is also under {other_kind}{at} — "
                            "a node is one kind of neighbour, not two"
                        ),
                    )
                )
            else:
                seen[link.node] = (kind, line)
```

and the returned `Node` gains `needs=parsed["needs"], goes_deeper=parsed["goes-deeper"],
related=parsed["related"]`.

- [ ] **Step 4:** Full check — `uv run pytest tests/schema tests/guards -q && uv run mypy && uv run ruff check . && uv run ruff format --check .` — PASS, part 1's tests included.
- [ ] **Step 5: Commit** — `feat(schema): a node carries its needs, goes-deeper and related links`
  (body: the cross-kind rule and why it is a contradiction; suggestions now cover optional fields,
  since `goes_deeper` for `goes-deeper` is the likeliest typo in the file).

---

### Task 3: Writing links back

**Files:**
- Modify: `packages/code-schema/src/code_schema/writer.py`
- Modify: `tests/schema/test_writer.py`

- [ ] **Step 1: Write the failing tests** (append; add `from code_schema.links import Link`)

```python
LINKED = replace(
    NODE,
    needs=(Link("what-tpm-measures", "Salmon reports abundance in TPM."),),
    goes_deeper=(
        Link(
            "pufferfish-index",
            "How Salmon fits a transcriptome's k-mers into memory, and why that makes it fast.",
        ),
    ),
    related=(
        Link(
            "kallisto",
            "kallisto does the same job by pseudoalignment, without Salmon's bias correction.",
        ),
    ),
)

LINKED_CANONICAL = (
    CANONICAL
    + """\
needs:
  - node: what-tpm-measures
    reason: Salmon reports abundance in TPM.
goes-deeper:
  - node: pufferfish-index
    reason: How Salmon fits a transcriptome's k-mers into memory, and why that makes it fast.
related:
  - node: kallisto
    reason: kallisto does the same job by pseudoalignment, without Salmon's bias correction.
"""
)

REGIONS_AND_TARGETS = REGIONS  # part 2 does not check that targets exist; part 3 does


def test_links_are_written_after_minutes_indented_in_a_fixed_order() -> None:
    assert write_node_yaml(LINKED) == LINKED_CANONICAL


def test_a_node_without_links_writes_no_link_keys() -> None:
    assert "needs" not in write_node_yaml(NODE)


def test_the_three_laws_hold_with_links(tmp_path: Path) -> None:
    folder = tmp_path / "salmon"
    write_node_folder(LINKED, folder)
    again, problems = read_node(folder, regions=REGIONS, root=tmp_path)
    assert problems == [] and again == LINKED
    assert (folder / "node.yaml").read_text(encoding="utf-8") == LINKED_CANONICAL
    write_node_folder(again, folder)
    assert (folder / "node.yaml").read_text(encoding="utf-8") == LINKED_CANONICAL
```

- [ ] **Step 2:** Run — FAIL (the writer drops links).

- [ ] **Step 3: Change `writer.py`**

```python
class _IndentedDumper(yaml.SafeDumper):
    """Lists indented under their key (`  - node: …`), as every example in the specs is written.

    PyYAML's default puts the dash at the key's own column.
    """

    def increase_indent(self, flow: bool = False, indentless: bool = False) -> None:
        return super().increase_indent(flow, False)


_LINK_KEYS = (("needs", "needs"), ("goes-deeper", "goes_deeper"), ("related", "related"))
```

In `write_node_yaml`, after `minutes`:

```python
    for key, attribute in _LINK_KEYS:
        links: tuple[Link, ...] = getattr(node, attribute)
        if links:
            fields[key] = [{"node": link.node, "reason": link.reason} for link in links]
    return str(
        yaml.dump(
            fields,
            Dumper=_IndentedDumper,
            sort_keys=False,
            default_flow_style=False,
            allow_unicode=True,
            width=_NO_FOLDING,
        )
    )
```

(`_IndentedDumper` subclasses `SafeDumper`, so `yaml.dump` stays safe.)

- [ ] **Step 4:** Full check — PASS, part 1's writer tests included (a node without links must
  still write the part 1 canonical form byte for byte).
- [ ] **Step 5: Commit** — `feat(schema): write links back canonically`.

---

### Task 4: Public API, journal, PR

- [ ] **Step 1:** `test_public_api.py` gains `"Link"` in the expected set; run it — FAIL.
- [ ] **Step 2:** `__init__.py` imports and exports `Link`; run — PASS.
- [ ] **Step 3:** The whole command set passes.
- [ ] **Step 4:** Walk M1P2.1's done-when item by item, naming the test that proves each.
- [ ] **Step 5:** Journal entry `docs/notes/journal/2026-09-18-m1-part-2-links.md` (where things
  stand with checks; commits; decisions and rejections, including every departure from this plan;
  next: part 3; open questions; traps), a row in the README's Entries table, and the box.
- [ ] **Step 6:** Commit, push, PR, `exit=0`, merge.

---

## Self-review against the spec

| Spec section | Task |
|---|---|
| M1P2.2 one shape, reasons, reason rule | 1 |
| M1P2.3 *needs* as a list; optional paths refused until wired | 1, 2 (an `any-of` entry is "unknown key"; `helps` is "unknown field") |
| M1P2.4 related on both sides (per-file cap here, symmetry in part 3) | 1 |
| M1P2.5 every rule and message | 1 (per list), 2 (cross-kind, suggestions) |
| M1P2.6 writer order and indentation | 3 |
| M1P2.1 done-when | 4 |
