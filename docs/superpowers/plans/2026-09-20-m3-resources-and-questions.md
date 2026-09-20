# M3 part 1 — resources and try questions: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** a node can carry outside resources and inline try questions, checked by
`code-schema validate`, stored in the index, and returned by `GET /api/nodes/{id}`.

**Architecture:** two new lists in `node.yaml`, parsed by the machinery links already use; a
`providers.yaml` registry beside `regions.yaml`; `{% try <id> %}` markers in `body.md` saying
where a question sits; three new index tables; two new lists on the node endpoint.

**Tech Stack:** Python 3.14, PyYAML through `code_schema.yaml_lines`, Django 6.1, django-ninja,
Postgres 18 in Compose, vitest for the web type check.

**Spec:** [`docs/superpowers/specs/2026-09-20-m3-resources-and-questions-design.md`](../specs/2026-09-20-m3-resources-and-questions-design.md)

## Global Constraints

- **`code-schema` stays pure.** Allowed imports are the frozen set in `tests/guards/purity.py`:
  `__future__`, `argparse`, `collections.abc`, `dataclasses`, `difflib`, `enum`, `pathlib`, `re`,
  `sys`, `typing`, `yaml`. **Do not add one** — the URL check uses `re`, not `urllib`.
- **Nothing raises.** Every parser returns its value and a list of `Problem`s (M1P1.4).
- **Nothing coerces.** `"96"` is not `96`.
- **Every problem names the file, and the line when there is one** (M1P1.5).
- **Tests never read `../comeni-code-content`** (R1). Everything runs against `tests/fixtures/salmon/`.
- **The fixtures' 26 nodes, the 17-stop Salmon route and every M2 pin stay as they are.** Nothing
  here touches `minutes`, links or regions.
- Conventional Commits with a body, ending `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- Never commit to `main`; work on `m3-part-1-resources-and-questions`.
- Message style: lower case, no full stop, name the thing that is wrong. Read
  `packages/code-schema/src/code_schema/links.py` before writing a new one.

---

### Task 1: The provider registry

**Files:**
- Create: `packages/code-schema/src/code_schema/providers.py`
- Create: `tests/schema/test_providers.py`
- Modify: `packages/code-schema/src/code_schema/__init__.py`
- Modify: `tests/schema/test_public_api.py`

**Interfaces:**
- Consumes: `code_schema.fields` (`one_line`, `slug`, `shown`), `code_schema.yaml_lines`
  (`load_mapping`, `Lines`), `code_schema.problems.Problem`.
- Produces:
  ```python
  REGISTRY = "providers.yaml"

  @dataclass(frozen=True)
  class Provider:
      id: str
      name: str
      licences: tuple[str, ...]
      embed: bool

  def parse_providers(text: str, *, file: str = REGISTRY) -> tuple[dict[str, Provider], list[Problem]]
  def read_providers(root: Path) -> tuple[dict[str, Provider] | None, list[Problem]]
  ```
  `read_providers` returns **`None`, `[]`** when the file is absent — "no registry", which task 6
  turns into a problem only when a resource names a provider. An empty or broken file returns
  `{}` with problems, which is not the same thing.

- [ ] **Step 1: Write the failing tests**

```python
# tests/schema/test_providers.py
"""providers.yaml: the allow-list of outside providers (spec M3P1.2)."""

from pathlib import Path

from code_schema.providers import Provider, parse_providers, read_providers

GOOD = """providers:
  - id: khan-academy
    name: Khan Academy
    licences: [YouTube embed]
    embed: true
  - id: openstax
    name: OpenStax
    licences: [CC BY 4.0]
    embed: true
"""


def test_a_registry_is_read_in_order() -> None:
    providers, problems = parse_providers(GOOD)
    assert problems == []
    assert list(providers) == ["khan-academy", "openstax"]
    assert providers["khan-academy"] == Provider(
        id="khan-academy", name="Khan Academy", licences=("YouTube embed",), embed=True
    )


def test_a_provider_listed_twice_is_a_problem() -> None:
    _, problems = parse_providers(GOOD + "  - id: khan-academy\n    name: Again\n    licences: [x]\n    embed: false\n")
    assert [problem.message for problem in problems] == ['"khan-academy" is listed twice']


def test_every_field_is_required() -> None:
    _, problems = parse_providers("providers:\n  - id: khan-academy\n")
    assert [(problem.field, problem.message) for problem in problems] == [
        ("name", "required field is missing"),
        ("licences", "required field is missing"),
        ("embed", "required field is missing"),
    ]


def test_licences_must_be_a_non_empty_list_of_lines() -> None:
    _, problems = parse_providers(
        "providers:\n  - id: a\n    name: A\n    licences: []\n    embed: true\n"
    )
    assert problems[0].field == "licences"
    assert problems[0].message == "must list at least one licence"


def test_embed_must_be_true_or_false() -> None:
    _, problems = parse_providers(
        "providers:\n  - id: a\n    name: A\n    licences: [CC BY 4.0]\n    embed: yes please\n"
    )
    assert problems[0].message == '"yes please" is not true or false'


