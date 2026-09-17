"""GET /api/health (M0 part 3 spec, P3.2)."""

import pytest
from django.db import OperationalError
from django.test import Client

from code_api.config.env import database_from_url
from code_api.health import checks


@pytest.mark.django_db
def test_healthy_when_the_database_answers(client: Client, monkeypatch: pytest.MonkeyPatch) -> None:
    # Only the database here; Redis and the worker are tested in test_worker_health.py.
    monkeypatch.setattr(checks, "CHECKS", {"database": checks.database})
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert [(c["name"], c["status"]) for c in response.json()["checks"]] == [("database", "ok")]
    assert response["Cache-Control"] == "no-store"


def _fail() -> None:
    raise OperationalError("could not connect to server at db.internal:5432, password …")


def test_503_when_a_check_is_down_and_no_error_text_leaks(
    client: Client, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setitem(checks.CHECKS, "database", _fail)
    response = client.get("/api/health")
    assert response.status_code == 503
    body = response.json()
    assert body["status"] == "down"
    assert body["checks"][0]["status"] == "down"
    assert "db.internal" not in response.content.decode()


def test_an_unexpected_error_is_down_not_500(
    client: Client, monkeypatch: pytest.MonkeyPatch
) -> None:
    def boom() -> None:
        raise RuntimeError("bug")

    monkeypatch.setitem(checks.CHECKS, "database", boom)
    assert client.get("/api/health").status_code == 503


def test_the_database_connection_times_out_quickly() -> None:
    options = database_from_url("postgresql://code:code@localhost:5433/code")["OPTIONS"]
    assert options == {"connect_timeout": 3}
