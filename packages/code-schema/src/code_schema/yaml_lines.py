"""YAML that remembers where each key was (spec M1P1.5).

`yaml.safe_load` throws the marks away, and no schema library can recover them: it only ever sees
the dict. Messages carry lines so the content repository's CI can print them on the diff line.

Lines are kept per mapping, not per key name: in a list of mappings (regions, needs groups) every
entry has an `id`, and each must report its own line.
"""

from __future__ import annotations

from collections.abc import Iterator

import yaml

from code_schema.problems import Problem


class Lines:
    """Where each key of each loaded mapping was, 1-based."""

    def __init__(self) -> None:
        self._by_mapping: dict[int, dict[str, int]] = {}
        # Held so that no mapping is collected and its id reused while these lines are in use.
        self._mappings: list[dict[object, object]] = []
        self._root: dict[str, int] = {}

    def record(self, mapping: dict[object, object], keys: dict[str, int]) -> None:
        if not self._mappings:
            self._root = keys
        self._by_mapping[id(mapping)] = keys
        self._mappings.append(mapping)

    @property
    def root(self) -> dict[str, int]:
        return dict(self._root)

    def get(self, key: str) -> int | None:
        """The line of a key in the document's top-level mapping."""
        return self._root.get(key)

    def of(self, mapping: object, key: str) -> int | None:
        """The line of a key in any mapping this document loaded."""
        return self._by_mapping.get(id(mapping), {}).get(key)


class LineLoader(yaml.SafeLoader):
    """A safe loader that records, for every mapping it builds, the line of each key."""

    def __init__(self, stream: str) -> None:
        super().__init__(stream)
        self.lines = Lines()


def _construct_map(loader: LineLoader, node: yaml.MappingNode) -> Iterator[dict[object, object]]:
    # SafeLoader's own map constructor, with the lines recorded against the dict it yields —
    # the object the caller will hold, not an intermediate one.
    data: dict[object, object] = {}
    loader.lines.record(
        data,
        {key.value: key.start_mark.line + 1 for key, _ in node.value if isinstance(key.value, str)},
    )
    yield data
    data.update(loader.construct_mapping(node))


LineLoader.add_constructor("tag:yaml.org,2002:map", _construct_map)


def load_mapping(text: str, *, file: str) -> tuple[dict[str, object] | None, Lines, list[Problem]]:
    """Parse one YAML document that must be a mapping. Never raises."""
    loader = LineLoader(text)
    try:
        data = loader.get_single_data()
    except yaml.YAMLError as error:
        mark = getattr(error, "problem_mark", None)
        detail = getattr(error, "problem", None) or "could not be parsed"
        line = None if mark is None else mark.line + 1
        return None, Lines(), [Problem(file=file, line=line, message=f"not valid YAML ({detail})")]
    finally:
        loader.dispose()

    if data is None:
        return None, loader.lines, [Problem(file=file, message="the file is empty")]
    if not isinstance(data, dict):
        kind = "a list" if isinstance(data, list) else "a single value"
        return (
            None,
            loader.lines,
            [Problem(file=file, message=f"the file must be a mapping of fields, not {kind}")],
        )
    return data, loader.lines, []
