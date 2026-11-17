"""The gateway (M5.1 spec, M5G.1, M5G.3, M5G.5, M5G.6): a site resolves to a model or a refusal,
its cap is counted from the record, every call is recorded without its text, and LiteLLM is
always given the key and endpoint, never left to read the host's environment."""

from typing import Any

import pytest
from cryptography.fernet import Fernet
from pydantic import BaseModel

from code_api.accounts.models import User
from code_api.ai import gateway, secrets
from code_api.ai.gateway import Completion, Reply
from code_api.ai.models import AICall, Connection, SiteSetting
from code_api.ai.resolve import Refused, Route, resolve

pytestmark = pytest.mark.django_db

ASK = [{"role": "user", "content": "say ok"}]


@pytest.fixture(autouse=True)
def _no_env_model(settings: Any) -> None:
    settings.CODE_AI_MODEL = None
    settings.CODE_AI_API_KEY = None
    settings.CODE_AI_BASE_URL = None
    settings.CODE_SETTINGS_KEY = Fernet.generate_key().decode()


@pytest.fixture
def sent(monkeypatch: pytest.MonkeyPatch) -> list[Route]:
    """The fake transport: records each route it is given and answers ok."""
    routes: list[Route] = []

    def fake(route: Route, messages: list[dict[str, str]]) -> Completion:
        routes.append(route)
        return Completion(text='{"word": "ok"}', tokens_in=3, tokens_out=2, cost=None)

    monkeypatch.setattr(gateway, "transport", fake)
    return routes


def local(model: str = "ollama_chat/qwen2.5:7b") -> Connection:
    return Connection.objects.create(
        name="Local", kind="self-hosted", endpoint="http://ollama:11434", models_listed=[model]
    )


def default_to(connection: Connection, model: str) -> None:
    SiteSetting.objects.create(
        site="default", same_as_default=False, connection=connection, model=model
    )


def test_no_connection_refuses_and_records_nothing(sent: list[Route]) -> None:
    out = gateway.call("page-drafting", ASK, by=None, prompt_id="p@1")
    assert isinstance(out, Refused) and out.code == "CA0400"
    assert sent == [] and AICall.objects.count() == 0


def test_env_model_is_the_default_and_followed(settings: Any) -> None:
    settings.CODE_AI_MODEL = "openai/gpt-6.1"
    settings.CODE_AI_API_KEY = "sk-env"
    route = resolve("page-drafting")
    assert isinstance(route, Route)
    assert (route.connection_name, route.model) == ("From .env", "openai/gpt-6.1")
    assert route.api_key is not None and route.api_key.reveal() == "sk-env"


def test_a_self_hosted_site_calls_its_endpoint_with_no_key(sent: list[Route]) -> None:
    default_to(local(), "ollama_chat/qwen2.5:7b")
    out = gateway.call("page-drafting", ASK, by=None, prompt_id="p@1")
    assert isinstance(out, Reply) and out.text == '{"word": "ok"}'
    assert sent[0].api_base == "http://ollama:11434" and sent[0].api_key is None
    record = AICall.objects.get()
    assert (record.site, record.outcome, record.tokens_in, record.tokens_out) == (
        "page-drafting",
        "answered",
        3,
        2,
    )
    assert record.model == "ollama_chat/qwen2.5:7b" and record.prompt_id == "p@1"


def test_a_site_whose_connection_was_removed_says_so() -> None:
    """Review Focus 3."""
    connection = local()
    SiteSetting.objects.create(
        site="page-drafting", same_as_default=False, connection=connection, model="m"
    )
    connection.delete()
    out = resolve("page-drafting")
    assert isinstance(out, Refused) and out.code == "CA0400"
    assert "removed" in out.sentence


