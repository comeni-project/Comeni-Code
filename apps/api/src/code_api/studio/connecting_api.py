"""Learner-facing optional route text; no model is called on a route GET."""

from datetime import timedelta
from typing import Any
from uuid import UUID

from django.http import HttpRequest
from django.utils import timezone
from ninja import Router, Schema, Status
from pydantic import Field

from code_api.content.schemas import Message
from code_api.studio import connecting
from code_api.studio.models import RouteBundle
from code_api.studio.request_api import limited

router = Router(tags=["content"])


class ConnectIn(Schema):
    goals: list[str] = Field(min_length=1, max_length=3)
    known: list[str] = Field(default_factory=list, max_length=200)


class RouteClaimOut(Schema):
    id: str
    title: str
    claim: str


class TextContextOut(Schema):
    key: str
    kind: str
    claims: list[RouteClaimOut]
    goals: list[RouteClaimOut]


class RouteTextOut(Schema):
    key: str
    kind: str
    text: str
    state: str
    version: int
    flags: list[str]
    context: TextContextOut


class RouteBundleOut(Schema):
    public_id: UUID
    state: str
    code: str
    goals: list[str]
    known: list[str]
    texts: list[RouteTextOut]


def out(bundle: RouteBundle) -> RouteBundleOut:
    if (
        bundle.state == "running"
        and bundle.started_at
        and bundle.started_at < timezone.now() - timedelta(minutes=2)
    ):
        RouteBundle.objects.filter(pk=bundle.pk, state="running").update(
            state="failed", code="CA0602"
        )
        bundle.refresh_from_db()
    valid = connecting.current(bundle)
    return RouteBundleOut(
        public_id=bundle.public_id,
        state=bundle.state if valid else "flagged",
        code=bundle.code,
        goals=bundle.snapshot["goals"],
        known=bundle.snapshot["known"],
        texts=[
            RouteTextOut(
                key=item.key,
                kind=item.kind,
                text=item.text if valid else "",
                state=item.state if valid else "flagged",
                version=item.version,
                flags=item.flags,
                context=item.context,
            )
            for item in bundle.texts.all()
        ],
    )


@router.post("", response={200: RouteBundleOut, 404: Message, 429: Message})
def create(request: HttpRequest, body: ConnectIn) -> Any:
    if limited(request):
        return Status(429, Message(code="CA0601", detail="Too many requests; try again later."))
    if any(len(value) > 200 for value in [*body.goals, *body.known]):
        return Status(404, Message(code="CA0602", detail="A route topic id is too long."))
    try:
        return out(connecting.request(body.goals, body.known))
    except LookupError:
        return Status(404, Message(code="CA0602", detail="A goal is not in the current index."))


@router.get("/{identity}", response={200: RouteBundleOut, 404: Message})
def read(request: HttpRequest, identity: UUID) -> Any:
    bundle = RouteBundle.objects.filter(public_id=identity).first()
    if bundle is None:
        return Status(404, Message(code="CA0602", detail="No connecting-text bundle has that id."))
    return out(bundle)
