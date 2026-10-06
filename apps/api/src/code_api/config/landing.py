"""The GitHub App Studio lands as (M4.6 spec, M4L.4), read from the environment once."""

from dataclasses import dataclass

from code_api.config.env import Env


@dataclass(frozen=True)
class GitHubApp:
    app_id: str
    installation_id: str
    private_key: str
    repository: str
    api_url: str


def github_app(env: Env) -> GitHubApp | None:
    """None while landing is off. A key pasted on one line keeps `\\n` for its line breaks."""
    if env.github_app_id is None or env.github_app_installation_id is None:
        return None
    assert env.github_app_private_key is not None  # `_app_whole` holds all three together
    return GitHubApp(
        app_id=env.github_app_id,
        installation_id=env.github_app_installation_id,
        private_key=env.github_app_private_key.get_secret_value().replace("\\n", "\n"),
        repository=env.content_repository,
        api_url=env.github_api_url,
    )
