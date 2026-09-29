# M4.1.1 — Diagnostic codes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every problem `code-schema`, `code-weaver` or the API reports carries a declared code
(`CS`, `CW`, `CA`, banded by concern), explained by `code-schema explain` and listed on a generated
reference page.

**Architecture:** One registry, `code_schema/diagnostics.yml`, loaded by `code_schema.diagnostics`.
`Problem` gains a `code` checked against it; `fields.py`'s checks return a `Wrong(code, message)`
instead of a bare string. The weaver's pure core writes its `CW` codes as literals, checked by a
test; the API adds `code` to its own error bodies. Codes are added module by module with `code`
optional, and made required in the last task, once every constructor passes one.

**Tech Stack:** Python 3.14, PyYAML (already a dependency), pytest, Django Ninja; the web types
regenerated with `npm run api-types` on Node 24.

**Spec:** [`docs/superpowers/specs/2026-09-29-m4-diagnostic-codes-design.md`](../specs/2026-09-29-m4-diagnostic-codes-design.md)
(M4D.1–M4D.9). Issue #128 (M4.1.1), under M4.1 (#119).

## Global Constraints

- A code is `C` + `S`/`W`/`A` + four digits; `…0000` is never allocated (M4D.3).
- Bands of one hundred by concern, exactly as the spec's table (M4D.3); `bands:` in the registry
  holds them as data.
- **A code is never renumbered**; a retired code stays with `retired: <date> — <why>` (M4D.2).
- **Message wording does not change** (M4D.7). Only the code is added.
- `code-schema` stays pure: no import outside `tests/guards/purity.py`'s allowlist, which this plan
  does not change (`yaml`, `dataclasses`, `difflib`, `pathlib`, `re` are already there).
- `code-weaver`'s core (`graph.py`, `weave.py`, `find.py`) imports nothing outside the standard
  library; codes there are string literals (M4D.4).
- A printed problem reads `file:line: field: CODE message` (M4D.4).
- Ninja's own request-validation 422 bodies are not touched (M4D.4).
- Commits end with `Co-Authored-By:` naming the model in use.

## Review Focus

- **The registry file ships in the wheel.** `comeni-code-content` installs `code-schema` from git
  with `uvx`; a registry missing from the wheel makes every import fail there. Task 1 builds the
  wheel and asserts `diagnostics.yml` is in it.
- **A shared check emits one code wherever it is used** (a title and a question's hint are both
  "must be one line", `CS0009`); the field in the problem line says where. Task 2's test pins
  that the same check gives the same code from two different fields.
- **A composed message keeps the code of what went wrong**: "what this resource covers must not
  be empty" is `CS0008` from the check, not a resource code. Task 5 pins it.
- **An old code in a runbook still explains after it is retired.** `explain` answers for a
  `retired` code and says so. Task 10 pins it.
- **The reference page is deterministic** — the same registry gives the same bytes, in code order,
  so its staleness test never flakes. Task 10 pins it.

## The mapping

Every existing message, its code, in the order its module reads. `says` in the registry is the
column *says*; *module* is where it is raised today. Messages keep their exact wording.

**`CS0001`–`CS0099` — a node's files and fields** (`yaml_lines.py`, `fields.py`, `node.py`; the
field checks are shared, so these codes also appear on resources, questions and registry entries)

| Code | Module | Message today | says |
|---|---|---|---|
| CS0001 | yaml_lines | `not valid YAML (…)` | the file is not valid YAML |
| CS0002 | yaml_lines | `the file is empty` | a YAML file is empty |
| CS0003 | yaml_lines | `the file must be a mapping of fields, not …` | a YAML file is not a mapping of fields |
| CS0004 | node | `unknown field \`…\`` (+ did you mean) | a field this format does not have |
| CS0005 | node | `required field is missing` | a required field is missing |
| CS0006 | fields `exactly` | `this node is schema …; this validator understands …` | the node's schema version is not this validator's |
| CS0007 | fields `one_line` | `… is not text` | a value that must be text is not |
| CS0008 | fields `one_line` | `must not be empty` | a text value is empty |
| CS0009 | fields `one_line` | `must be one line` | a one-line value has a line break |
| CS0010 | fields `one_line` | `is longer than N characters (n)` | a text value is over its length |
| CS0011 | fields `one_sentence` | `must end with . ? or !` | a sentence does not end as one |
| CS0012 | fields `one_of` | `… is not a <noun> (a, b, c)` | a value is not one of the listed choices |
| CS0013 | fields `whole_number` | `… is not a whole number` | a value that must be a whole number is not |
| CS0014 | fields `whole_number` | `… is not at least N` | a number is below its minimum |
| CS0015 | fields `slug` | `… is not a <noun> (lower case, digits and single hyphens)` | an id is not lower case, digits and single hyphens |
| CS0016 | fields `in_registry` | `… is not a <noun> — <registry> lists n, closest is …` | a value is not in the registry that lists them |
| CS0017 | fields `https_url` | `… is not a url` | a value is not a url |
| CS0018 | fields `https_url` | `the url must start with https://` | a url is not https |
| CS0019 | links, resources, questions | `an empty list is written by leaving the field out` | an optional list is written empty |
| CS0020 | node `read_node` | `holds another node (…); a node folder holds one node` | a node folder holds another node |
| CS0021 | node `read_node` | `node.yaml is missing` / `body.md is missing` | a node folder lacks one of its files |
| CS0022 | node `read_node` | `the file is not UTF-8` | a file is not UTF-8 |

