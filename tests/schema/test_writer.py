"""One correct rendering of a node, and the three round-trip laws (spec M1P1.6)."""

from dataclasses import replace
from pathlib import Path

from code_schema.links import Link
from code_schema.node import Level, Node, read_node
from code_schema.providers import Provider
from code_schema.questions import Option, Question
from code_schema.resources import Resource
from code_schema.writer import write_node_folder, write_node_yaml

REGIONS = {"sequence-analysis"}

NODE = Node(
    id="salmon",
    title="Salmon",
    claim="Salmon quantifies transcript abundance from RNA-seq reads without aligning them.",
    region="sequence-analysis",
    level=Level.INTERMEDIATE,
    minutes=12,
    body="Salmon reads a transcriptome and counts what it finds.\n",
)

CANONICAL = """\
schema: 1
title: Salmon
claim: Salmon quantifies transcript abundance from RNA-seq reads without aligning them.
region: sequence-analysis
level: intermediate
minutes: 12
"""


def test_the_writer_has_one_form_with_a_fixed_field_order() -> None:
    assert write_node_yaml(NODE) == CANONICAL


def test_a_long_claim_is_not_folded() -> None:
    long_claim = "Salmon " + "quantifies transcripts " * 7 + "quickly."
    assert f"claim: {long_claim}\n" in write_node_yaml(replace(NODE, claim=long_claim))


def test_law_1_read_write_read_keeps_the_node(tmp_path: Path) -> None:
    write_node_folder(NODE, tmp_path / "salmon")
    again, problems = read_node(tmp_path / "salmon", regions=REGIONS, root=tmp_path)
    assert problems == []
    assert again == NODE


def test_law_2_a_canonical_file_is_written_back_byte_for_byte(tmp_path: Path) -> None:
    folder = tmp_path / "salmon"
    folder.mkdir()
    (folder / "node.yaml").write_text(CANONICAL, encoding="utf-8")
    (folder / "body.md").write_text(NODE.body, encoding="utf-8")
    node, _ = read_node(folder, regions=REGIONS, root=tmp_path)
    assert node is not None
    write_node_folder(node, folder)
    assert (folder / "node.yaml").read_bytes() == CANONICAL.encode()
    assert (folder / "body.md").read_bytes() == NODE.body.encode()


def test_law_3_writing_is_idempotent(tmp_path: Path) -> None:
    folder = tmp_path / "salmon"
    write_node_folder(NODE, folder)
    first = (folder / "node.yaml").read_bytes()
    node, _ = read_node(folder, regions=REGIONS, root=tmp_path)
    assert node is not None
    write_node_folder(node, folder)
    assert (folder / "node.yaml").read_bytes() == first


def test_text_that_would_read_as_another_type_is_quoted_and_survives(tmp_path: Path) -> None:
    # A title of "12", "yes" or "null" must come back as that text, not a number, bool or nothing.
    for number, title in enumerate(("12", "yes", "null", "Salmon: the index", "#1 quantifier")):
        node = replace(NODE, title=title)
        folder = tmp_path / f"node-{number}"
        write_node_folder(node, folder)
        again, problems = read_node(folder, regions=REGIONS, root=tmp_path)
        assert problems == [], title
        assert again is not None and again.title == title


def test_a_body_with_windows_line_endings_comes_back_byte_for_byte(tmp_path: Path) -> None:
    folder = tmp_path / "salmon"
    write_node_folder(NODE, folder)
    crlf = b"Salmon reads a transcriptome.\r\nIt counts what it finds.\r\n"
    (folder / "body.md").write_bytes(crlf)
    node, _ = read_node(folder, regions=REGIONS, root=tmp_path)
    assert node is not None
    write_node_folder(node, folder)
    assert (folder / "body.md").read_bytes() == crlf


LINKED = replace(
    NODE,
    needs=(Link("what-tpm-measures", "Salmon reports abundance in TPM."),),
    goes_deeper=(
        Link(
            "pufferfish-index",
            "How Salmon fits a transcriptome's k-mers into memory, and why that makes it fast.",
        ),
    ),
    related=(
        Link(
            "kallisto",
            "kallisto does the same job by pseudoalignment, without Salmon's bias correction.",
        ),
    ),
)

LINKED_CANONICAL = (
    CANONICAL
    + """\
needs:
  - node: what-tpm-measures
    reason: Salmon reports abundance in TPM.
goes-deeper:
  - node: pufferfish-index
    reason: How Salmon fits a transcriptome's k-mers into memory, and why that makes it fast.
related:
  - node: kallisto
    reason: kallisto does the same job by pseudoalignment, without Salmon's bias correction.
"""
)


def test_links_are_written_after_minutes_indented_in_a_fixed_order() -> None:
    assert write_node_yaml(LINKED) == LINKED_CANONICAL


