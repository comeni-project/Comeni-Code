"""allauth in headless browser mode (spec M4A.3). Needs Compose's Postgres."""

from typing import Any

import pytest
from django.conf import settings
from django.test import Client, override_settings

from code_api.config.auth import github_providers, mailers
from code_api.config.env import Env

pytestmark = pytest.mark.django_db

KEY = "k" * 50


def env(**values: Any) -> Env:
    base = {
        "secret_key": KEY,
        "database_url": "postgresql://code:code@localhost:5433/code",
        "redis_url": "redis://localhost:6380/0",
    }
    return Env(_env_file=None, **(base | values))


def test_the_browser_client_answers(client: Client) -> None:
    response = client.get("/_allauth/browser/v1/config")
    assert response.status_code == 200
    assert response.json()["data"]["account"]["login_methods"] == ["email"]


def test_the_app_client_is_off(client: Client) -> None:
    assert client.get("/_allauth/app/v1/config").status_code == 404


def test_allauths_own_pages_are_off(client: Client) -> None:
    assert client.get("/_allauth/accounts/login/").status_code == 404


def test_github_is_off_without_a_client() -> None:
    assert github_providers(env()) == {}


def test_github_is_on_with_a_client() -> None:
    providers = github_providers(env(github_client_id="Iv1.abc", github_client_secret="s3cret"))
    assert providers["github"]["APPS"] == [{"client_id": "Iv1.abc", "secret": "s3cret"}]


def test_the_config_lists_github_when_it_is_set(client: Client) -> None:
    providers = github_providers(env(github_client_id="Iv1.abc", github_client_secret="s3cret"))
    with override_settings(SOCIALACCOUNT_PROVIDERS=providers):
        body = client.get("/_allauth/browser/v1/config").json()
    assert [provider["id"] for provider in body["data"]["socialaccount"]["providers"]] == ["github"]


def test_mail_goes_to_the_console_without_smtp() -> None:
    assert mailers(env())["default"]["BACKEND"] == "django.core.mail.backends.console.EmailBackend"


def test_mail_goes_by_smtp_when_a_host_is_set() -> None:
    mail = mailers(env(smtp_host="smtp.example", smtp_user="code", smtp_password="pw"))["default"]
    assert mail["BACKEND"] == "django.core.mail.backends.smtp.EmailBackend"
    assert mail["OPTIONS"] == {
        "host": "smtp.example",
        "port": 587,
        "username": "code",
        "password": "pw",
        "use_tls": True,
    }


def test_the_session_cookie_is_httponly_lax_and_two_weeks() -> None:
    assert settings.SESSION_COOKIE_HTTPONLY is True
    assert settings.SESSION_COOKIE_SAMESITE == "Lax"
    assert settings.SESSION_COOKIE_AGE == 14 * 24 * 60 * 60
    assert settings.CSRF_COOKIE_SAMESITE == "Lax"
