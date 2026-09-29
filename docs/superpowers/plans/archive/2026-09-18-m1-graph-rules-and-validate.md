# M1 part 3: graph rules and the validate command — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task by task, driven by one agent. Subagents are for review only (the operator's rule in CLAUDE.md). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `code-schema validate <root>` reads a whole content folder, checks every node and every
rule between nodes, and reports each problem on its line — plainly, or as GitHub annotations —
and `comeni-code-content`'s CI runs it, pinned to a commit.

**Architecture:** `content.py` finds the node folders, the region registry and the near misses, and
reads each node with part 1's `read_node`. `graph.py` checks what needs more than one node:
targets exist, *related* is symmetric, *goes deeper* never points down, and neither *needs* nor
*goes deeper* has a cycle (iterative Tarjan, one shortest ring per tangle). `cli.py` is the thin
command around `read_content`. Link lines come from reading each file's key lines again, so `Node`
stays a plain value.

**Tech Stack:** Python 3.14, PyYAML 6, argparse, pytest 9.1, mypy 2.3 strict, ruff 0.16, uv 0.11.

**Spec:** [`docs/superpowers/specs/2026-09-18-m1-graph-rules-and-validate-design.md`](../specs/2026-09-18-m1-graph-rules-and-validate-design.md)
(agreed 2026-09-18). Builds on parts 1 and 2 in `packages/code-schema/`.

## Global Constraints

- **The allowlist gains exactly `argparse` and `sys`**, in the task that first needs them (Task 4).
  No `os`, no `subprocess`, no `collections`.
- **Nothing raises in the library; no coercion; part 1's message shape.** The messages are the
  spec's tables (M1P3.3, M1P3.4, M1P3.5), character for character — fix the code, not the test.
- **Every run is deterministic**: folders in sorted path order, neighbours in sorted order.
- **Tests never read `../comeni-code-content`** (R1). Content folders are built in `tmp_path`.
- **The content repository pull request (Task 6) waits for the operator's explicit go-ahead.**
- Same command set, commit and PR rules as parts 1 and 2; merge only on a captured `exit=0`.

## Files

| Path | Responsibility |
|---|---|
| `packages/code-schema/src/code_schema/links.py` | gains `locate_links` — each link's line, from the file's text |
| `packages/code-schema/src/code_schema/content.py` | `Content`, `read_content`: discovery, near misses, unique ids, then the graph rules |
| `packages/code-schema/src/code_schema/graph.py` | `graph_problems`, `strongly_connected`, `shortest_ring` |
| `packages/code-schema/src/code_schema/cli.py` | `main`, `run`, the summary, the GitHub format |
| `packages/code-schema/pyproject.toml` | the `code-schema` console script |
| `tests/schema/test_content.py`, `test_graph.py`, `test_cli.py` | the tests; a `content_root` helper builds folders in `tmp_path` |
| `tests/guards/purity.py` | `argparse`, `sys` |
| `CLAUDE.md` | the command in *Commands* |
| `docs/notes/journal/2026-09-18-m1-part-3-graph-rules.md` | the record |

---

### Task 0: Land the spec and this plan

- [ ] `uv run pytest tests/repo && uv run ruff format --check .`; commit on `docs/m1-part-3`, PR,
  `exit=0`, merge; `git checkout main && git pull && git checkout -b feat/m1-validate`.

---

### Task 1: `read_content` — discovery, near misses, unique ids

**Files:** create `content.py`, `tests/schema/test_content.py`; modify `links.py` (add
`locate_links`), `tests/schema/test_links.py`.

**Interfaces:**
- Produces: `locate_links(node_yaml: str, *, file: str) -> dict[tuple[str, str], int]` — `(kind,
  target) → line of the link's node key`.
- Produces: `Content(nodes: dict[str, Node], folders: dict[str, str], regions: dict[str, Region],
  problems: tuple[Problem, ...])` — `folders` maps every discovered id to its folder path relative
  to the root (`"sequence-analysis/salmon"`), parsed or not; `nodes` only those that parsed.
  `Content.node_file(node_id) -> str` gives `"<folder>/node.yaml"`.
- Produces: `read_content(root: Path) -> Content`.

- [ ] **Step 1: A test helper and the failing tests**

