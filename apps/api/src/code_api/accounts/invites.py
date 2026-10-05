"""Invites: minted, looked up, accepted and revoked (M4.3 spec, M4A.2).

A token exists only in the invite's link; the table holds its SHA-256. The invite a person is
signing up through is kept in their session (`SESSION_KEY`) between accepting it and signing up,
where the account adapter reads it.
"""

import hashlib
import secrets
from datetime import timedelta
from enum import StrEnum

from django.conf import settings
from django.core.mail import send_mail
from django.db import transaction
from django.http import HttpRequest
from django.utils import timezone

from code_api.accounts.models import Invite, User
from code_api.accounts.roles import Role

LIFETIME = timedelta(days=7)
SESSION_KEY = "code_invite"


class State(StrEnum):
    PENDING = "pending"
    EXPIRED = "expired"
    REVOKED = "revoked"
    USED = "used"


class AlreadyAMember(Exception):
    """The address already has an account: change its role instead of inviting it."""


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def state(invite: Invite) -> State:
    if invite.accepted_at is not None:
        return State.USED
    if invite.revoked_at is not None:
        return State.REVOKED
    if invite.expires_at <= timezone.now():
        return State.EXPIRED
    return State.PENDING


def find(token: str) -> Invite | None:
    return Invite.objects.filter(token_hash=_hash(token)).first()


def link(token: str) -> str:
    return f"{settings.CODE_WEB_ORIGIN}/join/{token}"


def pending(email: str) -> list[Invite]:
    return [
        invite
        for invite in Invite.objects.filter(email__iexact=email).order_by("created_at")
        if state(invite) is State.PENDING
    ]


@transaction.atomic
def mint(email: str, role: Role, *, by: User | None) -> tuple[Invite, str]:
    """A new invite and its token; any pending one to the same address is revoked."""
    if User.objects.filter(email__iexact=email).exists():
        raise AlreadyAMember(email)
    now = timezone.now()
    for older in pending(email):
        older.revoked_at = now
        older.save(update_fields=["revoked_at"])
    token = secrets.token_urlsafe(32)
    invite = Invite.objects.create(
        email=email,
        role=role,
        token_hash=_hash(token),
        invited_by=by,
        created_at=now,
        expires_at=now + LIFETIME,
    )
    return invite, token


def send(invite: Invite, token: str) -> None:
    days = LIFETIME.days
    send_mail(
        subject="You're invited to Comeni Code Studio",
        message=(
            f"You're invited to join Comeni Code's Studio as {invite.role}.\n\n"
            f"Open this link within {days} days to set up your account, with a password or "
            f"GitHub:\n\n{link(token)}\n\nThe link works once.\n"
        ),
        from_email=None,
        recipient_list=[invite.email],
    )


def hold(request: HttpRequest, invite: Invite) -> None:
    """Keep the invite in the session until sign-up reads it."""
    request.session[SESSION_KEY] = str(invite.public_id)


def held(request: HttpRequest) -> Invite | None:
    """The session's invite, if it is still pending."""
    public_id = request.session.get(SESSION_KEY)
    if public_id is None:
        return None
    invite = Invite.objects.filter(public_id=public_id).first()
    return invite if invite is not None and state(invite) is State.PENDING else None


class NotPending(Exception):
    """The invite was spent, withdrawn or expired between accepting it and signing up."""


def accept(request: HttpRequest, invite: Invite, user: User) -> None:
    """The user takes the invite's role, and the invite is spent. Call inside the sign-up's
    transaction: the invite is re-read under a row lock, so two sign-ups racing on one link
    cannot both spend it."""
    locked = Invite.objects.select_for_update().get(pk=invite.pk)
    if state(locked) is not State.PENDING:
        raise NotPending(locked.public_id)
    user.role = locked.role
    user.save(update_fields=["role"])
    locked.accepted_at = timezone.now()
    locked.accepted_by = user
    locked.save(update_fields=["accepted_at", "accepted_by"])
    request.session.pop(SESSION_KEY, None)


def revoke(invite: Invite) -> None:
    invite.revoked_at = timezone.now()
    invite.save(update_fields=["revoked_at"])
