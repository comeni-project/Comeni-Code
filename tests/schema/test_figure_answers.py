"""Answering by the figure (M6.6b spec, M6FA.1–M6FA.3): the figure answer kind, figure options,
a figure file's task, where a task figure may be placed, and its right selections."""

from pathlib import Path

from schema.content_helpers import node_yaml

from code_schema.node import Node, parse_node_files
from code_schema.problems import Problem
from code_schema.questions import ChoiceAnswer, FigureAnswer
from code_schema.writer import write_node_folder

READS = """  reads:
    - {sequence: ACGTT}
    - {sequence: CGTTA}
    - {sequence: GTTAG}
    - {sequence: CGTC}
  k: 3
"""
TRACE = f"""component: kmer-graph
alt: A de Bruijn graph of six 3-mers; one path spells ACGTTAG.
data:
{READS}  highlight: none
interact: {{task: trace, spells: ACGTTAG}}
"""
PLAIN = f"""component: kmer-graph
alt: A de Bruijn graph of six 3-mers.
data:
{READS}  highlight: none
"""
PATH = ["ACG", "CGT", "GTT", "TTA", "TAG"]

TRY_FIGURE = """try:
  - id: trace-the-path
    kind: figure
    ask: Trace the path that spells ACGTTAG.
    figure: trace-path
    hints:
      - Each step adds one letter.
    rationale: ACG, then T, T, A and G.
"""


def choice_try(options: str, figure: str = "") -> str:
    return (
        "try:\n  - id: which-graph\n    kind: choice\n    ask: Which graph has a branch?\n"
        f"{figure}    options:\n{options}    hints:\n      - Look for a k-mer with two ways out.\n"
        "    rationale: Only one graph branches.\n"
    )


FIGURE_OPTIONS = """      - {figure: plain-a, right: true}
      - {figure: plain-b}
"""


def exam(stem: str, kind: str = "figure", answer: str = "") -> str:
    def question(n: int) -> str:
        return (
            f"  - id: plain-{n}\n    kind: number\n    title: Count {n}\n    stem: How many?\n"
            f"    answer: {n}\n    rationale: Count them.\n"
        )

    return (
        f"exam:\n  - id: error-bubble\n    title: Pick a k-mer\n    kind: {kind}\n"
        f"    stem: |\n{stem}\n{answer}    rationale: The bubble's k-mers are one read's.\n"
        + "".join(question(n) for n in (1, 2, 3))
    )


STEM_WITH = (
    "      Click a k-mer only the wrong read holds.\n\n"
    "      :::{figure} trace-path\n      The reads' graph.\n      :::\n"
)


def placing(node: str) -> str:
    """A body that places every try question the node holds, as CS0405 asks."""
    ids = [line.split("id: ")[1] for line in node.splitlines() if line.startswith("  - id: ")]
    return "A body.\n" + "".join(f"\n:::{{try}} {name}\n:::\n" for name in ids)


def read(
    node: str = "", body: str | None = None, exam_yaml: str | None = None, **figures: str
) -> tuple[Node | None, list[Problem]]:
    return parse_node_files(
        node_yaml() + node,
        placing(node) if body is None else body,
        exam_yaml,
        node_id="graphs",
        regions={"sequence-analysis"},
        providers=None,
        where="graphs/",
        figures={f"{stem.replace('_', '-')}.yaml": text for stem, text in figures.items()},
    )


def codes(found: list[Problem]) -> list[str]:
    return [p.code for p in found]


# ── the file's task ─────────────────────────────────────────────────────────────────────────────


def test_a_figure_file_takes_interact() -> None:
    node, found = read(TRY_FIGURE, trace_path=TRACE)
    assert codes(found) == []
    assert node is not None and node.figures[0].interact == {"task": "trace", "spells": "ACGTTAG"}


def test_a_task_finding_is_reported_at_the_file() -> None:
    _, found = read(TRY_FIGURE, trace_path=TRACE.replace("ACGTTAG", "ACGTCAG"))
    assert [(p.code, p.file) for p in found] == [("CS1030", "graphs/figures/trace-path.yaml")]
    assert "interact.spells" in found[0].message


# ── the figure answer kind ──────────────────────────────────────────────────────────────────────


def test_a_try_of_kind_figure() -> None:
    node, found = read(TRY_FIGURE, trace_path=TRACE)
    assert codes(found) == []
    assert node is not None
    answer = node.questions[0].answer
    assert isinstance(answer, FigureAnswer) and answer.figure == "trace-path"


def test_a_figure_try_needs_its_figure() -> None:
    _, found = read(TRY_FIGURE.replace("    figure: trace-path\n", ""), trace_path=TRACE)
    assert "CS0338" in codes(found)


def test_a_figure_try_has_no_options() -> None:
    with_options = TRY_FIGURE.replace("    hints:", "    options:\n      - {text: A}\n    hints:")
    _, found = read(with_options, trace_path=TRACE)
    assert "CS0337" in codes(found)


def test_kind_figure_is_no_longer_later() -> None:
    _, found = read(TRY_FIGURE, trace_path=TRACE)
    assert "CS0306" not in codes(found)


def test_an_exam_figure_question_is_its_stems_figure() -> None:
    node, found = read(exam_yaml=exam(STEM_WITH), trace_path=TRACE)
    assert [c for c in codes(found) if c != "CS0813"] == []
    assert node is not None
    answer = node.exam[0].answer
    assert isinstance(answer, FigureAnswer) and answer.figure == "trace-path"


