"""Walk back and order (spec M2P1.4, M2P1.5, M2P1.7)."""

import os
import subprocess
import sys
from pathlib import Path

import pytest
from weaver.fixture_graph import FIXTURES, fixture_graph

from code_schema.content import read_content
from code_weaver.graph import Graph, Need, Topic
from code_weaver.weave import NeededBy, UnknownGoal, weave

TESTS = Path(__file__).resolve().parents[1]

SALMON_ROUTE = (
    "dna-and-genes",
    "gene-expression",
    "splicing",
    "transcripts-and-isoforms",
    "short-read-sequencing",
    "fastq-and-quality-scores",
    "rna-seq-libraries",
    "k-mers",
    "sequence-alignment",
    "read-mapping",
    "multi-mapping-reads",
    "probability",
    "likelihood",
    "mixture-models",
    "em-algorithm",
    "tpm",
    "salmon",
)


def topic(name: str, *needs: str, region: str = "a-region") -> Topic:
    return Topic(
        id=name,
        region=region,
        level="foundations",
        needs=tuple(Need(node=n, reason=f"{name} uses {n}") for n in needs),
    )


def test_salmon_gives_the_seventeen_stops_in_order() -> None:
    route = weave(fixture_graph(), ["salmon"])
    assert (route.goals, route.stops) == (("salmon",), SALMON_ROUTE)


def test_every_stop_follows_all_it_needs_for_every_goal() -> None:
    graph = fixture_graph()
    for goal in graph.topics:
        stops = weave(graph, [goal]).stops
        place = {stop: i for i, stop in enumerate(stops)}
        assert stops[-1] == goal
        for stop in stops:
            for need in graph.topics[stop].needs:
                assert place[need.node] < place[stop], (goal, stop, need.node)


def test_only_needs_are_followed() -> None:
    salmon = read_content(FIXTURES).nodes["salmon"]
    off_route = {link.node for link in (*salmon.goes_deeper, *salmon.related)}
    assert len(off_route) == 6
    assert off_route.isdisjoint(weave(fixture_graph(), ["salmon"]).stops)


def test_levels_never_change_the_route() -> None:
    for level in ("first-steps", "advanced"):
        assert weave(fixture_graph(every_level=level), ["salmon"]).stops == SALMON_ROUTE


def test_topic_order_in_the_graph_changes_nothing() -> None:
    graph = fixture_graph()
    reversed_graph = Graph(reversed(list(graph.topics.values())), graph.regions, graph.levels)
    assert weave(reversed_graph, ["salmon"]).stops == SALMON_ROUTE


def test_goals_are_a_set() -> None:
    graph = fixture_graph()
    route = weave(graph, ["tpm", "salmon", "tpm"])
    assert (route.goals, route.stops) == (("salmon", "tpm"), SALMON_ROUTE)
    assert weave(graph, ["salmon", "tpm"]) == route


def test_unknown_goals_are_named() -> None:
    with pytest.raises(UnknownGoal) as caught:
        weave(fixture_graph(), ["zzz", "salmon", "aaa"])
    assert caught.value.ids == ("aaa", "zzz")
    assert str(caught.value) == "not in the graph: aaa, zzz"


def test_no_goals_is_an_error() -> None:
    with pytest.raises(ValueError, match="at least one goal"):
        weave(fixture_graph(), [])


def test_region_breaks_a_tie_before_the_author_order() -> None:
    graph = Graph(
        [topic("g", "x", "y"), topic("x"), topic("y", region="first-region")],
        ["first-region", "a-region"],
        ["foundations"],
    )
    assert weave(graph, ["g"]).stops == ("y", "x", "g")


def test_first_reached_breaks_a_tie_within_a_region() -> None:
    graph = Graph([topic("g", "z", "a"), topic("z"), topic("a")], ["a-region"], ["foundations"])
    assert weave(graph, ["g"]).stops == ("z", "a", "g")


