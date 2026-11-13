"""GET /api/studio/problem-kits (M6.8b spec, M6PB.4): what the builder knows about each kit."""

import pytest
from code_problems import KITS
from django.test import Client

from code_api.accounts.models import User

pytestmark = pytest.mark.django_db


def test_an_author_gets_each_kit_with_its_example_and_sample(ada: User) -> None:
    client = Client()
    client.force_login(ada)
    kits = client.get("/api/studio/problem-kits").json()
    assert [kit["name"] for kit in kits] == list(KITS)
    first = kits[0]
    assert first["rung"] == KITS[first["name"]].rung
    assert first["about"] and first["params_schema"]["type"] == "object"
    assert [m["name"] for m in first["mistakes"]] == list(KITS[first["name"]].mistakes)
    assert first["example"]["sample"]["seed"] == 1
    assert first["sample_dataset"] and first["sample_output"]


def test_signed_out_is_refused() -> None:
    assert Client().get("/api/studio/problem-kits").status_code == 401
