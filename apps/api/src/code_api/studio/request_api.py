"""Bounded learner intake and staff triage; only the service can move queue state."""

import hashlib
import time
from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from django.core.cache import cache
from django.db import transaction
from django.http import HttpRequest
from django.utils.crypto import salted_hmac
from ninja import Router, Schema, Status
from pydantic import Field

from code_api.accounts.access import studio
from code_api.accounts.models import User
from code_api.accounts.roles import Role
from code_api.content.schemas import Message
from code_api.studio import requests
from code_api.studio.models import ContentRequest, RequestSubmission

public = Router(tags=["requests"])
staff = Router(tags=["studio"], auth=studio(Role.AUTHOR))


class RequestIn(Schema):
    request_id: UUID
    title: str = Field(min_length=1, max_length=240)
    description: str = Field(min_length=1, max_length=4000)


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


class DecisionIn(Schema):
    identity: UUID
    version: int = Field(ge=1)
    action: Literal["accept", "decline", "merge", "snooze", "resume"]
    reason: str = Field(default="", max_length=4000)
    node_id: str = Field(default="", max_length=240)
    until: datetime | None = None


class BulkIn(Schema):
    decisions: list[DecisionIn] = Field(min_length=1, max_length=50)


def out(item: ContentRequest) -> ContentRequestOut:
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
    )


def receipt_out(submission: RequestSubmission) -> ReceiptOut:
    item = submission.request
    last = item.decisions.order_by("-version").first()
    return ReceiptOut(
        receipt=submission.public_id,
        title=submission.title,
        state=item.state,
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


@public.post("", response={200: ReceiptOut, 422: Message, 429: Message})
def submit(request: HttpRequest, body: RequestIn) -> Any:
    if limited(request):
        return Status(429, Message(code="CA0601", detail="Too many requests; try again later."))
    title, description = body.title.strip(), body.description.strip()
    if not title or not description:
        return Status(422, Message(code="CA0600", detail="Write a title and description."))
    with transaction.atomic():
        prior = RequestSubmission.objects.filter(idempotency_key=body.request_id).first()
        if prior is not None:
            if prior.title != title or prior.description != description:
                return Status(422, Message(code="CA0600", detail="Use a new id for a new request."))
            return receipt_out(prior)
        key = hashlib.sha256(" ".join(title.casefold().split()).encode()).hexdigest()
        item, _ = ContentRequest.objects.get_or_create(
            grouping_key=key,
            defaults={"title": title, "description": description},
        )
        submission, made = RequestSubmission.objects.get_or_create(
            idempotency_key=body.request_id,
            defaults={"request": item, "title": title, "description": description},
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
def queue(request: HttpRequest, state: str = "", q: str = "", offset: int = 0) -> Any:
    items = ContentRequest.objects.all()
    if state:
        items = items.filter(state=state[:16])
    if q:
        items = items.filter(title__icontains=q[:240])
    return [out(item) for item in items[max(0, offset) : max(0, offset) + 100]]


@staff.post("/decisions", response={200: list[ContentRequestOut], 409: Message})
def decisions(request: HttpRequest, body: BulkIn) -> Any:
    assert isinstance(request.user, User)
    try:
        with transaction.atomic():
            ids = [decision.identity for decision in body.decisions]
            if len(set(ids)) != len(ids):
                raise requests.RequestError("Choose each request once per batch.")
            # All bulk calls acquire locks in the same order.
            list(
                ContentRequest.objects.select_for_update().filter(public_id__in=ids).order_by("pk")
            )
            changed = [
                requests.decide(
                    decision.identity,
                    decision.action,
                    expected_version=decision.version,
                    by=request.user,
                    reason=decision.reason,
                    node_id=decision.node_id,
                    until=decision.until,
                )
                for decision in body.decisions
            ]
            return [out(item) for item in changed]
    except requests.RequestError as error:
        return Status(409, Message(code="CA0600", detail=str(error)))
