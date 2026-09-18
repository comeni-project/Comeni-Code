"""A node's links, as written in node.yaml (spec M1P2.2, M1P2.5).

Every link of every kind has one shape, `node` + `reason`, so one parser serves all three. Only
the rules one file can check live here; targets that exist, symmetry, cycles and levels need the
whole graph (part 3).
"""

from __future__ import annotations

from dataclasses import dataclass

from code_schema.fields import one_sentence, shown, slug
from code_schema.problems import Problem
from code_schema.yaml_lines import Lines, load_mapping

LINK_FIELDS = ("needs", "goes-deeper", "related")
MAX_PEERS = 4

_LINK_KEYS = ("node", "reason")
_node_id = slug(noun="node id")
_sentence = one_sentence(max_len=200)


@dataclass(frozen=True)
class Link:
    node: str
    reason: str


def _reason_problem(value: object) -> str | None:
    """Phrased to follow "the reason for <node>"."""
    if not isinstance(value, str):
        return "is not text"
    return _sentence(value)


def parse_links(
    value: object, *, kind: str, node_id: str, lines: Lines, file: str
) -> tuple[tuple[Link, ...], tuple[int | None, ...], list[Problem]]:
    """One link list. Never raises; returns the valid links, the line of each, and the problems."""
    field_line = lines.get(kind)

    def problem(message: str, line: int | None = field_line) -> Problem:
        return Problem(file=file, field=kind, line=line, message=message)

    if not isinstance(value, list):
        return (), (), [problem("must be a list of links, each with a node and a reason")]
    if not value:
        return (), (), [problem("an empty list is written by leaving the field out")]

    links: list[Link] = []
    link_lines: list[int | None] = []
    problems: list[Problem] = []
    first_seen: dict[str, int | None] = {}

    for entry in value:
        if not isinstance(entry, dict):
            problems.append(
                problem(f"{shown(entry)} is not a link — write node: and reason: on separate lines")
            )
            continue
        node_line = lines.of(entry, "node")
        sound = True

        for key in entry:
            if key not in _LINK_KEYS:
                problems.append(
                    problem(
                        f"unknown key `{key}` in a link (a link has node and reason)",
                        lines.of(entry, str(key)),
                    )
                )
                sound = False

        target = entry.get("node")
        if "node" not in entry:
            entry_line = next((lines.of(entry, str(key)) for key in entry), field_line)
            problems.append(problem("a link has no node", entry_line))
            continue
        wrong = _node_id(target)
        if wrong is not None or not isinstance(target, str):
            problems.append(problem(wrong or f"{shown(target)} is not a node id", node_line))
            continue

        reason = entry.get("reason")
        if "reason" not in entry:
            problems.append(problem(f"the link to {target} has no reason", node_line))
            sound = False
        elif (wrong := _reason_problem(reason)) is not None:
            problems.append(problem(f"the reason for {target} {wrong}", lines.of(entry, "reason")))
            sound = False

        if target == node_id:
            problems.append(problem(f"{target} links to itself", node_line))
            continue
        if target in first_seen:
            first = first_seen[target]
            where = "" if first is None else f" (first on line {first})"
            problems.append(problem(f"{target} is listed twice{where}", node_line))
            continue
        first_seen[target] = node_line

        if sound and isinstance(reason, str):
            links.append(Link(node=target, reason=reason))
            link_lines.append(node_line)

    if kind == "related" and len(value) > MAX_PEERS:
        over = value[MAX_PEERS]
        line = lines.of(over, "node") if isinstance(over, dict) else field_line
        problems.append(
            problem(
                f"{len(value)} peers, at most {MAX_PEERS} — a node with more is probably two nodes",
                line,
            )
        )

    return tuple(links), tuple(link_lines), problems


def locate_links(node_yaml: str, *, file: str) -> dict[tuple[str, str], int]:
    """The line of each link's `node` key, by kind and target, for messages about links.

    Lines are not stored on Node: a node is a value the round-trip laws compare, and where it was
    written is not part of it.
    """
    data, lines, _ = load_mapping(node_yaml, file=file)
    found: dict[tuple[str, str], int] = {}
    if data is None:
        return found
    for kind in LINK_FIELDS:
        entries = data.get(kind)
        if not isinstance(entries, list):
            continue
        for entry in entries:
            if not isinstance(entry, dict):
                continue
            target, line = entry.get("node"), lines.of(entry, "node")
            if isinstance(target, str) and line is not None:
                found.setdefault((kind, target), line)
    return found