def test_a_missing_file_is_no_registry_and_no_problem(tmp_path: Path) -> None:
    providers, problems = read_providers(tmp_path)
    assert providers is None and problems == []


def test_a_present_file_is_read(tmp_path: Path) -> None:
    (tmp_path / "providers.yaml").write_text(GOOD, encoding="utf-8")
    providers, problems = read_providers(tmp_path)
    assert problems == [] and providers is not None and len(providers) == 2
```

- [ ] **Step 2: Run them and watch them fail**

Run: `uv run pytest tests/schema/test_providers.py -q`
Expected: collection error — no module named `code_schema.providers`.

- [ ] **Step 3: Write `providers.py`**

Model it on `regions.py`, which is the same shape: a list of entries, each with required fields,
duplicates refused, every problem carrying `file`, `field` and `line`. Two checks are new:

```python
def _licences_problem(value: object) -> str | None:
    if not isinstance(value, list):
        return "must be a list of licences"
    if not value:
        return "must list at least one licence"
    for entry in value:
        if (wrong := _licence(entry)) is not None:   # one_line(max_len=60)
            return wrong
    return None


def _embed_problem(value: object) -> str | None:
    return None if isinstance(value, bool) else f"{shown(value)} is not true or false"
```

Keep the insertion order of the file: `dict` preserves it, and the index stores a position from it.

- [ ] **Step 4: Run the tests**

Run: `uv run pytest tests/schema/test_providers.py -q` — all pass.

- [ ] **Step 5: Export `Provider`, `parse_providers`, `read_providers`**

Add them to `code_schema/__init__.py` (alphabetically, as the file is) and to the expected set in
`tests/schema/test_public_api.py`.

Run: `uv run pytest tests/schema/test_public_api.py tests/guards -q`

- [ ] **Step 6: Commit**

```bash
git add packages/code-schema/src/code_schema/providers.py packages/code-schema/src/code_schema/__init__.py tests/schema/test_providers.py tests/schema/test_public_api.py
git commit -m "feat(schema): providers.yaml, the allow-list a resource cites"
```

---

### Task 2: Resources in node.yaml

**Files:**
- Create: `packages/code-schema/src/code_schema/resources.py`
- Create: `tests/schema/test_resources.py`
- Modify: `packages/code-schema/src/code_schema/fields.py` (add `https_url`, `timestamp_range`)
- Modify: `tests/schema/test_fields.py`

**Interfaces:**
- Consumes: task 1's `Provider`.
- Produces:
  ```python
  RESOURCE_FIELD = "resources"
  KINDS = ("video", "reading", "tutorial", "exercise")
  DISPLAYS = ("embed", "link")

  @dataclass(frozen=True)
  class Resource:
      kind: str
      provider: str
      url: str
      covers: str
      licence: str
      display: str
      level: Level
      part: str = ""

  def parse_resources(
      value: object,
      *,
      providers: dict[str, Provider] | None,
      lines: Lines,
      file: str,
  ) -> tuple[tuple[Resource, ...], list[Problem]]
  ```
  `providers=None` means no registry was read: skip the three registry rules (provider known,
  licence listed, embed allowed) and check everything else. Task 6 reports the missing file once.

- [ ] **Step 1: Write the failing tests**

```python
# tests/schema/test_resources.py
"""A node's outside resources (spec M3P1.2)."""

from code_schema.providers import Provider
from code_schema.resources import parse_resources
from code_schema.yaml_lines import load_mapping

PROVIDERS = {
    "khan-academy": Provider("khan-academy", "Khan Academy", ("YouTube embed",), embed=True),
    "openstax": Provider("openstax", "OpenStax", ("CC BY 4.0",), embed=False),
}

VIDEO = """resources:
  - kind: video
    provider: khan-academy
    url: https://www.youtube.com/watch?v=abc
    part: 2:10–7:45
    covers: Why overlapping reads are assembled through their k-mers.
    licence: YouTube embed
    display: embed
    level: introductory
"""


def parse(text: str):
    data, lines, problems = load_mapping(text, file="node.yaml")
    assert data is not None and problems == []
    return parse_resources(data["resources"], providers=PROVIDERS, lines=lines, file="node.yaml")


def test_a_video_resource_is_read() -> None:
    resources, problems = parse(VIDEO)
    assert problems == []
    assert resources[0].provider == "khan-academy"
    assert resources[0].part == "2:10–7:45"
    assert resources[0].display == "embed"


def test_an_unknown_provider_suggests_the_closest() -> None:
    _, problems = parse(VIDEO.replace("khan-academy", "khan-acadmy"))
    assert problems[0].field == "resources"
    assert problems[0].message == (
        "khan-acadmy is not a provider in providers.yaml — did you mean khan-academy?"
    )


