"""docs/reference/diagnostics.md is generated from the registry (spec M4D.5)."""

from pathlib import Path

from code_schema.diagnostics import BANDS, DIAGNOSTICS
from code_schema.reference import render

PAGE = Path(__file__).resolve().parents[2] / "docs" / "reference" / "diagnostics.md"


def test_the_reference_page_is_current() -> None:
    assert PAGE.read_text(encoding="utf-8") == render(DIAGNOSTICS, BANDS), (
        "docs/reference/diagnostics.md is stale: "
        "run uv run code-schema diagnostics --write docs/reference/diagnostics.md"
    )


def test_the_page_is_the_same_bytes_whatever_the_order() -> None:
    assert render(DIAGNOSTICS, BANDS) == render(dict(reversed(DIAGNOSTICS.items())), BANDS)


def test_the_page_reads_schema_then_weaver_then_api() -> None:
    page = render(DIAGNOSTICS, BANDS)
    assert page.index("## CS —") < page.index("## CW —") < page.index("## CA —")


def test_every_code_is_on_the_page() -> None:
    page = render(DIAGNOSTICS, BANDS)
    assert all(f"\n#### {code} — " in page for code in DIAGNOSTICS)
