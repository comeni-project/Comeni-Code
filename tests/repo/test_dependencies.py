"""Every workspace package an app imports is declared as its dependency.

The dev sync installs the whole workspace, so a missing declaration passes every test and fails
only when an image is built: `uv sync --package code-api` installs what `apps/api` declares, and
nothing more. That is how `code-weaver` was missing from the API image in M2 part 4.
"""

import ast
import tomllib
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
PACKAGES = {path.name for path in (ROOT / "packages").iterdir() if path.is_dir()}
APPS = [ROOT / "apps" / "api"]


def imported_packages(source: Path) -> set[str]:
    """The workspace packages imported anywhere under `source`, by their distribution names."""
    found: set[str] = set()
    for path in sorted(source.rglob("*.py")):
        for node in ast.walk(ast.parse(path.read_text(encoding="utf-8"), filename=str(path))):
            names: list[str] = []
            if isinstance(node, ast.Import):
                names = [alias.name for alias in node.names]
            elif isinstance(node, ast.ImportFrom) and node.level == 0 and node.module:
                names = [node.module]
            for name in names:
                distribution = name.split(".")[0].replace("_", "-")
                if distribution in PACKAGES:
                    found.add(distribution)
    return found


@pytest.mark.parametrize("app", APPS, ids=lambda app: app.name)
def test_an_app_declares_every_workspace_package_it_imports(app: Path) -> None:
    manifest = tomllib.loads((app / "pyproject.toml").read_text(encoding="utf-8"))
    dependencies = manifest["project"]["dependencies"]
    declared = {name.split(">")[0].split("[")[0].strip() for name in dependencies}
    sources = manifest.get("tool", {}).get("uv", {}).get("sources", {})
    missing = sorted(imported_packages(app / "src") - declared)
    assert not missing, f"{app.name} imports {missing} without declaring them"
    assert all(sources.get(name, {}).get("workspace") for name in imported_packages(app / "src"))
