# M4.8c — Exam questions as the board draws them: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Grow the exam question to the QuestionBuilder board's M4 scope — a title, a free-text claim and a stem of page blocks (with a new `sequence` block), sequence and order answers (order with partial credit by pairs), wrong options marked `plain` on purpose — through code-schema, the index, the API and the learner's try card.

**Architecture:** code-schema owns the format: one answer reader for both pools gains two kinds, the exam reader reads `title`, `claim` and a MyST `stem` with the body's own block reader, and grading becomes a score from 0 to 1. The index stores the new fields by one migration; the API sends a draft's exam questions with their stem as blocks and a state derived from the live index; the learner's try card gains a text field and an ordered list.

**Tech Stack:** Python 3.14 (code-schema, pure), Django + Django Ninja (apps/api), PostgreSQL 18, React 19 + TypeScript 7 + vitest (apps/web), Node 24 under podman.

**Spec:** `docs/superpowers/specs/2026-10-09-m4-exam-questions-design.md` (M4Q.1–M4Q.7). Its parent decisions: the archived M4.2 spec `docs/superpowers/specs/archive/2026-10-05-m4-exam-pools-design.md` (M4E.1–M4E.8).

## Global Constraints

- **code-schema stays pure**: no Django, HTTP client or model library (`tests/guards/`); its purity allowlist has no `functools`.
- **Every new code is declared in `packages/code-schema/src/code_schema/diagnostics.yml`** (`emitted_by`, `concern`, `says`, `refuses`, `fix`, `explanation`), named by a test (`tests/repo/test_diagnostic_ownership.py`), and the reference regenerated: `uv run code-schema diagnostics --write docs/reference/diagnostics.md`.
- **Codes:** shared questions CS0330–CS0337; blocks CS0416–CS0418; exam pools CS0815–CS0822. Existing codes keep their numbers and messages, except CS0305 and CS0012's kind list, which gain `sequence, order`.
- **The writer is canonical and round-trips byte for byte**; a stem is written as a YAML literal block (`stem: |`).
- **Exam choice: 3 to 5 options; try choice: 2 to 5. Order: 3 to 8 steps.** Options and steps distinct (compared case-folded, spaces trimmed).
- **Sequence matching**: case and all whitespace ignored unless `exact: true` (then only surrounding whitespace is trimmed); `accept` lists other right forms.
- **Order grading**: the share of step pairs in the right relative order; *A B D C* = 5/6, *B C D A* = 3/6, *D C B A* = 0. An order is **given as the step texts in the learner's order**, never as indexes.
- **A question's state is never stored**: `approved` when identical to the live index's question with that id, else `draft`.
- **Learner endpoints still send no exam pool** (M4E.5).
- **Tests never read the real content repository**; fixtures live in `tests/fixtures/salmon/`.
- **Run checks with exit codes, never through a pipe.** Python with CI's `env:` before any push (`CODE_ALLOWED_HOSTS=localhost`, `CODE_DEBUG=false`, Postgres :5433, Redis :6380). Web commands run as `podman run --rm --userns=keep-id -v "$PWD":/w:Z -w /w/apps/web node:24-alpine <cmd>` from the repository root.
- **Colours only from tokens; no free HTML** in rendered blocks.
- **Commits** `feat(schema)`, `feat(api)`, `feat(web)`, `docs: …`, ending `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **A stem's problem points at the right line of `exam.yaml`**: a stem's block problem (an unclosed `:::`, a callout in it) is reported at the stem's own line plus its offset, not at line 1 or `body.md`. Pinned in Task 3.
2. **An order given with a missing, repeated or extra step** is refused as not an answer (`NotAnAnswer`), never scored as partly right. Pinned in Task 1.
3. **A question whose id changed** reads as `draft`, and one deleted from the live pool simply is not listed: state compares by id, then by content. Pinned in Task 5.
4. **A sequence answer with only spaces, or `accept: [""]`**, is refused, so an empty typed answer can never be right. Pinned in Task 1.
5. **The learner page meets a block kind it does not draw** (`sequence` before this part, or a later one): it draws nothing for it rather than treating it as a try. Pinned in Task 7.

---

## File structure

**code-schema** (`packages/code-schema/src/code_schema/`)
- `questions.py` — modify: `SequenceAnswer`, `OrderAnswer`, `Option.plain`, `read_answer` for four kinds, distinct options, `read_head(…, ask=)`.
- `grading.py` — modify: `score()`; `is_right()` becomes `score(...) == 1.0`.
- `blocks.py` — modify: `SequenceBlock`, `:::{sequence}`, its codes, `write_blocks`, `block_json`.
- `exam.py` — modify: `ExamQuestion(title, claim, stem)`, its `blocks`, the stem's checks, the exam's option rules.
- `edits.py` — modify: `_check_lines` reads a block's text whatever its kind.
- `writer.py` — modify: answers of the new kinds, `plain`, an exam question's new fields, literal stems.
- `__init__.py` — modify: export `SequenceAnswer`, `OrderAnswer`, `SequenceBlock`, `score`.
- `diagnostics.yml` — modify: CS0330–CS0337, CS0416–CS0418, CS0815–CS0822; CS0305's summary.

**Fixtures and tests**
- `tests/fixtures/salmon/transcriptomics/tpm/exam.yaml` — rewrite to the new shape; add a sequence and an order question.
- `tests/schema/test_answers.py` — create: the new answer kinds and option rules.
- `tests/schema/test_grading.py`, `test_blocks.py`, `test_exam.py`, `test_writer.py`, `test_edits.py`, `test_node.py`, `test_questions.py`, `content_helpers.py` — modify.

**API** (`apps/api/src/code_api/`)
- `content/models.py`, `content/migrations/0009_exam_questions_as_the_board.py` — the new columns.
- `content/index.py`, `content/snapshot.py` — write and read them.
- `content/schemas.py`, `content/reads.py` — `SequenceBlockOut`; `QuestionOut` for the new kinds.
- `studio/schemas.py` — `StudioOptionOut.plain`, the new answer fields, `StudioExamQuestionOut` (`title`, `claim`, `stem`, `stem_text`, `state`), `node_out(node, live)`, `review_question_out`.
- `studio/api.py` — `OptionIn.plain`, `AnswerIn` for four kinds, `ExamQuestionIn`, `BlockIn` for `sequence`, `draft_out` with the live pool.
- `apps/api/openapi.json` — regenerated.
- Tests: `apps/api/tests/test_content_index.py`, `test_draft_edits.py`, `test_drafts.py`, `test_review_answers.py`, `test_review_api.py`, `test_migrations.py`.

**Web** (`apps/web/src/`)
- `api/schema.ts` — regenerated.
- `node/grading.ts` (create), `node/grading.test.ts` (create) — the shared rule.
- `node/SequenceAnswer.tsx`, `node/OrderAnswer.tsx` (create) — the two controls.
- `node/TryQuestion.tsx` — modify: uses `grading.ts` and the two controls.
- `node/SequenceBlock.tsx` (create), `node/body.ts`, `node/Body.tsx` — the sequence block.
- `studio/workbench/BlockEditor.tsx`, `Outline.tsx`, `TryEditor.tsx`, `ExamPoolTab.tsx`, `question.ts` — the workbench meets the new shapes.

---

### Task 1: Sequence and order answers, plain options, and a score

**Files:**
- Modify: `packages/code-schema/src/code_schema/questions.py`
- Modify: `packages/code-schema/src/code_schema/grading.py`
- Modify: `packages/code-schema/src/code_schema/writer.py` (`_option`, `_answer`)
- Modify: `packages/code-schema/src/code_schema/__init__.py`
- Modify: `packages/code-schema/src/code_schema/diagnostics.yml` (CS0305 summary; CS0330–CS0337; CS0822)
- Create: `tests/schema/test_answers.py`
- Modify: `tests/schema/test_grading.py`, `tests/schema/test_questions.py` (the kind list)

**Interfaces:**
- Produces:
  - `SequenceAnswer(value: str, accept: tuple[str, ...] = (), exact: bool = False)`, `kind = "sequence"`
  - `OrderAnswer(steps: tuple[str, ...])`, `kind = "order"`
  - `Option(text: str, right: bool = False, misconception: str = "", plain: bool = False)`
  - `Answer = ChoiceAnswer | NumberAnswer | SequenceAnswer | OrderAnswer`
  - `KINDS = ("choice", "number", "sequence", "order")`
  - `read_head(entry: Entry, *, ask: bool = True) -> tuple[str, str] | None`
  - `OptionRules(keys, code, noun, minimum: int = 2)`; `TRY_OPTIONS.minimum == 2`
  - `grading.score(answer: Answer, given: object) -> float`; `grading.is_right(answer, given) -> bool`

- [x] **Step 1: Write the failing tests** — `tests/schema/test_answers.py`:

```python
"""The answer kinds both pools share (M4.8c spec, M4Q.3): sequence and order, distinct options."""

from typing import Any

from code_schema.problems import Problem
from code_schema.questions import OrderAnswer, SequenceAnswer, parse_questions
from code_schema.yaml_lines import load_mapping

HEAD = """try:
  - id: spell-it
    ask: What does the path spell?
"""
TAIL = """    hints:
      - Read one letter per edge.
    rationale: Each edge adds the last letter of its k-mer.
"""


def parse(text: str) -> Any:
    data, lines, problems = load_mapping(text, file="node.yaml")
    assert data is not None and problems == []
    return parse_questions(data["try"], lines=lines, file="node.yaml")


def codes(problems: list[Problem]) -> list[str | None]:
    return [problem.code for problem in problems]


def sequence(extra: str = "    answer: ACGTTGA\n") -> str:
    return HEAD + "    kind: sequence\n" + extra + TAIL


def order(steps: list[str]) -> str:
    written = "".join(f"      - {step}\n" for step in steps)
    return HEAD + "    kind: order\n    steps:\n" + written + TAIL


def test_a_sequence_question_is_read() -> None:
    questions, problems = parse(sequence("    answer: ACGTTGA\n    accept:\n      - ACGTTGA*\n"))
    assert problems == []
    assert questions[0].answer == SequenceAnswer(value="ACGTTGA", accept=("ACGTTGA*",))


def test_a_sequence_may_be_exact() -> None:
    questions, problems = parse(sequence("    answer: FASTQ\n    exact: true\n"))
    assert problems == []
    assert questions[0].answer == SequenceAnswer(value="FASTQ", exact=True)


def test_a_sequence_needs_an_answer() -> None:
    _, problems = parse(sequence(""))
    assert codes(problems) == ["CS0330"]


def test_a_sequence_answer_of_spaces_is_refused() -> None:
    _, problems = parse(sequence('    answer: "   "\n'))
    assert codes(problems) == ["CS0330"]


def test_an_accept_entry_must_be_text() -> None:
    _, problems = parse(sequence('    answer: ACGT\n    accept:\n      - ""\n'))
    assert codes(problems) == ["CS0331"]


def test_exact_is_true_or_false() -> None:
    _, problems = parse(sequence("    answer: ACGT\n    exact: maybe\n"))
    assert codes(problems) == ["CS0332"]


def test_an_order_question_is_read() -> None:
    questions, problems = parse(order(["Cut reads into k-mers", "Build the graph", "Walk paths"]))
    assert problems == []
    assert questions[0].answer == OrderAnswer(
        steps=("Cut reads into k-mers", "Build the graph", "Walk paths")
    )


def test_an_order_needs_steps() -> None:
    _, problems = parse(HEAD + "    kind: order\n" + TAIL)
    assert codes(problems) == ["CS0333"]


def test_an_order_holds_three_to_eight_steps() -> None:
    _, two = parse(order(["One", "Two"]))
    _, nine = parse(order([f"Step {n}" for n in range(9)]))
    assert codes(two) == ["CS0334"]
    assert codes(nine) == ["CS0334"]


def test_two_steps_may_not_say_the_same() -> None:
    _, problems = parse(order(["Build the graph", "Walk paths", "build the graph "]))
    assert codes(problems) == ["CS0336"]


