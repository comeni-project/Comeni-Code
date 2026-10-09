"""Edits to a node as pure functions (M4.4 spec, M4W.3): `Node` in, `Node` out, no Django.

A draft's save applies one of these to the node its latest revision holds, writes the files and
reads them back with `parse_node_files`, so an edit only has to make the change; the format's rules
are checked by the same parse CI runs. M5's assistant calls the same functions (W5.2).

What an edit refuses itself — a block position out of range, a `try` block without its question,
an exam question that is not there — raises `EditError` with a sentence, since no file could say it.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import replace

from code_schema.blocks import Block, Text, Try, block_text, parse_blocks, write_blocks
from code_schema.exam import ExamQuestion
from code_schema.levels import Level
from code_schema.links import Link
from code_schema.node import Node
from code_schema.questions import TryQuestion
from code_schema.resources import Resource


class EditError(ValueError):
    """An edit that cannot apply to this node; its message is a sentence for the editor."""


class Unfaithful(EditError):
    """The blocks would not read back as sent: a title with a newline, a ::: line inside a
    block's text. Storing them would store something else than the edit (#174)."""


def set_fields(
    node: Node,
    *,
    title: str | None = None,
    claim: str | None = None,
    region: str | None = None,
    level: Level | None = None,
    minutes: int | None = None,
) -> Node:
    """The given fields changed, the rest kept."""
    return replace(
        node,
        title=node.title if title is None else title,
        claim=node.claim if claim is None else claim,
        region=node.region if region is None else region,
        level=node.level if level is None else level,
        minutes=node.minutes if minutes is None else minutes,
    )


def set_links(node: Node, kind: str, links: Sequence[Link]) -> Node:
    """One kind of link replaced whole: the lists are short, and CS0111 reads across kinds."""
    match kind:
        case "needs":
            return replace(node, needs=tuple(links))
        case "goes-deeper":
            return replace(node, goes_deeper=tuple(links))
        case "related":
            return replace(node, related=tuple(links))
    raise EditError(f"{kind} is not a kind of link (needs, goes-deeper, related)")


def set_resources(node: Node, resources: Sequence[Resource]) -> Node:
    return replace(node, resources=tuple(resources))


def _merged(blocks: Sequence[Block]) -> list[Block]:
    """Adjacent text blocks joined: the body reads them back as one, so they are stored as one,
    with a blank line between them so the two stay paragraphs (#258)."""
    out: list[Block] = []
    for block in blocks:
        last = out[-1] if out else None
        if isinstance(block, Text) and isinstance(last, Text):
            out[-1] = Text(markdown=last.markdown + _gap(last.markdown) + block.markdown)
        else:
            out.append(block)
    return out


def _gap(markdown: str) -> str:
    """What a text needs after it for a paragraph to follow: a blank line, in its line endings."""
    if markdown.endswith(("\n\n", "\r\n\r\n")):
        return ""
    return "\r\n" if markdown.endswith("\r\n") else "\n"


def _check_position(node: Node, at: int, *, inserting: bool = False) -> None:
    last = len(node.blocks) if inserting else len(node.blocks) - 1
    if not 0 <= at <= last:
        raise EditError(f"there is no block position {at} (0 to {last})")


def _check_lines(node: Node, block: Block) -> None:
    """A text, callout or sequence block ends its last line, in the body's line endings (#173):
    otherwise its prose runs into the next block, or the body would not read back as its blocks."""
    if isinstance(block, Try):
        return
    crlf = "\r\n" in node.body
    text = block_text(block)
    if not text.endswith("\n"):
        raise EditError("a block's text ends with a newline")
    if ("\r\n" in text) != crlf or (crlf and "\n" in text.replace("\r\n", "")):
        ending = "\\r\\n" if crlf else "\\n"
        raise EditError(f"a block's text uses the body's line endings ({ending})")


def _asked_before(blocks: Sequence[Block], at: int) -> int:
    """How many questions are asked before position `at`: where a new one goes in the list."""
    return sum(isinstance(block, Try) for block in blocks[:at])


