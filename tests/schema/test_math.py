"""Formulas found as remark-math finds them, and checked (M6.2 spec, M6MX.1, M6MX.3)."""

import pytest

from code_schema.blocks import parse_blocks
from code_schema.math import formula_problems, inline_formulas


@pytest.mark.parametrize(
    ("markdown", "found"),
    [
        ("$k$-mers", [(0, "k")]),
        ("$5 and $10", [(0, "5 and ")]),
        ("\\$5 and \\$10", []),
        ("`$x$`", []),
        ("Run `echo $HOME` then $y$.", [(0, "y")]),
        ("```\n$x$\n```\n", []),
        ("~~~sh\n$x$\n~~~\nThen $z$.\n", [(3, "z")]),
        ("$$x$$", [(0, "x")]),
        ("$$x$ y", []),
        ("a $b\nc$ d", [(0, "b\nc")]),
        ("a $b\n\nc$", []),
        ("first\n\nsecond $q$", [(2, "q")]),
        ("a lone $ sign", []),
        ("$`a`$", [(0, "`a`")]),
    ],
)
def test_inline_formulas_follow_remark_math(markdown: str, found: list[tuple[int, str]]) -> None:
    assert inline_formulas(markdown) == found


@pytest.mark.parametrize(
    ("tex", "codes"),
    [
        ("\\frac{a}{b}", []),
        ("\\{a\\}", []),
        ("a \\\\ b", []),
        ("\\frac{a}{b", ["CS0422"]),
        ("a}", ["CS0422"]),
        ("\\begin{aligned}x\\end{array}", ["CS0422"]),
        ("\\begin{aligned}x", ["CS0422"]),
        ("\\href{https://x}{y}", ["CS0423"]),
        ("\\url{x}", ["CS0423"]),
        ("\\htmlClass{a}{b}", ["CS0423"]),
        ("\\hrefx", []),
        ("\\\\href", []),
        ("\\newcommand{\\a}{b}", ["CS0424"]),
        ("\\def\\a{b}", ["CS0424"]),
        ("\\gdef\\a{b} \\href{x}{y}", ["CS0423", "CS0424"]),
    ],
)
def test_formula_problems(tex: str, codes: list[str]) -> None:
    assert sorted(code for code, _ in formula_problems(tex)) == codes


def test_an_untrusted_command_is_named() -> None:
    [(_, message)] = formula_problems("\\href{https://x}{y}")
    assert message == "\\href is not allowed in a formula"


def problems_of(body: str) -> list[tuple[str, int | None]]:
    _, _, found = parse_blocks(body, file="n/body.md")
    return [(problem.code, problem.line) for problem in found]


def test_a_text_blocks_formula_is_checked_at_its_line() -> None:
    assert problems_of("Intro.\n\nRead $\\url{x}$.\n") == [("CS0423", 3)]


def test_a_callouts_and_an_examples_formulas_are_checked() -> None:
    assert problems_of(":::{caveat} Careful\nSee $\\def\\a{b}$.\n:::\n") == [("CS0424", 2)]
    assert problems_of(":::{example} Steps\nFirst\n$\\frac{a}{b$\n:::\n") == [("CS0422", 3)]


def test_a_math_blocks_tex_is_checked() -> None:
    assert problems_of(":::{math}\n\\href{x}{y}\n:::\n") == [("CS0423", 2)]


def test_formulas_inside_code_are_never_checked() -> None:
    assert problems_of("```\n$\\href{x}{y}$\n```\n") == []


def test_a_formulas_problem_is_not_unfaithful_writing() -> None:
    # The save refuses it by its code; the writer only guards how blocks are written.
    from code_schema.blocks import Math
    from code_schema.edits import write_faithfully

    assert write_faithfully([Math("\\href{x}{y}\n")]) == ":::{math}\n\\href{x}{y}\n:::\n"
