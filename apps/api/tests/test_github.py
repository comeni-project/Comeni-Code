"""GitHub sign-up, only through an invite (spec M4A.2, M4A.3). Needs Compose's Postgres.

GitHub is never reached: the provider redirect and callback run through allauth's headless browser
API, and `get_requests_session` answers GitHub's token, profile and email endpoints from here.
"""

import json
from collections.abc import Iterator
from typing import Any
from unittest import mock
from urllib.parse import parse_qs, urlsplit

import pytest
from allauth.socialaccount.models import SocialAccount
from django.test import Client, override_settings

from code_api.accounts import invites
from code_api.accounts.models import User
from code_api.accounts.roles import Role

pytestmark = pytest.mark.django_db

PROVIDERS = {
    "github": {
        "APPS": [{"client_id": "Iv1.test", "secret": "test-secret"}],
        "SCOPE": ["read:user", "user:email"],
    }
}
CALLBACK = "http://127.0.0.1:5173/sign-in/done"
GITHUB_USER = {
    "id": 4242,
    "login": "ada-l",
    "name": "Ada Lovelace",
    "email": "ada@personal.example",
}
GITHUB_EMAILS = [{"email": "ada@personal.example", "primary": True, "verified": True}]


class _Response:
    def __init__(self, body: Any, status: int = 200) -> None:
        self.status_code = status
        self.headers = {"content-type": "application/json"}
        self.text = json.dumps(body)
        self.content = self.text.encode()
        self._body = body

    def json(self) -> Any:
        return self._body

    def raise_for_status(self) -> None:
        assert self.status_code < 400


class _GitHub:
    """A requests session that answers as GitHub would, and nothing else."""

    def __enter__(self) -> _GitHub:
        return self

    def __exit__(self, *exc: object) -> None:
        return None

    def request(self, method: str, url: str, **kwargs: Any) -> _Response:
        assert url == "https://github.com/login/oauth/access_token", url
        return _Response({"access_token": "gho_test", "token_type": "bearer"})

    def get(self, url: str, **kwargs: Any) -> _Response:
        bodies = {
            "https://api.github.com/user": GITHUB_USER,
            "https://api.github.com/user/emails": GITHUB_EMAILS,
        }
        assert url in bodies, url
        return _Response(bodies[url])


@pytest.fixture(autouse=True)
def github() -> Iterator[None]:
    with (
        override_settings(SOCIALACCOUNT_PROVIDERS=PROVIDERS),
        mock.patch(
            "allauth.socialaccount.adapter.DefaultSocialAccountAdapter.get_requests_session",
            return_value=_GitHub(),
        ),
    ):
        yield


def sign_in_with_github(client: Client) -> str:
    """The browser's round trip: redirect to GitHub, then GitHub's callback. Returns where the
    browser is finally sent."""
    redirect = client.post(
        "/_allauth/browser/v1/auth/provider/redirect",
        {"provider": "github", "callback_url": CALLBACK, "process": "login"},
    )
    assert redirect.status_code == 302, redirect.content
    state = parse_qs(urlsplit(redirect["Location"]).query)["state"][0]
    callback = client.get(
        "/_allauth/accounts/github/login/callback/", {"code": "test-code", "state": state}
    )
    assert callback.status_code == 302, callback.content
    return str(callback["Location"])


def accepted_invite(client: Client, role: Role = Role.REVIEWER) -> None:
    invite, token = invites.mint("ada@example.org", role, by=None)
    assert client.post(f"/api/invites/{token}/accept").status_code == 200


def test_an_invite_signs_up_with_github_taking_its_email_and_role(client: Client) -> None:
    accepted_invite(client)
    assert sign_in_with_github(client).startswith(CALLBACK)
    user = User.objects.get()
    assert (user.email, user.role, user.name) == ("ada@example.org", Role.REVIEWER, "Ada Lovelace")
    account = SocialAccount.objects.get(user=user)
    assert (account.provider, account.uid) == ("github", "4242")
    assert account.extra_data["email"] == "ada@personal.example"  # GitHub's own address, kept
    assert client.get("/api/me").json()["user"]["email"] == "ada@example.org"
    assert client.get("/api/team/invites").status_code == 403  # a reviewer, signed in


def test_without_an_invite_github_creates_nothing(client: Client) -> None:
    sign_in_with_github(client)
    assert not User.objects.exists()
    assert not SocialAccount.objects.exists()
    assert client.get("/api/me").json() == {"user": None}


def test_a_linked_account_signs_in_without_an_invite(client: Client) -> None:
    accepted_invite(client, Role.AUTHOR)
    sign_in_with_github(client)
    client.logout()
    again = Client()
    sign_in_with_github(again)
    assert User.objects.count() == 1
    assert again.get("/api/me").json()["user"]["role"] == "author"


def test_one_invite_makes_one_account_by_github(client: Client) -> None:
    # #161: GitHub sign-up spends the invite, so the link cannot make a second account.
    invite, token = invites.mint("ada@example.org", Role.AUTHOR, by=None)
    client.post(f"/api/invites/{token}/accept")
    sign_in_with_github(client)
    assert Client().post(f"/api/invites/{token}/accept").status_code == 410
    invite.refresh_from_db()
    assert invite.accepted_by == User.objects.get()
