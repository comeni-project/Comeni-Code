"""The weaver's codes are declared under CW, as the weaver's (spec M4D.4, M4D.6).

The weaver's core imports nothing from code-schema, so its codes are string literals; this test is
what ties them to the registry.
"""

import re
from pathlib import Path

from code_schema.diagnostics import DIAGNOSTICS

SOURCE = Path(__file__).resolve().parents[2] / "packages" / "code-weaver" / "src" / "code_weaver"


def test_every_code_the_weaver_writes_is_declared_as_the_weavers() -> None:
    written = {
        code
        for path in SOURCE.glob("*.py")
        for code in re.findall(r'"(C[SWA]\d{4})"', path.read_text(encoding="utf-8"))
    }
    assert written, "the weaver writes no codes"
    for code in written:
        assert code.startswith("CW"), code
        assert DIAGNOSTICS[code].emitted_by == "weaver", code