def test_two_options_may_not_say_the_same() -> None:
    text = (
        HEAD
        + "    kind: choice\n    options:\n      - text: An edge\n        right: true\n"
        + "      - text: an edge\n"
        + TAIL
    )
    _, problems = parse(text)
    assert codes(problems) == ["CS0335"]


def test_a_field_of_another_kind_is_refused() -> None:
    _, problems = parse(sequence("    answer: ACGT\n    steps:\n      - A\n"))
    assert codes(problems) == ["CS0337"]
    _, problems = parse(
        order(["A", "B", "C"]).replace("    steps:", "    accept:\n      - A\n    steps:")
    )
    assert codes(problems) == ["CS0337"]


def test_a_hint_may_not_give_a_sequence_answer() -> None:
    _, problems = parse(sequence().replace("Read one letter per edge.", "It spells acgttga."))
    assert codes(problems) == ["CS0319"]
```

Add to `tests/schema/test_grading.py`:

```python
from code_schema import OrderAnswer, SequenceAnswer
from code_schema.grading import score

STEPS = OrderAnswer(steps=("A", "B", "C", "D"))


def test_a_sequence_ignores_case_and_spaces() -> None:
    answer = SequenceAnswer(value="ACGTTGA")
    assert is_right(answer, "acg ttga") is True
    assert is_right(answer, "ACGTTG") is False


def test_an_exact_sequence_trims_only_its_ends() -> None:
    answer = SequenceAnswer(value="FASTQ", exact=True)
    assert is_right(answer, " FASTQ ") is True
    assert is_right(answer, "fastq") is False


def test_a_sequence_takes_an_accepted_form() -> None:
    assert is_right(SequenceAnswer(value="FASTQ", accept=("fq",)), "FQ") is True


def test_a_sequence_is_answered_with_text() -> None:
    with pytest.raises(NotAnAnswer, match="^a sequence question is answered with text$"):
        score(SequenceAnswer(value="A"), 1)


@pytest.mark.parametrize(
    ("given", "expected"),
    [
        (["A", "B", "C", "D"], 1.0),
        (["A", "B", "D", "C"], 5 / 6),
        (["B", "C", "D", "A"], 3 / 6),
        (["D", "C", "B", "A"], 0.0),
    ],
)
def test_an_order_scores_the_pairs_in_order(given: list[str], expected: float) -> None:
    assert score(STEPS, given) == pytest.approx(expected)


@pytest.mark.parametrize(
    "given",
    [["A", "B", "C"], ["A", "B", "C", "C"], ["A", "B", "C", "E"], "ABCD", [0, 1, 2, 3], None],
)
def test_an_order_is_given_every_step_once(given: object) -> None:
    with pytest.raises(NotAnAnswer, match="^an order is answered with every step, once each$"):
        score(STEPS, given)


def test_only_a_full_order_is_right() -> None:
    assert is_right(STEPS, ["A", "B", "D", "C"]) is False
    assert is_right(STEPS, ["A", "B", "C", "D"]) is True
```

In `tests/schema/test_questions.py`, `test_another_kind_lists_the_two` becomes:

```python
def test_another_kind_lists_the_four() -> None:
    _, problems = parse(NUMBER.replace("kind: number", "kind: essay"))
    assert messages(problems) == [
        '"essay" is not a kind of question (choice, number, sequence, order)'
    ]
    assert codes(problems) == ["CS0012"]
```

- [x] **Step 2: Run them to see them fail**

Run: `uv run pytest tests/schema/test_answers.py tests/schema/test_grading.py tests/schema/test_questions.py -q`
Expected: FAIL — `ImportError: cannot import name 'OrderAnswer'`.

- [x] **Step 3: Implement the answers** in `questions.py`:

```python
KINDS = ("choice", "number", "sequence", "order")
STEPS = (3, 8)
_FIELDS: dict[str, tuple[str, ...]] = {
    "choice": ("options",),
    "number": ("answer", "unit", "tolerance"),
    "sequence": ("answer", "accept", "exact"),
    "order": ("steps",),
}
# The refusals M3 already pinned, kept in their words; any other field of another kind is CS0337.
_PINNED = {
    ("choice", "answer"): "CS0308",
    ("number", "options"): "CS0310",
    ("choice", "unit"): "CS0313",
    ("choice", "tolerance"): "CS0314",
}
_step = one_line(max_len=120)
_accepted = one_line(max_len=200)


@dataclass(frozen=True)
class OptionRules:
    keys: tuple[str, ...]
    code: str
    noun: str
    minimum: int = 2  # an exam's choice needs three (M4Q.3)


@dataclass(frozen=True)
class Option:
    text: str
    right: bool = False
    misconception: str = ""  # an exam option's link to a misconception callout (M4E.1)
    plain: bool = False  # an exam option wrong on purpose, naming no misconception (M4Q.3)


@dataclass(frozen=True)
class SequenceAnswer:
    """Answered by typing: case and spaces ignored unless `exact`; any accepted form is right."""

    kind: ClassVar[str] = "sequence"
    value: str
    accept: tuple[str, ...] = ()
    exact: bool = False


@dataclass(frozen=True)
class OrderAnswer:
    """Answered by putting the steps in order; written in the right one (M4Q.3)."""

    kind: ClassVar[str] = "order"
    steps: tuple[str, ...]


Answer = ChoiceAnswer | NumberAnswer | SequenceAnswer | OrderAnswer


def _same(texts: Sequence[str]) -> bool:
    """Whether two texts read the same, case and surrounding spaces aside."""
    seen = [text.strip().casefold() for text in texts]
    return len(set(seen)) < len(seen)
```

(`from collections.abc import Sequence` joins the imports.)

In `_parse_options`, after `misconception` is read, read `plain` when the rules allow it, and after the right-count checks refuse repeated texts:

```text
        plain = item.get("plain", False)
        if "plain" in rules.keys and not isinstance(plain, bool):
            option.problem("CS0822", f"{shown(plain)} is not true or false", key="plain")
            sound = False
            continue
        sound = sound and option.sound
        options.append(
            Option(
                text=str(text), right=right, misconception=str(misconception), plain=plain is True
            )
        )
```

```text
    if _same([option.text for option in options]):
        field.problem("CS0335", f"two options of {question} say the same thing")
        return (), False
    return tuple(options), True
```

Replace the per-kind body of `read_answer` (from `if kind == "choice":` to the final `return NumberAnswer(...)`) with:

```text
    for other in KINDS:
        if other == kind:
            continue
        for key in _FIELDS[other]:
            if key in written and key not in _FIELDS[kind]:
                code = _PINNED.get((kind, key), "CS0337")
                entry.problem(code, _foreign(kind, name, key), key=key)
    if kind == "choice":
        if entry.require("options", "CS0309", f"the choice question {name} has no options"):
            options, ok = _parse_options(
                written["options"], question=name, field=field, rules=rules
            )
            entry.sound = entry.sound and ok
    elif kind == "number":
        if entry.require("answer", "CS0311", f"the number question {name} has no answer"):
            if _is_number(given := written["answer"]):
                value = given
            else:
                entry.problem("CS0312", f"the answer of {name} is not a number", key="answer")
        if "unit" in written:
            entry.check("unit", _unit, prefix=f"the unit of {name} ")
        tolerance = written.get("tolerance")
        if "tolerance" in written and (not _is_number(tolerance) or float(str(tolerance)) < 0):
            entry.problem(
                "CS0315", f"the tolerance of {name} is not a number of 0 or more", key="tolerance"
            )
    elif kind == "sequence":
        text_answer = _read_sequence(entry, name)
    else:
        steps = _read_steps(entry, name)

    if _refusals(field) > before:
        return None
    match kind:
        case "choice":
            return ChoiceAnswer(options=options)
        case "number":
            assert value is not None  # CS0311 and CS0312 refuse the rest
            tolerance = written.get("tolerance")
            return NumberAnswer(
                value=value,
                unit=str(written.get("unit", "")),
                tolerance=tolerance if _is_number(tolerance) else None,
            )
        case "sequence":
            assert text_answer is not None
            return text_answer
        case _:
            return OrderAnswer(steps=steps)
```

Initialise `text_answer: SequenceAnswer | None = None` and `steps: tuple[str, ...] = ()` beside `options` and `value`. The message helper and the two readers:

```python
_SAYS = {
    "choice": "picking one of its options",
    "number": "a value, with its unit and tolerance",
    "sequence": "typed text, with what else it accepts",
    "order": "its steps in order",
}


def _foreign(kind: str, name: str, key: str) -> str:
    """M3's sentences for the pinned cases, one sentence for the rest."""
    pinned = {
        ("choice", "answer"): f"the choice question {name} has an answer "
        "— a choice is answered by its options",
        ("number", "options"): f"the number question {name} has options "
        "— a number question is answered with a value",
        ("choice", "unit"): f"the choice question {name} has a unit",
        ("choice", "tolerance"): f"the choice question {name} has a tolerance",
    }
    return pinned.get(
        (kind, key), f"the {kind} question {name} has `{key}` — it is answered by {_SAYS[kind]}"
    )


def _read_sequence(entry: Entry, name: str) -> SequenceAnswer | None:
    written = entry.mapping
    given = written.get("answer")
    if not isinstance(given, str) or not given.strip():
        entry.problem("CS0330", f"the sequence question {name} has no answer", key="answer")
        return None
    entry.check("answer", _accepted, prefix=f"the answer of {name} ")
    accept = written.get("accept", [])
    if not isinstance(accept, list) or any(
        not isinstance(form, str) or not form.strip() for form in accept
    ):
        entry.problem(
            "CS0331", f"the accepted answers of {name} must be a list of text", key="accept"
        )
        return None
    exact = written.get("exact", False)
    if not isinstance(exact, bool):
        entry.problem("CS0332", f"{shown(exact)} is not true or false", key="exact")
        return None
    return SequenceAnswer(value=given, accept=tuple(accept), exact=exact)


def _read_steps(entry: Entry, name: str) -> tuple[str, ...]:
    written = entry.mapping
    steps = written.get("steps")
    if not isinstance(steps, list) or any(not isinstance(step, str) for step in steps):
        entry.problem(
            "CS0333", f"the order question {name} has no steps, one line each", key="steps"
        )
        return ()
    if not STEPS[0] <= len(steps) <= STEPS[1]:
        entry.problem(
            "CS0334",
            f"the order question {name} has {len(steps)} steps (an order has 3 to 8)",
            key="steps",
        )
        return ()
    for step in steps:
        if (wrong := _step(step)) is not None:
            entry.problem(wrong.code, f"a step of {name} {wrong.message}", key="steps")
            return ()
    if _same(steps):
        entry.problem("CS0336", f"two steps of {name} say the same thing", key="steps")
        return ()
    return tuple(steps)
```

In `_parse_options`, the count check reads the rules' minimum:

```text
    if not rules.minimum <= count <= OPTIONS[1]:
```

and its message stays `(a choice offers 2 to 5)` for a try; the exam's own CS0818 (Task 3) speaks for three.

`read_head` takes `ask` and lists the four kinds:

```python
def read_head(entry: Entry, *, ask: bool = True) -> tuple[str, str] | None:
    ...
    if not entry.require("kind", "CS0305", f"the question {name} has no kind ({', '.join(KINDS)})"):
        return None
    ...
    if ask and entry.require("ask", "CS0307", f"the question {name} has no ask"):
        entry.check("ask", _ask, prefix=f"the question asked by {name} ")
    return name, str(kind)
```

`_KEYS` for a try gains `"accept", "exact", "steps"`. `_gives_the_answer` covers the new kinds:

```python
def _gives_the_answer(hint: str, answer: Answer) -> bool:
    match answer:
        case NumberAnswer(value=value):
            return _states_the_number(hint, str(value))
        case ChoiceAnswer(options=options):
            right = next((option.text for option in options if option.right), "")
            return right.casefold() in hint.casefold()
        case SequenceAnswer(value=value):
            return "".join(value.split()).casefold() in "".join(hint.split()).casefold()
        case OrderAnswer():
            return False
