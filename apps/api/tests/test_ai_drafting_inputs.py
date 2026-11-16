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
    with pytest.raises(DraftingError) as missing:
        build_messages("../../secret", NODE, "block/0", "", [], [], {})
    assert missing.value.code == "CA0508"


@pytest.mark.parametrize("target", ["block/-1", "block/00", "block/1/extra"])
def test_a_target_is_a_canonical_item_key(target: str) -> None:
    with pytest.raises(DraftingError):
        payload(NODE, target)


def test_every_supported_fixture_item_can_use_its_typed_edit_adapter() -> None:
    from pathlib import Path

    from code_api.studio.ai_edits import SUPPORTED
    from code_schema import read_content

    content = read_content(Path(__file__).resolve().parents[3] / "tests/fixtures/salmon")
    seen = set()
    for node in content.nodes.values():
        targets = [
            f"block/{i}"
            for i, b in enumerate(node.blocks)
            if b.__class__.__name__.lower().replace("sequenceblock", "sequence") in SUPPORTED
        ]
        targets += [f"try/{q.id}" for q in node.questions]
        targets += [f"exam/{q.id}" for q in node.exam]
        if node.problem is not None:
            targets.append("problem")
        for target in targets:
            current = payload(node, target)
            changed = apply_candidate(node, target, current)
            assert payload(changed, target) == current
            seen.add(target.split("/")[0])
    assert seen == {"block", "try", "exam", "problem"}
