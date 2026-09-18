# M1 part 1: the node folder and its core fields — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task by task, driven by one agent. Subagents are for review only (the operator's rule in CLAUDE.md). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `code-schema` reads a node folder into a `Node`, says exactly what is wrong when it
cannot, and writes a `Node` back as the bytes it read.

**Architecture:** Six small modules in the pure package. A `Problem` is one line of output and the
only thing every other module returns. A `SafeLoader` subclass records each key's line, because
messages carry line numbers and `yaml.safe_load` throws the marks away. Field rules are a table of
`(name, required, check)` rows so part 2 adds links as rows, not as new machinery. Nothing raises:
problems accumulate and are returned, so one run reports everything wrong. The writer is canonical
— one correct rendering of a node — which is what makes the round-trip laws testable.

**Tech Stack:** Python 3.14, PyYAML 6, pytest 9.1, mypy 2.3 strict, ruff 0.16, uv 0.11.

**Spec:** [`docs/superpowers/specs/2026-09-18-m1-node-folder-and-core-fields-design.md`](../specs/2026-09-18-m1-node-folder-and-core-fields-design.md)
(agreed by the operator on 2026-09-18). Parts list:
[`docs/notes/journal/2026-09-18-m1-in-parts.md`](../../notes/journal/2026-09-18-m1-in-parts.md).
Link kinds, which part 2 turns into fields: W3.2 of
[`2026-09-16-comeni-code-weaving-and-pages-design.md`](../specs/2026-09-16-comeni-code-weaving-and-pages-design.md).

## Global Constraints

- **`code-schema` stays pure**: no Django, no HTTP client, no model library. Its allowlist in
  `tests/guards/purity.py` is closed and currently `{"__future__", "typing"}`. **Each task that
  needs a new import adds it to the allowlist in the same commit**, and by the end the allowlist is
  exactly `__future__`, `typing`, `collections.abc`, `dataclasses`, `difflib`, `enum`, `pathlib`,
  `re`, `yaml`.
- **Nothing raises.** Every public function returns `(value | None, list[Problem])`. A caller that
  wants an exception can write one; a validator that stops at the first problem cannot be un-written.
- **No coercion.** `minutes: "12"` is as wrong as `minutes: "twelve"`.
- **The message shape is fixed** (spec M1P1.5): `path[:line][: field]: what is wrong`. Parts 2–6
  depend on it.
- **Levels** are exactly `first-steps`, `foundations`, `introductory`, `intermediate`, `advanced`.
- **Ids are slugs**: `^[a-z0-9]+(-[a-z0-9]+)*$`. The folder name is the id; there is no `id:` field.
- Ruff: line length 100, rules `E F I UP B SIM`. mypy `strict` covers `packages/` and `tests/`.
- The command set, the same locally and in CI: `uv sync --locked --all-packages`,
  `uv run ruff check .`, `uv run ruff format --check .`, `uv run mypy`, `uv run pytest`.
- Tests never read `../comeni-code-content`. Part 1's tests build their files in `tmp_path`.
- Commits: `type(scope): what is now true`, a body saying why, ending with
  `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`. PR descriptions end with
  `🤖 Generated with [Claude Code](https://claude.com/claude-code)`. **Never commit to `main`.**

## Files

| Path | Responsibility |
|---|---|
| `packages/code-schema/pyproject.toml` | gains `pyyaml>=6.0,<7` |
| `packages/code-schema/src/code_schema/problems.py` | `Problem` and its one-line rendering |
| `packages/code-schema/src/code_schema/yaml_lines.py` | `LineLoader`, `load_mapping` — parse YAML and keep each key's line |
| `packages/code-schema/src/code_schema/fields.py` | the check functions and the `Spec` row type |
| `packages/code-schema/src/code_schema/regions.py` | `Region`, `parse_regions`, `read_regions` |
| `packages/code-schema/src/code_schema/node.py` | `Level`, `Node`, `parse_node`, `read_node` |
| `packages/code-schema/src/code_schema/writer.py` | the canonical writer and `write_node_folder` |
| `packages/code-schema/src/code_schema/__init__.py` | the public API |
| `tests/schema/test_problems.py` … `test_writer.py` | one test module per source module |
| `tests/guards/purity.py` | the allowlist, one line per task that needs it |
| `pyproject.toml` | dev group gains `types-PyYAML` |
| `CLAUDE.md` | the layout line for `code_schema` |
| `docs/notes/journal/2026-09-18-m1-part-1-node-folder.md` | the record |

---

### Task 0: Land the spec and this plan, then branch

The spec and this plan are uncommitted. They land first, so the part's branch starts from a `main`
that already holds them.

- [ ] **Step 1: Commit both on a docs branch**

```bash
git checkout -b docs/m1-part-1
git add docs/superpowers/specs/2026-09-18-m1-node-folder-and-core-fields-design.md \
        docs/superpowers/plans/2026-09-18-m1-node-folder-and-core-fields.md
git commit -m "$(cat <<'EOF'
docs: spec and plan for M1 part 1

The node folder, the six core fields, the region registry, the body
envelope, the message shape and the canonical writer. Agreed section by
section on 2026-09-18.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 2: Open the pull request, wait for green, merge**

```bash
git push -u origin docs/m1-part-1
gh pr create --title "docs: spec and plan for M1 part 1" --body "…ending with the attribution line…"
gh pr checks <n> --watch --interval 15 > /tmp/checks.txt 2>&1; echo "exit=$?"
```

Merge **only** when that `exit=0`. Never pipe `gh pr checks` into anything.

- [ ] **Step 3: Branch for the work**

```bash
git checkout main && git pull
git checkout -b feat/m1-node-schema
```

---

### Task 1: `Problem`, the shape every other module returns

**Files:**
- Create: `packages/code-schema/src/code_schema/problems.py`
- Create: `tests/schema/test_problems.py`
- Modify: `tests/guards/purity.py` (allowlist: add `dataclasses`)

**Interfaces:**
- Produces: `Problem(file: str, message: str, field: str | None = None, line: int | None = None)`,
  frozen, with `__str__`. Every later task returns `list[Problem]`.

- [ ] **Step 1: Write the failing test**

```python
# tests/schema/test_problems.py
"""A problem is one line of output (spec M1P1.5)."""

from code_schema.problems import Problem


def test_a_field_problem_names_file_line_and_field() -> None:
    problem = Problem(
        file="salmon/node.yaml",
        field="level",
        line=5,
        message='"expert" is not a level (first-steps, foundations, introductory, intermediate, advanced)',
    )
    assert str(problem) == (
        'salmon/node.yaml:5: level: "expert" is not a level '
        "(first-steps, foundations, introductory, intermediate, advanced)"
    )