```

- [x] **Step 4: Implement the score** in `grading.py` (the module docstring adds: *a sequence by its forms; an order by the share of pairs in order (M4Q.3)*):

```python
from itertools import combinations

from code_schema.questions import Answer, ChoiceAnswer, NumberAnswer, OrderAnswer, SequenceAnswer


def _loose(text: str) -> str:
    return "".join(text.split()).casefold()


def score(answer: Answer, given: object) -> float:
    """How right `given` is, from 0 to 1: only an order scores between (M4Q.3)."""
    match answer:
        case ChoiceAnswer(options=options):
            if isinstance(given, bool) or not isinstance(given, int):
                raise NotAnAnswer("a choice is answered with an option's index")
            if not 0 <= given < len(options):
                raise NotAnAnswer(f"there is no option {given} (0 to {len(options) - 1})")
            return 1.0 if options[given].right else 0.0
        case NumberAnswer(value=value, tolerance=tolerance):
            if not _is_number(given):
                raise NotAnAnswer("a number question is answered with a finite number")
            assert isinstance(given, int | float)
            return 1.0 if abs(given - value) <= (tolerance or 0) + SLACK else 0.0
        case SequenceAnswer(value=value, accept=accept, exact=exact):
            if not isinstance(given, str):
                raise NotAnAnswer("a sequence question is answered with text")
            key = str.strip if exact else _loose
            return 1.0 if key(given) in {key(form) for form in (value, *accept)} else 0.0
        case OrderAnswer(steps=steps):
            if (
                not isinstance(given, list)
                or any(not isinstance(step, str) for step in given)
                or sorted(given) != sorted(steps)
            ):
                raise NotAnAnswer("an order is answered with every step, once each")
            place = {step: at for at, step in enumerate(given)}
            pairs = list(combinations(steps, 2))
            return sum(place[a] < place[b] for a, b in pairs) / len(pairs)
    raise AssertionError(f"an answer of no known kind: {answer!r}")


def is_right(answer: Answer, given: object) -> bool:
    """Right only when wholly right: a partly ordered answer is not (M4Q.3)."""
    return score(answer, given) == 1.0
```

- [x] **Step 5: Write the new answers** in `writer.py`:

```python
def _option(option: Option) -> dict[str, object]:
    written: dict[str, object] = {"text": option.text}
    if option.right:
        written["right"] = True
    if option.misconception:
        written["misconception"] = option.misconception
    if option.plain:
        written["plain"] = True
    return written


def _answer(answer: Answer) -> dict[str, object]:
    """The answer's fields, in the spec's order (M3P1.3, M4Q.3), whichever pool asks it."""
    match answer:
        case ChoiceAnswer(options=options):
            return {"options": [_option(option) for option in options]}
        case NumberAnswer(value=value, unit=unit, tolerance=tolerance):
            written: dict[str, object] = {"answer": value}
            if unit:
                written["unit"] = unit
            if tolerance is not None:
                written["tolerance"] = tolerance
            return written
        case SequenceAnswer(value=value, accept=accept, exact=exact):
            written = {"answer": value}
            if accept:
                written["accept"] = list(accept)
            if exact:
                written["exact"] = True
            return written
        case OrderAnswer(steps=steps):
            return {"steps": list(steps)}
```

Export `SequenceAnswer`, `OrderAnswer` (and `score` from `grading`) in `__init__.py`'s imports and `__all__`; `tests/schema/test_public_api.py` lists the public names — add them there too.

- [x] **Step 6: Declare the codes** in `diagnostics.yml` (after CS0329; CS0305's `says` becomes `a question names no kind (choice, number, sequence, order)`):

```yaml
  CS0330:
    emitted_by: schema
    concern: questions
    says: a sequence question has no answer
    refuses: true
    fix: |
      Write the answer as text under `answer:`.
    explanation: |
      A sequence question is answered by typing; without a right form nothing can be checked
      (M4.8c spec, M4Q.3).

  CS0331:
    emitted_by: schema
    concern: questions
    says: a sequence question's accepted answers are not a list of text
    refuses: true
    fix: |
      Write `accept:` as a list, one other right form per line.
    explanation: |
      Each accepted form is compared as the answer is, so an empty one would accept an empty
      answer (M4Q.3).

  CS0332:
    emitted_by: schema
    concern: questions
    says: a sequence question's exact is not true or false
    refuses: true
    fix: |
      Write `exact: true`, or leave it out to ignore case and spaces.
    explanation: |
      A sequence is matched forgivingly unless the author asks for exact (M4Q.3).

  CS0333:
    emitted_by: schema
    concern: questions
    says: an order question has no steps
    refuses: true
    fix: |
      Write the steps under `steps:`, one line each, in the right order.
    explanation: |
      The steps are written in the right order and shown shuffled (M4Q.3).

  CS0334:
    emitted_by: schema
    concern: questions
    says: an order question has fewer than 3 or more than 8 steps
    refuses: true
    fix: |
      Keep between 3 and 8 steps; split a longer process into two questions.
    explanation: |
      Two steps are a coin toss; past eight, ordering tests patience more than understanding
      (M4Q.3).

  CS0335:
    emitted_by: schema
    concern: questions
    says: two options say the same thing
    refuses: true
    fix: |
      Make every option say something different.
    explanation: |
      Distractors are distinct (tutor spec T7.1): two options that read the same make the
      question ambiguous, or one of them the right answer twice (M4Q.3).

  CS0336:
    emitted_by: schema
    concern: questions
    says: two steps of an order say the same thing
    refuses: true
    fix: |
      Make every step say something different.
    explanation: |
      Two steps that read the same leave more than one right order (M4Q.3).

  CS0337:
    emitted_by: schema
    concern: questions
    says: a question has a field of another kind
    refuses: true
    fix: |
      Keep only the fields of the question's kind, or change its kind.
    explanation: |
      Each kind is answered its own way, so a field of another kind is a question half
      rewritten (M4Q.3).
```

and in the exam band, after CS0814:

```yaml
  CS0822:
    emitted_by: schema
    concern: exam
    says: an option's plain is not true or false
    refuses: true
    fix: |
      Write `plain: true` on a wrong option that names no misconception, or leave it out.
    explanation: |
      `plain` marks a distractor wrong on purpose (M4Q.3).
```

CS0822's own test is in Task 3, where exam options read `plain`.

- [x] **Step 7: Run the tests and the schema suite**

Run: `uv run pytest tests/schema -q`
Expected: PASS. The ownership guard may name CS0822 as untested until Task 3; if `tests/repo` is run now it fails only on that — Task 3 adds its test.

- [x] **Step 8: Commit**

```bash
git add packages/code-schema tests/schema
git commit -m "feat(schema): sequence and order answers, plain options, a score — M4.8c.1"
```

---

### Task 2: The sequence block

**Files:**
- Modify: `packages/code-schema/src/code_schema/blocks.py`, `edits.py` (`_check_lines`), `__init__.py`, `diagnostics.yml` (CS0416–CS0418)
- Modify: `tests/schema/test_blocks.py`, `tests/schema/test_edits.py`

**Interfaces:**
- Produces: `SequenceBlock(letters: str)`; `Block = Text | Try | Callout | SequenceBlock`; `block_json(SequenceBlock)` → `{"kind": "sequence", "letters": …}`; `block_from_json` reads it back.

- [x] **Step 1: Write the failing tests** in `tests/schema/test_blocks.py`:

```python
from code_schema.blocks import (
    SequenceBlock,
    block_from_json,
    block_json,
    parse_blocks,
    write_blocks,
)

SEQ = "A read:\n\n:::{sequence}\nACGTTGCA GGT\n:::\n"


def test_a_sequence_block_is_read_and_written_back() -> None:
    blocks, _, problems = parse_blocks(SEQ, file="body.md")
    assert problems == []
    assert blocks[1] == SequenceBlock("ACGTTGCA GGT\n")
    assert write_blocks(blocks) == SEQ
    assert block_from_json(block_json(blocks[1])) == blocks[1]


def test_a_sequence_block_holds_letters_only() -> None:
    _, _, problems = parse_blocks(":::{sequence}\nACGT-1\n:::\n", file="body.md")
    assert [p.code for p in problems] == ["CS0416"]


def test_a_sequence_block_is_not_empty() -> None:
    _, _, problems = parse_blocks(":::{sequence}\n\n:::\n", file="body.md")
    assert [p.code for p in problems] == ["CS0417"]


def test_a_sequence_block_takes_no_title() -> None:
    _, _, problems = parse_blocks(":::{sequence} a read\nACGT\n:::\n", file="body.md")
    assert [p.code for p in problems] == ["CS0418"]
```

and in `tests/schema/test_edits.py`:

```python
def test_a_sequence_block_is_inserted() -> None:
    edited = reread(insert_block(DBG, 1, SequenceBlock(letters="ACGTTGCA\n")))
    assert SequenceBlock(letters="ACGTTGCA\n") in edited.blocks
```

- [x] **Step 2: Run them to see them fail**

Run: `uv run pytest tests/schema/test_blocks.py tests/schema/test_edits.py -q`
Expected: FAIL — `ImportError: cannot import name 'SequenceBlock'`.

- [x] **Step 3: Implement** in `blocks.py` (module docstring adds `:::{sequence}` then letters then `:::`):

```python
_LETTERS = re.compile(r"^[A-Za-z\s]*$")


@dataclass(frozen=True)
class SequenceBlock:
    """DNA, RNA or protein letters, drawn monospaced in groups of ten (M4.8c spec, M4Q.2)."""

    letters: str


Block = Text | Try | Callout | SequenceBlock


def block_text(block: Block) -> str:
    """What a block carries as text, whatever its kind: nothing for a try."""
    match block:
        case Text(markdown=markdown) | Callout(markdown=markdown):
            return markdown
        case SequenceBlock(letters=letters):
            return letters
        case Try():
            return ""
```

In `parse_blocks`, before the `if name in CALLOUTS:` branch:

```text
        if name == "sequence":
            letters = "".join(inner)
            if argument:
                problem("CS0418", ":::{sequence} takes no title", number)
            elif not letters.strip():
                problem("CS0417", "the sequence block is empty", number)
            elif not _LETTERS.match(letters):
                problem(
                    "CS0416", "a sequence block holds only letters, spaces and line breaks", number
                )
            else:
                blocks.append(SequenceBlock(letters))
                starts.append(number)
            continue
```

`write_blocks` takes its newline from `block_text` and writes the block:

```text
    carried = [block_text(block) for block in blocks]
    ...
        elif isinstance(block, SequenceBlock):
            out.append(f":::{{sequence}}{newline}{block.letters}:::{newline}")
```

`block_json` gains `case SequenceBlock(letters=letters): return {"kind": "sequence", "letters": letters}` and `block_from_json` gains `case "sequence": return SequenceBlock(stored["letters"])`. The difflib suggestion list becomes `["try", "sequence", *CALLOUTS]`.

In `edits.py`, `_check_lines` reads `block_text(block)` instead of `block.markdown` (still skipping `Try`). Export `SequenceBlock` from `__init__.py` and add it to `test_public_api.py`.

- [x] **Step 4: Declare CS0416–CS0418** in `diagnostics.yml` after CS0415, `concern: blocks`:

```yaml
  CS0416:
    emitted_by: schema
    concern: blocks
    says: a sequence block holds something other than letters
    refuses: true
    fix: |
      Keep only the letters of the sequence, with spaces or line breaks between groups.
    explanation: |
      A sequence block draws bases or residues in groups of ten; anything else belongs in text
      (M4.8c spec, M4Q.2).

  CS0417:
    emitted_by: schema
    concern: blocks
    says: a sequence block is empty
    refuses: true
    fix: |
      Write the sequence between the fences, or remove the block.
    explanation: |
      An empty sequence block draws nothing (M4Q.2).

  CS0418:
    emitted_by: schema
    concern: blocks
    says: a sequence block has a title
    refuses: true
    fix: |
      Put what the sequence is in the text before the block.
    explanation: |
      A sequence block holds letters only; the prose around it says what they are (M4Q.2).
