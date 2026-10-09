"""A node's exam pool, in exam.yaml beside node.yaml (spec M4E.1, M4E.3; tutor spec T7.1).

An exam question is asked in a self-test, never in the prose: it has no hints, may carry its own
level, and a wrong option names the misconception it targets or says it is plain. It has a title,
a free-text claim and a stem of the page's blocks (M4.8c spec, M4Q.2). How it is answered, and the
rules for that, are the try question's (`code_schema.questions`), so a rule reads the same in both
pools. The pool's own rules are here.
"""

from __future__ import annotations

from dataclasses import dataclass, replace
from typing import TYPE_CHECKING

from code_schema.blocks import Block, Callout, Try, parse_blocks
from code_schema.fields import one_line, one_of, shown
from code_schema.levels import Level
from code_schema.problems import Problem
from code_schema.questions import (
    Answer,
    ChoiceAnswer,
    OptionRules,
    read_answer,
    read_head,
    read_rationale,
    repeated,
)
from code_schema.records import Entry, Field
from code_schema.yaml_lines import load_mapping

if TYPE_CHECKING:
    from code_schema.node import Node

EXAM_FILE = "exam.yaml"
EXAM_FIELD = "exam"
MAX_EXAM = 40
MIN_EXAM = 4  # fewer is left out of self-tests (T7.1): a warning, CS0813

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
# CS0327 keeps its words for 2 to 5; CS0818 asks an exam's choice for three.
_OPTIONS = OptionRules(
    keys=("text", "right", "misconception", "plain"), code="CS0808", noun="an exam option"
)
EXAM_OPTIONS = 3
_level = one_of(tuple(Level), noun="level")
_title = one_line(max_len=120)
_claim = one_line(max_len=200)


@dataclass(frozen=True)
class ExamQuestion:
    """A question asked in a self-test (T7.1). `level` is None when it is the node's own."""

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
    """The stem, its block problems at their lines in exam.yaml (Review Focus 1).

    A literal stem (`stem: |`) starts on the line after its key; a one-line stem on the key's own.
    """
    stem = entry.mapping.get("stem")
    if not isinstance(stem, str) or not stem.strip():
        entry.problem("CS0816", f"the exam question {name} has no stem", key="stem")
        return None
    key = entry.at("stem") or entry.line or 1
    at = key if "\n" in stem.rstrip("\n") or stem.endswith("\n") else key - 1
    # YAML writes such a line only as an escaped string, never as `stem: |` (#264).
    for number, line in enumerate(stem.split("\n"), start=1):
        if "\t" in line or line != line.rstrip(" "):
            entry.problem(
                "CS0823",
                f"a line of {name}'s stem ends in spaces or holds a tab",
                line=number + at,
            )
            return None
    blocks, starts, problems = parse_blocks(stem, file=file)
    for problem in problems:
        entry.field.problems.append(replace(problem, line=(problem.line or 1) + at))
    if problems:
        entry.sound = False
        return None
    for block, start in zip(blocks, starts, strict=True):
        if isinstance(block, Try | Callout):
            said = "a try question" if isinstance(block, Try) else "a callout"
            entry.problem(
                "CS0817",
                f"the stem of {name} holds {said} — a stem holds text and sequences",
                line=start + at,
            )
            return None
    return stem


