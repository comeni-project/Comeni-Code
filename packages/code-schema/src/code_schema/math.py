"""Formulas: where Markdown holds them, and what a formula may say (M6.2 spec, M6MX.1, M6MX.3).

Learners' formulas are drawn by KaTeX after `remark-math` finds them, so `inline_formulas` finds
them by the same rule: a run of n unescaped dollars opens one and the next run of exactly n closes
it, as Markdown pairs code spans; never inside code; a blank line ends the search. What a formula
may say is checked here as far as a pure check can: braces and environments balance, no command
KaTeX would run untrusted, and no macro definitions, so one formula never changes another.
"""

from __future__ import annotations

import re

from code_schema.fences import code_lines, content

_INDENT = re.compile(r"^(?: {4}|\t)")
_LIST = re.compile(r"^( {0,3}(?:[-*+]|\d{1,9}[.)]))( +|$)")
_HEADING = re.compile(r"^ {0,3}#{1,6}(?:\s+(.*?))?\s*#*\s*$")
_QUOTE = re.compile(r"^ {0,3}> ?")
_DELIMITER = re.compile(r"^\s*\|?\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)*\|?\s*$")
_DISPLAY_OPEN = re.compile(r"^ {0,3}(\${2,})[^$]*$")
_PUNCTUATION = frozenset("!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~")
_COMMAND = re.compile(r"\\([A-Za-z]+)")
_ENVIRONMENT = re.compile(r"\\(begin|end)\s*\{([^{}]*)\}")


# What a formula's own check emits: about what a formula says, never about how blocks are written.
FORMULA_CODES = frozenset({"CS0422", "CS0423", "CS0424"})

# Links, images and markup (invariant 6), and colour an author would spend (invariant 11, #346).
UNTRUSTED = frozenset(
    {"href", "url", "includegraphics", "htmlClass", "htmlId", "htmlStyle", "htmlData"}
    | {"color", "textcolor", "colorbox", "fcolorbox"}
)
DEFINES = frozenset(
    {"def", "gdef", "edef", "xdef", "let", "futurelet"}
    | {"newcommand", "renewcommand", "providecommand"}
)


def _cells(row: str) -> list[str]:
    """A table row's cells, split on unescaped pipes."""
    return [cell for cell in re.split(r"(?<!\\)\|", row.strip())]


def _blocks(markdown: str) -> tuple[list[tuple[int, str]], list[tuple[int, str]]]:
    """The Markdown's inline stretches, (first line, text), and its display `$$` blocks,
    (opening line, TeX), by the block structure remark-math sees: code (the body's fence rule and
    indented code) holds no formula; a paragraph runs until a blank line, a heading, a list item,
    a table or a `$$` block; a heading is one line; a table cell stands alone; a quote's `>` is not
    text; a list item's continuation lines, however indented, are its text; a `$$` block runs to
    its closing `$$` line, across blank lines, or to the end."""
    lines = [content(line) for line in markdown.split("\n")]
    code = code_lines(lines)
    stretches: list[tuple[int, str]] = []
    displays: list[tuple[int, str]] = []
    current: list[str] = []
    start = 0
    in_list = False
    at = 0

    def close() -> None:
        nonlocal current
        if current:
            stretches.append((start, "\n".join(current)))
            current = []

    def keep(number: int, text: str) -> None:
        nonlocal start
        if not current:
            start = number
        current.append(text)

    while at < len(lines):
        line = lines[at]
        if code[at]:
            close()
            at += 1
            continue
        quoted = line
        while _QUOTE.match(quoted):
            quoted = _QUOTE.sub("", quoted, count=1)
        if quoted.strip() == "":
            close()
            at += 1
            continue
        opened = _DISPLAY_OPEN.match(quoted)
        if opened:
            close()
            fence = opened.group(1)
            body: list[str] = []
            end = at + 1
            while end < len(lines):
                if re.match(rf"^ {{0,3}}\${{{len(fence)},}}\s*$", lines[end]):
                    break
                body.append(lines[end])
                end += 1
            if end == len(lines):  # never closed: it runs to the end, less the trailing blank lines
                while body and not body[-1].strip():
                    body.pop()
            displays.append((at, "\n".join(body)))
            at = end + 1
            continue
        if not current and not in_list and _INDENT.match(quoted):
            at += 1  # indented code
            continue
        heading = _HEADING.match(quoted)
        if heading:
            close()
            in_list = False
            if heading.group(1):
                stretches.append((at, heading.group(1)))
            at += 1
            continue
        if "|" in quoted and at + 1 < len(lines) and _DELIMITER.match(lines[at + 1]):
            close()
            in_list = False
            row = at
            while row < len(lines) and lines[row].strip() and "|" in lines[row]:
                if row != at + 1:
                    stretches.extend((row, cell) for cell in _cells(lines[row]))
                row += 1
            at = row
            continue
        item = _LIST.match(quoted)
        if item:
            close()
            in_list = True
            keep(at, quoted[item.end() :])
            at += 1
            continue
        if in_list and not current and not quoted[:1].isspace():
            in_list = False  # a paragraph at the margin, after a blank line, ends the list
        keep(at, quoted)
        at += 1
    close()
    return stretches, displays


