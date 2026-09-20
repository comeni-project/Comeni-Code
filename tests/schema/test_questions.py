"""A node's try questions (spec M3P1.3, tutor spec T6.2)."""

from typing import Any

from code_schema.problems import Problem
from code_schema.questions import parse_questions
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


def test_a_number_question_is_read() -> None:
    questions, problems = parse(NUMBER)
    assert problems == []
    assert questions[0].id == "kmer-count"
    assert questions[0].kind == "number"
    assert questions[0].answer == 96
    assert questions[0].unit == ""
    assert questions[0].tolerance is None
    assert questions[0].options == ()


def test_a_number_question_may_carry_a_unit_and_a_tolerance() -> None:
    questions, problems = parse(NUMBER + "    unit: bases\n    tolerance: 0.5\n")
    assert problems == []
    assert questions[0].unit == "bases"
    assert questions[0].tolerance == 0.5


def test_a_choice_question_is_read() -> None:
    questions, problems = parse(CHOICE)
    assert problems == []
    assert [option.text for option in questions[0].options] == ["An edge", "A node"]
    assert [option.right for option in questions[0].options] == [True, False]
    assert questions[0].answer is None


def test_a_choice_needs_a_right_option() -> None:
    _, problems = parse(CHOICE.replace("        right: true\n", ""))
    assert messages(problems) == ["the question node-or-edge has no right option"]


def test_a_choice_has_only_one_right_option() -> None:
    both = CHOICE.replace("      - text: A node", "      - text: A node\n        right: true")
    _, problems = parse(both)
    assert messages(problems) == ["the question node-or-edge has two right options"]


def test_a_choice_needs_at_least_two_options() -> None:
    _, problems = parse(CHOICE.replace("      - text: A node\n", ""))
    assert messages(problems) == ["the question node-or-edge has 1 option (a choice offers 2 to 5)"]


def test_a_choice_offers_at_most_five_options() -> None:
    more = "      - text: Something else\n" * 4
    _, problems = parse(CHOICE.replace("      - text: A node\n", "      - text: A node\n" + more))
    assert messages(problems) == [
        "the question node-or-edge has 6 options (a choice offers 2 to 5)"
    ]


def test_a_number_question_needs_an_answer() -> None:
    _, problems = parse(NUMBER.replace("    answer: 96\n", ""))
    assert messages(problems) == ["the number question kmer-count has no answer"]


def test_a_choice_question_needs_options() -> None:
    text = CHOICE.split("    options:")[0] + "    hints:" + CHOICE.split("    hints:")[1]
    _, problems = parse(text)
    assert messages(problems) == ["the choice question node-or-edge has no options"]


def test_options_on_a_number_question_are_refused() -> None:
    _, problems = parse(NUMBER + "    options:\n      - text: 96\n        right: true\n")
    assert messages(problems) == [
        "the number question kmer-count has options — a number question is answered with a value"
    ]


def test_an_answer_on_a_choice_question_is_refused() -> None:
    _, problems = parse(CHOICE + "    answer: 2\n")
    assert messages(problems) == [
        "the choice question node-or-edge has an answer — a choice is answered by its options"
    ]


def test_a_figure_question_names_m6() -> None:
    _, problems = parse(NUMBER.replace("kind: number", "kind: figure"))
    assert messages(problems) == ["a figure question arrives with figures in M6"]


def test_another_kind_lists_the_two() -> None:
    _, problems = parse(NUMBER.replace("kind: number", "kind: essay"))
    assert messages(problems) == ['"essay" is not a kind of question (choice, number)']


def test_hints_and_a_rationale_are_required() -> None:
    _, problems = parse(NUMBER.split("    hints:")[0])
    assert messages(problems) == [
        "the question kmer-count has no hints",
        "the question kmer-count has no rationale",
    ]


def test_at_most_three_hints() -> None:
    hint = "      - Another hint written for this question.\n"
    _, problems = parse(NUMBER.replace("    rationale:", hint * 3 + "    rationale:"))
    assert messages(problems) == ["the question kmer-count has 4 hints (at most 3)"]


def test_a_hint_may_not_contain_a_number_answer() -> None:
    _, problems = parse(NUMBER.replace("gives one k-mer.", "gives one of the 96 k-mers."))
    assert messages(problems) == ["a hint for kmer-count contains the answer"]


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


def test_a_rationale_may_contain_the_answer() -> None:
    questions, problems = parse(NUMBER.replace("L − k + 1 k-mers.", "96 k-mers, since L − k + 1."))
    assert problems == []
    assert questions[0].rationale.startswith("A read of length L has 96")


def test_two_questions_may_not_share_an_id() -> None:
    _, problems = parse(NUMBER + NUMBER.split("\n", 1)[1])
    assert messages(problems) == ["kmer-count is asked twice in this node"]


def test_an_id_must_be_a_slug() -> None:
    _, problems = parse(NUMBER.replace("id: kmer-count", "id: Kmer Count"))
    assert messages(problems) == [
        '"Kmer Count" is not a question id (lower case, digits and single hyphens)'
    ]


def test_an_unknown_key_is_a_problem() -> None:
    _, problems = parse(NUMBER + "    note: hello\n")
    assert messages(problems)[0].startswith("unknown key `note` in a question")


def test_the_list_must_be_a_list() -> None:
    _, problems = parse("try: a question\n")
    assert messages(problems) == ["must be a list of questions"]


def test_an_empty_list_is_written_by_leaving_the_field_out() -> None:
    _, problems = parse("try: []\n")
    assert messages(problems) == ["an empty list is written by leaving the field out"]
