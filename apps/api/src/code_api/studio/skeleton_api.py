"""Author-only outline imports and explicit mapping into the human request queue."""

from datetime import timedelta
from typing import Any, Literal
from uuid import UUID

from django.http import HttpRequest
from django.utils import timezone
from ninja import Router, Schema, Status
from pydantic import Field

from code_api.accounts.access import studio
from code_api.accounts.models import User
from code_api.accounts.roles import Role
from code_api.ai.evaluation import PartScore
from code_api.content.schemas import Message
from code_api.studio import skeletons
from code_api.studio.models import SkeletonImport
from code_api.studio.requests import RequestError

router = Router(tags=["studio"], auth=studio(Role.AUTHOR))


class SkeletonIn(Schema):
    kind: Literal["college-board", "openstax", "galaxy-training", "carpentries"]
    url: str = Field(max_length=1000)
    version: str = Field(min_length=1, max_length=240)
    licence: str = Field(min_length=1, max_length=240)
    outline: str = Field(min_length=1, max_length=16000)
    rights: bool


class SkeletonScoreOut(Schema):
    key: str
    score: int
    reason: str
    rubric: str
    parts: dict[str, PartScore]


class SkeletonOut(Schema):
    public_id: UUID
    state: str
    version: int
    code: str
    source_kind: str
    source_url: str
    source_version: str
    licence: str
    outline: str
    result: skeletons.SkeletonReply | None
    scores: list[SkeletonScoreOut]
    mappings: dict[str, skeletons.StubMapping]
    sent: dict[str, str]


class SendSkeletonIn(Schema):
    version: int = Field(ge=1)
    mappings: dict[str, skeletons.StubMapping]
    note: str = Field(min_length=1, max_length=4000)


def out(made: SkeletonImport) -> SkeletonOut:
    if (
        made.state == "running"
        and made.started_at
        and made.started_at < timezone.now() - timedelta(minutes=6)
    ):
        SkeletonImport.objects.filter(pk=made.pk, state="running").update(
            state="failed", code="CA0603"
        )
        made.refresh_from_db()
    return SkeletonOut(
        public_id=made.public_id,
        state=made.state,
        version=made.version,
        code=made.code,
        source_kind=made.source_kind,
        source_url=made.source_url,
        source_version=made.source_version,
        licence=made.licence,
        outline=made.outline,
        result=None if not made.result else skeletons.SkeletonReply.model_validate(made.result),
        scores=made.scores,
        mappings=made.mappings,
        sent=made.sent,
    )


@router.get("", response=list[SkeletonOut])
def imports(request: HttpRequest) -> Any:
    return [out(made) for made in SkeletonImport.objects.order_by("-pk")[:100]]


@router.post("", response={200: SkeletonOut, 409: Message})
def create(request: HttpRequest, body: SkeletonIn) -> Any:
    assert isinstance(request.user, User)
    try:
        return out(skeletons.create(by=request.user, **body.model_dump()))
    except (RequestError, ValueError) as error:
        return Status(409, Message(code="CA0603", detail=str(error)))


@router.get("/{identity}", response={200: SkeletonOut, 404: Message})
def read(request: HttpRequest, identity: UUID) -> Any:
    made = SkeletonImport.objects.filter(public_id=identity).first()
    if made is None:
        return Status(404, Message(code="CA0603", detail="No skeleton import has that id."))
    return out(made)


@router.post("/{identity}/send", response={200: SkeletonOut, 409: Message})
def send(request: HttpRequest, identity: UUID, body: SendSkeletonIn) -> Any:
    assert isinstance(request.user, User)
    if len(body.mappings) > 20:
        return Status(409, Message(code="CA0603", detail="Choose at most 20 proposed stubs."))
    try:
        return out(
            skeletons.send(identity, body.version, body.mappings, by=request.user, note=body.note)
        )
    except RequestError as error:
        return Status(409, Message(code="CA0603", detail=str(error)))