def test_a_licence_the_provider_does_not_list_is_a_problem() -> None:
    _, problems = parse(VIDEO.replace("licence: YouTube embed", "licence: CC BY-NC-SA"))
    assert problems[0].message == (
        "the resource from Khan Academy carries CC BY-NC-SA, which Khan Academy does not list"
    )


def test_an_embed_a_provider_does_not_allow_is_a_problem() -> None:
    text = VIDEO.replace("khan-academy", "openstax").replace("YouTube embed", "CC BY 4.0")
    _, problems = parse(text)
    assert problems[0].message == (
        "the resource from OpenStax asks for an embed it does not allow — use display: link"
    )


def test_a_reversed_timestamp_range_is_a_problem() -> None:
    _, problems = parse(VIDEO.replace("2:10–7:45", "7:45–2:10"))
    assert problems[0].message == "the part 7:45–2:10 ends before it starts"


def test_a_section_part_is_fine_on_a_reading() -> None:
    text = VIDEO.replace("kind: video", "kind: reading").replace("part: 2:10–7:45", "part: §17.1")
    text = text.replace("khan-academy", "openstax").replace("YouTube embed", "CC BY 4.0")
    text = text.replace("display: embed", "display: link")
    resources, problems = parse(text)
    assert problems == [] and resources[0].part == "§17.1"


def test_the_same_url_twice_in_one_node_is_a_problem() -> None:
    _, problems = parse(VIDEO + VIDEO.split("\n", 1)[1])
    assert problems[0].message.endswith("is cited twice in this node")


def test_an_unknown_key_is_a_problem() -> None:
    _, problems = parse(VIDEO + "    note: hello\n")
    assert problems[0].message.startswith("unknown key `note` in a resource")


def test_every_required_field_is_named_when_missing() -> None:
    _, problems = parse("resources:\n  - kind: video\n")
    assert [problem.message for problem in problems] == [
        "a resource has no provider",
        "a resource has no url",
        "a resource has no covers",
        "a resource has no licence",
        "a resource has no display",
        "a resource has no level",
    ]


def test_a_url_must_be_https() -> None:
    _, problems = parse(VIDEO.replace("https://", "http://"))
    assert problems[0].message == "the url must start with https://"


def test_without_a_registry_the_other_rules_still_run() -> None:
    data, lines, _ = load_mapping(VIDEO.replace("https://", "ftp://"), file="node.yaml")
    assert data is not None
    _, problems = parse_resources(data["resources"], providers=None, lines=lines, file="node.yaml")
    assert [problem.message for problem in problems] == ["the url must start with https://"]
```

- [ ] **Step 2: Run them and watch them fail**

Run: `uv run pytest tests/schema/test_resources.py -q`

- [ ] **Step 3: Add the two field checks**

In `fields.py`, beside the existing ones:

```python
_URL = re.compile(r"^https://[^\s<>\"]+$")
_TIMESTAMP = re.compile(r"^(\d{1,2}:)?\d{1,2}:\d{2}$")


def https_url() -> Check:
    def check(value: object) -> str | None:
        if not isinstance(value, str) or not value.strip():
            return f"{shown(value)} is not a url"
        if not value.startswith("https://"):
            return "the url must start with https://"
        if not _URL.match(value):
            return f"{shown(value)} is not a url"
        return None

    return check


def seconds(stamp: str) -> int | None:
    """`7:45` or `1:07:45` as seconds; None when it is not a timestamp."""
    if not _TIMESTAMP.match(stamp):
        return None
    parts = [int(part) for part in stamp.split(":")]
    while len(parts) < 3:
        parts.insert(0, 0)
    return parts[0] * 3600 + parts[1] * 60 + parts[2]
```

Add a test per branch to `tests/schema/test_fields.py`, following the file's existing style.

- [ ] **Step 4: Write `resources.py`**

One entry parser, the shape `parse_links` uses: closed keys, required keys reported by name,
then the per-field checks, then the registry rules, then the across-the-list rule (duplicate url).
The dash-separated range accepts an en dash or a hyphen: `part.replace("-", "–").split("–")`.

Registry rules, only when `providers is not None`:

```python
provider = providers.get(identifier)
if provider is None:
    message = f"{identifier} is not a provider in {REGISTRY}"
    if close := difflib.get_close_matches(identifier, sorted(providers), n=1):
        message += f" — did you mean {close[0]}?"
    problems.append(problem(message, line_of("provider")))
elif licence not in provider.licences:
    problems.append(problem(
        f"the resource from {provider.name} carries {licence}, "
        f"which {provider.name} does not list", line_of("licence")))
if provider is not None and display == "embed" and not provider.embed:
    problems.append(problem(
        f"the resource from {provider.name} asks for an embed it does not allow "
        "— use display: link", line_of("display")))
