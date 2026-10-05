"""GET /api/nodes/{node_id}: one node from the index, with its neighbours (M1 part 6 spec, M1P6.3).

Read-only: the index is written only by `rebuild_index`. Five queries per node, whatever its size.
An id not in the index is a normal case (M1P5.3): 404, or 503 when no build was ever applied.
"""

from django.http import HttpRequest
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
