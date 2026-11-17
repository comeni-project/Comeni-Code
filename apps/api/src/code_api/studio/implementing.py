"""Accepted requests become normal drafts; workflow stages follow those drafts."""

from datetime import timedelta
from uuid import UUID

from django.db import transaction
from django.utils import timezone

from code_api.accounts.models import User
from code_api.accounts.roles import Role, can_act_as
from code_api.studio import drafts
from code_api.studio.models import ContentRequest, RequestDecision
from code_api.studio.requests import RequestError
from code_schema import Level


def actor(by: User) -> User:
    user = User.objects.filter(pk=by.pk, is_active=True).first()
    if user is None or not can_act_as(user.role, Role.AUTHOR):
        raise RequestError("An active author must make this decision.")
    return user


def locked(identity: UUID, version: int) -> ContentRequest:
    item = ContentRequest.objects.select_for_update().filter(public_id=identity).first()
    if item is None:
        raise RequestError("No request has that id.")
    if item.version != version:
        raise RequestError("This request changed; reload first.")
    if item.state not in {"accepted", "implementing"}:
        raise RequestError("Accept the request before starting work.")
    return item


def record(item: ContentRequest, by: User, action: str, before: str, reason: str = "") -> None:
    item.version += 1
    item.updated_at = timezone.now()
    item.save()
    RequestDecision.objects.create(
        request=item,
        actor=by,
        action=action,
        before=before,
        after=item.state,
        version=item.version,
        reason=reason,
    )


@transaction.atomic
def assign(
    identity: UUID, version: int, assignee: UUID | None, *, by: User, reviewing: bool = False
) -> ContentRequest:
    user = actor(by)
    item = locked(identity, version)
    owner = (
        None
        if assignee is None
        else User.objects.filter(public_id=assignee, is_active=True).first()
    )
    if assignee is not None and (
        owner is None or not can_act_as(owner.role, Role.REVIEWER if reviewing else Role.AUTHOR)
    ):
        raise RequestError("Assign an active author, or leave the request unassigned.")
    if reviewing:
        item.reviewer = owner
    else:
        item.assignee = owner
    record(
        item,
        user,
        "assign_review" if reviewing else "assign",
        item.state,
        "Unassigned" if owner is None else owner.name,
    )
    return item


@transaction.atomic
def start(
    identity: UUID,
    version: int,
    *,
    by: User,
    node_id: str,
    claim: str,
    region: str,
    level: Level,
    minutes: int,
) -> ContentRequest:
    user = actor(by)
    item = ContentRequest.objects.select_for_update().filter(public_id=identity).first()
    if item is None:
        raise RequestError("No request has that id.")
    if item.draft is not None and item.draft.state != "discarded":
        if item.draft.node_id != node_id:
            raise RequestError("This request already has a different draft.")
        return item
    item = locked(identity, version)
    try:
        draft = drafts.open_new(
            node_id,
            title=item.title,
            claim=claim,
            region=region,
            level=level,
            minutes=minutes,
            by=user,
        )
    except (drafts.AlreadyANode, drafts.AlreadyOpen) as error:
        raise RequestError(
            "That node already exists or has a live draft; choose another id."
        ) from error
    except drafts.Refused as error:
        raise RequestError(
            "The new draft does not validate: " + "; ".join(map(str, error.problems))
        ) from error
    before = item.state
    item.draft = draft
    item.state = "implementing"
    item.assignee = item.assignee or user
    record(item, user, "start", before)
    return item


def stage(item: ContentRequest) -> str:
    if item.draft is None:
        return "accepted"
    return {"open": "writing", "submitted": "waiting for review", "landed": "live"}.get(
        item.draft.state,
        item.draft.state,
    )


def stalled(item: ContentRequest) -> bool:
    changed = item.updated_at
    if item.draft is not None:
        changed = max(changed, drafts.latest(item.draft).saved_at)
    return stage(item) not in {
        "approved",
        "live",
        "discarded",
    } and changed < timezone.now() - timedelta(days=14)