```python
# tests/schema/test_content.py
"""Finding the nodes in a content folder (spec M1P3.3)."""

from pathlib import Path

from code_schema.content import read_content

REGIONS = "regions:\n  - id: sequence-analysis\n    name: Sequence analysis\n"


def node_yaml(title: str = "Salmon", level: str = "intermediate", links: str = "") -> str:
    return (
        f"schema: 1\ntitle: {title}\n"
        f"claim: {title} is a node written for this test.\n"
        f"region: sequence-analysis\nlevel: {level}\nminutes: 10\n{links}"
    )


def make_node(root: Path, folder: str, **kwargs: str) -> Path:
    path = root / folder
    path.mkdir(parents=True)
    (path / "node.yaml").write_text(node_yaml(**kwargs), encoding="utf-8")
    (path / "body.md").write_text("A body.\n", encoding="utf-8")
    return path


def content_root(tmp_path: Path) -> Path:
    (tmp_path / "regions.yaml").write_text(REGIONS, encoding="utf-8")
    return tmp_path


def rendered(root: Path) -> list[str]:
    return [str(p) for p in read_content(root).problems]


def test_an_empty_content_root_is_valid(tmp_path: Path) -> None:
    content = read_content(content_root(tmp_path))
    assert content.problems == () and content.nodes == {}


def test_nodes_are_found_at_any_depth_and_hidden_folders_are_skipped(tmp_path: Path) -> None:
    root = content_root(tmp_path)
    make_node(root, "salmon")
    make_node(root, "sequence-analysis/k-mers", title="K-mers")
    make_node(root, ".github/not-a-node")
    content = read_content(root)
    assert content.problems == ()
    assert sorted(content.nodes) == ["k-mers", "salmon"]
    assert content.folders["k-mers"] == "sequence-analysis/k-mers"
    assert content.node_file("k-mers") == "sequence-analysis/k-mers/node.yaml"


def test_regions_yaml_is_required(tmp_path: Path) -> None:
    assert rendered(tmp_path) == ["regions.yaml: the file is missing"]


def test_an_id_is_unique_across_the_tree(tmp_path: Path) -> None:
    root = content_root(tmp_path)
    make_node(root, "sequence-analysis/salmon")
    make_node(root, "tools/salmon")
    assert rendered(root) == [
        "tools/salmon/: salmon is already a node at sequence-analysis/salmon/ "
        "— ids are unique across the tree"
    ]


def test_a_near_miss_of_node_yaml_is_caught(tmp_path: Path) -> None:
    root = content_root(tmp_path)
    (root / "salmon").mkdir()
    (root / "salmon" / "node.yml").write_text(node_yaml(), encoding="utf-8")
    assert rendered(root) == ["salmon/: node.yml is not read — did you mean node.yaml?"]


def test_a_body_without_node_yaml_is_caught(tmp_path: Path) -> None:
    root = content_root(tmp_path)
    (root / "salmon").mkdir()
    (root / "salmon" / "body.md").write_text("A body.\n", encoding="utf-8")
    assert rendered(root) == ["salmon/: has body.md but no node.yaml — a node folder holds both"]


def test_the_content_root_is_not_a_node(tmp_path: Path) -> None:
    root = content_root(tmp_path)
    (root / "node.yaml").write_text(node_yaml(), encoding="utf-8")
    assert rendered(root) == [
        "node.yaml: the content root is not a node — node folders go inside it"
    ]


def test_a_nodes_data_folder_is_not_searched_for_near_misses(tmp_path: Path) -> None:
    root = content_root(tmp_path)
    folder = make_node(root, "salmon")
    (folder / "data").mkdir()
    (folder / "data" / "mode.yaml").write_text("x: 1\n", encoding="utf-8")
    assert rendered(root) == []


def test_node_problems_are_collected_with_paths_from_the_root(tmp_path: Path) -> None:
    root = content_root(tmp_path)
    make_node(root, "sequence-analysis/salmon", level="expert")
    assert rendered(root) == [
        'sequence-analysis/salmon/node.yaml:5: level: "expert" is not a level '
        "(first-steps, foundations, introductory, intermediate, advanced)"
    ]
```

and in `tests/schema/test_links.py`:

```python
from code_schema.links import locate_links


def test_locate_links_finds_each_links_line() -> None:
    text = GOOD + "related:\n  - node: kallisto\n    reason: kallisto differs.\n"
    assert locate_links(text, file="salmon/node.yaml") == {
        ("needs", "what-tpm-measures"): 2,
        ("needs", "selective-alignment"): 4,
        ("related", "kallisto"): 7,
    }
```