```

- [ ] **Step 5: Run the tests**

Run: `uv run pytest tests/schema/test_resources.py tests/schema/test_fields.py -q`

- [ ] **Step 6: Commit**

```bash
git add packages/code-schema/src/code_schema/resources.py packages/code-schema/src/code_schema/fields.py tests/schema/test_resources.py tests/schema/test_fields.py
git commit -m "feat(schema): a node's resources, checked against the registry"
```

---

### Task 3: Try questions in node.yaml

**Files:**
- Create: `packages/code-schema/src/code_schema/questions.py`
- Create: `tests/schema/test_questions.py`

**Interfaces:**
- Produces:
  ```python
  TRY_FIELD = "try"
  KINDS = ("choice", "number")

  @dataclass(frozen=True)
  class Option:
      text: str
      right: bool = False

  @dataclass(frozen=True)
  class Question:
      id: str
      kind: str
      ask: str
      hints: tuple[str, ...]
      rationale: str
      options: tuple[Option, ...] = ()
      answer: float | int | None = None
      unit: str = ""
      tolerance: float | int | None = None

  def parse_questions(
      value: object, *, lines: Lines, file: str
  ) -> tuple[tuple[Question, ...], list[Problem]]
  ```

- [ ] **Step 1: Write the failing tests**

```python
# tests/schema/test_questions.py
"""A node's try questions (spec M3P1.3)."""

from code_schema.questions import parse_questions
from code_schema.yaml_lines import load_mapping

NUMBER = """try:
  - id: kmer-count
    kind: number
    ask: How many 5-mers does a 100-base read contain?
    answer: 96
    hints:
      - Every position where a window of width k still fits gives one k-mer.
    rationale: A read of length L has L − k + 1 k-mers, so 100 − 5 + 1 = 96.
"""

CHOICE = """try:
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
"""


def parse(text: str):
    data, lines, problems = load_mapping(text, file="node.yaml")
    assert data is not None and problems == []
    return parse_questions(data["try"], lines=lines, file="node.yaml")


def test_a_number_question_is_read() -> None:
    questions, problems = parse(NUMBER)
    assert problems == []
    assert questions[0].id == "kmer-count" and questions[0].answer == 96
    assert questions[0].unit == "" and questions[0].tolerance is None


def test_a_choice_question_is_read() -> None:
    questions, problems = parse(CHOICE)
    assert problems == []
    assert [option.text for option in questions[0].options] == ["An edge", "A node"]
    assert [option.right for option in questions[0].options] == [True, False]


def test_a_choice_needs_exactly_one_right_option() -> None:
    _, none = parse(CHOICE.replace("        right: true\n", ""))
    assert none[0].message == "the question node-or-edge has no right option"
    _, two = parse(CHOICE.replace("      - text: A node", "      - text: A node\n        right: true"))
    assert two[0].message == "the question node-or-edge has two right options"


def test_a_choice_needs_at_least_two_options() -> None:
    _, problems = parse(CHOICE.replace("      - text: A node\n", ""))
    assert problems[0].message == "the question node-or-edge has one option (a choice needs 2 to 5)"


def test_a_number_question_needs_an_answer() -> None:
    _, problems = parse(NUMBER.replace("    answer: 96\n", ""))
    assert problems[0].message == "the number question kmer-count has no answer"


def test_options_on_a_number_question_are_refused() -> None:
    _, problems = parse(NUMBER + "    options:\n      - text: 96\n")
    assert problems[0].message == "the number question kmer-count has options — a number question is answered with a value"


def test_a_figure_question_names_m6() -> None:
    _, problems = parse(NUMBER.replace("kind: number", "kind: figure"))
    assert problems[0].message == "a figure question arrives with figures in M6"


def test_hints_and_a_rationale_are_required() -> None:
    text = NUMBER.split("    hints:")[0]
    _, problems = parse(text)
    assert [problem.message for problem in problems] == [
        "the question kmer-count has no hints",
        "the question kmer-count has no rationale",
    ]


def test_a_hint_may_not_contain_a_number_answer() -> None:
    _, problems = parse(NUMBER.replace("gives one k-mer.", "gives one of the 96 k-mers."))
    assert problems[0].message == "a hint for kmer-count contains the answer"


def test_a_hint_may_mention_5_mers_when_the_answer_is_5() -> None:
    text = NUMBER.replace("answer: 96", "answer: 5").replace("100 − 5 + 1 = 96.", "the width is 5.")
    _, problems = parse(text)
    assert problems == []


def test_a_hint_may_not_contain_the_right_option() -> None:
    _, problems = parse(CHOICE.replace("puts in V and what it puts in E.", "puts in E: an edge."))
    assert problems[0].message == "a hint for node-or-edge contains the answer"


def test_at_most_three_hints() -> None:
    hint = "      - Another hint for this question.\n"
    _, problems = parse(NUMBER.replace("    rationale:", hint * 3 + "    rationale:"))
    assert problems[0].message == "the question kmer-count has 4 hints (at most 3)"


def test_two_questions_may_not_share_an_id() -> None:
    _, problems = parse(NUMBER + NUMBER.split("\n", 1)[1])
    assert problems[0].message == "kmer-count is asked twice in this node"
