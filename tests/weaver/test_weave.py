"""Walk back and order (spec M2P1.4, M2P1.5, M2P1.7)."""

import os
import subprocess
import sys
from pathlib import Path

import pytest
from weaver.fixture_graph import FIXTURES, fixture_graph

from code_schema.content import read_content
from code_weaver.graph import Graph, Need, Topic
from code_weaver.weave import Route, UnknownGoal, weave

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
    assert weave(fixture_graph(), ["salmon"]) == Route(goals=("salmon",), stops=SALMON_ROUTE)


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
    assert route == Route(goals=("salmon", "tpm"), stops=SALMON_ROUTE)
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
    assert b"'salmon'" in outputs.pop()
