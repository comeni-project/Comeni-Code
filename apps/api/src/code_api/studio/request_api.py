"""Bounded learner intake and staff triage; only the service can move queue state."""

import hashlib
import time
from datetime import datetime, timedelta
from typing import Any, Literal
from uuid import UUID

from django.core.cache import cache
from django.db import transaction
from django.db.models import Count, Exists, OuterRef
from django.http import HttpRequest
from django.utils import timezone
from django.utils.crypto import salted_hmac
from ninja import Router, Schema, Status
from pydantic import Field

from code_api.accounts.access import studio
from code_api.accounts.models import User
from code_api.accounts.roles import Role
from code_api.content.models import Node, Region
from code_api.content.schemas import Message
from code_api.studio import requests
from code_api.studio.models import ContentRequest, RequestSubmission

public = Router(tags=["requests"])
staff = Router(tags=["studio"], auth=studio(Role.AUTHOR))


class RequestIn(Schema):
    request_id: UUID
    title: str = Field(min_length=1, max_length=240)
    description: str = Field(min_length=1, max_length=4000)
    missing_node_id: str | None = Field(default=None, max_length=100)
    route_goals: list[str] = Field(default_factory=list, max_length=3)


class ReceiptOut(Schema):
    receipt: UUID
    title: str
    state: str
    reason: str
    node_id: str


class DecisionOut(Schema):
    action: str
    reason: str
    actor: str
    version: int
    created_at: datetime


class ContentRequestOut(Schema):
    public_id: UUID
    title: str
    description: str
    state: str
    version: int
    asked: int
    created_at: datetime
    updated_at: datetime
    snoozed_until: datetime | None
    merged_node_id: str
    decisions: list[DecisionOut]
    proposal: dict[str, Any]
    submission_notes: list[str]
    region: str
    request_type: str
    suggestions: list[dict[str, Any]]
    grouping_state: str
    merged_request: UUID | None
    blocked_routes: list[list[str]]


class DecisionIn(Schema):
    identity: UUID
    version: int = Field(ge=1)
    action: Literal["accept", "decline", "merge", "snooze", "resume"]
    reason: str = Field(default="", max_length=4000)
    node_id: str = Field(default="", max_length=240)
    target_request: UUID | None = None
    until: datetime | None = None


class BulkIn(Schema):
    decisions: list[DecisionIn] = Field(min_length=1, max_length=50)


class RegionTargetIn(Schema):
    identity: UUID
    version: int = Field(ge=1)


class RequestRegionIn(Schema):
    items: list[RegionTargetIn] = Field(min_length=1, max_length=50)
    region: str = Field(max_length=100)


class RequestFacetsOut(Schema):
    states: dict[str, int]
    regions: list[dict[str, str]]
    total: int


def out(item: ContentRequest) -> ContentRequestOut:
    if item.grouping_state in {"pending", "running"} and (
        item.grouping_started_at or item.created_at
    ) < timezone.now() - timedelta(minutes=2):
        ContentRequest.objects.filter(pk=item.pk, grouping_state__in=["pending", "running"]).update(
            grouping_state="unavailable"
        )
        item.grouping_state = "unavailable"
    return ContentRequestOut(
        public_id=item.public_id,
        title=item.title,
        description=item.description,
        state=item.state,
        version=item.version,
        asked=max(1, item.submissions.count()),
        created_at=item.created_at,
        updated_at=item.updated_at,
        snoozed_until=item.snoozed_until,
        merged_node_id=item.merged_node_id,
        decisions=[
            DecisionOut(
                action=d.action,
                reason=d.reason,
                actor=d.actor.name if d.actor else "Former member",
                version=d.version,
                created_at=d.created_at,
            )
            for d in item.decisions.select_related("actor")
        ],
        proposal=item.proposal,
        submission_notes=list(
            item.submissions.order_by("pk").values_list("description", flat=True)[:100]
        ),
        region=item.region,
        request_type=item.request_type,
        suggestions=item.suggestions,
        grouping_state=item.grouping_state,
        merged_request=None if item.merged_request is None else item.merged_request.public_id,
        blocked_routes=[
            list(goals)
            for goals in sorted(
                {
                    tuple(sorted(set(submission.route_goals)))
                    for submission in item.submissions.all()
                    if submission.route_goals
                }
            )
        ],
    )