```

- [ ] **Step 2: Run them and watch them fail**

Run: `uv run pytest tests/schema/test_questions.py -q`

- [ ] **Step 3: Write `questions.py`**

The answer-in-a-hint check, exactly as the spec words it:

```python
_NOT_A_BOUNDARY = re.compile(r"[0-9A-Za-z.\-]")


def _gives_the_answer(hint: str, answer: str) -> bool:
    """The answer standing alone in a hint: digits not touching a digit, a letter or a hyphen."""
    low, needle = hint.casefold(), answer.casefold()
    start = low.find(needle)
    while start != -1:
        before = low[start - 1] if start else " "
        after = low[start + len(needle) :][:1] or " "
        if not _NOT_A_BOUNDARY.match(before) and not _NOT_A_BOUNDARY.match(after):
            return True
        start = low.find(needle, start + 1)
    return False
```

For a choice question the needle is the right option's text, and a plain case-insensitive
`in` is used — words, not numbers, so the boundary rule does not apply. A number's needle is the
answer as YAML wrote it (`str(answer)`).

- [ ] **Step 4: Run the tests**

Run: `uv run pytest tests/schema/test_questions.py -q`

- [ ] **Step 5: Commit**

```bash
git add packages/code-schema/src/code_schema/questions.py tests/schema/test_questions.py
git commit -m "feat(schema): try questions with hints and a rationale"
```

---

### Task 4: Markers in body.md

**Files:**
- Create: `packages/code-schema/src/code_schema/markers.py`
- Create: `tests/schema/test_markers.py`

**Interfaces:**
- Produces:
  ```python
  @dataclass(frozen=True)
  class Marker:
      id: str
      line: int

  def find_markers(body: str) -> tuple[tuple[Marker, ...], list[tuple[str, int]]]
  ```
  The second value is every `{% … %}` line that is **not** a try marker, as (text, line), so the
  caller words the problem with the file it belongs to.

- [ ] **Step 1: Write the failing tests**

```python
# tests/schema/test_markers.py
"""{% try id %} in body.md (spec M3P1.3)."""

from code_schema.markers import find_markers

BODY = """Some prose.

{% try kmer-count %}

## A heading

```yaml
{% try not-a-marker %}
```

{% figure component="kmer-window" %}
"""


def test_a_marker_is_found_with_its_line() -> None:
    markers, _ = find_markers(BODY)
    assert [(marker.id, marker.line) for marker in markers] == [("kmer-count", 3)]


def test_a_marker_inside_a_fence_is_prose() -> None:
    markers, others = find_markers(BODY)
    assert "not-a-marker" not in [marker.id for marker in markers]
    assert [text for text, _ in others] == ['{% figure component="kmer-window" %}']


def test_another_marker_is_reported_with_its_line() -> None:
    _, others = find_markers(BODY)
    assert others == [('{% figure component="kmer-window" %}', 11)]


def test_a_marker_must_be_alone_on_its_line() -> None:
    markers, others = find_markers("Text {% try a %} more text.\n")
    assert markers == () and others == [("{% try a %}", 1)]


def test_an_indented_marker_still_counts() -> None:
    markers, _ = find_markers("   {% try a %}\n")
    assert [marker.id for marker in markers] == ["a"]
```

- [ ] **Step 2: Run them and watch them fail**

Run: `uv run pytest tests/schema/test_markers.py -q`

- [ ] **Step 3: Write `markers.py`**

Walk the lines, toggling a `fenced` flag on a line whose stripped form starts with ``` or ~~~.
A try marker is `^\s*\{%\s*try\s+([a-z0-9-]+)\s*%\}\s*$`; any other line holding `{%` outside a
fence goes into the second list, stripped.

- [ ] **Step 4: Run the tests**

Run: `uv run pytest tests/schema/test_markers.py -q`

- [ ] **Step 5: Commit**

```bash
git add packages/code-schema/src/code_schema/markers.py tests/schema/test_markers.py
git commit -m "feat(schema): find try markers in a body, ignoring fences"
```

---

### Task 5: Wire both into a node, and write them back

**Files:**
- Modify: `packages/code-schema/src/code_schema/node.py`
- Modify: `packages/code-schema/src/code_schema/writer.py`
- Modify: `packages/code-schema/src/code_schema/__init__.py`, `tests/schema/test_public_api.py`
- Modify: `tests/schema/test_node.py`, `tests/schema/test_writer.py`

**Interfaces:**
- Consumes: tasks 1–4.
- Produces: `Node` gains `resources: tuple[Resource, ...] = ()` and
  `questions: tuple[Question, ...] = ()`; `parse_node` and `read_node` gain
  `providers: dict[str, Provider] | None = None`.

- [ ] **Step 1: Write the failing tests**

In `tests/schema/test_node.py`:

