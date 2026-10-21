"""A validator for the subset of JSON Schema the components' schemas use (M6.4 spec, M6FG.2).

The subset: `type`, `properties`, `required`, `additionalProperties` (false, or a schema for every
other key), `items`, `enum`, `const`, `pattern`, `minimum`/`maximum`, `minItems`/`maxItems`,
`minLength`/`maxLength`, `oneOf` and `$ref` to the root's `$defs`. A `oneOf`'s branches differ by
`type`, so the branch is chosen by the value's type and its findings stay specific; the web's twin
(`apps/web/src/figures/validate.ts`) does the same, and both run tests/fixtures/figures/cases.json.

A number is finite and smaller than 1e15 in size, so the browser holds exactly what Python read.
"""

import math
import re
from collections.abc import Mapping, Sequence

from code_figures.findings import BOUND, NOT_ALLOWED, WRONG, Finding

Schema = Mapping[str, object]
LARGEST = 1e15


def json_type(value: object) -> str:
    """The JSON type of a value as YAML or JSON reads it: `integer` is also a `number`."""
    match value:
        case None:
            return "null"
        case bool():
            return "boolean"
        case int():
            return "integer"
        case float():
            return "number"
        case str():
            return "string"
        case Mapping():
            return "object"
        case list() | tuple():
            return "array"
    return type(value).__name__


def _is(value: object, kind: str) -> bool:
    found = json_type(value)
    return found == kind or (kind == "number" and found == "integer")


def _shown(value: object) -> str:
    text = repr(value) if not isinstance(value, str) else f'"{value}"'
    return text if len(text) <= 40 else f"{text[:37]}…"


def validate(schema: Schema, value: object, path: str = "data") -> list[Finding]:
    """Every finding for `value` against `schema`, in the order the value is written."""
    return _check(schema, value, path, schema)


def _resolve(schema: Schema, root: Schema) -> Schema:
    ref = schema.get("$ref")
    if not isinstance(ref, str):
        return schema
    name = ref.removeprefix("#/$defs/")
    defs = root.get("$defs")
    assert isinstance(defs, Mapping) and name in defs, f"no $defs entry for {ref}"
    found = defs[name]
    assert isinstance(found, Mapping)
    return found


def _check(schema: Schema, value: object, path: str, root: Schema) -> list[Finding]:
    schema = _resolve(schema, root)
    branches = schema.get("oneOf")
    if isinstance(branches, Sequence):
        return _one_of(branches, value, path, root)
    kind = schema.get("type")
    if isinstance(kind, str) and not _is(value, kind):
        return [Finding(WRONG, path, f"must be {_a(kind)}, not {_shown(value)}")]
    if _is(value, "number") and not _finite(value):
        return [Finding(WRONG, path, f"{_shown(value)} is not a number a page can draw")]
    if "const" in schema and not _same(value, schema["const"]):
        return [Finding(WRONG, path, f"must be {_shown(schema['const'])}")]
    allowed = schema.get("enum")
    if isinstance(allowed, Sequence) and not any(_same(value, a) for a in allowed):
        listed = ", ".join(_shown(a) for a in allowed)
        return [Finding(WRONG, path, f"{_shown(value)} is not one of {listed}")]
    if isinstance(value, str):
        return _string(schema, value, path)
    if _is(value, "number"):
        return _number(schema, value, path)
    if isinstance(value, Mapping):
        return _object(schema, value, path, root)
    if isinstance(value, list | tuple):
        return _array(schema, value, path, root)
    return []


def _a(kind: str) -> str:
    return {"integer": "a whole number", "array": "a list", "object": "a mapping"}.get(
        kind, f"a {kind}" if kind != "null" else "null"
    )


def _same(value: object, expected: object) -> bool:
    return json_type(value) == json_type(expected) and value == expected


def _finite(value: object) -> bool:
    assert isinstance(value, int | float)
    return (
        isinstance(value, int)
        and abs(value) < LARGEST
        or (isinstance(value, float) and math.isfinite(value) and abs(value) < LARGEST)
    )


def _one_of(branches: Sequence[object], value: object, path: str, root: Schema) -> list[Finding]:
    kinds: list[str] = []
    for branch in branches:
        assert isinstance(branch, Mapping)
        resolved = _resolve(branch, root)
        kind = resolved.get("type")
        assert isinstance(kind, str), "each oneOf branch names its type"
        kinds.append(kind)
        if _is(value, kind):
            return _check(resolved, value, path, root)
    return [
        Finding(WRONG, path, f"must be {' or '.join(_a(k) for k in kinds)}, not {_shown(value)}")
    ]


def _units(text: str) -> int:
    """A string's length as the browser counts it, in UTF-16 units (#375)."""
    return len(text.encode("utf-16-le")) // 2


def _string(schema: Schema, value: str, path: str) -> list[Finding]:
    # Every pattern is anchored, ^…$ (a test holds them to it), so a whole-string match is what
    # JavaScript's test() does; re.search's $ would also match before a final newline (#375).
    pattern = schema.get("pattern")
    if isinstance(pattern, str) and re.fullmatch(pattern, value) is None:
        return [Finding(WRONG, path, f"{_shown(value)} is not of the form this field takes")]
    shortest, longest = schema.get("minLength"), schema.get("maxLength")
    if isinstance(shortest, int) and _units(value) < shortest:
        return [Finding(BOUND, path, f"is shorter than {shortest} characters")]
    if isinstance(longest, int) and _units(value) > longest:
        return [Finding(BOUND, path, f"is longer than {longest} characters")]
    return []


def _number(schema: Schema, value: object, path: str) -> list[Finding]:
    assert isinstance(value, int | float)
    least, most = schema.get("minimum"), schema.get("maximum")
    if isinstance(least, int | float) and value < least:
        return [Finding(BOUND, path, f"{value} is less than {least}")]
    if isinstance(most, int | float) and value > most:
        return [Finding(BOUND, path, f"{value} is more than {most}")]
    return []


def _object(
    schema: Schema, value: Mapping[object, object], path: str, root: Schema
) -> list[Finding]:
    properties = schema.get("properties", {})
    assert isinstance(properties, Mapping)
    other = schema.get("additionalProperties", True)
    found: list[Finding] = []
    for key, item in value.items():
        where = f"{path}.{key}"
        if key in properties:
            known = properties[key]
            assert isinstance(known, Mapping)
            found += _check(known, item, where, root)
        elif other is False:
            found.append(Finding(NOT_ALLOWED, where, "not allowed"))
        elif isinstance(other, Mapping):
            found += _check(other, item, where, root)
    required = schema.get("required", ())
    assert isinstance(required, Sequence)
    for key in required:
        if key not in value:
            found.append(Finding(WRONG, f"{path}.{key}", "is required"))
    return found


def _array(schema: Schema, value: Sequence[object], path: str, root: Schema) -> list[Finding]:
    fewest, most = schema.get("minItems"), schema.get("maxItems")
    if isinstance(fewest, int) and len(value) < fewest:
        return [Finding(BOUND, path, f"holds fewer than {fewest}")]
    if isinstance(most, int) and len(value) > most:
        return [Finding(BOUND, path, f"holds more than {most}")]
    items = schema.get("items")
    if not isinstance(items, Mapping):
        return []
    return [f for at, item in enumerate(value) for f in _check(items, item, f"{path}[{at}]", root)]
