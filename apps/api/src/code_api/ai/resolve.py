"""A call site to a model, or why there is none (M5.1 spec, M5G.3, M5G.5). `.env`'s model is the
default, locked; a site follows the default unless it names its own; with no connection there is
no model, and the gateway calls nothing."""

from dataclasses import dataclass

from django.conf import settings

from code_api.ai import secrets
from code_api.ai.models import Connection, SiteSetting
from code_api.ai.sites import site

CHATGPT_PREFIX = "chatgpt/"
ENV_NAME = "From .env"


@dataclass(frozen=True)
class Refused:
    code: str  # CA04xx
    sentence: str
    call_id: int | None = None


@dataclass(frozen=True)
class Route:
    connection_name: str
    kind: str  # chatgpt, self-hosted, hosted, or env
    model: str
    api_key: secrets.Hidden | None
    api_base: str | None
    temperature: float | None = None
    reasoning_effort: str = ""
    timeout: int | None = None


NO_MODEL = Refused("CA0400", "No model: add a connection on the AI page.")


def env_route() -> Route | None:
    """`.env`'s connection: CODE_AI_MODEL, with its key and endpoint, locked (M5G.3)."""
    model: str | None = settings.CODE_AI_MODEL
    if model is None:
        return None
    key: str | None = settings.CODE_AI_API_KEY
    return Route(
        ENV_NAME,
        "env",
        model,
        None if key is None else secrets.Hidden(key),
        settings.CODE_AI_BASE_URL,
    )


def route_for(connection: Connection, model: str) -> Route | Refused:
    """A connection and a model as a route, or why it cannot be one."""
    if connection.kind == "chatgpt":
        if not model.startswith(CHATGPT_PREFIX):
            # Any other provider would be sent with no key, and LiteLLM fills one from the host.
            return Refused("CA0401", f"The ChatGPT plan answers only {CHATGPT_PREFIX}… models.")
        return Route(connection.name, "chatgpt", model, None, None)
    if connection.kind == "self-hosted":
        return Route(connection.name, "self-hosted", model, None, connection.endpoint or None)
    if connection.key_sealed is None:
        return Refused("CA0400", f"{connection.name} has no key: enter one on the AI page.")
    key = secrets.open_(bytes(connection.key_sealed))
    if key is None:
        return Refused("CA0402", f"{connection.name}'s key cannot be read: enter it again.")
    return Route(
        connection.name, "hosted", model, None if key is None else secrets.Hidden(key), None
    )


def _tuned(route: Route, setting: SiteSetting | None) -> Route:
    if setting is None:
        return route
    return Route(
        route.connection_name,
        route.kind,
        route.model,
        route.api_key,
        route.api_base,
        setting.temperature,
        setting.reasoning_effort,
        setting.timeout,
    )


def resolve(key: str) -> Route | Refused:
    """The site's route; a KeyError for an undeclared site."""
    site(key)
    setting = SiteSetting.objects.select_related("connection").filter(site=key).first()
    if key == "default":
        locked = env_route()
        if locked is not None:
            return _tuned(locked, setting)
    elif setting is None or setting.same_as_default:
        default = resolve("default")
        return default if isinstance(default, Refused) else _tuned(default, setting)
    if setting is None or (setting.connection is None and not setting.model):
        return NO_MODEL
    if setting.connection is None:
        return Refused("CA0400", f"{site(key).label}'s connection was removed: choose a model.")
    route = route_for(setting.connection, setting.model)
    return route if isinstance(route, Refused) else _tuned(route, setting)


def cap_of(key: str) -> int | None:
    setting = SiteSetting.objects.filter(site=key).first()
    if setting is not None and setting.cap is not None:
        return setting.cap
    return site(key).default_cap


def ai_configured() -> bool:
    """Whether any model can be reached: .env's, or a connection. False when the database cannot
    say: the health page's other checks report that."""
    if env_route() is not None:
        return True
    try:
        return Connection.objects.exists()
    except Exception:  # noqa: BLE001 — the database check says why
        return False
