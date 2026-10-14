"""Two revisions' keys matched, and a key's label (M4.9b spec, M4RS.1–M4RS.2). Pure."""

from pathlib import Path

from code_api.studio.keys import align, label, review_keys, same
from code_schema import (
    Callout,
    ExamQuestion,
    Node,
    NumberAnswer,
    Resource,
    Text,
    Try,
    TryQuestion,
    read_node,
    read_regions,
)
from code_schema.edits import delete_block, insert_block, move_block, set_resources, update_block

FIXTURES = Path(__file__).resolve().parents[3] / "tests" / "fixtures" / "salmon"


def tpm() -> Node:
    regions, _ = read_regions(FIXTURES)
    node, problems = read_node(
        FIXTURES / "transcriptomics" / "tpm", regions=set(regions), root=FIXTURES
    )
    assert node is not None, problems
    return node


def matched(before: Node, after: Node) -> dict[str, str | None]:
    return align(review_keys(before), review_keys(after))


def test_the_same_node_matches_itself() -> None:
    node = tpm()
    assert matched(node, node) == {k.key: k.key for k in review_keys(node)}


CAVEAT = Callout(kind="caveat", title="Mind the length", markdown="Short ones vary more.\n")


def with_caveat() -> Node:
    """TPM with a caveat after its first block: text, caveat, misconception, text. Callouts, since
    text blocks side by side are joined into one (#258)."""
    return insert_block(tpm(), 1, CAVEAT)


def test_an_inserted_block_is_new_and_the_rest_keep_their_match() -> None:
    found = matched(tpm(), with_caveat())
    assert found["block/0"] == "block/0"
    assert found["block/1"] is None
    assert (found["block/2"], found["block/3"]) == ("block/1", "block/2")


def test_a_deleted_block_leaves_the_rest_matched() -> None:
    node = with_caveat()
    found = matched(node, delete_block(node, 1))
    assert (found["block/0"], found["block/1"], found["block/2"]) == (
        "block/0",
        "block/2",
        "block/3",
    )


def test_an_edited_block_is_paired_and_differs() -> None:
    node = tpm()
    later = update_block(node, 0, Text(markdown="Shorter now.\n"))
    found = matched(node, later)
    assert found["block/0"] == "block/0"
    old = {k.key: k for k in review_keys(node)}["block/0"]
    new = {k.key: k for k in review_keys(later)}["block/0"]
    assert not same(old, new)


def test_a_moved_block_keeps_its_match() -> None:
    # Review Focus 1.
    node = with_caveat()
    found = matched(node, move_block(node, 1, 2))
    assert (found["block/1"], found["block/2"]) == ("block/2", "block/1")


def test_questions_by_id_and_resources_by_url() -> None:
    reading = Resource(
        kind="reading",
        provider="openstax",
        url="https://openstax.org/books/biology-2e/pages/17-1",
        covers="How fragments are read.",
        licence="CC BY 4.0",
        display="link",
        level=tpm().level,
    )
    node = set_resources(tpm(), [reading])
    question = TryQuestion(
        id="count-kmers", ask="How many?", answer=NumberAnswer(value=8), hints=(), rationale="8."
    )
    later = insert_block(node, 0, Try(question="count-kmers"), question)
    found = matched(node, later)
    assert found["resource/0"] == "resource/0"
    assert found["exam/tpm-of-a"] == "exam/tpm-of-a"
    assert found["try/count-kmers"] is None
    assert list(found) == [k.key for k in review_keys(later)]  # reading order


def test_a_new_node_matches_nothing() -> None:
    assert set(align([], review_keys(tpm())).values()) == {None}


def test_node_compares_its_fields_only() -> None:
    node = tpm()
    keyed = {k.key: k for k in review_keys(node)}
    edited = {k.key: k for k in review_keys(update_block(node, 0, Text(markdown="Other.\n")))}
    assert same(keyed["node"], edited["node"])


def test_labels() -> None:
    keys = {k.key: k for k in review_keys(tpm())}
    assert label(keys["node"]) == "Title, claim, level, links"
    assert label(keys["block/1"]) == "TPM is not a count of reads"
    assert label(keys["block/0"]).startswith("A long transcript gives more fragments")
    assert len(label(keys["block/0"])) <= 60 and label(keys["block/0"]).endswith("…")
    exam = keys["exam/tpm-or-count"].content
    assert isinstance(exam, ExamQuestion)
    assert label(keys["exam/tpm-or-count"]) == exam.title
    assert isinstance(keys["block/1"].content, Callout)
