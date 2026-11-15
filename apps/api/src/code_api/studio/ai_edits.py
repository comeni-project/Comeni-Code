"""One captured target to one validated edit; model output never selects a tool or path."""

from typing import Any

import yaml
from pydantic import BaseModel

from code_api.studio.ai_schemas import DraftingError
from code_api.studio.edit_inputs import (
    BlockIn,
    ExamQuestionIn,
    ResourceIn,
    TryQuestionIn,
    _block,
    _exam_question,
    _try_question,
)
from code_api.studio.schemas import node_out
from code_schema import Node, Try, block_json
from code_schema.edits import (
    set_figure,
    set_problem,
    set_resources,
    update_block,
    update_exam_question,
)
from code_schema.figures import read_figure

SUPPORTED = {"text", "callout", "sequence", "math", "example"}


def checked[T: BaseModel](schema: type[T], value: dict[str, Any]) -> T:
    if not value.keys() <= schema.model_fields.keys():
        raise DraftingError("CA0500", "The reply contains fields outside the selected edit.")
    return schema.model_validate(value)


def payload(node: Node, target: str) -> dict[str, Any]:
    shown = node_out(node).model_dump(mode="json")
    if target.startswith("block/"):
        at = int(target.split("/")[1])
        value = block_json(node.blocks[at])
        if value["kind"] not in SUPPORTED:
            raise DraftingError("CA0500", "Open the question or figure editor to draft this item.")
        return value
    if target.startswith("try/"):
        return next(q for q in shown["questions"] if q["id"] == target[4:])
    if target.startswith("exam/"):
        question = next(q for q in shown["exam"] if q["id"] == target[5:])
        return {k: v for k, v in question.items() if k in ExamQuestionIn.model_fields}
    if target == "problem" and node.problem is not None:
        return {"text": node.problem.text}
    if target.startswith("figure/"):
        figure = next(f for f in node.figures if f.stem == target[7:])
        return dict(yaml.safe_load(figure.text))
    raise DraftingError("CA0500", "This is not a supported drafting target.")


def figure_text(value: dict[str, Any], component: str) -> str:
    if (
        set(value) - {"component", "alt", "data", "source", "interact"}
        or value.get("component") != component
    ):
        raise DraftingError(
            "CA0500", "A figure proposal keeps its selected component and authored fields."
        )
    text = yaml.safe_dump(value, sort_keys=False, allow_unicode=True)
    figure, findings = read_figure("proposal", text, file="figures/proposal.yaml")
    if figure is None:
        raise DraftingError(
            "CA0502",
            "The proposed figure does not validate.",
            [{"code": p.code, "message": p.message} for p in findings],
        )
    return text


def apply_candidate(node: Node, target: str, value: dict[str, Any]) -> Node:
    if target.startswith("block/"):
        at = int(target[6:])
        current = block_json(node.blocks[at])
        if value.get("kind") != current["kind"] or current["kind"] not in SUPPORTED:
            raise DraftingError("CA0500", "The proposal must keep this block's kind.")
        return update_block(node, at, _block(checked(BlockIn, value)))
    if target.startswith("try/"):
        given = checked(TryQuestionIn, value)
        if given.id != target[4:]:
            raise DraftingError("CA0500", "The proposal must keep this question's id.")
        at = next(
            i
            for i, block in enumerate(node.blocks)
            if isinstance(block, Try) and block.question == given.id
        )
        return update_block(node, at, Try(given.id), _try_question(given))
    if target.startswith("exam/"):
        given_exam = checked(ExamQuestionIn, value)
        if given_exam.id != target[5:]:
            raise DraftingError("CA0500", "The proposal must keep this exam question's id.")
        return update_exam_question(node, given_exam.id, _exam_question(given_exam))
    if target == "problem" and node.problem is not None and set(value) == {"text"}:
        result = set_problem(node, value["text"])
        if result.problem is None or result.problem.kit != node.problem.kit:
            raise DraftingError("CA0500", "A problem redraft keeps its existing kit.")
        return result
    if target.startswith("figure/"):
        component = payload(node, target)["component"]
        return set_figure(node, target[7:], figure_text(value, component))
    raise DraftingError("CA0500", "This proposal cannot edit that target.")


def add_candidate(node: Node, candidate: dict[str, Any]) -> Node:
    from code_schema import Resource

    value = checked(ResourceIn, candidate).model_dump()
    return set_resources(node, [*node.resources, Resource(**value)])
