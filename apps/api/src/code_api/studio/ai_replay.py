"""Conservative three-way replay. Ambiguity is evidence for a human decision, never a guess."""

import re
from dataclasses import dataclass
from difflib import SequenceMatcher
from typing import Any

_MISSING = object()


@dataclass(frozen=True)
class Replay:
    value: Any
    conflicts: list[dict[str, Any]]


def _conflict(base: Any, human: Any, model: Any, path: str) -> Replay:
    return Replay(
        human,
        [
            {
                "path": path,
                **{
                    key: None if value is _MISSING else value
                    for key, value in (("base", base), ("human", human), ("model", model))
                },
                "base_present": base is not _MISSING,
                "human_present": human is not _MISSING,
                "model_present": model is not _MISSING,
            }
        ],
    )


def _text(base: str, human: str, model: str, path: str) -> Replay:
    tokens = re.split(r"(\s+)", base)

    def patches(value: str) -> list[tuple[int, int, list[str]]]:
        other = re.split(r"(\s+)", value)
        return [
            (a, b, other[c:d])
            for tag, a, b, c, d in SequenceMatcher(
                None, tokens, other, autojunk=False
            ).get_opcodes()
            if tag != "equal"
        ]

    left, right = patches(human), patches(model)
    for a, b, replacement in left:
        needle = tokens[a:b]
        if needle and sum(tokens[i : i + len(needle)] == needle for i in range(len(tokens))) > 1:
            return _conflict(base, human, model, path)
        for c, d, proposed in right:
            if (a, b, replacement) == (c, d, proposed):
                continue
            overlap = max(a, c) < min(b, d) or (a == b and c <= a <= d) or (c == d and a <= c <= b)
            if overlap:
                return _conflict(base, human, model, path)
    combined = list(left)
    combined.extend(p for p in right if p not in combined)
    for a, b, replacement in sorted(combined, key=lambda p: (p[0], p[1]), reverse=True):
        tokens[a:b] = replacement
    return Replay("".join(tokens), [])


def replay(base: Any, human: Any, model: Any, path: str = "") -> Replay:
    if human == base:
        return Replay(model, [])
    if model == base or human == model:
        return Replay(human, [])
    if all(isinstance(v, str) for v in (base, human, model)):
        return _text(base, human, model, path)
    if all(isinstance(v, dict) for v in (base, human, model)):
        value: dict[str, Any] = {}
        conflicts = []
        for key in sorted(base.keys() | human.keys() | model.keys()):
            escaped = key.replace("~", "~0").replace("/", "~1")
            merged = replay(
                base.get(key, _MISSING),
                human.get(key, _MISSING),
                model.get(key, _MISSING),
                path + "/" + escaped,
            )
            if merged.value is not _MISSING:
                value[key] = merged.value
            conflicts.extend(merged.conflicts)
        return Replay(value, conflicts)
    return _conflict(base, human, model, path)


def resolve(result: Replay, choices: dict[str, Any]) -> Any:
    if set(choices) != {c["path"] for c in result.conflicts}:
        raise ValueError("Resolve every reported conflict, and only those conflicts.")
    # Clone without assuming the provisional value is JSON (a removed field is absent).
    import copy

    value = copy.deepcopy(result.value)
    for conflict in result.conflicts:
        selected = choices[conflict["path"]]
        present = True
        if isinstance(selected, dict) and selected.get("choice") in ("human", "model", "base"):
            side = selected["choice"]
            selected = conflict[side]
            present = conflict.get(side + "_present", True)
        elif isinstance(selected, dict) and set(selected) == {"value"}:
            selected = selected["value"]
        else:
            raise ValueError("Choose a recorded side or supply an explicit value.")
        if conflict["path"] == "":
            value = selected
            continue
        parts = [p.replace("~1", "/").replace("~0", "~") for p in conflict["path"].split("/")[1:]]
        parent = value
        for part in parts[:-1]:
            parent = parent[part]
        if present:
            parent[parts[-1]] = selected
        else:
            parent.pop(parts[-1], None)
    return value
