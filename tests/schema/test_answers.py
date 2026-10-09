"""The answer kinds both pools share (M4.8c spec, M4Q.3): sequence and order, distinct options."""

from typing import Any

from code_schema.problems import Problem
from code_schema.questions import OrderAnswer, SequenceAnswer, parse_questions
from code_schema.yaml_lines import load_mapping

HEAD = """try:
  - id: spell-it
    ask: What does the path spell?
"""
TAIL = """    hints:
      - Read one letter per edge.
    rationale: Each edge adds the last letter of its k-mer.
"""


def parse(text: str) -> Any:
    data, lines, problems = load_mapping(text, file="node.yaml")
    assert data is not None and problems == []
    return parse_questions(data["try"], lines=lines, file="node.yaml")


def codes(problems: list[Problem]) -> list[str | None]:
    return [problem.code for problem in problems]


def sequence(extra: str = "    answer: ACGTTGA\n") -> str:
    return HEAD + "    kind: sequence\n" + extra + TAIL


def order(steps: list[str]) -> str:
    written = "".join(f"      - {step}\n" for step in steps)
    return HEAD + "    kind: order\n    steps:\n" + written + TAIL


def test_a_sequence_question_is_read() -> None:
    questions, problems = parse(sequence("    answer: ACGTTGA\n    accept:\n      - ACGTTGA*\n"))
    assert problems == []
    assert questions[0].answer == SequenceAnswer(value="ACGTTGA", accept=("ACGTTGA*",))


def test_a_sequence_may_be_exact() -> None:
    questions, problems = parse(sequence("    answer: FASTQ\n    exact: true\n"))
    assert problems == []
    assert questions[0].answer == SequenceAnswer(value="FASTQ", exact=True)


def test_a_sequence_needs_an_answer() -> None:
    _, problems = parse(sequence(""))
    assert codes(problems) == ["CS0330"]


def test_a_sequence_answer_of_spaces_is_refused() -> None:
    _, problems = parse(sequence('    answer: "   "\n'))
    assert codes(problems) == ["CS0330"]


def test_an_accept_entry_must_be_text() -> None:
    _, problems = parse(sequence('    answer: ACGT\n    accept:\n      - ""\n'))
    assert codes(problems) == ["CS0331"]


def test_exact_is_true_or_false() -> None:
    _, problems = parse(sequence("    answer: ACGT\n    exact: maybe\n"))
    assert codes(problems) == ["CS0332"]


def test_an_order_question_is_read() -> None:
    questions, problems = parse(order(["Cut reads into k-mers", "Build the graph", "Walk paths"]))
    assert problems == []
    assert questions[0].answer == OrderAnswer(
        steps=("Cut reads into k-mers", "Build the graph", "Walk paths")
    )


def test_an_order_needs_steps() -> None:
    _, problems = parse(HEAD + "    kind: order\n" + TAIL)
    assert codes(problems) == ["CS0333"]


def test_an_order_holds_three_to_eight_steps() -> None:
    _, two = parse(order(["One", "Two"]))
    _, nine = parse(order([f"Step {n}" for n in range(9)]))
    assert codes(two) == ["CS0334"]
    assert codes(nine) == ["CS0334"]


def test_two_steps_may_not_say_the_same() -> None:
    _, problems = parse(order(["Build the graph", "Walk paths", "build the graph "]))
    assert codes(problems) == ["CS0336"]


def test_two_options_may_not_say_the_same() -> None:
    text = (
        HEAD
        + "    kind: choice\n    options:\n      - text: An edge\n        right: true\n"
        + "      - text: an edge\n"
        + TAIL
    )
    _, problems = parse(text)
    assert codes(problems) == ["CS0335"]


def test_a_field_of_another_kind_is_refused() -> None:
    _, problems = parse(sequence("    answer: ACGT\n    steps:\n      - A\n"))
    assert codes(problems) == ["CS0337"]
    _, problems = parse(
        order(["A", "B", "C"]).replace("    steps:", "    accept:\n      - A\n    steps:")
    )
    assert codes(problems) == ["CS0337"]


def test_a_hint_may_not_give_a_sequence_answer() -> None:
    _, problems = parse(sequence().replace("Read one letter per edge.", "It spells acgttga."))
    assert codes(problems) == ["CS0319"]
