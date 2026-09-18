"""The six core fields, their messages, and the closed field set (spec M1P1.3, M1P1.5)."""

from pathlib import Path

from code_schema.links import Link
from code_schema.node import Level, Node, parse_node, read_node
from code_schema.problems import Problem

REGIONS = {"sequence-analysis", "molecular-biology"}

GOOD = """\
schema: 1
title: Salmon
claim: Salmon quantifies transcript abundance from RNA-seq reads without aligning them.
region: sequence-analysis
level: intermediate
minutes: 12
"""

BODY = "Salmon reads a transcriptome and counts what it finds.\n"


def parse(text: str, body: str = BODY) -> tuple[Node | None, list[Problem]]:
    """mypy runs strict over tests/, so every helper is annotated."""
    return parse_node(text, body, node_id="salmon", regions=REGIONS, file="salmon/node.yaml")


def test_a_good_node_parses() -> None:
    node, problems = parse(GOOD)
    assert problems == []
    assert node == Node(
        id="salmon",
        title="Salmon",
        claim="Salmon quantifies transcript abundance from RNA-seq reads without aligning them.",
        region="sequence-analysis",
        level=Level.INTERMEDIATE,
        minutes=12,
        body=BODY,
    )


def test_every_problem_is_reported_in_one_run() -> None:
    broken = """\
schema: 1
title: Salmon
clam: Salmon quantifies transcript abundance from RNA-seq reads.
region: sequence analysis
level: expert
minutes: "twelve"
"""
    node, problems = parse(broken)
    assert node is None
    assert [str(p) for p in problems] == [
        "salmon/node.yaml:3: unknown field `clam` — did you mean `claim`? "
        "(claim is required and missing)",
        'salmon/node.yaml:4: region: "sequence analysis" is not a region — '
        "regions.yaml lists 2, closest is `sequence-analysis`",
        'salmon/node.yaml:5: level: "expert" is not a level '
        "(first-steps, foundations, introductory, intermediate, advanced)",
        'salmon/node.yaml:6: minutes: "twelve" is not a whole number',
    ]


def test_an_unknown_field_with_no_close_match_is_reported_alone() -> None:
    _, problems = parse(GOOD + "colour: teal\n")
    assert [str(p) for p in problems] == ["salmon/node.yaml:7: unknown field `colour`"]


def test_a_missing_field_has_no_line() -> None:
    without_minutes = "\n".join(
        line for line in GOOD.splitlines() if not line.startswith("minutes")
    )
    _, problems = parse(without_minutes + "\n")
    assert [str(p) for p in problems] == ["salmon/node.yaml: minutes: required field is missing"]


def test_a_later_schema_is_refused_by_name() -> None:
    _, problems = parse(GOOD.replace("schema: 1", "schema: 2"))
    assert [str(p) for p in problems] == [
        "salmon/node.yaml:1: schema: this node is schema 2; this validator understands 1"
    ]


def test_an_unknown_region_names_the_registry_and_the_closest_match() -> None:
    _, problems = parse(GOOD.replace("region: sequence-analysis", "region: sequence_analysis"))
    assert [str(p) for p in problems] == [
        'salmon/node.yaml:4: region: "sequence_analysis" is not a region — '
        "regions.yaml lists 2, closest is `sequence-analysis`"
    ]


def test_a_region_nothing_like_the_registry_gets_no_guess() -> None:
    # A wrong suggestion is worse than none; difflib's default cutoff decides.
    _, problems = parse(GOOD.replace("region: sequence-analysis", "region: genomics"))
    assert [str(p) for p in problems] == [
        'salmon/node.yaml:4: region: "genomics" is not a region — regions.yaml lists 2'
    ]


def test_a_title_longer_than_a_line_of_a_card_is_refused() -> None:
    _, problems = parse(GOOD.replace("title: Salmon", "title: " + "Salmon " * 12))
    assert [str(p) for p in problems] == [
        "salmon/node.yaml:2: title: is longer than 80 characters (83)"
    ]


def test_minutes_of_zero_is_refused() -> None:
    _, problems = parse(GOOD.replace("minutes: 12", "minutes: 0"))
    assert [str(p) for p in problems] == ["salmon/node.yaml:6: minutes: 0 is not at least 1"]


def test_a_claim_without_terminal_punctuation_is_refused() -> None:
    _, problems = parse(GOOD.replace("aligning them.", "aligning them"))
    assert [str(p) for p in problems] == ["salmon/node.yaml:3: claim: must end with . ? or !"]


def test_an_empty_body_is_refused() -> None:
    _, problems = parse(GOOD, body="   \n")
    assert [str(p) for p in problems] == ["salmon/body.md: the file is empty"]


def test_an_id_that_is_not_a_slug_is_refused() -> None:
    _, problems = parse_node(
        GOOD, BODY, node_id="Salmon Node", regions=REGIONS, file="Salmon Node/node.yaml"
    )
    assert [str(p) for p in problems] == [
        'Salmon Node/: "Salmon Node" is not a node id (lower case, digits and single hyphens)'
    ]


