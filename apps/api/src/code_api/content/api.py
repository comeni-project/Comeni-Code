"""GET /api/nodes/{node_id}: one node from the index, with its neighbours (M1 part 6 spec, M1P6.3).

Read-only: the index is written only by `rebuild_index`. Six queries per node, whatever its size;
its image files are served apart (M6IM.3). An id not in the index is a normal case (M1P5.3): 404, or
503 when no build was ever applied.
"""

from django.http import HttpRequest, HttpResponse
from ninja import Router, Status

from code_api.content import reads
from code_api.content.schemas import Message, NodeOut

router = Router(tags=["content"])


@router.get(
    "/{node_id}",
    response={200: NodeOut, 404: Message, 503: Message},
    summary="A node and its neighbours",
)
def node(request: HttpRequest, node_id: str) -> Status[NodeOut] | Status[Message]:
    found = reads.node(node_id)
    return reads.missing([node_id]) if found is None else Status(200, found)


@router.get(
    "/{node_id}/images/{file}",
    response={200: None, 404: Message, 503: Message},
    summary="A node's image file",
)
def image(request: HttpRequest, node_id: str, file: str) -> HttpResponse | Status[Message]:
    """The file as it landed, cached a day: a new file lands under its node's new build (M6IM.3)."""
    found = reads.image(node_id, file)
    if found is None:
        return (
            reads.missing([node_id])
            if reads.node(node_id) is None
            else Status(404, Message(detail=f"{node_id} has no image {file}.", code="CA0008"))
        )
    data, media_type = found
    answer = HttpResponse(data, content_type=media_type)
    answer["Cache-Control"] = "public, max-age=86400"
    return answer
