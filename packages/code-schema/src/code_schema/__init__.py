"""Comeni Code's node schema (architecture spec R2, M1 part 1).

A node on disk is a folder: node.yaml, one body.md and, from M3, data files. The folder name is
the id. Nothing here raises: every function returns its value and a list of problems.
"""

from __future__ import annotations

from code_schema.node import Level, Node, parse_node, read_node
from code_schema.problems import Problem
from code_schema.regions import Region, parse_regions, read_regions
from code_schema.writer import write_node_folder, write_node_yaml

__all__ = [
    "Level",
    "Node",
    "Problem",
    "Region",
    "parse_node",
    "parse_regions",
    "read_node",
    "read_regions",
    "write_node_folder",
    "write_node_yaml",
]
