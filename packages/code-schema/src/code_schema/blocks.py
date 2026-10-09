"""A node's body as typed blocks (spec M4.1.2, M4B).

body.md is Markdown with MyST colon-fence directives at the top level: `:::{try} <id>` then `:::`
places a question; `:::{misconception|caveat|convention} <title>`, Markdown, then `:::` is a
callout; `:::{sequence}`, letters, then `:::` is a sequence (M4.8c spec, M4Q.2). Everything between
directives is one text block, so blocks read and written back give the same text, byte for byte.
Inside a code fence a directive is prose. W5.1's other blocks are refused by name until the phase
that builds them.
"""

from __future__ import annotations

import difflib
import re
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Literal, cast, get_args

from code_schema.problems import Problem

CalloutKind = Literal["misconception", "caveat", "convention"]
CALLOUTS: tuple[CalloutKind, ...] = get_args(CalloutKind)
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
_FENCE = re.compile(r"^ {0,3}(`{3,}|~{3,})(.*)$")
_MARKDOC = re.compile(r"^\s*\{%.*%\}\s*$")
_OLD_TRY = re.compile(r"^\s*\{%\s*try\s+([a-z0-9-]+)\s*%\}\s*$")
_LETTERS = re.compile(r"^[A-Za-z\s]*$")


@dataclass(frozen=True)
class Text:
    markdown: str


@dataclass(frozen=True)
class Try:
    question: str


@dataclass(frozen=True)
class Callout:
    kind: CalloutKind
    title: str
    markdown: str


@dataclass(frozen=True)
class SequenceBlock:
    """DNA, RNA or protein letters, drawn monospaced in groups of ten (M4.8c spec, M4Q.2)."""

    letters: str


Block = Text | Try | Callout | SequenceBlock


def block_text(block: Block) -> str:
    """What a block carries as text, whatever its kind: nothing for a try."""
    match block:
        case Text(markdown=markdown) | Callout(markdown=markdown):
            return markdown
        case SequenceBlock(letters=letters):
            return letters
        case Try():
            return ""


def _content(line: str) -> str:
    """A line without its ending, whichever ending it has."""
    return line.rstrip("\r\n")


def _code_lines(lines: Sequence[str]) -> list[bool]:
    """Which lines are code: a fence line or inside one, by CommonMark's rules.

    A fence closes only on its own character, at least as long, with nothing after it; a backtick
    fence's info string holds no backtick; four spaces of indent open no fence.
    """
    code: list[bool] = []
    fence: str | None = None
    for raw in lines:
        found = _FENCE.match(_content(raw))
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


def _first_difference(body: str, written: str) -> tuple[int, str]:
    """The first line where the body and its write-back differ, and why, for CS0415."""
    ours, theirs = body.splitlines(keepends=True), written.splitlines(keepends=True)
    for number, (line, back) in enumerate(zip(ours, theirs, strict=False), start=1):
        if line != back:
            if _content(line) == _content(back):
                if not line.endswith(("\n", "\r")):
                    return number, f"line {number} needs a line ending after it"
                return number, f"line {number} ends differently from the rest of body.md"
            return number, f"line {number} is written back as `{_content(back)}`; write it so"
    number = min(len(ours), len(theirs)) + 1
    return number, f"line {number} is not written back"


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
    code = _code_lines(lines)
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
        if code[number - 1]:
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
            (
                at
                for at in range(index, len(lines))
                if not code[at] and _CLOSE.match(_content(lines[at]))
            ),
            None,
        )
        if closing is None:
            problem("CS0408", f":::{{{name}}} is never closed with :::", number)
            return tuple(blocks), tuple(starts), problems
        inner = lines[index:closing]
        index = closing + 1
        nested = next(
            (
                at
                for at, each in enumerate(inner, start=closing - len(inner))
                if not code[at] and _OPEN.match(_content(each))
            ),
            None,
        )
        if nested is not None:
            problem("CS0406", "a directive cannot hold another directive", nested + 1)
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
        if name == "sequence":
            letters = "".join(inner)
            if argument:
                problem("CS0418", ":::{sequence} takes no title", number)
            elif not letters.strip():
                problem("CS0417", "the sequence block is empty", number)
            elif not _LETTERS.match(letters):
                problem(
                    "CS0416", "a sequence block holds only letters, spaces and line breaks", number
                )
            else:
                blocks.append(SequenceBlock(letters))
                starts.append(number)
            continue
        if name in CALLOUTS:
            if not "".join(inner).strip():
                problem("CS0411", f"the {name} callout is empty", number)
            else:
                blocks.append(Callout(cast(CalloutKind, name), argument, "".join(inner)))
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
        if close := difflib.get_close_matches(name, ["try", "sequence", *CALLOUTS], n=1):
            message += f" — did you mean {close[0]}?"
        problem("CS0412", message, number)
    flush()
    if not problems and (written := write_blocks(blocks)) != body:
        at, said = _first_difference(body, written)
        problem("CS0415", said, at)
    return tuple(blocks), tuple(starts), problems


def write_blocks(blocks: Sequence[Block]) -> str:
    """The body the blocks came from: the inverse of parse_blocks on a body it accepts.

    Blocks carry no line ending of their own, so the one their text already uses is taken — `\\r\\n`
    if any text or callout holds one — which keeps a Windows body byte for byte.
    """
    carried = [block_text(block) for block in blocks]
    newline = "\r\n" if any("\r\n" in text for text in carried) else "\n"
    out: list[str] = []
    for block in blocks:
        if isinstance(block, Text):
            out.append(block.markdown)
        elif isinstance(block, Try):
            out.append(f":::{{try}} {block.question}{newline}:::{newline}")
        elif isinstance(block, SequenceBlock):
            out.append(f":::{{sequence}}{newline}{block.letters}:::{newline}")
        else:
            title = f" {block.title}" if block.title else ""
            out.append(f":::{{{block.kind}}}{title}{newline}{block.markdown}:::{newline}")
    return "".join(out)


def block_json(block: Block) -> dict[str, str]:
    """A block as the index stores it (spec M4B.5). A callout's own kind goes under `callout`."""
    match block:
        case Text(markdown=markdown):
            return {"kind": "text", "markdown": markdown}
        case Try(question=question):
            return {"kind": "try", "question": question}
        case Callout(kind=kind, title=title, markdown=markdown):
            return {"kind": "callout", "callout": kind, "title": title, "markdown": markdown}
        case SequenceBlock(letters=letters):
            return {"kind": "sequence", "letters": letters}


def block_from_json(stored: dict[str, str]) -> Block:
    """The inverse of `block_json`. A kind it does not write is an error, never a guess."""
    match stored.get("kind"):
        case "text":
            return Text(stored["markdown"])
        case "try":
            return Try(stored["question"])
        case "sequence":
            return SequenceBlock(stored["letters"])
        case "callout" if (kind := stored.get("callout")) in CALLOUTS:
            return Callout(kind, stored["title"], stored["markdown"])
        case other:
            said = f"callout {stored.get('callout')!r}" if other == "callout" else repr(other)
            raise ValueError(f"a stored block of kind {said} is not one this format writes")
