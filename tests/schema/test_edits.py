"""Edits to a node as pure functions (M4.4 spec, M4W.3): `Node` in, `Node` out, no Django.

Each result is written with the canonical writer and read back with `parse_node_files`, the parse a
draft's save runs, so an edit is only as good as the files it makes. Nodes come from the fixtures.
"""

from dataclasses import replace
from pathlib import Path

import pytest

from code_schema import (
    ChoiceAnswer,
    ExamQuestion,
    Level,
    Link,
    Node,
    NumberAnswer,
    Option,
    Resource,
    TryQuestion,
    parse_node_files,
    read_content,
)
from code_schema.blocks import Callout, Text, Try
from code_schema.edits import (
    EditError,
    add_exam_question,
    delete_block,
    delete_exam_question,
    insert_block,
    move_block,
    set_fields,
    set_links,
    set_resources,
    update_block,
    update_exam_question,
)
from code_schema.writer import write_exam_yaml, write_node_yaml

ROOT = Path(__file__).resolve().parents[1] / "fixtures" / "salmon"
CONTENT = read_content(ROOT)
DBG = CONTENT.nodes["de-bruijn-graphs"]
TPM = CONTENT.nodes["tpm"]

QUESTION = TryQuestion(
    id="edge-count",
    ask="How many edges does a 6-base read give a de Bruijn graph of 4-mers?",
    answer=NumberAnswer(value=3),
    hints=("Count the 4-mers in the read.",),
    rationale="A read of length L has L − k + 1 k-mers, and each is an edge.",
)
EXAM = ExamQuestion(
    id="tpm-share",
    ask="If one transcript holds half the molecules in a sample, what is its TPM?",
    answer=NumberAnswer(value=500000),
    level=None,
    rationale="TPM is a share of a million, so half the molecules is 500,000.",
)


def reread(node: Node) -> Node:
    """Write the node's files and read them back as a draft's save does; no problems allowed."""
    again, problems = parse_node_files(
        write_node_yaml(node),
        node.body,
        write_exam_yaml(node) if node.exam else None,
        node_id=node.id,
        regions=set(CONTENT.regions),
        providers=CONTENT.providers,
        where=f"{CONTENT.folders[node.id]}/",
    )
    assert problems == [], [str(problem) for problem in problems]
    assert again is not None
    return again


def test_fields_change_and_nothing_else() -> None:
    edited = reread(set_fields(TPM, title="TPM, in short", level=Level.FOUNDATIONS))
    assert (edited.title, edited.level) == ("TPM, in short", Level.FOUNDATIONS)
    assert replace(edited, title=TPM.title, level=TPM.level) == TPM


def test_a_link_list_is_replaced() -> None:
    needs = (*TPM.needs, Link(node="probability", reason="TPM is a proportion of the sample."))
    assert reread(set_links(TPM, "needs", needs)).needs == needs
    assert reread(set_links(TPM, "needs", ())).needs == ()


def test_an_unknown_link_kind_is_an_edit_error() -> None:
    with pytest.raises(EditError, match="helps"):
        set_links(TPM, "helps", ())


def test_resources_are_replaced() -> None:
    resource = Resource(
        kind="reading",
        provider="openstax",
        url="https://openstax.org/books/biology-2e/pages/17-1",
        covers="How sequencing reads are counted per transcript.",
        licence="CC BY 4.0",
        display="link",
        level=Level.FOUNDATIONS,
    )
    assert reread(set_resources(TPM, (resource,))).resources == (resource,)


def test_a_callout_is_inserted_between_blocks() -> None:
    callout = Callout(kind="caveat", title="Effective length", markdown="It is shorter.\n")
    edited = reread(insert_block(DBG, 2, callout))
    assert edited.blocks[2] == callout
    assert len(edited.blocks) == len(DBG.blocks) + 1


def test_a_try_block_carries_its_question_in() -> None:
    edited = reread(insert_block(DBG, 2, Try(question="edge-count"), question=QUESTION))
    assert [question.id for question in edited.questions] == [
        "kmers-per-read",
        "edge-count",
        "shared-unitig",
    ]


def test_a_try_block_without_its_question_is_an_edit_error() -> None:
    with pytest.raises(EditError, match="edge-count"):
        insert_block(DBG, 2, Try(question="edge-count"))


def test_a_question_id_already_asked_is_an_edit_error() -> None:
    with pytest.raises(EditError, match="kmers-per-read"):
        insert_block(
            DBG, 2, Try(question="kmers-per-read"), question=replace(QUESTION, id="kmers-per-read")
        )


def test_deleting_a_try_block_deletes_its_question() -> None:
    edited = reread(delete_block(DBG, 1))
    assert [question.id for question in edited.questions] == ["shared-unitig"]
    assert Try(question="kmers-per-read") not in edited.blocks


def test_texts_brought_together_merge() -> None:
    # Deleting the try between two texts leaves one text block, as the body reads back.
    edited = reread(delete_block(DBG, 1))
    assert not any(
        isinstance(a, Text) and isinstance(b, Text)
        for a, b in zip(edited.blocks, edited.blocks[1:], strict=False)
    )


