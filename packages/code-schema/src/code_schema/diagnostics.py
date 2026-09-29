"""The diagnostic registry, loaded from data (spec M4.1.1, M4D.2).

One file declares every code Code can report — `CS` code-schema, `CW` code-weaver, `CA` the API —
so "which codes exist" has one answer, and `explain` and the reference page read the same entries.
A `Problem` built with a code this file does not declare raises: emitting an undeclared code is a
bug in this repository, not a mistake a user made, so the state is unrepresentable rather than
tested for. Kept as Comeni Labs keeps its `MD` and `MF` codes.
"""

from __future__ import annotations

import difflib
from dataclasses import dataclass
from pathlib import Path

import yaml

REGISTRY = Path(__file__).with_name("diagnostics.yml")
PREFIXES = {"CS": "schema", "CW": "weaver", "CA": "api"}
_FIELDS = ("emitted_by", "concern", "says", "refuses", "fix", "explanation")


class UnknownDiagnostic(KeyError):
    """A code the registry does not declare."""


@dataclass(frozen=True)
class Diagnostic:
    code: str
    emitted_by: str
    concern: str
    says: str
    refuses: bool
    fix: str
    explanation: str
    retired: str = ""


@dataclass(frozen=True)
class Band:
    first: str
    last: str
    concern: str


def load(text: str) -> tuple[dict[str, Diagnostic], tuple[Band, ...]]:
    """The registry's codes and bands. Raises ValueError naming the entry that is incomplete."""
    data = yaml.safe_load(text)
    bands = tuple(Band(**band) for band in data["bands"])
    codes: dict[str, Diagnostic] = {}
    for code, entry in data["codes"].items():
        missing = [name for name in _FIELDS if name not in entry]
        if missing:
            raise ValueError(f"{code} is missing {', '.join(missing)}")
        codes[code] = Diagnostic(code=code, **entry)
    return codes, bands


DIAGNOSTICS, BANDS = load(REGISTRY.read_text(encoding="utf-8"))


def diagnostic(code: str) -> Diagnostic:
    if code not in DIAGNOSTICS:
        raise UnknownDiagnostic(code)
    return DIAGNOSTICS[code]


def closest(code: str) -> str | None:
    """The declared code a typo most likely meant.

    Two neighbouring characters swapped is the commonest slip with numbers, and difflib's ratio
    handles it badly — for the spec's own example it offered a code in another band — so a single
    swap is tried first (spec M4D.5; the test pins the example).
    """
    swapped = sorted(
        candidate
        for i in range(len(code) - 1)
        if (candidate := code[:i] + code[i + 1] + code[i] + code[i + 2 :]) in DIAGNOSTICS
        and candidate != code
    )
    if swapped:
        return swapped[0]
    found = difflib.get_close_matches(code, sorted(DIAGNOSTICS), n=1, cutoff=0.5)
    return found[0] if found else None
