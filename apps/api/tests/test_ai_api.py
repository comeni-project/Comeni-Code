"""Studio's AI routes (M5.1 spec, M5G.7) and the health line: operators only, a key never sent
back, `.env` locked, Test recording one call, Usage from the record."""

from typing import Any

import pytest
from cryptography.fernet import Fernet
from django.test import Client

from code_api.accounts.models import User
from code_api.ai import gateway, settings_api
from code_api.ai.gateway import Completion
from code_api.ai.models import AICall, Connection
from code_api.ai.resolve import Route

pytestmark = pytest.mark.django_db
BASE = "/api/studio/ai"


@pytest.fixture(autouse=True)
def _clean(settings: Any) -> None:
    settings.CODE_AI_MODEL = None
    settings.CODE_AI_API_KEY = None
    settings.CODE_AI_BASE_URL = None
    settings.CODE_SETTINGS_KEY = Fernet.generate_key().decode()


@pytest.fixture
def operator(otto: User) -> Client:
    client = Client()
    client.force_login(otto)
    return client


def post(client: Client, path: str, body: dict[str, Any]) -> Any:
    return client.post(f"{BASE}/{path}", body, content_type="application/json")


def put(client: Client, path: str, body: dict[str, Any]) -> Any:
    return client.put(f"{BASE}/{path}", body, content_type="application/json")


def test_authors_cannot_open_it(ada: User) -> None:
    client = Client()
    client.force_login(ada)
    assert client.get(f"{BASE}/settings").status_code == 403


def test_settings_list_every_site_and_say_what_is_ready(operator: Client) -> None:
    body = operator.get(f"{BASE}/settings").json()
    assert [s["key"] for s in body["sites"]][:3] == ["default", "goal-suggestions", "page-drafting"]
    assert body["connections"] == []
    assert body["settings_key_ready"] is True


def test_a_hosted_key_is_kept_and_never_sent_back(operator: Client) -> None:
    answer = post(
        operator, "connections", {"name": "Anthropic", "kind": "hosted", "key": "sk-ant-abcd7f2a"}
    )
    assert answer.status_code == 200, answer.content
    assert "sk-ant" not in answer.content.decode()
    kept = answer.json()["connections"][0]
    assert kept["key"] == "set ····7f2a"
    assert Connection.objects.get().key_sealed is not None


def test_a_key_without_the_settings_key_is_refused(operator: Client, settings: Any) -> None:
    settings.CODE_SETTINGS_KEY = None
    answer = post(operator, "connections", {"name": "A", "kind": "hosted", "key": "sk-1"})
    assert (answer.status_code, answer.json()["code"]) == (422, "CA0402")


def test_env_is_a_locked_connection_and_its_default_cannot_change(
    operator: Client, settings: Any
) -> None:
    settings.CODE_AI_MODEL = "openai/gpt-6.1"
    settings.CODE_AI_API_KEY = "sk-envkey99"
    body = operator.get(f"{BASE}/settings").json()
    env = body["connections"][0]
    assert (env["name"], env["locked"], env["key"]) == ("From .env", True, "set ····ey99")
    default = next(s for s in body["sites"] if s["key"] == "default")
    assert default["locked"] is True and default["model"] == "openai/gpt-6.1"
    refused = put(operator, "sites/default", {"same_as_default": False, "model": "x/y"})
    assert (refused.status_code, refused.json()["code"]) == (409, "CA0407")


def test_a_hosted_model_must_be_provider_slash_model(operator: Client) -> None:
    hosted = post(operator, "connections", {"name": "H", "kind": "hosted", "key": "sk-1234"})
    connection = hosted.json()["connections"][0]["id"]
    refused = put(
        operator,
        "sites/page-drafting",
        {"same_as_default": False, "connection": connection, "model": "gpt6"},
    )
    assert (refused.status_code, refused.json()["code"]) == (422, "CA0401")
    saved = put(
        operator,
        "sites/page-drafting",
        {"same_as_default": False, "connection": connection, "model": "openai/gpt-6.1", "cap": 7},
    )
    site = next(s for s in saved.json()["sites"] if s["key"] == "page-drafting")
    assert (site["model"], site["cap"], site["same_as_default"]) == ("openai/gpt-6.1", 7, False)


