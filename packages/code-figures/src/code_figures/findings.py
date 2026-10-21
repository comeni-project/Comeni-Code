"""What a component's schema or checks find wrong with a figure's data (M6.4 spec, M6FG.2).

code-figures never imports code-schema, which calls it: a finding carries its code as text, and
code-schema turns it into a Problem at the figure's file. Every code is declared in code-schema's
diagnostics.yml, in the figures band.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class Finding:
    code: str
    path: str  # a JSON path from `data`, as `data.encoding.y.field` or `data.rows[3][1]`
    message: str


NOT_ALLOWED = "CS1002"  # a key the schema does not allow
WRONG = "CS1003"  # a value of the wrong type or form, or a key that is required and missing
BOUND = "CS1004"  # a bound: too many, too long, too small or too large
