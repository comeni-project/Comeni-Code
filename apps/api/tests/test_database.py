"""The project boots against Postgres, with the custom user model (spec P2.2, P2.4)."""

import pytest
from django.contrib.auth import get_user_model
from django.db import connection

from code_api.accounts.models import User


@pytest.mark.django_db
def test_the_database_is_postgres() -> None:
    assert connection.vendor == "postgresql"


@pytest.mark.django_db
def test_the_database_session_is_in_utc() -> None:
    with connection.cursor() as cursor:
        cursor.execute("SHOW TIME ZONE")
        row = cursor.fetchone()
    assert row is not None
    assert row[0] == "UTC"


def test_the_user_model_is_ours() -> None:
    assert get_user_model() is User


@pytest.mark.django_db
def test_a_user_round_trips() -> None:
    User.objects.create_user(username="ada", email="ada@example.org", password="x" * 16)
    stored = User.objects.get(username="ada")
    assert stored.email == "ada@example.org"
    assert stored.check_password("x" * 16)
