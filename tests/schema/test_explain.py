"""code-schema explain: what a code says, how to fix it, and why (spec M4D.5)."""

from dataclasses import replace

import pytest

import code_schema.diagnostics as registry
from code_schema.cli import main

Captured = pytest.CaptureFixture[str]


def test_explain_prints_what_a_code_says_and_how_to_fix_it(capsys: Captured) -> None:
    assert main(["explain", "CS0203"]) == 0
    out = capsys.readouterr().out
    assert out.startswith(
        "CS0203 — a resource asks to embed from a provider that does not allow it\n"
    )
    assert "\nFix: " in out and "\nWhy: " in out


def test_an_unknown_code_exits_2_with_the_closest(capsys: Captured) -> None:
    assert main(["explain", "CS0299"]) == 2
    assert capsys.readouterr().err.startswith("code-schema: CS0299 is not a code — did you mean ")


def test_a_code_is_read_in_any_case(capsys: Captured) -> None:
    assert main(["explain", "cs0203"]) == 0
    assert capsys.readouterr().out.startswith("CS0203 — ")


def test_a_retired_code_still_explains_and_says_so(
    capsys: Captured, monkeypatch: pytest.MonkeyPatch
) -> None:
    retired = replace(registry.DIAGNOSTICS["CS0203"], retired="2026-10-01 — an example")
    monkeypatch.setitem(registry.DIAGNOSTICS, "CS0203", retired)
    assert main(["explain", "CS0203"]) == 0
    assert "Retired 2026-10-01 — an example" in capsys.readouterr().out
