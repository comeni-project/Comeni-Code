"""Provenance follows edits and normalization; identical content is not identity."""

from dataclasses import replace
from typing import Any

from code_schema import Callout, Level, Node, Text, write_blocks
from code_schema.edits import delete_block, insert_block, move_block, update_block
from code_schema.provenance import fingerprints, read_provenance, write_provenance

R = "12345678-1234-4234-8234-123456789abc"


def tracked() -> Node:
    body = write_blocks(
        [Text("Same.\n"), Callout("caveat", "between", "Between.\n"), Text("Same.\n")]
    )
    node = Node("test", "Test", "Count windows.", "biology", Level.FOUNDATIONS, 5, body)
    public: dict[str, Any] = {
        "version": 1,
        "receipts": {
            R: {
                "model": "openai/local",
                "prompt_id": "draft-block@1",
                "settings": {},
                "sources": [],
            }
        },
        "items": {"block/2": {"fingerprint": fingerprints(node)["block/2"], "receipts": [R]}},
    }
    return replace(node, provenance=public)


def test_an_identical_block_moved_keeps_only_its_own_origin() -> None:
    node = move_block(tracked(), 2, 0)
    assert node.provenance is not None
    # Moving makes the two text blocks adjacent: canonical normalization combines them.
    assert list(node.provenance["items"]) == ["block/0"]
    assert read_provenance(write_provenance(node.provenance), node)[1] == []


def test_deleting_between_text_preserves_the_combined_origin() -> None:
    node = delete_block(tracked(), 1)
    assert node.provenance is not None
    assert list(node.provenance["items"]) == ["block/0"]


def test_a_human_update_and_insert_keep_the_original_receipt() -> None:
    node = update_block(tracked(), 2, Text("Corrected.\n"))
    node = insert_block(node, 0, Callout("caveat", "before", "Before.\n"))
    assert node.provenance is not None
    assert list(node.provenance["items"]) == ["block/3"]
    assert node.provenance["items"]["block/3"]["receipts"] == [R]