def test_a_missing_field_has_no_line() -> None:
    problem = Problem(file="salmon/node.yaml", field="claim", message="required field is missing")
    assert str(problem) == "salmon/node.yaml: claim: required field is missing"


def test_a_problem_about_a_folder_names_no_field() -> None:
    assert str(Problem(file="salmon/", message="body.md is missing")) == "salmon/: body.md is missing"


def test_problems_sort_by_file_then_line() -> None:
    late = Problem(file="salmon/node.yaml", line=6, message="b")
    early = Problem(file="salmon/node.yaml", line=3, message="a")
    assert sorted([late, early], key=Problem.sort_key) == [early, late]
```

- [ ] **Step 2: Run it and watch it fail**

Run: `uv run pytest tests/schema/test_problems.py -v`
Expected: FAIL, `ModuleNotFoundError: No module named 'code_schema.problems'`

- [ ] **Step 3: Write the module**

```python
# packages/code-schema/src/code_schema/problems.py
"""What the validator says when a file is wrong (spec M1P1.5).

One problem is one line: `path[:line][: field]: what is wrong`. Nothing in this package raises;
problems accumulate and are returned, so one run reports everything wrong with a node.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Problem:
    file: str
    message: str
    field: str | None = None
    line: int | None = None

    def __str__(self) -> str:
        where = self.file if self.line is None else f"{self.file}:{self.line}"
        what = self.message if self.field is None else f"{self.field}: {self.message}"
        return f"{where}: {what}"

    @staticmethod
    def sort_key(problem: Problem) -> tuple[str, int]:
        """File order, then line. A problem with no line comes first in its file."""
        return (problem.file, -1 if problem.line is None else problem.line)
```

- [ ] **Step 4: Add `dataclasses` to the allowlist**

In `tests/guards/purity.py`, the `code-schema` entry becomes:

```python
    "code-schema": frozenset({"__future__", "dataclasses", "typing"}),
```

- [ ] **Step 5: Run the tests and the guards**

Run: `uv run pytest tests/schema tests/guards -v`
Expected: PASS, including `test_pure_packages_import_only_what_they_declare`

- [ ] **Step 6: Commit**

```bash
git add packages/code-schema/src/code_schema/problems.py tests/schema/test_problems.py tests/guards/purity.py
git commit -m "$(cat <<'EOF'
feat(schema): add Problem, the validator's one line of output

Every function in the package returns problems rather than raising, so one
run reports everything wrong with a node instead of one thing per round
trip. The rendering is fixed here because parts 2 to 6 depend on it.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: The line-recording YAML loader

**Files:**
- Create: `packages/code-schema/src/code_schema/yaml_lines.py`
- Create: `tests/schema/test_yaml_lines.py`
- Modify: `packages/code-schema/pyproject.toml` (dependency), `pyproject.toml` (dev group),
  `tests/guards/purity.py` (allowlist: add `collections.abc`, `typing` is already there, `yaml`)

**Interfaces:**
- Consumes: `Problem` (Task 1).
- Produces: `load_mapping(text: str, *, file: str) -> tuple[dict[str, object] | None, dict[str, int], list[Problem]]`
  — the data, a key → line map (1-based, first occurrence wins, all depths), and problems.

- [ ] **Step 1: Declare the dependency**

`packages/code-schema/pyproject.toml`: `dependencies = ["pyyaml>=6.0,<7"]`.
Root `pyproject.toml`, `[dependency-groups] dev`: add `"types-PyYAML>=6.0,<7"` — PyYAML ships no
inline types and mypy runs strict.

Run: `uv lock && uv sync --locked --all-packages`

- [ ] **Step 2: Write the failing test**

```python
# tests/schema/test_yaml_lines.py
"""YAML with the line of every key kept (spec M1P1.5)."""

from code_schema.yaml_lines import load_mapping

GOOD = """\
schema: 1
title: Salmon
minutes: 12
"""


def test_it_reads_a_mapping_and_records_each_key_line() -> None:
    data, lines, problems = load_mapping(GOOD, file="salmon/node.yaml")
    assert problems == []
    assert data == {"schema": 1, "title": "Salmon", "minutes": 12}
    assert lines == {"schema": 1, "title": 2, "minutes": 3}


def test_a_syntax_error_becomes_a_problem_with_its_line() -> None:
    data, lines, problems = load_mapping("title: [Salmon\n", file="salmon/node.yaml")
    assert data is None
    assert len(problems) == 1
    # PyYAML decides which line it noticed the trouble on; the shape is ours.
    assert problems[0].line in (1, 2)
    assert str(problems[0]).startswith("salmon/node.yaml:")
    assert "not valid YAML (" in str(problems[0])


def test_a_document_that_is_not_a_mapping_is_a_problem() -> None:
    data, _, problems = load_mapping("- salmon\n", file="salmon/node.yaml")
    assert data is None
    assert str(problems[0]) == "salmon/node.yaml: the file must be a mapping of fields, not a list"


def test_an_empty_file_is_a_problem() -> None:
    data, _, problems = load_mapping("", file="salmon/node.yaml")
    assert data is None
    assert str(problems[0]) == "salmon/node.yaml: the file is empty"


def test_nested_keys_are_recorded_too() -> None:
    _, lines, _ = load_mapping("needs:\n  - reason: because\n", file="n/node.yaml")
    assert lines == {"needs": 1, "reason": 2}
```

- [ ] **Step 3: Run it and watch it fail**

Run: `uv run pytest tests/schema/test_yaml_lines.py -v`
Expected: FAIL, `ModuleNotFoundError: No module named 'code_schema.yaml_lines'`

- [ ] **Step 4: Write the module**

```python
# packages/code-schema/src/code_schema/yaml_lines.py
"""YAML that remembers where each key was (spec M1P1.5).

