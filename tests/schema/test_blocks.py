"""A body as typed blocks (spec M4B.2–M4B.4)."""

import pytest

from code_schema.blocks import (
    Block,
    Callout,
    Text,
    Try,
    block_from_json,
    block_json,
    parse_blocks,
    write_blocks,
)
from code_schema.problems import Problem

BODY = (
    "DNA is two strands.\n\n"
    ":::{try} base-pairing\n:::\n\n"
    "A gene is a region of DNA.\n\n"
    ":::{misconception} A gene is not a chromosome\n"
    "A chromosome holds thousands of genes.\n"
    ":::\n"
)


def parse(body: str) -> tuple[tuple[Block, ...], tuple[int, ...], list[Problem]]:
    return parse_blocks(body, file="n/body.md")


def test_a_body_reads_as_text_try_and_callout_blocks() -> None:
    blocks, lines, problems = parse(BODY)
    assert problems == []
    assert blocks == (
        Text("DNA is two strands.\n\n"),
        Try("base-pairing"),
        Text("\nA gene is a region of DNA.\n\n"),
        Callout(
            "misconception",
            "A gene is not a chromosome",
            "A chromosome holds thousands of genes.\n",
        ),
    )
    assert lines == (1, 3, 5, 8)


def test_blocks_write_back_as_the_body() -> None:
    blocks, _, _ = parse(BODY)
    assert write_blocks(blocks) == BODY


def test_windows_line_endings_round_trip() -> None:
    body = BODY.replace("\n", "\r\n")
    blocks, _, problems = parse(body)
    assert problems == []
    assert [type(block).__name__ for block in blocks] == ["Text", "Try", "Text", "Callout"]
    assert write_blocks(blocks) == body


def test_a_callout_may_have_no_title() -> None:
    blocks, _, problems = parse(":::{caveat}\nMind the units.\n:::\n")
    assert (blocks, problems) == ((Callout("caveat", "", "Mind the units.\n"),), [])


def test_a_directive_inside_a_code_fence_is_text() -> None:
    body = "```markdown\n:::{try} x\n:::\n```\n"
    blocks, _, problems = parse(body)
    assert (blocks, problems) == ((Text(body),), [])


def test_a_body_that_starts_and_ends_with_a_directive_has_no_empty_text() -> None:
    blocks, _, _ = parse(":::{try} a\n:::\n")
    assert blocks == (Try("a"),)


@pytest.mark.parametrize(
    ("body", "code", "line"),
    [
        (":::{caveat} A\n:::{try} x\n:::\n:::\n", "CS0406", 2),
        (":::{caveat} A\n:class: wide\nText.\n:::\n", "CS0407", 2),
        (":::{caveat} A\nText.\n", "CS0408", 1),
        (":::{try} x\nWhy.\n:::\n", "CS0409", 1),
        (":::{try}\n:::\n", "CS0410", 1),
        (":::{caveat} A\n:::\n", "CS0411", 1),
        (":::{misconseption} A\nText.\n:::\n", "CS0412", 1),
        (":::{figure} x\n:::\n", "CS0413", 1),
        ("Prose.\n\n{% try base-pairing %}\n", "CS0414", 3),
    ],
)
def test_each_refusal_names_its_code_and_line(body: str, code: str, line: int) -> None:
    _, _, problems = parse(body)
    assert [(problem.code, problem.line) for problem in problems] == [(code, line)]


def test_an_unknown_directive_suggests_the_closest() -> None:
    _, _, problems = parse(":::{misconseption} A\nText.\n:::\n")
    assert problems[0].message.endswith("did you mean misconception?")


def test_the_old_marker_points_at_the_new_one() -> None:
    _, _, problems = parse("{% try base-pairing %}\n")
    assert problems[0].message == (
        "{% try base-pairing %} is written :::{try} base-pairing then ::: on the next line"
    )


# Checkpoint review of M4.1.2: code fences follow CommonMark, callouts included.


