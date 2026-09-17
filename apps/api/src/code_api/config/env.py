"""The environment, read and validated once (M0 part 2 spec, P2.3).

This is the only module that reads environment variables. Every name starts with `CODE_`, so a
developer's shell cannot leak another project's `DATABASE_URL` into Code.
"""

from typing import Annotated, Any
from urllib.parse import unquote, urlsplit

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Env(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="CODE_",
        # Relative to the working directory: commands run from the repository root.
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        # A rejected value is never echoed: it may be the secret key or a database password.
        hide_input_in_errors=True,
    )

    secret_key: SecretStr = Field(min_length=50)
    database_url: SecretStr
    debug: bool = False
    allowed_hosts: Annotated[list[str], NoDecode] = []

    @field_validator("database_url")
    @classmethod
    def _postgres_only(cls, value: SecretStr) -> SecretStr:
        scheme = urlsplit(value.get_secret_value()).scheme
        if scheme not in {"postgres", "postgresql"}:
            raise ValueError("must be a postgresql:// URL")
        return value

    @field_validator("allowed_hosts", mode="before")
    @classmethod
    def _split_hosts(cls, value: object) -> object:
        if isinstance(value, str):
            return [host.strip() for host in value.split(",") if host.strip()]
        return value


def database_from_url(url: str) -> dict[str, Any]:
    """Django's `DATABASES["default"]` for a `postgresql://user:pass@host:port/name` URL."""
    parts = urlsplit(url)
    name = unquote(parts.path.lstrip("/"))
    if not name:
        raise ValueError("the database URL names no database")
    return {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": name,
        "USER": unquote(parts.username or ""),
        "PASSWORD": unquote(parts.password or ""),
        "HOST": parts.hostname or "",
        "PORT": str(parts.port or ""),
        # A dead database must fail fast, so /api/health answers 503 instead of hanging.
        "OPTIONS": {"connect_timeout": 3},
    }
