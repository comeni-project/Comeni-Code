"""Sign-in providers, as data (M4.8a spec, M4S.2).

Adding one is an entry here and its two `Env` fields; `social_providers` and `Env`'s pair check
read this table, and the web draws a button for whatever allauth's config then lists.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class Provider:
    id: str  # allauth's provider id
    client_id: str  # the Env field holding the OAuth client id
    secret: str  # the Env field holding its secret
    scope: tuple[str, ...]


PROVIDERS = (
    # The profile and the verified addresses; the account takes the invite's email (M4A.2).
    Provider("github", "github_client_id", "github_client_secret", ("read:user", "user:email")),
)
