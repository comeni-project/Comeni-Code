"""GET /api/search: typed words to candidate goals, from the index (spec M3P2.4).

One query, whatever the content's size: the ranking is `code_weaver.find`, the same function the
command runs over files, so the two can never disagree about what "salmon" finds. No model is
involved; M5's goal suggestions will sit in front of this, not replace it (W3.3 step 1).
"""

from typing import Annotated

from django.http import HttpRequest
from ninja import Query, Router, Status

from code_api.content import reads
from code_api.content.schemas import Message, SearchOut

router = Router(tags=["content"])

BLANK = "A search needs a word."


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
        return Status(422, Message(detail=BLANK, code="CA0003"))
    found = reads.search(q, limit)
    # Nothing found may mean nothing built: only then does the miss pay for that query (M1P6.4).
    if not found.results and (never := reads.unbuilt()) is not None:
        return never
    return Status(200, found)
