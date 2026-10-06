"""Grading a given answer (M4.5 spec, M4R.4).

The web app's rule (`apps/web/src/node/TryQuestion.tsx`) in Python, so the server can grade a
reviewer's answers, and later a self-test, by the same rule a learner meets: a choice is right
at its right option; a number within its tolerance, none meaning exact, with a slack for floats.
A choice is given as an option's index, which the web may move to.
"""

from __future__ import annotations

from code_schema.questions import Answer, ChoiceAnswer, NumberAnswer

SLACK = 1e-9  # the web's: 0.4 - 0.3 is not 0.1 in floats


class NotAnAnswer(ValueError):
    """What was given cannot answer this question; its message is a sentence."""


def _is_number(given: object) -> bool:
    if isinstance(given, bool) or not isinstance(given, int | float):
        return False
    return given == given and abs(given) != float("inf")  # NaN is unequal to itself


def is_right(answer: Answer, given: object) -> bool:
    match answer:
        case ChoiceAnswer(options=options):
            if isinstance(given, bool) or not isinstance(given, int):
                raise NotAnAnswer("a choice is answered with an option's index")
            if not 0 <= given < len(options):
                raise NotAnAnswer(f"there is no option {given} (0 to {len(options) - 1})")
            return options[given].right
        case NumberAnswer(value=value, tolerance=tolerance):
            if not _is_number(given):
                raise NotAnAnswer("a number question is answered with a finite number")
            assert isinstance(given, int | float)
            return abs(given - value) <= (tolerance or 0) + SLACK
    raise AssertionError(f"an answer of no known kind: {answer!r}")
