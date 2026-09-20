"""code-weaver route: the output, --known, the failures (spec M2P3)."""

from pathlib import Path

import pytest
from schema.content_helpers import content_root, link, make_node
from weaver.fixture_graph import FIXTURES

from code_weaver import cli
from code_weaver.cli import WIDTH, main
from code_weaver.graph import Graph, GraphError


def _refuse(content: object) -> Graph:
    raise GraphError("needs cycle: a → b → a")


Captured = pytest.CaptureFixture[str]

HEADER = "Route to Salmon — 17 stops · about 3 h 4 min · First steps → Intermediate"
FIRST = " 1. DNA and genes               first-steps    10m  → Gene expression: Expression is a gene being r…"  # noqa: E501
LAST = "17. Salmon                      intermediate   15m"


def route(capsys: Captured, *argv: str) -> tuple[int, list[str], str]:
    code = main(["route", *argv])
    captured = capsys.readouterr()
    return code, captured.out.splitlines(), captured.err


def test_salmon_prints_a_header_and_one_line_per_stop(capsys: Captured) -> None:
    code, lines, _ = route(capsys, "salmon", "--root", str(FIXTURES))
    assert code == 0
    assert lines[0] == HEADER
    assert lines[1] == ""
    assert len(lines) == 19
    assert lines[2] == FIRST
    assert lines[-1] == LAST


def test_every_line_fits_the_fixed_width(capsys: Captured) -> None:
    _, lines, _ = route(capsys, "salmon", "--root", str(FIXTURES))
    assert max(len(line) for line in lines) <= WIDTH


def test_known_topics_shorten_the_route(capsys: Captured) -> None:
    code, lines, _ = route(capsys, "salmon", "--root", str(FIXTURES), "--known", "read-mapping")
    assert code == 0
    assert (
        lines[0]
        == "Route to Salmon — 14 stops · about 2 h 32 min · First steps → Intermediate · 1 known"
    )
    assert not [line for line in lines if "k-mers" in line]


def test_a_known_id_outside_the_content_is_not_counted(capsys: Captured) -> None:
    _, lines, _ = route(capsys, "salmon", "--root", str(FIXTURES), "--known", "no-such-topic")
    assert lines[0] == HEADER


def test_two_goals_are_named_in_route_order(capsys: Captured) -> None:
    _, lines, _ = route(capsys, "tpm", "salmon", "--root", str(FIXTURES))
    assert lines[0].startswith("Route to What TPM measures, Salmon — 17 stops")


def test_a_missing_folder_exits_2(capsys: Captured, tmp_path: Path) -> None:
    missing = tmp_path / "not-there"
    code, lines, err = route(capsys, "salmon", "--root", str(missing))
    assert (code, lines) == (2, [])
    assert err == f"code-weaver: no such folder: {missing}\n"


def test_content_problems_name_the_validator(capsys: Captured, tmp_path: Path) -> None:
    root = content_root(tmp_path)
    make_node(root, "broken", links="needs:\n  - node: nowhere\n")
    code, lines, err = route(capsys, "broken", "--root", str(root))
    assert (code, lines) == (1, [])
    assert err.startswith("code-weaver: ")
    assert err.endswith(f"in the content; run code-schema validate {root}\n")


