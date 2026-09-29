"""Every backticked repository path in the first-read files exists (docs compaction spec, C3).

`test_links.py` checks Markdown links, and `CLAUDE.md` cites paths in backticks, where a renamed
or archived file goes unseen. Ported from Labs' `tools/check_doc_paths.py`.

**Only tokens that look like paths**, with Labs' exclusions: a token with a space is a command
line, `*` or `{}` is a glob, `<>` is a template, `$` or `^` is shell or a git revision, `://` is a
URL, a leading `/`, `~` or `-` is a machine path or a flag, a leading `..` is a sibling checkout,
and `…` marks a placeholder (`feat/…`). A bare filename is live if the repository tracks a file by
that name anywhere, and a module path (`code_api/config/env.py`) if it is under a package's or an
app's `src/`.
"""

import re
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
FILES = ["CLAUDE.md", "docs/notes/now.md"]

_TICK = re.compile(r"`([^`\n]+)`")
_LINE_REF = re.compile(r":\d+(-\d+)?$")
_EXT = (".md", ".py", ".yml", ".yaml", ".toml", ".ts", ".tsx", ".json", ".html", ".sh", ".mjs")


def looks_like_path(token: str) -> bool:
    if any(c in token for c in " *{}<>$^…") or "://" in token:
        return False
    if token.startswith(("-", "~", "/", "..")):
        return False
    if re.fullmatch(r"(\.[A-Za-z0-9]+)+", token):
        return False  # a bare extension names a kind of file, not a file
    bare = _LINE_REF.sub("", token)
    return "/" in bare or bare.endswith(_EXT)


def tracked_names(root: Path) -> set[str]:
    listed = subprocess.run(
        ["git", "ls-files"], cwd=root, capture_output=True, text=True, check=True
    ).stdout
    return {Path(line).name for line in listed.splitlines()}


def exists(token: str, root: Path, names: set[str]) -> bool:
    bare = _LINE_REF.sub("", token).rstrip("/")
    if "/" not in bare:
        return bare in names or (root / bare).exists()
    sources = [*root.glob("packages/*/src"), *root.glob("apps/*/src")]
    return (root / bare).exists() or any((src / bare).exists() for src in sources)


def dead_paths(text: str, root: Path, names: set[str]) -> list[tuple[int, str]]:
    dead = []
    for number, line in enumerate(text.splitlines(), start=1):
        for token in _TICK.findall(line):
            if looks_like_path(token) and not exists(token, root, names):
                dead.append((number, token))
    return dead


@pytest.mark.parametrize("name", FILES)
def test_every_backticked_path_exists(name: str) -> None:
    text = (ROOT / name).read_text(encoding="utf-8")
    assert dead_paths(text, ROOT, tracked_names(ROOT)) == [], (
        "Fix the path, or cite a removed file as `git show <commit>:<path>`."
    )


def test_only_path_shaped_tokens_are_checked() -> None:
    kept = ["docs/notes/now.md", "CLAUDE.md", "apps/web/src/", "packages/a.py:12"]
    dropped = ["uv run pytest", "*.md", "<id>", "$HOME/x", "https://x.org/a", "/usr/bin/node-24"]
    dropped += ["~/.local/node24/bin", "--known", ".md", ".dc.html", "known", "code_weaver.find"]
    dropped += ["../comeni-code-content", "feat/…"]
    assert [token for token in kept + dropped if looks_like_path(token)] == kept


def test_a_missing_path_is_reported_with_its_line(tmp_path: Path) -> None:
    (tmp_path / "docs").mkdir()
    (tmp_path / "docs" / "here.md").write_text("")
    text = "`docs/here.md`\n`docs/gone.md` and `here.md` and `elsewhere.md`\n"
    assert dead_paths(text, tmp_path, {"here.md"}) == [(2, "docs/gone.md"), (2, "elsewhere.md")]


def test_a_module_path_resolves_under_a_source_folder(tmp_path: Path) -> None:
    (tmp_path / "apps" / "api" / "src" / "code_api").mkdir(parents=True)
    (tmp_path / "apps" / "api" / "src" / "code_api" / "env.py").write_text("")
    assert dead_paths("`code_api/env.py` `code_api/gone.py`", tmp_path, set()) == [
        (1, "code_api/gone.py")
    ]
