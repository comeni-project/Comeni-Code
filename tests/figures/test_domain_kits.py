"""The other de Bruijn components: tiling, windows, both conventions and artifacts (M6.6a spec,
M6DC.1–M6DC.2)."""

from typing import Any, cast

from code_figures import derived, figure_findings

GENOME = "ATGCGTACGTTAGCCTAGGATCCAGTACGTTAGGCATCGA"
STARTS = [1, 6, 12, 17, 22, 28, 32]


def codes(component: str, data: dict[str, Any]) -> list[tuple[str, str]]:
    return [(f.code, f.path) for f in figure_findings(component, data)]


def reads(*sequences: str) -> list[dict[str, str]]:
    return [{"sequence": s} for s in sequences]


# ── read-tiling ──────────────────────────────────────────────────────────────────────────────

TILING: dict[str, Any] = {
    "genome": GENOME,
    "reads": reads(*(GENOME[s - 1 : s + 8] for s in STARTS)),
}


def test_reads_are_placed_where_they_match() -> None:
    assert codes("read-tiling", TILING) == []
    assert derived("read-tiling", TILING) == {
        "starts": STARTS,
        "lanes": [0, 1, 0, 1, 0, 1, 0],
    }


def test_a_read_in_no_place_is_cs1012() -> None:
    data = {**TILING, "reads": reads("ATGCGTACG", "GGGGGGG")}
    found = figure_findings("read-tiling", data)
    assert [(f.code, f.path) for f in found] == [("CS1012", "data.reads[1].sequence")]
    assert found[0].message == "is not in the genome"


def test_a_read_in_two_places_is_cs1012() -> None:
    data = {**TILING, "reads": reads("TACGTTAG")}
    found = figure_findings("read-tiling", data)
    assert [(f.code, f.message) for f in found] == [
        ("CS1012", "is in the genome twice, at 6 and 26")
    ]


def test_a_genome_letter_outside_dna_is_cs1010() -> None:
    assert codes("read-tiling", {**TILING, "genome": "ATGN"}) == [("CS1010", "data.genome")]


# ── kmer-window ──────────────────────────────────────────────────────────────────────────────

WINDOW: dict[str, Any] = {"read": "ACGTTAGCAT", "k": 4, "range": [3, 7]}


def test_each_k_in_range_has_its_windows_and_count() -> None:
    assert codes("kmer-window", WINDOW) == []
    by_k = cast(dict[str, Any], derived("kmer-window", WINDOW)["by_k"])
    assert sorted(by_k) == ["3", "4", "5", "6", "7"]
    assert by_k["4"]["count"] == 7
    assert by_k["4"]["windows"][:2] == [[1, "ACGT"], [2, "CGTT"]]
    assert by_k["7"] == {
        "count": 4,
        "windows": [[1, "ACGTTAG"], [2, "CGTTAGC"], [3, "GTTAGCA"], [4, "TTAGCAT"]],
    }


def test_a_range_past_the_read_is_cs1013() -> None:
    """Review Focus 4."""
    data = {"read": "ACGTTAGCAT", "k": 8, "range": [3, 10]}
    assert codes("kmer-window", data) == [("CS1004", "data.range[1]")]
    data = {"read": "ACGTTAG", "k": 4, "range": [3, 7]}
    assert codes("kmer-window", data) == [("CS1013", "data.range")]


def test_a_k_outside_its_range_is_cs1003() -> None:
    """Review Focus 4."""
    assert codes("kmer-window", {**WINDOW, "k": 8}) == [("CS1003", "data.k")]


# ── compare-graphs ───────────────────────────────────────────────────────────────────────────


def test_both_conventions_from_one_read() -> None:
    data = {"reads": reads("ACGTT"), "k": 3}
    assert codes("compare-graphs", data) == []
    assert derived("compare-graphs", data) == {
        "as_nodes": {"nodes": ["ACG", "CGT", "GTT"], "edges": [["ACG", "CGT"], ["CGT", "GTT"]]},
        "as_edges": {
            "nodes": ["AC", "CG", "GT", "TT"],
            "edges": [["AC", "CG", "ACG"], ["CG", "GT", "CGT"], ["GT", "TT", "GTT"]],
        },
    }


def test_both_halves_count_toward_the_page() -> None:
    data = {"reads": reads("ACGTACGGTCCA"), "k": 3}  # 9 k-mers, 8 (k-1)-mers
    assert codes("compare-graphs", data) == [("CS1016", "data.reads")]


# ── graph-artifacts ──────────────────────────────────────────────────────────────────────────

ARTIFACTS: dict[str, Any] = {
    "reads": reads("ACGTTAGC", "ACGTTAGC", "ACGTCAGC", "ACGTTAGG"),
    "k": 3,
}


def test_a_bubble_and_a_tip_are_found() -> None:
    assert codes("graph-artifacts", ARTIFACTS) == []
    computed = cast(dict[str, Any], derived("graph-artifacts", ARTIFACTS))
    assert computed["kmers"] == [
        "ACG",
        "CGT",
        "GTT",
        "TTA",
        "TAG",
        "AGC",
        "GTC",
        "TCA",
        "CAG",
        "AGG",
    ]
    assert computed["support"]["ACG"] == 4 and computed["support"]["GTC"] == 1
    assert computed["artifacts"] == [
        {"kind": "bubble", "kmers": ["GTC", "TCA", "CAG"]},
        {"kind": "tip", "kmers": ["AGG"]},
    ]


def test_duplicate_reads_add_support_not_kmers() -> None:
    """Review Focus 3."""
    once = cast(
        dict[str, Any], derived("graph-artifacts", {"reads": reads("ACGTT", "ACGTT"), "k": 3})
    )
    assert once["kmers"] == ["ACG", "CGT", "GTT"]
    assert once["support"] == {"ACG": 2, "CGT": 2, "GTT": 2}
    assert once["artifacts"] == []


def test_no_kmer_in_two_reads_is_cs1015() -> None:
    assert codes("graph-artifacts", {"reads": reads("ACGTT", "GGCAA"), "k": 3}) == [
        ("CS1015", "data.reads")
    ]
