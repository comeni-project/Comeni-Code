"""A node's outside resources, as written in node.yaml (spec M3P1.2, tutor spec T4.1).

Our explanation comes first and the resources follow it in a fixed *Learn it* section, so a
resource holds our own sentence and a link — never the resource's text (T4.1).

The registry decides three of the rules: which licences a provider may carry, whether it may be
embedded, and through which players (M3P5.3). `providers=None` means the content folder has no
registry, so those rules are skipped and `read_content` reports the missing file once.
"""

from __future__ import annotations

import difflib
from dataclasses import dataclass

from code_schema.fields import (
    Wrong,
    https_url,
    one_line,
    one_of,
    one_sentence,
    seconds,
    shown,
)
from code_schema.levels import Level
from code_schema.problems import Problem
from code_schema.providers import PLAYERS, REGISTRY, Provider, player_problem
from code_schema.records import Field
from code_schema.yaml_lines import Lines

RESOURCE_FIELD = "resources"
KINDS = ("video", "reading", "tutorial", "exercise")
DISPLAYS = ("embed", "link")

_KEYS = ("kind", "provider", "url", "video", "part", "covers", "licence", "display", "level")
_REQUIRED = tuple(key for key in _KEYS if key not in ("part", "video"))

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
    video: str = ""


def _range_problem(part: str) -> Wrong | None:
    """A video's part is a range the player can start and stop at, so it has to parse."""
    halves = part.replace("–", "-").split("-")
    bounds = [seconds(half.strip()) for half in halves] if len(halves) == 2 else []
    if len(bounds) != 2 or bounds[0] is None or bounds[1] is None:
        return Wrong(
            "CS0211",
            f"the part of a video is a timestamp range, such as 2:10–7:45, not {shown(part)}",
        )
    if bounds[1] <= bounds[0]:
        return Wrong("CS0212", f"the part {part} ends before it starts")
    return None


def _video_problem(video: object) -> Wrong | None:
    """A video to play is `player:id`, with an id in that player's form (M3P5.3)."""
    player, colon, identifier = str(video).partition(":")
    if not isinstance(video, str) or not colon:
        return Wrong(
            "CS0213",
            f"a video is written player:id, such as youtube:Jnk_4Maf5Fk, not {shown(video)}",
        )
    if (wrong := player_problem(player)) is not None:
        return wrong
    if not PLAYERS[player].fullmatch(identifier):
        return Wrong("CS0215", f"{identifier} is not a {player} video id")
    return None


def _registry_problems(
    provider: str,
    licence: str,
    display: str,
    video: str,
    providers: dict[str, Provider],
) -> list[tuple[str, str, str]]:
    """The rules only providers.yaml can decide, each as (key, code, message)."""
    known = providers.get(provider)
    if known is None:
        message = f"{provider} is not a provider in {REGISTRY}"
        if close := difflib.get_close_matches(provider, sorted(providers), n=1):
            message += f" — did you mean {close[0]}?"
        return [("provider", "CS0201", message)]
    found: list[tuple[str, str, str]] = []
    if licence not in known.licences:
        found.append(
            (
                "licence",
                "CS0202",
                f"the resource from {known.name} carries {licence}, "
                f"which {known.name} does not list",
            )
        )
    if display == "embed" and not known.embed:
        found.append(
            (
                "display",
                "CS0203",
                f"the resource from {known.name} asks for an embed it does not allow "
                "— use display: link",
            )
        )
    player = video.partition(":")[0]
    if video and player not in known.players:
        found.append(("video", "CS0204", f"{known.name} is not embedded through {player}"))
    return found


def parse_resources(
    value: object, *, providers: dict[str, Provider] | None, lines: Lines, file: str
) -> tuple[tuple[Resource, ...], list[Problem]]:
    """One resources: field. Never raises; returns the sound resources and every problem."""
    problems: list[Problem] = []
    field = Field(RESOURCE_FIELD, lines=lines, file=file, problems=problems)
    resources: list[Resource] = []
    first_seen: dict[str, int | None] = {}

    for entry in field.entries(
        value,
        not_a_list=("CS0205", "must be a list of resources"),
        not_a_mapping=("CS0206", lambda item: f"{shown(item)} is not a resource"),
    ):
        written = entry.mapping
        entry.unknown(
            _KEYS, "CS0207", lambda key: f"unknown key `{key}` in a resource ({', '.join(_KEYS)})"
        )
        for key in _REQUIRED:
            entry.require(key, "CS0208", f"a resource has no {key}")
        for key, check in (
            ("kind", _kind),
            ("url", _url),
            ("licence", _licence),
            ("display", _display),
            ("level", _level),
        ):
            entry.check(key, check)
        entry.check("covers", _covers, prefix="what this resource covers ")
        provider = written.get("provider")
        if "provider" in written and not isinstance(provider, str):
            entry.problem("CS0209", f"{shown(provider)} is not a provider id")

        part = written.get("part", "")
        # A video's part is a range; any other resource's part is a section, such as §17.1.
        if (
            entry.check("part", _section, prefix="the part ")
            and "part" in written
            and written.get("kind") == "video"
            and (wrong := _range_problem(str(part))) is not None
        ):
            entry.problem(wrong.code, wrong.message, key="part")

        video = written.get("video", "")
        if "video" in written:
            if (wrong := _video_problem(video)) is not None:
                entry.problem(wrong.code, wrong.message, key="video")
            elif written.get("kind") in KINDS and written.get("kind") != "video":
                entry.problem("CS0216", "only a video names a video to play", key="video")
        elif written.get("kind") == "video" and written.get("display") == "embed":
            entry.problem(
                "CS0217",
                "an embedded video names the video it plays, such as video: youtube:<id>",
                key="display",
            )

        if not entry.sound:
            continue
        kind, url = str(written["kind"]), str(written["url"])
        licence, display = str(written["licence"]), str(written["display"])
        level, covers = Level(str(written["level"])), str(written["covers"])

        if providers is not None:
            found = _registry_problems(str(provider), licence, display, str(video), providers)
            for key, code, message in found:
                entry.problem(code, message, line=entry.at(key) or entry.line)
            if found:
                continue

        if url in first_seen:
            entry.problem("CS0218", f"{url} is cited twice in this node", key="url")
            continue
        first_seen[url] = entry.at("url")
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
                video=str(video),
            )
        )
    return tuple(resources), problems
