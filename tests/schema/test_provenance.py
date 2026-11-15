"""Public receipts are closed, bound to content, and round-trip without private draft evidence."""

import json
from dataclasses import replace
from pathlib import Path
from typing import Any

import pytest

from code_schema import Level, Node, read_node, write_node_folder
from code_schema.provenance import fingerprints, read_provenance, write_provenance

NODE = Node("test", "Test", "Count the windows.", "biology", Level.FOUNDATIONS, 5, "Two windows.\n")
RECEIPT = "12345678-1234-4234-8234-123456789abc"


def receipt() -> dict[str, Any]:
    return {
        "version": 1,
        "receipts": {
            RECEIPT: {
                "model": "openai/local",
                "prompt_id": "draft-block@1",
                "settings": {"timeout": 60},
                "sources": [{"hash": "a" * 64}],
            }
        },
        "items": {"block/0": {"fingerprint": fingerprints(NODE)["block/0"], "receipts": [RECEIPT]}},
    }


def test_round_trip_and_optional_removal(tmp_path: Path) -> None:
    value = receipt()
    text = write_provenance(value)
    parsed, problems = read_provenance(text, NODE)
    assert parsed == value and problems == []
    folder = tmp_path / "test"
    write_node_folder(replace(NODE, provenance=value), folder)
    again, problems = read_node(folder, regions={"biology"}, root=tmp_path)
    assert problems == [] and again is not None and again.provenance == value
    assert (folder / "provenance.json").read_text() == text
    write_node_folder(NODE, folder)
    assert not (folder / "provenance.json").exists()


@pytest.mark.parametrize("broken", ['{"version":1,"version":1}', '{"version":NaN}'])
def test_ambiguous_json_is_refused(broken: str) -> None:
    assert read_provenance(broken, NODE)[1][0].code == "CS1200"


@pytest.mark.parametrize("field", ["user", "email", "token", "excerpt", "raw_candidate"])
def test_private_fields_never_enter_a_public_receipt(field: str) -> None:
    value = receipt()
    value["receipts"][RECEIPT][field] = "private"
    assert read_provenance(json.dumps(value), NODE)[1][0].code == "CS1201"


def test_bad_targets_and_receipt_references_are_refused() -> None:
    value = receipt()
    changed = replace(NODE, body="Three windows.\n")
    assert read_provenance(json.dumps(value), changed)[1][0].code == "CS1202"
    value["items"]["block/0"]["receipts"] = ["missing"]
    assert read_provenance(json.dumps(value), NODE)[1][0].code == "CS1203"
    value["version"] = 2
    assert read_provenance(json.dumps(value), NODE)[1][0].code == "CS1201"


def test_an_unreadable_public_file_is_a_diagnostic(tmp_path: Path) -> None:
    folder = tmp_path / "test"
    write_node_folder(NODE, folder)
    (folder / "provenance.json").write_bytes(b"\xff")
    node, problems = read_node(folder, regions={"biology"}, root=tmp_path)
    assert node is None and problems[0].code == "CS0022"
