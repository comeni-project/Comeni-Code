"""Every component a figure may name, its schema and its checks (M6.4 spec, M6FG.2).

Adding a component is engineering work under code review (W5.3): a module beside these, its schema
in schemas/, and an entry here. A schema only widens once content uses it; a change that would
refuse a file that was valid is a new component name.
"""

import json
from collections.abc import Callable, Mapping
from dataclasses import dataclass
from pathlib import Path

from code_figures import chart, flow, table, track
from code_figures.findings import BOUND, NOT_ALLOWED, WRONG, Finding
from code_figures.schema import Schema, validate

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


def _component(name: str, module: object) -> Component:
    schema = json.loads((_SCHEMAS / f"{name}.json").read_text(encoding="utf-8"))
    return Component(
        name=name,
        schema=schema,
        check=getattr(module, "check"),  # noqa: B009 — each kit module has the same three names
        derive=getattr(module, "derive"),  # noqa: B009
        starter=getattr(module, "STARTER"),  # noqa: B009
    )


COMPONENTS: Mapping[str, Component] = {
    name: _component(name, module)
    for name, module in (
        ("chart", chart),
        ("flow", flow),
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
    }
)


def figure_findings(component: str, data: object) -> list[Finding]:
    """The schema's findings; the component's own checks only once the schema has none."""
    found = COMPONENTS.get(component)
    if found is None:
        named = ", ".join(sorted(COMPONENTS))
        return [Finding(UNKNOWN, "component", f"{component} is not a component ({named})")]
    problems = validate(found.schema, data)
    if problems or not isinstance(data, Mapping):
        return problems
    return found.check(data)


def derived(component: str, data: Data) -> dict[str, object]:
    """What the page draws and nobody writes; only for data with no findings."""
    return COMPONENTS[component].derive(data)
