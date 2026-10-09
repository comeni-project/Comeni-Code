"""A node's try questions, as written in node.yaml (spec M3P1.3, tutor spec T6.2).

A try question is formative: it is asked inside the prose where the marker puts it, gives its
hints one at a time on request, and shows its rationale after either answer. Exam questions
(T7.1) are a different thing and are not these.

`kind` is written rather than inferred from which of options/answer is present, so a refusal can
name what is wrong — and so `kind: figure` can be refused by name until figures arrive in M6.
"""

from __future__ import annotations

import re
from collections.abc import Sequence
from dataclasses import dataclass
from typing import ClassVar, TypeGuard

from code_schema.fields import one_line, one_of, one_sentence, shown, slug
from code_schema.problems import Problem
from code_schema.records import Entry, Field
from code_schema.yaml_lines import Lines

TRY_FIELD = "try"
KINDS = ("choice", "number", "sequence", "order")
MAX_HINTS = 3
OPTIONS = (2, 5)
STEPS = (3, 8)

_KEYS = (
    "id",
    "kind",
    "ask",
    "options",
    "answer",
    "unit",
    "tolerance",
    "accept",
    "exact",
    "steps",
    "hints",
    "rationale",
)
# Which fields answer each kind (M4.8c spec, M4Q.3); a field of another kind is refused.
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
_LATER_KINDS = {"figure": ("CS0306", "a figure question arrives with figures in M6")}

_id = slug(noun="question id")
_kind = one_of(KINDS, noun="kind of question")
_ask = one_sentence(max_len=200)
_hint = one_sentence(max_len=200)
_option = one_line(max_len=120)
_unit = one_line(max_len=20)
_rationale = one_line(max_len=400)
_step = one_line(max_len=120)
_accepted = one_line(max_len=200)


@dataclass(frozen=True)
class OptionRules:
    """What a pool's options may hold, and how an unknown key in one is reported (spec M4E.3)."""

    keys: tuple[str, ...]
    code: str
    noun: str
    minimum: int = 2  # how few options a choice may offer


TRY_OPTIONS = OptionRules(keys=("text", "right"), code="CS0324", noun="an option")

# A number gives the answer away only when it stands alone: "5-mers" is not the answer 5.
_NOT_A_BOUNDARY = re.compile(r"[0-9A-Za-z.\-]")


@dataclass(frozen=True)
class Option:
    text: str
    right: bool = False
    # An exam option's link to a misconception callout by title (spec M4E.1); never on a try.
    misconception: str = ""
    # An exam option wrong on purpose, naming no misconception (M4.8c spec, M4Q.3).
    plain: bool = False


@dataclass(frozen=True)
class ChoiceAnswer:
    """Answered by picking one of its options; exactly one is right."""

    kind: ClassVar[str] = "choice"
    options: tuple[Option, ...]


@dataclass(frozen=True)
class NumberAnswer:
    """Answered with a value, right within its tolerance."""

    kind: ClassVar[str] = "number"
    value: float | int
    unit: str = ""
    tolerance: float | int | None = None


@dataclass(frozen=True)
class SequenceAnswer:
    """Answered by typing: case and spaces ignored unless `exact`; any accepted form is right."""

    kind: ClassVar[str] = "sequence"
    value: str
    accept: tuple[str, ...] = ()
    exact: bool = False


@dataclass(frozen=True)
class OrderAnswer:
    """Answered by putting the steps in order; written in the right one (M4.8c spec, M4Q.3)."""

    kind: ClassVar[str] = "order"
    steps: tuple[str, ...]


# How a question is answered, whichever pool it is in (spec M4E.2). A new kind joins here, once.
Answer = ChoiceAnswer | NumberAnswer | SequenceAnswer | OrderAnswer


def _same(texts: Sequence[str]) -> bool:
    """Whether two texts read the same, case and surrounding spaces aside."""
    seen = [text.strip().casefold() for text in texts]
    return len(set(seen)) < len(seen)


@dataclass(frozen=True)
class TryQuestion:
    """A question asked inside the prose, with hints. Exam questions are not these (M4E.2)."""

    id: str
    ask: str
    answer: Answer
    hints: tuple[str, ...]
    rationale: str

    @property
    def kind(self) -> str:
        return self.answer.kind


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