def make_folder(root: Path, name: str, *, body: str = BODY, yaml_text: str = GOOD) -> Path:
    folder = root / name
    folder.mkdir(parents=True)
    (folder / "node.yaml").write_text(yaml_text, encoding="utf-8")
    (folder / "body.md").write_text(body, encoding="utf-8")
    return folder


def test_read_node_takes_the_id_from_the_folder(tmp_path: Path) -> None:
    node, problems = read_node(make_folder(tmp_path, "salmon"), regions=REGIONS, root=tmp_path)
    assert problems == []
    assert node is not None and node.id == "salmon"


def test_a_nested_folder_keeps_the_leaf_as_the_id(tmp_path: Path) -> None:
    folder = make_folder(tmp_path, "sequence-analysis/salmon")
    node, problems = read_node(folder, regions=REGIONS, root=tmp_path)
    assert problems == []
    assert node is not None and node.id == "salmon"


def test_messages_name_the_path_from_the_content_root(tmp_path: Path) -> None:
    folder = make_folder(tmp_path, "sequence-analysis/salmon", yaml_text=GOOD + "colour: teal\n")
    _, problems = read_node(folder, regions=REGIONS, root=tmp_path)
    assert [str(p) for p in problems] == [
        "sequence-analysis/salmon/node.yaml:7: unknown field `colour`"
    ]


def test_a_missing_body_is_refused(tmp_path: Path) -> None:
    folder = make_folder(tmp_path, "salmon")
    (folder / "body.md").unlink()
    _, problems = read_node(folder, regions=REGIONS, root=tmp_path)
    assert [str(p) for p in problems] == ["salmon/: body.md is missing"]


def test_a_missing_node_yaml_is_refused(tmp_path: Path) -> None:
    folder = make_folder(tmp_path, "salmon")
    (folder / "node.yaml").unlink()
    _, problems = read_node(folder, regions=REGIONS, root=tmp_path)
    assert [str(p) for p in problems] == ["salmon/: node.yaml is missing"]


def test_a_node_inside_a_node_is_refused(tmp_path: Path) -> None:
    folder = make_folder(tmp_path, "salmon")
    make_folder(folder, "pufferfish")
    _, problems = read_node(folder, regions=REGIONS, root=tmp_path)
    assert [str(p) for p in problems] == [
        "salmon/: holds another node (pufferfish/node.yaml); a node folder holds one node"
    ]


def test_a_body_that_is_not_utf8_is_refused(tmp_path: Path) -> None:
    folder = make_folder(tmp_path, "salmon")
    (folder / "body.md").write_bytes(b"\xff\xfe not text")
    _, problems = read_node(folder, regions=REGIONS, root=tmp_path)
    assert [str(p) for p in problems] == ["salmon/body.md: the file is not UTF-8"]


LINKED = (
    GOOD
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


def test_a_node_reads_its_three_kinds_of_link() -> None:
    node, problems = parse(LINKED)
    assert problems == []
    assert node is not None
    assert node.needs == (Link("what-tpm-measures", "Salmon reports abundance in TPM."),)
    assert [link.node for link in node.goes_deeper] == ["pufferfish-index"]
    assert [link.node for link in node.related] == ["kallisto"]


def test_a_node_without_links_has_empty_tuples() -> None:
    node, _ = parse(GOOD)
    assert node is not None
    assert node.needs == node.goes_deeper == node.related == ()


def test_a_node_is_one_kind_of_neighbour_not_two() -> None:
    both = LINKED + "  - node: what-tpm-measures\n    reason: TPM is another way to count.\n"
    _, problems = parse(both)
    assert [str(p) for p in problems] == [
        "salmon/node.yaml:16: related: what-tpm-measures is also under needs (line 8) — "
        "a node is one kind of neighbour, not two"
    ]


def test_a_typo_of_an_optional_field_is_suggested() -> None:
    _, problems = parse(LINKED.replace("goes-deeper:", "goes_deeper:"))
    assert [str(p) for p in problems] == [
        "salmon/node.yaml:10: unknown field `goes_deeper` — did you mean `goes-deeper`?"
    ]


def test_link_problems_and_field_problems_come_in_one_run() -> None:
    broken = LINKED.replace("level: intermediate", "level: expert").replace(
        "reason: Salmon reports abundance in TPM.", "reason: TPM"
    )
    _, problems = parse(broken)
    assert [str(p) for p in problems] == [
        'salmon/node.yaml:5: level: "expert" is not a level '
        "(first-steps, foundations, introductory, intermediate, advanced)",
        "salmon/node.yaml:9: needs: the reason for what-tpm-measures must end with . ? or !",
    ]


def test_the_designed_optional_paths_are_refused_until_wired() -> None:
    helps = LINKED + "helps:\n  - node: probability\n    reason: It helps.\n"
    _, problems = parse(helps)
    assert [str(p) for p in problems] == ["salmon/node.yaml:16: unknown field `helps`"]

    any_of = LINKED.replace(
        "  - node: what-tpm-measures\n",
        "  - any-of: [graphs, graphs-for-biologists]\n    node: what-tpm-measures\n",
    )
    _, problems = parse(any_of)
    assert [str(p) for p in problems] == [
        "salmon/node.yaml:8: needs: unknown key `any-of` in a link (a link has node and reason)"
    ]
