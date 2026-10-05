"""The six core fields, their messages, and the closed field set (spec M1P1.3, M1P1.5)."""

from pathlib import Path

from code_schema.blocks import Text, Try
from code_schema.links import Link
from code_schema.node import Level, Node, parse_node, read_node
from code_schema.problems import Problem
from code_schema.providers import Provider

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
        "salmon/node.yaml:3: CS0004 unknown field `clam` — did you mean `claim`? "
        "(claim is required and missing)",
        'salmon/node.yaml:4: region: CS0016 "sequence analysis" is not a region — '
        "regions.yaml lists 2, closest is `sequence-analysis`",
        'salmon/node.yaml:5: level: CS0012 "expert" is not a level '
        "(first-steps, foundations, introductory, intermediate, advanced)",
        'salmon/node.yaml:6: minutes: CS0013 "twelve" is not a whole number',
    ]


def test_an_unknown_field_with_no_close_match_is_reported_alone() -> None:
    _, problems = parse(GOOD + "colour: teal\n")
    assert [str(p) for p in problems] == ["salmon/node.yaml:7: CS0004 unknown field `colour`"]


def test_a_missing_field_has_no_line() -> None:
    without_minutes = "\n".join(
        line for line in GOOD.splitlines() if not line.startswith("minutes")
    )
    _, problems = parse(without_minutes + "\n")
    assert [str(p) for p in problems] == [
        "salmon/node.yaml: minutes: CS0005 required field is missing"
    ]


def test_a_later_schema_is_refused_by_name() -> None:
    _, problems = parse(GOOD.replace("schema: 1", "schema: 2"))
    assert [str(p) for p in problems] == [
        "salmon/node.yaml:1: schema: CS0006 this node is schema 2; this validator understands 1"
    ]


def test_an_unknown_region_names_the_registry_and_the_closest_match() -> None:
    _, problems = parse(GOOD.replace("region: sequence-analysis", "region: sequence_analysis"))
    assert [str(p) for p in problems] == [
        'salmon/node.yaml:4: region: CS0016 "sequence_analysis" is not a region — '
        "regions.yaml lists 2, closest is `sequence-analysis`"
    ]


def test_a_region_nothing_like_the_registry_gets_no_guess() -> None:
    # A wrong suggestion is worse than none; difflib's default cutoff decides.
    _, problems = parse(GOOD.replace("region: sequence-analysis", "region: genomics"))
    assert [str(p) for p in problems] == [
        'salmon/node.yaml:4: region: CS0016 "genomics" is not a region — regions.yaml lists 2'
    ]


def test_a_title_longer_than_a_line_of_a_card_is_refused() -> None:
    _, problems = parse(GOOD.replace("title: Salmon", "title: " + "Salmon " * 12))
    assert [str(p) for p in problems] == [
        "salmon/node.yaml:2: title: CS0010 is longer than 80 characters (83)"
    ]


def test_minutes_of_zero_is_refused() -> None:
    _, problems = parse(GOOD.replace("minutes: 12", "minutes: 0"))
    assert [str(p) for p in problems] == ["salmon/node.yaml:6: minutes: CS0014 0 is not at least 1"]


def test_a_claim_without_terminal_punctuation_is_refused() -> None:
    _, problems = parse(GOOD.replace("aligning them.", "aligning them"))
    assert [str(p) for p in problems] == [
        "salmon/node.yaml:3: claim: CS0011 must end with . ? or !"
    ]


def test_an_empty_body_is_refused() -> None:
    _, problems = parse(GOOD, body="   \n")
    assert [str(p) for p in problems] == ["salmon/body.md: CS0401 the file is empty"]


def test_an_id_that_is_not_a_slug_is_refused() -> None:
    _, problems = parse_node(
        GOOD, BODY, node_id="Salmon Node", regions=REGIONS, file="Salmon Node/node.yaml"
    )
    assert [str(p) for p in problems] == [
        'Salmon Node/: CS0015 "Salmon Node" is not a node id '
        "(lower case, digits and single hyphens)"
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
        "sequence-analysis/salmon/node.yaml:7: CS0004 unknown field `colour`"
    ]


