"""The team, for operators (spec M4A.1). Needs Compose's Postgres."""

import uuid

import pytest
from django.test import Client

from code_api.accounts.models import User
from code_api.accounts.roles import Role

pytestmark = pytest.mark.django_db


def members() -> tuple[User, User]:
    op = User.objects.create_user("op@example.org", name="Op", role=Role.OPERATOR)
    ada = User.objects.create_user("ada@example.org", name="Ada", role=Role.AUTHOR)
    return op, ada


def patch_role(client: Client, user: User, role: str) -> tuple[int, dict[str, object]]:
    response = client.patch(
        f"/api/team/members/{user.public_id}", {"role": role}, content_type="application/json"
    )
    return response.status_code, response.json()


def test_operators_list_members_by_public_id(client: Client) -> None:
    op, ada = members()
    client.force_login(op)
    listed = client.get("/api/team/members").json()
    assert listed == [
        {
            "public_id": str(ada.public_id),
            "email": "ada@example.org",
            "name": "Ada",
            "role": "author",
            "active": True,
        },
        {
            "public_id": str(op.public_id),
            "email": "op@example.org",
            "name": "Op",
            "role": "operator",
            "active": True,
        },
    ]


def test_a_role_change_takes_effect_on_the_next_request(client: Client) -> None:
    op, ada = members()
    client.force_login(op)
    status, body = patch_role(client, ada, "operator")
    assert (status, body["role"]) == (200, "operator")
    ada_client = Client()
    ada_client.force_login(ada)
    assert ada_client.get("/api/team/members").status_code == 200
    patch_role(client, ada, "author")
    assert ada_client.get("/api/team/members").status_code == 403


def test_deactivating_signs_a_member_out(client: Client) -> None:
    op, ada = members()
    client.force_login(op)
    ada_client = Client()
    ada_client.force_login(ada)
    response = client.post(f"/api/team/members/{ada.public_id}/deactivate")
    assert (response.status_code, response.json()["active"]) == (200, False)
    assert ada_client.get("/api/me").json() == {"user": None}
    ada.refresh_from_db()
    assert ada.role == Role.AUTHOR  # the account and its history stay


def test_the_last_operator_cannot_be_demoted(client: Client) -> None:
    op, _ = members()
    client.force_login(op)
    status, body = patch_role(client, op, "reviewer")
    assert (status, body["code"]) == (409, "CA0108")
    op.refresh_from_db()
    assert op.role == Role.OPERATOR


def test_the_last_operator_cannot_be_deactivated(client: Client) -> None:
    op, _ = members()
    client.force_login(op)
    response = client.post(f"/api/team/members/{op.public_id}/deactivate")
    assert (response.status_code, response.json()["code"]) == (409, "CA0108")


def test_an_operator_may_step_down_when_another_remains(client: Client) -> None:
    op, ada = members()
    client.force_login(op)
    patch_role(client, ada, "operator")
    assert patch_role(client, op, "reviewer")[0] == 200


def test_an_unknown_member_is_404(client: Client) -> None:
    op, _ = members()
    client.force_login(op)
    response = client.post(f"/api/team/members/{uuid.uuid4()}/deactivate")
    assert (response.status_code, response.json()["code"]) == (404, "CA0109")


def test_a_reviewer_cannot_manage_the_team(client: Client) -> None:
    op, ada = members()
    client.force_login(User.objects.create_user("rev@example.org", role=Role.REVIEWER))
    assert client.get("/api/team/members").status_code == 403
    assert patch_role(client, ada, "reviewer")[0] == 403
    assert client.post(f"/api/team/members/{ada.public_id}/deactivate").status_code == 403