def test_a_fenced_close_inside_a_callout_does_not_close_it() -> None:
    body = ":::{caveat} T\n```\n:::\n```\n:::\n"
    blocks, _, problems = parse(body)
    assert (blocks, problems) == ((Callout("caveat", "T", "```\n:::\n```\n"),), [])


def test_a_fenced_directive_inside_a_callout_is_not_nested() -> None:
    body = ":::{caveat} T\n```\n:::{try} x\n```\n:::\n"
    blocks, _, problems = parse(body)
    assert (blocks, problems) == ((Callout("caveat", "T", "```\n:::{try} x\n```\n"),), [])


def test_an_unclosed_fence_inside_a_callout_leaves_it_unclosed() -> None:
    _, _, problems = parse(":::{caveat} T\n```\n:::\n")
    assert [problem.code for problem in problems] == ["CS0408"]


@pytest.mark.parametrize(
    "body",
    [
        "````\n```\n:::{try} x\n:::\n````\n",  # a shorter fence does not close a longer one
        "```py\nx\n```py\n:::{try} y\n:::\n",  # a fence with an info string never closes one
        "~~~\n```\n:::{try} x\n:::\n~~~\n",  # nor does the other character
    ],
)
def test_a_directive_stays_text_until_its_fence_really_closes(body: str) -> None:
    blocks, _, problems = parse(body)
    assert (blocks, problems) == ((Text(body),), [])


def test_a_line_indented_four_spaces_opens_no_fence() -> None:
    blocks, _, problems = parse("    ```\n:::{try} y\n:::\n")
    assert (blocks, problems) == ((Text("    ```\n"), Try("y")), [])


# Checkpoint review of M4.1.2: a body is accepted only if its blocks write it back unchanged.


@pytest.mark.parametrize(
    ("body", "line"),
    [
        (":::{try} x  \n:::\n", 1),
        (":::{try} x\n:::  \n", 2),
        (":::{caveat} T  \nm\n:::\n", 1),
        (":::{caveat}  T\nm\n:::\n", 1),
        (":::{try} x\n\n:::\n", 2),
        ("A\n:::{try} x\n:::", 3),
        (":::{caveat} T\nm\n:::", 3),
        (":::{try} x\r\n:::\r\n", 1),
        ("A\n:::{try} x\r\n:::\r\nB\n", 2),
    ],
)
def test_a_body_its_blocks_would_not_write_back_is_refused(body: str, line: int) -> None:
    blocks, _, problems = parse(body)
    assert [(problem.code, problem.line) for problem in problems] == [("CS0415", line)]


def test_every_accepted_body_writes_back_unchanged() -> None:
    for body in (BODY, BODY.replace("\n", "\r\n"), ":::{caveat}\nm\n:::\n", "no newline"):
        blocks, _, problems = parse(body)
        assert problems == []
        assert write_blocks(blocks) == body


# M4.1.3 (spec M4R.4): one codec for the index's JSON, so a kind it does not know is an error.


@pytest.mark.parametrize(
    "block",
    [Text("Prose.\n"), Try("kmer-count"), Callout("caveat", "A title", "Careful.\n")],
)
def test_a_block_survives_its_json(block: Block) -> None:
    assert block_from_json(block_json(block)) == block


def test_a_callout_is_stored_with_its_kind_as_callout() -> None:
    assert block_json(Callout("caveat", "", "Careful.\n")) == {
        "kind": "callout",
        "callout": "caveat",
        "title": "",
        "markdown": "Careful.\n",
    }


def test_a_stored_kind_the_format_does_not_read_is_an_error() -> None:
    with pytest.raises(ValueError, match="figure"):
        block_from_json({"kind": "figure", "markdown": "x"})


def test_a_stored_callout_of_a_kind_the_format_does_not_read_is_an_error() -> None:
    with pytest.raises(ValueError, match="note"):
        block_from_json({"kind": "callout", "callout": "note", "title": "", "markdown": "x"})