```python
def test_a_node_carries_its_resources_and_questions() -> None:
    node, problems = parse_node(
        node_yaml() + RESOURCES + TRY, "Prose.\n\n{% try kmer-count %}\n",
        node_id="de-bruijn-graphs", regions=["sequence-analysis"], providers=PROVIDERS,
        file="de-bruijn-graphs/node.yaml",
    )
    assert problems == [] and node is not None
    assert node.resources[0].provider == "khan-academy"
    assert node.questions[0].id == "kmer-count"


def test_a_marker_with_no_question_is_a_problem() -> None:
    _, problems = parse_node(
        node_yaml(), "Prose.\n\n{% try ghost %}\n", node_id="a",
        regions=["sequence-analysis"], file="a/node.yaml",
    )
    assert [(problem.file, problem.line, problem.message) for problem in problems] == [
        ("a/body.md", 3, "{% try ghost %} names no question in node.yaml")
    ]


def test_a_question_with_no_marker_is_a_problem() -> None:
    _, problems = parse_node(
        node_yaml() + TRY, "Prose.\n", node_id="a",
        regions=["sequence-analysis"], file="a/node.yaml",
    )
    assert problems[0].message == "kmer-count has no {% try kmer-count %} in body.md"


def test_two_markers_for_one_question_is_a_problem() -> None:
    _, problems = parse_node(
        node_yaml() + TRY, "A.\n\n{% try kmer-count %}\n\nB.\n\n{% try kmer-count %}\n",
        node_id="a", regions=["sequence-analysis"], file="a/node.yaml",
    )
    assert problems[0].message == "{% try kmer-count %} appears twice in body.md"


def test_another_marker_is_refused_by_name() -> None:
    _, problems = parse_node(
        node_yaml(), 'Prose.\n\n{% figure component="x" %}\n', node_id="a",
        regions=["sequence-analysis"], file="a/node.yaml",
    )
    assert problems[0].message == (
        '{% figure component="x" %} is not read — only {% try %} markers are, until M6'
    )
```

In `tests/schema/test_writer.py`, extend the round-trip test so a node with resources and
questions is written back byte for byte, with `resources:` and `try:` after the links.

- [ ] **Step 2: Run them and watch them fail**

Run: `uv run pytest tests/schema/test_node.py tests/schema/test_writer.py -q`

- [ ] **Step 3: Implement**

- `node.py`: add `"resources"` and `"try"` to the closed field names (after `LINK_FIELDS`, so a
  near-miss suggestion still works), call `parse_resources` and `parse_questions`, then the marker
  rules against `find_markers(body)`. Marker problems carry `file=f"{folder}{BODY_FILE}"` and the
  marker's line; a question with no marker carries the `node.yaml` line of the question's `id`.
- `writer.py`: write `resources:` then `try:` after the links, each key only when non-empty, in
  the field order the spec's tables give. `Option` and `Resource` become plain dicts; leave out
  `part`, `unit` and `tolerance` when they are empty or None, so the writer never invents a field.

- [ ] **Step 4: Run the tests**

Run: `uv run pytest tests/schema -q && uv run pytest tests/guards -q`

- [ ] **Step 5: Export the new names and commit**

`Question`, `Option`, `Resource` join `__init__.py` and the public-API test.

```bash
git add packages/code-schema/src/code_schema tests/schema
git commit -m "feat(schema): resources and questions belong to a node"
```

---

### Task 6: The registry through read_content

**Files:**
- Modify: `packages/code-schema/src/code_schema/content.py`
- Modify: `tests/schema/content_helpers.py`, `tests/schema/test_content.py`

**Interfaces:**
- Produces: `Content` gains `providers: dict[str, Provider]` (empty when there is no registry);
  `read_content` reads `providers.yaml` once and passes it to every node.

- [ ] **Step 1: Write the failing tests**

```python
def test_a_resource_without_a_registry_is_a_problem(tmp_path: Path) -> None:
    root = content_root(tmp_path)
    make_node(root, "a", links=RESOURCES)
    content = read_content(root)
    assert [(problem.file, problem.message) for problem in content.problems] == [
        ("providers.yaml", "the file is missing, and a/node.yaml cites a provider")
    ]


def test_no_resources_means_the_registry_is_never_needed(tmp_path: Path) -> None:
    root = content_root(tmp_path)
    make_node(root, "a")
    assert read_content(root).problems == ()


def test_the_registry_is_read_once_and_reaches_the_nodes(tmp_path: Path) -> None:
    root = content_root(tmp_path)
    (root / "providers.yaml").write_text(PROVIDERS_YAML, encoding="utf-8")
    make_node(root, "a", links=RESOURCES)
    content = read_content(root)
    assert content.problems == ()
    assert list(content.providers) == ["khan-academy"]
```

- [ ] **Step 2: Run them and watch them fail**

Run: `uv run pytest tests/schema/test_content.py -q`

- [ ] **Step 3: Implement**

`read_content` calls `read_providers(root)` before the node walk. When it returns `None`, nodes
are parsed with `providers=None`, and afterwards — only if any parsed node has a resource — one
problem is added naming the first citing node's file, sorted by node id so the message is stable.

- [ ] **Step 4: Run the tests**

Run: `uv run pytest tests/schema -q`

- [ ] **Step 5: Commit**

