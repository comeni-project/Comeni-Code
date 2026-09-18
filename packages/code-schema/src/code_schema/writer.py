"""One correct way to write a node (spec M1P1.6).

Landing generates these files, so the writer is canonical: fixed field order, block style, no key
sorting, no folding. Comments are not preserved — node.yaml is not a place to leave a note.
"""

from __future__ import annotations

from pathlib import Path

import yaml

from code_schema.node import BODY_FILE, NODE_FILE, SCHEMA, Node

# PyYAML folds long strings at 80 columns by default; a claim must stay on one line.
_NO_FOLDING = 1_000_000


def write_node_yaml(node: Node) -> str:
    """The node's fields in the order the spec fixes. Part 2 appends its links to this mapping."""
    fields: dict[str, object] = {
        "schema": SCHEMA,
        "title": node.title,
        "claim": node.claim,
        "region": node.region,
        "level": node.level.value,
        "minutes": node.minutes,
    }
    return yaml.safe_dump(
        fields,
        sort_keys=False,
        default_flow_style=False,
        allow_unicode=True,
        width=_NO_FOLDING,
    )


def write_node_folder(node: Node, folder: Path) -> None:
    """Write node.yaml and body.md. The body goes back byte for byte: M1 does not look inside it."""
    folder.mkdir(parents=True, exist_ok=True)
    (folder / NODE_FILE).write_text(write_node_yaml(node), encoding="utf-8", newline="\n")
    (folder / BODY_FILE).write_text(node.body, encoding="utf-8", newline="")
