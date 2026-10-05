"""GET /api/routes: a woven route from the index (spec M2P4).

Three queries, whatever the route's size: the nodes, the needs links and the regions.
"""

from typing import Annotated

from django.http import HttpRequest
from ninja import Query, Router, Status

from code_api.content import reads
from code_api.content.schemas import Message, RouteOut
from code_weaver.weave import UnknownGoal

router = Router(tags=["content"])


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
    try:
        return Status(200, reads.route(goal, known or []))
    except UnknownGoal as unknown:
        return reads.missing(unknown.ids)