def test_texts_brought_together_keep_a_paragraph_break() -> None:
    # #258: a text typed in the workbench ends its line but leaves no blank one; merged with the
    # text after it, the two stay paragraphs, never one run-on paragraph.
    typed = update_block(DBG, 0, Text(markdown="First paragraph.\n"))
    edited = reread(insert_block(typed, 1, Text(markdown="Second paragraph.\n")))
    assert edited.blocks[0] == Text(markdown="First paragraph.\n\nSecond paragraph.\n")


def test_texts_already_apart_gain_no_second_blank_line() -> None:
    edited = reread(insert_block(DBG, 1, Text(markdown="A new paragraph.\n")))
    first = DBG.blocks[0]
    assert isinstance(first, Text)
    assert edited.blocks[0] == Text(markdown=f"{first.markdown}A new paragraph.\n")


def test_a_try_question_is_updated_through_its_block() -> None:
    changed = replace(DBG.questions[0], ask="How many 4-mers does a 10-base read contain?")
    edited = reread(update_block(DBG, 1, Try(question="kmers-per-read"), question=changed))
    assert edited.questions[0].ask == "How many 4-mers does a 10-base read contain?"


def test_a_block_moves() -> None:
    edited = reread(move_block(DBG, 1, 3))
    assert [block for block in edited.blocks if isinstance(block, Try)] == [
        Try(question="shared-unitig"),
        Try(question="kmers-per-read"),
    ]


@pytest.mark.parametrize("at", [-1, 99])
def test_a_position_out_of_range_is_an_edit_error(at: int) -> None:
    with pytest.raises(EditError, match="position"):
        delete_block(DBG, at)


def test_the_exam_pool_is_edited_a_question_at_a_time() -> None:
    added = reread(add_exam_question(TPM, EXAM))
    assert [question.id for question in added.exam][-1] == "tpm-share"
    choice = replace(
        EXAM,
        answer=ChoiceAnswer(options=(Option(text="500,000", right=True), Option(text="0.5"))),
    )
    updated = reread(update_exam_question(added, "tpm-share", choice))
    assert updated.exam[-1].answer == choice.answer
    assert reread(delete_exam_question(updated, "tpm-share")).exam == TPM.exam


def test_an_unknown_exam_question_is_an_edit_error() -> None:
    with pytest.raises(EditError, match="nothing-like-it"):
        delete_exam_question(TPM, "nothing-like-it")


def test_edits_never_change_their_input() -> None:
    before = (DBG.body, DBG.questions)
    delete_block(DBG, 1)
    insert_block(DBG, 0, Text(markdown="Lead.\n\n"))
    assert (DBG.body, DBG.questions) == before


# #173: questions are found by id, and text blocks fit the body they join.


def _swapped() -> Node:
    """de Bruijn graphs with its try questions listed in the other order: still a valid node."""
    return replace(DBG, questions=tuple(reversed(DBG.questions)))


def test_updating_a_try_block_finds_its_question_by_id() -> None:
    node = reread(_swapped())
    changed = replace(DBG.questions[0], ask="How many 4-mers does a 10-base read contain?")
    edited = reread(update_block(node, 1, Try(question="kmers-per-read"), question=changed))
    by_id = {question.id: question for question in edited.questions}
    assert by_id["kmers-per-read"].ask == changed.ask
    assert by_id["shared-unitig"] == DBG.questions[1]


def test_moving_a_block_leaves_the_questions_list_alone() -> None:
    node = reread(_swapped())
    assert reread(move_block(node, 0, 1)).questions == node.questions


@pytest.mark.parametrize(
    "block",
    [Text(markdown="No newline at the end"), Callout(kind="caveat", title="T", markdown="No end")],
)
def test_a_block_must_end_its_line(block: Text | Callout) -> None:
    with pytest.raises(EditError, match="newline"):
        insert_block(DBG, 0, block)


def test_a_block_uses_the_bodys_line_endings() -> None:
    crlf = replace(DBG, body=DBG.body.replace("\n", "\r\n"))
    with pytest.raises(EditError, match="line endings"):
        insert_block(crlf, 0, Text(markdown="Lead.\n\n"))
    edited = reread(insert_block(crlf, 0, Text(markdown="Lead.\r\n\r\n")))
    assert edited.body.startswith("Lead.\r\n\r\nTake two transcripts")
    assert "\n" not in edited.body.replace("\r\n", "")


@pytest.mark.parametrize(
    "block",
    [
        Callout(kind="caveat", title="a\nb", markdown="Text.\n"),
        Callout(kind="caveat", title="T", markdown="One.\n:::\nTwo.\n"),
    ],
)
def test_blocks_that_would_read_back_otherwise_are_refused(block: Callout) -> None:
    # #174: an edit stores what was sent, or nothing.
    from code_schema.edits import Unfaithful

    with pytest.raises(Unfaithful):
        insert_block(DBG, 2, block)
