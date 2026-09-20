"""A node's try questions, as written in node.yaml (spec M3P1.3, tutor spec T6.2).

A try question is formative: it is asked inside the prose where the marker puts it, gives its
hints one at a time on request, and shows its rationale after either answer. Exam questions
(T7.1) are a different thing and are not these.

`kind` is written rather than inferred from which of options/answer is present, so a refusal can
name what is wrong — and so `kind: figure` can be refused by name until figures arrive in M6.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

from code_schema.fields import one_line, one_of, one_sentence, shown, slug
from code_schema.problems import Problem
from code_schema.yaml_lines import Lines

TRY_FIELD = "try"
KINDS = ("choice", "number")
MAX_HINTS = 3
OPTIONS = (2, 5)

_KEYS = ("id", "kind", "ask", "options", "answer", "unit", "tolerance", "hints", "rationale")
_OPTION_KEYS = ("text", "right")
_LATER_KINDS = {"figure": "a figure question arrives with figures in M6"}

_id = slug(noun="question id")
_kind = one_of(KINDS, noun="kind of question")
_ask = one_sentence(max_len=200)
_hint = one_sentence(max_len=200)
_option = one_line(max_len=120)
_unit = one_line(max_len=20)
_rationale = one_line(max_len=400)

# A number gives the answer away only when it stands alone: "5-mers" is not the answer 5.
_NOT_A_BOUNDARY = re.compile(r"[0-9A-Za-z.\-]")


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


def _states_the_number(hint: str, answer: str) -> bool:
    low, needle = hint.casefold(), answer.casefold()
    start = low.find(needle)
    while start != -1:
        before = low[start - 1] if start else " "
        after = low[start + len(needle) :][:1] or " "
        if not _NOT_A_BOUNDARY.match(before) and not _NOT_A_BOUNDARY.match(after):
            return True
        start = low.find(needle, start + 1)
    return False


def _is_number(value: object) -> bool:
    return isinstance(value, int | float) and not isinstance(value, bool)


def _parse_options(
    value: object, *, question: str, lines: Lines, problem: _Problem
) -> tuple[tuple[Option, ...], bool]:
    """The options of a choice question, and whether they are sound."""
    if not isinstance(value, list):
        problem(f"the options of {question} must be a list")
        return (), False
    options: list[Option] = []
    sound = True
    for entry in value:
        if not isinstance(entry, dict):
            problem(f"{shown(entry)} is not an option — write text: and, on the right one, right:")
            sound = False
            continue
        for key in entry:
            if key not in _OPTION_KEYS:
                problem(
                    f"unknown key `{key}` in an option (text, right)", lines.of(entry, str(key))
                )
                sound = False
        text, right = entry.get("text"), entry.get("right", False)
        if "text" not in entry:
            problem(f"an option of {question} has no text")
            sound = False
            continue
        if (wrong := _option(text)) is not None:
            problem(f"an option of {question} {wrong}", lines.of(entry, "text"))
            sound = False
            continue
        if not isinstance(right, bool):
            problem(f"{shown(right)} is not true or false", lines.of(entry, "right"))
            sound = False
            continue
        options.append(Option(text=str(text), right=right))
    if not sound:
        return (), False

    count = len(options)
    if not OPTIONS[0] <= count <= OPTIONS[1]:
        word = "option" if count == 1 else "options"
        problem(f"the question {question} has {count} {word} (a choice offers 2 to 5)")
        return (), False
    right_count = sum(option.right for option in options)
    if right_count == 0:
        problem(f"the question {question} has no right option")
        return (), False
    if right_count > 1:
        word = "two" if right_count == 2 else str(right_count)
        problem(f"the question {question} has {word} right options")
        return (), False
    return tuple(options), True


class _Problem:
    """Adds a problem for this field, with a line when there is one."""

    def __init__(self, problems: list[Problem], *, file: str, field_line: int | None) -> None:
        self._problems = problems
        self._file = file
        self._field_line = field_line

    def __call__(self, message: str, line: int | None = None) -> None:
        self._problems.append(
            Problem(
                file=self._file,
                field=TRY_FIELD,
                line=self._field_line if line is None else line,
                message=message,
            )
        )


def parse_questions(
    value: object, *, lines: Lines, file: str
) -> tuple[tuple[Question, ...], list[Problem]]:
    """One try: field. Never raises; returns the sound questions and every problem."""
    problems: list[Problem] = []
    field_line = lines.get(TRY_FIELD)
    problem = _Problem(problems, file=file, field_line=field_line)

    if not isinstance(value, list):
        problem("must be a list of questions")
        return (), problems
    if not value:
        problem("an empty list is written by leaving the field out")
        return (), problems

    questions: list[Question] = []
    seen: set[str] = set()

    for entry in value:
        if not isinstance(entry, dict):
            problem(f"{shown(entry)} is not a question")
            continue
        entry_line = next((lines.of(entry, str(key)) for key in entry), field_line)

        def here(message: str, line: int | None = entry_line) -> None:
            problem(message, line)

        sound = True
        for key in entry:
            if key not in _KEYS:
                here(
                    f"unknown key `{key}` in a question ({', '.join(_KEYS)})",
                    lines.of(entry, str(key)),
                )
                sound = False

        identifier = entry.get("id")
        if "id" not in entry:
            here("a question has no id")
            continue
        if (wrong := _id(identifier)) is not None:
            here(wrong, lines.of(entry, "id"))
            continue
        name = str(identifier)

        kind = entry.get("kind")
        if "kind" not in entry:
            here(f"the question {name} has no kind (choice, number)")
            continue
        if isinstance(kind, str) and kind in _LATER_KINDS:
            here(_LATER_KINDS[kind], lines.of(entry, "kind"))
            continue
        if (wrong := _kind(kind)) is not None:
            here(wrong, lines.of(entry, "kind"))
            continue
        kind = str(kind)

        if "ask" not in entry:
            here(f"the question {name} has no ask")
            sound = False
        elif (wrong := _ask(entry["ask"])) is not None:
            here(f"the question asked by {name} {wrong}", lines.of(entry, "ask"))
            sound = False

        options: tuple[Option, ...] = ()
        answer: float | int | None = None
        if kind == "choice":
            if "answer" in entry:
                here(
                    f"the choice question {name} has an answer "
                    "— a choice is answered by its options",
                    lines.of(entry, "answer"),
                )
                sound = False
            if "options" not in entry:
                here(f"the choice question {name} has no options")
                sound = False
            else:
                options, ok = _parse_options(
                    entry["options"], question=name, lines=lines, problem=problem
                )
                sound = sound and ok
        else:
            if "options" in entry:
                here(
                    f"the number question {name} has options "
                    "— a number question is answered with a value",
                    lines.of(entry, "options"),
                )
                sound = False
            if "answer" not in entry:
                here(f"the number question {name} has no answer")
                sound = False
            elif not _is_number(entry["answer"]):
                here(f"the answer of {name} is not a number", lines.of(entry, "answer"))
                sound = False
            else:
                answer = entry["answer"]

        unit = entry.get("unit", "")
        if "unit" in entry:
            if kind != "number":
                here(f"the choice question {name} has a unit", lines.of(entry, "unit"))
                sound = False
            elif (wrong := _unit(unit)) is not None:
                here(f"the unit of {name} {wrong}", lines.of(entry, "unit"))
                sound = False
        tolerance = entry.get("tolerance")
        if "tolerance" in entry:
            if kind != "number":
                here(f"the choice question {name} has a tolerance", lines.of(entry, "tolerance"))
                sound = False
            elif not _is_number(tolerance) or float(str(tolerance)) < 0:
                here(
                    f"the tolerance of {name} is not a number of 0 or more",
                    lines.of(entry, "tolerance"),
                )
                sound = False

        hints: tuple[str, ...] = ()
        if "hints" not in entry:
            here(f"the question {name} has no hints")
            sound = False
        elif not isinstance(entry["hints"], list) or not entry["hints"]:
            here(
                f"the hints of {name} must be a list, one hint at a time",
                lines.of(entry, "hints"),
            )
            sound = False
        elif len(entry["hints"]) > MAX_HINTS:
            here(
                f"the question {name} has {len(entry['hints'])} hints (at most {MAX_HINTS})",
                lines.of(entry, "hints"),
            )
            sound = False
        else:
            wrong_hints = [_hint(hint) for hint in entry["hints"]]
            for found in wrong_hints:
                if found is not None:
                    here(f"a hint for {name} {found}", lines.of(entry, "hints"))
                    sound = False
            if not any(wrong_hints):
                hints = tuple(str(hint) for hint in entry["hints"])

        rationale = entry.get("rationale", "")
        if "rationale" not in entry:
            here(f"the question {name} has no rationale")
            sound = False
        elif (wrong := _rationale(rationale)) is not None:
            here(f"the rationale of {name} {wrong}", lines.of(entry, "rationale"))
            sound = False

        if sound:
            given = str(answer) if kind == "number" else ""
            right = next((option.text for option in options if option.right), "")
            for hint in hints:
                gives = (
                    _states_the_number(hint, given)
                    if kind == "number"
                    else right.casefold() in hint.casefold()
                )
                if gives:
                    here(f"a hint for {name} contains the answer", lines.of(entry, "hints"))
                    sound = False
                    break

        if not sound:
            continue
        if name in seen:
            here(f"{name} is asked twice in this node", lines.of(entry, "id"))
            continue
        seen.add(name)
        questions.append(
            Question(
                id=name,
                kind=kind,
                ask=str(entry["ask"]),
                hints=hints,
                rationale=str(rationale),
                options=options,
                answer=answer,
                unit=str(unit),
                tolerance=tolerance if _is_number(tolerance) else None,
            )
        )
    return tuple(questions), problems
