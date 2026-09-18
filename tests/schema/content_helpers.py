"""Content folders built in tmp_path for the tests of read_content, the graph rules and the command.

Tests never read the real content repository (R1).
"""

from pathlib import Path

from code_schema.content import read_content

REGIONS = "regions:\n  - id: sequence-analysis\n    name: Sequence analysis\n"


def node_yaml(title: str = "Salmon", level: str = "intermediate", links: str = "") -> str:
    """A valid node.yaml of six lines; links, when given, start on line 7."""
    return (
        f"schema: 1\ntitle: {title}\n"
        f"claim: {title} is a node written for this test.\n"
        f"region: sequence-analysis\nlevel: {level}\nminutes: 10\n{links}"
    )


def make_node(
    root: Path, folder: str, *, title: str = "Salmon", level: str = "intermediate", links: str = ""
) -> Path:
    path = root / folder
    path.mkdir(parents=True)
    (path / "node.yaml").write_text(node_yaml(title, level, links), encoding="utf-8")
    (path / "body.md").write_text("A body.\n", encoding="utf-8")
    return path


def link(kind: str, target: str, reason: str = "A reason written for the test.") -> str:
    return f"{kind}:\n  - node: {target}\n    reason: {reason}\n"


def content_root(tmp_path: Path) -> Path:
    (tmp_path / "regions.yaml").write_text(REGIONS, encoding="utf-8")
    return tmp_path


def rendered(root: Path) -> list[str]:
    return [str(p) for p in read_content(root).problems]
