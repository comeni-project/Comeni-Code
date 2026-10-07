"""Settings for accounts, derived from `Env` (M4.3 spec, M4A.3).

Functions, not module constants, so a test can derive them from any `Env` without reloading
settings. `settings.py` calls each once.
"""

from typing import Any

from code_api.config.env import Env
from code_api.config.providers import PROVIDERS


def social_providers(env: Env) -> dict[str, Any]:
    """allauth's provider table: every provider in `PROVIDERS` whose client is set (M4S.2)."""
    table: dict[str, Any] = {}
    for provider in PROVIDERS:
        client_id = getattr(env, provider.client_id)
        secret = getattr(env, provider.secret)
        if client_id is None or secret is None:
            continue
        table[provider.id] = {
            "APPS": [{"client_id": client_id, "secret": secret.get_secret_value()}],
            "SCOPE": list(provider.scope),
        }
    return table


def caches(env: Env) -> dict[str, Any]:
    """Redis, shared by every worker, so allauth's rate limits count once for all of them."""
    return {
        "default": {
            "BACKEND": "django.core.cache.backends.redis.RedisCache",
            "LOCATION": env.redis_url.get_secret_value(),
            "KEY_PREFIX": "code",
        }
    }


def mailers(env: Env) -> dict[str, Any]:
    """Django's MAILERS (6.1, replacing EMAIL_BACKEND): the console in development and tests,
    SMTP with TLS when a host is set."""
    if env.smtp_host is None:
        return {"default": {"BACKEND": "django.core.mail.backends.console.EmailBackend"}}
    password = "" if env.smtp_password is None else env.smtp_password.get_secret_value()
    return {
        "default": {
            "BACKEND": "django.core.mail.backends.smtp.EmailBackend",
            "OPTIONS": {
                "host": env.smtp_host,
                "port": env.smtp_port,
                "username": env.smtp_user,
                "password": password,
                "use_tls": True,
            },
        }
    }
