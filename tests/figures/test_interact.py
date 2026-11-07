"""A kit's tasks: what a learner does with a figure, and the answers computed (M6.6b, M6FA.2)."""

from typing import Any

from code_figures import CODES, COMPONENTS, derived, figure_findings

TRACE_READS: dict[str, Any] = {**COMPONENTS["kmer-graph"].starter, "highlight": "none"}
TRACE_READS.pop("path")
TRACE_READS.pop("spell")
PICK_READS: dict[str, Any] = dict(COMPONENTS["graph-artifacts"].starter)


def codes(component: str, data: dict[str, Any], interact: object) -> list[tuple[str, str]]:
    return [(f.code, f.path) for f in figure_findings(component, data, interact)]


def answer(component: str, data: dict[str, Any], interact: dict[str, Any]) -> Any:
    assert figure_findings(component, data, interact) == []
    return derived(component, data, interact)["answer"]


def test_trace_accepts_the_spelled_path() -> None:
    got = answer("kmer-graph", TRACE_READS, {"task": "trace", "spells": "ACGTTAG"})
    assert got == {
        "accept": [["ACG", "CGT", "GTT", "TTA", "TAG"]],
        "wrong": ["ACG", "CGT", "GTC"],
    }


def test_trace_with_no_branch_drops_the_last_kmer() -> None:
    data = {"reads": [{"sequence": "ACGTT"}], "k": 3, "highlight": "none"}
    assert answer("kmer-graph", data, {"task": "trace", "spells": "ACGTT"})["wrong"] == [
        "ACG",
        "CGT",
    ]


def test_trace_off_the_graph() -> None:
    found = figure_findings("kmer-graph", TRACE_READS, {"task": "trace", "spells": "ACGTCAG"})
    assert [(f.code, f.path) for f in found] == [("CS1030", "interact.spells")]
    assert "TCA" in found[0].message


def test_trace_shorter_than_k_plus_one() -> None:
    assert codes("kmer-graph", TRACE_READS, {"task": "trace", "spells": "ACG"}) == [
        ("CS1030", "interact.spells")
    ]


def test_trace_through_a_repeat_is_refused() -> None:
    data = {"reads": [{"sequence": "ACGACGT"}], "k": 3, "highlight": "none"}
    found = figure_findings("kmer-graph", data, {"task": "trace", "spells": "ACGACGT"})
    assert [f.code for f in found] == ["CS1030"]
    assert "ACG twice" in found[0].message


def test_trace_on_a_highlighted_path() -> None:
    starter = dict(COMPONENTS["kmer-graph"].starter)
    assert codes("kmer-graph", starter, {"task": "trace", "spells": "ACGTTAG"}) == [
        ("CS1031", "interact.task")
    ]


def test_pick_accepts_each_kmer_of_the_bubble() -> None:
    assert answer("graph-artifacts", PICK_READS, {"task": "pick", "artifact": "bubble"}) == {
        "accept": [["GTC"], ["TCA"], ["CAG"]],
        "wrong": ["ACG"],
    }


def test_pick_with_no_tip() -> None:
    data = {
        "reads": [{"sequence": "ACGTTAGC"}, {"sequence": "ACGTTAGC"}, {"sequence": "ACGTCAGC"}],
        "k": 3,
    }
    assert codes("graph-artifacts", data, {"task": "pick", "artifact": "tip"}) == [
        ("CS1032", "interact.artifact")
    ]


def test_no_such_task() -> None:
    assert codes("kmer-graph", TRACE_READS, {"task": "walk"}) == [("CS1028", "interact.task")]
    assert codes("table", {"columns": [], "rows": []}, {"task": "trace"})[0][0] in {
        "CS1028",
        "CS1003",
        "CS1004",
    }


def test_fields_off_the_schema() -> None:
    assert [c for c, _ in codes("kmer-graph", TRACE_READS, {"task": "trace"})] == ["CS1028"]
    assert [c for c, _ in codes("kmer-graph", TRACE_READS, "trace")] == ["CS1028"]
    extra = {"task": "trace", "spells": "ACGTTAG", "colour": "red"}
    assert [c for c, _ in codes("kmer-graph", TRACE_READS, extra)] == ["CS1028"]


def test_no_interact_is_no_answer() -> None:
    assert figure_findings("kmer-graph", TRACE_READS) == []
    assert "answer" not in derived("kmer-graph", TRACE_READS)


def test_marks_default_shown() -> None:
    hidden = {**PICK_READS, "marks": "hidden"}
    assert figure_findings("graph-artifacts", hidden) == []
    assert derived("graph-artifacts", {**PICK_READS, "marks": "shown"}) == derived(
        "graph-artifacts", PICK_READS
    )
    assert [f.code for f in figure_findings("graph-artifacts", {**PICK_READS, "marks": "off"})] == [
        "CS1003"
    ]


def test_every_task_code_is_declared() -> None:
    assert {"CS1028", "CS1030", "CS1031", "CS1032"} <= CODES
