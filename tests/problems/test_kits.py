"""The problem kits (M6.7 spec, M6PR.1–M6PR.2): a dataset generated, solved and checked, and the
mistakes each checker names, made from a case on purpose."""

from typing import Any

import pytest
from code_problems import KITS, Case
from code_problems.rng import Rng

from code_figures.kmers import graph

SAMPLE: dict[str, Any] = {"k": 3, "genome": 7, "read": 5, "coverage": 2, "errors": 0}


def case_of(kit: str, params: dict[str, Any], seed: int) -> Case:
    found = KITS[kit]
    dataset = found.generate(params, Rng(seed))
    probe = Case(params, dataset, "")
    return Case(params, dataset, found.solve(probe))


def test_de_bruijn_edges_on_the_sample() -> None:
    case = case_of("de-bruijn-edges", SAMPLE, 1)
    lines = case.dataset.text.splitlines()
    assert lines[0] == "3"
    reads = lines[1:]
    _, edges = graph(reads, 3)
    assert case.answer.splitlines() == sorted({f"{a} -> {b}" for a, b in edges})
    assert case.dataset.name == "de-bruijn-edges-1.txt"
    assert case.dataset.size == len(lines)


def test_the_right_answer_is_right() -> None:
    case = case_of("de-bruijn-edges", SAMPLE, 1)
    verdict = KITS["de-bruijn-edges"].check(case, case.answer)
    assert verdict.right and verdict.mistakes == ()


@pytest.mark.parametrize("mistake", ["duplicates", "missing", "extra", "unsorted", "reversed"])
def test_each_mistake_is_named(mistake: str) -> None:
    kit = KITS["de-bruijn-edges"]
    case = case_of("de-bruijn-edges", {**SAMPLE, "genome": 40, "read": 8, "coverage": 4}, 2)
    made = kit.mistakes[mistake](case)
    verdict = kit.check(case, made)
    assert not verdict.right
    assert mistake in verdict.mistakes, (mistake, verdict)


def test_each_kit_at_its_bounds() -> None:
    """Review Focus 1: the smallest and tightest params still make a dataset and a right answer."""
    for params in (
        {"k": 12, "genome": 13, "read": 13, "coverage": 1, "errors": 0},
        {"k": 3, "genome": 7, "read": 4, "coverage": 1, "errors": 0.02},
    ):
        case = case_of("de-bruijn-edges", params, 0)
        assert case.dataset.size >= 2 and case.answer
        assert KITS["de-bruijn-edges"].check(case, case.answer).right


def test_a_given_answer_is_read_loosely() -> None:
    """Review Focus 2: CRLF, trailing spaces and a final blank line are forgiven; `A->B` is not."""
    kit = KITS["de-bruijn-edges"]
    case = case_of("de-bruijn-edges", SAMPLE, 1)
    loose = "\r\n".join(f"{line}  " for line in case.answer.splitlines()) + "\r\n\r\n"
    assert kit.check(case, loose).right
    tight = case.answer.replace(" -> ", "->")
    verdict = kit.check(case, tight)
    assert not verdict.right and "A -> B" in verdict.said


COUNT: dict[str, Any] = {"k": 3, "genome": [40, 400], "read": 12, "coverage": 3, "errors": 0}


def test_count_kmers_counts_the_distinct() -> None:
    case = case_of("count-kmers", COUNT, 5)
    k, *rows = case.dataset.text.splitlines()
    distinct = {r[i : i + 3] for r in rows for i in range(len(r) - 2)}
    assert case.answer == str(len(distinct)) and k == "3"


@pytest.mark.parametrize("mistake", ["counted-all", "off-by-one"])
def test_count_mistakes_are_named_in_order(mistake: str) -> None:
    kit = KITS["count-kmers"]
    case = case_of("count-kmers", COUNT, 5)
    verdict = kit.check(case, kit.mistakes[mistake](case))
    assert not verdict.right and verdict.mistakes == (mistake,)
    assert kit.check(case, case.answer).right
    assert not kit.check(case, "seven").right


@pytest.mark.parametrize("given", ["12²", "١٢", "1,2", "", "\x00", "-3", "3.0"])
def test_a_count_is_ascii_digits_only_and_never_crashes(given: str) -> None:
    """#418: never a crash; commas only as thousands separators."""
    kit = KITS["count-kmers"]
    case = case_of("count-kmers", COUNT, 5)
    verdict = kit.check(case, given)
    assert not verdict.right


def test_a_count_takes_thousands_separators() -> None:
    kit = KITS["count-kmers"]
    case = case_of("count-kmers", {**COUNT, "k": 8, "genome": [3000, 3000], "read": 40}, 5)
    shown = f"{int(case.answer):,}"
    assert "," in shown and kit.check(case, shown).right
