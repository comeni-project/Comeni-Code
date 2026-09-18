"""YAML with the line of every key kept (spec M1P1.5)."""

from code_schema.yaml_lines import load_mapping

GOOD = """\
schema: 1
title: Salmon
minutes: 12
"""


def test_it_reads_a_mapping_and_records_each_key_line() -> None:
    data, lines, problems = load_mapping(GOOD, file="salmon/node.yaml")
    assert problems == []
    assert data == {"schema": 1, "title": "Salmon", "minutes": 12}
    assert lines == {"schema": 1, "title": 2, "minutes": 3}


def test_a_syntax_error_becomes_a_problem_with_its_line() -> None:
    data, _, problems = load_mapping("title: [Salmon\n", file="salmon/node.yaml")
    assert data is None
    assert len(problems) == 1
    # PyYAML decides which line it noticed the trouble on; the shape is ours.
    assert problems[0].line in (1, 2)
    assert str(problems[0]).startswith("salmon/node.yaml:")
    assert "not valid YAML (" in str(problems[0])


def test_a_document_that_is_not_a_mapping_is_a_problem() -> None:
    data, _, problems = load_mapping("- salmon\n", file="salmon/node.yaml")
    assert data is None
    assert str(problems[0]) == "salmon/node.yaml: the file must be a mapping of fields, not a list"


def test_an_empty_file_is_a_problem() -> None:
    data, _, problems = load_mapping("", file="salmon/node.yaml")
    assert data is None
    assert str(problems[0]) == "salmon/node.yaml: the file is empty"


def test_nested_keys_are_recorded_too() -> None:
    _, lines, _ = load_mapping("needs:\n  - reason: because\n", file="n/node.yaml")
    assert lines == {"needs": 1, "reason": 2}
