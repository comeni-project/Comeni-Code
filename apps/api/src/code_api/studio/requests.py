"""Request intake and the transactional human gate (M7.1, W3.6)."""

from datetime import datetime
from uuid import UUID

from django.db import transaction
from django.utils import timezone

from code_api.accounts.models import User
from code_api.accounts.roles import Role, can_act_as
from code_api.content.models import Node
from code_api.studio.models import ContentRequest, RequestDecision


class RequestError(Exception):
    """A refused request operation; no state or decision is committed."""


def create(title: str, description: str, *, by: User | None = None) -> ContentRequest:
    title, description = title.strip(), description.strip()
    if not title or len(title) > 240 or not description or len(description) > 4000:
        raise RequestError("A request needs a title (1–240) and description (1–4,000 characters).")
    return ContentRequest.objects.create(title=title, description=description, created_by=by)


@transaction.atomic
def decide(
    identity: UUID,
    action: str,
    *,
    expected_version: int,
    by: User,
    reason: str = "",
    node_id: str = "",
    until: datetime | None = None,
) -> ContentRequest:
    # Check the current account, not an actor object cached before a role was revoked.
    actor = User.objects.filter(pk=by.pk, is_active=True).first()
    if actor is None or not can_act_as(actor.role, Role.AUTHOR):
        raise RequestError("An active author must make this decision.")
    item = ContentRequest.objects.select_for_update().filter(public_id=identity).first()
    if item is None:
        raise RequestError("No request has that id.")
    if item.version != expected_version:
        raise RequestError("This request changed; reload before deciding.")
    if item.state not in {"requested", "snoozed"}:
        raise RequestError("This request's state no longer allows triage.")
    targets = {
        "accept": "accepted",
        "decline": "declined",
        "merge": "merged",
        "snooze": "snoozed",
        "resume": "requested",
    }
    if action not in targets or (action == "resume" and item.state != "snoozed"):
        raise RequestError("That action is not available in this state.")
    reason = reason.strip()
    if len(reason) > 4000 or (action in {"decline", "merge", "snooze"} and not reason):
        raise RequestError("Supply a reason of at most 4,000 characters.")
    if action == "merge" and not Node.objects.filter(id=node_id).exists():
        raise RequestError("Choose an existing indexed node to merge into.")
    if action == "snooze" and (
        until is None or timezone.is_naive(until) or until <= timezone.now()
    ):
        raise RequestError("Snooze needs a future time with a timezone.")
    before = item.state
    item.state = targets[action]
    item.version += 1
    item.merged_node_id = node_id if action == "merge" else ""
    item.snoozed_until = until if action == "snooze" else None
    item.updated_at = timezone.now()
    item.save(update_fields=["state", "version", "merged_node_id", "snoozed_until", "updated_at"])
    RequestDecision.objects.create(
        request=item,
        actor=actor,
        action=action,
        before=before,
        after=item.state,
        version=item.version,
        reason=reason,
        node_id=item.merged_node_id,
        snoozed_until=item.snoozed_until,
    )
    return item
