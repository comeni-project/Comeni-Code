"""A node's body as typed blocks (spec M4.1.2, M4B).

body.md is Markdown with MyST colon-fence directives at the top level: `:::{try} <id>` then `:::`
places a question; `:::{misconception|caveat|convention} <title>`, Markdown, then `:::` is a
callout. Everything between directives is one text block, so blocks read and written back give the
same text, byte for byte. Inside a code fence a directive is prose. W5.1's other blocks are refused
by name until the phase that builds them.
"""

from __future__ import annotations

import difflib
import re
from collections.abc import Sequence
from dataclasses import dataclass

from code_schema.problems import Problem

CALLOUTS = ("misconception", "caveat", "convention")
_LATER = {
    "figure": "M6",
    "math": "M6",
    "image": "M6",
    "example": "M6",
    "problem": "M6",
    "claim": "a later phase",
}
_OPEN = re.compile(r"^:::\{([^}]*)\}(?: (.*))?$")
_CLOSE = re.compile(r"^:::\s*$")
_OPTION = re.compile(r"^:[A-Za-z][\w-]*:")
_FENCE = re.compile(r"^\s*(```|~~~)")
_MARKDOC = re.compile(r"^\s*\{%.*%\}\s*$")
_OLD_TRY = re.compile(r"^\s*\{%\s*try\s+([a-z0-9-]+)\s*%\}\s*$")


@dataclass(frozen=True)
class Text:
    markdown: str


@dataclass(frozen=True)
class Try:
    question: str


@dataclass(frozen=True)
class Callout:
    kind: str
    title: str
    markdown: str


Block = Text | Try | Callout


def _content(line: str) -> str:
    """A line without its ending, whichever ending it has."""
    return line.rstrip("\r\n")


def parse_blocks(
    body: str, *, file: str
) -> tuple[tuple[Block, ...], tuple[int, ...], list[Problem]]:
    """The body's blocks, the line each starts on, and every problem. Never raises."""
    lines = body.splitlines(keepends=True)
    blocks: list[Block] = []
    starts: list[int] = []
    problems: list[Problem] = []
    text: list[str] = []
    text_start = 1
    fence: str | None = None
    index = 0

    def problem(code: str, message: str, line: int) -> None:
        problems.append(Problem(file=file, line=line, code=code, message=message))

    def keep(raw: str, number: int) -> None:
        nonlocal text_start
        if not text:
            text_start = number
        text.append(raw)

    def flush() -> None:
        if text:
            blocks.append(Text("".join(text)))
            starts.append(text_start)
        text.clear()

    while index < len(lines):
        raw = lines[index]
        line = _content(raw)
        number = index + 1
        index += 1
        opens = _FENCE.match(line)
        if opens is not None and (fence is None or fence == opens.group(1)):
            fence = opens.group(1) if fence is None else None
            keep(raw, number)
            continue
        if fence is not None:
            keep(raw, number)
            continue
        if _MARKDOC.match(line):
            found = _OLD_TRY.match(line)
            said = (
                f"{line.strip()} is written :::{{try}} {found.group(1)} then ::: on the next line"
                if found
                else f"{line.strip()} is a Markdoc-style tag; directives are :::{{name}} fences"
            )
            problem("CS0414", said, number)
            continue
        opened = _OPEN.match(line)
        if opened is None:
            keep(raw, number)
            continue
        name, argument = opened.group(1), (opened.group(2) or "").strip()
        flush()
        closing = next(
            (at for at in range(index, len(lines)) if _CLOSE.match(_content(lines[at]))), None
        )
        if closing is None:
            problem("CS0408", f":::{{{name}}} is never closed with :::", number)
            return tuple(blocks), tuple(starts), problems
        inner = lines[index:closing]
        index = closing + 1
        nested = next((at for at, each in enumerate(inner) if _OPEN.match(_content(each))), None)
        if nested is not None:
            problem("CS0406", "a directive cannot hold another directive", number + 1 + nested)
            continue
        if inner and _OPTION.match(_content(inner[0])):
            problem("CS0407", f":::{{{name}}} takes no options", number + 1)
            continue
        if name == "try":
            if not argument:
                problem("CS0410", ":::{try} names no question", number)
            elif "".join(inner).strip():
                problem(
                    "CS0409", f":::{{try}} {argument} places a question; it holds nothing", number
                )
            else:
                blocks.append(Try(argument))
                starts.append(number)
            continue
        if name in CALLOUTS:
            if not "".join(inner).strip():
                problem("CS0411", f"the {name} callout is empty", number)
            else:
                blocks.append(Callout(name, argument, "".join(inner)))
                starts.append(number)
            continue
        if name in _LATER:
            problem(
                "CS0413",
                f":::{{{name}}} arrives in {_LATER[name]}; until then it is not read",
                number,
            )
            continue
        message = f":::{{{name}}} is not a directive this format reads"
        if close := difflib.get_close_matches(name, ["try", *CALLOUTS], n=1):
            message += f" — did you mean {close[0]}?"
        problem("CS0412", message, number)
    flush()
    return tuple(blocks), tuple(starts), problems


def write_blocks(blocks: Sequence[Block]) -> str:
    """The body the blocks came from: the inverse of parse_blocks on a body it accepts.

    Blocks carry no line ending of their own, so the one their text already uses is taken — `\\r\\n`
    if any text or callout holds one — which keeps a Windows body byte for byte.
    """
    carried = [block.markdown for block in blocks if not isinstance(block, Try)]
    newline = "\r\n" if any("\r\n" in text for text in carried) else "\n"
    out: list[str] = []
    for block in blocks:
        if isinstance(block, Text):
            out.append(block.markdown)
        elif isinstance(block, Try):
            out.append(f":::{{try}} {block.question}{newline}:::{newline}")
        else:
            title = f" {block.title}" if block.title else ""
            out.append(f":::{{{block.kind}}}{title}{newline}{block.markdown}:::{newline}")
    return "".join(out)
