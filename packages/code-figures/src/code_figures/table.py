"""`table`: typed columns and rows of cells (M6.4 spec, M6FG.3)."""

import re
from collections.abc import Mapping

from code_figures.findings import Finding

ROW = "CS1011"  # a row with the wrong number of cells, or a cell not of its column's type
_LETTERS = re.compile(r"^[A-Za-z]+$")

STARTER: Mapping[str, object] = {
    "columns": [{"name": "k", "type": "number"}, {"name": "k-mers", "type": "number"}],
    "rows": [[3, 64], [5, 812]],
}


def _fits(kind: object, cell: object) -> bool:
    if cell is None:
        return True  # an empty cell
    if kind == "number":
        return isinstance(cell, int | float) and not isinstance(cell, bool)
    if kind == "sequence":
        return isinstance(cell, str) and _LETTERS.match(cell) is not None
    return isinstance(cell, str)


def check(data: Mapping[str, object]) -> list[Finding]:
    columns, rows = data["columns"], data["rows"]
    assert isinstance(columns, list) and isinstance(rows, list)
    kinds = [column["type"] for column in columns]
    found: list[Finding] = []
    for at, row in enumerate(rows):
        assert isinstance(row, list)
        if len(row) != len(kinds):
            found.append(
                Finding(ROW, f"data.rows[{at}]", f"has {len(row)} cells, not {len(kinds)}")
            )
            continue
        for column, (kind, cell) in enumerate(zip(kinds, row, strict=True)):
            if not _fits(kind, cell):
                where = f"data.rows[{at}][{column}]"
                found.append(Finding(ROW, where, f"is not a {kind}, as its column is"))
    return found


def derive(data: Mapping[str, object]) -> dict[str, object]:
    return {}
