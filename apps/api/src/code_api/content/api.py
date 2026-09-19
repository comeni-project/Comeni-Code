"""GET /api/nodes/{node_id}: one node from the index, with its neighbours (M1 part 6 spec, M1P6.3).

Read-only: the index is written only by `rebuild_index`. Three queries per node, whatever its
size. An id not in the index is a normal case (M1P5.3): 404, or 503 when no build was ever applied.
"""

from django.http import HttpRequest
from ninja import Router, Schema, Status

from code_api.content.models import IndexBuild, Link, Node

router = Router(tags=["content"])


class RegionOut(Schema):
    id: str
    name: str


class NeighbourOut(Schema):
    """A neighbour as a card: enough for a node page's side panel (L5) without another request."""

    id: str
    title: str
    level: str
    reason: str


class NodeOut(Schema):
    id: str
    title: str
    claim: str
    region: RegionOut
    level: str
    minutes: int
    body: str
    folder: str
    needs: list[NeighbourOut]
    goes_deeper: list[NeighbourOut]
    related: list[NeighbourOut]
    needed_by: list[NeighbourOut]


class Message(Schema):
    detail: str


def _card(node: Node, reason: str) -> NeighbourOut:
    return NeighbourOut(id=node.id, title=node.title, level=node.level, reason=reason)


@router.get(
    "/{node_id}",
    response={200: NodeOut, 404: Message, 503: Message},
    summary="A node and its neighbours",
)
def node(request: HttpRequest, node_id: str) -> Status[NodeOut] | Status[Message]:
    found = Node.objects.select_related("region").filter(id=node_id).first()
    if found is None:
        # Only a miss pays for this query.
        if not IndexBuild.objects.filter(outcome=IndexBuild.Outcome.APPLIED).exists():
            return Status(503, Message(detail="The index has not been built yet."))
        detail = f"No topic with id '{node_id}'. It may have been removed or renamed."
        return Status(404, Message(detail=detail))
    out: dict[str, list[NeighbourOut]] = {kind: [] for kind in Link.Kind.values}
    for link in found.links_out.select_related("target").order_by("kind", "position"):
        out[link.kind].append(_card(link.target, link.reason))
    incoming = found.links_in.filter(kind=Link.Kind.NEEDS).select_related("source")
    # Sorted here, not by the database: Postgres's collation and Python's differ on case.
    needed_by = sorted(incoming, key=lambda link: (link.source.title.casefold(), link.source.id))
    return Status(
        200,
        NodeOut(
            id=found.id,
            title=found.title,
            claim=found.claim,
            region=RegionOut(id=found.region.id, name=found.region.name),
            level=found.level,
            minutes=found.minutes,
            body=found.body,
            folder=found.folder,
            needs=out[Link.Kind.NEEDS],
            goes_deeper=out[Link.Kind.GOES_DEEPER],
            related=out[Link.Kind.RELATED],
            needed_by=[_card(link.source, link.reason) for link in needed_by],
        ),
    )
