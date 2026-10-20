"""`chart`: a Vega-Lite subset (M6.4 spec, M6FG.4).

The schema is the allowlist; these are the checks it cannot say. A chart has a mark and an
encoding, or layers, never both. Every field a channel names is a column of the data: a column is
any key some row has, so sparse rows are allowed. A field's present values match its type.
"""

import re
from collections.abc import Iterator, Mapping

from code_figures.findings import BOUND, WRONG, Finding

NO_COLUMN = "CS1005"  # a field that is no column of the data
NOT_ITS_TYPE = "CS1006"  # a field whose values are not of its type
MAX_COLUMNS = 20
_DATE = re.compile(r"^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?)?$")

STARTER: Mapping[str, object] = {
    "mark": "bar",
    "data": {"values": [{"k": 3, "n": 64}, {"k": 5, "n": 812}, {"k": 7, "n": 3904}]},
    "encoding": {
        "x": {"field": "k", "type": "ordinal"},
        "y": {"field": "n", "type": "quantitative"},
    },
}


def _encodings(data: Mapping[str, object]) -> Iterator[tuple[str, Mapping[str, object]]]:
    if isinstance(encoding := data.get("encoding"), Mapping):
        yield "data.encoding", encoding
    layers = data.get("layer", [])
    assert isinstance(layers, list)
    for at, layer in enumerate(layers):
        if isinstance(encoding := layer.get("encoding"), Mapping):
            yield f"data.layer[{at}].encoding", encoding


def _fits(kind: object, value: object) -> bool:
    if value is None:
        return True  # a gap
    if kind == "quantitative":
        return isinstance(value, int | float) and not isinstance(value, bool)
    if kind == "temporal":
        return isinstance(value, str) and _DATE.match(value) is not None
    return True


def check(data: Mapping[str, object]) -> list[Finding]:
    if ("mark" in data) == ("layer" in data):
        return [Finding(WRONG, "data", "has a mark and an encoding, or layers: one of the two")]
    if "mark" in data and "encoding" not in data:
        return [Finding(WRONG, "data.encoding", "is required with a mark")]
    source = data["data"]
    assert isinstance(source, Mapping)
    rows = source["values"]
    assert isinstance(rows, list)
    columns = list(dict.fromkeys(key for row in rows for key in row))
    if len(columns) > MAX_COLUMNS:
        return [Finding(BOUND, "data.data.values", f"has more than {MAX_COLUMNS} columns")]
    found: list[Finding] = []
    for where, encoding in _encodings(data):
        for channel, spec in encoding.items():
            assert isinstance(spec, Mapping)
            at = f"{where}.{channel}"
            field = spec.get("field")
            if field is None:
                if spec.get("aggregate") != "count":
                    found.append(Finding(WRONG, at, "names a field, or counts (aggregate: count)"))
                continue
            if field not in columns:
                found.append(Finding(NO_COLUMN, f"{at}.field", f"{field} is not a column"))
            elif not all(_fits(spec.get("type"), row.get(field)) for row in rows):
                found.append(
                    Finding(NOT_ITS_TYPE, f"{at}.field", f"{field} is not {spec.get('type')}")
                )
    return found


def derive(data: Mapping[str, object]) -> dict[str, object]:
    return {}