def _is_number(value: object) -> TypeGuard[int | float]:
    """A finite number: YAML's .nan and .inf are floats, but no answer is either (#173)."""
    if not isinstance(value, int | float) or isinstance(value, bool):
        return False
    return value == value and value not in (float("inf"), float("-inf"))


def _parse_options(
    value: object, *, question: str, field: Field, rules: OptionRules
) -> tuple[tuple[Option, ...], bool]:
    """The options of a choice question, and whether they are sound.

    Reported at the field: an option has no line of its own until it is a mapping. Not through
    `Field.entries`, because no options is the count's problem here, not an empty field.
    """
    if not isinstance(value, list):
        field.problem("CS0322", f"the options of {question} must be a list")
        return (), False
    options: list[Option] = []
    sound = True
    for item in value:
        if not isinstance(item, dict):
            field.problem(
                "CS0323",
                f"{shown(item)} is not an option — write text: and, on the right one, right:",
            )
            sound = False
            continue
        option = Entry(item, field)
        option.unknown(
            rules.keys,
            rules.code,
            lambda key: f"unknown key `{key}` in {rules.noun} ({', '.join(rules.keys)})",
        )
        text, right = item.get("text"), item.get("right", False)
        if "text" not in item:
            field.problem("CS0325", f"an option of {question} has no text")
            sound = False
            continue
        if not option.check("text", _option, prefix=f"an option of {question} "):
            sound = False
            continue
        if not isinstance(right, bool):
            option.problem("CS0326", f"{shown(right)} is not true or false", key="right")
            sound = False
            continue
        misconception = item.get("misconception", "")
        if "misconception" in rules.keys and not option.check(
            "misconception", _option, prefix=f"a misconception in {question}: "
        ):
            sound = False
            continue
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
    if not sound:
        return (), False

    count = len(options)
    if not rules.minimum <= count <= OPTIONS[1]:
        word = "option" if count == 1 else "options"
        field.problem(
            "CS0327", f"the question {question} has {count} {word} (a choice offers 2 to 5)"
        )
        return (), False
    right_count = sum(option.right for option in options)
    if right_count == 0:
        field.problem("CS0328", f"the question {question} has no right option")
        return (), False
    if right_count > 1:
        word = "two" if right_count == 2 else str(right_count)
        field.problem("CS0329", f"the question {question} has {word} right options")
        return (), False
    if _same([option.text for option in options]):
        field.problem("CS0335", f"two options of {question} say the same thing")
        return (), False
    return tuple(options), True


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


def _refusals(field: Field) -> int:
    """How many problems so far refuse; a warning never makes an answer unreadable (M4E.4)."""
    return sum(problem.refuses for problem in field.problems)


def read_answer(
    entry: Entry, name: str, kind: str, field: Field, *, rules: OptionRules = TRY_OPTIONS
) -> Answer | None:
    """A question's answer: options for a choice; a value, unit and tolerance for a number; typed
    text for a sequence; steps for an order (M4.8c spec, M4Q.3).

    Shared by every pool (spec M4E.2), so its rules and messages read the same wherever a question
    is asked. None when the answer itself is wrong, with the problems recorded on `entry`. An answer
    that reads cleanly is returned even when another field is wrong, so the pool's own checks on it
    still run in the same pass (#149); a caller keeps a question only when the entry is sound.
    """
    written = entry.mapping
    before = _refusals(field)
    options: tuple[Option, ...] = ()
    value: float | int | None = None
    typed: SequenceAnswer | None = None
    steps: tuple[str, ...] = ()
    answering = {key for fields in _FIELDS.values() for key in fields}
    for key in [str(key) for key in written if key in answering]:
        if key not in _FIELDS[kind]:
            entry.problem(_PINNED.get((kind, key), "CS0337"), _foreign(kind, name, key), key=key)
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
        typed = _read_sequence(entry, name)
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
            assert typed is not None  # CS0330–CS0332 refuse the rest
            return typed
    return OrderAnswer(steps=steps)


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
    """A typed answer, the other forms it accepts, and whether it is matched exactly."""
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
    """An order's steps, as written: in the right order."""
    steps = entry.mapping.get("steps")
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


