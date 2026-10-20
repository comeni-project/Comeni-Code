"""Figure edits as pure functions (M6.4 spec, M6FG.5): added, set and removed, Node in, Node out.

Each result is written and read back as a draft's save reads it, so an edit is only as good as the
files it makes.
"""

from dataclasses import replace
from pathlib import Path

import pytest

from code_schema import Node, parse_node_files, read_content
from code_schema.blocks import Figure, Text, Try
from code_schema.edits import FigureRefused, add_figure, remove_figure, set_figure
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
    stems = sorted(figure.stem for figure in reread(twice).figures)
    assert stems == ["flow", "flow-2", "two-transcripts"]  # TPM's own table stays


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