`yaml.safe_load` throws the marks away, and no schema library can recover them: it only ever sees
the dict. Messages carry lines so the content repository's CI can print them on the diff line.
"""

from __future__ import annotations

from typing import Any

import yaml

from code_schema.problems import Problem


class LineLoader(yaml.SafeLoader):
    """A safe loader that records the line of every key, at any depth. First occurrence wins."""

    def __init__(self, stream: str) -> None:
        super().__init__(stream)
        self.key_lines: dict[str, int] = {}

    def construct_mapping(self, node: yaml.MappingNode, deep: bool = False) -> dict[Any, Any]:
        for key_node, _ in node.value:
            if isinstance(key_node.value, str):
                self.key_lines.setdefault(key_node.value, key_node.start_mark.line + 1)
        return super().construct_mapping(node, deep)


def load_mapping(
    text: str, *, file: str
) -> tuple[dict[str, object] | None, dict[str, int], list[Problem]]:
    """Parse one YAML document that must be a mapping. Never raises."""
    loader = LineLoader(text)
    try:
        data = loader.get_single_data()
        lines = dict(loader.key_lines)
    except yaml.YAMLError as error:
        mark = getattr(error, "problem_mark", None)
        detail = getattr(error, "problem", None) or "could not be parsed"
        line = None if mark is None else mark.line + 1
        return None, {}, [Problem(file=file, line=line, message=f"not valid YAML ({detail})")]
    finally:
        loader.dispose()

    if data is None:
        return None, lines, [Problem(file=file, message="the file is empty")]
    if not isinstance(data, dict):
        kind = "a list" if isinstance(data, list) else "a single value"
        return (
            None,
            lines,
            [Problem(file=file, message=f"the file must be a mapping of fields, not {kind}")],
        )
    return data, lines, []
```

- [ ] **Step 5: Add `yaml` and `collections.abc` to the allowlist**

```python
    "code-schema": frozenset(
        {"__future__", "collections.abc", "dataclasses", "typing", "yaml"}
    ),
```

`collections.abc` is added now because Task 3's check signatures use `Callable` and `Sequence`; the
runtime guard imports the package, so both guards see `yaml`.

- [ ] **Step 6: Run the tests, the guards and mypy**

Run: `uv run pytest tests/schema tests/guards -v && uv run mypy`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add packages/code-schema/pyproject.toml pyproject.toml uv.lock \
        packages/code-schema/src/code_schema/yaml_lines.py tests/schema/test_yaml_lines.py tests/guards/purity.py
git commit -m "$(cat <<'EOF'
feat(schema): parse YAML and keep each key's line

safe_load discards the marks and no schema library can recover them, so the
loader records them itself. The payoff is not only a better message: the
content repository's CI can emit a GitHub annotation and the error lands on
the diff line, where the reviewer already is.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: The field checks

**Files:**
- Create: `packages/code-schema/src/code_schema/fields.py`
- Create: `tests/schema/test_fields.py`
- Modify: `tests/guards/purity.py` (allowlist: add `re`)

**Interfaces:**
- Produces: `Check = Callable[[object], str | None]` (a message when wrong, `None` when right);
  `exactly(value)`, `one_line(max_len)`, `one_sentence(max_len)`, `one_of(allowed, noun)`,
  `whole_number(minimum)`, `slug(noun)`; `shown(value)` for rendering a value in a message;
  `Spec(name: str, required: bool, check: Check)`.

- [ ] **Step 1: Write the failing test**

```python
# tests/schema/test_fields.py
"""The field rules of spec M1P1.3, one message each."""

from code_schema.fields import (
    exactly,
    one_line,
    one_of,
    one_sentence,
    shown,
    slug,
    whole_number,
)

LEVELS = ("first-steps", "foundations", "introductory", "intermediate", "advanced")


def test_shown_quotes_text_and_leaves_numbers_bare() -> None:
    assert shown("expert") == '"expert"'
    assert shown(12) == "12"
    assert shown(None) == "nothing"


def test_exactly_names_both_versions() -> None:
    assert exactly(1)(1) is None
    assert exactly(1)(2) == "this node is schema 2; this validator understands 1"


def test_one_line_refuses_newlines_and_length() -> None:
    check = one_line(max_len=80)
    assert check("Salmon") is None
    assert check("Sal\nmon") == "must be one line"
    assert check("x" * 81) == "is longer than 80 characters (81)"
    assert check(12) == "12 is not text"


def test_one_sentence_wants_terminal_punctuation() -> None:
    check = one_sentence(max_len=200)
    assert check("Salmon quantifies transcripts.") is None
    assert check("Salmon quantifies transcripts") == "must end with . ? or !"
    assert check("") == "must not be empty"


def test_one_of_lists_what_was_expected() -> None:
    check = one_of(LEVELS, noun="level")
    assert check("intermediate") is None
    assert check("expert") == (
        '"expert" is not a level '
        "(first-steps, foundations, introductory, intermediate, advanced)"
    )


def test_whole_number_refuses_text_even_when_it_looks_like_a_number() -> None:
    check = whole_number(minimum=1)
    assert check(12) is None
    assert check("12") == '"12" is not a whole number'
    assert check("twelve") == '"twelve" is not a whole number'
    assert check(True) == "true is not a whole number"
    assert check(0) == "0 is not at least 1"


def test_slug_states_the_pattern() -> None:
    check = slug(noun="region id")
    assert check("sequence-analysis") is None
    assert check("Sequence Analysis") == (
        '"Sequence Analysis" is not a region id (lower case, digits and single hyphens)'
    )
```

- [ ] **Step 2: Run it and watch it fail**

Run: `uv run pytest tests/schema/test_fields.py -v`
Expected: FAIL, `ModuleNotFoundError: No module named 'code_schema.fields'`

- [ ] **Step 3: Write the module**

```python
# packages/code-schema/src/code_schema/fields.py
"""One check per rule in spec M1P1.3.

