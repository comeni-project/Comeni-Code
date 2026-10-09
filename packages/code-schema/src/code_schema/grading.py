"""Grading a given answer (M4.5 spec, M4R.4).

The web app's rule (`apps/web/src/node/TryQuestion.tsx`) in Python, so the server can grade a
reviewer's answers, and later a self-test, by the same rule a learner meets: a choice is right
at its right option; a number within its tolerance, none meaning exact, with a slack for floats.
A choice is given as an option's index, which the web may move to. A sequence is right in any of
its forms, case and spaces aside unless exact; an order scores the share of step pairs in order,
given as the step texts in the learner's order (M4.8c spec, M4Q.3).
"""

from __future__ import annotations

from code_schema.questions import Answer, ChoiceAnswer, NumberAnswer, OrderAnswer, SequenceAnswer

SLACK = 1e-9  # the web's: 0.4 - 0.3 is not 0.1 in floats


class NotAnAnswer(ValueError):
    """What was given cannot answer this question; its message is a sentence."""


def _is_number(given: object) -> bool:
    """A finite number a float can hold: JSON allows an integer of 4,000 digits (#188)."""
    if isinstance(given, bool) or not isinstance(given, int | float):
        return False
    try:
        as_float = float(given)
    except OverflowError:
        return False
    return as_float == as_float and abs(as_float) != float("inf")  # NaN is unequal to itself


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
            pairs = [(a, b) for at, a in enumerate(steps) for b in steps[at + 1 :]]
            return sum(place[a] < place[b] for a, b in pairs) / len(pairs)
    raise AssertionError(f"an answer of no known kind: {answer!r}")


def is_right(answer: Answer, given: object) -> bool:
    """Right only when wholly right: a partly ordered answer is not (M4Q.3)."""
    return score(answer, given) == 1.0
