"""Formulas: where Markdown holds them, and what a formula may say (M6.2 spec, M6MX.1, M6MX.3).

Learners' formulas are drawn by KaTeX after `remark-math` finds them, so `inline_formulas` finds
them by the same rule: a run of n unescaped dollars opens one and the next run of exactly n closes
it, as Markdown pairs code spans; never inside code; a blank line ends the search. What a formula
may say is checked here as far as a pure check can: braces and environments balance, no command
KaTeX would run untrusted, and no macro definitions, so one formula never changes another.
"""

from __future__ import annotations

import re

_FENCE = re.compile(r"^ {0,3}(`{3,}|~{3,})")
_INDENTED = re.compile(r"^(?: {4}|\t)")
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


def _paragraphs(markdown: str) -> list[tuple[int, str]]:
    """Each stretch of prose lines (no code, no blank line), with the line it starts on."""
    found: list[tuple[int, str]] = []
    lines = markdown.split("\n")
    fence: str | None = None
    current: list[str] = []
    start = 0
    for number, line in enumerate(lines):
        run = _FENCE.match(line)
        if fence is not None:
            if run and run.group(1)[0] == fence[0] and len(run.group(1)) >= len(fence):
                fence = None
            continue
        if run:
            fence = run.group(1)
        prose = not run and line.strip() != "" and not (not current and _INDENTED.match(line))
        if prose:
            if not current:
                start = number
            current.append(line)
            continue
        if current:
            found.append((start, "\n".join(current)))
            current = []
    if current:
        found.append((start, "\n".join(current)))
    return found


def _run(text: str, at: int, char: str) -> int:
    end = at
    while end < len(text) and text[end] == char:
        end += 1
    return end - at


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


def inline_formulas(markdown: str) -> list[tuple[int, str]]:
    """Each `$…$` formula, as (its line counted from the markdown's first, its TeX)."""
    found: list[tuple[int, str]] = []
    for first, text in _paragraphs(markdown):
        at = 0
        while at < len(text):
            char = text[at]
            if char == "\\" and at + 1 < len(text) and text[at + 1] in _PUNCTUATION:
                at += 2
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
                found.append((first + text.count("\n", 0, at), text[at + size : end]))
            at = end + size
    return found


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
