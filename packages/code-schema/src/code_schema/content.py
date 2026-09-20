"""A whole content folder: its nodes, its regions, and the rules between nodes (spec M1P3.3).

`read_content` is what the validate command runs and what the index loader (part 5) will call,
so the two can never disagree about what a valid node is. It walks the filesystem, not git: the
pure package cannot run git, and in CI the checkout is exactly the tracked files.
"""

from __future__ import annotations

import difflib
from dataclasses import dataclass
from pathlib import Path

from code_schema.graph import graph_problems
from code_schema.links import locate_links
from code_schema.node import BODY_FILE, NODE_FILE, Node, read_node
from code_schema.problems import Problem
from code_schema.providers import REGISTRY as PROVIDER_REGISTRY
from code_schema.providers import Provider, read_providers
from code_schema.regions import Region, read_regions


@dataclass(frozen=True)
class Content:
    """Every node that parsed, every node folder found (parsed or not), regions and problems."""

    nodes: dict[str, Node]
    folders: dict[str, str]
    regions: dict[str, Region]
    problems: tuple[Problem, ...]
    providers: dict[str, Provider]

    def node_file(self, node_id: str) -> str:
        return f"{self.folders[node_id]}/{NODE_FILE}"


def _hidden(path: Path, root: Path) -> bool:
    return any(part.startswith(".") for part in path.relative_to(root).parts)


def _near_misses(root: Path, node_folders: list[Path]) -> list[Problem]:
    """Folders that look like a node but are not read as one — otherwise they fail silently."""
    problems: list[Problem] = []
    for folder in sorted([root, *(path for path in root.rglob("*") if path.is_dir())]):
        if _hidden(folder, root) or (folder / NODE_FILE).is_file():
            continue
        if any(node in folder.parents for node in node_folders):
            continue  # inside a node, such as its data/ folder
        where = "./" if folder == root else f"{folder.relative_to(root).as_posix()}/"
        names = sorted(path.name for path in folder.iterdir() if path.is_file())
        if BODY_FILE in names and folder != root:
            problems.append(
                Problem(
                    file=where,
                    message=f"has {BODY_FILE} but no {NODE_FILE} — a node folder holds both",
                )
            )
        for name in names:
            if difflib.get_close_matches(name, [NODE_FILE], n=1, cutoff=0.8):
                problems.append(
                    Problem(file=where, message=f"{name} is not read — did you mean {NODE_FILE}?")
                )
    return problems


def read_content(root: Path) -> Content:
    """Every node under `root`, the regions, and every problem, sorted. Never raises."""
    regions, problems = read_regions(root)
    # None means there is no registry, which only a resource makes a problem (M3P1.2).
    providers, provider_problems = read_providers(root)
    problems += provider_problems
    if (root / NODE_FILE).is_file():
        problems.append(
            Problem(
                file=NODE_FILE,
                message="the content root is not a node — node folders go inside it",
            )
        )

    node_folders = sorted(
        path.parent
        for path in root.rglob(NODE_FILE)
        if path.parent != root and not _hidden(path.parent, root)
    )
    problems += _near_misses(root, node_folders)

    nodes: dict[str, Node] = {}
    folders: dict[str, str] = {}
    link_lines: dict[str, dict[tuple[str, str], int]] = {}
    for folder in node_folders:
        relative = folder.relative_to(root).as_posix()
        if folder.name in folders:
            # Sorted path order, so the same folder keeps the id on every run.
            problems.append(
                Problem(
                    file=f"{relative}/",
                    message=(
                        f"{folder.name} is already a node at {folders[folder.name]}/ "
                        "— ids are unique across the tree"
                    ),
                )
            )
            continue
        folders[folder.name] = relative
        node, node_problems = read_node(folder, regions=regions, root=root, providers=providers)
        problems += node_problems
        if node is not None:
            nodes[node.id] = node
            text = (folder / NODE_FILE).read_text(encoding="utf-8", newline="")
            link_lines[node.id] = locate_links(text, file=f"{relative}/{NODE_FILE}")

    problems += graph_problems(nodes, folders, link_lines)
    if providers is None:
        citing = sorted(node.id for node in nodes.values() if node.resources)
        if citing:
            problems.append(
                Problem(
                    file=PROVIDER_REGISTRY,
                    message=(
                        f"the file is missing, and {folders[citing[0]]}/{NODE_FILE} "
                        "cites a provider"
                    ),
                )
            )
    return Content(
        nodes=nodes,
        folders=folders,
        regions=regions,
        problems=tuple(sorted(problems, key=Problem.sort_key)),
        providers={} if providers is None else providers,
    )
