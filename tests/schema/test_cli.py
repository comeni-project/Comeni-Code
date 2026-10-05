"""code-schema validate: output, summary, exit codes (spec M1P3.5)."""

from pathlib import Path

import pytest
from schema.content_helpers import SMALL_POOL, content_root, make_node

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
        'salmon/node.yaml:5: level: CS0012 "expert" is not a level '
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
    assert (
        capsys.readouterr().err == f"code-schema: CS0701 no such folder: {tmp_path / 'nowhere'}\n"
    )


def test_github_format_prints_workflow_commands(tmp_path: Path, capsys: Captured) -> None:
    root = content_root(tmp_path)
    make_node(root, "salmon", level="expert")
    assert main(["validate", str(root), "--format", "github"]) == 1
    first = capsys.readouterr().out.splitlines()[0]
    assert first.startswith(
        "::error file=salmon/node.yaml,line=5,title=CS0012::salmon/node.yaml:5: level: CS0012 "
    )


def test_github_lines_are_escaped() -> None:
    problem = Problem(
        file="a,b/node.yaml", line=3, field="needs", code="CS0101", message="50% done\nnext"
    )
    assert github_line(problem) == (
        "::error file=a%2Cb/node.yaml,line=3,title=CS0101::"
        "a,b/node.yaml:3: needs: CS0101 50%25 done%0Anext"
    )


def test_a_folder_problem_has_no_file_property() -> None:
    assert github_line(Problem(file="salmon/", code="CS0021", message="body.md is missing")) == (
        "::error title=CS0021::salmon/: CS0021 body.md is missing"
    )


def test_a_file_problem_without_a_line_has_no_line_property() -> None:
    problem = Problem(file="regions.yaml", code="CS0601", message="the file is missing")
    assert github_line(problem) == (
        "::error file=regions.yaml,title=CS0601::regions.yaml: CS0601 the file is missing"
    )


def test_an_annotation_carries_the_code_as_its_title() -> None:
    problem = Problem(
        file="n/node.yaml",
        line=3,
        code="CS0005",
        field="title",
        message="required field is missing",
    )
    assert github_line(problem).startswith("::error file=n/node.yaml,line=3,title=CS0005::")


def test_an_annotation_about_a_folder_still_carries_its_code() -> None:
    problem = Problem(file="n/", code="CS0021", message="node.yaml is missing")
    assert github_line(problem).startswith("::error title=CS0021::")


# Warnings (spec M4E.4): printed and counted apart; only errors exit 1.


def test_a_warning_alone_exits_0(tmp_path: Path, capsys: Captured) -> None:
    root = content_root(tmp_path)
    (make_node(root, "salmon") / "exam.yaml").write_text(SMALL_POOL, encoding="utf-8")
    assert main(["validate", str(root)]) == 0
    assert capsys.readouterr().out.splitlines() == [
        "salmon/exam.yaml:1: exam: CS0813 the pool has 3 questions "
        "— the node is left out of self-tests until it has 4",
        "1 node, no problems, 1 warning",
    ]


def test_a_warning_beside_an_error_is_counted_apart(tmp_path: Path, capsys: Captured) -> None:
    root = content_root(tmp_path)
    (make_node(root, "salmon") / "exam.yaml").write_text(SMALL_POOL, encoding="utf-8")
    make_node(root, "k-mers", title="K-mers", level="expert")
    assert main(["validate", str(root)]) == 1
    assert capsys.readouterr().out.splitlines()[-1] == "1 problem in 1 of 2 nodes, 1 warning"


def test_a_warning_is_a_github_warning() -> None:
    warning = Problem(file="salmon/exam.yaml", line=1, code="CS0813", message="a small pool")
    assert github_line(warning).startswith("::warning file=salmon/exam.yaml,line=1,title=CS0813::")