- [ ] **Step 2:** Run — FAIL (`No module named 'code_schema.content'`, `cannot import name 'locate_links'`).

- [ ] **Step 3: `locate_links`** (append to `links.py`; import `load_mapping` from `yaml_lines`)

```python
def locate_links(node_yaml: str, *, file: str) -> dict[tuple[str, str], int]:
    """The line of each link's `node` key, by kind and target, for messages about links.

    Lines are not stored on Node: a node is a value the round-trip laws compare, and where it
    was written is not part of it.
    """
    data, lines, _ = load_mapping(node_yaml, file=file)
    found: dict[tuple[str, str], int] = {}
    if data is None:
        return found
    for kind in LINK_FIELDS:
        entries = data.get(kind)
        if not isinstance(entries, list):
            continue
        for entry in entries:
            if not isinstance(entry, dict):
                continue
            target, line = entry.get("node"), lines.of(entry, "node")
            if isinstance(target, str) and line is not None:
                found.setdefault((kind, target), line)
    return found
```

- [ ] **Step 4: `content.py`**

```python
"""A whole content folder: its nodes, its regions, and the rules between nodes (spec M1P3.3).

`read_content` is what the validate command runs and what the index loader (part 5) will call,
so the two can never disagree about what a valid node is.
"""

from __future__ import annotations

import difflib
from dataclasses import dataclass
from pathlib import Path

from code_schema.graph import graph_problems
from code_schema.links import locate_links
from code_schema.node import BODY_FILE, NODE_FILE, Node, read_node
from code_schema.problems import Problem
from code_schema.regions import Region, read_regions


@dataclass(frozen=True)
class Content:
    nodes: dict[str, Node]
    folders: dict[str, str]
    regions: dict[str, Region]
    problems: tuple[Problem, ...]

    def node_file(self, node_id: str) -> str:
        return f"{self.folders[node_id]}/{NODE_FILE}"


def _hidden(path: Path, root: Path) -> bool:
    return any(part.startswith(".") for part in path.relative_to(root).parts)


def _near_misses(root: Path, node_folders: list[Path]) -> list[Problem]:
    """Folders that look like nodes but are not read as one."""
    problems: list[Problem] = []
    inside_a_node = tuple(node_folders)
    for folder in sorted([root, *(p for p in root.rglob("*") if p.is_dir())]):
        if _hidden(folder, root) or (folder / NODE_FILE).is_file():
            continue
        if any(node in folder.parents for node in inside_a_node):
            continue  # a node's own data/ folder
        where = "./" if folder == root else f"{folder.relative_to(root).as_posix()}/"
        names = sorted(p.name for p in folder.iterdir() if p.is_file())
        if BODY_FILE in names and folder != root:
            problems.append(
                Problem(
                    file=where,
                    message=f"has {BODY_FILE} but no {NODE_FILE} — a node folder holds both",
                )
            )
        for name in names:
            if name != NODE_FILE and difflib.get_close_matches(name, [NODE_FILE], n=1, cutoff=0.8):
                problems.append(
                    Problem(file=where, message=f"{name} is not read — did you mean {NODE_FILE}?")
                )
    return problems


def read_content(root: Path) -> Content:
    """Every node under `root`, the regions, and every problem. Never raises."""
    regions, problems = read_regions(root)
    if (root / NODE_FILE).is_file():
        problems.append(
            Problem(
                file=NODE_FILE, message="the content root is not a node — node folders go inside it"
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
        node, node_problems = read_node(folder, regions=regions, root=root)
        problems += node_problems
        if node is not None:
            nodes[node.id] = node
            text = (folder / NODE_FILE).read_text(encoding="utf-8", newline="")
            link_lines[node.id] = locate_links(text, file=f"{relative}/{NODE_FILE}")

    problems += graph_problems(nodes, folders, link_lines)
    return Content(
        nodes=nodes,
        folders=folders,
        regions=regions,
        problems=tuple(sorted(problems, key=Problem.sort_key)),
    )
```

Create `graph.py` now with only a stub so Task 1 runs; Task 2 fills it:

```python
"""The rules that need more than one node (spec M1P3.4)."""

from __future__ import annotations

from code_schema.node import Node
from code_schema.problems import Problem


def graph_problems(
    nodes: dict[str, Node],
    folders: dict[str, str],
    link_lines: dict[str, dict[tuple[str, str], int]],
) -> list[Problem]:
    return []
```

