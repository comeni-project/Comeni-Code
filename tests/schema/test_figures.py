"""Figures in the node folder (M6.4 spec, M6FG.1): the files, the block, a try's figure, stems."""

from pathlib import Path

import pytest

from code_schema.blocks import Figure, block_from_json, block_json, parse_blocks, write_blocks
from code_schema.figures import FigureFile, FigureSource
from code_schema.node import read_node
from code_schema.writer import write_node_yaml

NODE = (
    "schema: 1\ntitle: Choosing k\nclaim: Choose k to balance branching against coverage.\n"
    "region: algorithms\nlevel: intermediate\nminutes: 15\n"
)
BODY = "Look:\n\n:::{figure} kmer-counts\nDistinct k-mers for one genome.\n:::\n"
TABLE = (
    "component: table\n"
    "alt: A table of distinct k-mers for k from 3 to 5.\n"
    "data:\n"
    "  # k against the count\n"
    "  columns:\n"
    "    - {name: k, type: number}\n"
    "    - {name: distinct k-mers, type: number}\n"
    "  rows:\n"
    "    - [3, 64]\n"
    "    - [5, 812]\n"
)
TRY = (
    "try:\n"
    "  - id: where-k\n"
    "    kind: choice\n"
    "    ask: Where is k fixed?\n"
    "    figure: kmer-counts\n"
    "    options:\n"
    "      - text: When the index is built\n"
    "        right: true\n"
    "      - text: In the EM step\n"
    "    hints:\n"
    "      - Think about what is built once.\n"
    "    rationale: The index is built once, with one k.\n"
)
REGIONS = {"algorithms"}


def folder(tmp_path: Path, *, node: str = NODE, body: str = BODY, **figures: str | bytes) -> Path:
    path = tmp_path / "choosing-k"
    path.mkdir(parents=True)
    (path / "node.yaml").write_text(node)
    (path / "body.md").write_text(body)
    if figures:
        (path / "figures").mkdir()
        for name, text in figures.items():
            stem, _, extension = name.rpartition("_")  # kmer_counts_yaml: kmer-counts.yaml
            target = path / "figures" / f"{stem.replace('_', '-')}.{extension}"
            if isinstance(text, bytes):
                target.write_bytes(text)
            else:
                target.write_text(text)
    return path


def codes(tmp_path: Path, **kwargs: str | bytes) -> list[str]:
    _, problems = read_node(folder(tmp_path, **kwargs), regions=REGIONS)  # type: ignore[arg-type]
    return [problem.code for problem in problems]


# ── The block ─────────────────────────────────────────────────────────────────────────────────


def test_a_figure_block_round_trips() -> None:
    blocks, _, problems = parse_blocks(BODY, file="body.md")
    assert problems == []
    assert blocks[1] == Figure("kmer-counts", "Distinct k-mers for one genome.\n")
    assert write_blocks(blocks) == BODY
    assert block_json(blocks[1]) == {
        "kind": "figure",
        "file": "kmer-counts",
        "caption": "Distinct k-mers for one genome.\n",
    }
    assert block_from_json(block_json(blocks[1])) == blocks[1]


@pytest.mark.parametrize(
    ("body", "code"),
    [
        (":::{figure}\nA caption.\n:::\n", "CS0428"),
        (":::{figure} kmer-counts\n:::\n", "CS0429"),
    ],
)
def test_a_figure_block_names_its_file_and_has_a_caption(body: str, code: str) -> None:
    _, _, problems = parse_blocks(body, file="body.md")
    assert [problem.code for problem in problems] == [code]


# ── The files ─────────────────────────────────────────────────────────────────────────────────


def test_a_node_reads_its_figures_and_keeps_their_text(tmp_path: Path) -> None:
    node, problems = read_node(folder(tmp_path, kmer_counts_yaml=TABLE), regions=REGIONS)
    assert problems == []
    assert node is not None
    (figure,) = node.figures
    assert isinstance(figure, FigureFile)
    assert (figure.stem, figure.component, figure.source) == ("kmer-counts", "table", None)
    assert figure.text == TABLE  # the comment and the layout as written
    assert figure.data["rows"] == [[3, 64], [5, 812]]


def test_a_source_is_optional_and_checked_when_given(tmp_path: Path) -> None:
    sourced = (
        TABLE + "source:\n  title: Compeau et al. 2011\n  url: https://doi.org/10.1038/nbt.2023\n"
    )
    node, problems = read_node(folder(tmp_path, kmer_counts_yaml=sourced), regions=REGIONS)
    assert problems == [] and node is not None
    assert node.figures[0].source == FigureSource(
        "Compeau et al. 2011", "https://doi.org/10.1038/nbt.2023"
    )


