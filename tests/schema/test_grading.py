"""Grading a given answer (M4.5 spec, M4R.4): the web app's rule, in Python."""

import re

import pytest

from code_schema import ChoiceAnswer, NumberAnswer, Option, OrderAnswer, SequenceAnswer
from code_schema.grading import NotAnAnswer, is_right, score

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