A check returns the message when a value is wrong and None when it is right, so the table in
node.py stays a list of rows. Nothing coerces: "12" is as wrong as "twelve", because a coerced
value means the file and the object disagree and the writer would rewrite the file.
"""

from __future__ import annotations

import re
from collections.abc import Callable, Sequence
from dataclasses import dataclass

Check = Callable[[object], str | None]

SLUG = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")


def shown(value: object) -> str:
    """A value as it appears in a message."""
    if value is None:
        return "nothing"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, str):
        return f'"{value}"'
    return str(value)


@dataclass(frozen=True)
class Spec:
    name: str
    required: bool
    check: Check


def exactly(expected: object) -> Check:
    def check(value: object) -> str | None:
        if value == expected and type(value) is type(expected):
            return None
        return f"this node is schema {shown(value)}; this validator understands {shown(expected)}"

    return check


def _text(value: object) -> str | None:
    return None if isinstance(value, str) else f"{shown(value)} is not text"


def one_line(max_len: int) -> Check:
    def check(value: object) -> str | None:
        if (wrong := _text(value)) is not None:
            return wrong
        assert isinstance(value, str)
        if not value.strip():
            return "must not be empty"
        if "\n" in value:
            return "must be one line"
        if len(value) > max_len:
            return f"is longer than {max_len} characters ({len(value)})"
        return None

    return check


def one_sentence(max_len: int) -> Check:
    """One line ending in terminal punctuation. Counting sentences is a rule we cannot keep."""

    def check(value: object) -> str | None:
        if (wrong := one_line(max_len)(value)) is not None:
            return wrong
        assert isinstance(value, str)
        return None if value.rstrip().endswith((".", "?", "!")) else "must end with . ? or !"

    return check


def one_of(allowed: Sequence[str], *, noun: str) -> Check:
    def check(value: object) -> str | None:
        if isinstance(value, str) and value in allowed:
            return None
        return f"{shown(value)} is not a {noun} ({', '.join(allowed)})"

    return check


def whole_number(minimum: int) -> Check:
    def check(value: object) -> str | None:
        if not isinstance(value, int) or isinstance(value, bool):
            return f"{shown(value)} is not a whole number"
        if value < minimum:
            return f"{shown(value)} is not at least {minimum}"
        return None

    return check


def slug(*, noun: str) -> Check:
    def check(value: object) -> str | None:
        if isinstance(value, str) and SLUG.match(value):
            return None
        return f"{shown(value)} is not a {noun} (lower case, digits and single hyphens)"

    return check
```

- [ ] **Step 4: Add `re` to the allowlist**

```python
    "code-schema": frozenset(
        {"__future__", "collections.abc", "dataclasses", "re", "typing", "yaml"}
    ),
```

- [ ] **Step 5: Run the tests, the guards, mypy and ruff**

Run: `uv run pytest tests/schema tests/guards -v && uv run mypy && uv run ruff check .`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/code-schema/src/code_schema/fields.py tests/schema/test_fields.py tests/guards/purity.py
git commit -m "$(cat <<'EOF'
feat(schema): add the field checks and their messages

A check returns a message or None, so the field table in the next task is a
list of rows rather than a tree of ifs. Nothing coerces: "12" is refused as
firmly as "twelve", because a coerced value makes the file and the object
disagree and the canonical writer would rewrite the file on the next landing.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: `regions.yaml`

**Files:**
- Create: `packages/code-schema/src/code_schema/regions.py`
- Create: `tests/schema/test_regions.py`
- Modify: `tests/guards/purity.py` (allowlist: add `pathlib`)

**Interfaces:**
- Consumes: `load_mapping` (Task 2), `slug`, `one_line`, `shown` (Task 3), `Problem` (Task 1).
- Produces: `Region(id: str, name: str)`;
  `parse_regions(text: str, *, file: str = "regions.yaml") -> tuple[dict[str, Region], list[Problem]]`;
  `read_regions(root: Path) -> tuple[dict[str, Region], list[Problem]]`.

- [ ] **Step 1: Write the failing test**

```python
# tests/schema/test_regions.py
"""The region registry (spec M1P1.3): the only file that is not a node."""

from pathlib import Path

from code_schema.regions import Region, parse_regions, read_regions

GOOD = """\
regions:
  - id: sequence-analysis
    name: Sequence analysis
  - id: molecular-biology
    name: Molecular biology
"""


def test_it_reads_the_registry() -> None:
    regions, problems = parse_regions(GOOD)
    assert problems == []
    assert regions == {
        "sequence-analysis": Region(id="sequence-analysis", name="Sequence analysis"),
        "molecular-biology": Region(id="molecular-biology", name="Molecular biology"),
    }


def test_a_bad_id_names_the_line() -> None:
    text = "regions:\n  - id: Sequence Analysis\n    name: Sequence analysis\n"
    _, problems = parse_regions(text)
    assert [str(p) for p in problems] == [
        'regions.yaml:2: id: "Sequence Analysis" is not a region id '
        "(lower case, digits and single hyphens)"
    ]


def test_a_repeated_id_is_refused_once() -> None:
    text = GOOD + "  - id: sequence-analysis\n    name: Again\n"
    _, problems = parse_regions(text)
    assert [str(p) for p in problems] == [
        'regions.yaml: id: "sequence-analysis" is listed twice'
    ]


def test_regions_must_be_a_list_of_mappings() -> None:
    _, problems = parse_regions("regions: sequence-analysis\n")
    assert [str(p) for p in problems] == ["regions.yaml:1: regions: must be a list of regions"]


def test_read_regions_reports_a_missing_file(tmp_path: Path) -> None:
    regions, problems = read_regions(tmp_path)
    assert regions == {}
    assert [str(p) for p in problems] == ["regions.yaml: the file is missing"]


def test_read_regions_reads_the_file(tmp_path: Path) -> None:
    (tmp_path / "regions.yaml").write_text(GOOD, encoding="utf-8")
    regions, problems = read_regions(tmp_path)
    assert problems == []
    assert sorted(regions) == ["molecular-biology", "sequence-analysis"]
```

- [ ] **Step 2: Run it and watch it fail**

Run: `uv run pytest tests/schema/test_regions.py -v`
Expected: FAIL, `ModuleNotFoundError: No module named 'code_schema.regions'`

- [ ] **Step 3: Write the module**

```python
# packages/code-schema/src/code_schema/regions.py
"""The region registry at the content root (spec M1P1.3).

`region` cannot be checked without it, so part 1 owns it. Free text drifts within a month
(sequence-analysis, sequence analysis, Sequence Analysis) and every facet and tie-break splits.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from code_schema.fields import one_line, shown, slug
from code_schema.problems import Problem
from code_schema.yaml_lines import load_mapping

REGISTRY = "regions.yaml"


@dataclass(frozen=True)
class Region:
    id: str
    name: str


def parse_regions(text: str, *, file: str = REGISTRY) -> tuple[dict[str, Region], list[Problem]]:
    data, lines, problems = load_mapping(text, file=file)
    if data is None:
        return {}, problems

    listed = data.get("regions")
    if not isinstance(listed, list):
        return {}, [
            Problem(file=file, field="regions", line=lines.get("regions"), message="must be a list of regions")
        ]

    regions: dict[str, Region] = {}
    for entry in listed:
        if not isinstance(entry, dict):
            problems.append(
                Problem(file=file, field="regions", message=f"{shown(entry)} is not a region")
            )
            continue
        identifier, name = entry.get("id"), entry.get("name")
        if (wrong := slug(noun="region id")(identifier)) is not None:
            problems.append(Problem(file=file, field="id", line=lines.get("id"), message=wrong))
            continue
        if (wrong := one_line(max_len=80)(name)) is not None:
            problems.append(Problem(file=file, field="name", line=lines.get("name"), message=wrong))
            continue
        assert isinstance(identifier, str) and isinstance(name, str)
        if identifier in regions:
            problems.append(
                Problem(file=file, field="id", message=f"{shown(identifier)} is listed twice")
            )
            continue
        regions[identifier] = Region(id=identifier, name=name)
    return regions, problems


def read_regions(root: Path) -> tuple[dict[str, Region], list[Problem]]:
    path = root / REGISTRY
    if not path.is_file():
        return {}, [Problem(file=REGISTRY, message="the file is missing")]
    return parse_regions(path.read_text(encoding="utf-8"))
