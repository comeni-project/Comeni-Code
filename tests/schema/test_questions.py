"""A node's try questions (spec M3P1.3, tutor spec T6.2)."""

from typing import Any

import pytest

from code_schema.problems import Problem
from code_schema.questions import ChoiceAnswer, NumberAnswer, TryQuestion, parse_questions
from code_schema.yaml_lines import load_mapping

NUMBER = """try:
  - id: kmer-count
    kind: number
    ask: How many 5-mers does a 100-base read contain?
    answer: 96
    hints:
      - Every position where a window of width k still fits gives one k-mer.
    rationale: A read of length L has L − k + 1 k-mers.
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
    rationale: V holds the (k−1)-mers and E holds the k-mers.
"""


def parse(text: str) -> Any:
    data, lines, problems = load_mapping(text, file="node.yaml")
    assert data is not None
    assert problems == []
    return parse_questions(data["try"], lines=lines, file="node.yaml")


def messages(problems: list[Problem]) -> list[str]:
    return [problem.message for problem in problems]


def codes(problems: list[Problem]) -> list[str | None]:
    return [problem.code for problem in problems]


def test_a_number_question_is_read() -> None:
    questions, problems = parse(NUMBER)
    assert problems == []
    assert questions[0].id == "kmer-count"
    assert questions[0].kind == "number"
    assert questions[0].answer == NumberAnswer(value=96)
    assert isinstance(questions[0], TryQuestion)


def test_a_number_question_may_carry_a_unit_and_a_tolerance() -> None:
    questions, problems = parse(NUMBER + "    unit: bases\n    tolerance: 0.5\n")
    assert problems == []
    assert questions[0].answer == NumberAnswer(value=96, unit="bases", tolerance=0.5)


def test_a_choice_question_is_read() -> None:
    questions, problems = parse(CHOICE)
    assert problems == []
    answer = questions[0].answer
    assert isinstance(answer, ChoiceAnswer)
    assert [option.text for option in answer.options] == ["An edge", "A node"]
    assert [option.right for option in answer.options] == [True, False]


def test_a_choice_needs_a_right_option() -> None:
    _, problems = parse(CHOICE.replace("        right: true\n", ""))
    assert messages(problems) == ["the question node-or-edge has no right option"]
    assert codes(problems) == ["CS0328"]


def test_a_choice_has_only_one_right_option() -> None:
    both = CHOICE.replace("      - text: A node", "      - text: A node\n        right: true")
    _, problems = parse(both)
    assert messages(problems) == ["the question node-or-edge has two right options"]
    assert codes(problems) == ["CS0329"]


def test_a_choice_needs_at_least_two_options() -> None:
    _, problems = parse(CHOICE.replace("      - text: A node\n", ""))
    assert messages(problems) == ["the question node-or-edge has 1 option (a choice offers 2 to 5)"]
    assert codes(problems) == ["CS0327"]


def test_a_choice_offers_at_most_five_options() -> None:
    more = "      - text: Something else\n" * 4
    _, problems = parse(CHOICE.replace("      - text: A node\n", "      - text: A node\n" + more))
    assert messages(problems) == [
        "the question node-or-edge has 6 options (a choice offers 2 to 5)"
    ]
    assert codes(problems) == ["CS0327"]


def test_a_number_question_needs_an_answer() -> None:
    _, problems = parse(NUMBER.replace("    answer: 96\n", ""))
    assert messages(problems) == ["the number question kmer-count has no answer"]
    assert codes(problems) == ["CS0311"]


def test_a_choice_question_needs_options() -> None:
    text = CHOICE.split("    options:")[0] + "    hints:" + CHOICE.split("    hints:")[1]
    _, problems = parse(text)
    assert messages(problems) == ["the choice question node-or-edge has no options"]
    assert codes(problems) == ["CS0309"]


def test_options_on_a_number_question_are_refused() -> None:
    _, problems = parse(NUMBER + "    options:\n      - text: 96\n        right: true\n")
    assert messages(problems) == [
        "the number question kmer-count has options — a number question is answered with a value"
    ]
    assert codes(problems) == ["CS0310"]


