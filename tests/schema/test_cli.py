"""code-schema validate: output, summary, exit codes (spec M1P3.5)."""

from pathlib import Path

import pytest
from schema.content_helpers import content_root, make_node

from code_schema.cli import github_line, main
from code_schema.problems import Problem

Captured = pytest.CaptureFixture[str]


def test_clean_content_exits_0_with_a_summary(tmp_path: Path, capsys: Captured) -> None:
    root = content_root(tmp_path)
    make_node(root, "salmon")
    assert main(["validate", str(root)]) == 0
    assert capsys.readouterr().out == "1 node, no problems\n"


def test_an_empty_root_is_zero_nodes(tmp_path: Path, capsys: Captured) -> None:
    assert main(["validate", str(content_root(tmp_path))]) == 0
    assert capsys.readouterr().out == "0 nodes, no problems\n"


def test_problems_exit_1_are_printed_and_counted(tmp_path: Path, capsys: Captured) -> None:
    root = content_root(tmp_path)
    make_node(root, "salmon", level="expert")
    make_node(root, "k-mers", title="K-mers")
    assert main(["validate", str(root)]) == 1
    assert capsys.readouterr().out.splitlines() == [
        'salmon/node.yaml:5: level: "expert" is not a level '
        "(first-steps, foundations, introductory, intermediate, advanced)",
        "1 problem in 1 of 2 nodes",
    ]


def test_a_problem_outside_the_nodes_is_said_so(tmp_path: Path, capsys: Captured) -> None:
    root = content_root(tmp_path)
    make_node(root, "salmon")
    (root / "stray").mkdir()
    (root / "stray" / "body.md").write_text("A body.\n", encoding="utf-8")
    assert main(["validate", str(root)]) == 1
    assert capsys.readouterr().out.splitlines()[-1] == "1 problem outside the nodes (1 node)"


def test_a_folder_named_like_another_nodes_prefix_is_not_counted_twice(
    tmp_path: Path, capsys: Captured
) -> None:
    root = content_root(tmp_path)
    make_node(root, "salmon", level="expert")
    make_node(root, "salmon-index", title="Index")
    assert main(["validate", str(root)]) == 1
    assert capsys.readouterr().out.splitlines()[-1] == "1 problem in 1 of 2 nodes"


def test_a_missing_root_exits_2(tmp_path: Path, capsys: Captured) -> None:
    assert main(["validate", str(tmp_path / "nowhere")]) == 2
    assert capsys.readouterr().err == f"code-schema: no such folder: {tmp_path / 'nowhere'}\n"


def test_github_format_prints_workflow_commands(tmp_path: Path, capsys: Captured) -> None:
    root = content_root(tmp_path)
    make_node(root, "salmon", level="expert")
    assert main(["validate", str(root), "--format", "github"]) == 1
    first = capsys.readouterr().out.splitlines()[0]
    assert first.startswith("::error file=salmon/node.yaml,line=5::salmon/node.yaml:5: level: ")


def test_github_lines_are_escaped() -> None:
    problem = Problem(file="a,b/node.yaml", line=3, field="needs", message="50% done\nnext")
    assert github_line(problem) == (
        "::error file=a%2Cb/node.yaml,line=3::a,b/node.yaml:3: needs: 50%25 done%0Anext"
    )


def test_a_folder_problem_has_no_file_property() -> None:
    assert github_line(Problem(file="salmon/", message="body.md is missing")) == (
        "::error::salmon/: body.md is missing"
    )


def test_a_file_problem_without_a_line_has_no_line_property() -> None:
    problem = Problem(file="regions.yaml", message="the file is missing")
    assert github_line(problem) == "::error file=regions.yaml::regions.yaml: the file is missing"
