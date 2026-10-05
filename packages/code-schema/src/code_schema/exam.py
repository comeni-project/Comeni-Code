"""A node's exam pool, in exam.yaml beside node.yaml (spec M4E.1, M4E.3; tutor spec T7.1).

An exam question is asked in a self-test, never in the prose: it has no hints, may carry its own
level, and a wrong option may name the misconception it targets. How it is answered, and the rules
for that, are the try question's (`code_schema.questions`), so a rule reads the same in both pools.
The pool's own rules are here.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING

from code_schema.blocks import Callout
from code_schema.fields import one_of, shown
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
from code_schema.records import Field
from code_schema.yaml_lines import load_mapping

if TYPE_CHECKING:
    from code_schema.node import Node

EXAM_FILE = "exam.yaml"
EXAM_FIELD = "exam"
MAX_EXAM = 40

_KEYS = ("id", "kind", "ask", "level", "options", "answer", "unit", "tolerance", "rationale")
_OPTIONS = OptionRules(
    keys=("text", "right", "misconception"), code="CS0808", noun="an exam option"
)
_level = one_of(tuple(Level), noun="level")


@dataclass(frozen=True)
class ExamQuestion:
    """A question asked in a self-test (T7.1). `level` is None when it is the node's own."""

    id: str
    ask: str
    answer: Answer
    level: Level | None
    rationale: str

    @property
    def kind(self) -> str:
        return self.answer.kind


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
        if (head := read_head(entry)) is None:
            continue
        name, kind = head
        if "hints" in written:
            entry.problem(
                "CS0807",
                f"the exam question {name} has hints — a self-test gives none",
                key="hints",
            )
        entry.check("level", _level, prefix=f"the level of {name} ")
        answer = read_answer(entry, name, kind, field, rules=_OPTIONS)
        rationale = read_rationale(entry, name)

        if isinstance(answer, ChoiceAnswer):
            written_options = written["options"]
            assert isinstance(written_options, list)  # a sound choice wrote a list of mappings
            for item, option in zip(written_options, answer.options, strict=True):
                if not option.misconception:
                    continue
                line = lines.of(item, "misconception")
                if option.right:
                    entry.problem(
                        "CS0810",
                        f"the right option of {name} names a misconception "
                        "— only a wrong option can",
                        line=line,
                    )
                elif misconceptions is not None and option.misconception not in misconceptions:
                    entry.problem(
                        "CS0809",
                        f"`{option.misconception}` names no misconception callout in body.md",
                        line=line,
                    )
        if try_ids is not None and name in try_ids:
            entry.problem(
                "CS0811",
                f"{name} is already a try question in node.yaml "
                "— a node's question ids are shared by both pools",
                key="id",
            )

        if not entry.sound:
            continue
        assert answer is not None  # a sound entry has a sound answer
        level = written.get("level")
        question = ExamQuestion(
            id=name,
            ask=str(written["ask"]),
            answer=answer,
            level=None if level is None else Level(str(level)),
            rationale=rationale,
        )
        if repeated(entry, name, seen):
            continue
        questions.append(question)
    return tuple(questions), problems
