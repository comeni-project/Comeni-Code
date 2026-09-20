"""GET /api/search: typed words to candidate goals, from the index (spec M3P2.4).

One query, whatever the content's size: the ranking is `code_weaver.find`, the same function the
command runs over files, so the two can never disagree about what "salmon" finds. No model is
involved; M5's goal suggestions will sit in front of this, not replace it (W3.3 step 1).
"""

from typing import Annotated

from django.http import HttpRequest
from ninja import Query, Router, Schema, Status

from code_api.content.api import Message, RegionOut
from code_api.content.models import IndexBuild, Node
from code_weaver.find import Target, find

router = Router(tags=["content"])

BLANK = "A search needs a word."


class ResultOut(Schema):
    """A candidate as the Start board's *Is this what you mean?* panel shows it (L1)."""

    id: str
    title: str
    claim: str
    level: str
    minutes: int
    region: RegionOut


class SearchOut(Schema):
    query: str
    # The words that matched nothing anywhere, so the page can name them (M3P2.2).
    unmatched: list[str]
    results: list[ResultOut]


@router.get(
    "",
    response={200: SearchOut, 422: Message, 503: Message},
    summary="Topics matching the words someone types",
)
def search(
    request: HttpRequest,
    q: str,
    # A bare Query(...) default fails mypy's type-arg check (M2 part 4's trap).
    limit: Annotated[int, Query(ge=1, le=50)] = 10,
) -> Status[SearchOut] | Status[Message]:
    if not q.strip():
        return Status(422, Message(detail=BLANK))
    rows = {
        node.id: node
        for node in Node.objects.select_related("region").only(
            "id", "title", "claim", "level", "minutes", "region__id", "region__name"
        )
    }
    found = find(
        (Target(id=node.id, title=node.title, claim=node.claim) for node in rows.values()),
        q,
        limit=limit,
    )
    if not found.ids and not IndexBuild.objects.filter(outcome=IndexBuild.Outcome.APPLIED).exists():
        # Only a miss pays for this query, as on the node endpoint (M1P6.4).
        return Status(503, Message(detail="The index has not been built yet."))
    return Status(
        200,
        SearchOut(
            query=q,
            unmatched=list(found.unmatched),
            results=[
                ResultOut(
                    id=node.id,
                    title=node.title,
                    claim=node.claim,
                    level=node.level,
                    minutes=node.minutes,
                    region=RegionOut(id=node.region.id, name=node.region.name),
                )
                for node in (rows[identifier] for identifier in found.ids)
            ],
        ),
    )
