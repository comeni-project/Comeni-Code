"""The environment is validated once, and only `CODE_*` variables count (spec P2.3)."""

from pathlib import Path

import pytest
from pydantic import ValidationError

from code_api.config.env import Env, database_from_url

KEY = "k" * 50
URL = "postgresql://code:code@localhost:5433/code"
REDIS = "redis://localhost:6380/0"


@pytest.fixture(autouse=True)
def _clean_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    """Each test starts from no `CODE_*` variables, whatever the shell or `.env` holds."""
    for name in (
        "SECRET_KEY",
        "DATABASE_URL",
        "REDIS_URL",
        "DEBUG",
        "ALLOWED_HOSTS",
        "STATIC_ROOT",
        "CONTENT_ROOT",
    ):
        monkeypatch.delenv(f"CODE_{name}", raising=False)


def make_env(monkeypatch: pytest.MonkeyPatch, **values: str) -> Env:
    for name, value in values.items():
        monkeypatch.setenv(f"CODE_{name.upper()}", value)
    return Env(_env_file=None)


def test_reads_prefixed_variables(monkeypatch: pytest.MonkeyPatch) -> None:
    env = make_env(
        monkeypatch,
        secret_key=KEY,
        database_url=URL,
        redis_url=REDIS,
        debug="true",
        allowed_hosts=" code.example , localhost ,",
    )
    assert env.secret_key.get_secret_value() == KEY
    assert env.database_url.get_secret_value() == URL
    assert env.debug is True
    assert env.allowed_hosts == ["code.example", "localhost"]


def test_defaults_are_the_safe_ones(monkeypatch: pytest.MonkeyPatch) -> None:
    env = make_env(monkeypatch, secret_key=KEY, database_url=URL, redis_url=REDIS)
    assert env.debug is False
    assert env.allowed_hosts == []
    assert env.content_root is None


def test_the_content_root_is_a_path(monkeypatch: pytest.MonkeyPatch) -> None:
    env = make_env(
        monkeypatch,
        secret_key=KEY,
        database_url=URL,
        redis_url=REDIS,
        content_root="../comeni-code-content",
    )
    assert env.content_root == Path("../comeni-code-content")


def test_ignores_unprefixed_variables(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DATABASE_URL", "postgresql://other:other@elsewhere/other")
    with pytest.raises(ValidationError) as caught:
        make_env(monkeypatch, secret_key=KEY, redis_url=REDIS)
    assert "database_url" in str(caught.value)


def test_a_missing_variable_is_named(monkeypatch: pytest.MonkeyPatch) -> None:
    with pytest.raises(ValidationError) as caught:
        make_env(monkeypatch, database_url=URL, redis_url=REDIS)
    assert "secret_key" in str(caught.value)


def test_a_short_secret_key_is_refused_without_being_shown(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    with pytest.raises(ValidationError) as caught:
        make_env(monkeypatch, secret_key="too-short-to-be-a-key", database_url=URL, redis_url=REDIS)
    assert "secret_key" in str(caught.value)
    assert "too-short-to-be-a-key" not in str(caught.value)


def test_only_postgres_urls_are_accepted_and_none_is_shown(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    with pytest.raises(ValidationError) as caught:
        make_env(
            monkeypatch,
            secret_key=KEY,
            database_url="mysql://root:hunter2@db/code",
            redis_url=REDIS,
        )
    assert "must be a postgresql:// URL" in str(caught.value)
    assert "hunter2" not in str(caught.value)


def test_only_redis_urls_are_accepted_and_none_is_shown(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    with pytest.raises(ValidationError) as caught:
        make_env(
            monkeypatch,
            secret_key=KEY,
            database_url=URL,
            redis_url="http://user:hunter2@cache/0",
        )
    assert "must be a redis:// URL" in str(caught.value)
    assert "hunter2" not in str(caught.value)


def test_database_from_url() -> None:
    assert database_from_url("postgresql://code:p%40ss%2Fword@db.internal:6543/code_db") == {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": "code_db",
        "USER": "code",
        "PASSWORD": "p@ss/word",
        "HOST": "db.internal",
        "PORT": "6543",
        "OPTIONS": {"connect_timeout": 3},
    }


def test_database_from_url_without_port_or_password() -> None:
    database = database_from_url("postgres://code@localhost/code")
    assert (database["HOST"], database["PORT"], database["PASSWORD"]) == ("localhost", "", "")


def test_database_from_url_needs_a_database_name() -> None:
    with pytest.raises(ValueError, match="names no database"):
        database_from_url("postgresql://code:code@localhost:5433/")
