"""The six core fields, their messages, and the closed field set (spec M1P1.3, M1P1.5)."""

from code_schema.node import Level, Node, parse_node
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
