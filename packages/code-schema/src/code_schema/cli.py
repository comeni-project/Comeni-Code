"""`code-schema validate <content root>` (spec M1P3.5): a thin wrapper around read_content.

GitHub annotations are a flag, not detected: detecting Actions means reading the environment, and
this package does not read the environment.
"""

from __future__ import annotations

import argparse
import sys
from collections.abc import Sequence
from pathlib import Path

from code_schema.content import Content, read_content
from code_schema.problems import Problem


def _plural(count: int, noun: str) -> str:
    return f"{count} {noun}" + ("" if count == 1 else "s")


def _escape_data(text: str) -> str:
    return text.replace("%", "%25").replace("\r", "%0D").replace("\n", "%0A")


def _escape_property(text: str) -> str:
    return _escape_data(text).replace(":", "%3A").replace(",", "%2C")


def github_line(problem: Problem) -> str:
    """A GitHub workflow command, so the problem shows on its line of the pull request's diff.

    A problem about a folder has no file to annotate and is printed without properties.
    """
    properties: list[str] = []
    if not problem.file.endswith("/"):
        properties.append(f"file={_escape_property(problem.file)}")
        if problem.line is not None:
            properties.append(f"line={problem.line}")
    head = "::error " + ",".join(properties) if properties else "::error"
    return f"{head}::{_escape_data(str(problem))}"


def summary(content: Content) -> str:
    """One closing line: how many nodes, and how many problems in how many of them."""
    nodes = _plural(len(content.folders), "node")
    if not content.problems:
        return f"{nodes}, no problems"
    affected = {
        node_id
        for node_id, folder in content.folders.items()
        if any(problem.file.startswith(f"{folder}/") for problem in content.problems)
    }
    problems = _plural(len(content.problems), "problem")
    if not affected:
        return f"{problems} outside the nodes ({nodes})"
    return f"{problems} in {len(affected)} of {nodes}"


def main(argv: Sequence[str] | None = None) -> int:
    """0 no problems, 1 problems, 2 the command was used wrongly."""
    parser = argparse.ArgumentParser(prog="code-schema", description="Comeni Code's node schema.")
    commands = parser.add_subparsers(dest="command", required=True)
    validate = commands.add_parser("validate", help="check every node in a content folder")
    validate.add_argument("root", type=Path, help="the content root, which holds regions.yaml")
    validate.add_argument("--format", choices=("text", "github"), default="text")
    arguments = parser.parse_args(argv)

    root: Path = arguments.root
    if not root.is_dir():
        print(f"code-schema: no such folder: {root}", file=sys.stderr)
        return 2
    content = read_content(root)
    for problem in content.problems:
        print(github_line(problem) if arguments.format == "github" else str(problem))
    print(summary(content))
    return 1 if content.problems else 0


def run() -> None:
    """The console script's entry point."""
    sys.exit(main())
