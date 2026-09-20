"""Words to candidate goals, with no model (spec M3P2.2)."""

import os
import subprocess
import sys

from code_weaver.find import Target, find

TARGETS = [
    Target("salmon", "Salmon", "Salmon estimates transcript abundance from RNA-seq reads."),
    Target(
        "read-mapping",
        "Mapping reads to a reference",
        "Mapping finds where in a reference each read could have come from.",
    ),
    Target(
        "multi-mapping-reads",
        "Multi-mapping reads",
        "A read that fits several transcripts equally well is kept for every one of them.",
    ),
    Target("k-mers", "k-mers", "A k-mer is a substring of length k taken from a read."),
    Target("kallisto", "kallisto", "kallisto quantifies transcripts by pseudoalignment."),
    Target(
        "sequencing-depth",
        "Sequencing depth",
        "Depth is how many reads a sequencing run produces for a sample.",
    ),
]


def test_a_name_finds_its_topic() -> None:
    assert find(TARGETS, "salmon").ids[0] == "salmon"


def test_a_question_finds_the_topic_that_answers_it() -> None:
    found = find(TARGETS, "why my reads don't map")
    assert found.words == ("reads", "map")
    assert found.ids[0] == "read-mapping"
    assert "multi-mapping-reads" in found.ids


def test_the_words_of_an_id_beat_a_claim() -> None:
    assert find(TARGETS, "read mapping").ids[0] == "read-mapping"


def test_a_single_letter_matches_exactly() -> None:
    assert find(TARGETS, "k").ids == ("k-mers",)


def test_a_prefix_finds_the_longer_word() -> None:
    assert "read-mapping" in find(TARGETS, "mapp").ids
    assert find(TARGETS, "sequenc").ids == ("sequencing-depth",)


def test_a_plural_finds_the_singular() -> None:
    assert "k-mers" in find(TARGETS, "reads").ids


def test_a_word_that_matches_nothing_is_named() -> None:
    found = find(TARGETS, "nanopore")
    assert found.ids == ()
    assert found.unmatched == ("nanopore",)


def test_a_word_that_matched_nothing_still_leaves_the_others() -> None:
    found = find(TARGETS, "salmon nanopore")
    assert found.ids[0] == "salmon"
    assert found.unmatched == ("nanopore",)


def test_a_query_of_only_stop_words_keeps_them() -> None:
    found = find(TARGETS, "how to")
    assert found.words == ("how", "to")
    assert found.ids == ()
    assert found.unmatched == ("how", "to")


def test_a_tie_is_broken_by_title_then_id() -> None:
    found = find(TARGETS, "why my reads don't map")
    assert found.ids.index("read-mapping") < found.ids.index("multi-mapping-reads")


def test_the_limit_is_kept() -> None:
    assert len(find(TARGETS, "read", limit=2).ids) == 2


def test_no_words_find_nothing() -> None:
    assert find(TARGETS, "   ") == find(TARGETS, "")
    assert find(TARGETS, "").ids == ()


def test_a_title_written_out_beats_a_mention() -> None:
    assert find(TARGETS, "sequencing depth").ids[0] == "sequencing-depth"


SHOW = """
from code_weaver.find import Target, find
targets = [Target(*row) for row in %r]
print(",".join(find(targets, "reads").ids))
"""


def test_the_order_does_not_depend_on_the_hash_seed() -> None:
    rows = [(target.id, target.title, target.claim) for target in TARGETS]
    outputs = {
        subprocess.run(
            [sys.executable, "-c", SHOW % rows],
            capture_output=True,
            text=True,
            check=True,
            env={**os.environ, "PYTHONHASHSEED": seed},
        ).stdout
        for seed in ("0", "1", "random")
    }
    assert len(outputs) == 1
