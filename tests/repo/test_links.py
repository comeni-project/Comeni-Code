"""Relative Markdown links point at files that exist (spec P1.5).

External URLs and `#anchor` fragments are not checked: no network, no flakes.
"""

import re
import subprocess
from pathlib import Path
from urllib.parse import unquote

import pytest

ROOT = Path(__file__).resolve().parents[2]

_FENCE = re.compile(r"^(```|~~~).*?^\1", re.MULTILINE | re.DOTALL)
_CODE_SPAN = re.compile(r"`[^`\n]*`")
_LINK = re.compile(r"\]\(([^)\s]+)(?:\s+\"[^\"]*\")?\)")
_EXTERNAL = re.compile(r"^[a-zA-Z][a-zA-Z0-9+.-]*:")


def link_targets(text: str) -> list[str]:
    """Relative link targets in Markdown, without fragments, outside code."""
    text = _CODE_SPAN.sub("", _FENCE.sub("", text))
    targets = []
    for match in _LINK.finditer(text):
        target = match.group(1)
        if _EXTERNAL.match(target) or target.startswith("#"):
            continue
        targets.append(unquote(target.split("#", 1)[0]))
    return targets


def broken_links(path: Path, root: Path) -> list[str]:
    missing = []
    for target in link_targets(path.read_text()):
        base = root if target.startswith("/") else path.parent
        if not (base / target.lstrip("/")).exists():
            missing.append(target)
    return missing


def tracked_markdown() -> list[Path]:
    listed = subprocess.run(
        ["git", "ls-files", "-z", "*.md"], cwd=ROOT, capture_output=True, text=True, check=True
    ).stdout
    return [ROOT / name for name in listed.split("\0") if name]


def test_there_is_markdown_to_check() -> None:
    assert len(tracked_markdown()) > 5


@pytest.mark.parametrize("path", tracked_markdown(), ids=lambda p: str(p.relative_to(ROOT)))
def test_relative_links_resolve(path: Path) -> None:
    assert broken_links(path, ROOT) == []


def test_link_targets_skip_urls_anchors_and_code() -> None:
    text = (
        "[a](docs/a.md) [b](https://x.org/y) [c](#top) [d](b.md#part) "
        '[e](mailto:x@y.z) `[f](f.md)` [h](h%20i.md "title")\n'
        "```\n[i](i.md)\n```\n"
    )
    assert link_targets(text) == ["docs/a.md", "b.md", "h i.md"]


def test_broken_links_reports_missing_and_accepts_present(tmp_path: Path) -> None:
    (tmp_path / "docs").mkdir()
    (tmp_path / "docs" / "there.md").write_text("")
    page = tmp_path / "docs" / "page.md"
    page.write_text("[ok](there.md) [dir](../docs) [root](/docs/there.md) [gone](gone.md)")
    assert broken_links(page, tmp_path) == ["gone.md"]
