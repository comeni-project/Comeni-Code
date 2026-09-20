"""The provider registry at the content root (spec M3P1.2).

A resource cites a provider, and the provider decides which licences it may carry and whether it
may be embedded (tutor spec T4.2). Keeping the list here rather than in this package means a
publisher can be added by a content pull request instead of a release.

The file is read only when a resource cites a provider: `read_providers` answers None for "no
registry", which is not the same as an empty one.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from code_schema.fields import one_line, shown, slug
from code_schema.problems import Problem
from code_schema.yaml_lines import Lines, load_mapping

REGISTRY = "providers.yaml"

_id = slug(noun="provider id")
_name = one_line(max_len=80)
_licence = one_line(max_len=60)


@dataclass(frozen=True)
class Provider:
    id: str
    name: str
    licences: tuple[str, ...]
    embed: bool


def _licences_problem(value: object) -> str | None:
    if not isinstance(value, list):
        return "must be a list of licences"
    if not value:
        return "must list at least one licence"
    for entry in value:
        if (wrong := _licence(entry)) is not None:
            return wrong
    return None


def _embed_problem(value: object) -> str | None:
    return None if isinstance(value, bool) else f"{shown(value)} is not true or false"


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


def parse_providers(
    text: str, *, file: str = REGISTRY
) -> tuple[dict[str, Provider], list[Problem]]:
    data, lines, problems = load_mapping(text, file=file)
    if data is None:
        return {}, problems

    listed = data.get("providers")
    if not isinstance(listed, list):
        return {}, [
            Problem(
                file=file,
                field="providers",
                line=lines.get("providers"),
                message="must be a list of providers",
            )
        ]

    providers: dict[str, Provider] = {}
    for entry in listed:
        if not isinstance(entry, dict):
            problems.append(
                Problem(file=file, field="providers", message=f"{shown(entry)} is not a provider")
            )
            continue
        identifier, name = entry.get("id"), entry.get("name")
        licences, embed = entry.get("licences"), entry.get("embed")
        wrong = [
            found
            for found in (
                _entry_problem(entry, "id", _id(identifier), lines, file),
                _entry_problem(entry, "name", _name(name), lines, file),
                _entry_problem(entry, "licences", _licences_problem(licences), lines, file),
                _entry_problem(entry, "embed", _embed_problem(embed), lines, file),
            )
            if found is not None
        ]
        if wrong:
            problems += wrong
            continue
        if not isinstance(identifier, str) or not isinstance(name, str):
            continue  # unreachable: both checks above passed
        if not isinstance(licences, list) or not isinstance(embed, bool):
            continue  # unreachable, for the same reason
        if identifier in providers:
            problems.append(
                Problem(
                    file=file,
                    field="id",
                    line=lines.of(entry, "id"),
                    message=f"{shown(identifier)} is listed twice",
                )
            )
            continue
        providers[identifier] = Provider(
            id=identifier,
            name=name,
            licences=tuple(str(licence) for licence in licences),
            embed=embed,
        )
    return providers, problems


def read_providers(root: Path) -> tuple[dict[str, Provider] | None, list[Problem]]:
    """The registry, or None when the file is absent — which only a resource makes a problem."""
    path = root / REGISTRY
    if not path.is_file():
        return None, []
    return parse_providers(path.read_text(encoding="utf-8"))
