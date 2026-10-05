"""Reading a list of mappings in node.yaml, the part every nested field shares (spec M4R.1).

Links, resources and questions are each a list of mappings, and each reads its list the same way:
the list itself, then each entry's unknown keys, missing keys and wrong values, every problem at
the line it is about. That is here once. What differs — which key ends an entry, which kind refuses
which key — stays in each parser, in order, as code.

Every problem found in an entry makes it unsound: an entry with a problem is never kept.
"""

from __future__ import annotations

from collections.abc import Callable, Iterator, Sequence

from code_schema.fields import Check
from code_schema.problems import Problem
from code_schema.yaml_lines import Lines

EMPTY = "an empty list is written by leaving the field out"


class Field:
    """One list field of node.yaml, and the problems found in it."""

    def __init__(self, name: str, *, lines: Lines, file: str, problems: list[Problem]) -> None:
        self.name = name
        self.lines = lines
        self.file = file
        self.problems = problems
        self.line = lines.get(name)

    def problem(self, code: str, message: str, line: int | None = None) -> None:
        """A problem with this field, at `line`, else at the field's own line."""
        self.problems.append(
            Problem(
                file=self.file,
                field=self.name,
                line=self.line if line is None else line,
                code=code,
                message=message,
            )
        )

    def entries(
        self,
        value: object,
        *,
        not_a_list: tuple[str, str],
        not_a_mapping: tuple[str, Callable[[object], str]],
    ) -> Iterator[Entry]:
        """Each mapping in the list; the list itself and anything not a mapping are reported."""
        if not isinstance(value, list):
            self.problem(*not_a_list)
            return
        if not value:
            self.problem("CS0019", EMPTY)
            return
        code, says = not_a_mapping
        for item in value:
            if isinstance(item, dict):
                yield Entry(item, self)
            else:
                self.problem(code, says(item))


class Entry:
    """One mapping in a list field. `line` is its first key's line, where it is reported whole."""

    def __init__(self, mapping: dict[object, object], field: Field) -> None:
        self.mapping = mapping
        self.field = field
        self.sound = True
        self.line = next((self.at(str(key)) for key in mapping), field.line)

    def at(self, key: str) -> int | None:
        return self.field.lines.of(self.mapping, key)

    def problem(
        self, code: str, message: str, *, key: str | None = None, line: int | None = None
    ) -> None:
        """A problem with this entry: at `line`, else at `key`'s line, else at the entry's."""
        if line is None:
            line = self.line if key is None else self.at(key)
        self.field.problem(code, message, line)
        self.sound = False

    def unknown(self, allowed: Sequence[str], code: str, says: Callable[[str], str]) -> None:
        """Every key not allowed, at its own line, in the order written."""
        for key in self.mapping:
            if key not in allowed:
                self.problem(code, says(str(key)), line=self.at(str(key)))

    def require(self, key: str, code: str, message: str) -> bool:
        """Whether `key` is written; when it is not, that is a problem at the entry."""
        if key in self.mapping:
            return True
        self.problem(code, message)
        return False

    def check(self, key: str, check: Check, *, prefix: str = "") -> bool:
        """Whether `key`'s value passes, when it is written; a failure is worded after `prefix`."""
        if key not in self.mapping or (wrong := check(self.mapping[key])) is None:
            return True
        self.problem(wrong.code, f"{prefix}{wrong.message}", line=self.at(key))
        return False
