"""Call sites, connections, encrypted keys and the call record (M5.1 spec, M5G.2, M5G.3, M5G.6)."""

from typing import Any

import pytest
from cryptography.fernet import Fernet
from django.db import IntegrityError

from code_api.ai import secrets
from code_api.ai.models import AICall, Connection, SiteSetting
from code_api.ai.sites import SITES, site

KEY = Fernet.generate_key().decode()


def test_the_call_sites_are_the_declared_ten() -> None:
    """Invariant 7's call sites, and default; adding one is a reviewed change."""
    assert [s.key for s in SITES] == [
        "default",
        "goal-suggestions",
        "page-drafting",
        "figure-data",
        "resource-suggestion",
        "block-evaluation",
        "assistant",
        "connecting-text",
        "request-grouping",
        "skeleton-drafting",
    ]
    assert {s.wired for s in SITES} == {"M5", "M7"}
    assert [s.key for s in SITES if s.wired == "M7"] == [
        "connecting-text",
        "request-grouping",
        "skeleton-drafting",
    ]
    assert site("page-drafting").label == "Page drafting"
    with pytest.raises(KeyError):
        site("chat-with-learners")


def test_a_key_is_sealed_and_opened(settings: Any) -> None:
    settings.CODE_SETTINGS_KEY = KEY
    sealed = secrets.seal("sk-abcdef1234")
    assert b"sk-abcdef" not in sealed
    assert secrets.open_(sealed) == "sk-abcdef1234"


def test_no_settings_key_refuses_a_key(settings: Any) -> None:
    settings.CODE_SETTINGS_KEY = None
    with pytest.raises(secrets.NoSettingsKey):
        secrets.seal("sk-1")


def test_a_changed_settings_key_opens_to_none(settings: Any) -> None:
    """Review Focus 4: the connection says to re-enter the key, never a 500."""
    settings.CODE_SETTINGS_KEY = KEY
    sealed = secrets.seal("sk-1")
    settings.CODE_SETTINGS_KEY = Fernet.generate_key().decode()
    assert secrets.open_(sealed) is None


def test_a_hidden_value_never_prints() -> None:
    hidden = secrets.Hidden("sk-abcdef1234")
    assert "sk-" not in repr(hidden) and "sk-" not in str(hidden)
    assert hidden.reveal() == "sk-abcdef1234"


@pytest.mark.django_db
def test_one_chatgpt_connection_per_installation() -> None:
    Connection.objects.create(name="ChatGPT plan", kind="chatgpt")
    with pytest.raises(IntegrityError):
        Connection.objects.create(name="Another plan", kind="chatgpt")


@pytest.mark.django_db
def test_a_site_setting_and_a_call_record() -> None:
    local = Connection.objects.create(name="Local", kind="self-hosted", endpoint="http://x:11434")
    SiteSetting.objects.create(site="page-drafting", connection=local, model="ollama_chat/q", cap=5)
    call = AICall.objects.create(
        site="page-drafting",
        connection_name="Local",
        model="ollama_chat/q",
        prompt_id="page-drafting@1",
        tokens_in=10,
        tokens_out=20,
        duration_ms=300,
        outcome="answered",
    )
    assert call.user is None and call.cost is None and call.code == ""