- [ ] **Step 5:** Full check — PASS. **Step 6:** Commit —
  `feat(schema): read a whole content folder` (body: near misses and why; walking the filesystem,
  not git; unique ids in sorted order; `locate_links` keeps lines off `Node`).

---

### Task 2: Targets, symmetry, levels

**Files:** modify `graph.py`; create `tests/schema/test_graph.py` (reusing the helpers from
`test_content.py` — move `node_yaml`, `make_node`, `content_root`, `rendered` into
`tests/schema/content_helpers.py` and import them from both).

- [ ] **Step 1: Failing tests**

```python
# tests/schema/test_graph.py
"""The rules between nodes (spec M1P3.4)."""

from pathlib import Path

from content_helpers import content_root, make_node, rendered

KMERS_NEED = "needs:\n  - node: kmers\n    reason: Salmon indexes k-mers.\n"


def link(kind: str, target: str, reason: str = "A reason written for the test.") -> str:
    return f"{kind}:\n  - node: {target}\n    reason: {reason}\n"


def test_a_missing_target_gets_the_closest_id(tmp_path: Path) -> None:
    root = content_root(tmp_path)
    make_node(root, "k-mers", title="K-mers")
    make_node(root, "salmon", links=KMERS_NEED)
    assert rendered(root) == [
        "salmon/node.yaml:8: needs: kmers is not a node — closest is `k-mers`"
    ]


def test_a_missing_target_with_nothing_close_gets_no_guess(tmp_path: Path) -> None:
    root = content_root(tmp_path)
    make_node(root, "salmon", links=link("needs", "genomics"))
    assert rendered(root) == ["salmon/node.yaml:8: needs: genomics is not a node"]


def test_a_link_to_a_broken_node_is_not_a_missing_target(tmp_path: Path) -> None:
    root = content_root(tmp_path)
    make_node(root, "k-mers", level="expert")
    make_node(root, "salmon", links=link("needs", "k-mers"))
    problems = rendered(root)
    assert len(problems) == 1 and problems[0].startswith("k-mers/node.yaml:5: level:")


def test_related_must_be_written_on_both_nodes(tmp_path: Path) -> None:
    root = content_root(tmp_path)
    make_node(root, "kallisto", title="Kallisto")
    make_node(root, "salmon", links=link("related", "kallisto"))
    assert rendered(root) == [
        "salmon/node.yaml:8: related: kallisto does not list salmon back "
        "— add it to kallisto/node.yaml"
    ]


def test_related_on_both_nodes_is_fine(tmp_path: Path) -> None:
    root = content_root(tmp_path)
    make_node(root, "kallisto", title="Kallisto", links=link("related", "salmon"))
    make_node(root, "salmon", links=link("related", "kallisto"))
    assert rendered(root) == []


def test_goes_deeper_never_points_down(tmp_path: Path) -> None:
    root = content_root(tmp_path)
    make_node(root, "what-tpm-measures", title="TPM", level="introductory")
    make_node(root, "salmon", links=link("goes-deeper", "what-tpm-measures"))
    assert rendered(root) == [
        "salmon/node.yaml:8: goes-deeper: what-tpm-measures is introductory, "
        "below salmon (intermediate)"
    ]


def test_goes_deeper_at_the_same_level_is_fine(tmp_path: Path) -> None:
    root = content_root(tmp_path)
    make_node(root, "pufferfish-index", title="Pufferfish")
    make_node(root, "salmon", links=link("goes-deeper", "pufferfish-index"))
    assert rendered(root) == []
```

- [ ] **Step 2:** Run — FAIL. **Step 3: Implement** in `graph.py`:

