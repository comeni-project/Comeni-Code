"""GET /api/routes: a woven route from the index (spec M2P4).

Three queries, whatever the route's size: the nodes, the needs links and the regions. The whole
index is loaded per request — the MVP's bargain (M2P4.3), to be replaced by a cache per index
digest or by weaving in the database when the content grows.
"""

from typing import Annotated

from django.http import HttpRequest
from ninja import Query, Router, Schema, Status

from code_api.content.api import Message, NeighbourOut, RegionOut
from code_api.content.models import IndexBuild, Link, Node, Region
from code_schema import Level
from code_weaver.graph import Graph, Need, Topic
from code_weaver.weave import UnknownGoal, weave

router = Router(tags=["content"])


class StopOut(Schema):
    """A stop as the Route board draws it (L4), with why it is on this route (M2P2.2)."""

    id: str
    title: str
    # The panel's first line, and the page's outcome sentence when the stop is the goal (M3P4.1).
    claim: str
    level: str
    minutes: int
    region: RegionOut
    needed_by: list[NeighbourOut]


class SpanOut(Schema):
    lowest: str
    highest: str


class RouteOut(Schema):
    goals: list[str]
    known: list[str]
    stops: list[StopOut]
    span: SpanOut
    minutes: int


def _index() -> tuple[dict[str, Node], dict[str, Region], Graph]:
    """The index as rows plus the weaver's graph, in three queries."""
    regions = {region.id: region for region in Region.objects.order_by("position")}
    nodes = {node.id: node for node in Node.objects.all()}
    needs: dict[str, list[Need]] = {node_id: [] for node_id in nodes}
    links = Link.objects.filter(kind=Link.Kind.NEEDS).order_by("source_id", "position")
    for link in links:
        needs[link.source_id].append(Need(node=link.target_id, reason=link.reason))
    topics = [
        Topic(id=node.id, region=node.region_id, level=node.level, needs=tuple(needs[node.id]))
        for node in nodes.values()
    ]
    levels = [level.value for level in Level]
    return nodes, regions, Graph(topics, list(regions), levels)


@router.get(
    "",
    response={200: RouteOut, 404: Message, 503: Message},
    summary="A route to one or more goals",
)
def route(
    request: HttpRequest,
    goal: Annotated[list[str], Query()],
    known: Annotated[list[str] | None, Query()] = None,
) -> Status[RouteOut] | Status[Message]:
    held_ids = known or []
    nodes, regions, graph = _index()
    try:
        woven = weave(graph, goal, known=held_ids)
    except UnknownGoal as unknown:
        # Only a miss pays for this query.
        if not IndexBuild.objects.filter(outcome=IndexBuild.Outcome.APPLIED).exists():
            return Status(503, Message(detail="The index has not been built yet."))
        missing = ", ".join(f"'{goal_id}'" for goal_id in unknown.ids)
        detail = f"No topic with id {missing}. It may have been removed or renamed."
        return Status(404, Message(detail=detail))
    held = [
        topic for topic in dict.fromkeys(held_ids) if topic in nodes and topic not in woven.goals
    ]
    stops = [
        StopOut(
            id=nodes[stop].id,
            title=nodes[stop].title,
            claim=nodes[stop].claim,
            level=nodes[stop].level,
            minutes=nodes[stop].minutes,
            region=RegionOut(
                id=regions[nodes[stop].region_id].id, name=regions[nodes[stop].region_id].name
            ),
            needed_by=[
                NeighbourOut(
                    id=nodes[entry.node].id,
                    title=nodes[entry.node].title,
                    level=nodes[entry.node].level,
                    reason=entry.reason,
                )
                for entry in woven.needed_by[stop]
            ],
        )
        for stop in woven.stops
    ]
    return Status(
        200,
        RouteOut(
            goals=list(woven.goals),
            known=held,
            stops=stops,
            span=SpanOut(lowest=woven.span[0], highest=woven.span[1]),
            minutes=sum(nodes[stop].minutes for stop in woven.stops),
        ),
    )
