"""allauth's hooks: sign-up opens only through a pending invite (M4.3 spec, M4A.2).

The invite is held in the session by `POST /api/invites/<token>/accept`. Without a pending one,
allauth's headless sign-up answers 403 itself. A sign-up must use the invite's address, and the
new user takes its role in the same transaction that spends it.
"""

from typing import Any

from allauth.account.adapter import DefaultAccountAdapter
from django.core.exceptions import PermissionDenied, ValidationError
from django.db import transaction
from django.http import HttpRequest

from code_api.accounts import invites
from code_api.accounts.models import User


class AccountAdapter(DefaultAccountAdapter):  # type: ignore[misc]
    def is_open_for_signup(self, request: HttpRequest) -> bool:
        return invites.held(request) is not None

    def clean_email(self, email: str) -> str:
        # allauth validates input before asking is_open_for_signup, so with no invite held this
        # passes, and the view answers 403 (sign-up closed) rather than a 400 about the address.
        invite = invites.held(self.request)
        if invite is not None and invite.email.casefold() != email.casefold():
            raise ValidationError("Sign up with the address your invite was sent to.")
        return str(super().clean_email(email))

    def save_user(self, request: HttpRequest, user: User, form: Any, commit: bool = True) -> User:
        invite = invites.held(request)
        if invite is None:
            raise PermissionDenied("sign-up needs a pending invite")
        with transaction.atomic():
            saved: User = super().save_user(request, user, form, commit=True)
            invites.accept(request, invite, saved)
        return saved
