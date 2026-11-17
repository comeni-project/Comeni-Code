"""Goal suggestions choose only indexed topics and fall back to deterministic search."""

import json
from pathlib import Path
from typing import Any

import pytest
from django.test import Client

from code_api.ai import gateway
from code_api.ai.gateway import Completion
from code_api.ai.models import AICall, Connection, SiteSetting
from code_api.content.index import rebuild_index

pytestmark = pytest.mark.django_db
ROOT = Path(__file__).resolve().parents[3] / "tests/fixtures/salmon"


@pytest.fixture
def indexed(settings: Any) -> None:
    settings.CODE_AI_MODEL = None
    settings.CODE_AI_API_KEY = None
    settings.CODE_AI_BASE_URL = None
    rebuild_index(ROOT, commit="goals")


def configured() -> None:
    connection = Connection.objects.create(
        name="Local", kind="self-hosted", endpoint="http://local/v1"
    )
    SiteSetting.objects.create(
        site="default", same_as_default=False, connection=connection, model="openai/test"
    )


def post(client: Client, query: str) -> Any:
    return client.post(
        "/api/goals/suggest",
        data=json.dumps({"query": query}),
        content_type="application/json",
    )


def test_suggestions_are_mapped_from_search_and_reviewed_peers(
    client: Client, indexed: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    configured()
    seen: list[list[dict[str, str]]] = []

    def answer(route: Any, messages: list[dict[str, str]]) -> Completion:
        seen.append(messages)
        candidates = json.loads(messages[-1]["content"])["candidates"]
        ids = [candidate["id"] for candidate in candidates]
        assert "salmon" in ids and "kallisto" in ids
        return Completion('{"ids": ["kallisto", "salmon"]}', 7, 2, None)

    monkeypatch.setattr(gateway, "transport", answer)
    response = post(client, "salmon")
    assert response.status_code == 200
    assert [item["id"] for item in response.json()["results"]] == ["kallisto", "salmon"]
    call = AICall.objects.get(site="goal-suggestions")
    assert call.user_id is None and call.prompt_id == "goal-suggestions@1"
    assert call.outcome == "answered" and len(seen) == 1


@pytest.mark.parametrize("reply", ['{"ids": ["made-up"]}', '{"ids": [1]}', "not json"])
def test_invalid_model_choices_fall_back_to_plain_search(
    client: Client,
    indexed: None,
    monkeypatch: pytest.MonkeyPatch,
    reply: str,
) -> None:
    configured()
    monkeypatch.setattr(gateway, "transport", lambda route, messages: Completion(reply, 1, 1, None))
    response = post(client, "salmon")
    assert response.status_code == 200
    assert response.json()["results"][0]["id"] == "salmon"
    assert AICall.objects.get().user_id is None


def test_no_model_silently_uses_plain_search(client: Client, indexed: None) -> None:
    response = post(client, "salmon")
    assert response.status_code == 200
    assert response.json()["results"][0]["id"] == "salmon"
    assert AICall.objects.count() == 0


def test_cap_refusal_silently_uses_plain_search(client: Client, indexed: None) -> None:
    configured()
    SiteSetting.objects.create(site="goal-suggestions", cap=1)
    AICall.objects.create(site="goal-suggestions", model="m", outcome="answered")
    response = post(client, "salmon")
    assert response.status_code == 200
    assert response.json()["results"][0]["id"] == "salmon"
    assert AICall.objects.count() == 2


def test_provider_failure_silently_uses_plain_search(
    client: Client, indexed: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    configured()

    def fail(route: Any, messages: list[dict[str, str]]) -> Completion:
        raise RuntimeError("provider detail must not reach the learner")

    monkeypatch.setattr(gateway, "transport", fail)
    response = post(client, "salmon")
    assert response.status_code == 200
    assert response.json()["results"][0]["id"] == "salmon"
    assert AICall.objects.get().outcome == "failed"


def test_no_candidates_skips_the_model(client: Client, indexed: None) -> None:
    response = post(client, "not in these pages")
    assert response.status_code == 200
    assert response.json()["results"] == []
    assert AICall.objects.count() == 0


@pytest.mark.parametrize(
    ("query", "code"),
    [("   ", "CA0003"), ("x" * 241, "CA0409")],
    ids=["blank", "overlong"],
)
def test_query_bounds_are_reported(client: Client, indexed: None, query: str, code: str) -> None:
    response = post(client, query)
    assert response.status_code == 422
    assert response.json()["code"] == code
    assert AICall.objects.count() == 0


def test_missing_index_keeps_the_existing_503(client: Client) -> None:
    response = post(client, "salmon")
    assert response.status_code == 503
    assert response.json()["code"] == "CA0001"