```python
import difflib

from code_schema.links import Link
from code_schema.node import Level, Node
from code_schema.problems import Problem

_ORDER = {level: index for index, level in enumerate(Level)}


def _links(node: Node) -> list[tuple[str, Link]]:
    return [
        *(("needs", link) for link in node.needs),
        *(("goes-deeper", link) for link in node.goes_deeper),
        *(("related", link) for link in node.related),
    ]


def graph_problems(nodes, folders, link_lines):  # typed as in Task 1
    problems: list[Problem] = []
    ids = sorted(folders)

    def at(node: Node, kind: str, target: str, message: str) -> Problem:
        return Problem(
            file=f"{folders[node.id]}/node.yaml",
            field=kind,
            line=link_lines.get(node.id, {}).get((kind, target)),
            message=message,
        )

    for node in (nodes[i] for i in sorted(nodes)):
        for kind, link in _links(node):
            target = link.node
            if target not in folders:
                message = f"{target} is not a node"
                if close := difflib.get_close_matches(target, ids, n=1):
                    message += f" — closest is `{close[0]}`"
                problems.append(at(node, kind, target, message))
                continue
            other = nodes.get(target)
            if other is None:
                continue  # a broken node: its own problems are already reported
            if kind == "related" and node.id not in {peer.node for peer in other.related}:
                problems.append(
                    at(
                        node,
                        kind,
                        target,
                        f"{target} does not list {node.id} back — add it to {folders[target]}/node.yaml",
                    )
                )
            if kind == "goes-deeper" and _ORDER[other.level] < _ORDER[node.level]:
                problems.append(
                    at(
                        node,
                        kind,
                        target,
                        f"{target} is {other.level}, below {node.id} ({node.level})",
                    )
                )
    problems += _cycles(nodes, folders, link_lines)  # Task 3; return [] until then
    return problems
```

- [ ] **Step 4:** Full check — PASS. **Step 5:** Commit —
  `feat(schema): check links between nodes` (body: each message on a line that exists; broken
  nodes do not cascade).

---

### Task 3: Cycles

**Files:** modify `graph.py`, `tests/schema/test_graph.py`.

- [ ] **Step 1: Failing tests**

```python
from code_schema.graph import shortest_ring, strongly_connected


def test_strongly_connected_groups_are_found_without_recursion() -> None:
    chain = {f"n{i}": [f"n{i + 1}"] for i in range(5000)}
    chain["n5000"] = ["n0"]
    groups = strongly_connected(chain)
    assert len(groups) == 1 and len(groups[0]) == 5001


def test_nodes_off_a_cycle_are_their_own_groups() -> None:
    assert sorted(map(tuple, strongly_connected({"a": ["b"], "b": ["a"], "c": ["a"]}))) == [
        ("a", "b"),
        ("c",),
    ]


def test_the_shortest_ring_through_a_node() -> None:
    graph = {"a": ["b", "d"], "b": ["c"], "c": ["a"], "d": ["a"]}
    assert shortest_ring(graph, "a", {"a", "b", "c", "d"}) == ["a", "d", "a"]


def test_a_needs_cycle_is_one_message_with_the_whole_ring(tmp_path: Path) -> None:
    root = content_root(tmp_path)
    make_node(root, "de-bruijn-graphs", title="DBG", links=link("needs", "k-mers"))
    make_node(root, "k-mers", title="K-mers", links=link("needs", "hashing"))
    make_node(root, "hashing", title="Hashing", links=link("needs", "de-bruijn-graphs"))
    assert rendered(root) == [
        "de-bruijn-graphs/node.yaml:8: needs: a cycle — "
        "de-bruijn-graphs → k-mers → hashing → de-bruijn-graphs"
    ]


def test_a_tangle_says_how_many_more_nodes_are_caught(tmp_path: Path) -> None:
    root = content_root(tmp_path)
    make_node(root, "a-node", title="A", links=link("needs", "b-node"))
    make_node(
        root,
        "b-node",
        title="B",
        links=link("needs", "a-node") + "  - node: c-node\n    reason: C.\n",
    )
    make_node(root, "c-node", title="C", links=link("needs", "b-node"))
    assert rendered(root) == [
        "a-node/node.yaml:8: needs: a cycle — a-node → b-node → a-node, "
        "and 1 more node is caught in it"
    ]


def test_a_goes_deeper_cycle_is_refused_too(tmp_path: Path) -> None:
    root = content_root(tmp_path)
    make_node(root, "a-node", title="A", links=link("goes-deeper", "b-node"))
    make_node(root, "b-node", title="B", links=link("goes-deeper", "a-node"))
    assert rendered(root) == ["a-node/node.yaml:8: goes-deeper: a cycle — a-node → b-node → a-node"]
```

- [ ] **Step 2:** Run — FAIL. **Step 3: Implement**