```bash
git add packages/code-schema/src/code_schema/content.py tests/schema
git commit -m "feat(schema): read providers.yaml only when a resource cites one"
```

---

### Task 7: The fixtures gain content

**Files:**
- Create: `tests/fixtures/salmon/providers.yaml`
- Modify: `tests/fixtures/salmon/algorithms/de-bruijn-graphs/node.yaml` and its `body.md`
- Modify: `tests/fixtures/salmon/sequence-analysis/read-mapping/node.yaml` (one linked resource)
- Modify: `tests/schema/test_fixtures.py`

**Interfaces:**
- Consumes: tasks 1–6. Produces the content parts 5 and 6 draw.

- [ ] **Step 1: Write the failing tests**

```python
def test_de_bruijn_graphs_has_an_embedded_and_a_linked_resource() -> None:
    node = FIXTURES.nodes["de-bruijn-graphs"]
    assert [resource.display for resource in node.resources] == ["embed", "link", "link"]
    assert node.resources[0].provider == "khan-academy"


def test_de_bruijn_graphs_asks_one_question_of_each_kind() -> None:
    node = FIXTURES.nodes["de-bruijn-graphs"]
    assert [question.kind for question in node.questions] == ["number", "choice"]
    assert all(question.hints and question.rationale for question in node.questions)


def test_every_fixture_resource_cites_a_listed_provider() -> None:
    for node in FIXTURES.nodes.values():
        for resource in node.resources:
            assert resource.provider in FIXTURES.providers


def test_the_fixtures_still_hold_26_nodes_and_no_problem() -> None:
    assert len(FIXTURES.nodes) == 26 and FIXTURES.problems == ()
```

- [ ] **Step 2: Run them and watch them fail**

Run: `uv run pytest tests/schema/test_fixtures.py -q`

- [ ] **Step 3: Write the fixture content**

`providers.yaml` carries the spec's three providers, with the comment `regions.yaml` uses:
*A copy of comeni-code-content's providers.yaml: tests never read that repository (R1).*

The de Bruijn node takes the L5 board's three resources — the Khan Academy video embedded with
`part: 2:10–7:45`, the OpenStax reading, the Galaxy Training tutorial linked — and two questions,
`kmer-count` (number, answer 96) and `node-or-edge` (choice), each with hints and a rationale,
with their markers placed in `body.md` where the board draws them. `read-mapping` takes a single
linked reading.

**Check the numbers against the body:** the answer 96 must match what the prose says about a
100-base read and 5-mers, or the fixture teaches something false.

- [ ] **Step 4: Run every check**

Run: `uv run pytest tests/schema tests/weaver -q` — the route tests must be untouched.
Run: `uv run code-schema validate tests/fixtures/salmon` — exits 0.

- [ ] **Step 5: Commit**

```bash
git add tests/fixtures/salmon tests/schema/test_fixtures.py
git commit -m "feat(fixtures): resources and questions on de Bruijn graphs"
```

---

### Task 8: The index stores them

**Files:**
- Modify: `apps/api/src/code_api/content/models.py`, `apps/api/src/code_api/content/index.py`
- Create: `apps/api/src/code_api/content/migrations/0002_resources_and_questions.py`
- Modify: `apps/api/tests/test_content_index.py`

**Interfaces:**
- Produces: `Provider`, `Resource`, `Question` models; `rebuild_index` fills them; the digest
  covers `providers.yaml`.

- [ ] **Step 1: Write the failing tests**

```python
def test_a_rebuild_stores_providers_resources_and_questions(db, salmon_root) -> None:
    rebuild_index(salmon_root)
    assert Provider.objects.count() == 3
    node = Node.objects.get(id="de-bruijn-graphs")
    assert [resource.display for resource in node.resources.order_by("position")] == [
        "embed", "link", "link"
    ]
    question = node.questions.order_by("position").first()
    assert question.question_id == "kmer-count" and question.answer == 96
    assert question.hints and question.rationale


def test_a_second_rebuild_replaces_them(db, salmon_root) -> None:
    rebuild_index(salmon_root)
    rebuild_index(salmon_root)
    assert Resource.objects.filter(node_id="de-bruijn-graphs").count() == 3


def test_the_digest_covers_providers_yaml(db, tmp_path, salmon_root) -> None:
    before = rebuild_index(salmon_root).digest
    copy = copy_fixtures(tmp_path, salmon_root)
    (copy / "providers.yaml").write_text(
        (copy / "providers.yaml").read_text().replace("Khan Academy", "Khan academy")
    )
    assert rebuild_index(copy).digest != before
```

- [ ] **Step 2: Run them and watch them fail**