```

- [ ] **Step 4: Add `pathlib` to the allowlist**

```python
    "code-schema": frozenset(
        {"__future__", "collections.abc", "dataclasses", "pathlib", "re", "typing", "yaml"}
    ),
```

- [ ] **Step 5: Run everything**

Run: `uv run pytest tests/schema tests/guards -v && uv run mypy`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/code-schema/src/code_schema/regions.py tests/schema/test_regions.py tests/guards/purity.py
git commit -m "$(cat <<'EOF'
feat(schema): read and validate the region registry

A region is an id in regions.yaml, not free text, so the facets on L12 and
the ordering tie-break in the weave cannot split in two over spelling. The
registry is the only file at the content root that is not a node, and
part 1 owns it because region cannot be checked without it.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: `Node` and `parse_node`

**Files:**
- Create: `packages/code-schema/src/code_schema/node.py`
- Create: `tests/schema/test_node.py`
- Modify: `tests/guards/purity.py` (allowlist: add `difflib`, `enum`)

**Interfaces:**
- Consumes: everything above.
- Produces: `Level` (a `StrEnum` of the five), `SCHEMA = 1`,
  `Node(id, title, claim, region, level: Level, minutes: int, body: str)` (frozen),
  `parse_node(node_yaml: str, body: str, *, node_id: str, regions: Collection[str], file: str) -> tuple[Node | None, list[Problem]]`.

- [ ] **Step 1: Write the failing test**

```python
# tests/schema/test_node.py
"""The six core fields, their messages, and the closed field set (spec M1P1.3, M1P1.5)."""

from code_schema.node import Level, Node, parse_node
from code_schema.problems import Problem

REGIONS = {"sequence-analysis", "molecular-biology"}

GOOD = """\
schema: 1
title: Salmon
claim: Salmon quantifies transcript abundance from RNA-seq reads without aligning them.
region: sequence-analysis
level: intermediate
minutes: 12
"""

BODY = "Salmon reads a transcriptome and counts what it finds.\n"


def parse(text: str, body: str = BODY) -> tuple[Node | None, list[Problem]]:
    """mypy runs strict over tests/, so every helper is annotated."""
    return parse_node(text, body, node_id="salmon", regions=REGIONS, file="salmon/node.yaml")


def test_a_good_node_parses() -> None:
    node, problems = parse(GOOD)
    assert problems == []
    assert node == Node(
        id="salmon",
        title="Salmon",
        claim="Salmon quantifies transcript abundance from RNA-seq reads without aligning them.",
        region="sequence-analysis",
        level=Level.INTERMEDIATE,
        minutes=12,
        body=BODY,
    )


def test_every_problem_is_reported_in_one_run() -> None:
    broken = """\
schema: 1
title: Salmon
clam: Salmon quantifies transcript abundance from RNA-seq reads.
region: sequence analysis
level: expert
minutes: "twelve"
"""
    node, problems = parse(broken)
    assert node is None
    assert [str(p) for p in problems] == [
        "salmon/node.yaml:3: unknown field `clam` — did you mean `claim`? "
        "(claim is required and missing)",
        'salmon/node.yaml:4: region: "sequence analysis" is not a region — '
        "regions.yaml lists 2, closest is `sequence-analysis`",
        'salmon/node.yaml:5: level: "expert" is not a level '
        "(first-steps, foundations, introductory, intermediate, advanced)",
        'salmon/node.yaml:6: minutes: "twelve" is not a whole number',
    ]


def test_an_unknown_field_with_no_close_match_is_reported_alone() -> None:
    _, problems = parse(GOOD + "colour: teal\n")
    assert [str(p) for p in problems] == ["salmon/node.yaml:7: unknown field `colour`"]


def test_a_missing_field_has_no_line() -> None:
    without_minutes = "\n".join(line for line in GOOD.splitlines() if not line.startswith("minutes"))
    _, problems = parse(without_minutes + "\n")
    assert [str(p) for p in problems] == [
        "salmon/node.yaml: minutes: required field is missing"
    ]


def test_a_later_schema_is_refused_by_name() -> None:
    _, problems = parse(GOOD.replace("schema: 1", "schema: 2"))
    assert [str(p) for p in problems] == [
        "salmon/node.yaml:1: schema: this node is schema 2; this validator understands 1"
    ]


def test_an_unknown_region_names_the_registry() -> None:
    _, problems = parse(GOOD.replace("sequence-analysis", "sequencing"))
    assert [str(p) for p in problems] == [
        'salmon/node.yaml:4: region: "sequencing" is not a region — '
        "regions.yaml lists 2, closest is `sequence-analysis`"
    ]


def test_a_claim_without_terminal_punctuation_is_refused() -> None:
    _, problems = parse(GOOD.replace("aligning them.", "aligning them"))
    assert [str(p) for p in problems] == [
        "salmon/node.yaml:3: claim: must end with . ? or !"
    ]


def test_an_empty_body_is_refused() -> None:
    _, problems = parse(GOOD, body="   \n")
    assert [str(p) for p in problems] == ["salmon/body.md: the file is empty"]


def test_an_id_that_is_not_a_slug_is_refused() -> None:
    _, problems = parse_node(
        GOOD, BODY, node_id="Salmon Node", regions=REGIONS, file="Salmon Node/node.yaml"
    )
    assert [str(p) for p in problems] == [
        'Salmon Node/: "Salmon Node" is not a node id (lower case, digits and single hyphens)'
    ]
```

- [ ] **Step 2: Run it and watch it fail**

Run: `uv run pytest tests/schema/test_node.py -v`
Expected: FAIL, `ModuleNotFoundError: No module named 'code_schema.node'`

- [ ] **Step 3: Write the module**

```python
# packages/code-schema/src/code_schema/node.py
"""A node as it is written on disk (spec M1P1.2, M1P1.3).

The folder name is the id; there is no id field. The field set is closed, so a typo is a problem
rather than a silently ignored key — and when a typo matches a missing required field, it is one
problem, not two.
"""

from __future__ import annotations

import difflib
from collections.abc import Collection
from dataclasses import dataclass
from enum import StrEnum

from code_schema.fields import (
    Spec,
    exactly,
    one_line,
    one_of,
    one_sentence,
    shown,
    slug,
    whole_number,
)
from code_schema.problems import Problem
from code_schema.yaml_lines import load_mapping

SCHEMA = 1


class Level(StrEnum):
    """T10.1's five. A level describes a node, never a learner."""

    FIRST_STEPS = "first-steps"
    FOUNDATIONS = "foundations"
    INTRODUCTORY = "introductory"
    INTERMEDIATE = "intermediate"
    ADVANCED = "advanced"


