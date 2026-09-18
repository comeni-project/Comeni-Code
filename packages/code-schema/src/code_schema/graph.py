"""The rules that need more than one node (spec M1P3.4)."""

from __future__ import annotations

from code_schema.node import Node
from code_schema.problems import Problem


def graph_problems(
    nodes: dict[str, Node],
    folders: dict[str, str],
    link_lines: dict[str, dict[tuple[str, str], int]],
) -> list[Problem]:
    """Filled by the next commit."""
    return []