def test_an_answer_on_a_choice_question_is_refused() -> None:
    _, problems = parse(CHOICE + "    answer: 2\n")
    assert messages(problems) == [
        "the choice question node-or-edge has an answer — a choice is answered by its options"
    ]
    assert codes(problems) == ["CS0308"]


def test_a_figure_question_names_m6() -> None:
    _, problems = parse(NUMBER.replace("kind: number", "kind: figure"))
    assert messages(problems) == ["a figure question arrives with figures in M6"]
    assert codes(problems) == ["CS0306"]


def test_another_kind_lists_the_four() -> None:
    _, problems = parse(NUMBER.replace("kind: number", "kind: essay"))
    assert messages(problems) == [
        '"essay" is not a kind of question (choice, number, sequence, order)'
    ]
    assert codes(problems) == ["CS0012"]


def test_hints_and_a_rationale_are_required() -> None:
    _, problems = parse(NUMBER.split("    hints:")[0])
    assert messages(problems) == [
        "the question kmer-count has no hints",
        "the question kmer-count has no rationale",
    ]
    assert codes(problems) == ["CS0316", "CS0320"]


def test_at_most_three_hints() -> None:
    hint = "      - Another hint written for this question.\n"
    _, problems = parse(NUMBER.replace("    rationale:", hint * 3 + "    rationale:"))
    assert messages(problems) == ["the question kmer-count has 4 hints (at most 3)"]
    assert codes(problems) == ["CS0318"]


def test_a_hint_may_not_contain_a_number_answer() -> None:
    _, problems = parse(NUMBER.replace("gives one k-mer.", "gives one of the 96 k-mers."))
    assert messages(problems) == ["a hint for kmer-count contains the answer"]
    assert codes(problems) == ["CS0319"]


def test_a_hint_may_say_5_mers_when_the_answer_is_5() -> None:
    text = NUMBER.replace("answer: 96", "answer: 5").replace(
        "Every position where a window of width k still fits gives one k-mer.",
        "Count the 5-mers the window covers, one per position.",
    )
    _, problems = parse(text)
    assert problems == []


def test_a_hint_may_not_contain_the_right_option() -> None:
    _, problems = parse(CHOICE.replace("puts in V and what it puts in E.", "calls an edge."))
    assert messages(problems) == ["a hint for node-or-edge contains the answer"]
    assert codes(problems) == ["CS0319"]


def test_a_rationale_may_contain_the_answer() -> None:
    questions, problems = parse(NUMBER.replace("L − k + 1 k-mers.", "96 k-mers, since L − k + 1."))
    assert problems == []
    assert questions[0].rationale.startswith("A read of length L has 96")


def test_two_questions_may_not_share_an_id() -> None:
    _, problems = parse(NUMBER + NUMBER.split("\n", 1)[1])
    assert messages(problems) == ["kmer-count is asked twice in this node"]
    assert codes(problems) == ["CS0321"]


def test_an_id_must_be_a_slug() -> None:
    _, problems = parse(NUMBER.replace("id: kmer-count", "id: Kmer Count"))
    assert messages(problems) == [
        '"Kmer Count" is not a question id (lower case, digits and single hyphens)'
    ]
    assert codes(problems) == ["CS0015"]


def test_an_unknown_key_is_a_problem() -> None:
    _, problems = parse(NUMBER + "    note: hello\n")
    assert messages(problems)[0].startswith("unknown key `note` in a question")
    assert codes(problems)[0] == "CS0303"


def test_the_list_must_be_a_list() -> None:
    _, problems = parse("try: a question\n")
    assert messages(problems) == ["must be a list of questions"]
    assert codes(problems) == ["CS0301"]


def test_an_empty_list_is_written_by_leaving_the_field_out() -> None:
    _, problems = parse("try: []\n")
    assert messages(problems) == ["an empty list is written by leaving the field out"]
    assert codes(problems) == ["CS0019"]