def receipt_out(submission: RequestSubmission) -> ReceiptOut:
    item = submission.request
    while item.merged_request is not None:
        item = item.merged_request
    last = item.decisions.order_by("-version").first()
    return ReceiptOut(
        receipt=submission.public_id,
        title=submission.title,
        state=item.state
        if item.draft is None
        else {
            "open": "implementing",
            "submitted": "drafted",
            "approved": "approved",
            "landed": "live",
            "discarded": "discarded",
        }.get(item.draft.state, item.state),
        reason=last.reason if last and item.state == "declined" else "",
        node_id=item.merged_node_id,
    )


def limited(request: HttpRequest) -> bool:
    address = salted_hmac(
        "request-intake", request.META.get("REMOTE_ADDR", ""), algorithm="sha256"
    ).hexdigest()
    window = int(time.time()) // 3600
    for key, limit in [(f"requests:{window}:{address}", 20), (f"requests:{window}:all", 500)]:
        cache.add(key, 0, timeout=3700)
        if cache.incr(key) > limit:
            return True
    return False


@public.post("", response={200: ReceiptOut, 409: Message, 422: Message, 429: Message})
def submit(request: HttpRequest, body: RequestIn) -> Any:
    if limited(request):
        return Status(429, Message(code="CA0601", detail="Too many requests; try again later."))
    title, description = body.title.strip(), body.description.strip()
    if not title or not description:
        return Status(422, Message(code="CA0600", detail="Write a title and description."))
    if body.missing_node_id and (
        body.missing_node_id not in body.route_goals
        or Node.objects.filter(id=body.missing_node_id).exists()
    ):
        return Status(
            422, Message(code="CA0600", detail="Name a missing node from the attempted route.")
        )
    if any(len(goal) > 200 for goal in body.route_goals):
        return Status(
            422, Message(code="CA0600", detail="Route goal IDs must fit within 200 characters.")
        )
    with transaction.atomic():
        prior = RequestSubmission.objects.filter(idempotency_key=body.request_id).first()
        if prior is not None:
            if prior.title != title or prior.description != description:
                return Status(422, Message(code="CA0600", detail="Use a new id for a new request."))
            return receipt_out(prior)
        key = hashlib.sha256(" ".join(title.casefold().split()).encode()).hexdigest()
        item, created = ContentRequest.objects.get_or_create(
            grouping_key=key,
            defaults={
                "title": title,
                "description": description,
                "request_type": "node" if body.missing_node_id else "goal",
            },
        )
        if created:
            from code_api.studio.request_grouping import schedule

            schedule(str(item.public_id))
        chain_ids = [item.pk]
        walker = item
        while walker.merged_request is not None:
            walker = walker.merged_request
            chain_ids.append(walker.pk)
        locked = {
            row.pk: row
            for row in ContentRequest.objects.select_for_update()
            .filter(pk__in=chain_ids)
            .order_by("pk")
        }
        item = locked[item.pk]
        while item.merged_request_id is not None:
            if item.merged_request_id not in locked:
                return Status(
                    409,
                    Message(
                        code="CA0600", detail="The request queue changed while sending; try again."
                    ),
                )
            item = locked[item.merged_request_id]
        submission, made = RequestSubmission.objects.get_or_create(
            idempotency_key=body.request_id,
            defaults={
                "request": item,
                "title": title,
                "description": description,
                "route_goals": sorted(set(body.route_goals)) if body.missing_node_id else [],
            },
        )
        if not made and (submission.title != title or submission.description != description):
            return Status(422, Message(code="CA0600", detail="Use a new id for a new request."))
        return receipt_out(submission)


@public.get("/{identity}", response={200: ReceiptOut, 404: Message})
def status(request: HttpRequest, identity: UUID) -> Any:
    submission = (
        RequestSubmission.objects.select_related("request").filter(public_id=identity).first()
    )
    if submission is None:
        return Status(404, Message(code="CA0600", detail="No request receipt has that id."))
    return receipt_out(submission)


