"""A node as it is written on disk (spec M1P1.2, M1P1.3).

The folder name is the id; there is no id field. The field set is closed, so a typo is a problem
rather than a silently ignored key — and when a typo matches a missing required field, it is one
problem, not two.
"""

from __future__ import annotations

import difflib
from collections.abc import Collection
from dataclasses import dataclass
from enum import StrEnum

from code_schema.fields import (
    Spec,
    exactly,
    in_registry,
    one_line,
    one_of,
    one_sentence,
    slug,
    whole_number,
)
from code_schema.problems import Problem
from code_schema.yaml_lines import load_mapping

SCHEMA = 1


class Level(StrEnum):
    """T10.1's five. A level describes a node, never a learner."""

    FIRST_STEPS = "first-steps"
    FOUNDATIONS = "foundations"
    INTRODUCTORY = "introductory"
    INTERMEDIATE = "intermediate"
    ADVANCED = "advanced"


@dataclass(frozen=True)
class Node:
    id: str
    title: str
    claim: str
    region: str
    level: Level
    minutes: int
    body: str


def fields(regions: Collection[str]) -> tuple[Spec, ...]:
    """The rows of spec M1P1.3, in the order the writer uses. Part 2 appends its links."""
    return (
        Spec("schema", required=True, check=exactly(SCHEMA)),
        Spec("title", required=True, check=one_line(max_len=80)),
        Spec("claim", required=True, check=one_sentence(max_len=200)),
        Spec(
            "region",
            required=True,
            check=in_registry(regions, noun="region", registry="regions.yaml"),
        ),
        Spec("level", required=True, check=one_of(tuple(Level), noun="level")),
        Spec("minutes", required=True, check=whole_number(minimum=1)),
    )


_node_id = slug(noun="node id")


def parse_node(
    node_yaml: str,
    body: str,
    *,
    node_id: str,
    regions: Collection[str],
    file: str,
) -> tuple[Node | None, list[Problem]]:
    """Never raises. Returns the node only when there is no problem at all."""
    folder = file.rsplit("/", 1)[0] + "/" if "/" in file else ""
    problems: list[Problem] = []

    if (wrong := _node_id(node_id)) is not None:
        problems.append(Problem(file=folder, message=wrong))
    if not body.strip():
        problems.append(Problem(file=f"{folder}body.md", message="the file is empty"))

    data, lines, load_problems = load_mapping(node_yaml, file=file)
    problems += load_problems
    if data is None:
        return None, sorted(problems, key=Problem.sort_key)

    specs = fields(regions)
    known = {spec.name for spec in specs}
    missing = [spec.name for spec in specs if spec.required and spec.name not in data]
    for key in data:
        if key in known:
            continue
        message = f"unknown field `{key}`"
        if close := difflib.get_close_matches(key, missing, n=1):
            # A typo of a required field is one mistake, so it is one problem.
            message += f" — did you mean `{close[0]}`? ({close[0]} is required and missing)"
            missing.remove(close[0])
        problems.append(Problem(file=file, line=lines.get(key), message=message))
    for name in missing:
        problems.append(Problem(file=file, field=name, message="required field is missing"))

    for spec in specs:
        if spec.name in data and (wrong := spec.check(data[spec.name])) is not None:
            problems.append(
                Problem(file=file, field=spec.name, line=lines.get(spec.name), message=wrong)
            )

    if problems:
        return None, sorted(problems, key=Problem.sort_key)

    title, claim, region, level, minutes = (
        data["title"],
        data["claim"],
        data["region"],
        data["level"],
        data["minutes"],
    )
    # Every check passed, so these hold; the isinstance calls are for the type checker.
    assert isinstance(title, str) and isinstance(claim, str) and isinstance(region, str)
    assert isinstance(level, str) and isinstance(minutes, int)
    return (
        Node(
            id=node_id,
            title=title,
            claim=claim,
            region=region,
            level=Level(level),
            minutes=minutes,
            body=body,
        ),
        [],
    )
