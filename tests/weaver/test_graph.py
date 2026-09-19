"""The weaver's graph is checked when it is built (spec M2P1.2, M2P1.3)."""

import pytest

from code_weaver.graph import Graph, GraphError, Need, Topic

REGIONS = ["biology", "statistics"]


def topic(name: str, *needs: str, region: str = "biology") -> Topic:
    return Topic(
        id=name,
        region=region,
        level="foundations",
        needs=tuple(Need(node=n, reason=f"{name} uses {n}") for n in needs),
    )


def refusal(topics: list[Topic], regions: list[str] = REGIONS) -> str:
    with pytest.raises(GraphError) as caught:
        Graph(topics, regions)
    return str(caught.value)


def test_a_sound_graph_keeps_its_topics_and_region_order() -> None:
    graph = Graph([topic("b", "a"), topic("a")], REGIONS)
    assert graph.topics["b"].needs == (Need(node="a", reason="b uses a"),)
    assert sorted(graph.topics) == ["a", "b"]
    assert graph.regions == ("biology", "statistics")


def test_a_duplicate_id_is_refused() -> None:
    assert refusal([topic("a"), topic("a")]) == "duplicate id: a"


def test_an_unknown_region_is_refused() -> None:
    assert refusal([topic("a", region="nowhere")]) == (
        "a: region nowhere is not in the region list"
    )


def test_a_need_outside_the_graph_is_refused() -> None:
    assert refusal([topic("a", "ghost")]) == "a: needs ghost, which is not in the graph"


def test_a_cycle_is_refused_naming_its_ring() -> None:
    assert refusal([topic("a", "b"), topic("b", "c"), topic("c", "a")]) == (
        "needs cycle: a → b → c → a"
    )


def test_a_topic_that_needs_itself_is_a_cycle() -> None:
    assert refusal([topic("a", "a")]) == "needs cycle: a → a"


def test_a_cycle_nothing_leads_to_is_still_refused() -> None:
    topics = [topic("goal", "base"), topic("base"), topic("x", "y"), topic("y", "x")]
    assert refusal(topics) == "needs cycle: x → y → x"


def test_every_problem_is_listed_in_a_fixed_order() -> None:
    topics = [
        topic("p", "q"),
        topic("q", "p"),
        topic("a", "ghost"),
        topic("a"),
        topic("r", region="nowhere"),
    ]
    assert refusal(topics).splitlines() == [
        "duplicate id: a",
        "r: region nowhere is not in the region list",
        "a: needs ghost, which is not in the graph",
        "needs cycle: p → q → p",
    ]
