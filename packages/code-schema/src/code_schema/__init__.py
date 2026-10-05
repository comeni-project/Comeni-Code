"""Comeni Code's node schema (architecture spec R2; M1 parts 1 to 3).

A node on disk is a folder: node.yaml, one body.md and, from M3, data files. The folder name is
the id. node.yaml holds the core fields and the node's links, each with a reason. Nothing here
raises: every function returns its value and a list of problems. `read_content` reads a whole
content folder; `code-schema validate` is the command around it.
"""

from __future__ import annotations

from code_schema.blocks import (
    Block,
    Callout,
    Text,
    Try,
    block_from_json,
    block_json,
    parse_blocks,
    write_blocks,
)
from code_schema.content import Content, read_content
from code_schema.diagnostics import Diagnostic, UnknownDiagnostic, diagnostic
from code_schema.links import Link
from code_schema.node import Level, Node, parse_node, read_node
from code_schema.problems import Problem
from code_schema.providers import Provider, parse_providers, read_providers
from code_schema.questions import ChoiceQuestion, NumberQuestion, Option, Question
from code_schema.regions import Region, parse_regions, read_regions
from code_schema.resources import Resource
from code_schema.writer import write_node_folder, write_node_yaml

__all__ = [
    "Block",
    "Callout",
    "ChoiceQuestion",
    "Content",
    "Diagnostic",
    "Level",
    "Link",
    "Node",
    "NumberQuestion",
    "Option",
    "Problem",
    "Provider",
    "Question",
    "Region",
    "Resource",
    "Text",
    "Try",
    "UnknownDiagnostic",
    "block_from_json",
    "block_json",
    "diagnostic",
    "parse_blocks",
    "parse_node",
    "parse_providers",
    "parse_regions",
    "read_content",
    "read_node",
    "read_providers",
    "read_regions",
    "write_blocks",
    "write_node_folder",
    "write_node_yaml",
]
