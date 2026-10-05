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
    code: str  # declared in diagnostics.yml; required, so no problem goes unnamed (spec M4D.4)
    field: str | None = None
    line: int | None = None

    def __post_init__(self) -> None:
        diagnostic(self.code)  # an undeclared code raises UnknownDiagnostic

    @property
    def refuses(self) -> bool:
        """An error, which refuses; else a warning, which never blocks (spec M4E.4)."""
        return diagnostic(self.code).refuses

    def __str__(self) -> str:
        where = self.file if self.line is None else f"{self.file}:{self.line}"
        said = f"{self.code} {self.message}"
        what = said if self.field is None else f"{self.field}: {said}"
        return f"{where}: {what}"

    @staticmethod
    def sort_key(problem: Problem) -> tuple[str, int]:
        """File order, then line. A problem with no line comes first in its file."""
        return (problem.file, -1 if problem.line is None else problem.line)
