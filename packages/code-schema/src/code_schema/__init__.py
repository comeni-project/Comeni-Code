"""Comeni Code's node schema (architecture spec R2; M1 parts 1 to 3).

A node on disk is a folder: node.yaml, one body.md and, from M3, data files. The folder name is
the id. node.yaml holds the core fields and the node's links, each with a reason. Nothing here
raises: every function returns its value and a list of problems. `read_content` reads a whole
content folder; `code-schema validate` is the command around it.
"""

from __future__ import annotations

from code_schema.content import Content, read_content
from code_schema.links import Link
from code_schema.node import Level, Node, parse_node, read_node
from code_schema.problems import Problem
from code_schema.regions import Region, parse_regions, read_regions
from code_schema.writer import write_node_folder, write_node_yaml

__all__ = [
    "Content",
    "Level",
    "Link",
    "Node",
    "Problem",
    "Region",
    "parse_node",
    "parse_regions",
    "read_content",
    "read_node",
    "read_regions",
    "write_node_folder",
    "write_node_yaml",
]