def _closing(text: str, at: int, char: str, size: int) -> int | None:
    """Where the next run of exactly `size` `char`s starts, from `at`; None if there is none."""
    while at < len(text):
        if text[at] == char:
            length = _run(text, at, char)
            if length == size:
                return at
            at += length
        else:
            at += 1
    return None


def _run(text: str, at: int, char: str) -> int:
    end = at
    while end < len(text) and text[end] == char:
        end += 1
    return end - at


def _destination(text: str, at: int) -> int:
    """The end of a link destination opening at `at` (just after `](`), or `at` if none closes."""
    depth = 1
    end = at
    while end < len(text) and text[end] != "\n":
        if text[end] == "(":
            depth += 1
        elif text[end] == ")":
            depth -= 1
            if depth == 0:
                return end + 1
        end += 1
    return at


def _inline(text: str) -> list[tuple[int, str]]:
    found: list[tuple[int, str]] = []
    at = 0
    while at < len(text):
        char = text[at]
        if char == "\\" and at + 1 < len(text) and text[at + 1] in _PUNCTUATION:
            at += 2
            continue
        if char == "]" and text.startswith("](", at):
            at = max(_destination(text, at + 2), at + 2)
            continue
        if char not in "`$":
            at += 1
            continue
        size = _run(text, at, char)
        end = _closing(text, at + size, char, size)
        if end is None:
            at += size
            continue
        if char == "$":
            found.append((text.count("\n", 0, at), text[at + size : end]))
        at = end + size
    return found


def inline_formulas(markdown: str) -> list[tuple[int, str]]:
    """Each formula, `$…$` or a `$$` block, as (its line counted from the markdown's first, its
    TeX), in reading order."""
    stretches, displays = _blocks(markdown)
    found = [(first + offset, tex) for first, text in stretches for offset, tex in _inline(text)]
    return sorted([*found, *displays], key=lambda formula: formula[0])


def formula_problems(tex: str) -> list[tuple[str, str]]:
    """What is wrong with a formula, as (code, message) pairs, in the order found."""
    problems: list[tuple[str, str]] = []
    plain = tex.replace("\\\\", "  ").replace("\\{", "  ").replace("\\}", "  ")
    depth = 0
    for char in plain:
        depth += {"{": 1, "}": -1}.get(char, 0)
        if depth < 0:
            break
    if depth != 0:
        problems.append(("CS0422", "the formula's braces do not balance"))
    opened: list[str] = []
    for which, name in _ENVIRONMENT.findall(plain):
        if which == "begin":
            opened.append(name)
        elif not opened or opened.pop() != name:
            problems.append(("CS0422", f"\\end{{{name}}} closes no \\begin{{{name}}}"))
            break
    else:
        if opened:
            problems.append(("CS0422", f"\\begin{{{opened[-1]}}} is never closed"))
    seen: set[str] = set()
    for name in _COMMAND.findall(plain):
        if name in seen:
            continue
        seen.add(name)
        if name in UNTRUSTED:
            problems.append(("CS0423", f"\\{name} is not allowed in a formula"))
        elif name in DEFINES:
            problems.append(("CS0424", f"\\{name} defines a macro; a formula defines none"))
    return problems