def parse_exam(
    text: str, *, file: str, node: Node | None
) -> tuple[tuple[ExamQuestion, ...], list[Problem]]:
    """One exam.yaml. Never raises; returns the sound questions and every problem.

    The checks against the node — its callouts, its try questions — run only when `node` is given,
    which is when node.yaml and body.md parsed.
    """
    data, lines, problems = load_mapping(text, file=file)
    if data is None:
        return (), problems
    for key in data:
        if key != EXAM_FIELD:
            problems.append(
                Problem(
                    file=file,
                    line=lines.get(str(key)),
                    code="CS0801",
                    message=f"unknown key `{key}` in {EXAM_FILE} ({EXAM_FIELD})",
                )
            )
    if EXAM_FIELD not in data:
        problems.append(
            Problem(file=file, code="CS0802", message=f"{EXAM_FILE} has no {EXAM_FIELD}: list")
        )
        return (), problems

    field = Field(EXAM_FIELD, lines=lines, file=file, problems=problems)
    value = data[EXAM_FIELD]
    if isinstance(value, list) and not value:
        field.problem("CS0804", f"the pool is empty — delete {EXAM_FILE} instead")
        return (), problems
    if isinstance(value, list) and len(value) > MAX_EXAM:
        field.problem("CS0812", f"the pool has {len(value)} questions (at most {MAX_EXAM})")
        return (), problems

    misconceptions = (
        None
        if node is None
        else {
            block.title
            for block in node.blocks
            if isinstance(block, Callout) and block.kind == "misconception"
        }
    )
    try_ids = None if node is None else {question.id for question in node.questions}
    questions: list[ExamQuestion] = []
    seen: set[str] = set()
    for entry in field.entries(
        value,
        not_a_list=("CS0803", "must be a list of exam questions"),
        not_a_mapping=("CS0805", lambda item: f"{shown(item)} is not a question"),
    ):
        written = entry.mapping
        entry.unknown(
            (*_KEYS, "hints"),
            "CS0806",
            lambda key: f"unknown key `{key}` in an exam question ({', '.join(_KEYS)})",
        )
        if (head := read_head(entry, ask=False)) is None:
            continue
        name, kind = head
        if "hints" in written:
            entry.problem(
                "CS0807",
                f"the exam question {name} has hints — a self-test gives none",
                key="hints",
            )
        if entry.require("title", "CS0815", f"the exam question {name} has no title"):
            entry.check("title", _title, prefix=f"the title of {name} ")
        if "claim" in written:
            entry.check("claim", _claim, prefix=f"the claim of {name} ")
        stem = _read_stem(entry, name, file=file)
        if entry.check("level", _level, prefix=f"the level of {name} ") and node is not None:
            _level_distance(entry, name, written.get("level"), node.level)
        answer = read_answer(entry, name, kind, field, rules=_OPTIONS)
        rationale = read_rationale(entry, name)

        if isinstance(answer, ChoiceAnswer):
            _check_options(entry, name, answer, written, misconceptions)
        if try_ids is not None and name in try_ids:
            entry.problem(
                "CS0811",
                f"{name} is already a try question in node.yaml "
                "— a node's question ids are shared by both pools",
                key="id",
            )

        if not entry.sound:
            continue
        assert answer is not None and stem is not None  # a sound entry has both
        level = written.get("level")
        question = ExamQuestion(
            id=name,
            title=str(written["title"]),
            claim=str(written.get("claim", "")),
            stem=stem,
            answer=answer,
            level=None if level is None else Level(str(level)),
            rationale=rationale,
        )
        if repeated(entry, name, seen):
            continue
        questions.append(question)
    if isinstance(value, list) and len(value) < MIN_EXAM:
        field.problem(
            "CS0813",
            f"the pool has {len(value)} questions "
            f"— the node is left out of self-tests until it has {MIN_EXAM}",
        )
    return tuple(questions), problems


def _check_options(
    entry: Entry,
    name: str,
    answer: ChoiceAnswer,
    written: dict[object, object],
    misconceptions: set[str] | None,
) -> None:
    """An exam's choice: three options at least, and each wrong one names a misconception or says
    it is plain on purpose (M4Q.3); a forgotten one is a warning, a contradiction a refusal."""
    lines = entry.field.lines
    if len(answer.options) < EXAM_OPTIONS:
        entry.problem(
            "CS0818",
            f"the exam question {name} has {len(answer.options)} options "
            f"(an exam's choice offers {EXAM_OPTIONS} to 5)",
            key="options",
        )
    written_options = written["options"]
    assert isinstance(written_options, list)  # a sound choice wrote a list of mappings
    for item, option in zip(written_options, answer.options, strict=True):
        if option.plain and option.misconception:
            entry.problem(
                "CS0819",
                f"an option of {name} names a misconception and says plain — one or the other",
                line=lines.of(item, "plain"),
            )
        elif option.plain and option.right:
            entry.problem(
                "CS0820", f"the right option of {name} says plain", line=lines.of(item, "plain")
            )
        elif option.misconception and option.right:
            entry.problem(
                "CS0810",
                f"the right option of {name} names a misconception — only a wrong option can",
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


def _level_distance(entry: Entry, name: str, written: object, home: Level) -> None:
    """A warning for a question two or more levels from its node's (T10.1)."""
    if written is None:
        return
    order = list(Level)
    distance = abs(order.index(Level(str(written))) - order.index(home))
    if distance >= 2:
        entry.flag(
            "CS0814",
            f"{name} is at {written}, {distance} levels from the node's {home.value}",
            key="level",
        )