@pytest.mark.parametrize(
    ("figures", "body", "code"),
    [
        ({}, BODY, "CS1020"),
        ({"kmer_counts_yaml": TABLE, "other_yaml": TABLE}, BODY, "CS1021"),
        ({"Kmer_Counts_yaml": TABLE}, BODY.replace("kmer-counts", "Kmer"), "CS1022"),
        ({"kmer_counts_yml": TABLE}, BODY, "CS1022"),
        ({"kmer_counts_yaml": "component: [\n"}, BODY, "CS1023"),
        (
            {
                "kmer_counts_yaml": TABLE.replace(
                    "alt: A table of distinct k-mers for k from 3 to 5.\n", ""
                )
            },
            BODY,
            "CS1024",
        ),
        ({"kmer_counts_yaml": TABLE + "style: bold\n"}, BODY, "CS1025"),
        ({"kmer_counts_yaml": TABLE + "source:\n  url: https://example.org\n"}, BODY, "CS1026"),
        (
            {"kmer_counts_yaml": TABLE + "source:\n  title: A\n  url: http://example.org\n"},
            BODY,
            "CS1026",
        ),
        ({"kmer_counts_yaml": TABLE + "#" * 65 * 1024 + "\n"}, BODY, "CS1027"),
        ({"kmer_counts_yaml": TABLE.replace("component: table", "component: pie")}, BODY, "CS1001"),
    ],
)
def test_each_figure_refusal_names_its_code(
    tmp_path: Path, figures: dict[str, str], body: str, code: str
) -> None:
    assert code in codes(tmp_path, body=body, **figures)


@pytest.mark.parametrize("text", ["- a\n- b\n", "just words\n", "null\n", ""])
def test_figure_not_a_mapping(tmp_path: Path, text: str) -> None:
    """Review Focus 1: one refusal with its code, never a crash."""
    assert codes(tmp_path, kmer_counts_yaml=text) == ["CS1023"]


def test_a_components_refusal_comes_with_its_path(tmp_path: Path) -> None:
    chart = (
        "component: chart\nalt: A chart.\ndata:\n  mark: bar\n"
        "  data: {values: [{g: a, n: 1}]}\n"
        "  encoding:\n    x: {field: g, type: nominal}\n    href: {field: g}\n"
    )
    _, problems = read_node(folder(tmp_path, kmer_counts_yaml=chart), regions=REGIONS)
    (problem,) = problems
    assert (problem.code, problem.file) == ("CS1002", "choosing-k/figures/kmer-counts.yaml")
    assert problem.message == "data.encoding.href: not allowed"


def test_a_date_in_data_stays_text(tmp_path: Path) -> None:
    chart = (
        "component: chart\nalt: Reads per day.\ndata:\n  mark: bar\n"
        "  data: {values: [{day: 2026-10-20, n: 1}]}\n"
        "  encoding:\n    x: {field: day, type: temporal}\n    y: {field: n, type: quantitative}\n"
    )
    node, problems = read_node(folder(tmp_path, kmer_counts_yaml=chart), regions=REGIONS)
    assert problems == [] and node is not None
    assert node.figures[0].data["data"] == {"values": [{"day": "2026-10-20", "n": 1}]}


def test_one_file_may_be_placed_twice(tmp_path: Path) -> None:
    body = BODY + "\nAgain:\n\n:::{figure} kmer-counts\nThe same counts.\n:::\n"
    assert codes(tmp_path, body=body, kmer_counts_yaml=TABLE) == []


# ── A try's figure, and exam stems ────────────────────────────────────────────────────────────


def test_a_try_question_shows_a_figure(tmp_path: Path) -> None:
    body = BODY + "\n:::{try} where-k\n:::\n"
    node, problems = read_node(
        folder(tmp_path, node=NODE + TRY, body=body, kmer_counts_yaml=TABLE), regions=REGIONS
    )
    assert problems == [] and node is not None
    assert node.questions[0].figure == "kmer-counts"
    assert "    figure: kmer-counts\n" in write_node_yaml(node)
    assert write_node_yaml(node).index("ask:") < write_node_yaml(node).index("figure:")


def test_a_try_alone_places_a_figure_and_a_missing_one_is_refused(tmp_path: Path) -> None:
    body = "Look:\n\n:::{try} where-k\n:::\n"
    assert codes(tmp_path / "a", node=NODE + TRY, body=body, kmer_counts_yaml=TABLE) == []
    assert codes(tmp_path / "b", node=NODE + TRY, body=body) == ["CS1020"]
    bad = NODE + TRY.replace("figure: kmer-counts", "figure: Kmer Counts")
    assert "CS1022" in codes(tmp_path / "c", node=bad, body=body, kmer_counts_yaml=TABLE)


def test_an_exam_stem_places_a_figure(tmp_path: Path) -> None:
    path = folder(tmp_path, body="Prose.\n", kmer_counts_yaml=TABLE)
    exam = (
        "exam:\n"
        "  - id: read-the-table\n"
        "    title: Reading the counts\n"
        "    kind: number\n"
        "    stem: |\n"
        "      How many distinct 5-mers?\n\n"
        "      :::{figure} kmer-counts\n"
        "      The counts.\n"
        "      :::\n"
        "    answer: 812\n"
        "    rationale: The table says 812.\n"
    )
    (path / "exam.yaml").write_text(exam)
    node, problems = read_node(path, regions=REGIONS)
    assert [p.code for p in problems if p.refuses] == []
    assert node is not None and node.figures[0].stem == "kmer-counts"