# Checkpoint 2 (M4.1.1): every code a question can carry is pinned to the message it labels,
# composed sentences included, so swapping two codes fails a test.
PINNED = [
    ("try:\n  - just text\n", "CS0302", '"just text" is not a question'),
    (NUMBER + "    note: hello\n", "CS0303", "unknown key `note` in a question"),
    (NUMBER.replace("  - id: kmer-count\n    kind", "  - kind"), "CS0304", "a question has no id"),
    (NUMBER.replace("    kind: number\n", ""), "CS0305", "has no kind"),
    (
        NUMBER.replace("    ask: How many 5-mers does a 100-base read contain?\n", ""),
        "CS0307",
        "no ask",
    ),
    (
        NUMBER.replace("answer: 96", "answer: many"),
        "CS0312",
        "the answer of kmer-count is not a number",
    ),
    (CHOICE + "    unit: bases\n", "CS0313", "has a unit"),
    (CHOICE + "    tolerance: 1\n", "CS0314", "has a tolerance"),
    (NUMBER + "    tolerance: -1\n", "CS0315", "is not a number of 0 or more"),
    (
        NUMBER.replace(
            "    hints:\n"
            "      - Every position where a window of width k still fits gives one k-mer.\n",
            "    hints: one hint\n",
        ),
        "CS0317",
        "must be a list, one hint at a time",
    ),
    (
        CHOICE.replace(
            "    options:\n      - text: An edge\n        right: true\n      - text: A node\n",
            "    options: both\n",
        ),
        "CS0322",
        "the options of node-or-edge must be a list",
    ),
    (CHOICE.replace("      - text: A node\n", "      - A node\n"), "CS0323", "is not an option"),
    (
        CHOICE.replace("      - text: A node\n", "      - text: A node\n        why: x\n"),
        "CS0324",
        "in an option",
    ),
    (CHOICE.replace("      - text: A node\n", "      - right: false\n"), "CS0325", "has no text"),
    (
        CHOICE.replace("        right: true\n", "        right: yes please\n"),
        "CS0326",
        "is not true or false",
    ),
    # Composed sentences keep the code of the check that failed.
    (
        NUMBER.replace("a 100-base read contain?", "a 100-base read contain"),
        "CS0011",
        "the question asked by kmer-count",
    ),
    (NUMBER + '    unit: ""\n', "CS0008", "the unit of kmer-count must not be empty"),
    (NUMBER.replace("gives one k-mer.", "gives one k-mer"), "CS0011", "a hint for kmer-count"),
    (
        NUMBER.replace("rationale: A read of length L has L − k + 1 k-mers.", 'rationale: ""'),
        "CS0008",
        "the rationale of kmer-count must not be empty",
    ),
    (
        CHOICE.replace("      - text: A node\n", '      - text: ""\n'),
        "CS0008",
        "an option of node-or-edge must not be empty",
    ),
]


@pytest.mark.parametrize(
    ("text", "code", "said"), PINNED, ids=[f"{c}:{s[:24]}" for _, c, s in PINNED]
)
def test_each_question_code_labels_its_message(text: str, code: str, said: str) -> None:
    _, problems = parse(text)
    assert any(problem.code == code and said in problem.message for problem in problems), [
        (problem.code, problem.message) for problem in problems
    ]


def test_a_question_composes_its_answer() -> None:
    # M4.2 (spec M4E.2): the answer is a choice or a number; the question is its pool's.
    (number,), _ = parse(NUMBER)
    (choice,), _ = parse(CHOICE)
    assert isinstance(number.answer, NumberAnswer) and number.kind == "number"
    assert isinstance(choice.answer, ChoiceAnswer) and choice.kind == "choice"
    assert not hasattr(number.answer, "options")
    assert not hasattr(choice.answer, "value")


@pytest.mark.parametrize("value", [".nan", ".inf", "-.inf"])
def test_a_number_answer_must_be_finite(value: str) -> None:
    # #173: no answer or tolerance is infinite or not a number.
    _, problems = parse(NUMBER.replace("answer: 96", f"answer: {value}"))
    assert codes(problems) == ["CS0312"]
    _, problems = parse(NUMBER + f"    tolerance: {value}\n")
    assert codes(problems) == ["CS0315"]
