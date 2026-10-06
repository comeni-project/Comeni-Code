"""A number answer or tolerance as text in the index, and back (M4.4 spec, M4W.2; #173).

Neither a float column nor jsonb keeps a number as written: jsonb stores `numeric`, which drops the
exponent, so 6.022e+23 came back as a 24-digit integer. Text keeps it: an int as its digits, a
float as its `repr`, which reads back to the same float.
"""

import re

_INT = re.compile(r"-?\d+")


def number_text(value: float | int | None) -> str | None:
    if value is None:
        return None
    return repr(value) if isinstance(value, float) else str(value)


def number_from(text: str | None) -> float | int | None:
    if text is None:
        return None
    return int(text) if _INT.fullmatch(text) else float(text)
