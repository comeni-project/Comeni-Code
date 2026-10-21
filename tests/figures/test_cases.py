"""The shared cases: the schema alone, as the browser runs it too (M6.4 spec, M6FG.2)."""

import json
from pathlib import Path
from typing import Any

import pytest

from code_figures import COMPONENTS
from code_figures.schema import validate

CASES: list[dict[str, Any]] = json.loads(
    (Path(__file__).resolve().parents[1] / "fixtures" / "figures" / "cases.json").read_text()
)["cases"]


@pytest.mark.parametrize("case", CASES, ids=[case["name"] for case in CASES])
def test_each_case_finds_its_codes(case: dict[str, Any]) -> None:
    found = [f.code for f in validate(COMPONENTS[case["component"]].schema, case["data"])]
    assert list(dict.fromkeys(found)) == case["codes"]


def test_the_cases_cover_every_kit_and_both_outcomes() -> None:
    assert {case["component"] for case in CASES} == set(COMPONENTS)
    assert any(case["codes"] for case in CASES) and any(not case["codes"] for case in CASES)
