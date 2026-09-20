"""A node's outside resources, as written in node.yaml (spec M3P1.2, tutor spec T4.1).

Our explanation comes first and the resources follow it in a fixed *Learn it* section, so a
resource holds our own sentence and a link — never the resource's text (T4.1).

The registry decides two of the rules: which licences a provider may carry, and whether it may be
embedded. `providers=None` means the content folder has no registry, so those two rules are
skipped and `read_content` reports the missing file once.
"""

from __future__ import annotations

import difflib
from dataclasses import dataclass

from code_schema.fields import https_url, one_line, one_of, one_sentence, seconds, shown
from code_schema.levels import Level
from code_schema.problems import Problem
from code_schema.providers import REGISTRY, Provider
from code_schema.yaml_lines import Lines

RESOURCE_FIELD = "resources"
KINDS = ("video", "reading", "tutorial", "exercise")
DISPLAYS = ("embed", "link")

_KEYS = ("kind", "provider", "url", "part", "covers", "licence", "display", "level")
_REQUIRED = tuple(key for key in _KEYS if key != "part")

_kind = one_of(KINDS, noun="kind of resource")
_url = https_url()
_covers = one_sentence(max_len=200)
_licence = one_line(max_len=60)
_display = one_of(DISPLAYS, noun="display")
_level = one_of(tuple(Level), noun="level")
_section = one_line(max_len=60)


@dataclass(frozen=True)
class Resource:
    kind: str
    provider: str
    url: str
    covers: str
    licence: str
    display: str
    level: Level
    part: str = ""


def _range_problem(part: str) -> str | None:
    """A video's part is a range the player can start and stop at, so it has to parse."""
    halves = part.replace("–", "-").split("-")
    bounds = [seconds(half.strip()) for half in halves] if len(halves) == 2 else []
    if len(bounds) != 2 or bounds[0] is None or bounds[1] is None:
        return f"the part of a video is a timestamp range, such as 2:10–7:45, not {shown(part)}"
    if bounds[1] <= bounds[0]:
        return f"the part {part} ends before it starts"
    return None


def _registry_problems(
    entry: dict[object, object],
    provider: str,
    licence: str,
    display: str,
    providers: dict[str, Provider],
) -> list[tuple[str, str]]:
    """The rules only providers.yaml can decide, each as (key, message)."""
    known = providers.get(provider)
    if known is None:
        message = f"{provider} is not a provider in {REGISTRY}"
        if close := difflib.get_close_matches(provider, sorted(providers), n=1):
            message += f" — did you mean {close[0]}?"
        return [("provider", message)]
    found: list[tuple[str, str]] = []
    if licence not in known.licences:
        found.append(
            (
                "licence",
                f"the resource from {known.name} carries {licence}, "
                f"which {known.name} does not list",
            )
        )
    if display == "embed" and not known.embed:
        found.append(
            (
                "display",
                f"the resource from {known.name} asks for an embed it does not allow "
                "— use display: link",
            )
        )
    return found


def parse_resources(
    value: object, *, providers: dict[str, Provider] | None, lines: Lines, file: str
) -> tuple[tuple[Resource, ...], list[Problem]]:
    """One resources: field. Never raises; returns the sound resources and every problem."""
    field_line = lines.get(RESOURCE_FIELD)

    def problem(message: str, line: int | None = field_line) -> Problem:
        return Problem(file=file, field=RESOURCE_FIELD, line=line, message=message)

    if not isinstance(value, list):
        return (), [problem("must be a list of resources")]
    if not value:
        return (), [problem("an empty list is written by leaving the field out")]

    resources: list[Resource] = []
    problems: list[Problem] = []
    first_seen: dict[str, int | None] = {}

    for entry in value:
        if not isinstance(entry, dict):
            problems.append(problem(f"{shown(entry)} is not a resource"))
            continue
        entry_line = next((lines.of(entry, str(key)) for key in entry), field_line)

        sound = True
        for key in entry:
            if key not in _KEYS:
                problems.append(
                    problem(
                        f"unknown key `{key}` in a resource ({', '.join(_KEYS)})",
                        lines.of(entry, str(key)),
                    )
                )
                sound = False
        for key in _REQUIRED:
            if key not in entry:
                problems.append(problem(f"a resource has no {key}", entry_line))
                sound = False

        for key, check in (
            ("kind", _kind),
            ("url", _url),
            ("licence", _licence),
            ("display", _display),
            ("level", _level),
        ):
            if key in entry and (wrong := check(entry[key])) is not None:
                problems.append(problem(wrong, lines.of(entry, key)))
                sound = False
        if "covers" in entry and (wrong := _covers(entry["covers"])) is not None:
            problems.append(
                problem(f"what this resource covers {wrong}", lines.of(entry, "covers"))
            )
            sound = False
        provider = entry.get("provider")
        if "provider" in entry and not isinstance(provider, str):
            problems.append(problem(f"{shown(provider)} is not a provider id", entry_line))
            sound = False

        part = entry.get("part", "")
        if "part" in entry:
            if (wrong := _section(part)) is not None:
                problems.append(problem(f"the part {wrong}", lines.of(entry, "part")))
                sound = False
            elif entry.get("kind") == "video" and (wrong := _range_problem(str(part))) is not None:
                problems.append(problem(wrong, lines.of(entry, "part")))
                sound = False

        if not sound:
            continue
        kind, url = str(entry["kind"]), str(entry["url"])
        licence, display = str(entry["licence"]), str(entry["display"])
        level, covers = Level(str(entry["level"])), str(entry["covers"])

        if providers is not None:
            found = _registry_problems(entry, str(provider), licence, display, providers)
            problems += [
                problem(message, lines.of(entry, key) or entry_line) for key, message in found
            ]
            if found:
                continue

        if url in first_seen:
            problems.append(problem(f"{url} is cited twice in this node", lines.of(entry, "url")))
            continue
        first_seen[url] = lines.of(entry, "url")
        resources.append(
            Resource(
                kind=kind,
                provider=str(provider),
                url=url,
                covers=covers,
                licence=licence,
                display=display,
                level=level,
                part=str(part),
            )
        )
    return tuple(resources), problems
