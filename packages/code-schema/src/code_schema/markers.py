"""Markers in body.md (spec M3P1.3).

The body is Markdown in M3, with one exception: `{% try <id> %}` on a line of its own says where
a question is asked. W5.1's block document and M6's figures will bring the rest of the board's
markers; until then any other `{% … %}` line is refused by name, rather than drawn as braces.

A marker inside a fenced code block is prose: a page about templates may well print one.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

_TRY = re.compile(r"^\s*\{%\s*try\s+([a-z0-9-]+)\s*%\}\s*$")
_FENCE = re.compile(r"^\s*(```|~~~)")


@dataclass(frozen=True)
class Marker:
    id: str
    line: int


def find_markers(body: str) -> tuple[tuple[Marker, ...], list[tuple[str, int]]]:
    """Every try marker, and every other `{% … %}` line as (the line's text, its number)."""
    markers: list[Marker] = []
    others: list[tuple[str, int]] = []
    fenced = False
    for number, text in enumerate(body.splitlines(), start=1):
        if _FENCE.match(text):
            fenced = not fenced
            continue
        if fenced:
            continue
        if (found := _TRY.match(text)) is not None:
            markers.append(Marker(id=found.group(1), line=number))
        elif "{%" in text:
            others.append((text.strip(), number))
    return tuple(markers), others
