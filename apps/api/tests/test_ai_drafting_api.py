"""Authors see draft-scoped proposals, not installation-wide operator usage."""

import uuid
from pathlib import Path
from typing import Any

import pytest
from django.test import Client

from code_api.accounts.models import User
from code_api.ai.models import Connection, SiteSetting
from code_api.content.index import rebuild_index
from code_api.studio import ai_drafting, drafts

pytestmark = pytest.mark.django_db
ROOT = Path(__file__).resolve().parents[3] / "tests/fixtures/salmon"


def test_author_routes_are_draft_scoped_and_usage_stays_operator_only(
    ada: User, monkeypatch: pytest.MonkeyPatch, settings: Any
) -> None:
    settings.CODE_AI_MODEL = None
    rebuild_index(ROOT)
    first = drafts.open_existing("dna-and-genes", by=ada)
    second = drafts.open_existing("salmon", by=ada)
    local = Connection.objects.create(name="Local", kind="self-hosted", endpoint="http://local/v1")
    SiteSetting.objects.create(
        site="default", same_as_default=False, connection=local, model="openai/test"
    )
    monkeypatch.setattr(ai_drafting, "enqueue", lambda identity: None)
    client = Client()
    base = f"/api/studio/drafts/{first.public_id}/ai/proposals"
    assert client.get(base).status_code == 401
    client.force_login(ada)
    assert client.get("/api/studio/ai/usage").status_code == 403
    body = {
        "request_id": str(uuid.uuid4()),
        "kind": "block",
        "target": "block/0",
        "based_on": 1,
        "instruction": "Explain.",
    }
    result = client.post(base, body, content_type="application/json")
    assert result.status_code == 200, result.content
    identity = result.json()["public_id"]
    assert len(client.get(base).json()) == 1
    foreign = f"/api/studio/drafts/{second.public_id}/ai/proposals/{identity}"
    assert client.get(foreign).status_code == 404
    assert client.post(foreign + "/discard", {}, content_type="application/json").status_code == 404
    assert (
        client.post(
            base + f"/{identity}/accept", {"based_on": 1}, content_type="application/json"
        ).status_code
        == 422
    )
