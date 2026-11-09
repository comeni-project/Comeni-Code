"""Repository-wide pytest hooks.

A test's name is printed whole by `pytest -v`, and a parameter with no `ids=` puts its value in the
name. A 1 MB name hung CI's runner with no log to read (PR #434); collection refuses any over 300
characters, so a big parameter gets a short id.
"""

import pytest

LONGEST_NAME = 300


def pytest_collection_modifyitems(items: list[pytest.Item]) -> None:
    long = [item.nodeid[:120] + "…" for item in items if len(item.nodeid) > LONGEST_NAME]
    if long:
        raise pytest.UsageError(
            f"{len(long)} test name(s) over {LONGEST_NAME} characters: give their "
            f"parameters ids= ({'; '.join(long[:3])})"
        )