Run: `uv run pytest apps/api/tests/test_content_index.py -q` (Compose's Postgres must be up).

- [ ] **Step 3: Implement**

- `models.py`: `Provider(id, name, position)`; `Resource(node FK, position, kind, provider FK,
  url, part, covers, licence, display, level)`; `Question(node FK, position, question_id, kind,
  ask, options JSON, answer, unit, tolerance, hints JSON, rationale)`. `answer` and `tolerance` are
  `FloatField(null=True)`; `part` and `unit` are `TextField(blank=True)`. Strings stay `TextField`:
  the validator owns every length rule (M1P5.4).
- `index.py`: `_provider_rows`, `_resource_rows`, `_question_rows`, inserted in the same
  transaction and deleted in the same wholesale sweep; add `providers.yaml` to `content_digest`'s
  file list beside `regions.yaml`.
- Migration: `uv run python apps/api/manage.py makemigrations content --name resources_and_questions`.

- [ ] **Step 4: Run the tests**

Run: `uv run pytest apps/api/tests/test_content_index.py apps/api/tests/test_rebuild_command.py -q`

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/code_api/content apps/api/tests/test_content_index.py
git commit -m "feat(api): the index stores providers, resources and questions"
```

---

### Task 9: The node endpoint returns them

**Files:**
- Modify: `apps/api/src/code_api/content/api.py`
- Modify: `apps/api/tests/test_nodes_api.py`, `apps/api/tests/test_openapi_and_docs.py`
- Regenerate: `apps/api/openapi.json`, `apps/web/src/api/schema.ts`

**Interfaces:**
- Consumes: task 8's models. Produces `ProviderOut`, `ResourceOut`, `QuestionOut`; `NodeOut` gains
  `resources` and `questions`.

- [ ] **Step 1: Write the failing tests**

```python
def test_a_node_returns_its_resources_in_the_authors_order(client, indexed) -> None:
    body = client.get("/api/nodes/de-bruijn-graphs").json()
    assert [resource["display"] for resource in body["resources"]] == ["embed", "link", "link"]
    assert body["resources"][0]["provider"] == {"id": "khan-academy", "name": "Khan Academy"}
    assert body["resources"][0]["part"] == "2:10–7:45"


def test_a_node_returns_its_questions_with_hints_and_a_rationale(client, indexed) -> None:
    question = client.get("/api/nodes/de-bruijn-graphs").json()["questions"][0]
    assert question["id"] == "kmer-count" and question["kind"] == "number"
    assert question["answer"] == 96 and question["options"] is None
    assert len(question["hints"]) >= 1 and question["rationale"]


def test_a_node_with_no_resources_returns_empty_lists(client, indexed) -> None:
    body = client.get("/api/nodes/dna-and-genes").json()
    assert body["resources"] == [] and body["questions"] == []


def test_the_node_endpoint_takes_five_queries(client, indexed, django_assert_num_queries) -> None:
    with django_assert_num_queries(5):
        client.get("/api/nodes/de-bruijn-graphs")
```

- [ ] **Step 2: Run them and watch them fail**

Run: `uv run pytest apps/api/tests/test_nodes_api.py -q`

- [ ] **Step 3: Implement**

Two `select_related("provider")`/`order_by("position")` queries beside the three the endpoint
already makes. On `QuestionOut`, the comment the spec asks for:

```python
class QuestionOut(Schema):
    """A try question, answer included: it is formative, and the page checks it (M3P1.4).

    Exam questions (T7.1) are scored, and their answers never leave the server.
    """
```

- [ ] **Step 4: Regenerate the schemas and run everything**

```bash
uv run python apps/api/manage.py export_openapi > apps/api/openapi.json   # the command the repo uses
cd apps/web && npm run api-types && npm run test && npm run typecheck
```

Run: `uv run pytest apps/api/tests -q`

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/code_api/content/api.py apps/api/openapi.json apps/api/tests apps/web/src/api/schema.ts
git commit -m "feat(api): a node returns its resources and its questions"
```

---

### Task 10: The whole command set, the stack, and the write-up

**Files:**
- Modify: `CLAUDE.md` (layout: the new modules; commands if any changed)
- Create: `docs/notes/journal/2026-09-20-m3-part-1-resources-and-questions.md`
- Modify: `docs/notes/journal/README.md` (box and table)

- [ ] **Step 1: Run every check**

```bash
uv run ruff check . && uv run ruff format --check . && uv run mypy && uv run pytest
cd apps/web && npm run lint && npm run test && npm run typecheck
docker compose up -d --wait --build && ops/stack-check.sh
curl -s "http://127.0.0.1:8090/api/nodes/de-bruijn-graphs" | head -c 400
```

`--build` is not optional: without it Compose serves the previous image (M2 part 4's trap).

- [ ] **Step 2: Write the journal entry**

Where things stand, with a command per claim; what changed, with hashes; the decisions and what
they rejected; what is next (part 2, search); open questions; traps. Include **the content
repository change** — `providers.yaml` has to be added there before a real node cites a provider —
as a question for the operator, not something done.

- [ ] **Step 3: Open the pull request**

```bash
git push -u origin m3-part-1-resources-and-questions
gh pr create --title "M3 part 1: resources and try questions" --body "…"
gh pr checks <n> --watch; echo $? > scratchpad/checks<n>.rc
```

Merge only when that file holds 0.
