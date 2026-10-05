"""The user and its role (spec M4A.1). Needs Compose's Postgres."""

import uuid

import pytest
from django.db import IntegrityError

from code_api.accounts.models import User
from code_api.accounts.roles import Role

pytestmark = pytest.mark.django_db


def test_a_user_is_keyed_by_email() -> None:
    user = User.objects.create_user("Ada@Example.org", password="a long passphrase")
    assert user.email == "Ada@example.org"  # the domain is normalised, the local part kept
    assert User.USERNAME_FIELD == "email"
    assert not hasattr(user, "username")
    assert user.check_password("a long passphrase")


def test_emails_clash_whatever_their_case() -> None:
    User.objects.create_user("ada@example.org")
    with pytest.raises(IntegrityError):
        User.objects.create_user("ADA@example.org")


def test_a_public_id_is_set_once_and_kept() -> None:
    user = User.objects.create_user("ada@example.org")
    assert isinstance(user.public_id, uuid.UUID)
    first = user.public_id
    user.name = "Ada Lovelace"
    user.save()
    user.refresh_from_db()
    assert user.public_id == first
    assert User.objects.create_user("grace@example.org").public_id != first


def test_a_user_has_one_name_and_no_role_by_default() -> None:
    user = User.objects.create_user("ada@example.org")
    assert user.name == ""
    assert user.role == ""
    assert not hasattr(user, "first_name")


@pytest.mark.parametrize(
    ("role", "acts_as"),
    [
        (Role.OPERATOR, {Role.AUTHOR, Role.REVIEWER, Role.OPERATOR}),
        (Role.REVIEWER, {Role.AUTHOR, Role.REVIEWER}),
        (Role.AUTHOR, {Role.AUTHOR}),
        ("", set()),
    ],
)
def test_roles_rank(role: str, acts_as: set[Role]) -> None:
    user = User(email="a@example.org", role=role)
    assert {wanted for wanted in Role if user.can_act_as(wanted)} == acts_as


def test_a_superuser_is_an_operator() -> None:
    user = User.objects.create_superuser("root@example.org", password="a long passphrase")
    assert user.role == Role.OPERATOR and user.is_staff and user.is_superuser
