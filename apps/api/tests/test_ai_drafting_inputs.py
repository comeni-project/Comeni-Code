"""Only the captured target, schema and supplied sources can enter a drafting call."""

import pytest

from code_api.studio.ai_context import build_messages
from code_api.studio.ai_edits import apply_candidate, payload
from code_api.studio.ai_schemas import DraftingError
from code_schema import Level, Node

NODE = Node("test", "Test", "Count windows.", "biology", Level.FOUNDATIONS, 5, "Two windows.\n")


def test_block_adapter_refuses_an_operation_or_kind_change() -> None:
    assert payload(NODE, "block/0") == {"kind": "text", "markdown": "Two windows.\n"}
    with pytest.raises(DraftingError):
        apply_candidate(NODE, "block/0", {"kind": "image", "file": "secret.png"})
    with pytest.raises(DraftingError):
        apply_candidate(NODE, "block/0", {"kind": "text", "markdown": "ok", "publish": True})


def test_messages_contain_only_selected_context_and_a_versioned_prompt() -> None:
    messages = build_messages(
        "draft-block@1", NODE, "block/0", "Explain.", [], [], payload(NODE, "block/0")
    )
    assert "Count windows." in messages[1]["content"]
    assert "Two windows." in messages[1]["content"]
    assert "propose" in messages[0]["content"].lower()
    with pytest.raises(DraftingError):
        build_messages("../../secret", NODE, "block/0", "", [], [], {})
