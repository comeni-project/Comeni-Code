"""A problem is one line of output (spec M1P1.5)."""

import pytest

from code_schema.diagnostics import UnknownDiagnostic
from code_schema.problems import Problem


def test_a_field_problem_names_file_line_and_field() -> None:
    problem = Problem(
        file="salmon/node.yaml",
        field="level",
        line=5,
        message=(
            '"expert" is not a level '
            "(first-steps, foundations, introductory, intermediate, advanced)"
        ),
    )
    assert str(problem) == (
        'salmon/node.yaml:5: level: "expert" is not a level '
        "(first-steps, foundations, introductory, intermediate, advanced)"
    )


def test_a_missing_field_has_no_line() -> None:
    problem = Problem(file="salmon/node.yaml", field="claim", message="required field is missing")
    assert str(problem) == "salmon/node.yaml: claim: required field is missing"


def test_a_problem_about_a_folder_names_no_field() -> None:
    assert (
        str(Problem(file="salmon/", message="body.md is missing")) == "salmon/: body.md is missing"
    )


def test_problems_sort_by_file_then_line() -> None:
    late = Problem(file="salmon/node.yaml", line=6, message="b")
    early = Problem(file="salmon/node.yaml", line=3, message="a")
    assert sorted([late, early], key=Problem.sort_key) == [early, late]


# M4.1.1: a problem carries its diagnostic code (spec M4D.4).


def test_a_problem_prints_its_code_before_its_message() -> None:
    problem = Problem(file="a/node.yaml", line=9, field="provider", code="CS0201", message="x")
    assert str(problem) == "a/node.yaml:9: provider: CS0201 x"


def test_a_problem_with_an_undeclared_code_cannot_be_built() -> None:
    with pytest.raises(UnknownDiagnostic):
        Problem(file="a", code="CS0999", message="x")