def test_a_node_without_links_writes_no_link_keys() -> None:
    assert write_node_yaml(NODE) == CANONICAL


def test_the_three_laws_hold_with_links(tmp_path: Path) -> None:
    folder = tmp_path / "salmon"
    write_node_folder(LINKED, folder)
    again, problems = read_node(folder, regions=REGIONS, root=tmp_path)
    assert problems == []
    assert again == LINKED
    assert (folder / "node.yaml").read_text(encoding="utf-8") == LINKED_CANONICAL
    write_node_folder(again, folder)
    assert (folder / "node.yaml").read_text(encoding="utf-8") == LINKED_CANONICAL


def test_link_order_is_the_authors() -> None:
    two = replace(
        NODE,
        needs=(
            Link("selective-alignment", "Salmon maps reads by selective alignment."),
            Link("what-tpm-measures", "Salmon reports abundance in TPM."),
        ),
    )
    written = write_node_yaml(two)
    assert written.index("selective-alignment") < written.index("what-tpm-measures")


# M3 part 1: resources and questions are written back too (spec M3P1.2, M3P1.3).

PROVIDERS = {
    "khan-academy": Provider("khan-academy", "Khan Academy", ("YouTube embed",), embed=True),
    "openstax": Provider("openstax", "OpenStax", ("CC BY 4.0",), embed=False),
}

TAUGHT = replace(
    NODE,
    body="Salmon reads a transcriptome.\n\n{% try kmer-count %}\n\n{% try node-or-edge %}\n",
    resources=(
        Resource(
            kind="video",
            provider="khan-academy",
            url="https://www.youtube.com/watch?v=abc",
            covers="Why overlapping reads are assembled through their k-mers.",
            licence="YouTube embed",
            display="embed",
            level=Level.INTRODUCTORY,
            part="2:10–7:45",
        ),
        Resource(
            kind="reading",
            provider="openstax",
            url="https://openstax.org/books/biology-2e/pages/17-1",
            covers="The genome-sequencing section that sets up assembly.",
            licence="CC BY 4.0",
            display="link",
            level=Level.FOUNDATIONS,
        ),
    ),
    questions=(
        Question(
            id="kmer-count",
            kind="number",
            ask="How many 5-mers does a 100-base read contain?",
            hints=("Every position where a window of width k still fits gives one k-mer.",),
            rationale="A read of length L has L − k + 1 k-mers.",
            answer=96,
        ),
        Question(
            id="node-or-edge",
            kind="choice",
            ask="In this definition, is a k-mer a node or an edge?",
            hints=("Look at what the definition puts in V and what it puts in E.",),
            rationale="V holds the (k−1)-mers and E holds the k-mers.",
            options=(Option(text="An edge", right=True), Option(text="A node")),
        ),
    ),
)

TAUGHT_YAML = """\
resources:
  - kind: video
    provider: khan-academy
    url: https://www.youtube.com/watch?v=abc
    part: 2:10–7:45
    covers: Why overlapping reads are assembled through their k-mers.
    licence: YouTube embed
    display: embed
    level: introductory
  - kind: reading
    provider: openstax
    url: https://openstax.org/books/biology-2e/pages/17-1
    covers: The genome-sequencing section that sets up assembly.
    licence: CC BY 4.0
    display: link
    level: foundations
try:
  - id: kmer-count
    kind: number
    ask: How many 5-mers does a 100-base read contain?
    answer: 96
    hints:
      - Every position where a window of width k still fits gives one k-mer.
    rationale: A read of length L has L − k + 1 k-mers.
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


def test_resources_and_questions_are_written_after_the_core_fields() -> None:
    assert write_node_yaml(TAUGHT) == CANONICAL + TAUGHT_YAML


def test_law_1_holds_for_a_node_that_teaches(tmp_path: Path) -> None:
    write_node_folder(TAUGHT, tmp_path / "salmon")
    again, problems = read_node(
        tmp_path / "salmon", regions=REGIONS, root=tmp_path, providers=PROVIDERS
    )
    assert problems == []
    assert again == TAUGHT


def test_law_2_holds_for_a_node_that_teaches(tmp_path: Path) -> None:
    folder = tmp_path / "salmon"
    folder.mkdir()
    (folder / "node.yaml").write_text(CANONICAL + TAUGHT_YAML, encoding="utf-8")
    (folder / "body.md").write_text(TAUGHT.body, encoding="utf-8")
    node, problems = read_node(folder, regions=REGIONS, root=tmp_path, providers=PROVIDERS)
    assert problems == []
    assert node is not None
    write_node_folder(node, folder)
    assert (folder / "node.yaml").read_bytes() == (CANONICAL + TAUGHT_YAML).encode()
