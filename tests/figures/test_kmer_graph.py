"""`kmer-graph`: reads joined by their k-mers, computed (M6.6a spec, M6DC.1–M6DC.2)."""

from typing import Any

from code_figures import derived, figure_findings
from code_figures.kmers import graph, is_walk, kmers_of, spells, support

STARTER: dict[str, Any] = {
    "reads": [
        {"sequence": "ACGTT"},
        {"sequence": "CGTTA"},
        {"sequence": "GTTAG"},
        {"sequence": "CGTC", "note": "another read — a branch"},
    ],
    "k": 3,
    "highlight": "path",
    "path": [1, 3],
    "spell": "shown",
}


def codes(data: dict[str, Any]) -> list[tuple[str, str]]:
    return [(f.code, f.path) for f in figure_findings("kmer-graph", data)]


def with_reads(*reads: str, **rest: Any) -> dict[str, Any]:
    return {**STARTER, "reads": [{"sequence": r} for r in reads], **rest}


# ── the shared graph ─────────────────────────────────────────────────────────────────────────


def test_a_reads_kmers_left_to_right() -> None:
    assert kmers_of("ACGTT", 3) == ["ACG", "CGT", "GTT"]
    assert kmers_of("AC", 3) == []


def test_the_graph_joins_kmers_that_follow_in_a_read() -> None:
    kmers, edges = graph(["ACGTT", "CGTC"], 3)
    assert kmers == ["ACG", "CGT", "GTT", "GTC"]
    assert edges == [("ACG", "CGT"), ("CGT", "GTT"), ("CGT", "GTC")]


def test_support_counts_reads_not_occurrences() -> None:
    assert support(["ACGACG", "ACGT"], 3) == {"ACG": 2, "CGA": 1, "GAC": 1, "CGT": 1}


def test_spells_and_walks() -> None:
    assert spells(["ACG", "CGT", "GTT", "TTA", "TAG"]) == "ACGTTAG"
    assert is_walk(["ACG", "CGT", "GTT"]) is None
    assert is_walk(["ACG", "CGT", "GTC", "TTA"]) == 3


# ── the kit ──────────────────────────────────────────────────────────────────────────────────


def test_the_starter_is_computed_as_the_board_draws_it() -> None:
    assert codes(STARTER) == []
    assert derived("kmer-graph", STARTER) == {
        "kmers": ["ACG", "CGT", "GTT", "TTA", "TAG", "GTC"],
        "edges": [["ACG", "CGT"], ["CGT", "GTT"], ["GTT", "TTA"], ["TTA", "TAG"], ["CGT", "GTC"]],
        "branches": ["CGT"],
        "notes": {"GTC": "another read — a branch"},
        "path": ["ACG", "CGT", "GTT", "TTA", "TAG"],
        "spells": "ACGTTAG",
    }


def test_a_repeat_makes_a_cycle_once() -> None:
    """Review Focus 1: ACGACGA at k 3 revisits ACG; each k-mer and edge is listed once."""
    data = with_reads("ACGACGA", highlight="none")
    del data["path"]
    assert codes(data) == []
    computed = derived("kmer-graph", data)
    assert computed["kmers"] == ["ACG", "CGA", "GAC"]
    assert computed["edges"] == [["ACG", "CGA"], ["CGA", "GAC"], ["GAC", "ACG"]]
    assert "path" not in computed


def test_path_with_a_shared_kmer_is_one_walk() -> None:
    """Review Focus 2: reads 1-2 share CGT and GTT; the path keeps each k-mer once."""
    data = with_reads("ACGTT", "CGTTA", path=[1, 2])
    assert codes(data) == []
    assert derived("kmer-graph", data)["path"] == ["ACG", "CGT", "GTT", "TTA"]
    assert derived("kmer-graph", data)["spells"] == "ACGTTA"


def test_k_as_long_as_a_read_is_cs1013() -> None:
    assert codes({**STARTER, "k": 4}) == [("CS1013", "data.k")]


def test_a_read_shorter_than_k_is_cs1013() -> None:
    """Review Focus 3."""
    assert codes(with_reads("ACGTT", "AC", path=[1, 1])) == [("CS1013", "data.k")]


def test_a_path_that_is_not_a_walk_is_cs1014() -> None:
    data = with_reads("ACGTT", "CCCCC", path=[1, 2])
    assert codes(data) == [("CS1014", "data.path")]


def test_a_path_past_the_reads_is_cs1014() -> None:
    assert codes({**STARTER, "path": [2, 9]}) == [("CS1014", "data.path")]


def test_a_path_highlight_needs_its_reads() -> None:
    data = {**STARTER}
    del data["path"]
    assert codes(data) == [("CS1003", "data.path")]


def test_more_kmers_than_a_page_draws_is_cs1016() -> None:
    data = with_reads("ACGTACGGTCCATTGA", highlight="none")
    del data["path"]
    assert codes(data) == [("CS1016", "data.reads")]


def test_a_letter_outside_dna_is_cs1010() -> None:
    assert codes(with_reads("acgtt", "CGTTA", "GTTAG")) == [("CS1010", "data.reads[0].sequence")]


def test_duplicate_reads_add_no_kmers() -> None:
    """Review Focus 3: a read twice changes nothing drawn."""
    once = derived("kmer-graph", with_reads("ACGTT", "CGTTA", "GTTAG"))
    twice = derived("kmer-graph", with_reads("ACGTT", "ACGTT", "CGTTA", "GTTAG", path=[1, 4]))
    assert once["kmers"] == twice["kmers"] and once["edges"] == twice["edges"]
