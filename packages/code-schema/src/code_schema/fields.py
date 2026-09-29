"""One check per rule in spec M1P1.3.

A check returns what went wrong — a `Wrong`, its diagnostic code and its message — when a value
is wrong, and None when it is right, so the table in node.py stays a list of rows. A check is
shared across fields, so its code says what kind of value was wrong and the problem's field says
where (spec M4D.4). Nothing coerces: "12" is as wrong as "twelve", because a coerced
value means the file and the object disagree and the writer would rewrite the file.
"""

from __future__ import annotations

import difflib
import re
from collections.abc import Callable, Collection, Sequence
from dataclasses import dataclass


@dataclass(frozen=True)
class Wrong:
    """What a check found wrong: its diagnostic code and its message."""

    code: str
    message: str


Check = Callable[[object], Wrong | None]

SLUG = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")


def shown(value: object) -> str:
    """A value as it appears in a message."""
    if value is None:
        return "nothing"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, str):
        return f'"{value}"'
    return str(value)


@dataclass(frozen=True)
class Spec:
    name: str
    required: bool
    check: Check


def exactly(expected: object) -> Check:
    def check(value: object) -> Wrong | None:
        if value == expected and type(value) is type(expected):
            return None
        return Wrong(
            "CS0006",
            f"this node is schema {shown(value)}; this validator understands {shown(expected)}",
        )

    return check


def one_line(max_len: int) -> Check:
    def check(value: object) -> Wrong | None:
        if not isinstance(value, str):
            return Wrong("CS0007", f"{shown(value)} is not text")
        if not value.strip():
            return Wrong("CS0008", "must not be empty")
        if "\n" in value:
            return Wrong("CS0009", "must be one line")
        if len(value) > max_len:
            return Wrong("CS0010", f"is longer than {max_len} characters ({len(value)})")
        return None

    return check


def one_sentence(max_len: int) -> Check:
    """One line ending in terminal punctuation. Counting sentences is a rule we cannot keep."""
    line = one_line(max_len)

    def check(value: object) -> Wrong | None:
        if (wrong := line(value)) is not None:
            return wrong
        if isinstance(value, str) and value.rstrip().endswith((".", "?", "!")):
            return None
        return Wrong("CS0011", "must end with . ? or !")

    return check


def one_of(allowed: Sequence[str], *, noun: str) -> Check:
    def check(value: object) -> Wrong | None:
        if isinstance(value, str) and value in allowed:
            return None
        return Wrong("CS0012", f"{shown(value)} is not a {noun} ({', '.join(allowed)})")

    return check


def whole_number(minimum: int) -> Check:
    def check(value: object) -> Wrong | None:
        if not isinstance(value, int) or isinstance(value, bool):
            return Wrong("CS0013", f"{shown(value)} is not a whole number")
        if value < minimum:
            return Wrong("CS0014", f"{shown(value)} is not at least {minimum}")
        return None

    return check


def slug(*, noun: str) -> Check:
    def check(value: object) -> Wrong | None:
        if isinstance(value, str) and SLUG.match(value):
            return None
        return Wrong(
            "CS0015", f"{shown(value)} is not a {noun} (lower case, digits and single hyphens)"
        )

    return check


def in_registry(names: Collection[str], *, noun: str, registry: str) -> Check:
    """A value listed in a registry file, with the closest listed name when it is not."""
    ordered = sorted(names)

    def check(value: object) -> Wrong | None:
        if isinstance(value, str) and value in names:
            return None
        message = f"{shown(value)} is not a {noun} — {registry} lists {len(ordered)}"
        if isinstance(value, str) and (close := difflib.get_close_matches(value, ordered, n=1)):
            message += f", closest is `{close[0]}`"
        return Wrong("CS0016", message)

    return check


_URL = re.compile(r"^https://[^\s<>\"]+$")
_TIMESTAMP = re.compile(r"^(\d{1,2}:)?\d{1,2}:\d{2}$")


def https_url() -> Check:
    """A link we would open. http:// is refused rather than upgraded: nothing here coerces."""

    def check(value: object) -> Wrong | None:
        if not isinstance(value, str) or not value.strip():
            return Wrong("CS0017", f"{shown(value)} is not a url")
        if not value.startswith("https://"):
            return Wrong("CS0018", "the url must start with https://")
        if not _URL.match(value):
            return Wrong("CS0017", f"{shown(value)} is not a url")
        return None

    return check


def seconds(stamp: str) -> int | None:
    """`7:45` or `1:07:45` as seconds, or None when it is not a timestamp."""
    if not _TIMESTAMP.match(stamp):
        return None
    parts = [int(part) for part in stamp.split(":")]
    while len(parts) < 3:
        parts.insert(0, 0)
    return parts[0] * 3600 + parts[1] * 60 + parts[2]
