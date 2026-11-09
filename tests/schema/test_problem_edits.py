"""A problem set and removed whole (M6.7 spec, M6PR.6): the file and its block in one edit, read
back as the folder would be; the block is not deleted on its own."""

import time
from pathlib import Path

import pytest
from schema.test_problem_file import PROBLEM

from code_schema import parse_node_files, read_content
from code_schema.blocks import ProblemBlock
from code_schema.edits import (
    EditError,
    ProblemRefused,
    delete_block,
    insert_block,
    remove_problem,
    set_problem,
)
from code_schema.figures import figure_texts
from code_schema.node import Node
from code_schema.writer import write_exam_yaml, write_node_yaml

ROOT = Path(__file__).resolve().parents[1] / "fixtures" / "salmon"
CONTENT = read_content(ROOT)
TPM = CONTENT.nodes["tpm"]


def reread(node: Node) -> Node:
    again, problems = parse_node_files(
        write_node_yaml(node),
        node.body,
        write_exam_yaml(node) if node.exam else None,
        node_id=node.id,
        regions=set(CONTENT.regions),
        providers=CONTENT.providers,
        where=f"{CONTENT.folders[node.id]}/",
        figures=figure_texts(node.figures),
        problem_yaml=None if node.problem is None else node.problem.text,
    )
    assert problems == [], [str(p) for p in problems]
    assert again is not None
    return again


def test_a_problem_is_set_with_its_block_and_reads_back() -> None:
    from code_schema.blocks import Callout

    node = insert_block(
        TPM,
        len(TPM.blocks),
        Callout("misconception", "Every edge appears once", "A pair read twice is one edge.\n"),
    )
    once = reread(set_problem(node, PROBLEM))
    assert once.problem is not None and once.problem.text == PROBLEM
    assert sum(isinstance(b, ProblemBlock) for b in once.blocks) == 1
    assert isinstance(once.blocks[-1], ProblemBlock)
    twice = reread(set_problem(once, PROBLEM.replace("Construct", "Build")))
    assert twice.problem is not None and twice.problem.title == "Build a de Bruijn graph"
    assert sum(isinstance(b, ProblemBlock) for b in twice.blocks) == 1
    gone = reread(remove_problem(twice))
    assert gone.problem is None and not any(isinstance(b, ProblemBlock) for b in gone.blocks)


def test_a_failing_problem_is_refused_with_its_problems() -> None:
    with pytest.raises(ProblemRefused) as refused:
        set_problem(TPM, PROBLEM.replace("kit: de-bruijn-edges", "kit: walk"))
    assert [p.code for p in refused.value.problems] == ["CS1106"]


def test_the_problem_block_is_not_deleted_alone() -> None:
    dbg = CONTENT.nodes["de-bruijn-graphs"]
    at = next(i for i, b in enumerate(dbg.blocks) if isinstance(b, ProblemBlock))
    with pytest.raises(EditError, match="problem"):
        delete_block(dbg, at)


def test_the_fixture_problem_runs_its_self_test_in_under_a_second() -> None:
    from code_schema import problem_file

    dbg = CONTENT.nodes["de-bruijn-graphs"]
    assert dbg.problem is not None and dbg.problem.kit == "de-bruijn-edges"
    problem_file._RUNS.clear()  # noqa: SLF001 — time the run, not the cache
    started = time.perf_counter()
    reread(dbg)
    assert time.perf_counter() - started < 1.0
