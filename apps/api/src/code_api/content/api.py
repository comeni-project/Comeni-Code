"""GET /api/nodes/{node_id}: one node from the index, with its neighbours (M1 part 6 spec, M1P6.3).

Read-only: the index is written only by `rebuild_index`. Six queries per node, whatever its size;
its image files are served apart (M6IM.3). An id not in the index is a normal case (M1P5.3): 404, or
503 when no build was ever applied.
"""

from django.http import HttpRequest, HttpResponse
from ninja import Router, Status

from code_api.content import problems, reads
from code_api.content.models import Node, NodeProblem
from code_api.content.schemas import AnswerIn, AnswerOut, Message, NodeOut
from code_schema.problem_file import ProblemFile

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


ANSWER_BYTES = 1_000_000  # the largest allowed problem's answer is ~660 KB (M6LP.4)


def _problem(
    node_id: str, seed: str, version: str, answer: str | None = None
) -> tuple[ProblemFile, int] | Status[Message]:
    """The node's problem and the learner's seed, or why not, in the order M6LP.3 gives."""
    if not Node.objects.filter(id=node_id).exists():
        return reads.missing([node_id])
    row = NodeProblem.objects.filter(node_id=node_id).first()
    if row is None:
        return Status(404, Message(detail=f"{node_id} has no problem.", code="CA0009"))
    found = problems.seed_of(seed)
    if found is None:
        said = "A seed is a whole number below 2**64, written in digits."
        return Status(422, Message(detail=said, code="CA0011"))
    if answer is not None and len(answer.encode()) > ANSWER_BYTES:
        said = "An answer can be at most 1 MB."
        return Status(422, Message(detail=said, code="CA0012"))
    problem = problems.stored(row)
    if problems.version(problem) != version:
        said = (
            "This problem was updated after you downloaded your dataset. Download it again; "
            "your answer to the old one can't be checked."
        )
        return Status(409, Message(detail=said, code="CA0010"))
    return problem, found


@router.get(
    "/{node_id}/problem/dataset",
    response={200: None, 404: Message, 409: Message, 422: Message, 503: Message},
    summary="A learner's dataset for the node's problem",
)
def dataset(
    request: HttpRequest, node_id: str, seed: str = "", version: str = ""
) -> HttpResponse | Status[Message]:
    """The file made from the seed: the same URL always gives the same bytes (M6LP.3)."""
    found = _problem(node_id, seed, version)
    if isinstance(found, Status):
        return found
    made = problems.dataset(*found)
    answer = HttpResponse(made.text, content_type="text/plain; charset=utf-8")
    answer["Content-Disposition"] = f'attachment; filename="{made.name}"'
    answer["Cache-Control"] = "private, max-age=86400"
    return answer


@router.post(
    "/{node_id}/problem/answer",
    response={200: AnswerOut, 404: Message, 409: Message, 422: Message, 503: Message},
    summary="A learner's answer to the node's problem, checked by its kit",
)
def answer(
    request: HttpRequest, node_id: str, sent: AnswerIn
) -> Status[AnswerOut] | Status[Message]:
    """Right or not, the kit's sentence, the callouts its mistakes point to; nothing is kept."""
    found = _problem(node_id, sent.seed, sent.version, sent.answer)
    if isinstance(found, Status):
        return found
    return Status(200, problems.verdict(*found, sent.answer))
