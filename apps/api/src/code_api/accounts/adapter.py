"""allauth's hooks: sign-up opens only through a pending invite (M4.3 spec, M4A.2), by password
or GitHub.

The invite is held in the session by `POST /api/invites/<token>/accept`. Without a pending one,
allauth's headless sign-up answers 403 itself. A sign-up must use the invite's address, and the
new user takes its role in the same transaction that spends it.
"""

import dataclasses
from collections.abc import Callable
from typing import Any

from allauth.account.adapter import DefaultAccountAdapter
from allauth.account.models import EmailAddress
from allauth.core.exceptions import ImmediateHttpResponse
from allauth.headless.adapter import DefaultHeadlessAdapter
from allauth.headless.base.response import ForbiddenResponse
from allauth.socialaccount.adapter import DefaultSocialAccountAdapter
from allauth.socialaccount.models import SocialLogin
from django.core.exceptions import ValidationError
from django.db import transaction
from django.http import HttpRequest

from code_api.accounts import invites
from code_api.accounts.models import Invite, User


def _held_or_forbidden(request: HttpRequest) -> Invite:
    """The session's pending invite; with none, allauth's JSON 403."""
    invite = invites.held(request)
    if invite is None:
        raise ImmediateHttpResponse(ForbiddenResponse(request))
    return invite


def _spend(request: HttpRequest, invite: Invite, save: Callable[[], User]) -> User:
    """Save the new user and spend the invite in one transaction, for password and GitHub alike.
    Losing a race for the invite rolls the user back and answers allauth's JSON 403 (#161)."""
    try:
        with transaction.atomic():
            saved = save()
            invites.accept(request, invite, saved)
    except invites.NotPending:
        raise ImmediateHttpResponse(ForbiddenResponse(request)) from None
    return saved


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
        # The link proved the address: allauth records it verified (#161), so it cannot be
        # swapped for an unverified one later.
        invite = _held_or_forbidden(request)
        self.stash_verified_email(request, invite.email)
        return _spend(
            request,
            invite,
            lambda: super(AccountAdapter, self).save_user(request, user, form, commit=True),
        )


class SocialAccountAdapter(DefaultSocialAccountAdapter):  # type: ignore[misc]
    """GitHub sign-up through an invite (M4A.2): the account takes the invite's address and role.

    allauth's social sign-up calls this adapter's `save_user`, never the account adapter's, so
    the invite is checked and spent here too (#161). A GitHub account already linked signs in
    without an invite: sign-in is not sign-up.
    """

    def is_open_for_signup(self, request: HttpRequest, sociallogin: SocialLogin) -> bool:
        return invites.held(request) is not None

    def populate_user(self, request: HttpRequest, sociallogin: SocialLogin, data: Any) -> User:
        user: User = super().populate_user(request, sociallogin, data)
        invite = invites.held(request)
        if invite is not None:
            # The invite's address, whatever GitHub reports; GitHub's stays in extra_data.
            user.email = invite.email
            sociallogin.email_addresses = [
                EmailAddress(email=invite.email, verified=True, primary=True)
            ]
        extra = sociallogin.account.extra_data
        user.name = str(extra.get("name") or extra.get("login") or "")
        return user

    def save_user(self, request: HttpRequest, sociallogin: SocialLogin, form: Any = None) -> User:
        if form is not None:
            # allauth's pending sign-up form saves through the account adapter, which spends the
            # invite itself; spending it here too always failed (#163).
            saved: User = super().save_user(request, sociallogin, form)
            return saved
        invite = _held_or_forbidden(request)
        return _spend(
            request,
            invite,
            lambda: super(SocialAccountAdapter, self).save_user(request, sociallogin, form),
        )


class HeadlessAdapter(DefaultHeadlessAdapter):  # type: ignore[misc]
    """allauth's payloads name a user by `public_id`, never the database key (M4A.1, #162)."""

    def user_as_dataclass(self, user: User) -> Any:
        payload = super().user_as_dataclass(user)
        return dataclasses.replace(payload, id=str(user.public_id) if user.pk else None)