def test_a_missing_body_is_refused(tmp_path: Path) -> None:
    folder = make_folder(tmp_path, "salmon")
    (folder / "body.md").unlink()
    _, problems = read_node(folder, regions=REGIONS, root=tmp_path)
    assert [str(p) for p in problems] == ["salmon/: CS0021 body.md is missing"]


def test_a_missing_node_yaml_is_refused(tmp_path: Path) -> None:
    folder = make_folder(tmp_path, "salmon")
    (folder / "node.yaml").unlink()
    _, problems = read_node(folder, regions=REGIONS, root=tmp_path)
    assert [str(p) for p in problems] == ["salmon/: CS0021 node.yaml is missing"]


def test_a_node_inside_a_node_is_refused(tmp_path: Path) -> None:
    folder = make_folder(tmp_path, "salmon")
    make_folder(folder, "pufferfish")
    _, problems = read_node(folder, regions=REGIONS, root=tmp_path)
    assert [str(p) for p in problems] == [
        "salmon/: CS0020 holds another node (pufferfish/node.yaml); a node folder holds one node"
    ]


def test_a_body_that_is_not_utf8_is_refused(tmp_path: Path) -> None:
    folder = make_folder(tmp_path, "salmon")
    (folder / "body.md").write_bytes(b"\xff\xfe not text")
    _, problems = read_node(folder, regions=REGIONS, root=tmp_path)
    assert [str(p) for p in problems] == ["salmon/body.md: CS0022 the file is not UTF-8"]


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
        "salmon/node.yaml:16: related: CS0111 what-tpm-measures is also under needs (line 8) — "
        "a node is one kind of neighbour, not two"
    ]


def test_a_typo_of_an_optional_field_is_suggested() -> None:
    _, problems = parse(LINKED.replace("goes-deeper:", "goes_deeper:"))
    assert [str(p) for p in problems] == [
        "salmon/node.yaml:10: CS0004 unknown field `goes_deeper` — did you mean `goes-deeper`?"
    ]


def test_link_problems_and_field_problems_come_in_one_run() -> None:
    broken = LINKED.replace("level: intermediate", "level: expert").replace(
        "reason: Salmon reports abundance in TPM.", "reason: TPM"
    )
    _, problems = parse(broken)
    assert [str(p) for p in problems] == [
        'salmon/node.yaml:5: level: CS0012 "expert" is not a level '
        "(first-steps, foundations, introductory, intermediate, advanced)",
        "salmon/node.yaml:9: needs: CS0011 the reason for what-tpm-measures must end with . ? or !",
    ]


def test_the_designed_optional_paths_are_refused_until_wired() -> None:
    helps = LINKED + "helps:\n  - node: probability\n    reason: It helps.\n"
    _, problems = parse(helps)
    assert [str(p) for p in problems] == ["salmon/node.yaml:16: CS0004 unknown field `helps`"]

    any_of = LINKED.replace(
        "  - node: what-tpm-measures\n",
        "  - any-of: [graphs, graphs-for-biologists]\n    node: what-tpm-measures\n",
    )
    _, problems = parse(any_of)
    assert [str(p) for p in problems] == [
        "salmon/node.yaml:8: needs: CS0103 unknown key `any-of` in a link "
        "(a link has node and reason)"
    ]


# M3 part 1: resources and try questions belong to the node (spec M3P1.1).

PROVIDERS = {
    "khan-academy": Provider(
        "khan-academy", "Khan Academy", ("YouTube embed",), embed=True, players=("youtube",)
    ),
}

RESOURCES = """resources:
  - kind: video
    provider: khan-academy
    url: https://www.youtube.com/watch?v=abc
    part: 2:10–7:45
    covers: Why overlapping reads are assembled through their k-mers.
    licence: YouTube embed
    display: embed
    level: introductory
    video: youtube:Jnk_4Maf5Fk
"""

TRY = """try:
  - id: kmer-count
    kind: number
    ask: How many 5-mers does a 100-base read contain?
    answer: 96
    hints:
      - Every position where a window of width k still fits gives one k-mer.
    rationale: A read of length L has L − k + 1 k-mers.
"""

ASKED = "Prose.\n\n:::{try} kmer-count\n:::\n"


def parse_with_providers(text: str, body: str = BODY) -> tuple[Node | None, list[Problem]]:
    return parse_node(
        text,
        body,
        node_id="salmon",
        regions=REGIONS,
        providers=PROVIDERS,
        file="salmon/node.yaml",
    )


