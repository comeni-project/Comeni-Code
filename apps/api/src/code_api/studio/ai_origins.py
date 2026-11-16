"""Revision evidence follows explicit edits; similarity is not authorship."""

from typing import Any

from code_schema import Node
from code_schema.edits import EditError
from code_schema.provenance import fingerprints


def require_mapping(before: Node, after: Node) -> None:
    if (
        before.provenance
        and not after.origin_mapped
        and (before.provenance != after.provenance or fingerprints(before) != fingerprints(after))
    ):
        raise EditError("AI origins need an explicit mapping for this edit")


def snapshot(node: Node) -> dict[str, Any]:
    return {} if node.provenance is None else node.provenance["items"]
