"""YAML that remembers where each key was (spec M1P1.5).

`yaml.safe_load` throws the marks away, and no schema library can recover them: it only ever sees
the dict. Messages carry lines so the content repository's CI can print them on the diff line.
"""

from __future__ import annotations

from typing import Any

import yaml

from code_schema.problems import Problem


class LineLoader(yaml.SafeLoader):
    """A safe loader that records the line of every key, at any depth. First occurrence wins."""

    def __init__(self, stream: str) -> None:
        super().__init__(stream)
        self.key_lines: dict[str, int] = {}

    def construct_mapping(self, node: yaml.MappingNode, deep: bool = False) -> dict[Any, Any]:
        for key_node, _ in node.value:
            if isinstance(key_node.value, str):
                self.key_lines.setdefault(key_node.value, key_node.start_mark.line + 1)
        return super().construct_mapping(node, deep)


def load_mapping(
    text: str, *, file: str
) -> tuple[dict[str, object] | None, dict[str, int], list[Problem]]:
    """Parse one YAML document that must be a mapping. Never raises."""
    loader = LineLoader(text)
    try:
        data = loader.get_single_data()
        lines = dict(loader.key_lines)
    except yaml.YAMLError as error:
        mark = getattr(error, "problem_mark", None)
        detail = getattr(error, "problem", None) or "could not be parsed"
        line = None if mark is None else mark.line + 1
        return None, {}, [Problem(file=file, line=line, message=f"not valid YAML ({detail})")]
    finally:
        loader.dispose()

    if data is None:
        return None, lines, [Problem(file=file, message="the file is empty")]
    if not isinstance(data, dict):
        kind = "a list" if isinstance(data, list) else "a single value"
        return (
            None,
            lines,
            [Problem(file=file, message=f"the file must be a mapping of fields, not {kind}")],
        )
    return data, lines, []
