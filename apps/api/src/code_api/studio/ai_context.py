"""Minimal captured context and installed, versioned prompt resources."""

import json
from importlib.resources import files
from typing import Any

from code_api.studio.ai_schemas import DraftAnswer, DraftingError
from code_schema import Node

PROMPTS = {
    "draft-block@1": "draft-block.v1.txt",
    "suggest-resource@1": "suggest-resource.v1.txt",
    "draft-figure@1": "draft-figure.v1.txt",
}


def build_messages(
    prompt_id: str,
    node: Node,
    target: str,
    instruction: str,
    sources: list[dict[str, Any]],
    candidates: list[dict[str, Any]],
    current: dict[str, Any],
) -> list[dict[str, str]]:
    try:
        prompt = (
            files("code_api.ai.prompts").joinpath(PROMPTS[prompt_id]).read_text(encoding="utf-8")
        )
    except KeyError, OSError:
        raise DraftingError("CA0508", "This prompt version is unavailable.") from None
    context: dict[str, Any] = {
        "title": node.title,
        "claim": node.claim,
        "level": node.level.value,
        "target": target,
        "instruction": instruction,
        "current": current,
        "sources": sources,
        "candidates": candidates,
        "reply_schema": DraftAnswer.model_json_schema(),
    }
    if prompt_id == "draft-block@1":
        from code_api.studio.edit_inputs import BlockIn, ExamQuestionIn, TryQuestionIn

        schema = (
            BlockIn
            if target.startswith("block/")
            else TryQuestionIn
            if target.startswith("try/")
            else ExamQuestionIn
        )
        context["item_schema"] = (
            {"type": "object", "properties": {"text": {"type": "string"}}, "required": ["text"]}
            if target == "problem"
            else schema.model_json_schema()
        )
    if prompt_id == "draft-figure@1":
        from code_figures import COMPONENTS

        component = COMPONENTS.get(current.get("component", ""))
        if component is None:
            raise DraftingError("CA0500", "Choose a known figure component first.")
        context["component_schema"] = component.schema
        context["example"] = component.starter
    return [
        {"role": "system", "content": prompt},
        {"role": "user", "content": json.dumps(context, ensure_ascii=False, allow_nan=False)},
    ]
