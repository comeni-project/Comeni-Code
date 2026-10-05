"""A node's links, as written in node.yaml (spec M1P2.2, M1P2.5).

Every link of every kind has one shape, `node` + `reason`, so one parser serves all three. Only
the rules one file can check live here; targets that exist, symmetry, cycles and levels need the
whole graph (part 3).
"""

from __future__ import annotations

from dataclasses import dataclass

from code_schema.fields import Wrong, one_sentence, shown, slug
from code_schema.problems import Problem
from code_schema.records import Field
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


def _reason_problem(value: object) -> Wrong | None:
    """Phrased to follow "the reason for <node>"."""
    if not isinstance(value, str):
        return Wrong("CS0007", "is not text")
    return _sentence(value)


def parse_links(
    value: object, *, kind: str, node_id: str, lines: Lines, file: str
) -> tuple[tuple[Link, ...], tuple[int | None, ...], list[Problem]]:
    """One link list. Never raises; returns the valid links, the line of each, and the problems."""
    problems: list[Problem] = []
    field = Field(kind, lines=lines, file=file, problems=problems)
    links: list[Link] = []
    link_lines: list[int | None] = []
    first_seen: dict[str, int | None] = {}

    for entry in field.entries(
        value,
        not_a_list=("CS0101", "must be a list of links, each with a node and a reason"),
        not_a_mapping=(
            "CS0102",
            lambda item: f"{shown(item)} is not a link — write node: and reason: on separate lines",
        ),
    ):
        node_line = entry.at("node")
        entry.unknown(
            _LINK_KEYS,
            "CS0103",
            lambda key: f"unknown key `{key}` in a link (a link has node and reason)",
        )
        if not entry.require("node", "CS0104", "a link has no node"):
            continue
        target = entry.mapping["node"]
        wrong = _node_id(target)
        if wrong is not None or not isinstance(target, str):
            # The id check refuses anything that is not a valid id, text or not, so its CS0015 is
            # the code either way; the fallback only satisfies the type checker.
            said = wrong.message if wrong is not None else f"{shown(target)} is not a node id"
            entry.problem("CS0015", said, line=node_line)
            continue

        reason = entry.mapping.get("reason")
        if "reason" not in entry.mapping:
            entry.problem("CS0106", f"the link to {target} has no reason", line=node_line)
        elif (wrong := _reason_problem(reason)) is not None:
            entry.problem(wrong.code, f"the reason for {target} {wrong.message}", key="reason")

        if target == node_id:
            entry.problem("CS0108", f"{target} links to itself", line=node_line)
            continue
        if target in first_seen:
            first = first_seen[target]
            where = "" if first is None else f" (first on line {first})"
            entry.problem("CS0109", f"{target} is listed twice{where}", line=node_line)
            continue
        first_seen[target] = node_line

        if entry.sound and isinstance(reason, str):
            links.append(Link(node=target, reason=reason))
            link_lines.append(node_line)

    if kind == "related" and isinstance(value, list) and len(value) > MAX_PEERS:
        over = value[MAX_PEERS]
        line = lines.of(over, "node") if isinstance(over, dict) else field.line
        field.problem(
            "CS0110",
            f"{len(value)} peers, at most {MAX_PEERS} — a node with more is probably two nodes",
            line,
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
