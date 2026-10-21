"""The validator for the subset of JSON Schema the components' schemas use (M6.4 spec, M6FG.2)."""

import json
import math
from pathlib import Path

import pytest

import code_figures
from code_figures.findings import Finding
from code_figures.schema import validate

OBJECT = {
    "type": "object",
    "additionalProperties": False,
    "required": ["name"],
    "properties": {
        "name": {"type": "string", "pattern": "^[a-z]+$", "maxLength": 5},
        "count": {"type": "integer", "minimum": 1, "maximum": 3},
        "kind": {"enum": ["a", "b"]},
        "fixed": {"const": "yes"},
        "items": {"type": "array", "maxItems": 2, "items": {"type": "number"}},
        "either": {"oneOf": [{"type": "boolean"}, {"$ref": "#/$defs/small"}]},
    },
    "$defs": {
        "small": {
            "type": "object",
            "additionalProperties": False,
            "properties": {"n": {"type": "number"}},
        }
    },
}


def found(value: object) -> list[tuple[str, str]]:
    return [(f.code, f.path) for f in validate(OBJECT, value)]


def test_a_valid_value_has_no_findings() -> None:
    value = {"name": "abc", "count": 2, "kind": "a", "fixed": "yes", "items": [1, 2.5]}
    assert validate(OBJECT, {**value, "either": True}) == []
    assert validate(OBJECT, {**value, "either": {"n": 1}}) == []


def test_an_unknown_key_is_not_allowed_by_its_path() -> None:
    assert validate(OBJECT, {"name": "abc", "href": "x"}) == [
        Finding("CS1002", "data.href", "not allowed")
    ]


def test_a_missing_key_is_named() -> None:
    assert found({}) == [("CS1003", "data.name")]


@pytest.mark.parametrize(
    ("value", "where"),
    [
        ({"name": 3}, "data.name"),
        ({"name": "ABC"}, "data.name"),
        ({"name": "abc", "kind": "c"}, "data.kind"),
        ({"name": "abc", "fixed": "no"}, "data.fixed"),
        ({"name": "abc", "count": 1.5}, "data.count"),
        ({"name": "abc", "count": True}, "data.count"),
        ({"name": "abc", "items": [1, "x"]}, "data.items[1]"),
        ({"name": "abc", "either": "x"}, "data.either"),
        ({"name": "abc", "either": {"m": 1}}, "data.either.m"),
        ([], "data"),
    ],
)
def test_a_wrong_value_is_cs1003_at_its_path(value: object, where: str) -> None:
    codes = found(value)
    assert codes and codes[0][1] == where
    assert codes[0][0] in {"CS1002", "CS1003"}


@pytest.mark.parametrize(
    ("value", "where"),
    [
        ({"name": "abcdef"}, "data.name"),
        ({"name": "abc", "count": 4}, "data.count"),
        ({"name": "abc", "count": 0}, "data.count"),
        ({"name": "abc", "items": [1, 2, 3]}, "data.items"),
    ],
)
def test_a_bound_is_cs1004(value: object, where: str) -> None:
    assert found(value) == [("CS1004", where)]


def test_numbers_must_be_finite_and_bounded() -> None:
    """Review Focus 5: Python and the browser must hold the same number."""
    for bad in (math.inf, -math.inf, math.nan, 1e15, -1e16, 10**30):
        assert found({"name": "abc", "items": [bad]}) == [("CS1003", "data.items[0]")], bad
    assert found({"name": "abc", "items": [999_999_999_999_999, -0.5]}) == []


def test_findings_come_in_the_values_written_order() -> None:
    value = {"zeta": 1, "name": "ABC", "alpha": 2}
    assert [f.path for f in validate(OBJECT, value)] == ["data.zeta", "data.name", "data.alpha"]


def test_every_schema_pattern_is_anchored() -> None:
    """The validator matches a pattern whole, as the browser's test() does for an anchored one
    (#375); a pattern left open at either end would make the two disagree."""
    found: list[str] = []

    def walk(value: object) -> None:
        if isinstance(value, dict):
            pattern = value.get("pattern")
            if isinstance(pattern, str):
                found.append(pattern)
            for each in value.values():
                walk(each)
        elif isinstance(value, list):
            for each in value:
                walk(each)

    for path in (Path(code_figures.__file__).parent / "schemas").glob("*.json"):
        walk(json.loads(path.read_text()))
    assert found, "no patterns read"
    assert [p for p in found if not (p.startswith("^") and p.endswith("$"))] == []
