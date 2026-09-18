"""One correct way to write a node (spec M1P1.6, M1P2.6).

Landing generates these files, so the writer is canonical: fixed field order, block style, no key
sorting, no folding, lists indented under their key. Comments are not preserved — node.yaml is not
a place to leave a note.
"""

from __future__ import annotations

from pathlib import Path

import yaml

from code_schema.links import Link
from code_schema.node import BODY_FILE, NODE_FILE, SCHEMA, Node

# PyYAML folds long strings at 80 columns by default; a claim or a reason must stay on one line.
_NO_FOLDING = 1_000_000

# The YAML key and the Node attribute, in the order they are written.
_LINKS = (("needs", "needs"), ("goes-deeper", "goes_deeper"), ("related", "related"))


class _IndentedDumper(yaml.SafeDumper):
    """Lists indented under their key (`  - node: …`), as every example in the specs is written.

    PyYAML's default puts the dash at the key's own column. A SafeDumper, so writing stays safe.
    """

    def increase_indent(self, flow: bool = False, indentless: bool = False) -> None:
        return super().increase_indent(flow, False)


def write_node_yaml(node: Node) -> str:
    """The node's fields in the order the specs fix; each kind of link only when it has any."""
    fields: dict[str, object] = {
        "schema": SCHEMA,
        "title": node.title,
        "claim": node.claim,
        "region": node.region,
        "level": node.level.value,
        "minutes": node.minutes,
    }
    for key, attribute in _LINKS:
        links: tuple[Link, ...] = getattr(node, attribute)
        if links:
            fields[key] = [{"node": link.node, "reason": link.reason} for link in links]
    return str(
        yaml.dump(
            fields,
            Dumper=_IndentedDumper,
            sort_keys=False,
            default_flow_style=False,
            allow_unicode=True,
            width=_NO_FOLDING,
        )
    )


def write_node_folder(node: Node, folder: Path) -> None:
    """Write node.yaml and body.md. The body goes back byte for byte: M1 does not look inside it."""
    folder.mkdir(parents=True, exist_ok=True)
    (folder / NODE_FILE).write_text(write_node_yaml(node), encoding="utf-8", newline="\n")
    (folder / BODY_FILE).write_text(node.body, encoding="utf-8", newline="")