def _with_blocks(node: Node, blocks: Sequence[Block], questions: Sequence[TryQuestion]) -> Node:
    """The node with these blocks as its body, only if the body reads back as exactly them."""
    intended = _merged(blocks)
    body = write_blocks(intended)
    read, _, problems = parse_blocks(body, file="body.md")
    if problems or list(read) != intended:
        raise Unfaithful(
            "the blocks would read back as something else: keep a title on one line, and ::: "
            "lines out of a block's text"
        )
    return replace(node, body=body, questions=tuple(questions))


def _question_for(
    block: Block, question: TryQuestion | None, questions: Sequence[TryQuestion]
) -> None:
    """A `try` block must bring its question, under the id it names, and the id must be new; any
    other block brings none (#174)."""
    if not isinstance(block, Try):
        if question is not None:
            raise EditError(
                f"a question goes with a try block, not a {type(block).__name__.lower()}"
            )
        return
    if question is None or question.id != block.question:
        raise EditError(f"a try block for {block.question} needs its question, with that id")
    if any(asked.id == question.id for asked in questions):
        raise EditError(f"{question.id} is already asked in this node")


def _place_of(questions: Sequence[TryQuestion], question_id: str) -> int:
    """Where the question asked by a `try` block is listed: found by id, since node.yaml may list
    questions in another order than the body asks them (#173)."""
    for place, question in enumerate(questions):
        if question.id == question_id:
            return place
    raise EditError(f"the node has no question {question_id}")


def insert_block(node: Node, at: int, block: Block, question: TryQuestion | None = None) -> Node:
    """`block` at position `at`; a `try` block brings its question in with it."""
    _check_position(node, at, inserting=True)
    _check_lines(node, block)
    blocks = list(node.blocks)
    questions = list(node.questions)
    _question_for(block, question, questions)
    if isinstance(block, Try):
        assert question is not None
        questions.insert(min(_asked_before(blocks, at), len(questions)), question)
    blocks.insert(at, block)
    return _with_blocks(node, blocks, questions)


def delete_block(node: Node, at: int) -> Node:
    """The block at `at` removed; a `try` block takes its question with it."""
    _check_position(node, at)
    blocks = list(node.blocks)
    removed = blocks.pop(at)
    questions = list(node.questions)
    if isinstance(removed, Try):
        questions.pop(_place_of(questions, removed.question))
    return _with_blocks(node, blocks, questions)


def update_block(node: Node, at: int, block: Block, question: TryQuestion | None = None) -> Node:
    """The block at `at` replaced in place. A `try` block's question is edited through it: a try
    replacing a try replaces its question where it is listed; a try replacing another block brings
    its question in; another block replacing a try takes the old question out."""
    _check_position(node, at)
    _check_lines(node, block)
    old = node.blocks[at]
    blocks = list(node.blocks)
    blocks[at] = block
    questions = list(node.questions)
    place = min(_asked_before(node.blocks, at), len(questions))
    if isinstance(old, Try):
        place = _place_of(questions, old.question)
        questions.pop(place)
    _question_for(block, question, questions)
    if isinstance(block, Try):
        assert question is not None
        questions.insert(place, question)
    return _with_blocks(node, blocks, questions)


def move_block(node: Node, at: int, to: int) -> Node:
    """The block at `at` moved to position `to`. The questions list stays as it is: node.yaml's
    order is the author's, and the body's markers say where each is asked (#173)."""
    _check_position(node, at)
    _check_position(node, to)
    blocks = list(node.blocks)
    blocks.insert(to, blocks.pop(at))
    return _with_blocks(node, blocks, node.questions)


def _exam_index(node: Node, question_id: str) -> int:
    for index, question in enumerate(node.exam):
        if question.id == question_id:
            return index
    raise EditError(f"the exam pool has no question {question_id}")


def add_exam_question(node: Node, question: ExamQuestion) -> Node:
    if any(asked.id == question.id for asked in node.exam):
        raise EditError(f"{question.id} is already in the exam pool")
    return replace(node, exam=(*node.exam, question))


def update_exam_question(node: Node, question_id: str, question: ExamQuestion) -> Node:
    index = _exam_index(node, question_id)
    exam = list(node.exam)
    exam[index] = question
    return replace(node, exam=tuple(exam))


def delete_exam_question(node: Node, question_id: str) -> Node:
    index = _exam_index(node, question_id)
    return replace(node, exam=node.exam[:index] + node.exam[index + 1 :])
