"""Who may use a Studio route (M4.3 spec, M4A.4).

`studio(min_role)` is the one auth class on every Studio route: nobody signed in is 401 (CA0101),
signed in below the role is 403 (CA0102). Both answer as the API's other errors do, a sentence and
a code. CSRF is checked on writes, as Ninja's session auth does. Learner routes take no auth.
"""

from typing import Any

from django.http import HttpRequest, HttpResponse
from ninja import NinjaAPI
from ninja.errors import AuthenticationError, AuthorizationError
from ninja.security import SessionAuth

from code_api.accounts.roles import Role
from code_api.content.schemas import Message


def _article(role: str) -> str:
    return "an" if role[:1] in "aeiou" else "a"


class Studio(SessionAuth):
    """A session for a member who can act as `min_role`; a deactivated member has no session."""

    def __init__(self, min_role: Role) -> None:
        super().__init__(csrf=True)
        self.min_role = min_role

    def __call__(self, request: HttpRequest) -> Any:
        # Signed out is 401 before any CSRF check, so a signed-out write reads "sign in" (#161).
        if not request.user.is_authenticated:
            return None
        return super().__call__(request)

    def authenticate(self, request: HttpRequest, key: str | None) -> Any:
        user = request.user
        if not user.is_authenticated:
            return None  # Ninja answers AuthenticationError: 401
        if not user.can_act_as(self.min_role):
            held = f"you are {_article(user.role)} {user.role}" if user.role else "you have no role"
            raise AuthorizationError(
                message=f"This needs the {self.min_role.value} role or above; {held}."
            )
        return user


def studio(min_role: Role) -> Studio:
    return Studio(min_role)


def install_access_handlers(api: NinjaAPI) -> None:
    """401 and 403 as `Message`s with their codes, on `api` (and on a test's own API)."""

    def unauthenticated(request: HttpRequest, exc: object) -> HttpResponse:
        body = Message(detail="Sign in to use Studio.", code="CA0101")
        return api.create_response(request, body, status=401)

    def unauthorized(request: HttpRequest, exc: object) -> HttpResponse:
        body = Message(detail=str(exc), code="CA0102")
        return api.create_response(request, body, status=403)

    api.add_exception_handler(AuthenticationError, unauthenticated)
    api.add_exception_handler(AuthorizationError, unauthorized)
