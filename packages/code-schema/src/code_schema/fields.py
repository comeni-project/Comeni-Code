"""One check per rule in spec M1P1.3.

A check returns the message when a value is wrong and None when it is right, so the table in
node.py stays a list of rows. Nothing coerces: "12" is as wrong as "twelve", because a coerced
value means the file and the object disagree and the writer would rewrite the file.
"""

from __future__ import annotations

import re
from collections.abc import Callable, Sequence
from dataclasses import dataclass

Check = Callable[[object], str | None]

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
    def check(value: object) -> str | None:
        if value == expected and type(value) is type(expected):
            return None
        return f"this node is schema {shown(value)}; this validator understands {shown(expected)}"

    return check


def one_line(max_len: int) -> Check:
    def check(value: object) -> str | None:
        if not isinstance(value, str):
            return f"{shown(value)} is not text"
        if not value.strip():
            return "must not be empty"
        if "\n" in value:
            return "must be one line"
        if len(value) > max_len:
            return f"is longer than {max_len} characters ({len(value)})"
        return None

    return check


def one_sentence(max_len: int) -> Check:
    """One line ending in terminal punctuation. Counting sentences is a rule we cannot keep."""
    line = one_line(max_len)

    def check(value: object) -> str | None:
        if (wrong := line(value)) is not None:
            return wrong
        if isinstance(value, str) and value.rstrip().endswith((".", "?", "!")):
            return None
        return "must end with . ? or !"

    return check


def one_of(allowed: Sequence[str], *, noun: str) -> Check:
    def check(value: object) -> str | None:
        if isinstance(value, str) and value in allowed:
            return None
        return f"{shown(value)} is not a {noun} ({', '.join(allowed)})"

    return check


def whole_number(minimum: int) -> Check:
    def check(value: object) -> str | None:
        if not isinstance(value, int) or isinstance(value, bool):
            return f"{shown(value)} is not a whole number"
        if value < minimum:
            return f"{shown(value)} is not at least {minimum}"
        return None

    return check


def slug(*, noun: str) -> Check:
    def check(value: object) -> str | None:
        if isinstance(value, str) and SLUG.match(value):
            return None
        return f"{shown(value)} is not a {noun} (lower case, digits and single hyphens)"

    return check
