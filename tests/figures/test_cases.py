"""The shared cases, as the browser runs them too (M6.4 spec, M6FG.2; M6.5 spec, M6CO.5): data
through a component's schema and checks, whole files as code-schema reads them, and the starters."""

import json
from pathlib import Path
from typing import Any

import pytest

from code_figures import CODES, COMPONENTS, figure_findings
from code_schema.figures import read_figure

SHARED: dict[str, Any] = json.loads(
    (Path(__file__).resolve().parents[1] / "fixtures" / "figures" / "cases.json").read_text()
)
CASES: list[dict[str, Any]] = SHARED["cases"]
FILES: list[dict[str, Any]] = SHARED["files"]
FILE_CODES = {"CS1023", "CS1024", "CS1025", "CS1026", "CS1027"}


def text_of(case: dict[str, Any]) -> str:
    text: str = case["text"]
    return text + ("#" * case["pad"] + "\n" if "pad" in case else "")


@pytest.mark.parametrize("case", CASES, ids=[case["name"] for case in CASES])
def test_each_case_finds_its_codes(case: dict[str, Any]) -> None:
    found = [f.code for f in figure_findings(case["component"], case["data"])]
    assert list(dict.fromkeys(found)) == case["codes"]


@pytest.mark.parametrize("case", FILES, ids=[case["name"] for case in FILES])
def test_each_file_finds_its_codes(case: dict[str, Any]) -> None:
    _, problems = read_figure("case", text_of(case), file="figures/case.yaml")
    assert list(dict.fromkeys(p.code for p in problems)) == case["codes"]


def test_the_cases_cover_every_kit_and_both_outcomes() -> None:
    assert {case["component"] for case in CASES} == set(COMPONENTS)
    assert any(case["codes"] for case in CASES) and any(not case["codes"] for case in CASES)


def test_every_code_has_a_case() -> None:
    """The browser's twins are held to every code the server writes for a figure (M6CO.5)."""
    found = {code for case in CASES + FILES for code in case["codes"]}
    assert found >= CODES | FILE_CODES


def test_the_starters_are_code_figures_own() -> None:
    assert SHARED["starters"] == {name: dict(c.starter) for name, c in COMPONENTS.items()}
