"""Every component a figure may name, its schema and its checks (M6.4 spec, M6FG.2).

Adding a component is engineering work under code review (W5.3): a module beside these, its schema
in schemas/, and an entry here. A schema only widens once content uses it; a change that would
refuse a file that was valid is a new component name.
"""

import json
from collections.abc import Callable, Mapping
from dataclasses import dataclass
from pathlib import Path

from code_figures import (
    chart,
    compare_graphs,
    flow,
    graph_artifacts,
    kmer_graph,
    kmer_window,
    kmers,
    read_tiling,
    table,
    track,
)
from code_figures.findings import BOUND, NOT_ALLOWED, WRONG, Finding
from code_figures.schema import Schema, validate
from code_figures.tasks import NO_TASK, Task, fields_findings

UNKNOWN = "CS1001"  # a component nobody built
_SCHEMAS = Path(__file__).resolve().parent / "schemas"

Data = Mapping[str, object]


@dataclass(frozen=True)
class Component:
    name: str
    schema: Schema
    check: Callable[[Data], list[Finding]]
    derive: Callable[[Data], dict[str, object]]
    starter: Data
    tasks: Mapping[str, Task]  # what a learner may do with it, by name (M6FA.2); most have none


def _component(name: str, module: object) -> Component:
    schema = json.loads((_SCHEMAS / f"{name}.json").read_text(encoding="utf-8"))
    return Component(
        name=name,
        schema=schema,
        check=getattr(module, "check"),  # noqa: B009 — each kit module has the same three names
        derive=getattr(module, "derive"),  # noqa: B009
        starter=getattr(module, "STARTER"),  # noqa: B009
        tasks=getattr(module, "TASKS", {}),
    )


COMPONENTS: Mapping[str, Component] = {
    name: _component(name, module)
    for name, module in (
        ("chart", chart),
        ("compare-graphs", compare_graphs),
        ("flow", flow),
        ("graph-artifacts", graph_artifacts),
        ("kmer-graph", kmer_graph),
        ("kmer-window", kmer_window),
        ("read-tiling", read_tiling),
        ("sequence-track", track),
        ("table", table),
    )
}

CODES: frozenset[str] = frozenset(
    {
        UNKNOWN,
        NOT_ALLOWED,
        WRONG,
        BOUND,
        chart.NO_COLUMN,
        chart.NOT_ITS_TYPE,
        flow.MISSING,
        flow.TWICE,
        track.OUT,
        track.LETTER,
        table.ROW,
        read_tiling.PLACE,
        kmers.SHORT,
        kmer_graph.NOT_A_WALK,
        graph_artifacts.NO_SUPPORT,
        kmers.TOO_MANY,
        NO_TASK,
        kmer_graph.NOT_A_TRACE,
        kmer_graph.SHOWS_ANSWER,
        graph_artifacts.NO_ARTIFACT,
    }
)


def figure_findings(component: str, data: object, interact: object = None) -> list[Finding]:
    """The schema's findings; the component's own checks only once the schema has none; then,
    with `interact`, its task's (M6FA.2), only once the data has none."""
    found = COMPONENTS.get(component)
    if found is None:
        named = ", ".join(sorted(COMPONENTS))
        return [Finding(UNKNOWN, "component", f"{component} is not a component ({named})")]
    problems = validate(found.schema, data)
    if problems or not isinstance(data, Mapping):
        return problems
    problems = found.check(data)
    if problems or interact is None:
        return problems
    problems = fields_findings(found.tasks, interact)
    if problems:
        return problems
    assert isinstance(interact, Mapping)
    return found.tasks[str(interact["task"])].check(data, found.derive(data), interact)


def derived(
    component: str, data: Data, interact: Mapping[str, object] | None = None
) -> dict[str, object]:
    """What the page draws and nobody writes; only for data with no findings. With a task, its
    `answer`: every right selection, and one wrong one (M6FA.2)."""
    found = COMPONENTS[component]
    computed = found.derive(data)
    if interact is not None:
        accept, wrong = found.tasks[str(interact["task"])].answer(data, computed, interact)
        computed["answer"] = {"accept": accept, "wrong": wrong}
    return computed