def test_test_lists_models_and_records_a_call(
    operator: Client, monkeypatch: pytest.MonkeyPatch
) -> None:
    added = post(
        operator,
        "connections",
        {"name": "Local", "kind": "self-hosted", "endpoint": "http://ollama:11434"},
    )
    connection = added.json()["connections"][0]
    assert connection["endpoint"] == "http://ollama:11434/v1"
    monkeypatch.setattr(settings_api, "listed_models", lambda endpoint: ["qwen2.5:7b"])
    asked: list[Route] = []

    def fake(route: Route, messages: list[dict[str, str]]) -> Completion:
        asked.append(route)
        return Completion("ok", 2, 1, None)

    monkeypatch.setattr(gateway, "transport", fake)
    tested = post(operator, f"connections/{connection['id']}/test", {})
    shown = tested.json()["connections"][0]
    assert shown["models"] == ["openai/qwen2.5:7b"] and shown["status"] == "ok"
    assert asked[0].model == "openai/qwen2.5:7b"
    assert asked[0].timeout == 20  # #462: Test has its own bounded timeout
    assert AICall.objects.get().prompt_id == "connection-test"


def test_usage_sums_the_record(operator: Client, otto: User) -> None:
    for outcome, tokens in (("answered", 10), ("answered", 20), ("capped", 0)):
        AICall.objects.create(
            site="page-drafting",
            user=otto,
            model="m",
            outcome=outcome,
            tokens_in=tokens,
            tokens_out=tokens,
        )
    AICall.objects.create(site="goal-suggestions", model="m", outcome="answered", tokens_in=1)
    body = operator.get(f"{BASE}/usage?range=today").json()
    assert (body["calls"], body["tokens"], body["refused"]) == (4, 61, 1)
    sites = {s["site"]: s["calls"] for s in body["by_site"]}
    assert sites == {"page-drafting": 3, "goal-suggestions": 1}
    people = {p["name"]: p["calls"] for p in body["by_person"]}
    assert people["learners, together"] == 1
    assert len(body["recent"]) == 4


def test_health_says_whether_ai_is_configured_and_stays_ok(
    client: Client, monkeypatch: pytest.MonkeyPatch
) -> None:
    from code_api.health import checks

    monkeypatch.setattr(checks, "CHECKS", {})
    body = client.get("/api/health").json()
    assert body["ai"] == "not configured" and body["status"] == "ok"
    Connection.objects.create(name="Local", kind="self-hosted", endpoint="http://x/v1")
    assert client.get("/api/health").json()["ai"] == "configured"


def test_usage_says_how_each_site_is_priced(operator: Client) -> None:
    """Billed where a cost was recorded, a plan for chatgpt/ models, local otherwise."""
    AICall.objects.create(site="page-drafting", model="chatgpt/gpt-6.1-sol", outcome="answered")
    AICall.objects.create(site="figure-data", model="openai/gpt-6.1", outcome="answered", cost=1)
    AICall.objects.create(site="resource-suggestion", model="openai/stub", outcome="answered")
    body = operator.get(f"{BASE}/usage?range=today").json()
    priced = {s["site"]: s["priced"] for s in body["by_site"]}
    assert priced == {
        "page-drafting": "plan",
        "figure-data": "billed",
        "resource-suggestion": "local",
    }


def test_a_chatgpt_connection_takes_only_chatgpt_models(operator: Client) -> None:
    """#453: any other model on the plan's connection would be sent with the host's key."""
    plan = Connection.objects.create(name="ChatGPT plan", kind="chatgpt")
    refused = put(
        operator,
        "sites/page-drafting",
        {"same_as_default": False, "connection": plan.pk, "model": "openai/gpt-4o"},
    )
    assert (refused.status_code, refused.json()["code"]) == (422, "CA0401")


def test_a_hosted_connection_is_tested_through_a_model_a_site_chose(
    operator: Client, monkeypatch: pytest.MonkeyPatch
) -> None:
    """#456: a hosted provider lists no models; its Test tries the one a site typed."""
    hosted = post(operator, "connections", {"name": "H", "kind": "hosted", "key": "sk-1234"})
    connection = hosted.json()["connections"][0]["id"]
    put(
        operator,
        "sites/page-drafting",
        {"same_as_default": False, "connection": connection, "model": "anthropic/claude-sonnet-5"},
    )
    asked: list[Route] = []

    def fake(route: Route, messages: list[dict[str, str]]) -> Completion:
        asked.append(route)
        return Completion("ok", 2, 1, None)

    monkeypatch.setattr(gateway, "transport", fake)
    tested = post(operator, f"connections/{connection}/test", {})
    assert tested.json()["connections"][0]["status"] == "ok"
    assert [r.model for r in asked] == ["anthropic/claude-sonnet-5"]
    assert asked[0].timeout == 20