def test_an_exam_figure_question_has_one_figure_in_its_stem() -> None:
    _, none = read(exam_yaml=exam("      Click a k-mer.\n"), trace_path=TRACE)
    assert "CS0824" in codes(none)
    two = STEM_WITH + "\n      :::{figure} plain\n      Another graph.\n      :::\n"
    _, found = read(exam_yaml=exam(two), trace_path=TRACE, plain=PLAIN)
    assert "CS0824" in codes(found)


# ── figure options ──────────────────────────────────────────────────────────────────────────────


def test_an_option_may_be_a_figure() -> None:
    node, found = read(choice_try(FIGURE_OPTIONS), plain_a=PLAIN, plain_b=PLAIN)
    assert codes(found) == []
    assert node is not None
    answer = node.questions[0].answer
    assert isinstance(answer, ChoiceAnswer)
    assert [(o.text, o.figure, o.right) for o in answer.options] == [
        ("", "plain-a", True),
        ("", "plain-b", False),
    ]


def test_an_option_is_text_or_a_figure() -> None:
    both = "      - {text: A, figure: plain-a, right: true}\n      - {text: B}\n"
    _, found = read(choice_try(both), plain_a=PLAIN)
    assert "CS0339" in codes(found)
    neither = "      - {right: true}\n      - {text: B}\n"
    _, found = read(choice_try(neither))
    assert "CS0325" in codes(found)


def test_an_exam_option_is_text_or_a_figure() -> None:
    options = (
        "    options:\n      - {text: A, figure: plain-a, right: true}\n"
        "      - {text: B, plain: true}\n      - {text: C, plain: true}\n"
    )
    _, found = read(exam_yaml=exam("      Which?\n", kind="choice", answer=options), plain_a=PLAIN)
    assert "CS0825" in codes(found)


def test_two_figure_options_are_not_the_same_text() -> None:
    _, found = read(choice_try(FIGURE_OPTIONS), plain_a=PLAIN, plain_b=PLAIN)
    assert "CS0335" not in codes(found)


# ── written back ────────────────────────────────────────────────────────────────────────────────


def test_the_writer_keeps_figure_answers_and_options(tmp_path: Path) -> None:
    node_text = node_yaml() + TRY_FIGURE.replace(
        "try:\n", "try:\n" + choice_try(FIGURE_OPTIONS).removeprefix("try:\n")
    )
    exam_text = exam(STEM_WITH)
    node, found = read(
        node_text.removeprefix(node_yaml()),
        exam_yaml=exam_text,
        trace_path=TRACE,
        plain_a=PLAIN,
        plain_b=PLAIN,
    )
    assert node is not None, found
    write_node_folder(node, tmp_path)
    again, found = read(
        (tmp_path / "node.yaml").read_text().removeprefix(node_yaml()),
        exam_yaml=(tmp_path / "exam.yaml").read_text(),
        trace_path=TRACE,
        plain_a=PLAIN,
        plain_b=PLAIN,
    )
    assert again is not None, found
    assert again.questions == node.questions and again.exam == node.exam


# ── where a task figure may go, and its right selections (M6FA.1, M6FA.3) ───────────────────────


def test_task_figure_on_the_page() -> None:
    """Review Focus 5: placed as a try's figure and as a body block, CS1029 once, at the block."""
    body = placing(TRY_FIGURE) + "\n:::{figure} trace-path\nThe reads' graph.\n:::\n"
    _, found = read(TRY_FIGURE, body=body, trace_path=TRACE)
    assert codes(found) == ["CS1029"]
    assert found[0].file == "graphs/body.md"


def test_task_figure_above_another_kind() -> None:
    choice = choice_try(
        "      - {text: The first, right: true}\n      - {text: The second}\n",
        "    figure: trace-path\n",
    )
    _, found = read(choice, trace_path=TRACE)
    assert codes(found) == ["CS1029"]


def test_task_figure_as_an_option() -> None:
    options = "      - {figure: trace-path, right: true}\n      - {figure: plain}\n"
    _, found = read(choice_try(options), trace_path=TRACE, plain=PLAIN)
    assert codes(found) == ["CS1029"]


def test_task_figure_in_an_exam_stem_of_another_kind() -> None:
    answer = "    answer: 3\n"
    _, found = read(exam_yaml=exam(STEM_WITH, kind="number", answer=answer), trace_path=TRACE)
    assert [c for c in codes(found) if c != "CS0813"] == ["CS1029"]


def test_a_figure_try_whose_figure_has_no_task() -> None:
    _, found = read(TRY_FIGURE, trace_path=PLAIN)
    assert codes(found) == ["CS0338"]


def test_an_exam_figure_question_whose_figure_has_no_task() -> None:
    _, found = read(exam_yaml=exam(STEM_WITH), trace_path=PLAIN)
    assert [c for c in codes(found) if c != "CS0813"] == ["CS0824"]


def test_a_read_folder_fills_accept() -> None:
    node, _ = read(TRY_FIGURE, exam_yaml=exam(STEM_WITH), trace_path=TRACE)
    assert node is not None
    for answer in (node.questions[0].answer, node.exam[0].answer):
        assert isinstance(answer, FigureAnswer) and answer.accept == (tuple(PATH),)
