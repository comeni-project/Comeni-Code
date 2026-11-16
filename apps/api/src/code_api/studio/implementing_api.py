"""S8 reads the real draft state and writes through the accepted-request service."""

from datetime import datetime
from typing import Any
from uuid import UUID

from django.db import transaction
from django.http import HttpRequest
from ninja import Router, Schema, Status
from pydantic import Field

from code_api.accounts.access import studio
from code_api.accounts.models import User
from code_api.accounts.roles import Role, can_act_as
from code_api.content.schemas import Message
from code_api.studio import implementing
from code_api.studio.models import ContentRequest
from code_api.studio.requests import RequestError
from code_schema import Level

router = Router(tags=["studio"], auth=studio(Role.AUTHOR))


class WorkItemOut(Schema):
    public_id: UUID
    title: str
    version: int
    stage: str
    assignee_id: UUID | None
    assignee: str
    draft_id: UUID | None
    node_id: str
    asked: int
    stalled: bool
    updated_at: datetime


class WorkerOut(Schema):
    public_id: UUID
    name: str
    writing: int
    reviewing: int


class AssignmentIn(Schema):
    identity: UUID
    version: int = Field(ge=1)


class AssignWorkIn(Schema):
    items: list[AssignmentIn] = Field(min_length=1, max_length=50)
    assignee: UUID | None = None


class StartWorkIn(Schema):
    version: int = Field(ge=1)
    node_id: str = Field(pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$", max_length=100)
    claim: str = Field(min_length=1, max_length=1000)
    region: str = Field(min_length=1, max_length=100)
    level: Level = Level.INTRODUCTORY
    minutes: int = Field(ge=1, le=480)


def out(item: ContentRequest) -> WorkItemOut:
    return WorkItemOut(
        public_id=item.public_id,
        title=item.title,
        version=item.version,
        stage=implementing.stage(item),
        assignee_id=None if item.assignee is None else item.assignee.public_id,
        assignee="Unassigned" if item.assignee is None else item.assignee.name,
        draft_id=None if item.draft is None else item.draft.public_id,
        node_id="" if item.draft is None else item.draft.node_id,
        asked=max(1, item.submissions.count()),
        stalled=implementing.stalled(item),
        updated_at=item.updated_at,
    )


@router.get("", response=list[WorkItemOut])
def queue(request: HttpRequest) -> Any:
    items = list(
        ContentRequest.objects.filter(state__in=["accepted", "implementing"]).select_related(
            "draft", "assignee"
        )
    )
    # Count demand from submissions; persisted route candidates later supply route impact.
    rows = [out(item) for item in items]
    return sorted(rows, key=lambda row: (-row.asked, row.updated_at, str(row.public_id)))


@router.get("/team", response=list[WorkerOut])
def team(request: HttpRequest) -> Any:
    items = ContentRequest.objects.filter(state__in=["accepted", "implementing"]).select_related(
        "draft"
    )
    rows = []
    for user in User.objects.filter(is_active=True).order_by("name", "pk"):
        if can_act_as(user.role, Role.AUTHOR):
            assigned = [item for item in items if item.assignee_id == user.pk]
            rows.append(
                WorkerOut(
                    public_id=user.public_id,
                    name=user.name,
                    writing=sum(
                        implementing.stage(item) in {"accepted", "writing"} for item in assigned
                    ),
                    reviewing=sum(
                        implementing.stage(item) == "waiting for review" for item in assigned
                    ),
                )
            )
    return rows


@router.post("/assign", response={200: list[WorkItemOut], 409: Message})
def assign(request: HttpRequest, body: AssignWorkIn) -> Any:
    assert isinstance(request.user, User)
    try:
        with transaction.atomic():
            ids = [item.identity for item in body.items]
            if len(ids) != len(set(ids)):
                raise RequestError("Choose each request once.")
            list(
                ContentRequest.objects.select_for_update().filter(public_id__in=ids).order_by("pk")
            )
            return [
                out(
                    implementing.assign(item.identity, item.version, body.assignee, by=request.user)
                )
                for item in body.items
            ]
    except RequestError as error:
        return Status(409, Message(code="CA0600", detail=str(error)))


@router.post("/{identity}/start", response={200: WorkItemOut, 409: Message})
def start(request: HttpRequest, identity: UUID, body: StartWorkIn) -> Any:
    assert isinstance(request.user, User)
    try:
        return out(implementing.start(identity, by=request.user, **body.model_dump()))
    except (RequestError, ValueError) as error:
        return Status(409, Message(code="CA0600", detail=str(error)))