def test_a_node_carries_its_resources_and_questions() -> None:
    node, problems = parse_with_providers(GOOD + RESOURCES + TRY, ASKED)
    assert problems == []
    assert node is not None
    assert node.resources[0].provider == "khan-academy"
    assert node.questions[0].id == "kmer-count"


def test_a_node_without_them_has_empty_tuples() -> None:
    node, problems = parse(GOOD)
    assert problems == []
    assert node is not None
    assert node.resources == ()
    assert node.questions == ()


def test_a_marker_with_no_question_is_a_problem() -> None:
    _, problems = parse(GOOD, "Prose.\n\n:::{try} ghost\n:::\n")
    assert [(problem.file, problem.line, problem.message) for problem in problems] == [
        ("salmon/body.md", 3, "`:::{try} ghost` names no question in node.yaml")
    ]
    assert [problem.code for problem in problems] == ["CS0403"]


def test_a_question_with_no_marker_is_a_problem() -> None:
    _, problems = parse(GOOD + TRY)
    assert [(problem.file, problem.message) for problem in problems] == [
        ("salmon/node.yaml", "kmer-count has no :::{try} kmer-count in body.md")
    ]
    assert [problem.code for problem in problems] == ["CS0405"]


def test_two_markers_for_one_question_is_a_problem() -> None:
    body = "A.\n\n:::{try} kmer-count\n:::\n\nB.\n\n:::{try} kmer-count\n:::\n"
    _, problems = parse(GOOD + TRY, body)
    assert [(problem.line, problem.message) for problem in problems] == [
        (8, "`:::{try} kmer-count` appears twice in body.md")
    ]
    assert [problem.code for problem in problems] == ["CS0404"]


def test_an_old_marker_is_refused_with_a_pointer() -> None:
    _, problems = parse(GOOD, "Prose.\n\n{% try kmer-count %}\n")
    assert [(problem.code, problem.line) for problem in problems] == [("CS0414", 3)]


def test_a_block_problem_is_reported_by_the_node() -> None:
    _, problems = parse(GOOD, "Prose.\n\n:::{figure} x\n:::\n")
    assert [(problem.file, problem.code) for problem in problems] == [("salmon/body.md", "CS0413")]


def test_a_node_carries_its_blocks() -> None:
    node, problems = parse_with_providers(GOOD + TRY, ASKED)
    assert problems == []
    assert node is not None
    assert node.blocks == (Text("Prose.\n\n"), Try("kmer-count"))


def test_a_broken_question_does_not_also_report_its_marker() -> None:
    _, problems = parse(GOOD + TRY.replace("    answer: 96\n", ""), ASKED)
    assert [problem.message for problem in problems] == [
        "the number question kmer-count has no answer"
    ]


def test_a_resource_without_a_registry_keeps_its_other_rules() -> None:
    _, problems = parse(GOOD + RESOURCES.replace("https://", "http://"))
    assert [problem.message for problem in problems] == ["the url must start with https://"]


def test_resources_and_try_are_named_on_a_near_miss() -> None:
    _, problems = parse(GOOD + "resource:\n  - kind: video\n")
    assert problems[0].message == "unknown field `resource` — did you mean `resources`?"


# M4.1.1: each problem about a node's files and fields carries its code (spec M4D.3).


def test_invalid_yaml_and_a_missing_field_have_their_codes() -> None:
    _, broken = parse("title: [\n")
    assert [problem.code for problem in broken] == ["CS0001"]
    _, missing = parse(GOOD.replace("minutes: 12\n", ""))
    assert [(problem.field, problem.code) for problem in missing] == [("minutes", "CS0005")]


def test_a_hand_built_node_reads_its_blocks_from_its_body() -> None:
    # M4.1.3 (#134): blocks are derived, so a Node cannot hold blocks its body does not have.
    node = Node(
        id="a",
        title="A",
        claim="A claim.",
        region="sequence-analysis",
        level=Level.FOUNDATIONS,
        minutes=5,
        body="Prose.\n\n:::{try} kmer-count\n:::\n",
    )
    assert node.blocks == (Text("Prose.\n\n"), Try("kmer-count"))