@dataclass(frozen=True)
class Node:
    id: str
    title: str
    claim: str
    region: str
    level: Level
    minutes: int
    body: str


FIELDS: tuple[Spec, ...] = (
    Spec("schema", required=True, check=exactly(SCHEMA)),
    Spec("title", required=True, check=one_line(max_len=80)),
    Spec("claim", required=True, check=one_sentence(max_len=200)),
    Spec("region", required=True, check=lambda value: None),  # checked against the registry below
    Spec("level", required=True, check=one_of(tuple(Level), noun="level")),
    Spec("minutes", required=True, check=whole_number(minimum=1)),
)


def _region_problem(value: object, regions: Collection[str]) -> str | None:
    if isinstance(value, str) and value in regions:
        return None
    message = f"{shown(value)} is not a region — regions.yaml lists {len(regions)}"
    if isinstance(value, str):
        close = difflib.get_close_matches(value, sorted(regions), n=1)
        if close:
            message += f", closest is `{close[0]}`"
    return message


def parse_node(
    node_yaml: str,
    body: str,
    *,
    node_id: str,
    regions: Collection[str],
    file: str,
) -> tuple[Node | None, list[Problem]]:
    """Never raises. Returns the node when there is no problem at all."""
    folder = file.rsplit("/", 1)[0] + "/" if "/" in file else ""
    problems: list[Problem] = []

    if (wrong := slug(noun="node id")(node_id)) is not None:
        problems.append(Problem(file=folder, message=wrong))
    if not body.strip():
        problems.append(Problem(file=f"{folder}body.md", message="the file is empty"))

    data, lines, load_problems = load_mapping(node_yaml, file=file)
    problems += load_problems
    if data is None:
        return None, problems

    known = {spec.name for spec in FIELDS}
    missing = sorted(spec.name for spec in FIELDS if spec.required and spec.name not in data)
    for key in data:
        if key in known:
            continue
        close = difflib.get_close_matches(key, missing, n=1)
        message = f"unknown field `{key}`"
        if close:
            message += f" — did you mean `{close[0]}`? ({close[0]} is required and missing)"
            missing.remove(close[0])
        problems.append(Problem(file=file, line=lines.get(key), message=message))

    for name in missing:
        problems.append(Problem(file=file, field=name, message="required field is missing"))

    for spec in FIELDS:
        if spec.name not in data:
            continue
        value = data[spec.name]
        wrong = (
            _region_problem(value, regions) if spec.name == "region" else spec.check(value)
        )
        if wrong is not None:
            problems.append(
                Problem(file=file, field=spec.name, line=lines.get(spec.name), message=wrong)
            )

    if problems:
        return None, sorted(problems, key=Problem.sort_key)

    minutes = data["minutes"]
    assert isinstance(minutes, int)  # every check above passed, so the types are known
    return (
        Node(
            id=node_id,
            title=str(data["title"]),
            claim=str(data["claim"]),
            region=str(data["region"]),
            level=Level(str(data["level"])),
            minutes=minutes,
            body=body,
        ),
        [],
    )
```

- [ ] **Step 4: Add `difflib` and `enum` to the allowlist**

```python
    "code-schema": frozenset(
        {
            "__future__",
            "collections.abc",
            "dataclasses",
            "difflib",
            "enum",
            "pathlib",
            "re",
            "typing",
            "yaml",
        }
    ),
```

- [ ] **Step 5: Run the tests until the messages match exactly**

Run: `uv run pytest tests/schema/test_node.py -v`
Expected: PASS. If a message differs by a character, **fix the code, not the test** — the messages
are a done-when of M1 and the spec prints them.

- [ ] **Step 6: Run everything**

Run: `uv run pytest tests/schema tests/guards -v && uv run mypy && uv run ruff check .`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add packages/code-schema/src/code_schema/node.py tests/schema/test_node.py tests/guards/purity.py
git commit -m "$(cat <<'EOF'
feat(schema): parse a node's core fields

Six required fields, a closed set, and every problem in one run: a content
pull request should fail once with a complete list, not once per round trip.
A typo that matches a missing required field reports once — `clam` says "did
you mean claim" instead of an unknown field and a missing one.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: `read_node` — the folder, the body, the nested-node rule

**Files:**
- Modify: `packages/code-schema/src/code_schema/node.py` (append `read_node`)
- Modify: `tests/schema/test_node.py` (append the folder tests)

**Interfaces:**
- Produces: `read_node(folder: Path, *, regions: Collection[str], root: Path | None = None) -> tuple[Node | None, list[Problem]]`.
  The id is the folder's name; message paths are relative to `root` (default: the folder's parent).

- [ ] **Step 1: Write the failing tests**

```python
# appended to tests/schema/test_node.py
from pathlib import Path

from code_schema.node import read_node


def write_node_folder(root: Path, name: str, *, body: str = BODY, yaml_text: str = GOOD) -> Path:
    folder = root / name
    folder.mkdir(parents=True)
    (folder / "node.yaml").write_text(yaml_text, encoding="utf-8")
    (folder / "body.md").write_text(body, encoding="utf-8")
    return folder


def test_read_node_takes_the_id_from_the_folder(tmp_path: Path) -> None:
    folder = write_node_folder(tmp_path, "salmon")
    node, problems = read_node(folder, regions=REGIONS, root=tmp_path)
    assert problems == []
    assert node is not None and node.id == "salmon"


def test_a_nested_folder_keeps_the_leaf_as_the_id(tmp_path: Path) -> None:
    folder = write_node_folder(tmp_path, "sequence-analysis/salmon")
    node, problems = read_node(folder, regions=REGIONS, root=tmp_path)
    assert problems == []
    assert node is not None and node.id == "salmon"


def test_a_missing_body_is_refused(tmp_path: Path) -> None:
    folder = write_node_folder(tmp_path, "salmon")
    (folder / "body.md").unlink()
    _, problems = read_node(folder, regions=REGIONS, root=tmp_path)
    assert [str(p) for p in problems] == ["salmon/: body.md is missing"]


def test_a_missing_node_yaml_is_refused(tmp_path: Path) -> None:
    folder = write_node_folder(tmp_path, "salmon")
    (folder / "node.yaml").unlink()
    _, problems = read_node(folder, regions=REGIONS, root=tmp_path)
    assert [str(p) for p in problems] == ["salmon/: node.yaml is missing"]


def test_a_node_inside_a_node_is_refused(tmp_path: Path) -> None:
    folder = write_node_folder(tmp_path, "salmon")
    write_node_folder(folder, "pufferfish")
    _, problems = read_node(folder, regions=REGIONS, root=tmp_path)
    assert [str(p) for p in problems] == [
        "salmon/: holds another node (pufferfish/node.yaml); a node folder holds one node"
    ]


