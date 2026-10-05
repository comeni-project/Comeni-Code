"""The accounts API (M4.3 spec, M4A.1–M4A.3): who is asking, invites, and the team.

Studio routes take `studio(min_role)`; looking up and accepting an invite takes no account,
since the invitee has none yet.
"""

from datetime import datetime
from uuid import UUID

from django.http import HttpRequest
from ninja import Router, Schema, Status

from code_api.accounts import invites
from code_api.accounts.access import studio
from code_api.accounts.models import Invite, User
from code_api.accounts.roles import Role
from code_api.content.schemas import Message

router = Router(tags=["accounts"])

_SPENT = {
    invites.State.EXPIRED: ("This invite has expired; ask for a new one.", "CA0104"),
    invites.State.REVOKED: ("This invite was withdrawn; ask for a new one.", "CA0105"),
    invites.State.USED: ("This invite has been used already.", "CA0106"),
}


class MemberOut(Schema):
    """A member, named by public id; the integer key never leaves the database (M4A.1)."""

    public_id: UUID
    email: str
    name: str
    role: str

    @staticmethod
    def of(user: User) -> MemberOut:
        return MemberOut(public_id=user.public_id, email=user.email, name=user.name, role=user.role)


class MeOut(Schema):
    user: MemberOut | None


class InviteIn(Schema):
    email: str
    role: Role


class InviteOut(Schema):
    """What an invitee sees before signing up."""

    email: str
    role: str


class PendingInviteOut(Schema):
    public_id: UUID
    email: str
    role: str
    expires_at: datetime

    @staticmethod
    def of(invite: Invite) -> PendingInviteOut:
        return PendingInviteOut(
            public_id=invite.public_id,
            email=invite.email,
            role=invite.role,
            expires_at=invite.expires_at,
        )


@router.get("/me", response=MeOut)
def me(request: HttpRequest) -> MeOut:
    """Who is signed in, or null. Always 200: signed out is not an error (M4A.3)."""
    user = request.user
    return MeOut(user=MemberOut.of(user) if isinstance(user, User) else None)


def _usable(token: str) -> Invite | Status[Message]:
    """The pending invite for `token`, or why there is none: 404 unknown, 410 spent."""
    invite = invites.find(token)
    if invite is None:
        return Status(404, Message(detail="No invite has this link.", code="CA0103"))
    current = invites.state(invite)
    if current is not invites.State.PENDING:
        detail, code = _SPENT[current]
        return Status(410, Message(detail=detail, code=code))
    return invite


@router.get("/invites/{token}", response={200: InviteOut, 404: Message, 410: Message})
def look_up(request: HttpRequest, token: str) -> Status[InviteOut] | Status[Message]:
    found = _usable(token)
    if isinstance(found, Status):
        return found
    return Status(200, InviteOut(email=found.email, role=found.role))


@router.post("/invites/{token}/accept", response={200: InviteOut, 404: Message, 410: Message})
def accept(request: HttpRequest, token: str) -> Status[InviteOut] | Status[Message]:
    """Put the invite in the session; sign-up through allauth then reads it (M4A.2)."""
    found = _usable(token)
    if isinstance(found, Status):
        return found
    invites.hold(request, found)
    return Status(200, InviteOut(email=found.email, role=found.role))


@router.post(
    "/team/invites",
    auth=studio(Role.OPERATOR),
    response={201: PendingInviteOut, 409: Message},
)
def invite(request: HttpRequest, body: InviteIn) -> Status[PendingInviteOut] | Status[Message]:
    by = request.user if isinstance(request.user, User) else None
    try:
        made, token = invites.mint(body.email, body.role, by=by)
    except invites.AlreadyAMember:
        detail = f"{body.email} is already a member; change their role instead."
        return Status(409, Message(detail=detail, code="CA0107"))
    invites.send(made, token)
    return Status(201, PendingInviteOut.of(made))


@router.get("/team/invites", auth=studio(Role.OPERATOR), response=list[PendingInviteOut])
def pending_invites(request: HttpRequest) -> list[PendingInviteOut]:
    every = Invite.objects.order_by("created_at")
    return [PendingInviteOut.of(i) for i in every if invites.state(i) is invites.State.PENDING]


@router.delete(
    "/team/invites/{public_id}",
    auth=studio(Role.OPERATOR),
    response={204: None, 404: Message},
)
def revoke(request: HttpRequest, public_id: UUID) -> Status[None] | Status[Message]:
    found = Invite.objects.filter(public_id=public_id).first()
    if found is None or invites.state(found) is not invites.State.PENDING:
        return Status(404, Message(detail="No pending invite has this id.", code="CA0103"))
    invites.revoke(found)
    return Status(204, None)
