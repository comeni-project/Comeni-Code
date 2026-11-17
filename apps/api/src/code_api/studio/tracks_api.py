"""S9 reviewer controls and the public catalogue of currently eligible named tracks."""

from collections.abc import Callable
from typing import Any, Literal
from uuid import UUID

from django.core.exceptions import ObjectDoesNotExist
from django.http import HttpRequest
from ninja import Router, Schema, Status
from pydantic import Field

from code_api.accounts.access import studio
from code_api.accounts.models import User
from code_api.accounts.roles import Role
from code_api.content import reads
from code_api.content.schemas import Message, RouteOut
from code_api.studio import connecting, tracks
from code_api.studio.connecting_api import RouteBundleOut, out
from code_api.studio.models import NamedTrack, RouteBundle
from code_api.studio.requests import RequestError

public = Router(tags=["content"])
staff = Router(tags=["studio"], auth=studio(Role.REVIEWER))


class NamedTrackOut(Schema):
    public_id: UUID
    name: str
    goals: list[str]
    bundle_id: UUID


class WeaveReviewOut(Schema):
    bundle: RouteBundleOut
    route: RouteOut | None
    snapshot: dict[str, Any]
    eligible: bool
    history: list[dict[str, Any]]


class TextDecisionIn(Schema):
    key: str = Field(max_length=240)
    version: int = Field(ge=1)
    action: Literal["approve", "edit", "rewrite"]
    text: str = Field(default="", max_length=1000)
    note: str = Field(default="", max_length=4000)


class PublishTrackIn(Schema):
    name: str = Field(min_length=1, max_length=120)


def track_out(track: NamedTrack) -> NamedTrackOut:
    return NamedTrackOut(
        public_id=track.public_id,
        name=track.name,
        goals=track.bundle.snapshot["goals"],
        bundle_id=track.bundle.public_id,
    )


def review_out(bundle: RouteBundle) -> WeaveReviewOut:
    data = out(bundle)
    # Staff can inspect the old snapshot and prose; learners never receive stale prose.
    items = {item.key: item for item in bundle.texts.all()}
    for item in data.texts:
        item.text = items[item.key].text
    try:
        route = reads.route(bundle.snapshot["goals"], bundle.snapshot["known"])
    except LookupError:
        route = None
    return WeaveReviewOut(
        bundle=data,
        route=route,
        snapshot=bundle.snapshot,
        eligible=tracks.eligible(bundle),
        history=[
            {
                "key": item.key,
                "actor": event.actor.name if event.actor else "Former member",
                "action": event.action,
                "version": event.version,
                "note": event.note,
                "text": event.body,
            }
            for item in bundle.texts.all()
            for event in item.events.select_related("actor")
        ],
    )


def handled(action: Callable[[], Any]) -> Any:
    try:
        return action()
    except (RequestError, ObjectDoesNotExist) as error:
        return Status(409, Message(code="CA0600", detail=str(error)))


@public.get("", response=list[NamedTrackOut])
def catalogue(request: HttpRequest) -> Any:
    return [
        track_out(track)
        for track in NamedTrack.objects.select_related("bundle").order_by("name")
        if tracks.eligible(track.bundle)
    ]


@staff.get("", response=list[RouteBundleOut])
def queue(request: HttpRequest) -> Any:
    return [out(bundle) for bundle in RouteBundle.objects.order_by("-pk")[:100]]


@staff.get("/{identity}", response={200: WeaveReviewOut, 409: Message})
def read(request: HttpRequest, identity: UUID) -> Any:
    return handled(lambda: review_out(RouteBundle.objects.get(public_id=identity)))


@staff.post("/{identity}/review", response={200: WeaveReviewOut, 409: Message})
def review(request: HttpRequest, identity: UUID, body: TextDecisionIn) -> Any:
    user = request.user
    assert isinstance(user, User)

    def apply() -> WeaveReviewOut:
        if body.action == "rewrite":
            tracks.rewrite(identity, body.key, body.version, by=user, note=body.note)
        else:
            tracks.review(
                identity,
                body.key,
                body.version,
                body.action,
                by=user,
                text=body.text,
                note=body.note,
            )
        return review_out(RouteBundle.objects.get(public_id=identity))

    return handled(apply)


@staff.post("/{identity}/refresh", response={200: WeaveReviewOut, 409: Message})
def refresh(request: HttpRequest, identity: UUID) -> Any:
    def apply() -> WeaveReviewOut:
        old = RouteBundle.objects.get(public_id=identity)
        try:
            return review_out(connecting.request(old.snapshot["goals"], old.snapshot["known"]))
        except LookupError as error:
            raise RequestError("A route goal is no longer in the index.") from error

    return handled(apply)


@staff.post("/{identity}/publish", response={200: NamedTrackOut, 409: Message})
def publish(request: HttpRequest, identity: UUID, body: PublishTrackIn) -> Any:
    user = request.user
    assert isinstance(user, User)
    return handled(lambda: track_out(tracks.publish(identity, body.name, by=user)))