def test_a_refused_graph_prints_its_message(
    capsys: Captured, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """`read_content` already refuses a cycle, so this branch is reached only with a bad graph."""
    root = content_root(tmp_path)
    make_node(root, "a")
    monkeypatch.setattr(cli, "graph_of", _refuse)
    code, lines, err = route(capsys, "a", "--root", str(root))
    assert (code, lines) == (1, [])
    assert err == "needs cycle: a → b → a\n"


def test_an_unknown_goal_exits_2(capsys: Captured) -> None:
    code, lines, err = route(capsys, "zzz", "--root", str(FIXTURES))
    assert (code, lines) == (2, [])
    assert err == "code-weaver: not in the content: zzz\n"


def test_a_long_title_and_reason_are_cut(capsys: Captured, tmp_path: Path) -> None:
    root = content_root(tmp_path)
    make_node(root, "base", title="A title that is far too long to fit the column")
    make_node(
        root,
        "goal",
        title="Another very long title, longer than the column allows",
        links=link(
            "needs", "base", "A reason so long that it cannot fit what is left of the line, by far."
        ),
    )
    _, lines, _ = route(capsys, "goal", "--root", str(root))
    assert max(len(line) for line in lines) <= WIDTH
    assert "…" in lines[2]
    assert lines[2].startswith(" 1. A title that is far too")


# M3 part 2: code-weaver find (spec M3P2.3).


def look(capsys: Captured, *argv: str) -> tuple[int, list[str], str]:
    code = main(["find", *argv])
    captured = capsys.readouterr()
    return code, captured.out.splitlines(), captured.err


def test_a_question_finds_the_topic_that_answers_it(capsys: Captured) -> None:
    code, lines, _ = look(capsys, "why my reads don't map", "--root", str(FIXTURES))
    assert code == 0
    assert lines[0] == '10 topics match "why my reads don\'t map"'
    assert lines[1] == ""
    # Both words are in these two titles; everything below matches one word, in a claim.
    assert lines[2].startswith(" 1. Mapping reads to a refe")
    assert lines[3].startswith(" 2. Reads that map to sever")


def test_every_found_line_fits_the_fixed_width(capsys: Captured) -> None:
    _, lines, _ = look(capsys, "reads", "--root", str(FIXTURES))
    assert lines and all(len(line) <= WIDTH for line in lines)


def test_one_topic_is_counted_in_the_singular(capsys: Captured) -> None:
    _, lines, _ = look(capsys, "kallisto", "--root", str(FIXTURES))
    assert lines[0] == '1 topic matches "kallisto"'


def test_nothing_found_is_not_a_failure(capsys: Captured) -> None:
    code, lines, err = look(capsys, "nanopore", "--root", str(FIXTURES))
    assert code == 0
    assert lines == ['Nothing matches "nanopore"']
    assert err == ""


def test_a_word_that_matched_nothing_is_reported(capsys: Captured) -> None:
    _, lines, _ = look(capsys, "salmon nanopore", "--root", str(FIXTURES))
    assert lines[0] == '5 topics match "salmon nanopore"'

    assert lines[-1] == "Nothing matches: nanopore"


def test_the_limit_is_kept(capsys: Captured) -> None:
    _, lines, _ = look(capsys, "reads", "--root", str(FIXTURES), "--limit", "2")
    assert len([line for line in lines if line.startswith((" 1.", " 2.", " 3."))]) == 2


def test_a_limit_outside_the_range_is_argparses_own_exit(capsys: Captured) -> None:
    with pytest.raises(SystemExit) as refused:
        main(["find", "reads", "--root", str(FIXTURES), "--limit", "0"])
    assert refused.value.code == 2


def test_an_empty_query_exits_2(capsys: Captured) -> None:
    code, lines, err = look(capsys, "   ", "--root", str(FIXTURES))
    assert (code, lines) == (2, [])
    assert err == "code-weaver: a search needs a word\n"


def test_a_missing_folder_exits_2_when_looking(capsys: Captured, tmp_path: Path) -> None:
    missing = tmp_path / "not-there"
    code, lines, err = look(capsys, "salmon", "--root", str(missing))
    assert (code, lines) == (2, [])
    assert err == f"code-weaver: no such folder: {missing}\n"


def test_broken_content_exits_1_when_looking(capsys: Captured, tmp_path: Path) -> None:
    root = content_root(tmp_path)
    make_node(root, "broken", links="needs:\n  - node: nowhere\n")
    code, lines, err = look(capsys, "broken", "--root", str(root))
    assert (code, lines) == (1, [])
    assert err.endswith(f"in the content; run code-schema validate {root}\n")