```python
def strongly_connected(graph: dict[str, list[str]]) -> list[list[str]]:
    """Tarjan's algorithm, iteratively: a deep chain cannot hit the recursion limit."""
    index: dict[str, int] = {}
    low: dict[str, int] = {}
    stack: list[str] = []
    on_stack: set[str] = set()
    groups: list[list[str]] = []
    counter = 0
    for start in sorted(graph):
        if start in index:
            continue
        index[start] = low[start] = counter
        counter += 1
        stack.append(start)
        on_stack.add(start)
        work = [(start, iter(sorted(graph.get(start, []))))]
        while work:
            node, successors = work[-1]
            descended = False
            for successor in successors:
                if successor not in index:
                    index[successor] = low[successor] = counter
                    counter += 1
                    stack.append(successor)
                    on_stack.add(successor)
                    work.append((successor, iter(sorted(graph.get(successor, [])))))
                    descended = True
                    break
                if successor in on_stack:
                    low[node] = min(low[node], index[successor])
            if descended:
                continue
            work.pop()
            if work:
                parent = work[-1][0]
                low[parent] = min(low[parent], low[node])
            if low[node] == index[node]:
                group: list[str] = []
                while True:
                    member = stack.pop()
                    on_stack.discard(member)
                    group.append(member)
                    if member == node:
                        break
                groups.append(sorted(group))
    return groups


def shortest_ring(graph: dict[str, list[str]], start: str, members: set[str]) -> list[str]:
    """The shortest cycle from `start` back to itself inside `members`; sorted neighbours, so stable."""
    parent: dict[str, str] = {}
    frontier = [start]
    seen = {start}
    while frontier:
        following: list[str] = []
        for node in frontier:
            for successor in sorted(graph.get(node, [])):
                if successor not in members:
                    continue
                if successor == start:
                    chain = [node]
                    while chain[-1] != start:
                        chain.append(parent[chain[-1]])
                    return [*reversed(chain), start]
                if successor not in seen:
                    seen.add(successor)
                    parent[successor] = node
                    following.append(successor)
        frontier = following
    return [start]


def _cycles(nodes, folders, link_lines) -> list[Problem]:
    problems: list[Problem] = []
    for kind, attribute in (("needs", "needs"), ("goes-deeper", "goes_deeper")):
        graph = {
            node_id: [link.node for link in getattr(node, attribute) if link.node in nodes]
            for node_id, node in nodes.items()
        }
        for group in strongly_connected(graph):
            if len(group) < 2:
                continue
            start = group[0]
            ring = shortest_ring(graph, start, set(group))
            message = f"a cycle — {' → '.join(ring)}"
            if (more := len(group) - (len(ring) - 1)) > 0:
                noun, verb = ("node", "is") if more == 1 else ("nodes", "are")
                message += f", and {more} more {noun} {verb} caught in it"
            problems.append(
                Problem(
                    file=f"{folders[start]}/node.yaml",
                    field=kind,
                    line=link_lines.get(start, {}).get((kind, ring[1])),
                    message=message,
                )
            )
    return problems
```

- [ ] **Step 4:** Full check — PASS. **Step 5:** Commit — `feat(schema): refuse cycles in needs and goes-deeper`.

---

### Task 4: The command

**Files:** create `cli.py`, `tests/schema/test_cli.py`; modify `pyproject.toml` (package),
`tests/guards/purity.py` (`argparse`, `sys`).

- [ ] **Step 1: Failing tests**

```python
# tests/schema/test_cli.py
"""code-schema validate: output, summary, exit codes (spec M1P3.5)."""

from pathlib import Path

import pytest
from content_helpers import content_root, make_node

from code_schema.cli import github_line, main
from code_schema.problems import Problem


def test_clean_content_exits_0_with_a_summary(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    root = content_root(tmp_path)
    make_node(root, "salmon")
    assert main(["validate", str(root)]) == 0
    assert capsys.readouterr().out == "1 node, no problems\n"


def test_problems_exit_1_and_are_counted(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    root = content_root(tmp_path)
    make_node(root, "salmon", level="expert")
    make_node(root, "k-mers", title="K-mers")
    assert main(["validate", str(root)]) == 1
    out = capsys.readouterr().out.splitlines()
    assert out[-1] == "1 problem in 1 of 2 nodes"


def test_a_problem_outside_the_nodes_is_said_so(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    root = content_root(tmp_path)
    make_node(root, "salmon")
    (root / "stray").mkdir()
    (root / "stray" / "body.md").write_text("A body.\n", encoding="utf-8")
    assert main(["validate", str(root)]) == 1
    assert capsys.readouterr().out.splitlines()[-1] == "1 problem outside the nodes (1 node)"


def test_a_missing_root_exits_2(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    assert main(["validate", str(tmp_path / "nowhere")]) == 2
    assert "no such folder" in capsys.readouterr().err


def test_github_lines_are_escaped() -> None:
    problem = Problem(file="a,b/node.yaml", line=3, field="needs", message="50% done\nnext")
    assert github_line(problem) == (
        "::error file=a%2Cb/node.yaml,line=3::a,b/node.yaml:3: needs: 50%25 done%0Anext"
    )


def test_a_folder_problem_has_no_file_property() -> None:
    assert github_line(Problem(file="salmon/", message="body.md is missing")) == (
        "::error::salmon/: body.md is missing"
    )
```

