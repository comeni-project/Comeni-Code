"""Grading a given answer (M4.5 spec, M4R.4): the web app's rule, in Python."""

import re

import pytest

from code_schema import ChoiceAnswer, NumberAnswer, Option
from code_schema.grading import NotAnAnswer, is_right

CHOICE = ChoiceAnswer(options=(Option("A", right=True), Option("B"), Option("C")))


def test_a_choice_is_right_at_the_right_options_index() -> None:
    assert is_right(CHOICE, 0) is True
    assert is_right(CHOICE, 2) is False


@pytest.mark.parametrize(
    ("given", "says"),
    [
        (3, "there is no option 3 (0 to 2)"),
        (-1, "there is no option -1 (0 to 2)"),
        (True, "a choice is answered with an option's index"),
        (1.0, "a choice is answered with an option's index"),
        ("0", "a choice is answered with an option's index"),
        (None, "a choice is answered with an option's index"),
    ],
)
def test_a_choice_refuses_what_is_not_an_index(given: object, says: str) -> None:
    with pytest.raises(NotAnAnswer, match=f"^{re.escape(says)}$"):
        is_right(CHOICE, given)


def test_a_number_without_tolerance_is_right_only_exactly() -> None:
    answer = NumberAnswer(value=1000000)
    assert is_right(answer, 1000000) is True
    assert is_right(answer, 1000000.0) is True
    assert is_right(answer, 1000001) is False


def test_a_number_is_right_within_its_tolerance_and_the_webs_slack() -> None:
    # apps/web/src/node/TryQuestion.tsx: |given - answer| <= (tolerance ?? 0) + 1e-9
    answer = NumberAnswer(value=0.3, tolerance=0.1)
    assert is_right(answer, 0.4) is True  # 0.4 - 0.3 is 0.10000000000000003 in floats
    assert is_right(answer, 0.2) is True
    assert is_right(answer, 0.41) is False


@pytest.mark.parametrize(
    "given",
    [True, "750000", None, float("nan"), float("inf"), pytest.param(10**400, id="10**400")],
)
def test_a_number_refuses_what_is_not_a_finite_number(given: object) -> None:
    # 10**400 is valid JSON, and past a float: #188 found it raised OverflowError, a 500.
    with pytest.raises(NotAnAnswer, match="^a number question is answered with a finite number$"):
        is_right(NumberAnswer(value=0.5, tolerance=1), given)
