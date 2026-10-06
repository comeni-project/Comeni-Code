"""The environment, read and validated once (M0 part 2 spec, P2.3).

This is the only module that reads environment variables. Every name starts with `CODE_`, so a
developer's shell cannot leak another project's `DATABASE_URL` into Code.
"""

import re
from pathlib import Path
from typing import Annotated, Any, Self
from urllib.parse import unquote, urlsplit

from pydantic import Field, SecretStr, field_validator, model_validator
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
    redis_url: SecretStr
    debug: bool = False
    allowed_hosts: Annotated[list[str], NoDecode] = []
    # Where collectstatic writes; relative paths are from the working directory (the repo root).
    static_root: Path = Path("staticfiles")
    # The content folder `manage.py rebuild_index` reads (M1 part 6 spec, M1P6.2). Optional: only
    # the command needs a content checkout, so the API, worker and beat start without one.
    content_root: Path | None = None
    # Accounts (M4.3 spec, M4A.3). Where invite links and allauth's redirects point: the web app.
    web_origin: str = "http://127.0.0.1:5173"
    # Secure cookies need HTTPS, so they are on for a hosted stack and off for local development.
    secure_cookies: bool = False
    # GitHub sign-in is off unless both halves of an OAuth client are set.
    github_client_id: str | None = None
    github_client_secret: SecretStr | None = None
    # Mail goes to the console unless an SMTP host is set.
    smtp_host: str | None = None
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: SecretStr | None = None
    email_from: str = "Comeni Code <noreply@localhost>"
    # Landing (M4.6 spec, M4L.4): the GitHub App Studio lands as. Off unless all three are set.
    github_app_id: str | None = None
    github_app_installation_id: str | None = None
    github_app_private_key: SecretStr | None = None
    content_repository: str = "comeni-project/comeni-code-content"
    github_api_url: str = "https://api.github.com"

    @field_validator("database_url")
    @classmethod
    def _postgres_only(cls, value: SecretStr) -> SecretStr:
        scheme = urlsplit(value.get_secret_value()).scheme
        if scheme not in {"postgres", "postgresql"}:
            raise ValueError("must be a postgresql:// URL")
        return value

    @field_validator("redis_url")
    @classmethod
    def _redis_only(cls, value: SecretStr) -> SecretStr:
        if urlsplit(value.get_secret_value()).scheme not in {"redis", "rediss"}:
            raise ValueError("must be a redis:// URL")
        return value

    @field_validator("web_origin")
    @classmethod
    def _no_trailing_slash(cls, value: str) -> str:
        return value.rstrip("/")

    @model_validator(mode="after")
    def _github_in_pairs(self) -> Self:
        if (self.github_client_id is None) != (self.github_client_secret is None):
            raise ValueError(
                "set both CODE_GITHUB_CLIENT_ID and CODE_GITHUB_CLIENT_SECRET, or neither"
            )
        return self

    @field_validator("github_api_url")
    @classmethod
    def _api_without_slash(cls, value: str) -> str:
        return value.rstrip("/")

    @field_validator("content_repository")
    @classmethod
    def _owner_slash_name(cls, value: str) -> str:
        if re.fullmatch(r"[\w.-]+/[\w.-]+", value) is None:
            raise ValueError("must be owner/name")
        return value

    @model_validator(mode="after")
    def _app_whole(self) -> Self:
        parts = (self.github_app_id, self.github_app_installation_id, self.github_app_private_key)
        if any(part is not None for part in parts) and None in parts:
            raise ValueError(
                "set CODE_GITHUB_APP_ID, CODE_GITHUB_APP_INSTALLATION_ID and "
                "CODE_GITHUB_APP_PRIVATE_KEY together, or none"
            )
        return self

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