def test_a_need_comes_first_whatever_its_region() -> None:
    graph = Graph(
        [topic("g", "x"), topic("x", region="last-region")],
        ["a-region", "last-region"],
        ["foundations"],
    )
    assert weave(graph, ["g"]).stops == ("x", "g")


SCRIPT = (
    "from code_weaver.weave import weave\n"
    "from weaver.fixture_graph import fixture_graph\n"
    "print(weave(fixture_graph(), ['salmon', 'em-algorithm']))\n"
)


def test_fresh_processes_print_byte_identical_routes() -> None:
    outputs = {
        subprocess.run(
            [sys.executable, "-c", SCRIPT],
            env={**os.environ, "PYTHONHASHSEED": seed, "PYTHONPATH": str(TESTS)},
            capture_output=True,
            check=True,
        ).stdout
        for seed in ("0", "1", "2", "random")
    }
    assert len(outputs) == 1
    assert b"NeededBy(node='salmon'" in outputs.pop()


LEARNED_FIRST = ("read-mapping", "k-mers", "sequence-alignment")


def test_a_stop_lists_the_route_stops_that_need_it_with_their_reasons() -> None:
    route = weave(fixture_graph(), ["salmon"])
    assert route.needed_by["transcripts-and-isoforms"] == (
        NeededBy(
            node="multi-mapping-reads",
            reason="Isoforms share exons, so a read from a shared exon fits all of them.",
        ),
        NeededBy(node="tpm", reason="TPM is measured per transcript."),
        NeededBy(
            node="salmon",
            reason="Salmon estimates abundance per transcript, and isoforms are why that is hard.",
        ),
    )


def test_needed_by_is_the_stored_needs_on_the_route_for_every_goal() -> None:
    graph = fixture_graph()
    for goal in graph.topics:
        route = weave(graph, [goal])
        assert tuple(route.needed_by) == route.stops
        for stop in route.stops:
            users = [s for s in route.stops if any(n.node == stop for n in graph.topics[s].needs)]
            assert [entry.node for entry in route.needed_by[stop]] == users, (goal, stop)


def test_a_goal_is_needed_only_by_other_goals() -> None:
    graph = fixture_graph()
    assert weave(graph, ["salmon"]).needed_by["salmon"] == ()
    both = weave(graph, ["salmon", "tpm"]).needed_by
    assert [entry.node for entry in both["tpm"]] == ["salmon"]


def test_the_walk_stops_at_a_known_topic() -> None:
    route = weave(fixture_graph(), ["salmon"], known=["read-mapping"])
    assert route.stops == tuple(s for s in SALMON_ROUTE if s not in LEARNED_FIRST)
    assert len(route.stops) == 14
    assert [entry.node for entry in route.needed_by["short-read-sequencing"]] == [
        "fastq-and-quality-scores",
        "rna-seq-libraries",
    ]


def test_known_edge_cases() -> None:
    graph = fixture_graph()
    assert weave(graph, ["salmon"], known=["salmon"]).stops == SALMON_ROUTE
    assert weave(graph, ["salmon"], known=["no-such-topic"]).stops == SALMON_ROUTE
    assert weave(graph, ["salmon"], known=["read-mapping", "k-mers", "read-mapping"]) == weave(
        graph, ["salmon"], known=["k-mers", "read-mapping"]
    )


def test_the_span_follows_the_level_order() -> None:
    graph = fixture_graph()
    assert weave(graph, ["salmon"]).span == ("first-steps", "intermediate")
    assert weave(graph, ["em-algorithm"]).span == ("first-steps", "intermediate")
    assert weave(graph, ["dna-and-genes"]).span == ("first-steps", "first-steps")


def test_every_level_changed_keeps_the_route_and_spans_one_level() -> None:
    route = weave(fixture_graph(every_level="advanced"), ["salmon"])
    assert route.stops == SALMON_ROUTE
    assert route.span == ("advanced", "advanced")
