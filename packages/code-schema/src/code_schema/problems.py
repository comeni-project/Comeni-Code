"""What the validator says when a file is wrong (spec M1P1.5).

One problem is one line: `path[:line][: field]: what is wrong`. Nothing in this package raises;
problems accumulate and are returned, so one run reports everything wrong with a node.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Problem:
    file: str
    message: str
    field: str | None = None
    line: int | None = None

    def __str__(self) -> str:
        where = self.file if self.line is None else f"{self.file}:{self.line}"
        what = self.message if self.field is None else f"{self.field}: {self.message}"
        return f"{where}: {what}"

    @staticmethod
    def sort_key(problem: Problem) -> tuple[str, int]:
        """File order, then line. A problem with no line comes first in its file."""
        return (problem.file, -1 if problem.line is None else problem.line)