`test_cli.py` imports `content_helpers` like `test_graph.py`.

- [ ] **Step 2:** Run — FAIL. **Step 3: `cli.py`**

```python
"""`code-schema validate <content root>` (spec M1P3.5). A thin wrapper around read_content."""

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
    """A GitHub workflow command, so the problem shows on its line of the pull request's diff."""
    properties: list[str] = []
    if not problem.file.endswith("/"):
        properties.append(f"file={_escape_property(problem.file)}")
        if problem.line is not None:
            properties.append(f"line={problem.line}")
    head = "::error " + ",".join(properties) if properties else "::error"
    return f"{head}::{_escape_data(str(problem))}"


def summary(content: Content) -> str:
    nodes = _plural(len(content.folders), "node")
    if not content.problems:
        return f"{nodes}, no problems"
    affected = {
        node_id
        for node_id, folder in content.folders.items()
        for problem in content.problems
        if problem.file.startswith(f"{folder}/")
    }
    problems = _plural(len(content.problems), "problem")
    if not affected:
        return f"{problems} outside the nodes ({nodes})"
    return f"{problems} in {len(affected)} of {nodes}"


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="code-schema", description="Comeni Code's node schema.")
    commands = parser.add_subparsers(dest="command", required=True)
    validate = commands.add_parser("validate", help="check every node in a content folder")
    validate.add_argument("root", type=Path, help="the content root, holding regions.yaml")
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
```

`packages/code-schema/pyproject.toml` gains:

```toml
[project.scripts]
code-schema = "code_schema.cli:run"
```

The allowlist gains `argparse` and `sys`.

- [ ] **Step 4:** `uv sync --locked --all-packages` (the script is installed), then
  `uv run code-schema validate <a tmp content folder>` by hand, and
  `uvx --from ./packages/code-schema code-schema validate <the same folder>` — both print the
  summary. Full check — PASS.
- [ ] **Step 5:** Commit — `feat(schema): the code-schema validate command`.

---

### Task 5: Public API, docs, journal, PR

- [ ] `__init__.py` exports `Content` and `read_content`; `test_public_api.py` expects them.
- [ ] CLAUDE.md *Commands* gains `uv run code-schema validate ../comeni-code-content   # the node format, as content CI checks it`.
- [ ] Journal entry, README box and Entries row; full command set; PR; `exit=0`; merge.
- [ ] **Prove the install route** with the merged SHA:
  `uvx --from "git+https://github.com/comeni-project/Comeni-Code@<sha>#subdirectory=packages/code-schema" code-schema validate <scratch folder>`.

---

### Task 6: The content repository — only with the operator's go-ahead

- [ ] Ask the operator. On yes: branch in `comeni-code-content`; add `regions.yaml`
  (`molecular-biology`, `sequencing`, `sequence-analysis`, `statistics`); add the step after the
  hygiene checks in `.github/workflows/validate.yml`, pinned to the merged SHA, with
  `--format github`; update the README; run the pinned command locally first.
- [ ] PR; auto-merge; `exit=0`; confirm merged. Record it in the journal entry.

---

## Self-review against the spec

| Spec | Task |
|---|---|
| M1P3.2 module, console script, pinned install | 4, 5, 6 |
| M1P3.3 discovery, near misses, empty root, root not a node | 1 |
| M1P3.4 targets, symmetry, levels, broken nodes | 2 |
| M1P3.4 cycles, iterative Tarjan, one ring per tangle | 3 |
| M1P3.5 summary, GitHub format and escaping, exit codes, allowlist | 4 |
| M1P3.6 content repository pull request | 6 |
| M1P3.1 done-when | 5, 6 |
