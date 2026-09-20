"""What the package offers its callers: parts 3 to 6 import from here, not from submodules."""

import code_schema


def test_the_public_api_is_what_the_spec_names() -> None:
    assert set(code_schema.__all__) == {
        "Content",
        "Level",
        "Link",
        "Node",
        "Problem",
        "Provider",
        "Region",
        "parse_node",
        "parse_providers",
        "parse_regions",
        "read_content",
        "read_node",
        "read_providers",
        "read_regions",
        "write_node_folder",
        "write_node_yaml",
    }
    for name in code_schema.__all__:
        assert hasattr(code_schema, name), name
