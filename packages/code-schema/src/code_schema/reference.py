"""The reference page of every diagnostic code, rendered from the registry (spec M4D.5).

The page is generated, committed, and checked by a test, as openapi.json is: the same registry
always renders the same bytes, in code order, whatever order the entries were read in.
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence

from code_schema.diagnostics import Band, Diagnostic

_SUBSYSTEMS = {
    "CS": "CS — code-schema: the content format",
    "CW": "CW — code-weaver: routes and search",
    "CA": "CA — the API",
}


def _text(block: str) -> str:
    return " ".join(block.split())


def render(diagnostics: Mapping[str, Diagnostic], bands: Sequence[Band]) -> str:
    """Markdown for docs/reference/diagnostics.md."""
    lines = [
        "# Diagnostic codes",
        "",
        "Every problem Comeni Code reports carries a code: `CS` from code-schema, `CW` from",
        "code-weaver, `CA` from the API, grouped in bands of one hundred by concern. A code is",
        "never renumbered. `uv run code-schema explain <CODE>` prints one entry.",
        "",
        "*Generated from `packages/code-schema/src/code_schema/diagnostics.yml` — do not edit. "
        "Regenerate with `uv run code-schema diagnostics --write docs/reference/diagnostics.md`.*",
    ]
    prefix = ""
    order = list(_SUBSYSTEMS)  # CS, CW, CA: the registry's own order, not the alphabet's
    for band in sorted(bands, key=lambda each: (order.index(each.first[:2]), each.first)):
        inside = [
            diagnostics[code] for code in sorted(diagnostics) if band.first <= code <= band.last
        ]
        if not inside:
            continue
        if band.first[:2] != prefix:
            prefix = band.first[:2]
            lines += ["", f"## {_SUBSYSTEMS[prefix]}"]
        lines += ["", f"### {band.first}–{band.last} · {band.concern}"]
        for entry in inside:
            lines += ["", f"#### {entry.code} — {entry.says}", ""]
            lines.append("*Refuses.*" if entry.refuses else "*Warns; never blocks.*")
            if entry.retired:
                lines += ["", f"**Retired** {entry.retired}"]
            lines += [
                "",
                f"**Fix.** {_text(entry.fix)}",
                "",
                f"**Why.** {_text(entry.explanation)}",
            ]
    return "\n".join(lines) + "\n"
