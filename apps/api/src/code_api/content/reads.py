"""What the content endpoints read from the index, and how a miss is answered (spec M4R.4).

The views call these and return what they give; nothing here knows a URL. Each read keeps its query
count whatever the content's size. M4.4's drafts read through here too, so a node can come from a
draft or from the index in one place.
"""

from collections.abc import Sequence
from typing import Any

from ninja import Status

from code_api.content.models import IndexBuild, Link, Node, Question, Region, Resource
from code_api.content.numbers import number_from
from code_api.content.schemas import (
    CalloutBlockOut,
    Message,
    NeighbourOut,
    NodeOut,
    OptionOut,
    ProviderOut,
    QuestionOut,
    RegionOut,
    ResourceOut,
    ResultOut,
    RouteOut,
    SearchOut,
    SideCardOut,
    SpanOut,
    StopOut,
    TextBlockOut,
    TryBlockOut,
)
from code_schema import Callout, Level, Text, Try, block_from_json
from code_weaver.find import Target, find
from code_weaver.graph import Graph, Need, Topic
from code_weaver.weave import weave


def unbuilt() -> Status[Message] | None:
    """The 503 when no build was ever applied, else nothing. Only a miss pays for this query."""
    if IndexBuild.objects.filter(outcome=IndexBuild.Outcome.APPLIED).exists():
        return None
    return Status(503, Message(detail="The index has not been built yet.", code="CA0001"))


def missing(ids: Sequence[str]) -> Status[Message]:
    """A miss: the 503 before any build, else the 404 naming what was asked for (M1P5.3)."""
    if (never := unbuilt()) is not None:
        return never
    named = ", ".join(f"'{node_id}'" for node_id in ids)
    detail = f"No topic with id {named}. It may have been removed or renamed."
    return Status(404, Message(detail=detail, code="CA0002"))


def _region(region: Region) -> RegionOut:
    return RegionOut(id=region.id, name=region.name)


def _card(node: Node, reason: str) -> SideCardOut:
    return SideCardOut(
        id=node.id, title=node.title, level=node.level, minutes=node.minutes, reason=reason
    )


def _resource(resource: Resource) -> ResourceOut:
    return ResourceOut(
        kind=resource.kind,
        provider=ProviderOut(id=resource.provider.id, name=resource.provider.name),
        url=resource.url,
        video=resource.video or None,
        part=resource.part,
        covers=resource.covers,
        licence=resource.licence,
        display=resource.display,
        level=resource.level,
    )


def _block(stored: dict[str, Any]) -> TextBlockOut | TryBlockOut | CalloutBlockOut:
    match block_from_json(stored):
        case Text(markdown=markdown):
            return TextBlockOut(kind="text", markdown=markdown)
        case Callout(kind=kind, title=title, markdown=markdown):
            return CalloutBlockOut(kind="callout", callout=kind, title=title, markdown=markdown)
        case Try(question=question):
            return TryBlockOut(kind="try", question=question)


def _question(question: Question) -> QuestionOut:
    """A number has no options and a choice no answer, so the page knows which it is reading."""
    choice = question.kind == "choice"
    return QuestionOut(
        id=question.question_id,
        kind=question.kind,
        ask=question.ask,
        options=[OptionOut(**option) for option in question.options] if choice else None,
        answer=None if choice else number_from(question.answer),
        unit=question.unit or None,
        tolerance=number_from(question.tolerance),
        hints=list(question.hints),
        rationale=question.rationale,
    )


def node(node_id: str) -> NodeOut | None:
    """One node with its neighbours, resources and questions, in five queries; None on a miss."""
    found = Node.objects.select_related("region").filter(id=node_id).first()
    if found is None:
        return None
    out: dict[str, list[SideCardOut]] = {kind: [] for kind in Link.Kind.values}
    for link in found.links_out.select_related("target").order_by("kind", "position"):
        out[link.kind].append(_card(link.target, link.reason))
    resources = found.resources.select_related("provider").order_by("position")
    questions = found.questions.order_by("position")
    incoming = found.links_in.filter(kind=Link.Kind.NEEDS).select_related("source")
    # Sorted here, not by the database: Postgres's collation and Python's differ on case.
    needed_by = sorted(incoming, key=lambda link: (link.source.title.casefold(), link.source.id))
    return NodeOut(
        id=found.id,
        title=found.title,
        claim=found.claim,
        region=_region(found.region),
        level=found.level,
        minutes=found.minutes,
        blocks=[_block(block) for block in found.blocks],
        folder=found.folder,
        needs=out[Link.Kind.NEEDS],
        goes_deeper=out[Link.Kind.GOES_DEEPER],
        related=out[Link.Kind.RELATED],
        needed_by=[_card(link.source, link.reason) for link in needed_by],
        resources=[_resource(resource) for resource in resources],
        questions=[_question(question) for question in questions],
    )


def _index() -> tuple[dict[str, Node], dict[str, Region], Graph]:
    """The index as rows plus the weaver's graph, in three queries.

    The whole index per request is the MVP's bargain (M2P4.3), to be replaced by a cache per index
    digest or by weaving in the database when the content grows.
    """
    regions = {region.id: region for region in Region.objects.order_by("position")}
    nodes = {row.id: row for row in Node.objects.all()}
    needs: dict[str, list[Need]] = {node_id: [] for node_id in nodes}
    links = Link.objects.filter(kind=Link.Kind.NEEDS).order_by("source_id", "position")
    for link in links:
        needs[link.source_id].append(Need(node=link.target_id, reason=link.reason))
    topics = [
        Topic(id=row.id, region=row.region_id, level=row.level, needs=tuple(needs[row.id]))
        for row in nodes.values()
    ]
    levels = [level.value for level in Level]
    return nodes, regions, Graph(topics, list(regions), levels)


def route(goals: Sequence[str], known: Sequence[str]) -> RouteOut:
    """The woven route to `goals`, each stop with why it is there.

    Raises `code_weaver.weave.UnknownGoal` for a goal the index does not hold.
    """
    nodes, regions, graph = _index()
    woven = weave(graph, goals, known=known)
    held = [topic for topic in dict.fromkeys(known) if topic in nodes and topic not in woven.goals]
    stops = [
        StopOut(
            id=nodes[stop].id,
            title=nodes[stop].title,
            claim=nodes[stop].claim,
            level=nodes[stop].level,
            minutes=nodes[stop].minutes,
            region=_region(regions[nodes[stop].region_id]),
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
    return RouteOut(
        goals=list(woven.goals),
        known=held,
        stops=stops,
        span=SpanOut(lowest=woven.span[0], highest=woven.span[1]),
        minutes=sum(nodes[stop].minutes for stop in woven.stops),
    )


def search(words: str, limit: int) -> SearchOut:
    """The candidates for `words`, ranked by `code_weaver.find`, in one query."""
    rows = {
        row.id: row
        for row in Node.objects.select_related("region").only(
            "id", "title", "claim", "level", "minutes", "region__id", "region__name"
        )
    }
    found = find(
        (Target(id=row.id, title=row.title, claim=row.claim) for row in rows.values()),
        words,
        limit=limit,
    )
    return SearchOut(
        query=words,
        unmatched=list(found.unmatched),
        results=[
            ResultOut(
                id=row.id,
                title=row.title,
                claim=row.claim,
                level=row.level,
                minutes=row.minutes,
                region=_region(row.region),
            )
            for row in (rows[identifier] for identifier in found.ids)
        ],
    )
