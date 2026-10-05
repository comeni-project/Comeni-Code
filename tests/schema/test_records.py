"""Reading a list of mappings in node.yaml, the part every nested field shares (spec M4R.1)."""

from code_schema.fields import one_line
from code_schema.problems import Problem
from code_schema.records import Field
from code_schema.yaml_lines import load_mapping

TEXT = """title: A node
things:
  - name: first
    size: big
  - 3
  - colour: red
"""

NOT_A_LIST = ("CS0301", "must be a list of questions")
NOT_A_MAPPING = ("CS0302", lambda item: f"{item} is not a question")


def field(text: str = TEXT) -> tuple[Field, list[Problem], object]:
    data, lines, problems = load_mapping(text, file="node.yaml")
    assert data is not None and problems == []
    found: list[Problem] = []
    return Field("things", lines=lines, file="node.yaml", problems=found), found, data["things"]


def test_the_mappings_are_yielded_and_the_rest_reported_at_the_field() -> None:
    things, problems, value = field()
    entries = list(things.entries(value, not_a_list=NOT_A_LIST, not_a_mapping=NOT_A_MAPPING))
    assert [entry.mapping for entry in entries] == [{"name": "first", "size": "big"}, {"colour": "red"}]
    assert [(p.code, p.message, p.line, p.field) for p in problems] == [
        ("CS0302", "3 is not a question", 2, "things")
    ]


def test_a_value_that_is_not_a_list_is_one_problem() -> None:
    things, problems, _ = field()
    assert list(things.entries("x", not_a_list=NOT_A_LIST, not_a_mapping=NOT_A_MAPPING)) == []
    assert [(p.code, p.message, p.line) for p in problems] == [
        ("CS0301", "must be a list of questions", 2)
    ]


def test_an_empty_list_is_written_by_leaving_the_field_out() -> None:
    things, problems, _ = field()
    assert list(things.entries([], not_a_list=NOT_A_LIST, not_a_mapping=NOT_A_MAPPING)) == []
    assert [(p.code, p.message) for p in problems] == [
        ("CS0019", "an empty list is written by leaving the field out")
    ]


def test_an_entry_reports_unknown_keys_at_their_lines_in_order() -> None:
    things, problems, value = field()
    first = next(things.entries(value, not_a_list=NOT_A_LIST, not_a_mapping=NOT_A_MAPPING))
    first.unknown(("colour",), "CS0303", lambda key: f"unknown key `{key}`")
    assert [(p.message, p.line) for p in problems] == [
        ("unknown key `name`", 3),
        ("unknown key `size`", 4),
    ]
    assert not first.sound


def test_a_missing_key_is_reported_at_the_entrys_first_line() -> None:
    things, problems, value = field()
    first = next(things.entries(value, not_a_list=NOT_A_LIST, not_a_mapping=NOT_A_MAPPING))
    assert first.require("name", "CS0304", "has no name")
    assert first.sound
    assert not first.require("colour", "CS0304", "has no colour")
    assert [(p.message, p.line) for p in problems] == [("has no colour", 3)]
    assert not first.sound


def test_a_check_is_worded_for_its_place_and_reported_at_its_key() -> None:
    things, problems, value = field()
    first = next(things.entries(value, not_a_list=NOT_A_LIST, not_a_mapping=NOT_A_MAPPING))
    assert first.check("name", one_line(max_len=80))
    assert first.check("absent", one_line(max_len=80))
    assert not first.check("size", one_line(max_len=2), prefix="the size ")
    assert [(p.code, p.message, p.line) for p in problems] == [
        ("CS0010", "the size is longer than 2 characters (3)", 4)
    ]
    assert not first.sound
