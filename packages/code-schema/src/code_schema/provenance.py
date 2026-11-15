"""Versioned public AI receipts. Private drafting evidence never belongs in content files."""

from __future__ import annotations

import hashlib
import json
import re
from dataclasses import asdict, is_dataclass
from typing import TYPE_CHECKING, Any

from code_schema.blocks import Figure, Try
from code_schema.figure_answers import option_figures
from code_schema.problems import Problem

if TYPE_CHECKING:
    from code_schema.node import Node

PROVENANCE_FILE = "provenance.json"
_UUID = re.compile(r"[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\Z")
_HASH = re.compile(r"[0-9a-f]{64}\Z")


def canonical(value: Any) -> str:
    return json.dumps(
        value, sort_keys=True, ensure_ascii=False, allow_nan=False, separators=(",", ":")
    )


def digest(value: Any) -> str:
    return hashlib.sha256(canonical(value).encode()).hexdigest()


def _plain(value: Any) -> Any:
    return asdict(value) if is_dataclass(value) and not isinstance(value, type) else value


def items(node: Node) -> dict[str, Any]:
    """Canonical content identities, shared by validation and explicit Studio origin transforms.

    File identities supplement Review's placed keys: a shared figure is still one editable file.
    Each placed question/block includes the files it reads, so changing data changes its receipt.
    """
    figures = {f.stem: f.text for f in node.figures}
    questions = {q.id: q for q in node.questions}
    result: dict[str, Any] = {
        "node": {
            k: _plain(getattr(node, k)) for k in ("title", "claim", "region", "level", "minutes")
        }
    }
    for at, block in enumerate(node.blocks):
        key = f"try/{block.question}" if isinstance(block, Try) else f"block/{at}"
        content = questions[block.question] if isinstance(block, Try) else block
        stems: list[str | None] = []
        if isinstance(block, Try):
            question = questions[block.question]
            stems = [question.figure, *option_figures(question.answer)]
        elif isinstance(block, Figure):
            stems = [block.file]
        result[key] = {
            "content": _plain(content),
            "figures": {s: figures[s] for s in stems if s is not None and s in figures},
        }
    result.update({f"resource/{at}": _plain(r) for at, r in enumerate(node.resources)})
    for exam_question in node.exam:
        stems = [b.file for b in exam_question.blocks if isinstance(b, Figure)]
        stems += list(option_figures(exam_question.answer))
        result[f"exam/{exam_question.id}"] = {
            "content": _plain(exam_question),
            "figures": {s: figures[s] for s in stems if s is not None and s in figures},
        }
    result.update({f"figure/{stem}": text for stem, text in figures.items()})
    if node.problem is not None:
        result["problem"] = node.problem.text
    return result


def fingerprints(node: Node) -> dict[str, str]:
    return {key: digest(value) for key, value in items(node).items()}


def write_provenance(value: dict[str, Any]) -> str:
    return json.dumps(value, sort_keys=True, ensure_ascii=False, allow_nan=False, indent=2) + "\n"


def _object(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    value: dict[str, Any] = {}
    for key, item in pairs:
        if key in value:
            raise ValueError("duplicate JSON key")
        value[key] = item
    return value


def _nonfinite(value: str) -> None:
    raise ValueError("non-finite JSON number")


def _closed(value: Any, required: set[str], optional: set[str] | None = None) -> None:
    if not isinstance(value, dict) or not required <= value.keys() <= required | (
        optional or set()
    ):
        raise ValueError("unknown or missing public provenance fields")


def read_provenance(
    text: str | None, node: Node, *, file: str = PROVENANCE_FILE
) -> tuple[dict[str, Any] | None, list[Problem]]:
    if text is None:
        return None, []
    try:
        value = json.loads(text, object_pairs_hook=_object, parse_constant=_nonfinite)
        canonical(value)
    except ValueError, RecursionError:
        return None, [
            Problem(file=file, code="CS1200", message="provenance must be unambiguous JSON")
        ]
    code = "CS1201"
    try:
        _closed(value, {"version", "receipts", "items"})
        if type(value["version"]) is not int or value["version"] != 1:
            raise ValueError("unsupported provenance version")
        if not isinstance(value["receipts"], dict) or not isinstance(value["items"], dict):
            raise ValueError("receipts and items must be mappings")
        for identity, receipt in value["receipts"].items():
            if not _UUID.fullmatch(identity):
                raise ValueError("a public receipt needs a UUID")
            _closed(receipt, {"model", "prompt_id", "settings", "sources"})
            if not all(isinstance(receipt[k], str) and receipt[k] for k in ("model", "prompt_id")):
                raise ValueError("receipt model and prompt id are required")
            _closed(receipt["settings"], set(), {"temperature", "reasoning_effort", "timeout"})
            settings = receipt["settings"]
            if "timeout" in settings and (
                type(settings["timeout"]) is not int or settings["timeout"] <= 0
            ):
                raise ValueError("invalid timeout")
            if (
                "temperature" in settings
                and settings["temperature"] is not None
                and type(settings["temperature"]) not in (int, float)
            ):
                raise ValueError("invalid temperature")
            if "reasoning_effort" in settings and not isinstance(settings["reasoning_effort"], str):
                raise ValueError("invalid reasoning effort")
            if not isinstance(receipt["sources"], list):
                raise ValueError("sources must be a list")
            for source in receipt["sources"]:
                _closed(source, {"hash"}, {"title", "url", "licence"})
                if not isinstance(source["hash"], str) or not _HASH.fullmatch(source["hash"]):
                    code = "CS1203"
                    raise ValueError("invalid source hash")
                if not all(isinstance(v, str) for v in source.values()):
                    raise ValueError("invalid public source reference")
        actual = fingerprints(node)
        for key, binding in value["items"].items():
            _closed(binding, {"fingerprint", "receipts"})
            code = "CS1202"
            if key not in actual or binding["fingerprint"] != actual[key]:
                raise ValueError("provenance does not match its content item")
            code = "CS1203"
            ids = binding["receipts"]
            if (
                not isinstance(ids, list)
                or not ids
                or not all(isinstance(i, str) and i in value["receipts"] for i in ids)
                or len(ids) != len(set(ids))
            ):
                raise ValueError("unknown or repeated receipt reference")
        return value, []
    except (ValueError, TypeError, KeyError, RecursionError) as error:
        return None, [Problem(file=file, code=code, message=str(error))]
