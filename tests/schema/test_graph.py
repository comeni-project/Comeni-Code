"""The rules between nodes (spec M1P3.4)."""

from pathlib import Path

from schema.content_helpers import content_root, link, make_node, rendered

from code_schema.graph import shortest_ring, strongly_connected


def test_a_missing_target_gets_the_closest_id(tmp_path: Path) -> None:
    root = content_root(tmp_path)
    make_node(root, "k-mers", title="K-mers")
    make_node(root, "salmon", links=link("needs", "kmers"))
    assert rendered(root) == [
        "salmon/node.yaml:8: needs: kmers is not a node — closest is `k-mers`"
    ]


def test_a_missing_target_with_nothing_close_gets_no_guess(tmp_path: Path) -> None:
    root = content_root(tmp_path)
    make_node(root, "salmon", links=link("needs", "genomics"))
    assert rendered(root) == ["salmon/node.yaml:8: needs: genomics is not a node"]


def test_a_link_to_a_broken_node_is_not_a_missing_target(tmp_path: Path) -> None:
    root = content_root(tmp_path)
    make_node(root, "k-mers", title="K-mers", level="expert")
    make_node(root, "salmon", links=link("needs", "k-mers"))
    problems = rendered(root)
    assert len(problems) == 1
    assert problems[0].startswith("k-mers/node.yaml:5: level:")


def test_related_must_be_written_on_both_nodes(tmp_path: Path) -> None:
    root = content_root(tmp_path)
    make_node(root, "kallisto", title="Kallisto")
    make_node(root, "salmon", links=link("related", "kallisto"))
    assert rendered(root) == [
        "salmon/node.yaml:8: related: kallisto does not list salmon back "
        "— add it to kallisto/node.yaml"
    ]


def test_related_on_both_nodes_is_fine(tmp_path: Path) -> None:
    root = content_root(tmp_path)
    make_node(root, "kallisto", title="Kallisto", links=link("related", "salmon"))
    make_node(root, "salmon", links=link("related", "kallisto"))
    assert rendered(root) == []


def test_the_missing_half_names_a_nested_folder(tmp_path: Path) -> None:
    root = content_root(tmp_path)
    make_node(root, "tools/kallisto", title="Kallisto")
    make_node(root, "salmon", links=link("related", "kallisto"))
    assert rendered(root) == [
        "salmon/node.yaml:8: related: kallisto does not list salmon back "
        "— add it to tools/kallisto/node.yaml"
    ]


def test_goes_deeper_never_points_down(tmp_path: Path) -> None:
    root = content_root(tmp_path)
    make_node(root, "what-tpm-measures", title="TPM", level="introductory")
    make_node(root, "salmon", links=link("goes-deeper", "what-tpm-measures"))
    assert rendered(root) == [
        "salmon/node.yaml:8: goes-deeper: what-tpm-measures is introductory, "
        "below salmon (intermediate)"
    ]


def test_goes_deeper_at_the_same_level_or_higher_is_fine(tmp_path: Path) -> None:
    root = content_root(tmp_path)
    make_node(root, "pufferfish-index", title="Pufferfish")
    make_node(root, "bias-models", title="Bias models", level="advanced")
    make_node(
        root,
        "salmon",
        links=link("goes-deeper", "pufferfish-index")
        + "  - node: bias-models\n    reason: Where Salmon's bias correction comes from.\n",
    )
    assert rendered(root) == []


def test_strongly_connected_groups_are_found_without_recursion() -> None:
    chain = {f"n{i}": [f"n{i + 1}"] for i in range(5000)}
    chain["n5000"] = ["n0"]
    groups = strongly_connected(chain)
    assert len(groups) == 1 and len(groups[0]) == 5001


def test_nodes_off_a_cycle_are_their_own_groups() -> None:
    groups = strongly_connected({"a": ["b"], "b": ["a"], "c": ["a"]})
    assert sorted(tuple(group) for group in groups) == [("a", "b"), ("c",)]


def test_the_shortest_ring_through_a_node() -> None:
    graph = {"a": ["b", "d"], "b": ["c"], "c": ["a"], "d": ["a"]}
    assert shortest_ring(graph, "a", {"a", "b", "c", "d"}) == ["a", "d", "a"]


def test_a_needs_cycle_is_one_message_with_the_whole_ring(tmp_path: Path) -> None:
    root = content_root(tmp_path)
    make_node(root, "de-bruijn-graphs", title="DBG", links=link("needs", "k-mers"))
    make_node(root, "k-mers", title="K-mers", links=link("needs", "hashing"))
    make_node(root, "hashing", title="Hashing", links=link("needs", "de-bruijn-graphs"))
    assert rendered(root) == [
        "de-bruijn-graphs/node.yaml:8: needs: a cycle — "
        "de-bruijn-graphs → k-mers → hashing → de-bruijn-graphs"
    ]


def test_a_tangle_says_how_many_more_nodes_are_caught(tmp_path: Path) -> None:
    root = content_root(tmp_path)
    make_node(root, "a-node", title="A", links=link("needs", "b-node"))
    make_node(
        root,
        "b-node",
        title="B",
        links=link("needs", "a-node") + "  - node: c-node\n    reason: C comes first.\n",
    )
    make_node(root, "c-node", title="C", links=link("needs", "b-node"))
    assert rendered(root) == [
        "a-node/node.yaml:8: needs: a cycle — a-node → b-node → a-node, "
        "and 1 more node is caught in it"
    ]


def test_a_goes_deeper_cycle_is_refused_too(tmp_path: Path) -> None:
    root = content_root(tmp_path)
    make_node(root, "a-node", title="A", links=link("goes-deeper", "b-node"))
    make_node(root, "b-node", title="B", links=link("goes-deeper", "a-node"))
    assert rendered(root) == ["a-node/node.yaml:8: goes-deeper: a cycle — a-node → b-node → a-node"]


def test_the_same_tangle_gives_the_same_message_every_run(tmp_path: Path) -> None:
    root = content_root(tmp_path)
    make_node(root, "a-node", title="A", links=link("needs", "b-node"))
    make_node(root, "b-node", title="B", links=link("needs", "a-node"))
    assert rendered(root) == rendered(root)
