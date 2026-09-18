"""The region registry at the content root (spec M1P1.3).

`region` cannot be checked without it, so part 1 owns it. Free text drifts within a month
(sequence-analysis, sequence analysis, Sequence Analysis) and every facet and tie-break splits.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from code_schema.fields import one_line, shown, slug
from code_schema.problems import Problem
from code_schema.yaml_lines import Lines, load_mapping

REGISTRY = "regions.yaml"

_id = slug(noun="region id")
_name = one_line(max_len=80)


@dataclass(frozen=True)
class Region:
    id: str
    name: str


def _entry_problem(
    entry: dict[object, object], key: str, check_result: str | None, lines: Lines, file: str
) -> Problem | None:
    if key not in entry:
        # A missing key has no line of its own; the entry's first line is the nearest place.
        line = next(iter(lines.of(entry, str(k)) for k in entry), None)
        return Problem(file=file, field=key, line=line, message="required field is missing")
    if check_result is not None:
        return Problem(file=file, field=key, line=lines.of(entry, key), message=check_result)
    return None


def parse_regions(text: str, *, file: str = REGISTRY) -> tuple[dict[str, Region], list[Problem]]:
    data, lines, problems = load_mapping(text, file=file)
    if data is None:
        return {}, problems

    listed = data.get("regions")
    if not isinstance(listed, list):
        return {}, [
            Problem(
                file=file,
                field="regions",
                line=lines.get("regions"),
                message="must be a list of regions",
            )
        ]

    regions: dict[str, Region] = {}
    for entry in listed:
        if not isinstance(entry, dict):
            problems.append(
                Problem(file=file, field="regions", message=f"{shown(entry)} is not a region")
            )
            continue
        identifier, name = entry.get("id"), entry.get("name")
        wrong = [
            found
            for found in (
                _entry_problem(entry, "id", _id(identifier), lines, file),
                _entry_problem(entry, "name", _name(name), lines, file),
            )
            if found is not None
        ]
        if wrong:
            problems += wrong
            continue
        if not isinstance(identifier, str) or not isinstance(name, str):
            continue  # unreachable: both checks above passed
        if identifier in regions:
            problems.append(
                Problem(
                    file=file,
                    field="id",
                    line=lines.of(entry, "id"),
                    message=f"{shown(identifier)} is listed twice",
                )
            )
            continue
        regions[identifier] = Region(id=identifier, name=name)
    return regions, problems


def read_regions(root: Path) -> tuple[dict[str, Region], list[Problem]]:
    path = root / REGISTRY
    if not path.is_file():
        return {}, [Problem(file=REGISTRY, message="the file is missing")]
    return parse_regions(path.read_text(encoding="utf-8"))
