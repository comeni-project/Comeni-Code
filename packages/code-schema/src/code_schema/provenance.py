"""Versioned public AI receipts. Private drafting evidence never belongs in content files."""

from __future__ import annotations

import hashlib
import json
import re
from collections.abc import Callable
from dataclasses import fields, is_dataclass, replace
from typing import TYPE_CHECKING, Any

from code_schema.blocks import Figure, Image, ProblemBlock, Text, Try
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
    if is_dataclass(value) and not isinstance(value, type):
        return {f.name: _plain(getattr(value, f.name)) for f in fields(value) if f.compare}
    if isinstance(value, dict):
        return {k: _plain(v) for k, v in value.items()}
    if isinstance(value, tuple | list):
        return [_plain(v) for v in value]
    return value


def items(node: Node) -> dict[str, Any]:
    """Canonical content identities, shared by validation and explicit Studio origin transforms.

    File identities supplement Review's placed keys: a shared figure is still one editable file.
    Each placed question/block includes the files it reads, so changing data changes its receipt.
    """
    figures = {f.stem: f.text for f in node.figures}
    questions = {q.id: q for q in node.questions}
    result: dict[str, Any] = {
        "node": {
            k: _plain(getattr(node, k))
            for k in (
                "title",
                "claim",
                "region",
                "level",
                "minutes",
                "needs",
                "goes_deeper",
                "related",
            )
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


def remap(
    before: Node, after: Node, operation: str, args: tuple[Any, ...], kwargs: dict[str, Any]
) -> Node:
    """Transform origin labels with the operation, then the same adjacent-text normalization.

    This is not a content-similarity match: identical blocks retain their distinct old labels.
    """
    if before.provenance is None:
        return after
    tagged = [
        (b, [f"try/{b.question}" if isinstance(b, Try) else f"block/{i}"])
        for i, b in enumerate(before.blocks)
    ]

    def argument(index: int, name: str) -> Any:
        return args[index] if index < len(args) else kwargs.get(name)

    if operation == "insert_block":
        tagged.insert(argument(0, "at"), (argument(1, "block"), []))
    elif operation == "delete_block":
        tagged.pop(argument(0, "at"))
    elif operation == "update_block":
        at = argument(0, "at")
        tagged[at] = (argument(1, "block"), tagged[at][1])
    elif operation == "move_block":
        tagged.insert(argument(1, "to"), tagged.pop(argument(0, "at")))
    elif operation in ("remove_image", "remove_figure", "remove_problem"):
        cls = {"remove_image": Image, "remove_figure": Figure, "remove_problem": ProblemBlock}[
            operation
        ]
        tagged = [
            (b, ids)
            for b, ids in tagged
            if not (
                isinstance(b, cls)
                and (
                    operation == "remove_problem"
                    or getattr(b, "file", None)
                    == argument(0, "file" if operation == "remove_image" else "stem")
                )
            )
        ]
    elif operation == "add_figure" and kwargs.get("question") is None:
        at = argument(0, "at")
        tagged.insert(at, (after.blocks[at], []))
    elif operation == "set_problem" and before.problem is None:
        tagged.append((after.blocks[-1], []))
    groups: list[tuple[Any, list[str]]] = []
    for block, labels in tagged:
        if groups and isinstance(block, Text) and isinstance(groups[-1][0], Text):
            groups[-1][1].extend(labels)
        else:
            groups.append((block, list(labels)))
    if len(groups) != len(after.blocks):
        raise ValueError("AI origins need an explicit mapping for this edit")
    mapping: dict[str, list[str]] = {}
    for at, (block, (_, labels)) in enumerate(zip(after.blocks, groups, strict=True)):
        key = f"try/{block.question}" if isinstance(block, Try) else f"block/{at}"
        mapping[key] = labels
    for at, resource in enumerate(after.resources):
        mapping[f"resource/{at}"] = [
            f"resource/{i}" for i, r in enumerate(before.resources) if r.url == resource.url
        ]
    for key in items(after):
        if key not in mapping:
            mapping[key] = [key]
    if operation == "update_exam_question":
        mapping[f"exam/{argument(1, 'question').id}"] = [f"exam/{argument(0, 'question_id')}"]
    return _mapped(before.provenance, after, mapping)


def _mapped(public: dict[str, Any], node: Node, mapping: dict[str, list[str]]) -> Node:
    actual = fingerprints(node)
    old = public["items"]
    bound: dict[str, Any] = {}
    for key, labels in mapping.items():
        ids = list(
            dict.fromkeys(i for label in labels for i in old.get(label, {}).get("receipts", []))
        )
        baselines = {
            old[label].get(
                "baseline", old[label]["receipts"][0] if len(old[label]["receipts"]) == 1 else None
            )
            for label in labels
            if label in old
        }
        # A shared file's origin is shown at every placement, including a question's figure.
        value = items(node).get(key)
        if isinstance(value, dict):
            for stem in value.get("figures", {}):
                ids += [
                    i for i in old.get(f"figure/{stem}", {}).get("receipts", []) if i not in ids
                ]
        if ids and key in actual:
            bound[key] = {
                "fingerprint": actual[key],
                "receipts": ids,
                "baseline": next(iter(baselines)) if len(baselines) == 1 else None,
            }
    used = {i for binding in bound.values() for i in binding["receipts"]}
    result = {
        "version": 1,
        "receipts": {i: r for i, r in public["receipts"].items() if i in used},
        "items": bound,
    }
    return replace(node, provenance=result if bound else None, origin_mapped=True)


def attach(node: Node, key: str, identity: str, receipt: dict[str, Any]) -> Node:
    """Attach a validated public receipt after a deliberate author acceptance."""
    public = node.provenance or {"version": 1, "receipts": {}, "items": {}}
    public = {
        **public,
        "receipts": {**public["receipts"], identity: receipt},
        "items": {**public["items"]},
    }
    ids = [*public["items"].get(key, {}).get("receipts", []), identity]
    public["items"][key] = {
        "fingerprint": fingerprints(node)[key],
        "receipts": list(dict.fromkeys(ids)),
        "baseline": identity,
    }
    return _mapped(public, node, {k: [k] for k in items(node)})


def tracked(function: Callable[..., Node]) -> Callable[..., Node]:
    def applied(node: Node, *args: Any, **kwargs: Any) -> Node:
        result = function(node, *args, **kwargs)
        return remap(node, result, function.__name__, args, kwargs)

    applied.__name__ = function.__name__
    applied.__doc__ = function.__doc__
    return applied


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
            _closed(binding, {"fingerprint", "receipts"}, {"baseline"})
            code = "CS1202"
            if key not in actual or binding["fingerprint"] != actual[key]:
                raise ValueError("provenance does not match its content item")
            code = "CS1203"
            ids = binding["receipts"]
            if binding.get("baseline") is not None and binding["baseline"] not in ids:
                raise ValueError("unknown baseline receipt")
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