def test_a_body_that_is_not_utf8_is_refused(tmp_path: Path) -> None:
    folder = write_node_folder(tmp_path, "salmon")
    (folder / "body.md").write_bytes(b"\xff\xfe not text")
    _, problems = read_node(folder, regions=REGIONS, root=tmp_path)
    assert [str(p) for p in problems] == ["salmon/body.md: the file is not UTF-8"]
```

- [ ] **Step 2: Run them and watch them fail**

Run: `uv run pytest tests/schema/test_node.py -v`
Expected: FAIL, `ImportError: cannot import name 'read_node'`

- [ ] **Step 3: Append the implementation**

```python
# appended to packages/code-schema/src/code_schema/node.py
from pathlib import Path

NODE_FILE = "node.yaml"
BODY_FILE = "body.md"


def _read_text(path: Path) -> tuple[str | None, str | None]:
    """Text, or the reason it could not be read."""
    try:
        return path.read_text(encoding="utf-8"), None
    except UnicodeDecodeError:
        return None, "the file is not UTF-8"


def read_node(
    folder: Path, *, regions: Collection[str], root: Path | None = None
) -> tuple[Node | None, list[Problem]]:
    """Read one node folder. The id is the folder's name (spec M1P1.2)."""
    base = folder.parent if root is None else root
    shown_folder = f"{folder.relative_to(base).as_posix()}/"
    problems: list[Problem] = []

    nested = sorted(
        child.parent.relative_to(folder).as_posix()
        for child in folder.rglob(NODE_FILE)
        if child.parent != folder
    )
    if nested:
        problems.append(
            Problem(
                file=shown_folder,
                message=f"holds another node ({nested[0]}/{NODE_FILE}); a node folder holds one node",
            )
        )

    node_path, body_path = folder / NODE_FILE, folder / BODY_FILE
    if not node_path.is_file():
        problems.append(Problem(file=shown_folder, message=f"{NODE_FILE} is missing"))
    if not body_path.is_file():
        problems.append(Problem(file=shown_folder, message=f"{BODY_FILE} is missing"))
    if problems:
        return None, problems

    node_yaml, node_error = _read_text(node_path)
    body, body_error = _read_text(body_path)
    for name, error in ((NODE_FILE, node_error), (BODY_FILE, body_error)):
        if error is not None:
            problems.append(Problem(file=f"{shown_folder}{name}", message=error))
    if node_yaml is None or body is None:
        return None, problems

    return parse_node(
        node_yaml,
        body,
        node_id=folder.name,
        regions=regions,
        file=f"{shown_folder}{NODE_FILE}",
    )
```

- [ ] **Step 4: Run the tests**

Run: `uv run pytest tests/schema -v`
Expected: PASS

- [ ] **Step 5: Run everything**

Run: `uv run pytest && uv run mypy && uv run ruff check . && uv run ruff format --check .`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/code-schema/src/code_schema/node.py tests/schema/test_node.py
git commit -m "$(cat <<'EOF'
feat(schema): read a node from its folder

The folder name is the id, nesting is allowed for browsing and the leaf is
the id, and a node folder may not hold another node — one node, one folder,
no ambiguity about which body.md belongs to whom. A body that is missing,
empty or not UTF-8 is refused; what is inside it is M3's business.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: The canonical writer and the three laws

**Files:**
- Create: `packages/code-schema/src/code_schema/writer.py`
- Create: `tests/schema/test_writer.py`

**Interfaces:**
- Consumes: `Node`, `Level` (Task 5).
- Produces: `write_node_yaml(node: Node) -> str`; `write_node_folder(node: Node, folder: Path) -> None`.

- [ ] **Step 1: Write the failing test**

```python
# tests/schema/test_writer.py
"""One correct rendering of a node, and the three round-trip laws (spec M1P1.6)."""

from dataclasses import replace
from pathlib import Path

from code_schema.node import Level, Node, read_node
from code_schema.writer import write_node_folder, write_node_yaml

REGIONS = {"sequence-analysis"}

NODE = Node(
    id="salmon",
    title="Salmon",
    claim="Salmon quantifies transcript abundance from RNA-seq reads without aligning them.",
    region="sequence-analysis",
    level=Level.INTERMEDIATE,
    minutes=12,
    body="Salmon reads a transcriptome and counts what it finds.\n",
)

CANONICAL = """\
schema: 1
title: Salmon
claim: Salmon quantifies transcript abundance from RNA-seq reads without aligning them.
region: sequence-analysis
level: intermediate
minutes: 12
"""


def test_the_writer_has_one_form_with_a_fixed_field_order() -> None:
    assert write_node_yaml(NODE) == CANONICAL


def test_a_long_claim_is_not_folded() -> None:
    long_claim = "Salmon " + "quantifies transcripts " * 7 + "quickly."
    assert f"claim: {long_claim}\n" in write_node_yaml(replace(NODE, claim=long_claim))


def test_law_1_read_write_read_keeps_the_node(tmp_path: Path) -> None:
    write_node_folder(NODE, tmp_path / "salmon")
    first, problems = read_node(tmp_path / "salmon", regions=REGIONS, root=tmp_path)
    assert problems == [] and first == NODE


def test_law_2_a_canonical_file_is_written_back_byte_for_byte(tmp_path: Path) -> None:
    folder = tmp_path / "salmon"
    folder.mkdir()
    (folder / "node.yaml").write_text(CANONICAL, encoding="utf-8")
    (folder / "body.md").write_text(NODE.body, encoding="utf-8")
    node, _ = read_node(folder, regions=REGIONS, root=tmp_path)
    assert node is not None
    write_node_folder(node, folder)
    assert (folder / "node.yaml").read_text(encoding="utf-8") == CANONICAL
    assert (folder / "body.md").read_text(encoding="utf-8") == NODE.body


def test_law_3_writing_is_idempotent() -> None:
    once = write_node_yaml(NODE)
    assert write_node_yaml(NODE) == once


def test_a_title_that_would_read_as_a_number_gets_quotes(tmp_path: Path) -> None:
    node = replace(NODE, title="12")
    written = write_node_yaml(node)
    assert "title: '12'\n" in written
    (tmp_path / "salmon").mkdir()
    write_node_folder(node, tmp_path / "salmon")
    again, problems = read_node(tmp_path / "salmon", regions=REGIONS, root=tmp_path)
    assert problems == [] and again is not None and again.title == "12"
