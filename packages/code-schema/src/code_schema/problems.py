"""What the validator says when a file is wrong (spec M1P1.5).

One problem is one line: `path[:line][: field]: CODE what is wrong`, with its diagnostic code
(spec M4D.4). Nothing in this package raises;
problems accumulate and are returned, so one run reports everything wrong with a node.
"""

from __future__ import annotations

from dataclasses import dataclass

from code_schema.diagnostics import diagnostic


@dataclass(frozen=True)
class Problem:
    file: str
    message: str
    field: str | None = None
    line: int | None = None
    code: str | None = None  # required from Task 11 of the M4.1.1 plan

    def __post_init__(self) -> None:
        if self.code is not None:
            diagnostic(self.code)  # an undeclared code raises UnknownDiagnostic (spec M4D.4)

    def __str__(self) -> str:
        where = self.file if self.line is None else f"{self.file}:{self.line}"
        said = self.message if self.code is None else f"{self.code} {self.message}"
        what = said if self.field is None else f"{self.field}: {said}"
        return f"{where}: {what}"

    @staticmethod
    def sort_key(problem: Problem) -> tuple[str, int]:
        """File order, then line. A problem with no line comes first in its file."""
        return (problem.file, -1 if problem.line is None else problem.line)
