"""The accounts API (M4.3 spec, M4A.1–M4A.3): who is asking, invites, and the team."""

from uuid import UUID

from django.http import HttpRequest
from ninja import Router, Schema

from code_api.accounts.models import User

router = Router(tags=["accounts"])


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


@router.get("/me", response=MeOut)
def me(request: HttpRequest) -> MeOut:
    """Who is signed in, or null. Always 200: signed out is not an error (M4A.3)."""
    user = request.user
    return MeOut(user=MemberOut.of(user) if isinstance(user, User) else None)