def read_head(entry: Entry, *, ask: bool = True) -> tuple[str, str] | None:
    """A question's id and kind, its ask checked; None when it cannot be named or checked further.

    Shared by every pool (spec M4E.3).
    """
    written = entry.mapping
    if not entry.require("id", "CS0304", "a question has no id") or not entry.check("id", _id):
        return None
    name = str(written["id"])
    kind = written.get("kind")
    if not entry.require("kind", "CS0305", f"the question {name} has no kind ({', '.join(KINDS)})"):
        return None
    if isinstance(kind, str) and kind in _LATER_KINDS:
        entry.problem(*_LATER_KINDS[kind], key="kind")
        return None
    if not entry.check("kind", _kind):
        return None
    if ask and entry.require("ask", "CS0307", f"the question {name} has no ask"):
        entry.check("ask", _ask, prefix=f"the question asked by {name} ")
    return name, str(kind)


def read_rationale(entry: Entry, name: str) -> str:
    rationale = entry.mapping.get("rationale", "")
    if entry.require("rationale", "CS0320", f"the question {name} has no rationale"):
        entry.check("rationale", _rationale, prefix=f"the rationale of {name} ")
    return str(rationale)


def repeated(entry: Entry, name: str, seen: set[str]) -> bool:
    """Whether `name` was already asked in this pool; the first time, it is remembered."""
    if name in seen:
        entry.problem("CS0321", f"{name} is asked twice in this node", key="id")
        return True
    seen.add(name)
    return False


def _read_hints(entry: Entry, name: str) -> tuple[str, ...]:
    """A question's hints, one at a time, when every one is sound."""
    if not entry.require("hints", "CS0316", f"the question {name} has no hints"):
        return ()
    given = entry.mapping["hints"]
    if not isinstance(given, list) or not given:
        entry.problem(
            "CS0317", f"the hints of {name} must be a list, one hint at a time", key="hints"
        )
        return ()
    if len(given) > MAX_HINTS:
        entry.problem(
            "CS0318",
            f"the question {name} has {len(given)} hints (at most {MAX_HINTS})",
            key="hints",
        )
        return ()
    wrong_hints = [_hint(hint) for hint in given]
    for found in wrong_hints:
        if found is not None:
            entry.problem(found.code, f"a hint for {name} {found.message}", key="hints")
    return () if any(wrong_hints) else tuple(str(hint) for hint in given)


def parse_questions(
    value: object, *, lines: Lines, file: str
) -> tuple[tuple[TryQuestion, ...], list[Problem]]:
    """One try: field. Never raises; returns the sound questions and every problem."""
    problems: list[Problem] = []
    field = Field(TRY_FIELD, lines=lines, file=file, problems=problems)
    questions: list[TryQuestion] = []
    seen: set[str] = set()

    for entry in field.entries(
        value,
        not_a_list=("CS0301", "must be a list of questions"),
        not_a_mapping=("CS0302", lambda item: f"{shown(item)} is not a question"),
    ):
        written = entry.mapping
        entry.unknown(
            _KEYS, "CS0303", lambda key: f"unknown key `{key}` in a question ({', '.join(_KEYS)})"
        )

        # A question with no sound id or kind cannot be named or checked further.
        if (head := read_head(entry)) is None:
            continue
        name, kind = head

        answer = read_answer(entry, name, kind, field)

        hints = _read_hints(entry, name)
        rationale = read_rationale(entry, name)

        if not entry.sound:
            continue
        assert answer is not None  # a sound entry has a sound answer
        question = TryQuestion(
            id=name,
            ask=str(written["ask"]),
            answer=answer,
            hints=hints,
            rationale=rationale,
        )
        if any(_gives_the_answer(hint, answer) for hint in hints):
            entry.problem("CS0319", f"a hint for {name} contains the answer", key="hints")
            continue
        if repeated(entry, name, seen):
            continue
        questions.append(question)
    return tuple(questions), problems