def test_a_hosted_connection_without_a_key_is_refused_before_litellm(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Review Focus 2: LiteLLM reads OPENAI_API_KEY when given None, so a keyless hosted call
    never reaches it."""
    monkeypatch.setenv("OPENAI_API_KEY", "sk-from-the-host")
    default_to(Connection.objects.create(name="Hosted", kind="hosted"), "openai/gpt-6.1")
    import litellm

    def completion(**kwargs: Any) -> Any:
        raise AssertionError("LiteLLM was called")

    monkeypatch.setattr(litellm, "completion", completion)
    out = gateway.call("page-drafting", ASK, by=None, prompt_id="p@1")
    assert isinstance(out, Refused) and out.code == "CA0400"
    assert "no key" in out.sentence


def test_litellm_never_gets_none_for_a_key_it_would_fill_from_the_host(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Review Focus 2: a self-hosted call carries a placeholder key, so the host's
    OPENAI_API_KEY is never sent to the self-hosted server."""
    monkeypatch.setenv("OPENAI_API_KEY", "sk-from-the-host")
    default_to(local(), "openai/qwen2.5:7b")
    asked: dict[str, Any] = {}
    import litellm

    def completion(**kwargs: Any) -> Any:
        asked.update(kwargs)
        raise RuntimeError("stop here")

    monkeypatch.setattr(litellm, "completion", completion)
    gateway.call("page-drafting", ASK, by=None, prompt_id="p@1")
    assert asked["api_key"] == "none"
    assert asked["api_base"] == "http://ollama:11434"


def test_a_hosted_key_is_opened_for_the_call(sent: list[Route]) -> None:
    hosted = Connection.objects.create(
        name="Hosted", kind="hosted", key_sealed=secrets.seal("sk-kept"), key_last4="kept"
    )
    default_to(hosted, "openai/gpt-6.1")
    gateway.call("page-drafting", ASK, by=None, prompt_id="p@1")
    assert sent[0].api_key is not None and sent[0].api_key.reveal() == "sk-kept"


def test_the_cap_refuses_the_call_after_it(sent: list[Route]) -> None:
    default_to(local(), "ollama_chat/qwen2.5:7b")
    SiteSetting.objects.create(site="page-drafting", same_as_default=True, cap=2)
    for _ in range(2):
        assert isinstance(gateway.call("page-drafting", ASK, by=None, prompt_id="p@1"), Reply)
    out = gateway.call("page-drafting", ASK, by=None, prompt_id="p@1")
    assert isinstance(out, Refused) and out.code == "CA0404"
    assert list(AICall.objects.values_list("outcome", flat=True).order_by("id")) == [
        "answered",
        "answered",
        "capped",
    ]
    assert len(sent) == 2


def test_a_provider_error_is_refused_in_its_words(monkeypatch: pytest.MonkeyPatch) -> None:
    default_to(local(), "ollama_chat/qwen2.5:7b")

    def broken(route: Route, messages: list[dict[str, str]]) -> Completion:
        raise RuntimeError("model 'qwen' not found")

    monkeypatch.setattr(gateway, "transport", broken)
    out = gateway.call("page-drafting", ASK, by=None, prompt_id="p@1")
    assert isinstance(out, Refused) and out.code == "CA0405"
    assert "not found" in out.sentence
    assert AICall.objects.get().outcome == "failed"


class Word(BaseModel):
    word: str


class Number(BaseModel):
    number: int


def test_a_reply_of_the_shape_asked_for(sent: list[Route], django_user_model: Any) -> None:
    default_to(local(), "ollama_chat/qwen2.5:7b")
    ada: User = django_user_model.objects.create_user("ada@example.org")
    out = gateway.call("page-drafting", ASK, by=ada, prompt_id="p@1", reply=Word)
    assert isinstance(out, Reply) and out.value == Word(word="ok")
    assert AICall.objects.get().user == ada
    refused = gateway.call("page-drafting", ASK, by=ada, prompt_id="p@1", reply=Number)
    assert isinstance(refused, Refused) and refused.code == "CA0406"


def test_an_undeclared_site_is_never_called() -> None:
    with pytest.raises(KeyError):
        gateway.call("chat-with-learners", ASK, by=None, prompt_id="p@1")


def test_a_key_that_cannot_be_read_asks_for_it_again(settings: Any) -> None:
    """Review Focus 4: CODE_SETTINGS_KEY changed since the key was kept."""
    hosted = Connection.objects.create(
        name="Hosted", kind="hosted", key_sealed=secrets.seal("sk-kept"), key_last4="kept"
    )
    default_to(hosted, "openai/gpt-6.1")
    settings.CODE_SETTINGS_KEY = Fernet.generate_key().decode()
    out = resolve("page-drafting")
    assert isinstance(out, Refused) and out.code == "CA0402"
    assert "enter it again" in out.sentence


def test_a_chatgpt_connection_calls_only_chatgpt_models(
    monkeypatch: pytest.MonkeyPatch, sent: list[Route]
) -> None:
    """#453: a ChatGPT connection with another provider's model would leave the key to LiteLLM,
    which reads the host's OPENAI_API_KEY; it is refused before any call."""
    monkeypatch.setenv("OPENAI_API_KEY", "sk-from-the-host")
    plan = Connection.objects.create(name="ChatGPT plan", kind="chatgpt")
    default_to(plan, "openai/gpt-4o")
    out = gateway.call("page-drafting", ASK, by=None, prompt_id="p@1")
    assert isinstance(out, Refused) and out.code == "CA0401"
    assert sent == []


def test_only_a_chatgpt_model_is_sent_without_a_key(monkeypatch: pytest.MonkeyPatch) -> None:
    """#453: the key is left out by the model's provider, not by the connection's kind."""
    asked: dict[str, Any] = {}
    import litellm

    def completion(**kwargs: Any) -> Any:
        asked.update(kwargs)
        raise RuntimeError("stop here")

    monkeypatch.setattr(litellm, "completion", completion)
    for kind, model, key in [
        ("chatgpt", "openai/gpt-4o", "none"),
        ("env", "chatgpt/gpt-6.1-sol", None),
        ("chatgpt", "chatgpt/gpt-6.1-sol", None),
    ]:
        with pytest.raises(RuntimeError):
            gateway.litellm_transport(Route("C", kind, model, None, None), ASK)
        assert asked["api_key"] == key, (kind, model)


def test_a_learners_call_keeps_no_person(sent: list[Route], django_user_model: Any) -> None:
    """#460, M5G.6: whoever the caller passes, a learner's call is recorded without them."""
    default_to(local(), "openai/qwen2.5:7b")
    learner = django_user_model.objects.create_user(email="lin@example.org", password="x")
    gateway.call("goal-suggestions", ASK, by=learner, prompt_id="goals@1")
    gateway.call("page-drafting", ASK, by=learner, prompt_id="p@1")
    kept = dict(AICall.objects.values_list("site", "user"))
    assert kept == {"goal-suggestions": None, "page-drafting": learner.pk}


def test_a_test_that_reaches_the_network_fails() -> None:
    """#460, M5G.1: with no fake transport, the gateway fails the test instead of calling out."""
    Connection.objects.create(name="Closed", kind="self-hosted", endpoint="http://127.0.0.1:9/v1")
    default_to(Connection.objects.get(name="Closed"), "openai/x")
    with pytest.raises(pytest.fail.Exception, match="reached the network"):
        gateway.call("page-drafting", ASK, by=None, prompt_id="p@1")
