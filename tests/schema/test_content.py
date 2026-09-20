"""Finding the nodes in a content folder (spec M1P3.3)."""

from pathlib import Path

from schema.content_helpers import (
    RESOURCE,
    content_root,
    make_node,
    node_yaml,
    rendered,
    with_providers,
)

from code_schema.content import read_content


def test_an_empty_content_root_is_valid(tmp_path: Path) -> None:
    content = read_content(content_root(tmp_path))
    assert content.problems == () and content.nodes == {}


def test_nodes_are_found_at_any_depth_and_hidden_folders_are_skipped(tmp_path: Path) -> None:
    root = content_root(tmp_path)
    make_node(root, "salmon")
    make_node(root, "sequence-analysis/k-mers", title="K-mers")
    make_node(root, ".github/not-a-node")
    content = read_content(root)
    assert content.problems == ()
    assert sorted(content.nodes) == ["k-mers", "salmon"]
    assert content.folders["k-mers"] == "sequence-analysis/k-mers"
    assert content.node_file("k-mers") == "sequence-analysis/k-mers/node.yaml"


def test_regions_yaml_is_required(tmp_path: Path) -> None:
    assert rendered(tmp_path) == ["regions.yaml: the file is missing"]


def test_an_id_is_unique_across_the_tree(tmp_path: Path) -> None:
    root = content_root(tmp_path)
    make_node(root, "sequence-analysis/salmon")
    make_node(root, "tools/salmon")
    assert rendered(root) == [
        "tools/salmon/: salmon is already a node at sequence-analysis/salmon/ "
        "— ids are unique across the tree"
    ]


def test_a_near_miss_of_node_yaml_is_caught(tmp_path: Path) -> None:
    root = content_root(tmp_path)
    (root / "salmon").mkdir()
    (root / "salmon" / "node.yml").write_text(node_yaml(), encoding="utf-8")
    assert rendered(root) == ["salmon/: node.yml is not read — did you mean node.yaml?"]


def test_a_body_without_node_yaml_is_caught(tmp_path: Path) -> None:
    root = content_root(tmp_path)
    (root / "salmon").mkdir()
    (root / "salmon" / "body.md").write_text("A body.\n", encoding="utf-8")
    assert rendered(root) == ["salmon/: has body.md but no node.yaml — a node folder holds both"]


def test_the_content_root_is_not_a_node(tmp_path: Path) -> None:
    root = content_root(tmp_path)
    (root / "node.yaml").write_text(node_yaml(), encoding="utf-8")
    assert rendered(root) == [
        "node.yaml: the content root is not a node — node folders go inside it"
    ]


def test_a_nodes_data_folder_is_not_searched_for_near_misses(tmp_path: Path) -> None:
    root = content_root(tmp_path)
    folder = make_node(root, "salmon")
    (folder / "data").mkdir()
    (folder / "data" / "mode.yaml").write_text("x: 1\n", encoding="utf-8")
    assert rendered(root) == []


def test_the_region_registry_itself_is_not_a_near_miss(tmp_path: Path) -> None:
    root = content_root(tmp_path)
    (root / "README.md").write_text("# Content\n", encoding="utf-8")
    assert rendered(root) == []


def test_node_problems_are_collected_with_paths_from_the_root(tmp_path: Path) -> None:
    root = content_root(tmp_path)
    make_node(root, "sequence-analysis/salmon", level="expert")
    assert rendered(root) == [
        'sequence-analysis/salmon/node.yaml:5: level: "expert" is not a level '
        "(first-steps, foundations, introductory, intermediate, advanced)"
    ]


# M3 part 1: the provider registry is read once, and only when a resource cites one (M3P1.2).


def test_no_resources_means_the_registry_is_never_needed(tmp_path: Path) -> None:
    root = content_root(tmp_path)
    make_node(root, "salmon")
    content = read_content(root)
    assert content.problems == ()
    assert content.providers == {}


def test_a_resource_without_a_registry_is_a_problem(tmp_path: Path) -> None:
    root = content_root(tmp_path)
    make_node(root, "salmon", links=RESOURCE)
    assert rendered(root) == [
        "providers.yaml: the file is missing, and salmon/node.yaml cites a provider"
    ]


def test_the_registry_is_read_and_reaches_the_nodes(tmp_path: Path) -> None:
    root = with_providers(content_root(tmp_path))
    make_node(root, "salmon", links=RESOURCE)
    content = read_content(root)
    assert content.problems == ()
    assert list(content.providers) == ["khan-academy"]
    assert content.nodes["salmon"].resources[0].provider == "khan-academy"


def test_a_provider_the_registry_does_not_list_is_named(tmp_path: Path) -> None:
    root = with_providers(content_root(tmp_path))
    make_node(root, "salmon", links=RESOURCE.replace("khan-academy", "khan-acadmy"))
    assert rendered(root) == [
        "salmon/node.yaml:9: resources: khan-acadmy is not a provider in providers.yaml "
        "— did you mean khan-academy?"
    ]


def test_a_broken_registry_is_reported_once(tmp_path: Path) -> None:
    root = content_root(tmp_path)
    (root / "providers.yaml").write_text("providers: khan-academy\n", encoding="utf-8")
    make_node(root, "salmon")
    assert rendered(root) == ["providers.yaml:1: providers: must be a list of providers"]


def test_the_provider_registry_itself_is_not_a_near_miss(tmp_path: Path) -> None:
    root = with_providers(content_root(tmp_path))
    make_node(root, "salmon")
    assert rendered(root) == []
