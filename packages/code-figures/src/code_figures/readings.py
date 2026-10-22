"""One reading for every figure file (M6.5 spec, M6CO.3).

The server reads a figure with PyYAML (YAML 1.1) and the browser with YAML 1.2; they disagree on
some plain values, as `on` (true, or the word) and `1e3` (the word, or 1000). A plain key or value
in one of these forms is refused on both sides, so a file that passes has one reading. The forms
are data, in readings.json beside this module, which the web's generator also reads.
"""

import json
import re
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Form:
    name: str
    pattern: re.Pattern[str]


_DATA = json.loads((Path(__file__).resolve().parent / "readings.json").read_text(encoding="utf-8"))
TWO_READINGS: tuple[Form, ...] = tuple(
    Form(form["name"], re.compile(form["pattern"])) for form in _DATA["forms"]
)
CHARACTERS = Form(_DATA["characters"]["name"], re.compile(_DATA["characters"]["pattern"]))


def two_readings(plain: str) -> str | None:
    """The form a plain YAML value is in, when the server and the browser would read it apart."""
    return next((form.name for form in TWO_READINGS if form.pattern.match(plain)), None)


def odd_character_line(text: str) -> int | None:
    """The 1-based line of the first raw character the two readers read apart, if any."""
    found = CHARACTERS.pattern.search(text)
    return None if found is None else text.count("\n", 0, found.start()) + 1
