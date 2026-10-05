"""A line budget for the files every session reads first (docs compaction spec, C3).

`CLAUDE.md` grew by a sentence per part until M3 closed at 320 lines, and Labs' reached 1,441 the
same way. A number that fails the build is what stops that: the rules for what goes where are in
`docs/notes/compaction.md`, and this is what makes them get read. **Compact; don't raise a budget.**
"""

from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
BUDGETS = {"CLAUDE.md": 300, "docs/notes/now.md": 200}


@pytest.mark.parametrize(("name", "budget"), BUDGETS.items())
def test_a_first_read_file_is_within_its_budget(name: str, budget: int) -> None:
    path = ROOT / name
    assert path.exists(), f"{name} is gone; move its budget with it"
    lines = len(path.read_text(encoding="utf-8").splitlines())
    assert lines <= budget, (
        f"{name} is {lines} lines, over its budget of {budget}. "
        "Compact it (docs/notes/compaction.md); don't raise the budget."
    )
