"""One link list, every per-node rule of spec M1P2.5."""

from code_schema.links import Link, parse_links
from code_schema.problems import Problem
from code_schema.yaml_lines import load_mapping


def run(text: str, kind: str = "needs") -> tuple[tuple[Link, ...], list[str]]:
    """Parse `text` as a node.yaml fragment and return the links and the rendered problems."""
    data, lines, problems = load_mapping(text, file="salmon/node.yaml")
    assert data is not None, problems
    links, _, found = parse_links(
        data[kind], kind=kind, node_id="salmon", lines=lines, file="salmon/node.yaml"
    )
    return links, [str(p) for p in sorted(found, key=Problem.sort_key)]


GOOD = """\
needs:
  - node: what-tpm-measures
    reason: Salmon reports abundance in TPM.
  - node: selective-alignment
    reason: Salmon maps reads by selective alignment.
"""


def test_links_keep_the_authors_order() -> None:
    links, problems = run(GOOD)
    assert problems == []
    assert links == (
        Link("what-tpm-measures", "Salmon reports abundance in TPM."),
        Link("selective-alignment", "Salmon maps reads by selective alignment."),
    )


def test_the_line_of_each_link_is_returned() -> None:
    data, lines, _ = load_mapping(GOOD, file="salmon/node.yaml")
    assert data is not None
    _, link_lines, _ = parse_links(
        data["needs"], kind="needs", node_id="salmon", lines=lines, file="salmon/node.yaml"
    )
    assert link_lines == (2, 4)


def test_the_field_must_be_a_list() -> None:
    _, problems = run("needs: k-mers\n")
    assert problems == [
        "salmon/node.yaml:1: needs: must be a list of links, each with a node and a reason"
    ]


def test_an_empty_list_is_written_by_leaving_the_field_out() -> None:
    _, problems = run("needs: []\n")
    assert problems == [
        "salmon/node.yaml:1: needs: an empty list is written by leaving the field out"
    ]


def test_an_entry_must_be_a_mapping() -> None:
    _, problems = run("needs:\n  - k-mers\n")
    assert problems == [
        'salmon/node.yaml:1: needs: "k-mers" is not a link — '
        "write node: and reason: on separate lines"
    ]


def test_an_unknown_key_in_a_link_names_its_line() -> None:
    _, problems = run("needs:\n  - node: k-mers\n    reason: Salmon indexes k-mers.\n    why: x\n")
    assert problems == [
        "salmon/node.yaml:4: needs: unknown key `why` in a link (a link has node and reason)"
    ]


def test_a_link_needs_a_node() -> None:
    _, problems = run("needs:\n  - reason: Salmon indexes k-mers.\n")
    assert problems == ["salmon/node.yaml:2: needs: a link has no node"]


def test_the_node_is_a_slug() -> None:
    _, problems = run("needs:\n  - node: K-mers\n    reason: Salmon indexes k-mers.\n")
    assert problems == [
        'salmon/node.yaml:2: needs: "K-mers" is not a node id '
        "(lower case, digits and single hyphens)"
    ]


def test_a_link_needs_a_reason() -> None:
    _, problems = run("needs:\n  - node: k-mers\n")
    assert problems == ["salmon/node.yaml:2: needs: the link to k-mers has no reason"]


def test_the_reason_is_one_sentence_and_names_its_own_line() -> None:
    _, problems = run(GOOD + "  - node: k-mers\n    reason: Salmon indexes k-mers\n")
    assert problems == ["salmon/node.yaml:7: needs: the reason for k-mers must end with . ? or !"]


def test_a_reason_that_is_not_text() -> None:
    _, problems = run("needs:\n  - node: k-mers\n    reason: 12\n")
    assert problems == ["salmon/node.yaml:3: needs: the reason for k-mers is not text"]


def test_a_node_listed_twice_names_the_first_line() -> None:
    _, problems = run(GOOD + "  - node: what-tpm-measures\n    reason: Again.\n")
    assert problems == [
        "salmon/node.yaml:6: needs: what-tpm-measures is listed twice (first on line 2)"
    ]


def test_a_node_does_not_link_to_itself() -> None:
    _, problems = run("related:\n  - node: salmon\n    reason: Itself.\n", kind="related")
    assert problems == ["salmon/node.yaml:2: related: salmon links to itself"]


def test_related_holds_at_most_four() -> None:
    peers = "".join(
        f"  - node: peer-{n}\n    reason: Peer {n} does the job differently.\n" for n in range(5)
    )
    _, problems = run("related:\n" + peers, kind="related")
    assert problems == [
        "salmon/node.yaml:10: related: 5 peers, at most 4 — a node with more is probably two nodes"
    ]


def test_needs_has_no_cap() -> None:
    needs = "".join(f"  - node: need-{n}\n    reason: Need {n} comes first.\n" for n in range(6))
    links, problems = run("needs:\n" + needs)
    assert problems == [] and len(links) == 6


def test_a_bad_link_is_left_out_but_the_good_ones_are_kept() -> None:
    links, problems = run(GOOD + "  - node: k-mers\n")
    assert len(problems) == 1
    assert [link.node for link in links] == ["what-tpm-measures", "selective-alignment"]
