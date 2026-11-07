"""A node's problem (M6.7 spec, M6PR.3–M6PR.5): problem.yaml, its one block, the 20-seed
self-test run when the folder is read, and CS1106–CS1111."""

from pathlib import Path

import pytest
from schema.content_helpers import node_yaml

from code_schema.node import Node, parse_node_files
from code_schema.problems import Problem
from code_schema.writer import write_node_folder

PROBLEM = """title: Construct a de Bruijn graph
rung: 3
statement: |
  Given a set of reads and an integer k, return the edges of the de Bruijn graph that uses
  k-mers as nodes.
given: k on the first line, then the reads, one per line
return: edges as "A -> B", one per line, sorted, no duplicates
kit: de-bruijn-edges
params: {k: 3, genome: 400, read: 40, coverage: 10, errors: 0}
sample: {seed: 1, params: {k: 3, genome: 7, read: 5, coverage: 2, errors: 0}}
hints:
  - The same k-mer can come from many reads.
mistakes:
  duplicates: Every edge appears once
rationale: Each read adds the edges between its consecutive k-mers; the graph keeps each once.
"""
CALLOUT = ":::{misconception} Every edge appears once\nA k-mer pair read twice is one edge.\n:::\n"
BODY = f"A body.\n\n{CALLOUT}\n:::{{problem}}\n:::\n"


def read(problem: str | None = PROBLEM, body: str = BODY) -> tuple[Node | None, list[Problem]]:
    return parse_node_files(
        node_yaml(),
        body,
        None,
        node_id="graphs",
        regions={"sequence-analysis"},
        providers=None,
        where="graphs/",
        problem_yaml=problem,
    )


def codes(found: list[Problem]) -> list[str]:
    return [p.code for p in found]


def test_a_problem_reads_with_its_computed_sample() -> None:
    node, found = read()
    assert codes(found) == []
    assert node is not None and node.problem is not None
    assert node.problem.title == "Construct a de Bruijn graph"
    assert node.problem.rung == 3 and node.problem.kit == "de-bruijn-edges"
    assert node.problem.sample.dataset.text.startswith("3\n")
    assert node.problem.mistakes == {"duplicates": "Every edge appears once"}


def test_an_unknown_kit() -> None:
    assert codes(read(PROBLEM.replace("kit: de-bruijn-edges", "kit: walk"))[1]) == ["CS1106"]


@pytest.mark.parametrize(
    "change",
    [
        ("rationale:", "colour: red\nrationale:"),
        ("statement: |", "untold: |"),  # an unknown key, and no statement
        ("rung: 3", "rung: 5"),
    ],
)
def test_a_file_not_as_written(change: tuple[str, str]) -> None:
    assert "CS1107" in codes(read(PROBLEM.replace(*change))[1])


def test_the_file_and_its_block_go_together() -> None:
    assert codes(read(body=f"A body.\n\n{CALLOUT}")[1]) == ["CS1108"]
    assert codes(read(problem=None)[1]) == ["CS1108"]


def test_one_problem_block() -> None:
    assert "CS1109" in codes(read(body=BODY + "\n:::{problem}\n:::\n")[1])


def test_a_mistake_names_a_callout_and_one_the_kit_declares() -> None:
    no_callout = PROBLEM.replace("Every edge appears once", "No such callout")
    assert codes(read(no_callout)[1]) == ["CS1110"]
    unknown = PROBLEM.replace("  duplicates: Every", "  doubled: Every")
    assert codes(read(unknown)[1]) == ["CS1110"]


def test_a_hint_holding_the_sample_answer() -> None:
    node, _ = read()
    assert node is not None and node.problem is not None
    first = node.problem.sample.answer.splitlines()[0]
    hinted = PROBLEM.replace("The same k-mer can come from many reads.", f"Start with {first}.")
    assert codes(read(hinted)[1]) == ["CS1111"]


def test_the_engine_reports_at_the_file() -> None:
    found = read(PROBLEM.replace("{k: 3, genome: 400", "{k: 2, genome: 400"))[1]
    assert [(p.code, p.file) for p in found] == [("CS1101", "graphs/problem.yaml")]
    assert "params.k" in found[0].message


def test_the_self_test_runs_once_per_text(monkeypatch: pytest.MonkeyPatch) -> None:
    """Review Focus 4: one run per text in a process; a changed text runs again."""
    from code_schema import problem_file

    runs: list[str] = []
    real = problem_file.self_test  # type: ignore[attr-defined]

    def counted(*args: object, **kwargs: object) -> object:
        runs.append("run")
        return real(*args, **kwargs)  # type: ignore[arg-type]

    monkeypatch.setattr(problem_file, "self_test", counted)
    monkeypatch.setattr(problem_file, "_RUNS", {})
    read()
    read()
    assert runs == ["run"]
    read(PROBLEM.replace("rationale: Each", "rationale: Now each"))
    assert runs == ["run", "run"]


def test_the_writer_keeps_the_file_as_written(tmp_path: Path) -> None:
    node, _ = read()
    assert node is not None
    write_node_folder(node, tmp_path)
    assert (tmp_path / "problem.yaml").read_text() == PROBLEM
    again, found = read((tmp_path / "problem.yaml").read_text(), (tmp_path / "body.md").read_text())
    assert codes(found) == [] and again == node


def test_a_cached_problem_names_the_file_it_was_found_in() -> None:
    """#419: the same text read for two files names each its own."""
    from code_schema.problem_file import read_problem

    bad = PROBLEM.replace("kit: de-bruijn-edges", "kit: walk")
    _, first = read_problem(bad, file="a/problem.yaml", misconceptions=set())
    _, second = read_problem(bad, file="b/problem.yaml", misconceptions=set())
    assert [p.file for p in first] == ["a/problem.yaml"]
    assert [p.file for p in second] == ["b/problem.yaml"]
