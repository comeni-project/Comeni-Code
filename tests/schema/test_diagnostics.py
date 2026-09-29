"""The diagnostic registry (spec M4D.2, M4D.3, M4D.6)."""

import re
import subprocess
import zipfile
from pathlib import Path

import pytest

from code_schema.diagnostics import (
    BANDS,
    DIAGNOSTICS,
    PREFIXES,
    UnknownDiagnostic,
    closest,
    diagnostic,
    load,
)

CODE = re.compile(r"^C[SWA]\d{4}$")


def test_the_registry_declares_codes() -> None:
    assert len(DIAGNOSTICS) > 100
    assert all(CODE.match(code) for code in DIAGNOSTICS)


def test_no_code_ends_in_0000() -> None:
    assert not [code for code in DIAGNOSTICS if code.endswith("0000")]


def test_every_entry_is_complete() -> None:
    for code, entry in DIAGNOSTICS.items():
        assert entry.says and entry.fix and entry.explanation and entry.concern, code
        assert isinstance(entry.refuses, bool), code


def test_a_prefix_says_who_emits_it() -> None:
    for code, entry in DIAGNOSTICS.items():
        assert PREFIXES[code[:2]] == entry.emitted_by, code


def test_every_code_sits_in_a_band_its_concern_owns() -> None:
    for code, entry in DIAGNOSTICS.items():
        owners = [band for band in BANDS if band.first <= code <= band.last]
        assert [band.concern for band in owners] == [entry.concern], code


def test_bands_do_not_overlap() -> None:
    ordered = sorted(BANDS, key=lambda band: band.first)
    for before, after in zip(ordered, ordered[1:], strict=False):
        assert before.last < after.first


def test_an_undeclared_code_raises_and_a_close_one_is_offered() -> None:
    with pytest.raises(UnknownDiagnostic):
        diagnostic("CS0999")
    assert closest("CS0210") in DIAGNOSTICS


def test_two_swapped_digits_find_the_code_meant() -> None:
    # Spec M4D.5's own example: CS0210 is not a code, and the reader meant CS0201.
    assert closest("CS0210") == "CS0201"


def test_load_refuses_an_entry_missing_a_field() -> None:
    text = (
        "bands:\n  - {first: CS0001, last: CS0099, concern: fields}\n"
        "codes:\n  CS0001: {emitted_by: schema}\n"
    )
    with pytest.raises(ValueError, match="CS0001"):
        load(text)


def test_the_registry_ships_in_the_wheel(tmp_path: Path) -> None:
    root = Path(__file__).resolve().parents[2] / "packages" / "code-schema"
    subprocess.run(
        ["uv", "build", "--wheel", "--out-dir", str(tmp_path), str(root)],
        check=True,
        capture_output=True,
    )
    (wheel,) = tmp_path.glob("code_schema-*.whl")
    assert "code_schema/diagnostics.yml" in zipfile.ZipFile(wheel).namelist()
