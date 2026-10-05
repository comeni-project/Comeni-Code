"""Settings for accounts, derived from `Env` (M4.3 spec, M4A.3).

Functions, not module constants, so a test can derive them from any `Env` without reloading
settings. `settings.py` calls each once.
"""

from typing import Any

from code_api.config.env import Env


def github_providers(env: Env) -> dict[str, Any]:
    """allauth's provider table: GitHub when its OAuth client is set, else nothing."""
    if env.github_client_id is None or env.github_client_secret is None:
        return {}
    return {
        "github": {
            "APPS": [
                {
                    "client_id": env.github_client_id,
                    "secret": env.github_client_secret.get_secret_value(),
                }
            ],
            # The profile and the verified addresses; the account takes the invite's email (M4A.2).
            "SCOPE": ["read:user", "user:email"],
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
