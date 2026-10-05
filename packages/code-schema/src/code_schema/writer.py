"""One correct way to write a node (spec M1P1.6, M1P2.6).

Landing generates these files, so the writer is canonical: fixed field order, block style, no key
sorting, no folding, lists indented under their key. Comments are not preserved — node.yaml is not
a place to leave a note.
"""

from __future__ import annotations

from pathlib import Path

import yaml

from code_schema.exam import EXAM_FIELD, EXAM_FILE, ExamQuestion
from code_schema.links import Link
from code_schema.node import BODY_FILE, NODE_FILE, SCHEMA, Node
from code_schema.questions import TRY_FIELD, Answer, ChoiceAnswer, NumberAnswer, Option, TryQuestion
from code_schema.resources import RESOURCE_FIELD, Resource

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


def _resource(resource: Resource) -> dict[str, object]:
    """The spec's field order (M3P1.2, M3P5.3); video and part only when the author wrote them."""
    written: dict[str, object] = {"kind": resource.kind, "provider": resource.provider}
    written["url"] = resource.url
    if resource.video:
        written["video"] = resource.video
    if resource.part:
        written["part"] = resource.part
    written["covers"] = resource.covers
    written["licence"] = resource.licence
    written["display"] = resource.display
    written["level"] = resource.level.value
    return written


def _option(option: Option) -> dict[str, object]:
    written: dict[str, object] = {"text": option.text}
    if option.right:
        written["right"] = True
    if option.misconception:
        written["misconception"] = option.misconception
    return written


def _answer(answer: Answer) -> dict[str, object]:
    """The answer's fields, in the spec's order (M3P1.3), whichever pool asks it (M4E.2)."""
    match answer:
        case ChoiceAnswer(options=options):
            return {"options": [_option(option) for option in options]}
        case NumberAnswer(value=value, unit=unit, tolerance=tolerance):
            written: dict[str, object] = {"answer": value}
            if unit:
                written["unit"] = unit
            if tolerance is not None:
                written["tolerance"] = tolerance
            return written


def _question(question: TryQuestion) -> dict[str, object]:
    """The spec's field order (M3P1.3); nothing empty is invented."""
    written: dict[str, object] = {"id": question.id, "kind": question.kind, "ask": question.ask}
    written |= _answer(question.answer)
    written["hints"] = list(question.hints)
    written["rationale"] = question.rationale
    return written


def _exam_question(question: ExamQuestion) -> dict[str, object]:
    """M4E.1's order: a level only when the question sets its own."""
    written: dict[str, object] = {"id": question.id, "kind": question.kind, "ask": question.ask}
    if question.level is not None:
        written["level"] = question.level.value
    written |= _answer(question.answer)
    written["rationale"] = question.rationale
    return written


def _dump(fields: dict[str, object]) -> str:
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
    if node.resources:
        fields[RESOURCE_FIELD] = [_resource(resource) for resource in node.resources]
    if node.questions:
        fields[TRY_FIELD] = [_question(question) for question in node.questions]
    return _dump(fields)


def write_exam_yaml(node: Node) -> str:
    """The node's exam pool, as exam.yaml holds it (spec M4E.1)."""
    return _dump({EXAM_FIELD: [_exam_question(question) for question in node.exam]})


def write_node_folder(node: Node, folder: Path) -> None:
    """Write node.yaml, body.md and, when the node has a pool, exam.yaml (spec M4E.8).

    The body goes back byte for byte: M1 does not look inside it.
    """
    folder.mkdir(parents=True, exist_ok=True)
    (folder / NODE_FILE).write_text(write_node_yaml(node), encoding="utf-8", newline="\n")
    (folder / BODY_FILE).write_text(node.body, encoding="utf-8", newline="")
    exam = folder / EXAM_FILE
    if node.exam:
        exam.write_text(write_exam_yaml(node), encoding="utf-8", newline="\n")
    else:
        exam.unlink(missing_ok=True)  # a pool removed from the node leaves no stale file