@staff.get("", response=list[ContentRequestOut])
def queue(
    request: HttpRequest,
    state: str = "",
    q: str = "",
    offset: int = 0,
    region: str = "",
    kind: str = "",
    view: str = "",
    older_days: int = 0,
    min_asked: int = 0,
) -> Any:
    items = ContentRequest.objects.all()
    if state:
        items = items.filter(state=state[:16])
    if q:
        items = items.filter(title__icontains=q[:240])
    if region:
        items = items.filter(region=region[:100])
    if kind:
        items = items.filter(request_type=kind[:16])
    if older_days > 0:
        items = items.filter(created_at__lte=timezone.now() - timedelta(days=min(older_days, 3650)))
    if min_asked > 1:
        items = items.annotate(demand=Count("submissions")).filter(
            demand__gte=min(min_asked, 10000)
        )
    if view == "duplicates":
        items = items.filter(suggestions__contains=[{"kind": "request"}])
    elif view == "blocking":
        attempts = RequestSubmission.objects.filter(request_id=OuterRef("pk")).exclude(
            route_goals=[]
        )
        items = items.filter(Exists(attempts))
    elif view == "decided":
        items = items.filter(updated_at__gte=timezone.now() - timedelta(days=7)).exclude(
            state__in=["requested", "snoozed"]
        )
    return [out(item) for item in items[max(0, offset) : max(0, offset) + 100]]


@staff.get("/facets", response=RequestFacetsOut)
def facets(request: HttpRequest) -> Any:
    return RequestFacetsOut(
        states={
            row["state"]: row["count"]
            for row in ContentRequest.objects.values("state").annotate(count=Count("pk"))
        },
        regions=[
            {"id": region.id, "name": region.name} for region in Region.objects.order_by("position")
        ],
        total=ContentRequest.objects.count(),
    )


@staff.post("/region", response={200: list[ContentRequestOut], 409: Message})
def assign_region(request: HttpRequest, body: RequestRegionIn) -> Any:
    assert isinstance(request.user, User)
    try:
        with transaction.atomic():
            ids = [item.identity for item in body.items]
            if len(ids) != len(set(ids)):
                raise requests.RequestError("Choose each request once.")
            list(
                ContentRequest.objects.select_for_update().filter(public_id__in=ids).order_by("pk")
            )
            return [
                out(requests.set_region(item.identity, item.version, body.region, by=request.user))
                for item in body.items
            ]
    except requests.RequestError as error:
        return Status(409, Message(code="CA0600", detail=str(error)))


@staff.post("/{identity}/grouping", response={200: ContentRequestOut, 409: Message})
def group(request: HttpRequest, identity: UUID) -> Any:
    from code_api.studio.request_grouping import schedule

    with transaction.atomic():
        item = (
            ContentRequest.objects.select_for_update()
            .filter(public_id=identity, state__in=["requested", "snoozed"])
            .first()
        )
        if item is None:
            return Status(
                409, Message(code="CA0600", detail="Choose a request still awaiting triage.")
            )
        if item.grouping_state != "running":
            item.grouping_state = "pending"
            item.grouping_started_at = timezone.now()
            item.save(update_fields=["grouping_state", "grouping_started_at"])
            schedule(str(item.public_id))
    return out(item)


@staff.post("/decisions", response={200: list[ContentRequestOut], 409: Message})
def decisions(request: HttpRequest, body: BulkIn) -> Any:
    assert isinstance(request.user, User)
    try:
        with transaction.atomic():
            ids = [decision.identity for decision in body.decisions]
            if len(set(ids)) != len(ids):
                raise requests.RequestError("Choose each request once per batch.")
            lock_ids = ids + [
                decision.target_request
                for decision in body.decisions
                if decision.target_request is not None
            ]
            # All bulk calls acquire locks in the same order.
            list(
                ContentRequest.objects.select_for_update()
                .filter(public_id__in=lock_ids)
                .order_by("pk")
            )
            changed = [
                requests.decide(
                    decision.identity,
                    decision.action,
                    expected_version=decision.version,
                    by=request.user,
                    reason=decision.reason,
                    node_id=decision.node_id,
                    target_request=decision.target_request,
                    until=decision.until,
                )
                for decision in body.decisions
            ]
            return [out(item) for item in changed]
    except requests.RequestError as error:
        return Status(409, Message(code="CA0600", detail=str(error)))
