"""What a learner does with a figure that asks a question, and the answers it computes (M6.6b spec,
M6FA.2). A kit declares its tasks; each is a Strategy: a schema for its fields, a check against the
figure's data, and the answer: `accept`, every selection that is right, and `wrong`, one that is
not, for the composer to draw. A selection is the k-mers a learner picked, in order."""

import json
from collections.abc import Callable, Mapping
from dataclasses import dataclass
from pathlib import Path

from code_figures.findings import Finding
from code_figures.schema import Schema, validate

NO_TASK = "CS1028"  # no such task, or its fields do not fit the task's schema
_SCHEMAS = Path(__file__).resolve().parent / "schemas" / "tasks"

Data = Mapping[str, object]
Fields = Mapping[str, object]
Selection = list[str]
Answer = tuple[list[Selection], Selection]


Check = Callable[[Data, Mapping[str, object], Fields], list[Finding]]
Answering = Callable[[Data, Mapping[str, object], Fields], Answer]


@dataclass(frozen=True)
class Task:
    name: str
    schema: Schema
    check: Check
    answer: Answering


def task(component: str, name: str, check: Check, answer: Answering) -> Task:
    """A task whose fields' schema is `schemas/tasks/<component>.<name>.json`."""
    schema = json.loads((_SCHEMAS / f"{component}.{name}.json").read_text(encoding="utf-8"))
    return Task(name=name, schema=schema, check=check, answer=answer)


def fields_findings(tasks: Mapping[str, Task], interact: object) -> list[Finding]:
    """CS1028 when `interact` names no task of the kit or its fields do not fit; else nothing."""
    if not isinstance(interact, Mapping) or "task" not in interact:
        return [Finding(NO_TASK, "interact", "must be a mapping that names its task")]
    name = interact["task"]
    if not isinstance(name, str) or name not in tasks:
        named = ", ".join(sorted(tasks)) or "none"
        return [
            Finding(NO_TASK, "interact.task", f"{name} is not a task of this component ({named})")
        ]
    return [
        Finding(NO_TASK, found.path, found.message)
        for found in validate(tasks[name].schema, interact, "interact")
    ]