```

- [ ] **Step 2: Run it and watch it fail**

Run: `uv run pytest tests/schema/test_writer.py -v`
Expected: FAIL, `ModuleNotFoundError: No module named 'code_schema.writer'`

- [ ] **Step 3: Write the module**

```python
# packages/code-schema/src/code_schema/writer.py
"""One correct way to write a node (spec M1P1.6).

Landing generates these files, so the writer is canonical: fixed field order, block style, no key
sorting, no folding. Comments are not preserved — node.yaml is not a place to leave a note.
"""

from __future__ import annotations

from pathlib import Path

import yaml

from code_schema.node import BODY_FILE, NODE_FILE, SCHEMA, Node

_NO_FOLDING = 1_000_000


def write_node_yaml(node: Node) -> str:
    """The node's fields in the order the spec fixes. Part 2 appends its links to this mapping."""
    fields: dict[str, object] = {
        "schema": SCHEMA,
        "title": node.title,
        "claim": node.claim,
        "region": node.region,
        "level": str(node.level),
        "minutes": node.minutes,
    }
    written = yaml.safe_dump(
        fields,
        sort_keys=False,
        default_flow_style=False,
        allow_unicode=True,
        width=_NO_FOLDING,
    )
    return str(written)


def write_node_folder(node: Node, folder: Path) -> None:
    folder.mkdir(parents=True, exist_ok=True)
    (folder / NODE_FILE).write_text(write_node_yaml(node), encoding="utf-8")
    (folder / BODY_FILE).write_text(node.body, encoding="utf-8")
```

- [ ] **Step 4: Run the tests**

Run: `uv run pytest tests/schema/test_writer.py -v`
Expected: PASS. If `safe_dump` renders the level as `!!python/object` the `str()` around
`node.level` is missing; `StrEnum` members must be written as plain strings.

- [ ] **Step 5: Run everything**

Run: `uv run pytest && uv run mypy && uv run ruff check . && uv run ruff format --check .`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/code-schema/src/code_schema/writer.py tests/schema/test_writer.py
git commit -m "$(cat <<'EOF'
feat(schema): write a node back canonically

There is one correct rendering of a node, so landing a node nobody edited
produces an empty diff. The three laws are tests: read-write-read keeps the
node, a canonical file is written back byte for byte, and writing is
idempotent.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: The public API, the docs and the journal

**Files:**
- Modify: `packages/code-schema/src/code_schema/__init__.py`
- Create: `tests/schema/test_public_api.py`
- Modify: `CLAUDE.md` (the layout table)
- Create: `docs/notes/journal/2026-09-18-m1-part-1-node-folder.md`
- Modify: `docs/notes/journal/README.md` (the newest-entry box)

- [ ] **Step 1: Write the failing test**

```python
# tests/schema/test_public_api.py
"""What the package offers its callers: parts 3 to 6 import from here, not from submodules."""

import code_schema


def test_the_public_api_is_what_the_spec_names() -> None:
    assert set(code_schema.__all__) == {
        "Level",
        "Node",
        "Problem",
        "Region",
        "parse_node",
        "parse_regions",
        "read_node",
        "read_regions",
        "write_node_folder",
        "write_node_yaml",
    }
```

- [ ] **Step 2: Run it and watch it fail**

Run: `uv run pytest tests/schema/test_public_api.py -v`
Expected: FAIL, `AttributeError: module 'code_schema' has no attribute '__all__'`

- [ ] **Step 3: Write the public API**

```python
# packages/code-schema/src/code_schema/__init__.py
"""Comeni Code's node schema (architecture spec R2, M1 part 1).

A node on disk is a folder: node.yaml, one body.md and, from M3, data files. The folder name is
the id. Nothing here raises: every function returns its value and a list of problems.
"""

from __future__ import annotations

from code_schema.node import Level, Node, parse_node, read_node
from code_schema.problems import Problem
from code_schema.regions import Region, parse_regions, read_regions
from code_schema.writer import write_node_folder, write_node_yaml

__all__ = [
    "Level",
    "Node",
    "Problem",
    "Region",
    "parse_node",
    "parse_regions",
    "read_node",
    "read_regions",
    "write_node_folder",
    "write_node_yaml",
]
```

- [ ] **Step 4: Run the whole command set**

Run: `uv sync --locked --all-packages && uv run ruff check . && uv run ruff format --check . && uv run mypy && uv run pytest`
Expected: PASS, including `tests/guards` and `tests/repo`

- [ ] **Step 5: Update CLAUDE.md's layout**

In the layout table, `packages/code-schema/` gains: *the node format, its validation messages and
the canonical writer (M1 part 1)*.

- [ ] **Step 6: Write the journal entry**

`docs/notes/journal/2026-09-18-m1-part-1-node-folder.md`, following the README's order: where
things stand (each claim with the command that checks it), what changed with commit hashes, the
decisions and what was rejected, what is next (part 2: links), open questions (whether a *related*
link is written on one side or both; whether *goes deeper* must cross a level), and traps (the
format is the expensive thing to change; the allowlist is closed; comments in `node.yaml` are not
kept). Update the newest-entry box in `docs/notes/journal/README.md`.

- [ ] **Step 7: Commit, open the pull request, merge on green**

```bash
git add packages/code-schema/src/code_schema/__init__.py tests/schema/test_public_api.py \
        CLAUDE.md docs/notes/journal/
git commit -m "$(cat <<'EOF'
docs: record M1 part 1 and open the package's public API

Parts 3 to 6 import from code_schema, not from its submodules, so the
module layout stays free to change.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
git push -u origin feat/m1-node-schema
gh pr create --title "feat(schema): the node folder and its core fields (M1 part 1)" --body "…"
gh pr checks <n> --watch --interval 15 > /tmp/checks.txt 2>&1; echo "exit=$?"
```

Merge **only** on `exit=0`.

- [ ] **Step 8: Check the part against the spec's done-when**

Walk M1P1.1's list item by item and say which test or command proves each. Anything unproven is
not done.

---

## Self-review against the spec

| Spec section | Where it is implemented |
|---|---|
| M1P1.2 folder, id from the folder name, slug, nesting, one node per folder | Tasks 5 and 6 |
| M1P1.3 the six fields and their rules | Tasks 3 and 5 |
| M1P1.3 `regions.yaml` | Task 4 |
| M1P1.4 body: exists, UTF-8, non-empty; nothing inside it | Task 6 |
| M1P1.5 two layers, no raising, line numbers, did-you-mean, no coercion, table-driven | Tasks 1, 2, 3, 5 |
| M1P1.5 the allowlist additions | one per task, listed in the Global Constraints |
| M1P1.6 canonical writer and the three laws | Task 7 |
| M1P1.1 done-when | Task 8, step 8 |

**Not in this plan, by the spec:** links (part 2), the validate command and graph rules (part 3),
the Salmon fixtures (part 4), the index (part 5), the API (part 6), the block vocabulary (M3).
