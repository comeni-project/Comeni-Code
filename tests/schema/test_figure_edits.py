"""Figure edits as pure functions (M6.4 spec, M6FG.5): added, set and removed, Node in, Node out.

Each result is written and read back as a draft's save reads it, so an edit is only as good as the
files it makes.
"""

from dataclasses import replace
from pathlib import Path

import pytest

from code_schema import Node, parse_node_files, read_content
from code_schema.blocks import Figure, Text, Try
from code_schema.edits import EditError, FigureRefused, add_figure, remove_figure, set_figure
from code_schema.figures import figure_texts
from code_schema.writer import write_exam_yaml, write_node_yaml

ROOT = Path(__file__).resolve().parents[1] / "fixtures" / "salmon"
CONTENT = read_content(ROOT)
TPM = CONTENT.nodes["tpm"]
DBG = CONTENT.nodes["de-bruijn-graphs"]
TEXT = (
    "component: flow\n"
    "alt: Two boxes, reads then k-mers, joined by one arrow.\n"
    "data:\n"
    "  # the smallest flow\n"
    "  nodes:\n"
    "    - {id: reads, label: reads}\n"
    "    - {id: kmers, label: k-mers}\n"
    "  edges:\n"
    "    - {from: reads, to: kmers}\n"
)


def reread(node: Node) -> Node:
    again, problems = parse_node_files(
        write_node_yaml(node),
        node.body,
        write_exam_yaml(node) if node.exam else None,
        node_id=node.id,
        regions=set(CONTENT.regions),
        providers=CONTENT.providers,
        where=f"{CONTENT.folders[node.id]}/",
        figures=figure_texts(node.figures),
    )
    assert problems == [], [str(problem) for problem in problems]
    assert again is not None
    return again


def added() -> Node:
    return add_figure(TPM, 0, "flow", alt="Two boxes and an arrow.", caption="Reads, then k-mers.")


def test_adding_a_figure_writes_its_starter_and_places_it() -> None:
    node = reread(added())
    assert node.blocks[0] == Figure("flow", "Reads, then k-mers.\n")
    (figure,) = [f for f in node.figures if f.stem == "flow"]
    assert (figure.stem, figure.component) == ("flow", "flow")
    assert figure.alt == "Two boxes and an arrow."
    assert figure.text.startswith("component: flow\nalt: Two boxes and an arrow.\ndata:\n")


def test_a_second_figure_of_a_component_gets_a_free_stem() -> None:
    twice = add_figure(added(), 1, "flow", alt="Another.", caption="Again.")
    # figures/ is read in file-name order, so flow-2.yaml comes before flow.yaml
    # In file-name order, as figures/ is read: flow-2.yaml sorts before flow.yaml.
    assert [figure.stem for figure in twice.figures] == ["flow-2", "flow", "two-transcripts"]
    assert reread(twice).figures == twice.figures


def test_adding_a_figure_from_its_text_keeps_it_as_written() -> None:
    """M6CO.2: the composer sends the whole file; its stem comes from the file's component."""
    node = reread(add_figure(TPM, 0, text=TEXT, caption="Reads, then k-mers."))
    assert node.blocks[0] == Figure("flow", "Reads, then k-mers.\n")
    (figure,) = [f for f in node.figures if f.stem == "flow"]
    assert figure.text == TEXT


@pytest.mark.parametrize(
    "given",
    [
        {},
        {"component": "flow"},
        {"text": TEXT, "component": "flow", "alt": "Both."},
        {"text": TEXT, "alt": "Both."},
    ],
)
def test_adding_takes_the_text_or_a_component_and_alt(given: dict[str, str]) -> None:
    with pytest.raises(EditError, match="give the file's text, or a component and alt text"):
        add_figure(TPM, 0, caption="A caption.", **given)


def test_adding_a_text_that_would_not_validate_says_why() -> None:
    with pytest.raises(FigureRefused) as refused:
        add_figure(TPM, 0, text=TEXT.replace("label: k-mers", "label: on"), caption="A caption.")
    assert [p.code for p in refused.value.problems] == ["CS1023"]


def test_setting_a_figure_keeps_its_text_as_written() -> None:
    node = reread(set_figure(added(), "flow", TEXT))
    assert node.figures[0].text == TEXT  # the comment, the flow style, the order
    assert node.figures[0].data["nodes"] == [
        {"id": "reads", "label": "reads"},
        {"id": "kmers", "label": "k-mers"},
    ]


def test_a_figure_that_would_not_validate_is_refused_with_its_problems() -> None:
    linked = TEXT + "  href: x\n"
    with pytest.raises(FigureRefused) as refused:
        set_figure(added(), "flow", linked)
    assert [(p.code, p.message) for p in refused.value.problems] == [
        ("CS1002", "data.href: not allowed")
    ]
    with pytest.raises(FigureRefused) as broken:
        set_figure(added(), "flow", "component: [\n")
    assert [p.code for p in broken.value.problems] == ["CS1023"]


def test_setting_a_figure_nobody_added_is_an_edit_error() -> None:
    with pytest.raises(FigureRefused):
        set_figure(TPM, "nope", TEXT)


