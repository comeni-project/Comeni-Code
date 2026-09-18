"""The rules between nodes (spec M1P3.4)."""

from pathlib import Path

from schema.content_helpers import content_root, link, make_node, rendered


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
