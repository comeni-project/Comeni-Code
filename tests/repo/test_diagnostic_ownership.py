"""The registry and the source agree (spec M4D.6).

Each package writes only its own prefix; every declared code is written somewhere, so the registry
collects no dead entries; and every declared code is named by some test, so swapping two codes
fails a test (the second review checkpoint found 18 that none named).
"""

import re
from pathlib import Path

from code_schema.diagnostics import DIAGNOSTICS

ROOT = Path(__file__).resolve().parents[2]
SOURCES = {
    "CS": ROOT / "packages" / "code-schema" / "src",
    "CW": ROOT / "packages" / "code-weaver" / "src",
    "CA": ROOT / "apps" / "api" / "src",
}
TESTS = [ROOT / "tests", ROOT / "apps" / "api" / "tests"]
# A code appears in source as a literal ("CS0201") or at the start of a message ("CA0004 …").
MENTION = re.compile(r"\b(C[SWA]\d{4})\b")


def written(root: Path) -> set[str]:
    return {
        code
        for path in root.rglob("*.py")
        for code in MENTION.findall(path.read_text(encoding="utf-8"))
    }


def live() -> set[str]:
    return {code for code, entry in DIAGNOSTICS.items() if not entry.retired}


def test_each_package_writes_only_its_own_prefix() -> None:
    for prefix, root in SOURCES.items():
        foreign = sorted(code for code in written(root) if not code.startswith(prefix))
        assert foreign == [], f"{root} writes {foreign}"


def test_every_declared_code_is_written_somewhere() -> None:
    everywhere = set().union(*(written(root) for root in SOURCES.values()))
    assert sorted(live() - everywhere) == []


def test_every_code_written_is_declared() -> None:
    everywhere = set().union(*(written(root) for root in SOURCES.values()))
    assert sorted(everywhere - set(DIAGNOSTICS)) == []


def test_every_declared_code_is_named_by_a_test() -> None:
    named = {
        code
        for root in TESTS
        for path in root.rglob("test_*.py")
        for code in MENTION.findall(path.read_text(encoding="utf-8"))
    }
    assert sorted(live() - named) == []