```

- [x] **Step 5: Run the schema suite**

Run: `uv run pytest tests/schema -q`
Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add packages/code-schema tests/schema
git commit -m "feat(schema): the sequence block — M4.8c.2"
```

---

### Task 3: The exam question as the board draws it

**Files:**
- Modify: `packages/code-schema/src/code_schema/exam.py`, `writer.py` (`_exam_question`, the literal style), `diagnostics.yml` (CS0815–CS0821)
- Rewrite: `tests/fixtures/salmon/transcriptomics/tpm/exam.yaml`
- Modify: `tests/schema/test_exam.py`, `test_writer.py`, `test_edits.py`, `test_node.py`, `content_helpers.py`, `test_fixtures.py` (if it counts TPM's questions)

**Interfaces:**
- Consumes: Task 1's `read_head(entry, ask=False)`, `OptionRules(minimum=…)`, `Option.plain`; Task 2's `SequenceBlock`.
- Produces: `ExamQuestion(id: str, title: str, claim: str, stem: str, answer: Answer, level: Level | None, rationale: str)` with `.kind` and `.blocks -> tuple[Block, ...]`.

- [x] **Step 1: Rewrite the test pool's shape.** In `tests/schema/test_exam.py`, every exam question written as

```
  - id: X
    kind: K
    ask: A
```

becomes

```
  - id: X
    title: A
    kind: K
    stem: |
      A
```

(`CHOICE`, `number()`, and any inline pool), and `CHOICE`'s plain wrong option gains `        plain: true`. Do the same in `content_helpers.py` (`SMALL_POOL`), `test_writer.py`, `test_edits.py` (`QUESTION = ExamQuestion(...)` takes `title=`, `stem=` in place of `ask=`) and `test_node.py`. Then add the new tests to `test_exam.py`:

```python
STEM_POOL = """exam:
  - id: mid-read-error
    title: Which mark does a mid-read error leave?
    claim: spots a bubble left by a mid-read error
    kind: choice
    stem: |
      One read has a wrong base in its middle.

      :::{sequence}
      ACGTAGCA
      :::
    options:
      - text: A bubble
        right: true
      - text: A tip
        misconception: TPM is not a count of reads
      - text: Nothing
        plain: true
    rationale: A wrong base mid-read leaves the path and rejoins it.
"""


def pool(tmp_path: Path, exam: str) -> list[str | None]:
    """The codes reading this pool beside the TPM-like node gives (warnings included)."""
    root = content_root(tmp_path, body=BODY, extra_yaml=TRY, exam=exam)
    return [problem.code for problem in read_content(root, regions=REGIONS).problems]


def test_a_question_has_a_title_a_claim_and_a_stem(tmp_path: Path) -> None:
    root = content_root(tmp_path, body=BODY, extra_yaml=TRY, exam=STEM_POOL)
    content = read_content(root, regions=REGIONS)
    question = next(iter(content.nodes.values())).exam[0]
    assert question.title == "Which mark does a mid-read error leave?"
    assert question.claim == "spots a bubble left by a mid-read error"
    assert question.blocks[1] == SequenceBlock("ACGTAGCA\n")


def test_a_question_needs_a_title_and_a_stem(tmp_path: Path) -> None:
    assert "CS0815" in pool(
        tmp_path, STEM_POOL.replace("    title: Which mark does a mid-read error leave?\n", "")
    )
    no_stem = (
        STEM_POOL.split("    stem: |")[0] + "    options:" + STEM_POOL.split("    options:")[1]
    )
    assert "CS0816" in pool(tmp_path, no_stem)


def test_ask_is_not_an_exam_field(tmp_path: Path) -> None:
    assert "CS0806" in pool(
        tmp_path, STEM_POOL.replace("    kind: choice\n", "    kind: choice\n    ask: Old?\n")
    )


def test_a_stem_holds_no_try_or_callout(tmp_path: Path) -> None:
    called = STEM_POOL.replace(
        "      :::{sequence}\n      ACGTAGCA\n      :::\n",
        "      :::{caveat} Careful\n      Not here.\n      :::\n",
    )
    assert "CS0817" in pool(tmp_path, called)


def test_a_stem_problem_is_reported_at_its_line(tmp_path: Path) -> None:
    broken = STEM_POOL.replace("      ACGTAGCA\n      :::\n", "      ACGT-1\n      :::\n")
    root = content_root(tmp_path, body=BODY, extra_yaml=TRY, exam=broken)
    found = [p for p in read_content(root, regions=REGIONS).problems if p.code == "CS0416"]
    assert found[0].file.endswith("exam.yaml")
    assert found[0].line == 10  # the `:::{sequence}` line of exam.yaml


def test_an_exam_choice_offers_three_options(tmp_path: Path) -> None:
    two = STEM_POOL.replace("      - text: Nothing\n        plain: true\n", "")
    assert "CS0818" in pool(tmp_path, two)


def test_plain_and_a_misconception_are_one_or_the_other(tmp_path: Path) -> None:
    both = STEM_POOL.replace(
        "        misconception: TPM is not a count of reads\n",
        "        misconception: TPM is not a count of reads\n        plain: true\n",
    )
    assert "CS0819" in pool(tmp_path, both)


def test_the_right_option_is_not_plain(tmp_path: Path) -> None:
    assert "CS0820" in pool(
        tmp_path,
        STEM_POOL.replace("        right: true\n", "        right: true\n        plain: true\n"),
    )


def test_a_wrong_option_naming_nothing_is_a_warning(tmp_path: Path) -> None:
    silent = STEM_POOL.replace("        plain: true\n", "")
    root = content_root(tmp_path, body=BODY, extra_yaml=TRY, exam=silent)
    content = read_content(root, regions=REGIONS)
    assert "CS0821" in [p.code for p in content.problems]
    assert "CS0821" not in [p.code for p in content.errors]


def test_plain_is_true_or_false(tmp_path: Path) -> None:
    assert "CS0822" in pool(tmp_path, STEM_POOL.replace("plain: true", "plain: sometimes"))
```

(Import `SequenceBlock` from `code_schema.blocks`. If `content_root`'s keyword for the pool differs, use the one `content_helpers.py` defines — it already writes `exam.yaml` for `SMALL_POOL`. Count the expected line of the CS0416 test from the written pool: with `content_root` writing `STEM_POOL` verbatim, `:::{sequence}` is line 10; if the helper prepends anything, adjust the number to that line and say so in a comment.)

In `test_writer.py`, a round-trip test:

```python
def test_an_exam_stem_is_written_as_a_literal_block() -> None:
    node = read_node(FIXTURES / "transcriptomics" / "tpm", regions=REGIONS)
    written = write_exam_yaml(node)
    assert "    stem: |\n" in written
    assert written == (FIXTURES / "transcriptomics" / "tpm" / "exam.yaml").read_text()
```

(Use the names `test_writer.py` already has for the fixture root and regions.)

- [x] **Step 2: Run them to see them fail**

Run: `uv run pytest tests/schema -q`
Expected: FAIL — exam questions with `title`/`stem` refused as unknown keys (CS0806), and `ExamQuestion` has no `title`.

- [x] **Step 3: Implement** in `exam.py`:

```python
_KEYS = (
    "id",
    "title",
    "claim",
    "kind",
    "level",
    "stem",
    "options",
    "answer",
    "unit",
    "tolerance",
    "accept",
    "exact",
    "steps",
    "rationale",
)
_OPTIONS = OptionRules(
    keys=("text", "right", "misconception", "plain"),
    code="CS0808",
    noun="an exam option",
    minimum=2,  # CS0327 still speaks for 2 to 5; CS0818 asks an exam for three
)
_title = one_line(max_len=120)
_claim = one_line(max_len=200)
EXAM_OPTIONS = 3


@dataclass(frozen=True)
class ExamQuestion:
    """A question asked in a self-test (T7.1, M4Q.2). `level` is None when it is the node's own."""

    id: str
    title: str
    claim: str
    stem: str  # MyST, read by the body's block reader
    answer: Answer
    level: Level | None
    rationale: str

    @property
    def kind(self) -> str:
        return self.answer.kind

    @property
    def blocks(self) -> tuple[Block, ...]:
        """The stem read as blocks; `parse_exam` refuses a stem with any problem."""
        return parse_blocks(self.stem, file=EXAM_FILE)[0]


def _read_stem(entry: Entry, name: str, *, file: str) -> str | None:
    """The stem, its block problems moved to their lines in exam.yaml (Review Focus 1)."""
    stem = entry.mapping.get("stem")
    if not isinstance(stem, str) or not stem.strip():
        entry.problem("CS0816", f"the exam question {name} has no stem", key="stem")
        return None
    blocks, starts, problems = parse_blocks(stem, file=file)
    at = entry.at("stem") or 0  # a literal stem starts on the line after its key
    for problem in problems:
        entry.field.problems.append(replace(problem, line=(problem.line or 1) + at))
    if problems:
        entry.sound = False
        return None
    for block, start in zip(blocks, starts, strict=True):
        if isinstance(block, Try | Callout):
            entry.problem(
                "CS0817",
                f"the stem of {name} holds a {'try' if isinstance(block, Try) else 'callout'} "
                "— a stem holds text and sequences",
                line=start + at,
            )
            return None
    return stem
```

(`from dataclasses import dataclass, replace`; import `Block`, `Try`, `parse_blocks` from `code_schema.blocks`. `Entry.field`, `Entry.at(key)` and `Entry.problem(…, line=)` are `records.py`'s own.)

In the loop of `parse_exam`: `read_head(entry, ask=False)`; then

```text
        if entry.require("title", "CS0815", f"the exam question {name} has no title"):
            entry.check("title", _title, prefix=f"the title of {name} ")
        if "claim" in written:
            entry.check("claim", _claim, prefix=f"the claim of {name} ")
        stem = _read_stem(entry, name, file=file)
```

and the option checks become:

```text
        if isinstance(answer, ChoiceAnswer):
            if len(answer.options) < EXAM_OPTIONS:
                entry.problem(
                    "CS0818",
                    f"the exam question {name} has {len(answer.options)} options "
                    f"(an exam's choice offers {EXAM_OPTIONS} to 5)",
                    key="options",
                )
            written_options = written["options"]
            assert isinstance(written_options, list)
            for item, option in zip(written_options, answer.options, strict=True):
                line = lines.of(item, "plain") or lines.of(item, "misconception") or lines.of(item, "text")
                if option.plain and option.misconception:
                    entry.problem(
                        "CS0819",
                        f"an option of {name} names a misconception and says plain — one or the other",
                        line=line,
                    )
                elif option.plain and option.right:
                    entry.problem("CS0820", f"the right option of {name} says plain", line=line)
                elif option.misconception and option.right:
                    entry.problem(
                        "CS0810",
                        f"the right option of {name} names a misconception "
                        "— only a wrong option can",
                        line=lines.of(item, "misconception"),
                    )
                elif (
                    option.misconception
                    and misconceptions is not None
                    and option.misconception not in misconceptions
                ):
                    entry.problem(
                        "CS0809",
                        f"`{option.misconception}` names no misconception callout in body.md",
                        line=lines.of(item, "misconception"),
                    )
                elif not option.right and not option.plain and not option.misconception:
                    entry.flag(
                        "CS0821",
                        f"`{option.text}` in {name} names no misconception "
                        "— name one, or write plain: true",
                    )
```

The question is built with `title=str(written["title"])`, `claim=str(written.get("claim", ""))`, `stem=stem` (assert `stem is not None` beside `answer`).

In `writer.py`, multi-line strings are written as literal blocks, and the exam question in M4Q.2's order:

```python
def _literal(dumper: yaml.SafeDumper, value: str) -> yaml.ScalarNode:
    """A stem's lines as a literal block (`stem: |`); one line stays plain."""
    style = "|" if "\n" in value else None
    return dumper.represent_scalar("tag:yaml.org,2002:str", value, style=style)


_IndentedDumper.add_representer(str, _literal)


def _exam_question(question: ExamQuestion) -> dict[str, object]:
    """M4Q.2's order: a claim and a level only when written."""
    written: dict[str, object] = {"id": question.id, "title": question.title}
    if question.claim:
        written["claim"] = question.claim
    written["kind"] = question.kind
    if question.level is not None:
        written["level"] = question.level.value
    written["stem"] = question.stem
    written |= _answer(question.answer)
    written["rationale"] = question.rationale
    return written
```

- [x] **Step 4: Rewrite the fixture pool** `tests/fixtures/salmon/transcriptomics/tpm/exam.yaml` in the new shape: each question's `ask` becomes its `title` and a one-paragraph `stem: |`; *How long the transcript is* gains `plain: true`; add two questions at the end:

```yaml
  - id: tpm-steps
    title: Put TPM's steps in order
    kind: order
    stem: |
      Put the steps that turn read counts into TPM in order.
    steps:
      - Count the reads on each transcript
      - Divide each count by the transcript's effective length
      - Add up the rates across the sample
      - Scale each rate so the rates add up to a million
    rationale: Length comes first, then the total, then the scaling to a million.
  - id: tpm-unit-name
    title: What does TPM stand for?
    kind: sequence
    stem: |
      Write out what the letters TPM stand for.
    answer: transcripts per million
    accept:
      - transcripts per million mapped
    rationale: TPM counts transcripts in every million, after correcting for length.
```

Then write the file back through the writer so it is canonical: `uv run python -c "from pathlib import Path; from code_schema.node import read_node; from code_schema.writer import write_exam_yaml; ..."` — read the node with the fixtures' regions and providers as `test_writer.py` does, and write `write_exam_yaml(node)` over the file. Check `git diff` reads as intended.

- [x] **Step 5: Declare CS0815–CS0821** in `diagnostics.yml` after CS0814 (`concern: exam`; CS0821 `refuses: false`):

```yaml
  CS0815:
    emitted_by: schema
    concern: exam
    says: an exam question has no title
    refuses: true
    fix: |
      Give the question a one-line title, as Studio's list and a learner's results name it.
    explanation: |
      A stem may be long and hold blocks; the title names the question in one line (M4.8c spec,
      M4Q.2).

  CS0816:
    emitted_by: schema
    concern: exam
    says: an exam question has no stem
    refuses: true
    fix: |
      Write what the learner reads under `stem: |`.
    explanation: |
      The stem is the question as asked, built from the page's blocks (M4Q.2).

  CS0817:
    emitted_by: schema
    concern: exam
    says: a stem holds a try or a callout
    refuses: true
    fix: |
      Keep text and sequences in a stem; a misconception belongs in the body, named by an option.
    explanation: |
      A test asks one question at a time and gives no notes; callouts and try questions are the
      page's (M4Q.2).

  CS0818:
    emitted_by: schema
    concern: exam
    says: an exam choice offers fewer than 3 options
    refuses: true
    fix: |
      Add a wrong option that someone who misunderstands would pick.
    explanation: |
      With two options a learner who knows nothing scores half (M4Q.3).

  CS0819:
    emitted_by: schema
    concern: exam
    says: an option names a misconception and says plain
    refuses: true
    fix: |
      Keep the misconception, or say plain: true, not both.
    explanation: |
      `plain` says a wrong option names no misconception on purpose (M4Q.3).

  CS0820:
    emitted_by: schema
    concern: exam
    says: the right option says plain
    refuses: true
    fix: |
      Remove plain: true from the right option.
    explanation: |
      `plain` marks a wrong option; the right one is simply right (M4Q.3).

  CS0821:
    emitted_by: schema
    concern: exam
    says: a wrong option names no misconception and is not plain
    refuses: false
    fix: |
      Name the misconception callout this answer reflects, or write plain: true.
    explanation: |
      Every distractor names a misconception or is marked plain (tutor spec T7.1), so a forgotten
      one shows while a deliberate one is quiet. A warning: review decides (M4Q.3).
```

- [x] **Step 6: Regenerate the reference and run everything Python**

Run: `uv run code-schema diagnostics --write docs/reference/diagnostics.md && uv run code-schema validate tests/fixtures/salmon; echo rc=$?`
Expected: `rc=0` (warnings allowed; no errors).
Run: `uv run pytest tests -q`
Expected: PASS, including `tests/repo` (every new code named by a test).

- [x] **Step 7: Commit**

```bash
git add packages/code-schema tests docs/reference/diagnostics.md
git commit -m "feat(schema): an exam question with a title, a claim and a block stem — M4.8c.3"
```

---

### Task 4: The index holds the new fields

**Files:**
- Modify: `apps/api/src/code_api/content/models.py`
- Create: `apps/api/src/code_api/content/migrations/0009_exam_questions_as_the_board.py` (by `makemigrations`)
- Modify: `apps/api/src/code_api/content/index.py` (`_fill_answer`, `_exam_row`), `content/snapshot.py` (`_answer`, `node_from_index`)
- Modify: `apps/api/tests/test_content_index.py`, `apps/api/tests/test_migrations.py` (if it pins the latest migration)

**Interfaces:**
- Consumes: Tasks 1–3's `SequenceAnswer`, `OrderAnswer`, `Option.plain`, `ExamQuestion(title, claim, stem)`, `SequenceBlock`, `block_json`.
- Produces: `node_from_index(node_id)` returns a node whose files write back byte for byte, new kinds and stems included.

- [x] **Step 1: Write the failing test** in `test_content_index.py`:

```python
@pytest.mark.django_db
def test_every_kind_round_trips_through_the_index(built_index: object) -> None:
    """TPM's pool holds every kind; read back from the index, its files are the fixture's."""
    node = node_from_index("tpm")
    assert node is not None
    assert {question.kind for question in node.exam} == {"choice", "number", "sequence", "order"}
    fixture = Path("tests/fixtures/salmon/transcriptomics/tpm/exam.yaml").read_text()
    assert write_exam_yaml(node) == fixture
```

(Use the fixture that builds the index from `tests/fixtures/salmon` which this file's other tests use; its name is in `apps/api/tests/conftest.py`.)

- [x] **Step 2: Run it to see it fail**

Run: `uv run pytest apps/api/tests/test_content_index.py -q -k round_trips`
Expected: FAIL — `ExamQuestion() got unexpected keyword arguments: 'title'` while building rows.

- [x] **Step 3: Implement.** In `models.py`, `Question` gains

```text
    accept = models.JSONField(default=list)  # a sequence's other right forms (M4Q.3)
    exact = models.BooleanField(default=False)
    steps = models.JSONField(default=list)  # an order's steps, in the right order
```

and `ExamQuestion` gains the same three, plus `title = models.TextField(default="")`, `claim = models.TextField(blank=True, default="")`, `stem = models.JSONField(default=list)` (the stem's blocks, as `Node.blocks` stores a body), and loses `ask`. Its docstring says: *a stem of blocks, a title and a claim (M4.8c spec, M4Q.5)*. Run `uv run python apps/api/manage.py makemigrations content --name exam_questions_as_the_board`.

In `index.py`:

```python
def _fill_answer(row: Question | ExamQuestion, answer: Answer, *, exam: bool) -> None:
    """Each kind fills its own columns; a sequence's text sits in `answer`. Shared by both pools."""
    match answer:
        case ChoiceAnswer(options=options):
            row.options = [
                {"text": option.text, "right": option.right}
                | ({"misconception": option.misconception, "plain": option.plain} if exam else {})
                for option in options
            ]
        case NumberAnswer(value=value, unit=unit, tolerance=tolerance):
            row.answer, row.unit, row.tolerance = number_text(value), unit, number_text(tolerance)
        case SequenceAnswer(value=value, accept=accept, exact=exact):
            row.answer, row.accept, row.exact = value, list(accept), exact
        case OrderAnswer(steps=steps):
            row.steps = list(steps)
```

(`misconceptions=` callers become `exam=`.) `_exam_row` sets `title=question.title`, `claim=question.claim`, `stem=[block_json(block) for block in question.blocks]` in place of `ask`.

In `snapshot.py`, `_answer` takes the row and covers four kinds:

```python
def _answer(row: models.Question | models.ExamQuestion) -> Answer:
    match row.kind:
        case "choice":
            return ChoiceAnswer(
                options=tuple(
                    Option(
                        text=option["text"],
                        right=option["right"],
                        misconception=option.get("misconception", ""),
                        plain=option.get("plain", False),
                    )
                    for option in row.options
                )
            )
        case "sequence":
            assert row.answer is not None  # a sequence question always has its answer
            return SequenceAnswer(value=row.answer, accept=tuple(row.accept), exact=row.exact)
        case "order":
            return OrderAnswer(steps=tuple(row.steps))
    value = number_from(row.answer)
    assert value is not None  # a number question always has its answer
    return NumberAnswer(value=value, unit=row.unit, tolerance=number_from(row.tolerance))
```

and the exam rows are read back with `title=question.title`, `claim=question.claim`, `stem=write_blocks([block_from_json(b) for b in question.stem])`.

- [x] **Step 4: Run the API suite with CI's environment**

Run: `uv run python apps/api/manage.py makemigrations --check --dry-run && uv run pytest apps/api -q`
Expected: PASS. A test that counted TPM's pool (four questions) now counts six — update its number and say why in the test.

- [x] **Step 5: Commit**

```bash
git add apps/api
git commit -m "feat(api): the index holds titles, stems and the new answer kinds — M4.8c.4"
```

---

### Task 5: What the API sends — blocks, questions, a question's state

**Files:**
- Modify: `apps/api/src/code_api/content/schemas.py` (`SequenceBlockOut`, `BlockOut`, `QuestionOut`), `content/reads.py` (`_question`)
- Modify: `apps/api/src/code_api/studio/schemas.py` (`StudioOptionOut`, `_answer_out`, `StudioQuestionOut`, `StudioExamQuestionOut`, `_block_out`, `_exam_out`, `node_out`, `ReviewQuestionOut`, `review_question_out`)
- Modify: `apps/api/src/code_api/studio/api.py` (`draft_out`)
- Modify: `apps/api/tests/test_drafts.py`, `test_review_api.py`, `test_nodes_api.py`

**Interfaces:**
- Consumes: Task 4's index, `node_from_index`.
- Produces (JSON): `SequenceBlockOut {kind: "sequence", letters}`; `QuestionOut.answer: float | str | None`, `.accept: list[str]`, `.exact: bool`, `.steps: list[str] | None`; `StudioOptionOut.plain: bool`; `StudioQuestionOut` and `StudioExamQuestionOut` with `answer: float | int | str | None`, `accept`, `exact`, `steps`; `StudioExamQuestionOut.title`, `.claim`, `.stem: list[BlockOut]`, `.stem_text: str`, `.state: "approved" | "draft"`; `node_out(node: Node, live: Mapping[str, ExamQuestion] | None = None)`; `ReviewQuestionOut.ask` is an exam question's title, `.stem: list[BlockOut]`, `.steps: list[str] | None` (sorted, so the right order is not shown), `.given: Any`, `.value: float | int | str | None`.

- [x] **Step 1: Write the failing tests.** In `test_drafts.py`:

```python
@pytest.mark.django_db
def test_a_draft_says_which_exam_questions_are_approved(client: Client, author: User) -> None:
    """Identical to the live question is approved; changed or new is a draft (M4Q.5)."""
    draft = open_draft("tpm", by=author)  # the helper this file uses to open a draft of a node
    live = node_from_index("tpm")
    assert live is not None
    changed = replace(live.exam[0], title="TPM adds up to what?")
    save_edit(draft, lambda node: update_exam_question(node, changed.id, changed), by=author)
    answer = client.get(f"/api/studio/drafts/{draft.public_id}").json()
    states = {q["id"]: q["state"] for q in answer["node"]["exam"]}
    assert states[changed.id] == "draft"
    assert all(state == "approved" for qid, state in states.items() if qid != changed.id)


@pytest.mark.django_db
def test_an_exam_question_sends_its_stem_as_blocks(client: Client, author: User) -> None:
    draft = open_draft("tpm", by=author)
    exam = client.get(f"/api/studio/drafts/{draft.public_id}").json()["node"]["exam"]
    order = next(q for q in exam if q["kind"] == "order")
    assert order["stem"] == [{"kind": "text", "markdown": order["stem_text"]}]
    assert order["steps"][0] == "Count the reads on each transcript"
```

(`test_drafts.py` has `_indexed()`, `member(role)` and `signed_in(client, role)`; open the draft through `POST /api/studio/drafts` as its `test_a_draft_reads_as_the_node` does, and save the edit with `drafts.save(draft, based_on=…, edit=…, by=author, change="test")` as `test_draft_edits.py` does. Write `open_draft` and `save_edit` as two small helpers at the top of the test file, from those calls.)

**Fixture:** `tests/fixtures/salmon/algorithms/de-bruijn-graphs/` gains, so the learner's page meets every new kind:
- in `body.md`, after its first paragraph and a blank line, `:::{sequence}\nACGTTGCAGG\n:::\n`, then `:::{try} spell-the-path\n:::\n` and `:::{try} assembly-order\n:::\n` where the body speaks of reading a path and of assembly;
- in `node.yaml`'s `try:`, a sequence question `spell-the-path` (`answer: ACGTT`, a hint that does not contain it) and an order question `assembly-order` (four steps: cut reads into k-mers, build the graph, simplify tips and bubbles, walk the paths), each with hints and a rationale, written back through the writer so the file stays canonical.

Then `uv run code-schema validate tests/fixtures/salmon` must exit 0, and in `apps/api/tests/test_nodes_api.py`:

```python
@pytest.mark.django_db
def test_a_node_sends_a_sequence_block_and_the_new_try_kinds(
    client: Client, built_index: object
) -> None:
    node = client.get("/api/nodes/de-bruijn-graphs").json()
    assert {"kind": "sequence", "letters": "ACGTTGCAGG\n"} in node["blocks"]
    kinds = {q["id"]: q["kind"] for q in node["questions"]}
    assert kinds["spell-the-path"] == "sequence"
    assert kinds["assembly-order"] == "order"
    order = next(q for q in node["questions"] if q["id"] == "assembly-order")
    assert order["steps"][0] == "Cut reads into k-mers"
```

(Use the index-building fixture this file already uses.) A weaver or fixture test that counts de-bruijn-graphs' questions gains two; update its number and say why.

In `test_review_api.py`, where a reviewer's questions are listed, assert an exam question's `ask` is its title and its `stem` is a list of blocks.

- [x] **Step 2: Run them to see them fail**

Run: `uv run pytest apps/api/tests/test_drafts.py apps/api/tests/test_review_api.py -q`
Expected: FAIL — `KeyError: 'state'`.

- [x] **Step 3: Implement.** In `content/schemas.py`:

```python
class SequenceBlockOut(Schema):
    kind: Literal["sequence"]
    letters: str


BlockOut = Annotated[
    TextBlockOut | TryBlockOut | CalloutBlockOut | SequenceBlockOut, Field(discriminator="kind")
]


class QuestionOut(Schema):
    """A try question, its answer included: it is formative, and the page checks it (M3P1.4).

    `options` for a choice; `answer` (a number with unit and tolerance, or a sequence's text with
    `accept` and `exact`); `steps` for an order, in the right order — the page shuffles them.
    """

    id: str
    kind: str
    ask: str
    options: list[OptionOut] | None
    answer: float | str | None
    unit: str | None
    tolerance: float | None
    accept: list[str]
    exact: bool
    steps: list[str] | None
    hints: list[str]
    rationale: str
```

and `_question` in `reads.py`:

```text
    return QuestionOut(
        id=question.question_id,
        kind=question.kind,
        ask=question.ask,
        options=[OptionOut(**option) for option in question.options] if choice else None,
        answer=(
            question.answer
            if question.kind == "sequence"
            else None if question.kind in ("choice", "order") else number_from(question.answer)
        ),
        unit=question.unit or None,
        tolerance=number_from(question.tolerance),
        accept=list(question.accept),
        exact=question.exact,
        steps=list(question.steps) if question.kind == "order" else None,
        hints=list(question.hints),
        rationale=question.rationale,
    )
```

In `studio/schemas.py`:

```python
class StudioOptionOut(Schema):
    text: str
    right: bool
    misconception: str
    plain: bool


def _answer_out(answer: Answer) -> dict[str, object]:
    empty: dict[str, object] = {
        "options": None,
        "answer": None,
        "unit": "",
        "tolerance": None,
        "accept": [],
        "exact": False,
        "steps": None,
    }
    match answer:
        case ChoiceAnswer(options=options):
            return empty | {
                "options": [
                    StudioOptionOut(
                        text=o.text, right=o.right, misconception=o.misconception, plain=o.plain
                    )
                    for o in options
                ]
            }
        case NumberAnswer(value=value, unit=unit, tolerance=tolerance):
            return empty | {"answer": value, "unit": unit, "tolerance": tolerance}
        case SequenceAnswer(value=value, accept=accept, exact=exact):
            return empty | {"answer": value, "accept": list(accept), "exact": exact}
        case OrderAnswer(steps=steps):
            return empty | {"steps": list(steps)}
```

`StudioQuestionOut` and `StudioExamQuestionOut` both gain `accept: list[str]`, `exact: bool`, `steps: list[str] | None`, and `answer: float | int | str | None`. `StudioExamQuestionOut` drops `ask` and gains:

```text
    title: str
    claim: str
    stem: list[BlockOut]
    stem_text: str  # what exam.yaml holds, so M4.8d edits the file's own text
    state: Literal["approved", "draft"]
```

`_block_out` gains `case SequenceBlock(letters=letters): return SequenceBlockOut(kind="sequence", letters=letters)`. Then:

```python
def _exam_out(question: ExamQuestion, live: Mapping[str, ExamQuestion]) -> StudioExamQuestionOut:
    """Approved when the live index holds this question unchanged (M4Q.5)."""
    return StudioExamQuestionOut(
        id=question.id,
        kind=question.kind,
        title=question.title,
        claim=question.claim,
        stem=[_block_out(block) for block in question.blocks],
        stem_text=question.stem,
        state="approved" if live.get(question.id) == question else "draft",
        level=None if question.level is None else question.level.value,
        rationale=question.rationale,
        **_answer_out(question.answer),  # type: ignore[arg-type]
    )


def node_out(node: Node, live: Mapping[str, ExamQuestion] | None = None) -> DraftNodeOut:
    ...
        exam=[_exam_out(question, live or {}) for question in node.exam],
```

`review_question_out` uses `question.title if isinstance(question, ExamQuestion) else question.ask` for `ask`, adds `stem=[_block_out(b) for b in question.blocks] if isinstance(question, ExamQuestion) else []`, and gains two cases:

```text
        case SequenceAnswer(value=key):
            texts, unit, steps = None, "", None
            if shown:
                value = key
        case OrderAnswer(steps=written):
            texts, unit = None, ""
            steps = sorted(written, key=str.casefold)  # never the right order before an answer
            if shown:
                value = None
```

(`ReviewQuestionOut` gains `stem: list[BlockOut]`, `steps: list[str] | None`, `given: Any`, `value: float | int | str | None`; the choice and number cases set `steps = None`.)

In `studio/api.py`:

```python
def draft_out(draft: Draft) -> DraftOut:
    node, problems = drafts.node_of(draft)
    live = node_from_index(draft.node_id)
    pool = {} if live is None else {question.id: question for question in live.exam}
    return DraftOut(
        **summary_out(draft).dict(),
        node=None if node is None else node_out(node, pool),
        problems=[ProblemOut.of(problem) for problem in problems],
    )
```

(Import `node_from_index` from `code_api.content.snapshot`.)

- [x] **Step 4: Run the API suite and regenerate the schema**

Run: `uv run pytest apps/api -q`
Expected: PASS.
Run: `uv run python apps/api/manage.py export_openapi_schema --api code_api.api.api --sorted --indent 2 --output apps/api/openapi.json`

- [x] **Step 5: Commit**

```bash
git add apps/api tests/fixtures
git commit -m "feat(api): stems as blocks, the new kinds, and a question's state — M4.8c.5"
```

---

### Task 6: What the API takes — the new shapes through every edit

**Files:**
- Modify: `apps/api/src/code_api/studio/api.py` (`OptionIn`, `AnswerIn`, `ExamQuestionIn`, `BlockIn`, `_answer`, `_exam_question`, `_block`)
- Modify: `apps/api/tests/test_draft_edits.py`

**Interfaces:**
- Consumes: Task 5's outputs; code-schema's edits.
- Produces (JSON in): `OptionIn.plain: bool = False`; `AnswerIn.kind: Literal["choice", "number", "sequence", "order"]`, `answer: float | int | str | None`, `accept: list[str] = []`, `exact: bool = False`, `steps: list[str] | None = None`; `ExamQuestionIn.title: str`, `claim: str = ""`, `stem: str` (no `ask`); `BlockIn.kind` gains `"sequence"` with `letters: str = ""`.

- [x] **Step 1: Write the failing tests** in `test_draft_edits.py`:

```python
ORDER = {
    "id": "assembly-steps",
    "title": "Put the assembly steps in order",
    "kind": "order",
    "stem": "Put the steps of de Bruijn assembly in order.\n\n:::{sequence}\nACGTTG\n:::\n",
    "steps": [
        "Cut reads into k-mers",
        "Build the graph",
        "Simplify tips and bubbles",
        "Walk paths",
    ],
    "rationale": "Each step needs the one before.",
}
SEQUENCE = {
    "id": "spell-the-path",
    "title": "Spell the path",
    "claim": "reads a sequence off the graph",
    "kind": "sequence",
    "stem": "Spell the sequence along ACG → CGT → GTT.\n",
    "answer": "ACGTT",
    "accept": [],
    "rationale": "Each edge adds the last letter of its k-mer.",
}


@pytest.mark.django_db
@pytest.mark.parametrize("question", [ORDER, SEQUENCE], ids=["order", "sequence"])
def test_an_exam_question_of_a_new_kind_is_saved(
    client: Client, author: User, question: dict[str, object]
) -> None:
    draft = open_draft("tpm", by=author)
    saved = client.post(
        f"/api/studio/drafts/{draft.public_id}/exam",
        {"revision": 1, "question": question},
        content_type="application/json",
    )
    assert saved.status_code == 200, saved.json()
    exam = saved.json()["draft"]["node"]["exam"]
    sent = next(q for q in exam if q["id"] == question["id"])
    assert sent["state"] == "draft"
    assert sent["stem_text"] == question["stem"]


@pytest.mark.django_db
def test_an_exam_choice_of_two_options_is_refused_in_its_words(
    client: Client, author: User
) -> None:
    draft = open_draft("tpm", by=author)
    two = {
        "id": "two-only",
        "title": "Two only",
        "kind": "choice",
        "stem": "Pick one.\n",
        "options": [{"text": "A", "right": True}, {"text": "B", "plain": True}],
        "rationale": "A.",
    }
    refused = client.post(
        f"/api/studio/drafts/{draft.public_id}/exam",
        {"revision": 1, "question": two},
        content_type="application/json",
    )
    assert refused.status_code == 422
    assert [p["code"] for p in refused.json()["problems"]] == ["CS0818"]


@pytest.mark.django_db
def test_a_sequence_block_is_inserted_through_the_api(client: Client, author: User) -> None:
    draft = open_draft("de-bruijn-graphs", by=author)
    saved = client.post(
        f"/api/studio/drafts/{draft.public_id}/blocks",
        {"revision": 1, "at": 1, "block": {"kind": "sequence", "letters": "ACGT\n"}},
        content_type="application/json",
    )
    assert saved.status_code == 200, saved.json()
    assert {"kind": "sequence", "letters": "ACGT\n"} in saved.json()["draft"]["node"]["blocks"]
```

(Use the revision this file's helpers say a fresh draft has, and its own helper names.)

- [x] **Step 2: Run them to see them fail**

Run: `uv run pytest apps/api/tests/test_draft_edits.py -q`
Expected: FAIL — 422 from the schema (`kind` not one of `choice`, `number`).

- [x] **Step 3: Implement** in `studio/api.py`:

```python
class OptionIn(Schema):
    text: str
    right: bool = False
    misconception: str = ""
    plain: bool = False


class AnswerIn(Schema):
    """A question's answer, flat as the files write it (M4Q.3)."""

    kind: Literal["choice", "number", "sequence", "order"]
    options: list[OptionIn] | None = None
    answer: float | int | str | None = None
    unit: str = ""
    tolerance: float | int | None = None
    accept: list[str] = []
    exact: bool = False
    steps: list[str] | None = None


class ExamQuestionIn(AnswerIn):
    id: str
    title: str
    claim: str = ""
    stem: str
    level: Level | None = None
    rationale: str


def _answer(given: AnswerIn) -> Answer:
    """As written; a missing answer is an EditError, other malformed ones the parse refuses."""
    match given.kind:
        case "choice":
            return ChoiceAnswer(
                options=tuple(
                    Option(text=o.text, right=o.right, misconception=o.misconception, plain=o.plain)
                    for o in given.options or []
                )
            )
        case "sequence":
            if not isinstance(given.answer, str):
                raise EditError("a sequence question needs its answer as text")
            return SequenceAnswer(value=given.answer, accept=tuple(given.accept), exact=given.exact)
        case "order":
            return OrderAnswer(steps=tuple(given.steps or ()))
    if given.answer is None or isinstance(given.answer, str):
        raise EditError("a number question needs its answer")
    return NumberAnswer(value=given.answer, unit=given.unit, tolerance=given.tolerance)


def _exam_question(given: ExamQuestionIn) -> ExamQuestion:
    return ExamQuestion(
        id=given.id,
        title=given.title,
        claim=given.claim,
        stem=given.stem,
        answer=_answer(given),
        level=given.level,
        rationale=given.rationale,
    )
```

`BlockIn.kind` becomes `Literal["text", "try", "callout", "sequence"]` with `letters: str = ""`, and `_block` gains `case "sequence": return SequenceBlock(letters=given.letters)`.

(An order's step count and duplicates are refused by the parse in its own words, CS0334 and CS0336, so `_answer` builds whatever it is given.)

- [x] **Step 4: Run the API suite, regenerate the schema**

Run: `uv run pytest apps/api -q`
Expected: PASS.
Run: `uv run python apps/api/manage.py export_openapi_schema --api code_api.api.api --sorted --indent 2 --output apps/api/openapi.json`

- [x] **Step 5: Commit**

```bash
git add apps/api
git commit -m "feat(api): the exam and block edits take the new shapes — M4.8c.6"
```

---

### Task 7: The learner's try controls and the sequence block

**Files:**
- Modify: `apps/web/src/api/schema.ts` (by `npm run api-types`)
- Create: `apps/web/src/node/grading.ts`, `apps/web/src/node/grading.test.ts`
- Create: `apps/web/src/node/SequenceAnswer.tsx`, `apps/web/src/node/OrderAnswer.tsx`, `apps/web/src/node/SequenceBlock.tsx`
- Modify: `apps/web/src/node/TryQuestion.tsx`, `node/body.ts` (`Block`), `node/Body.tsx`
- Modify: `apps/web/src/node/TryQuestion.test.tsx`, `apps/web/src/node/Body.test.tsx`

**Interfaces:**
- Consumes: Task 5's `QuestionOut` and `SequenceBlockOut`.
- Produces: `score(question: QuestionOut, given: string | string[]): number` and `isRight(question, given): boolean` in `node/grading.ts`; `<SequenceAnswer onCheck={(text) => …} disabled />`; `<OrderAnswer steps={…} onCheck={(order) => …} disabled />`; `<SequenceBlock letters="…" />`.

- [x] **Step 1: Regenerate the types**

Run: `podman run --rm --userns=keep-id -v "$PWD":/w:Z -w /w/apps/web node:24-alpine npm run api-types`
Expected: `src/api/schema.ts` gains `SequenceBlockOut`, `QuestionOut.accept`, `.exact`, `.steps`.

- [x] **Step 2: Write the failing tests.** `node/grading.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { QuestionOut } from "../api/schema";
import { isRight, score } from "./grading";

const base = { id: "q", ask: "?", hints: [], rationale: "", unit: null, tolerance: null };
const sequence: QuestionOut = {
  ...base, kind: "sequence", options: null, answer: "ACGTTGA", accept: ["ACGTTGA*"], exact: false, steps: null,
};
const order: QuestionOut = {
  ...base, kind: "order", options: null, answer: null, accept: [], exact: false, steps: ["A", "B", "C", "D"],
};

describe("grading, the server's rule (M4Q.3)", () => {
  it("ignores case and spaces in a sequence, and takes an accepted form", () => {
    expect(isRight(sequence, "acg ttga")).toBe(true);
    expect(isRight(sequence, "acgttga*")).toBe(true);
    expect(isRight(sequence, "ACGTTG")).toBe(false);
  });

  it("trims only the ends of an exact sequence", () => {
    const exact = { ...sequence, answer: "FASTQ", accept: [], exact: true };
    expect(isRight(exact, " FASTQ ")).toBe(true);
    expect(isRight(exact, "fastq")).toBe(false);
  });

  it("scores an order by the pairs in order", () => {
    expect(score(order, ["A", "B", "C", "D"])).toBe(1);
    expect(score(order, ["A", "B", "D", "C"])).toBeCloseTo(5 / 6);
    expect(score(order, ["B", "C", "D", "A"])).toBeCloseTo(3 / 6);
    expect(score(order, ["D", "C", "B", "A"])).toBe(0);
    expect(isRight(order, ["A", "B", "D", "C"])).toBe(false);
  });
});
```

In `TryQuestion.test.tsx`:

```tsx
it("checks a typed sequence", async () => {
  render(<TryQuestion question={sequenceQuestion} number={1} />);
  await userEvent.click(screen.getByRole("button", { name: /Try it/ }));
  await userEvent.type(screen.getByLabelText("Your answer"), "acg ttga");
  await userEvent.click(screen.getByRole("button", { name: "Check" }));
  expect(screen.getByText(/Right — ACGTTGA/)).toBeInTheDocument();
});

it("puts steps in order with Move up and Move down, and says how close an order was", async () => {
  render(<TryQuestion question={orderQuestion} number={1} />);
  await userEvent.click(screen.getByRole("button", { name: /Try it/ }));
  const items = () => screen.getAllByRole("listitem").map((li) => li.textContent ?? "");
  // The steps arrive shuffled; move each into place by its own buttons.
  for (const [at, step] of ["A", "B", "C", "D"].entries()) {
    while (items().findIndex((text) => text.startsWith(step)) > at) {
      await userEvent.click(screen.getByRole("button", { name: `Move ${step} up` }));
    }
  }
  await userEvent.click(screen.getByRole("button", { name: "Check" }));
  expect(screen.getByText(/Right/)).toBeInTheDocument();
});

it("says how many pairs were in order when an order is not right", async () => {
  render(<TryQuestion question={{ ...orderQuestion, steps: ["A", "B", "C"] }} number={1} shuffle={(s) => [...s].reverse()} />);
  await userEvent.click(screen.getByRole("button", { name: /Try it/ }));
  await userEvent.click(screen.getByRole("button", { name: "Check" }));
  expect(screen.getByText("0 of 3 pairs in order.")).toBeInTheDocument();
});
```

(`sequenceQuestion` and `orderQuestion` are built as in `grading.test.ts`, with `ask` and a `rationale`.) In `Body.test.tsx`:

```tsx
it("draws a sequence in groups of ten, and nothing for a block it does not know", () => {
  render(
    <Body
      blocks={[
        { kind: "sequence", letters: "ACGTTGCAGGTTAC\n" },
        { kind: "figure", component: "x" } as unknown as Block,
      ]}
      questions={[]}
    />,
  );
  expect(screen.getByText("ACGTTGCAGG TTAC")).toBeInTheDocument();
  expect(screen.queryByRole("button")).toBeNull();
});
```

- [x] **Step 3: Run them to see them fail**

Run: `podman run --rm --userns=keep-id -v "$PWD":/w:Z -w /w/apps/web node:24-alpine npx vitest run src/node`
Expected: FAIL — `Cannot find module './grading'`.

- [x] **Step 4: Implement.** `node/grading.ts`:

```ts
// How right an answer is, by the rule code-schema's grading uses (M4.5 spec, M4.8c spec M4Q.3):
// a choice at its right option, a number within its tolerance, a sequence by its forms (case and
// spaces aside unless exact), an order by the share of step pairs in order. Only an order scores
// between 0 and 1.
import type { QuestionOut } from "../api/schema";

export type Given = string | string[];

const loose = (text: string) => text.replace(/\s+/g, "").toLowerCase();

export function score(question: QuestionOut, given: Given): number {
  if (question.kind === "order") {
    const steps = question.steps ?? [];
    if (!Array.isArray(given) || given.length !== steps.length) return 0;
    const place = new Map(given.map((step, at) => [step, at]));
    let inOrder = 0;
    let pairs = 0;
    for (let a = 0; a < steps.length; a += 1) {
      for (let b = a + 1; b < steps.length; b += 1) {
        pairs += 1;
        if ((place.get(steps[a] as string) ?? 0) < (place.get(steps[b] as string) ?? 0)) inOrder += 1;
      }
    }
    return pairs === 0 ? 0 : inOrder / pairs;
  }
  if (Array.isArray(given)) return 0;
  if (question.kind === "choice") {
    return question.options?.some((option) => option.right && option.text === given) ? 1 : 0;
  }
  if (question.kind === "sequence") {
    const key = question.exact ? (text: string) => text.trim() : loose;
    const forms = [String(question.answer ?? ""), ...question.accept].map(key);
    return given.trim() !== "" && forms.includes(key(given)) ? 1 : 0;
  }
  const value = Number(given.replace(",", "."));
  if (given.trim() === "" || Number.isNaN(value) || typeof question.answer !== "number") return 0;
  return Math.abs(value - question.answer) <= (question.tolerance ?? 0) + 1e-9 ? 1 : 0;
}

export const isRight = (question: QuestionOut, given: Given): boolean => score(question, given) === 1;

/** The pairs an order got right, for its feedback: "3 of 6 pairs in order." */
export function pairsInOrder(question: QuestionOut, given: string[]): [number, number] {
  const n = (question.steps ?? []).length;
  const pairs = (n * (n - 1)) / 2;
  return [Math.round(score(question, given) * pairs), pairs];
}
```

`node/SequenceAnswer.tsx`:

```tsx
// A typed answer for a sequence try (M4Q.6): letters or words, checked when the learner asks.
import { useId, useState } from "react";

export function SequenceAnswer({
  disabled,
  onCheck,
}: {
  disabled: boolean;
  onCheck: (text: string) => void;
}) {
  const field = useId();
  const [text, setText] = useState("");
  return (
    <form
      className="flex flex-wrap items-center gap-2.5"
      onSubmit={(event) => {
        event.preventDefault();
        onCheck(text);
      }}
    >
      <label htmlFor={field} className="sr-only">
        Your answer
      </label>
      <input
        id={field}
        value={text}
        disabled={disabled}
        autoComplete="off"
        spellCheck={false}
        onChange={(event) => setText(event.target.value)}
        className="min-w-0 flex-1 rounded-control border-[1.5px] border-border-2 bg-surface px-3 py-2 font-mono text-[14px] focus:border-sel focus:outline-none"
      />
      <button type="submit" disabled={disabled} className={CHECK}>
        Check
      </button>
    </form>
  );
}

export const CHECK =
  "rounded-control bg-btn px-4 py-2 text-[13.5px] font-semibold text-btn-ink shadow-[0_3px_0_0_var(--btn-sh)] hover:brightness-110 disabled:opacity-60";
```

`node/OrderAnswer.tsx`:

```tsx
// An order try (M4Q.6): the steps shuffled, each moved with its own Move up and Move down — the
// keyboard's way, no drag needed — and checked as the order they stand in.
import { useState } from "react";
import { CHECK } from "./SequenceAnswer";

/** A shuffle that never hands the steps back in their right order. */
export function shuffled(steps: string[]): string[] {
  if (steps.length < 2) return steps;
  for (;;) {
    const out = [...steps];
    for (let at = out.length - 1; at > 0; at -= 1) {
      const other = Math.floor(Math.random() * (at + 1));
      [out[at], out[other]] = [out[other] as string, out[at] as string];
    }
    if (out.some((step, at) => step !== steps[at])) return out;
  }
}

export function OrderAnswer({
  steps,
  disabled,
  onCheck,
}: {
  steps: string[];
  disabled: boolean;
  onCheck: (order: string[]) => void;
}) {
  const [order, setOrder] = useState(steps);
  const move = (at: number, by: number) => {
    const next = [...order];
    [next[at], next[at + by]] = [next[at + by] as string, next[at] as string];
    setOrder(next);
  };
  return (
    <div className="flex flex-col gap-2.5">
      <ol className="flex flex-col gap-1.5">
        {order.map((step, at) => (
          <li
            key={step}
            className="flex items-center gap-2.5 rounded-[10px] border border-border-2 bg-surface px-3.5 py-2 text-[14.5px]"
          >
            <span className="min-w-0 flex-1">{step}</span>
            <button
              type="button"
              aria-label={`Move ${step} up`}
              disabled={disabled || at === 0}
              onClick={() => move(at, -1)}
              className="px-1.5 text-ink-2 disabled:opacity-30"
            >
              ↑
            </button>
            <button
              type="button"
              aria-label={`Move ${step} down`}
              disabled={disabled || at === order.length - 1}
              onClick={() => move(at, 1)}
              className="px-1.5 text-ink-2 disabled:opacity-30"
            >
              ↓
            </button>
          </li>
        ))}
      </ol>
      <button type="button" disabled={disabled} className={`${CHECK} self-start`} onClick={() => onCheck(order)}>
        Check
      </button>
    </div>
  );
}
```

`node/SequenceBlock.tsx`:

```tsx
// A sequence block (M4Q.2): DNA, RNA or protein letters, monospaced in groups of ten.
export function SequenceBlock({ letters }: { letters: string }) {
  const bare = letters.replace(/\s+/g, "");
  const groups = bare.match(/.{1,10}/g) ?? [];
  return (
    <p className="my-1 rounded-[10px] border border-border bg-surface px-4 py-3 font-mono text-[14px] tracking-[0.06em] break-all">
      {groups.join(" ")}
    </p>
  );
}
```

`node/body.ts`: `export type Block = TextBlockOut | TryBlockOut | CalloutBlockOut | SequenceBlockOut;`. `node/Body.tsx`: before the try branch,

```tsx
        if (block.kind === "sequence") {
          // biome-ignore lint/suspicious/noArrayIndexKey: sequences have no identity beyond their place
          return <SequenceBlock key={`sequence:${index}`} letters={block.letters} />;
        }
        if (block.kind !== "try") return null; // a kind this page does not draw yet (Review Focus 5)
```

`node/TryQuestion.tsx`: delete its own `isRight`; import `isRight`, `pairsInOrder`, `Given` from `./grading`; `check(value: Given)`; `KINDS` gains `sequence: "a typed answer"`, `order: "an order"`; `answerOf` returns `String(question.answer)` for a sequence and `question.steps?.join(" → ")` for an order; the props gain `shuffle = shuffled` (from `./OrderAnswer`, for tests) and the answer area reads:

```tsx
      {question.kind === "choice" ? (
        /* the existing options grid, unchanged */
      ) : question.kind === "sequence" ? (
        <SequenceAnswer disabled={right} onCheck={check} />
      ) : question.kind === "order" ? (
        <OrderAnswer steps={orderSteps} disabled={right} onCheck={(order) => { setLastOrder(order); check(order); }} />
      ) : (
        /* the existing number form, unchanged */
      )}
```

with `const [orderSteps] = useState(() => shuffle(question.steps ?? []));` and `const [lastOrder, setLastOrder] = useState<string[] | null>(null);`; the *Not quite.* line, for an order, reads `` `${n} of ${pairs} pairs in order.` `` from `pairsInOrder(question, lastOrder)`.

- [x] **Step 5: Run the web checks**

Run (each separately, reading each exit code): `npx biome check --write src/node`, `npm run lint`, `npm run typecheck`, `npx vitest run` — all through the podman prefix.
Expected: PASS. Typecheck errors elsewhere from the regenerated types (`answer: number | string | null`, the exam's `ask` gone) are fixed in Task 8; if they block this task's typecheck, do Task 8's Step 3 first and note it.

- [x] **Step 6: Commit**

```bash
git add apps/web
git commit -m "feat(web): the learner answers sequence and order tries; the sequence block — M4.8c.7"
```

---

### Task 8: The workbench meets the new shapes

**Files:**
- Modify: `apps/web/src/studio/workbench/BlockEditor.tsx`, `BlockList.tsx` (the row label), `Outline.tsx` (`firstWords`), `TryEditor.tsx`, `question.ts`, `ExamPoolTab.tsx`, `fixtures.ts`
- Modify: `apps/web/src/studio/workbench/ContentTab.test.tsx`, `ExamPoolTab.test.tsx` (create if absent), `TryEditor.test.tsx`

**Interfaces:**
- Consumes: Task 5's `SequenceBlockOut`, `StudioExamQuestionOut.state`, the widened `answer`.
- Produces: a sequence block editable as **Letters** in the Content tab; a try of kind sequence or order shown with *Edited in the exam pool's builder (M4.8d)* and no editor; the Exam pool line `{n} of 4 · {m} approved`.

- [x] **Step 1: Write the failing tests.** In `ContentTab.test.tsx`:

```tsx
it("edits a sequence block's letters and saves them on leaving", async () => {
  const fake = bench(
    { "PUT /api/studio/drafts/d-1/blocks/0": saved(4, [{ kind: "sequence", letters: "ACGTA\n" }]) },
    [{ kind: "sequence", letters: "ACGT\n" }],
  );
  await userEvent.click(await screen.findByRole("button", { name: "Edit block 1" }));
  await userEvent.type(screen.getByLabelText("Letters"), "A");
  await userEvent.click(screen.getByRole("heading", { level: 1 }));
  await vi.waitFor(() => expect(writes(fake)).toHaveLength(1));
  expect(sent(fake).block).toEqual({ kind: "sequence", letters: "ACGTA\n" });
});
```

In `ExamPoolTab.test.tsx`:

```tsx
it("says how many questions there are and how many are approved", async () => {
  answering({
    "GET /api/me": signedInAs("author"),
    "GET /api/studio/drafts/d-1": {
      body: { ...DRAFT, node: { ...NODE, exam: [EXAM_APPROVED, EXAM_APPROVED_2, EXAM_DRAFT] } },
    },
  });
  renderAt("/studio/drafts/d-1?tab=exam", <Route path="/studio/drafts/:id" element={<WorkbenchPage />} />);
  expect(await screen.findByText("3 of 4 · 2 approved")).toBeInTheDocument();
});
```

(`EXAM_APPROVED`, `EXAM_APPROVED_2`, `EXAM_DRAFT` go in `fixtures.ts`: `StudioExamQuestionOut` values with `state` `approved`, `approved`, `draft`, distinct ids, a one-text-block `stem` and its `stem_text`.) In `TryEditor.test.tsx`:

```tsx
it("shows a sequence or order try without an editor until the builder arrives", async () => {
  // a node whose try question is kind "order" (steps …), opened with Edit block 2
  expect(screen.getByText(/Edited in the exam pool's builder \(M4\.8d\)/)).toBeInTheDocument();
  expect(screen.queryByLabelText("Question")).toBeNull();
});
```

(Build the order try as `WITH_TRY` is built in that file, with `kind: "order"`, `options: null`, `answer: null`, `accept: []`, `exact: false`, `steps: [...]`.)

- [x] **Step 2: Run them to see them fail**

Run: `npx vitest run src/studio/workbench` (podman prefix)
Expected: FAIL — no `Letters` field; `3 of 4` without the approved count.

- [x] **Step 3: Implement.**
  - `BlockEditor.tsx`: `{block.kind === "sequence" && (<label className={LABEL}>Letters<textarea value={block.letters} rows={3} spellCheck={false} onChange={(e) => setBlock({ ...block, letters: e.target.value })} className={`${BOX} font-mono`} /></label>)}` (use the classes `MarkdownField` uses for its label and box); `ended()` also ends a sequence's letters with a newline; `empty()` treats a sequence with no letters as empty; the caption reads `sequence · block N`.
  - `Outline.tsx` `firstWords`: a sequence block reads as its first ten letters followed by `…` when longer.
  - `TryEditor.tsx` / `BlockEditor.tsx`: a try whose question kind is `sequence` or `order` shows, in place of `TryEditor`, `<p className={NOTE}>A {kind} question. Edited in the exam pool's builder (M4.8d).</p>`, and `commit()` sends nothing for it (it is never `changed`).
  - `question.ts`: `questionIn` carries `accept`, `exact`, `steps` through, and `answer` keeps its type (`number | string | null`); `NumberField` reads `typeof answer === "number" ? answer : null`.
  - `ExamPoolTab.tsx`: ``{node.exam.length} of 4 · {node.exam.filter((q) => q.state === "approved").length} approved``.
  - `fixtures.ts`: `NODE.exam` stays `[]`; add the three exam fixtures.

- [x] **Step 4: Run every web check** (each separately, reading each exit code, podman prefix)

Run: `npx biome check --write src`, `npm run lint`, `npm run typecheck`, `npx vitest run`, `npm run build`
Expected: all PASS.

- [x] **Step 5: Commit**

```bash
git add apps/web
git commit -m "feat(web): the workbench edits sequence blocks and counts approved questions — M4.8c.8"
```

---

### Task 9: Done when, the docs, and the pull request

**Files:**
- Modify: `CLAUDE.md` (the layout's code-schema line: answers of four kinds, the sequence block, exam stems)
- Modify: the spec (*Notes from the build*); this plan (ticks)
- Create: a journal entry in `docs/notes/journal/` for the build

- [x] **Step 1: The whole suite with CI's environment**: `uv run ruff check .`, `uv run ruff format --check .`, `uv run mypy`, Django's `check`, `makemigrations --check --dry-run`, `uv run pytest`, `uv run code-schema validate tests/fixtures/salmon`; the web's lint, typecheck, tests and build. Expected: all green, each read by its exit code.

- [x] **Step 2: Walk *done when*** against `runserver` (after `migrate` and `rebuild_index --root tests/fixtures/salmon`) and the production build in a browser, signed in as an invited author:
  1. Open a draft of `tpm` from Drafts. Through the API from the signed-in page (`fetch` with the CSRF token), add an exam question whose stem holds a `sequence` block, then a sequence-answer question and an order question (the payloads of Task 6's tests).
  2. `GET` the draft: the new questions read `draft`, the untouched ones `approved`; Verify is clean of errors; the checklist passes.
  3. Open `/node/de-bruijn-graphs` (its fixture gained a sequence block and two tries in Task 5): the sequence is drawn in groups of ten; answer *spell-the-path* by typing and *assembly-order* with Move up and Move down.
  4. The workbench's Exam pool tab reads `n of 4 · m approved`.

- [x] **Step 3: Final review** — a fresh reviewer (opus) over `git diff main...HEAD` with the spec, this plan and the ledger; findings filed as one issue; Critical and Important fixed test-first; minors to the deferred issue.

- [x] **Step 4: Docs.** CLAUDE.md's layout line for `packages/code-schema/` adds *answers of four kinds (choice, number, sequence, order) and their score; the sequence block; exam questions with a title, a claim and a block stem*. The spec's *Notes from the build* lists each ruling. The journal entry, then `uv run pytest tests/repo -q`.

- [ ] **Step 5: Commit, push, open the pull request** (`Closes #222` on its own line), on the operator's word; merge only on their yes.
