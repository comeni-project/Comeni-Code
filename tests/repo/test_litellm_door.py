"""Models are reached through one door (M5.1 spec, M5G.1): only `code_api.ai` imports LiteLLM."""

import ast
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DOOR = ROOT / "apps" / "api" / "src" / "code_api" / "ai"
# Tests may name LiteLLM: one pins the private methods the ChatGPT sign-in drives (M5G.4).
TESTS = ROOT / "apps" / "api" / "tests"
SOURCES = [ROOT / "apps", ROOT / "packages"]


def importers_of(module: str) -> list[Path]:
    found: list[Path] = []
    for source in SOURCES:
        for path in sorted(source.rglob("*.py")):
            if ".venv" in path.parts or "node_modules" in path.parts:
                continue
            tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
            for node in ast.walk(tree):
                names = (
                    [alias.name for alias in node.names]
                    if isinstance(node, ast.Import)
                    else [node.module or ""]
                    if isinstance(node, ast.ImportFrom) and node.level == 0
                    else []
                )
                if any(name == module or name.startswith(f"{module}.") for name in names):
                    found.append(path)
                    break
    return found


def test_only_the_ai_app_imports_litellm() -> None:
    outside = [
        path
        for path in importers_of("litellm")
        if DOOR not in path.parents and TESTS not in path.parents
    ]
    assert outside == [], f"LiteLLM imported outside code_api.ai: {outside}"
