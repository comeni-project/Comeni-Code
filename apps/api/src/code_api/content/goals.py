"""Anonymous learner goal suggestions; every model choice is constrained to indexed candidates."""

from django.http import HttpRequest
from ninja import Router, Status

from code_api.ai.goals import MAX_QUERY_LENGTH, suggest
from code_api.content.schemas import GoalSuggestIn, Message, SearchOut

router = Router(tags=["content"])


@router.post(
    "/suggest",
    response={200: SearchOut, 422: Message, 503: Message},
    summary="Suggest existing goals for a learner's words",
)
def goals_suggest(request: HttpRequest, body: GoalSuggestIn) -> Status[SearchOut] | Status[Message]:
    query = body.query
    if not query.strip():
        return Status(422, Message(detail="A search needs a word.", code="CA0003"))
    if len(query) > MAX_QUERY_LENGTH:
        return Status(
            422,
            Message(
                detail=f"A goal query can be at most {MAX_QUERY_LENGTH} characters.",
                code="CA0409",
            ),
        )
    answer = suggest(query.strip())
    if not answer.results:
        from code_api.content import reads

        if (never := reads.unbuilt()) is not None:
            return never
    return Status(200, answer)
