"""GET /api/nodes/{node_id}: one node from the index, with its neighbours (M1 part 6 spec, M1P6.3).

Read-only: the index is written only by `rebuild_index`. Three queries per node, whatever its
size. An id not in the index is a normal case (M1P5.3): 404, or 503 when no build was ever applied.
"""

from django.http import HttpRequest
from ninja import Router, Schema, Status

from code_api.content.models import IndexBuild, Link, Node, Question, Resource

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


class ProviderOut(Schema):
    id: str
    name: str


class ResourceOut(Schema):
    """One entry of the Learn it section (M3P1.2). Our sentence and a link, never their text."""

    kind: str
    provider: ProviderOut
    url: str
    part: str
    covers: str
    licence: str
    display: str
    level: str


class OptionOut(Schema):
    text: str
    right: bool


class QuestionOut(Schema):
    """A try question, its answer included: it is formative, and the page checks it (M3P1.4).

    Exam questions (T7.1) are scored, and their answers never leave the server.
    """

    id: str
    kind: str
    ask: str
    options: list[OptionOut] | None
    answer: float | None
    unit: str | None
    tolerance: float | None
    hints: list[str]
    rationale: str


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
    resources: list[ResourceOut]
    questions: list[QuestionOut]


class Message(Schema):
    detail: str


def _card(node: Node, reason: str) -> NeighbourOut:
    return NeighbourOut(id=node.id, title=node.title, level=node.level, reason=reason)


def _resource(resource: Resource) -> ResourceOut:
    return ResourceOut(
        kind=resource.kind,
        provider=ProviderOut(id=resource.provider.id, name=resource.provider.name),
        url=resource.url,
        part=resource.part,
        covers=resource.covers,
        licence=resource.licence,
        display=resource.display,
        level=resource.level,
    )


def _question(question: Question) -> QuestionOut:
    """A number has no options and a choice no answer, so the page knows which it is reading."""
    choice = question.kind == "choice"
    return QuestionOut(
        id=question.question_id,
        kind=question.kind,
        ask=question.ask,
        options=[OptionOut(**option) for option in question.options] if choice else None,
        answer=None if choice else question.answer,
        unit=question.unit or None,
        tolerance=question.tolerance,
        hints=list(question.hints),
        rationale=question.rationale,
    )


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
    resources = found.resources.select_related("provider").order_by("position")
    questions = found.questions.order_by("position")
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
            resources=[_resource(resource) for resource in resources],
            questions=[_question(question) for question in questions],
        ),
    )