def test_remove_figure_everywhere() -> None:
    """Review Focus 3: placed in the body, a try question and an exam stem, removed whole."""
    dbg = add_figure(DBG, 0, "flow", alt="Two boxes and an arrow.", caption="Reads, then k-mers.")
    asked = replace(dbg.questions[0], figure="flow")
    dbg = reread(replace(dbg, questions=(asked, *dbg.questions[1:])))
    gone = reread(remove_figure(dbg, "flow"))
    assert all(figure.stem != "flow" for figure in gone.figures)
    assert not any(isinstance(b, Figure) and b.file == "flow" for b in gone.blocks)
    assert all(question.figure != "flow" for question in gone.questions)
    assert any(isinstance(block, Text | Try) for block in gone.blocks)

    stem = TPM.exam[0].stem + "\n:::{figure} flow\nThe flow again.\n:::\n"
    tpm = reread(replace(added(), exam=(replace(TPM.exam[0], stem=stem), *TPM.exam[1:])))
    gone = reread(remove_figure(tpm, "flow"))
    assert all(figure.stem != "flow" for figure in gone.figures)
    assert not any(isinstance(b, Figure) and b.file == "flow" for q in gone.exam for b in q.blocks)


def test_a_figure_goes_with_its_last_placement() -> None:
    """Deleting the exam question whose stem places TPM's table leaves the table placed by nothing;
    it goes with it, so the save stays valid (CS1021 would refuse it otherwise)."""
    from code_schema.edits import delete_exam_question, without_unplaced_figures

    gone = without_unplaced_figures(delete_exam_question(TPM, "tpm-of-a"))
    assert [figure.stem for figure in gone.figures] == []
    reread(gone)
    kept = without_unplaced_figures(added())
    assert sorted(figure.stem for figure in kept.figures) == ["flow", "two-transcripts"]


def test_a_figure_that_is_a_stems_only_block_is_not_removed() -> None:
    """#377, decided A: the stem would be empty (CS0816), so the removal is refused up front,
    naming the question; the author edits or deletes it first."""
    from code_schema.edits import EditError

    alone = replace(TPM.exam[0], stem=":::{figure} flow\nThe flow alone.\n:::\n")
    tpm = reread(replace(added(), exam=(alone, *TPM.exam[1:])))
    with pytest.raises(EditError, match=f"the exam question {alone.id}"):
        remove_figure(tpm, "flow")


# ── a figure made for a question (M6.6b spec, M6FA.7) ───────────────────────────────────────────

TRACE = (
    "component: kmer-graph\n"
    "alt: A de Bruijn graph of six 3-mers; one path spells ACGTTAG.\n"
    "data:\n"
    "  reads:\n"
    "    - {sequence: ACGTT}\n"
    "    - {sequence: CGTTA}\n"
    "    - {sequence: GTTAG}\n"
    "    - {sequence: CGTC}\n"
    "  k: 3\n"
    "  highlight: none\n"
    "interact: {task: trace, spells: ACGTTAG}\n"
)


def test_a_figure_made_for_a_try_question_answers_it() -> None:
    from code_schema.questions import FigureAnswer

    node = reread(add_figure(DBG, None, caption="", text=TRACE, question="spell-the-path"))
    asked = next(q for q in node.questions if q.id == "spell-the-path")
    assert (asked.kind, asked.figure) == ("figure", "kmer-graph")
    assert isinstance(asked.answer, FigureAnswer) and asked.answer.accept
    assert not any(isinstance(b, Figure) and b.file == "kmer-graph" for b in node.blocks)


def test_a_figure_made_for_an_exam_question_is_its_stems_figure() -> None:
    from code_schema.questions import FigureAnswer

    asked = TPM.exam[0]
    node = reread(add_figure(TPM, None, caption="", text=TRACE, question=asked.id))
    again = next(q for q in node.exam if q.id == asked.id)
    assert isinstance(again.answer, FigureAnswer) and again.answer.figure == "kmer-graph"
    assert [b.file for b in again.blocks if isinstance(b, Figure)] == ["kmer-graph"]


def test_a_figure_for_no_such_question_is_refused() -> None:
    with pytest.raises(EditError):
        add_figure(DBG, None, caption="", text=TRACE, question="no-such-question")


def test_a_figure_for_an_exam_question_whose_stem_has_one_is_refused() -> None:
    """#414: an author's figure in the stem is not dropped without a word; it is asked to go."""
    from code_schema.edits import add_exam_question

    asked = replace(TPM.exam[0], stem=TPM.exam[0].stem + "\n:::{figure} flow\nA figure.\n:::\n")
    node = add_exam_question(remove_exam(TPM, asked.id), asked)
    with pytest.raises(EditError, match="already places a figure"):
        add_figure(node, None, caption="", text=TRACE, question=asked.id)


def remove_exam(node: Node, question_id: str) -> Node:
    return replace(node, exam=tuple(q for q in node.exam if q.id != question_id))


def test_a_new_figure_for_an_exam_question_replaces_the_one_it_was_answered_by() -> None:
    from code_schema.questions import FigureAnswer

    asked = TPM.exam[0]
    once = reread(add_figure(TPM, None, caption="", text=TRACE, question=asked.id))
    # As a draft's save does: a figure goes with its last placement.
    from code_schema.edits import without_unplaced_figures

    twice = reread(
        without_unplaced_figures(add_figure(once, None, caption="", text=TRACE, question=asked.id))
    )
    again = next(q for q in twice.exam if q.id == asked.id)
    assert isinstance(again.answer, FigureAnswer) and again.answer.figure == "kmer-graph-2"
    assert [b.file for b in again.blocks if isinstance(b, Figure)] == ["kmer-graph-2"]
