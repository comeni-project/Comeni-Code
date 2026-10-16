"""Which lines of Markdown are code: CommonMark's fences, shared by the body's block reader and
the formula finder, so both read a fence the same way (M4B.2; M6.2, #345)."""

from __future__ import annotations

import re
from collections.abc import Sequence

FENCE = re.compile(r"^ {0,3}(`{3,}|~{3,})(.*)$")


def content(line: str) -> str:
    """A line without its ending, whichever ending it has."""
    return line.rstrip("\r\n")


def code_lines(lines: Sequence[str]) -> list[bool]:
    """Which lines are code: a fence line or inside one, by CommonMark's rules.

    A fence closes only on its own character, at least as long, with nothing after it; a backtick
    fence's info string holds no backtick; four spaces of indent open no fence.
    """
    code: list[bool] = []
    fence: str | None = None
    for raw in lines:
        found = FENCE.match(content(raw))
        if fence is None:
            if found and not (found.group(1)[0] == "`" and "`" in found.group(2)):
                fence = found.group(1)
            code.append(fence is not None)
        else:
            code.append(True)
            if (
                found
                and found.group(1)[0] == fence[0]
                and len(found.group(1)) >= len(fence)
                and not found.group(2).strip()
            ):
                fence = None
    return code
