"""Invites, and sign-up only through one (spec M4A.2). Needs Compose's Postgres."""

import hashlib
import json
import re
from datetime import timedelta

import pytest
from django.core import mail
from django.core.management import call_command
from django.test import Client
from django.utils import timezone

from code_api.accounts.models import Invite, User
from code_api.accounts.roles import Role

pytestmark = pytest.mark.django_db

SIGNUP = "/_allauth/browser/v1/auth/signup"
PASSWORD = "correct horse battery staple"


def operator(client: Client) -> User:
    user = User.objects.create_user("op@example.org", role=Role.OPERATOR)
    client.force_login(user)
    return user


def invite(client: Client, email: str = "ada@example.org", role: str = "author") -> str:
    """An operator invites; the token, read from the mail as the invitee would."""
    response = client.post(
        "/api/team/invites", {"email": email, "role": role}, content_type="application/json"
    )
    assert response.status_code == 201, response.content
    (token,) = re.findall(r"/join/([A-Za-z0-9_-]+)", str(mail.outbox[-1].body))
    return str(token)


def sign_up(client: Client, email: str, password: str = PASSWORD) -> int:
    body = json.dumps({"email": email, "password": password})
    return client.post(SIGNUP, body, content_type="application/json").status_code


def test_an_invite_is_mailed_with_its_link(client: Client) -> None:
    operator(client)
    token = invite(client)
    (message,) = mail.outbox
    assert message.to == ["ada@example.org"]
    assert f"http://127.0.0.1:5173/join/{token}" in message.body
    assert "author" in message.body


def test_the_token_is_stored_only_as_its_hash(client: Client) -> None:
    operator(client)
    token = invite(client)
    stored = Invite.objects.get()
    assert stored.token_hash == hashlib.sha256(token.encode()).hexdigest()
    assert token not in {getattr(stored, field.name) for field in Invite._meta.fields}


def test_a_token_looks_up_its_invite(client: Client) -> None:
    operator(client)
    token = invite(client, role="reviewer")
    client.logout()
    assert client.get(f"/api/invites/{token}").json() == {
        "email": "ada@example.org",
        "role": "reviewer",
    }


def test_an_unknown_token_is_404(client: Client) -> None:
    response = client.get("/api/invites/nothing-like-a-token")
    assert (response.status_code, response.json()["code"]) == (404, "CA0103")


@pytest.mark.parametrize(
    ("spoil", "code"),
    [
        ({"expires_at": timezone.now() - timedelta(seconds=1)}, "CA0104"),
        ({"revoked_at": timezone.now()}, "CA0105"),
        ({"accepted_at": timezone.now()}, "CA0106"),
    ],
)
def test_a_spent_invite_is_410(client: Client, spoil: dict[str, object], code: str) -> None:
    operator(client)
    token = invite(client)
    Invite.objects.update(**spoil)
    response = client.get(f"/api/invites/{token}")
    assert (response.status_code, response.json()["code"]) == (410, code)
    assert client.post(f"/api/invites/{token}/accept").status_code == 410


def test_a_new_invite_revokes_the_pending_one(client: Client) -> None:
    operator(client)
    first = invite(client)
    invite(client, role="reviewer")
    assert client.get(f"/api/invites/{first}").json()["code"] == "CA0105"


def test_inviting_a_member_is_409(client: Client) -> None:
    operator(client)
    response = client.post(
        "/api/team/invites",
        {"email": "OP@example.org", "role": "author"},
        content_type="application/json",
    )
    assert (response.status_code, response.json()["code"]) == (409, "CA0107")


@pytest.mark.parametrize("role", [Role.AUTHOR, Role.REVIEWER])
def test_only_an_operator_invites(client: Client, role: Role) -> None:
    client.force_login(User.objects.create_user("m@example.org", role=role))
    response = client.post(
        "/api/team/invites",
        {"email": "x@example.org", "role": "author"},
        content_type="application/json",
    )
    assert response.status_code == 403


def test_operators_list_and_revoke_pending_invites(client: Client) -> None:
    operator(client)
    token = invite(client, role="reviewer")
    (pending,) = client.get("/api/team/invites").json()
    assert (pending["email"], pending["role"]) == ("ada@example.org", "reviewer")
    assert client.delete(f"/api/team/invites/{pending['public_id']}").status_code == 204
    assert client.get("/api/team/invites").json() == []
    assert client.get(f"/api/invites/{token}").json()["code"] == "CA0105"


def test_an_accepted_invite_opens_sign_up_with_its_role(client: Client) -> None:
    operator(client)
    token = invite(client, role="reviewer")
    client.logout()
    assert client.post(f"/api/invites/{token}/accept").status_code == 200
    assert sign_up(client, "ada@example.org") == 200
    user = User.objects.get(email="ada@example.org")
    assert user.role == Role.REVIEWER and user.check_password(PASSWORD)
    assert Invite.objects.get().accepted_by == user
    assert client.get("/api/me").json()["user"]["email"] == "ada@example.org"
    assert client.get(f"/api/invites/{token}").json()["code"] == "CA0106"


def test_without_an_invite_sign_up_is_refused(client: Client) -> None:
    assert sign_up(client, "ada@example.org") == 403
    assert not User.objects.filter(email="ada@example.org").exists()


def test_sign_up_must_use_the_invites_email(client: Client) -> None:
    operator(client)
    token = invite(client)
    client.logout()
    client.post(f"/api/invites/{token}/accept")
    assert sign_up(client, "someone.else@example.org") == 400
    assert not User.objects.filter(email="someone.else@example.org").exists()


def test_an_invite_that_expires_after_accepting_is_refused(client: Client) -> None:
    operator(client)
    token = invite(client)
    client.logout()
    client.post(f"/api/invites/{token}/accept")
    Invite.objects.update(expires_at=timezone.now() - timedelta(seconds=1))
    assert sign_up(client, "ada@example.org") == 403
    assert not User.objects.filter(email="ada@example.org").exists()


def test_invite_operator_prints_a_working_link(capsys: pytest.CaptureFixture[str]) -> None:
    call_command("invite_operator", "first@example.org")
    (token,) = re.findall(r"/join/([A-Za-z0-9_-]+)", capsys.readouterr().out)
    assert Client().get(f"/api/invites/{token}").json() == {
        "email": "first@example.org",
        "role": "operator",
    }