**`CS0100`–`CS0199` — links** (`links.py`, and `node.py`'s cross-kind rule)

| Code | Module | Message today | says |
|---|---|---|---|
| CS0101 | links | `must be a list of links, each with a node and a reason` | a link field is not a list of links |
| CS0102 | links | `… is not a link — write node: and reason: on separate lines` | an entry is not a link |
| CS0103 | links | `unknown key \`…\` in a link (a link has node and reason)` | a link has a key it cannot have |
| CS0104 | links | `a link has no node` | a link names no node |
| CS0105 | links | `… is not a node id` (when the slug check has nothing better) | a link's target is not a node id |
| CS0106 | links | `the link to … has no reason` | a link has no reason |
| CS0108 | links | `… links to itself` | a node links to itself |
| CS0109 | links | `… is listed twice…` | a node is linked twice under one kind |
| CS0110 | links | `n peers, at most 4 — a node with more is probably two nodes` | a node has more than four peers |
| CS0111 | node | `… is also under … — a node is one kind of neighbour, not two` | a node is linked under two kinds |

A link target that fails the id check itself keeps the check's `CS0015`.

**`CS0200`–`CS0299` — resources and providers** (`resources.py`, and `providers.py`'s
`player_problem`)

| Code | Module | Message today | says |
|---|---|---|---|
| CS0201 | resources | `… is not a provider in providers.yaml` (+ did you mean) | a resource cites a provider providers.yaml does not list |
| CS0202 | resources | `the resource from … carries …, which … does not list` | a resource carries a licence its provider does not list |
| CS0203 | resources | `the resource from … asks for an embed it does not allow — use display: link` | a resource asks to embed from a provider that does not allow it |
| CS0204 | resources | `… is not embedded through …` | a video names a player its provider does not use |
| CS0205 | resources | `must be a list of resources` | `resources:` is not a list |
| CS0206 | resources | `… is not a resource` | an entry is not a resource |
| CS0207 | resources | `unknown key \`…\` in a resource (…)` | a resource has a key it cannot have |
| CS0208 | resources | `a resource has no …` | a resource lacks a required key |
| CS0209 | resources | `… is not a provider id` | a resource's provider is not an id |
| CS0210 | resources | `the part …` (a non-video part that is not one line) | a resource's part is not one line |
| CS0211 | resources | `the part of a video is a timestamp range, such as 2:10–7:45, not …` | a video's part is not a timestamp range |
| CS0212 | resources | `the part … ends before it starts` | a video's part ends before it starts |
| CS0213 | resources | `a video is written player:id, such as youtube:Jnk_4Maf5Fk, not …` | a video is not written player:id |
| CS0214 | providers `player_problem` | `… is not a player (youtube)` | a player this page cannot play |
| CS0215 | resources | `… is not a … video id` | a video id is not in its player's form |
| CS0216 | resources | `only a video names a video to play` | a resource that is not a video names a video |
| CS0217 | resources | `an embedded video names the video it plays, such as video: youtube:<id>` | an embedded video names no video |
| CS0218 | resources | `… is cited twice in this node` | a node cites one url twice |

"what this resource covers …" keeps the code of the check that failed (`CS0007`–`CS0011`).

**`CS0300`–`CS0399` — questions** (`questions.py`)

| Code | Module | Message today | says |
|---|---|---|---|
| CS0301 | questions | `must be a list of questions` | `try:` is not a list |
| CS0302 | questions | `… is not a question` | an entry is not a question |
| CS0303 | questions | `unknown key \`…\` in a question (…)` | a question has a key it cannot have |
| CS0304 | questions | `a question has no id` | a question has no id |
| CS0305 | questions | `the question … has no kind (choice, number)` | a question has no kind |
| CS0306 | questions | `a figure question arrives with figures in M6` | a kind of question that is designed, not built |
| CS0307 | questions | `the question … has no ask` | a question asks nothing |
| CS0308 | questions | `the choice question … has an answer …` | a choice question has an answer |
| CS0309 | questions | `the choice question … has no options` | a choice question has no options |
| CS0310 | questions | `the number question … has options …` | a number question has options |
| CS0311 | questions | `the number question … has no answer` | a number question has no answer |
| CS0312 | questions | `the answer of … is not a number` | a number question's answer is not a number |
| CS0313 | questions | `the choice question … has a unit` | a choice question has a unit |
| CS0314 | questions | `the choice question … has a tolerance` | a choice question has a tolerance |
| CS0315 | questions | `the tolerance of … is not a number of 0 or more` | a tolerance is not a number of 0 or more |
| CS0316 | questions | `the question … has no hints` | a question has no hints |
| CS0317 | questions | `the hints of … must be a list, one hint at a time` | hints are not a list |
| CS0318 | questions | `the question … has n hints (at most N)` | a question has too many hints |
| CS0319 | questions | `a hint for … contains the answer` | a hint gives the answer away |
| CS0320 | questions | `the question … has no rationale` | a question has no rationale |
| CS0321 | questions | `… is asked twice in this node` | a question id is used twice |
| CS0322 | questions | `the options of … must be a list` | options are not a list |
| CS0323 | questions | `… is not an option — write text: and, on the right one, right:` | an entry is not an option |
| CS0324 | questions | `unknown key \`…\` in an option (text, right)` | an option has a key it cannot have |
| CS0325 | questions | `an option of … has no text` | an option has no text |
| CS0326 | questions | `… is not true or false` (an option's `right`) | `right` is not true or false |
| CS0327 | questions | `the question … has n options (a choice offers 2 to 5)` | a choice has too few or too many options |
| CS0328 | questions | `the question … has no right option` | a choice has no right option |
| CS0329 | questions | `the question … has n right options` | a choice has more than one right option |

"the question asked by … ", "a hint for … ", "the rationale of … ", "the unit of … " and "an option
of … " followed by a check's words keep the check's code (`CS0007`–`CS0011`).

**`CS0400`–`CS0499` — the body** (`node.py`'s markers; M4.1.2 adds the blocks' codes after these)

| Code | Module | Message today | says |
|---|---|---|---|
| CS0401 | node | `the file is empty` (body.md) | body.md is empty |
| CS0402 | node | `… is not read — only {% try %} markers are, until M6` | a marker line the body does not read |
| CS0403 | node | `{% try … %} names no question in node.yaml` | a question is placed that node.yaml does not have |
| CS0404 | node | `{% try … %} appears twice in body.md` | a question is placed twice |
| CS0405 | node | `… has no {% try … %} in body.md` | a question is never placed |

**`CS0500`–`CS0599` — the graph** (`graph.py`)

| Code | Module | Message today | says |
|---|---|---|---|
| CS0501 | graph | `… is not a node` (+ closest) | a link names a node the content does not have |
| CS0502 | graph | `… does not list … back — add it to …` | a peer link is written on one side only |
| CS0503 | graph | `… is …, below … (…)` | a goes-deeper link points to a lower level |
| CS0504 | graph | `a cycle — a → b → a` (+ more caught) | *needs* or *goes deeper* links form a cycle |

**`CS0600`–`CS0699` — registries** (`regions.py`, `providers.py`)

| Code | Module | Message today | says |
|---|---|---|---|
| CS0601 | regions | `the file is missing` (regions.yaml) | regions.yaml is missing |
| CS0602 | regions | `must be a list of regions` | `regions:` is not a list |
| CS0603 | regions | `… is not a region` | an entry is not a region |
| CS0604 | regions | `… is listed twice` | a region id is listed twice |
| CS0605 | regions, providers | `required field is missing` (in an entry) | a registry entry lacks a field |
| CS0606 | providers | `must be a list of providers` | `providers:` is not a list |
| CS0607 | providers | `… is not a provider` | an entry is not a provider |
| CS0608 | providers | `… is listed twice` | a provider id is listed twice |
| CS0609 | providers | `must be a list of licences` / `must list at least one licence` | a provider lists no licences |
| CS0610 | providers | `must be a list of players` | `players:` is not a list |
| CS0611 | providers | `… is not true or false` (`embed`) | `embed` is not true or false |
| CS0612 | content | `the file is missing, and … cites a provider` | a resource is cited and providers.yaml is missing |

**`CS0700`–`CS0799` — finding nodes** (`content.py`, `cli.py`)

| Code | Module | Message today | says |
|---|---|---|---|
| CS0701 | cli | `code-schema: no such folder: …` (exit 2) | the content root is not a folder |
| CS0702 | content | `has body.md but no node.yaml — a node folder holds both` | a folder has a body and no node.yaml |
| CS0703 | content | `… is not read — did you mean node.yaml?` | a near miss of node.yaml |
| CS0704 | content | `the content root is not a node — node folders go inside it` | the content root holds a node's files |
| CS0705 | content | `… is already a node at …` | two folders have the same name |

**`CW` — the weaver** (`graph.py`, `weave.py`, `cli.py`)

| Code | Module | Message today | says |
|---|---|---|---|
| CW0001 | graph | `duplicate id: …` | two topics have one id |
| CW0002 | graph | `…: region … is not in the region list` | a topic's region is not in the order |
| CW0003 | graph | `…: level … is not in the level list` | a topic's level is not in the order |
| CW0004 | graph | `…: needs …, which is not in the graph` | a topic needs one the graph does not have |
| CW0005 | graph | `needs cycle: a → b → a` | the graph's needs form a cycle |
| CW0006 | weave, cli | `not in the graph: …` / `code-weaver: not in the content: …` | a goal is not in the graph |
| CW0007 | cli | `code-weaver: n problems in the content; run code-schema validate …` | the content has problems |
| CW0008 | cli | `code-weaver: no such folder: …` | the content root is not a folder |
| CW0101 | cli | `code-weaver: a search needs a word` | a search has no words |

`weave`'s `ValueError("a route needs at least one goal")` stays a `ValueError`: it is a
programming error that no caller can reach (the CLI and the API both require a goal).

**`CA` — the API** (`content/api.py`, `routes.py`, `search.py`, `rebuild_index`)

| Code | Module | Message today | says |
|---|---|---|---|
| CA0001 | api, routes, search | `The index has not been built yet.` (503) | nothing has been indexed |
| CA0002 | api, routes | `No topic with id … It may have been removed or renamed.` (404) | a node is not in the index |
| CA0003 | search | `A search needs a word.` (422) | a search has no words |
| CA0004 | rebuild_index | `set CODE_CONTENT_ROOT or pass --root` (exit 2) | no content root was given |
| CA0005 | rebuild_index | `… is not a folder` (exit 2) | the content root is not a folder |
| CA0006 | rebuild_index | `Refused: …` (exit 1, followed by the `CS` problems) | the content has problems, so nothing was applied |

---

### Task 1: The registry

**Files:**
- Create: `packages/code-schema/src/code_schema/diagnostics.yml`
- Create: `packages/code-schema/src/code_schema/diagnostics.py`
- Modify: `packages/code-schema/src/code_schema/__init__.py` (export)
- Test: `tests/schema/test_diagnostics.py`

**Interfaces:**
- Produces: `Diagnostic(code, emitted_by, concern, says, refuses, fix, explanation, retired="")`;
  `Band(first, last, concern)`; `DIAGNOSTICS: dict[str, Diagnostic]`; `BANDS: tuple[Band, ...]`;
  `diagnostic(code) -> Diagnostic` (raises `UnknownDiagnostic`); `closest(code) -> str | None`;
  `load(text: str) -> tuple[dict[str, Diagnostic], tuple[Band, ...]]`; `PREFIXES = {"CS":
  "schema", "CW": "weaver", "CA": "api"}`.

- [ ] **Step 1: Write the failing tests**

```python
"""The diagnostic registry (spec M4D.2, M4D.3, M4D.6)."""

import re
import subprocess
import zipfile
from pathlib import Path

import pytest

from code_schema.diagnostics import (
    BANDS,
    DIAGNOSTICS,
    PREFIXES,
    UnknownDiagnostic,
    closest,
    diagnostic,
    load,
)

CODE = re.compile(r"^C[SWA]\d{4}$")


def test_the_registry_declares_codes() -> None:
    assert len(DIAGNOSTICS) > 100
    assert all(CODE.match(code) for code in DIAGNOSTICS)


def test_no_code_ends_in_0000() -> None:
    assert not [code for code in DIAGNOSTICS if code.endswith("0000")]


def test_every_entry_is_complete() -> None:
    for code, entry in DIAGNOSTICS.items():
        assert entry.says and entry.fix and entry.explanation and entry.concern, code
        assert isinstance(entry.refuses, bool), code


def test_a_prefix_says_who_emits_it() -> None:
    for code, entry in DIAGNOSTICS.items():
        assert PREFIXES[code[:2]] == entry.emitted_by, code


def test_every_code_sits_in_a_band_its_concern_owns() -> None:
    for code, entry in DIAGNOSTICS.items():
        owners = [band for band in BANDS if band.first <= code <= band.last]
        assert [band.concern for band in owners] == [entry.concern], code


def test_bands_do_not_overlap() -> None:
    ordered = sorted(BANDS, key=lambda band: band.first)
    for before, after in zip(ordered, ordered[1:], strict=False):
        assert before.last < after.first


def test_an_undeclared_code_raises_and_a_close_one_is_offered() -> None:
    with pytest.raises(UnknownDiagnostic):
        diagnostic("CS0999")
    assert closest("CS0210") in DIAGNOSTICS


def test_load_refuses_an_entry_missing_a_field() -> None:
    text = "bands:\n  - {first: CS0001, last: CS0099, concern: fields}\ncodes:\n  CS0001: {emitted_by: schema}\n"
    with pytest.raises(ValueError, match="CS0001"):
        load(text)


def test_the_registry_ships_in_the_wheel(tmp_path: Path) -> None:
    root = Path(__file__).resolve().parents[2] / "packages" / "code-schema"
    subprocess.run(
        ["uv", "build", "--wheel", "--out-dir", str(tmp_path), str(root)],
        check=True,
        capture_output=True,
    )
    (wheel,) = tmp_path.glob("code_schema-*.whl")
    assert "code_schema/diagnostics.yml" in zipfile.ZipFile(wheel).namelist()
```

- [ ] **Step 2: Run them to verify they fail**

Run: `uv run pytest tests/schema/test_diagnostics.py -q`
Expected: FAIL — `ModuleNotFoundError: No module named 'code_schema.diagnostics'`.

- [ ] **Step 3: Write `diagnostics.py`**

```python
"""The diagnostic registry, loaded from data (spec M4.1.1, M4D.2).

One file declares every code Code can report — `CS` code-schema, `CW` code-weaver, `CA` the API —
so "which codes exist" has one answer, and `explain` and the reference page read the same entries.
A `Problem` built with a code this file does not declare raises: emitting an undeclared code is a
bug in this repository, not a mistake a user made, so the state is unrepresentable rather than
tested for. Kept as Comeni Labs keeps its `MD` and `MF` codes.
"""

from __future__ import annotations

import difflib
from dataclasses import dataclass
from pathlib import Path

import yaml

REGISTRY = Path(__file__).with_name("diagnostics.yml")
PREFIXES = {"CS": "schema", "CW": "weaver", "CA": "api"}
_FIELDS = ("emitted_by", "concern", "says", "refuses", "fix", "explanation")


class UnknownDiagnostic(KeyError):
    """A code the registry does not declare."""


@dataclass(frozen=True)
class Diagnostic:
    code: str
    emitted_by: str
    concern: str
    says: str
    refuses: bool
    fix: str
    explanation: str
    retired: str = ""


@dataclass(frozen=True)
class Band:
    first: str
    last: str
    concern: str


def load(text: str) -> tuple[dict[str, Diagnostic], tuple[Band, ...]]:
    """The registry's codes and bands. Raises ValueError naming the entry that is incomplete."""
    data = yaml.safe_load(text)
    bands = tuple(Band(**band) for band in data["bands"])
    codes: dict[str, Diagnostic] = {}
    for code, entry in data["codes"].items():
        missing = [name for name in _FIELDS if name not in entry]
        if missing:
            raise ValueError(f"{code} is missing {', '.join(missing)}")
        codes[code] = Diagnostic(code=code, **entry)
    return codes, bands


DIAGNOSTICS, BANDS = load(REGISTRY.read_text(encoding="utf-8"))


def diagnostic(code: str) -> Diagnostic:
    if code not in DIAGNOSTICS:
        raise UnknownDiagnostic(code)
    return DIAGNOSTICS[code]


def closest(code: str) -> str | None:
    found = difflib.get_close_matches(code, sorted(DIAGNOSTICS), n=1, cutoff=0.5)
    return found[0] if found else None
```

- [ ] **Step 4: Write `diagnostics.yml`** — the header comment (what the file is, the bands in
  prose, "a code is never renumbered", the generated page and how to regenerate it), `bands:` with
  the eleven bands of M4D.3 (`fields`, `links`, `resources`, `questions`, `body`, `graph`,
  `registries`, `discovery`, `routes`, `find`, `index`), and `codes:` with **every row of *The
  mapping* above**: `emitted_by` from the prefix, `concern` from the band, `says` from the table,
  `refuses: true` (every existing problem refuses), `fix` — what the author does, in one to three
  sentences, naming the file and field — and `explanation` — why the rule exists, citing the spec
  section that made it (M1P1.3, M1P2.5, M3P1.3, T4.2, …), in two to five sentences. Example:

```yaml
CS0203:
  emitted_by: schema
  concern: resources
  says: a resource asks to embed from a provider that does not allow it
  refuses: true
  fix: |
    Write display: link on the resource, or, if the provider's terms now allow embedding, change
    its entry in providers.yaml in a pull request of its own.
  explanation: |
    Whether a provider may be embedded is decided once, in providers.yaml, from its terms (tutor
    spec T4.2), not per resource. Khan Academy is linked, never embedded (issue 76). The page
    embeds only what the registry allows.
```

- [ ] **Step 5: Export and run the tests**

In `__init__.py` add `Diagnostic`, `UnknownDiagnostic`, `diagnostic` to the imports and `__all__`.
Run: `uv run pytest tests/schema/test_diagnostics.py -q` — Expected: PASS.
Run: `uv run pytest tests/schema/test_public_api.py -q` — update its expected list with the three
names; Expected: PASS.

- [ ] **Step 6: Commit** — `feat(schema): the diagnostic registry — M4.1.1`

### Task 2: A problem carries its code; checks return what went wrong

**Files:**
- Modify: `packages/code-schema/src/code_schema/problems.py`
- Modify: `packages/code-schema/src/code_schema/fields.py`
- Modify: `packages/code-schema/src/code_schema/cli.py` (`github_line`)
- Test: `tests/schema/test_problems.py` (create), `tests/schema/test_fields.py`, `tests/schema/test_cli.py`

**Interfaces:**
- Consumes: `diagnostic(code)` from Task 1.
- Produces: `Problem(file, message, field=None, line=None, code=None)` — `code` optional until
  Task 11; a given code is checked in `__post_init__`. `Wrong(code: str, message: str)`, and
  `Check = Callable[[object], Wrong | None]` in `fields.py`.

- [ ] **Step 1: Write the failing tests**

```python
# tests/schema/test_problems.py
import pytest

from code_schema.diagnostics import UnknownDiagnostic
from code_schema.problems import Problem


def test_a_problem_prints_its_code_before_its_message() -> None:
    problem = Problem(file="a/node.yaml", line=9, field="provider", code="CS0201", message="x")
    assert str(problem) == "a/node.yaml:9: provider: CS0201 x"


def test_a_problem_with_an_undeclared_code_cannot_be_built() -> None:
    with pytest.raises(UnknownDiagnostic):
        Problem(file="a", code="CS0999", message="x")
```

```python
# tests/schema/test_fields.py — add
from code_schema.fields import Wrong, one_line


def test_a_check_says_what_went_wrong_with_its_code() -> None:
    assert one_line(10)("a\nb") == Wrong("CS0009", "must be one line")
    assert one_line(10)("x" * 11) == Wrong("CS0010", "is longer than 10 characters (11)")


def test_a_shared_check_gives_the_same_code_on_any_field() -> None:
    title, hint = one_line(80), one_line(200)
    assert title("a\nb").code == hint("a\nb").code == "CS0009"
```

```python
# tests/schema/test_cli.py — add
def test_an_annotation_carries_the_code_as_its_title() -> None:
    problem = Problem(
        file="n/node.yaml",
        line=3,
        code="CS0005",
        field="title",
        message="required field is missing",
    )
    assert github_line(problem).startswith("::error file=n/node.yaml,line=3,title=CS0005::")
```

- [ ] **Step 2: Run them to verify they fail**

Run: `uv run pytest tests/schema/test_problems.py tests/schema/test_fields.py tests/schema/test_cli.py -q`
Expected: FAIL — `TypeError: Problem.__init__() got an unexpected keyword argument 'code'`,
`ImportError: cannot import name 'Wrong'`.

- [ ] **Step 3: Implement**

`problems.py`:

```python
from code_schema.diagnostics import diagnostic


@dataclass(frozen=True)
class Problem:
    file: str
    message: str
    field: str | None = None
    line: int | None = None
    code: str | None = None  # required from Task 11 of the M4.1.1 plan

    def __post_init__(self) -> None:
        if self.code is not None:
            diagnostic(self.code)  # raises UnknownDiagnostic

    def __str__(self) -> str:
        where = self.file if self.line is None else f"{self.file}:{self.line}"
        said = self.message if self.code is None else f"{self.code} {self.message}"
        what = said if self.field is None else f"{self.field}: {said}"
        return f"{where}: {what}"
```

`fields.py`: add `Wrong` and return it from every check, with the codes of *The mapping*
(`CS0006`–`CS0018`), wording unchanged:

```python
@dataclass(frozen=True)
class Wrong:
    """What a check found wrong: its diagnostic code and its message."""

    code: str
    message: str


Check = Callable[[object], Wrong | None]


def one_line(max_len: int) -> Check:
    def check(value: object) -> Wrong | None:
        if not isinstance(value, str):
            return Wrong("CS0007", f"{shown(value)} is not text")
        if not value.strip():
            return Wrong("CS0008", "must not be empty")
        if "\n" in value:
            return Wrong("CS0009", "must be one line")
        if len(value) > max_len:
            return Wrong("CS0010", f"is longer than {max_len} characters ({len(value)})")
        return None

    return check
```

(`exactly` → `CS0006`; `one_sentence` passes `one_line`'s `Wrong` through and adds `CS0011`;
`one_of` → `CS0012`; `whole_number` → `CS0013`, `CS0014`; `slug` → `CS0015`; `in_registry` →
`CS0016`; `https_url` → `CS0017` for both "is not a url" returns, `CS0018`.)

Every caller of a check still reads a string today; in this task, change each caller to take
`.message` and `.code` — `node.py`'s field loop becomes
`Problem(file=file, field=spec.name, line=lines.get(spec.name), code=wrong.code, message=wrong.message)`,
and the helpers that compose a sentence (`f"what this resource covers {wrong}"`) become
`f"what this resource covers {wrong.message}"` with `code=wrong.code`. The callers are in
`node.py`, `links.py`, `resources.py`, `questions.py`, `regions.py` and `providers.py`; `mypy`
names each one that still treats a check's result as a string.

`cli.py`'s `github_line` adds `title=<code>` after `line` when the problem has a code.

- [ ] **Step 4: Run the suite** — `uv run pytest tests/schema -q && uv run mypy` — Expected: PASS
  (messages unchanged; only the new tests look at codes).

- [ ] **Step 5: Commit** — `feat(schema): a problem carries its code — M4.1.1`

### Task 3: Codes for fields, files and the body (`CS00xx`, `CS04xx`)

**Files:**
- Modify: `packages/code-schema/src/code_schema/yaml_lines.py`, `node.py`
- Test: `tests/schema/test_node.py`, `tests/schema/test_yaml_lines.py`, `tests/schema/test_writer.py`

**Interfaces:** Consumes `Problem(..., code=)` and `Wrong` from Task 2.

- [ ] **Step 1: Write the failing test** — in `test_node.py`, a helper and one test per code:

```python
def codes(problems: list[Problem]) -> list[str | None]:
    return [problem.code for problem in problems]


def test_each_field_and_file_problem_has_its_code() -> None:
    cases = {
        "CS0001": ("title: [\n", "Body.\n"),
        "CS0002": ("", "Body.\n"),
        "CS0003": ("- a\n", "Body.\n"),
        "CS0004": (VALID + "titel: x\n", "Body.\n"),
        "CS0005": (VALID.replace("minutes: 10\n", ""), "Body.\n"),
        "CS0401": (VALID, ""),
    }
    for code, (node_yaml, body) in cases.items():
        _, problems = parse_node(node_yaml, body, node_id="n", regions=REGIONS, file="n/node.yaml")
        assert code in codes(problems), code
```

(and, in the same file, the marker codes `CS0402`–`CS0405` from the marker tests that already
exist — add `assert codes(problems) == [...]` beside each `messages` assertion; `test_writer.py`'s
`read_node` cases for `CS0020`–`CS0022` likewise.)

- [ ] **Step 2: Run** `uv run pytest tests/schema/test_node.py -q` — Expected: FAIL, codes `None`.
- [ ] **Step 3: Add `code=` to every `Problem(...)` in `yaml_lines.py` and `node.py`**, per the
  mapping: `CS0001`–`CS0005`, `CS0020`–`CS0022`, `CS0111`, `CS0401`–`CS0405`. The node-id check in
  `parse_node` passes its `Wrong`'s code (`CS0015`).
- [ ] **Step 4: Run** `uv run pytest tests/schema -q` — Expected: PASS.
- [ ] **Step 5: Commit** — `feat(schema): codes for fields, files and markers — M4.1.1`

### Task 4: Codes for links (`CS01xx`)

**Files:** Modify `packages/code-schema/src/code_schema/links.py`; Test `tests/schema/test_links.py`.

- [ ] **Step 1: Failing test** — every existing case in `test_links.py` that asserts a message
  also asserts its code, using the table (`CS0101`–`CS0110`, `CS0019` for the empty list); add:

```python
def test_a_link_to_itself_and_a_duplicate_have_their_codes() -> None:
    _, _, problems = parse_links(
        [
            {"node": "salmon", "reason": "It is."},
            {"node": "k", "reason": "A."},
            {"node": "k", "reason": "B."},
        ],
        kind="needs",
        node_id="salmon",
        lines=Lines(),
        file="salmon/node.yaml",
    )
    assert [problem.code for problem in problems] == ["CS0108", "CS0109"]
```

- [ ] **Step 2: Run** `uv run pytest tests/schema/test_links.py -q` — Expected: FAIL.
- [ ] **Step 3: Implement** — `links.py`'s local `problem(message, line)` helper gains a `code`
  parameter first: `def problem(code: str, message: str, line: int | None = field_line)`, and each
  call passes its code from the table; a reason that fails a check passes the check's code.
- [ ] **Step 4: Run** `uv run pytest tests/schema -q` — Expected: PASS.
- [ ] **Step 5: Commit** — `feat(schema): codes for links — M4.1.1`

### Task 5: Codes for resources and registries (`CS02xx`, `CS06xx`)

**Files:** Modify `resources.py`, `providers.py`, `regions.py`, `content.py` (`CS0612`); Test
`tests/schema/test_resources.py`, `test_providers.py`, `test_regions.py`, `test_content.py`.

- [ ] **Step 1: Failing tests** — each existing `messages(...)` assertion gains a `codes(...)`
  twin with the table's codes; add:

```python
def test_a_composed_message_keeps_the_code_of_the_check_that_failed() -> None:
    resources, problems = parse([{**VIDEO[0], "covers": ""}])
    assert [(p.code, p.message) for p in problems] == [
        ("CS0008", "what this resource covers must not be empty")
    ]
```

- [ ] **Step 2: Run** `uv run pytest tests/schema/test_resources.py tests/schema/test_providers.py tests/schema/test_regions.py -q` — Expected: FAIL.
- [ ] **Step 3: Implement** — `resources.py`'s `problem` helper takes a code first, as in Task 4;
  `_registry_problems` returns `(key, code, message)`; `_range_problem` and `_video_problem`
  return `Wrong`; `player_problem` returns `Wrong("CS0214", …)`; `providers.py` and `regions.py`'s
  `_entry_problem` pass `CS0605` for a missing field and the check's code otherwise; the list,
  entry and duplicate messages take `CS0602`–`CS0611`; `content.py`'s missing registry takes
  `CS0612`.
- [ ] **Step 4: Run** `uv run pytest tests/schema -q` — Expected: PASS.
- [ ] **Step 5: Commit** — `feat(schema): codes for resources and registries — M4.1.1`

### Task 6: Codes for questions (`CS03xx`)

**Files:** Modify `questions.py`; Test `tests/schema/test_questions.py`.

- [ ] **Step 1: Failing tests** — each `messages(...)` assertion gains a `codes(...)` twin; add
  one test that a figure question is `CS0306` and one that a hint containing the answer is
  `CS0319`.
- [ ] **Step 2: Run** `uv run pytest tests/schema/test_questions.py -q` — Expected: FAIL.
- [ ] **Step 3: Implement** — `_Problem.__call__(self, code, message, line=None)` and the `here`
  helper likewise take a code first; each call passes the table's code (`CS0301`–`CS0329`, `CS0019`
  for the empty list); composed sentences pass the check's code; `_LATER_KINDS` maps a kind to
  `("CS0306", message)`; the option checks take `CS0322`–`CS0329`.
- [ ] **Step 4: Run** `uv run pytest tests/schema -q` — Expected: PASS.
- [ ] **Step 5: Commit** — `feat(schema): codes for questions — M4.1.1`

### Task 7: Codes for the graph and for finding nodes (`CS05xx`, `CS07xx`)

**Files:** Modify `graph.py`, `content.py`, `cli.py`; Test `tests/schema/test_graph.py`,
`test_content.py`, `test_cli.py`.

- [ ] **Step 1: Failing tests** — `codes(...)` twins for the graph cases (`CS0501`–`CS0504`) and
  the discovery cases (`CS0702`–`CS0705`); in `test_cli.py`:

```python
def test_a_missing_root_says_its_code(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    assert run(["validate", str(tmp_path / "gone")]) == 2
    assert "CS0701" in capsys.readouterr().err
```

- [ ] **Step 2: Run** `uv run pytest tests/schema/test_graph.py tests/schema/test_content.py tests/schema/test_cli.py -q` — Expected: FAIL.
- [ ] **Step 3: Implement** — `graph.py`'s `at(node, kind, target, message)` takes a code before
  the message; `_cycles` passes `CS0504`; `content.py`'s problems take `CS0702`–`CS0705`; `cli.py`
  prints `code-schema: CS0701 no such folder: …`.
- [ ] **Step 4: Run** `uv run pytest tests/schema -q && uv run code-schema validate tests/fixtures/salmon` — Expected: PASS; `26 nodes, no problems`.
- [ ] **Step 5: Commit** — `feat(schema): codes for the graph and for finding nodes — M4.1.1`

### Task 8: The weaver's codes (`CW`)

**Files:** Modify `packages/code-weaver/src/code_weaver/graph.py`, `weave.py`, `cli.py`; Test
`tests/weaver/test_graph.py`, `test_cli.py`, and `tests/weaver/test_codes.py` (create).

**Interfaces:** Produces `GraphError.problems: tuple[tuple[str, str], ...]` — `(code, message)`
pairs, in the order the message already lists them; `UnknownGoal.code = "CW0006"`.

- [ ] **Step 1: Failing tests**

```python
# tests/weaver/test_codes.py
"""The weaver's codes are declared under CW, as the weaver's (spec M4D.4, M4D.6)."""

import re
from pathlib import Path

from code_schema.diagnostics import DIAGNOSTICS

SOURCE = Path(__file__).resolve().parents[2] / "packages" / "code-weaver" / "src" / "code_weaver"


def test_every_code_the_weaver_writes_is_declared_as_the_weavers() -> None:
    written = {
        code
        for path in SOURCE.glob("*.py")
        for code in re.findall(r'"(C[SWA]\d{4})"', path.read_text())
    }
    assert written, "the weaver writes no codes"
    for code in written:
        assert code.startswith("CW"), code
        assert DIAGNOSTICS[code].emitted_by == "weaver", code
```

and in `test_graph.py`, beside each `GraphError` message assertion, the codes:
`assert [code for code, _ in refused.value.problems] == ["CW0001"]` (and `CW0002`–`CW0005`).

- [ ] **Step 2: Run** `uv run pytest tests/weaver -q` — Expected: FAIL.
- [ ] **Step 3: Implement** — `Graph.__init__` collects `(code, message)` pairs and raises
  `GraphError(problems)`, whose `str` is `"\n".join(f"{code} {message}")`; `UnknownGoal` gains
  `code = "CW0006"`; `cli.py` prints `code-weaver: CW0008 no such folder: …`, `CW0007 …`,
  `CW0006 not in the content: …`, `CW0101 a search needs a word`.
- [ ] **Step 4: Run** `uv run pytest tests/weaver -q && uv run mypy` — Expected: PASS.
- [ ] **Step 5: Commit** — `feat(weaver): codes for a refused graph, a goal and a search — M4.1.1`

### Task 9: The API's codes (`CA`)

**Files:** Modify `apps/api/src/code_api/content/api.py` (`Message`), `routes.py`, `search.py`,
`management/commands/rebuild_index.py`, `apps/api/openapi.json`, `apps/web/src/api/schema.ts`;
Test `apps/api/tests/test_nodes_api.py`, `test_routes_api.py`, `test_search_api.py`,
`test_rebuild_command.py`.

**Interfaces:** `Message(detail: str, code: str)`.

- [ ] **Step 1: Failing tests** — in each API test file, beside every 404, 422 and 503 status
  assertion: `assert response.json()["code"] == "CA0002"` (`CA0001`, `CA0003`); in
  `test_rebuild_command.py`, the stderr of each exit-2 and refusal case contains `CA0004`,
  `CA0005`, `CA0006`, and a refusal's following lines keep their `CS` codes.
- [ ] **Step 2: Run** `uv run pytest apps/api/tests -q` (Compose's Postgres and Redis up) — Expected: FAIL.
- [ ] **Step 3: Implement** — `Message` gains `code: str`; each `Message(detail=…)` passes its code;
  `rebuild_index` prefixes its `CommandError`s and its `Refused:` header with the code.
- [ ] **Step 4: Regenerate** — the `export_openapi_schema` command in `CLAUDE.md`, then in
  `apps/web` `npm run api-types`; run `uv run pytest apps/api/tests -q` and, in `apps/web`,
  `npm test && npm run typecheck` — Expected: PASS (`getJson` still reads `detail`).
- [ ] **Step 5: Commit** — `feat(api): error answers carry their codes — M4.1.1`

### Task 10: Explain, and the reference page

**Files:** Modify `packages/code-schema/src/code_schema/cli.py`; Create
`packages/code-schema/src/code_schema/reference.py`, `docs/reference/diagnostics.md`
(generated), `docs/reference/README.md`; Modify `docs/index.md`, `CLAUDE.md`; Test
`tests/schema/test_explain.py` (create), `tests/repo/test_reference.py` (create).

**Interfaces:** `reference.render(diagnostics, bands) -> str`; CLI `code-schema explain CODE`,
`code-schema diagnostics --write PATH`.

- [ ] **Step 1: Failing tests**

```python
# tests/schema/test_explain.py
from code_schema.cli import run


def test_explain_prints_what_a_code_says_and_how_to_fix_it(capsys) -> None:
    assert run(["explain", "CS0203"]) == 0
    out = capsys.readouterr().out
    assert out.startswith(
        "CS0203 — a resource asks to embed from a provider that does not allow it"
    )
    assert "Fix:" in out and "Why:" in out


def test_an_unknown_code_exits_2_with_the_closest(capsys) -> None:
    assert run(["explain", "CS0299"]) == 2
    assert "did you mean" in capsys.readouterr().err


def test_a_retired_code_still_explains_and_says_so(capsys, monkeypatch) -> None:
    import code_schema.diagnostics as registry
    from dataclasses import replace

    monkeypatch.setitem(
        registry.DIAGNOSTICS,
        "CS0203",
        replace(registry.DIAGNOSTICS["CS0203"], retired="2026-10-01 — example"),
    )
    assert run(["explain", "CS0203"]) == 0
    assert "Retired 2026-10-01 — example" in capsys.readouterr().out
```

```python
# tests/repo/test_reference.py
"""docs/reference/diagnostics.md is generated from the registry (spec M4D.5)."""

from pathlib import Path

from code_schema.diagnostics import BANDS, DIAGNOSTICS
from code_schema.reference import render

PAGE = Path(__file__).resolve().parents[2] / "docs" / "reference" / "diagnostics.md"


def test_the_reference_page_is_current() -> None:
    assert PAGE.read_text(encoding="utf-8") == render(DIAGNOSTICS, BANDS), (
        "docs/reference/diagnostics.md is stale: run uv run code-schema diagnostics --write docs/reference/diagnostics.md"
    )


def test_the_page_is_the_same_bytes_twice() -> None:
    assert render(DIAGNOSTICS, BANDS) == render(dict(reversed(DIAGNOSTICS.items())), BANDS)
```

- [ ] **Step 2: Run** `uv run pytest tests/schema/test_explain.py tests/repo/test_reference.py -q` — Expected: FAIL.
- [ ] **Step 3: Implement** — `reference.render` writes a header ("Generated from
  `code_schema/diagnostics.yml` — do not edit; regenerate with …"), then per prefix and band, in
  code order, `### CODE — says`, *Refuses* or *Warns*, **Fix**, **Why**, and *Retired* when set.
  `cli.py` gains the `explain` and `diagnostics --write` subcommands (`explain` prints
  `CODE — says`, a blank line, `Fix:` + fix, `Why:` + explanation, and `Retired …` when set; an
  unknown code prints `code-schema: CODE is not a code — did you mean CLOSEST?` to stderr, exit 2).
  Generate the page; add the *Reference* row to `docs/index.md` and a two-line README in
  `docs/reference/`; add both commands to `CLAUDE.md`'s command list.
- [ ] **Step 4: Run** `uv run pytest tests -q` — Expected: PASS.
- [ ] **Step 5: Commit** — `feat(schema): explain a code, and the reference page — M4.1.1`

### Task 11: Every problem has a code, and nothing is dead

**Files:** Modify `packages/code-schema/src/code_schema/problems.py`; Test
`tests/schema/test_problems.py`, `tests/repo/test_diagnostic_ownership.py` (create).

- [ ] **Step 1: Failing tests**

```python
# tests/schema/test_problems.py — add
def test_a_problem_without_a_code_cannot_be_built() -> None:
    with pytest.raises(TypeError):
        Problem(file="a", message="x")  # type: ignore[call-arg]
```

```python
# tests/repo/test_diagnostic_ownership.py
"""Each package writes only its own prefix, and every declared code is written somewhere (M4D.6)."""

import re
from pathlib import Path

from code_schema.diagnostics import DIAGNOSTICS

ROOT = Path(__file__).resolve().parents[2]
SOURCES = {
    "CS": ROOT / "packages" / "code-schema" / "src",
    "CW": ROOT / "packages" / "code-weaver" / "src",
    "CA": ROOT / "apps" / "api" / "src",
}
LITERAL = re.compile(r"\"(C[SWA]\d{4})\"")


def written(root: Path) -> set[str]:
    return {
        code
        for path in root.rglob("*.py")
        for code in LITERAL.findall(path.read_text(encoding="utf-8"))
    }


def test_each_package_writes_only_its_own_prefix() -> None:
    for prefix, root in SOURCES.items():
        foreign = sorted(code for code in written(root) if not code.startswith(prefix))
        assert foreign == [], f"{root} writes {foreign}"


def test_every_declared_code_is_written_somewhere() -> None:
    everywhere = set().union(*(written(root) for root in SOURCES.values()))
    dead = sorted(
        code for code, entry in DIAGNOSTICS.items() if not entry.retired and code not in everywhere
    )
    assert dead == []
```

- [ ] **Step 2: Run** `uv run pytest tests/schema/test_problems.py tests/repo/test_diagnostic_ownership.py -q` — Expected: FAIL (`code` still optional; any code left undeclared-but-unused shows).
- [ ] **Step 3: Implement** — `Problem`'s `code` becomes a required field placed before `message`
  (`Problem(file, code, message, field=None, line=None)`), `__post_init__` always checks it, and
  `__str__` always prints it; the few constructions still passing `code=` by keyword are unaffected;
  `mypy` names any left without one.
- [ ] **Step 4: Run the whole command set** — `uv run ruff check . && uv run ruff format --check .
  && uv run mypy && uv run pytest` (Compose's Postgres and Redis up), and in `apps/web` on Node 24
  `npm run lint && npm run typecheck && npm test && npm run build` — Expected: PASS.
- [ ] **Step 5: Commit** — `feat(schema): every problem has a declared code — M4.1.1`

### Task 12: Journal, and close

- [ ] Write `docs/notes/journal/2026-MM-DD-m4-1-1-diagnostic-codes.md` (where things stand with
  the command that checks each claim, what changed with commits, decisions, next, traps), tick
  this plan's boxes and add its execution record, open the pull request with `Closes #128`, and
  ask the operator before merging.

## Execution record

(Filled in as tasks complete.)
