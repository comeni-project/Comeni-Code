"""The ChatGPT plan: its token and its sign-in (M5.1 spec, M5G.4).

**The gateway owns the token.** Before any `chatgpt/` call it asks `fresh_token()`: no token is
refused at once, an expired one is refreshed here under a Redis lock and written atomically, and a
failed refresh marks the connection run out. So LiteLLM always finds a fresh token and never starts
its own device-code sign-in inside a call, which would block it for up to 20 minutes.

**The page drives the sign-in.** `start()` asks LiteLLM's `Authenticator` for a device code and
keeps the attempt in Redis for 15 minutes; each `poll()` makes one request, never LiteLLM's
blocking loop, so no worker is held. Approved, the code is exchanged and the token written.

LiteLLM's private methods and constants are pinned with LiteLLM (test_ai_litellm_private.py).
"""

import contextlib
import json
import os
import tempfile
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal, cast

import httpx
from django.conf import settings
from litellm.llms.chatgpt import authenticator as litellm_auth
from litellm.llms.chatgpt import common_utils as litellm_chatgpt
from redis.exceptions import RedisError

from code_api.ai.models import Connection
from code_api.ai.resolve import Refused
from code_api.redis import client as redis_client

ATTEMPT = "ai:chatgpt:attempt"
LOCK = "ai:chatgpt:token"
POLL_LOCK = "ai:chatgpt:poll"
MODEL = "chatgpt/gpt-6.1-sol"  # what the plan answers with, listed on sign-in (#457)
ATTEMPT_SECONDS = 15 * 60
EXPIRY_SKEW_SECONDS = 60
NAME = "ChatGPT plan"

NO_SIGN_IN = Refused("CA0403", "No ChatGPT sign-in: sign in on the AI page.")
RAN_OUT = Refused("CA0403", "The ChatGPT sign-in ran out: sign in again on the AI page.")
CODE_OVER = Refused("CA0403", "The code was not approved within 15 minutes: start again.")
NO_FOLDER = Refused("CA0403", "The ChatGPT plan needs CODE_AI_CHATGPT_DIR in .env.")


@dataclass(frozen=True)
class SignIn:
    user_code: str
    link: str
    expires_at: float


def _authenticator() -> Any:
    """LiteLLM's authenticator; it reads its folder from CHATGPT_TOKEN_DIR (env.py sets it)."""
    return litellm_auth.Authenticator()


def _post(url: str, body: dict[str, Any]) -> httpx.Response:
    return httpx.post(url, json=body, timeout=15)


def _auth_file() -> Path | None:
    folder: Path | None = settings.CODE_AI_CHATGPT_DIR
    return None if folder is None else Path(folder) / "auth.json"


def _read() -> dict[str, Any] | None:
    path = _auth_file()
    if path is None or not path.exists():
        return None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except OSError, ValueError:
        return None
    return data if isinstance(data, dict) else None


def write_atomically(path: Path, data: dict[str, Any]) -> None:
    """A temporary file in the same folder, renamed over the old one: a reader never sees half."""
    path.parent.mkdir(parents=True, exist_ok=True)
    handle, temporary = tempfile.mkstemp(dir=path.parent, prefix=".auth-")
    with os.fdopen(handle, "w", encoding="utf-8") as out:
        json.dump(data, out)
    os.replace(temporary, path)


def _expired(data: dict[str, Any]) -> bool:
    expires_at = data.get("expires_at")
    return isinstance(expires_at, int | float) and time.time() >= expires_at - EXPIRY_SKEW_SECONDS


def _refresh(data: dict[str, Any]) -> dict[str, Any] | None:
    """The refresh request, made here so the token is written atomically; None when refused."""
    refresh_token = data.get("refresh_token")
    if not isinstance(refresh_token, str):
        return None
    try:
        answer = _post(
            litellm_chatgpt.CHATGPT_OAUTH_TOKEN_URL,
            {
                "client_id": litellm_chatgpt.CHATGPT_CLIENT_ID,
                "grant_type": "refresh_token",
                "refresh_token": refresh_token,
                "scope": "openid profile email",
            },
        )
        body = answer.json() if answer.status_code == 200 else {}
    except httpx.HTTPError, ValueError:
        return None
    if not body.get("access_token") or not body.get("id_token"):
        return None
    return {
        **data,
        "access_token": body["access_token"],
        "id_token": body["id_token"],
        "refresh_token": body.get("refresh_token") or refresh_token,
        "expires_at": body.get("expires_at", time.time() + int(body.get("expires_in", 3600))),
    }


def fresh_token() -> str | Refused:
    data = _read()
    if data is None or not isinstance(data.get("access_token"), str):
        return NO_SIGN_IN
    if not _expired(data):
        return str(data["access_token"])
    try:
        return _refreshed_under_lock()
    except RedisError as error:  # the lock not had in time, or Redis down: refused, not raised
        return Refused("CA0403", f"The ChatGPT sign-in could not be refreshed now: {error}"[:300])


def _refreshed_under_lock() -> str | Refused:
    with redis_client().lock(LOCK, timeout=30, blocking_timeout=30):
        data = _read()  # another process may have refreshed while this one waited
        if data is not None and not _expired(data):
            return str(data["access_token"])
        refreshed = None if data is None else _refresh(data)
        path = _auth_file()
        if refreshed is None or path is None:
            Connection.objects.filter(kind="chatgpt").update(ran_out=True)
            return RAN_OUT
        write_atomically(path, refreshed)
    return str(refreshed["access_token"])


def start() -> SignIn | Refused:
    if _auth_file() is None:
        return NO_FOLDER
    try:
        code = _authenticator()._request_device_code()
    except Exception as error:  # noqa: BLE001 — LiteLLM's own error, in its words
        return Refused("CA0405", str(error)[:500])
    expires_at = time.time() + ATTEMPT_SECONDS
    attempt = {**code, "expires_at": expires_at}
    redis_client().set(ATTEMPT, json.dumps(attempt), ex=ATTEMPT_SECONDS)
    return SignIn(code["user_code"], litellm_chatgpt.CHATGPT_DEVICE_VERIFY_URL, expires_at)


def poll() -> Literal["waiting", "signed-in"] | Refused:
    """One ask whether the code was approved. Polls overlap (the page's, or two tabs'), so one
    asks at a time and the others say waiting: a code is exchanged once (#455)."""
    try:
        asking = redis_client().lock(POLL_LOCK, timeout=60, blocking=False)
        if not asking.acquire():
            return "waiting"
    except RedisError as error:
        return Refused("CA0405", f"The sign-in could not be asked about now: {error}"[:300])
    try:
        return _ask()
    finally:
        with contextlib.suppress(RedisError):  # it expires on its own
            asking.release()


def _ask() -> Literal["waiting", "signed-in"] | Refused:
    raw = cast(bytes | None, redis_client().get(ATTEMPT))
    path = _auth_file()
    if raw is None or path is None:
        return CODE_OVER
    attempt = json.loads(raw)
    try:
        answer = _post(
            litellm_chatgpt.CHATGPT_DEVICE_TOKEN_URL,
            {"device_auth_id": attempt["device_auth_id"], "user_code": attempt["user_code"]},
        )
    except httpx.HTTPError as error:
        return Refused("CA0405", str(error)[:500])
    if answer.status_code in (403, 404):
        return "waiting"  # the provider cannot tell "not yet" from "declined"
    redis_client().delete(ATTEMPT)  # approved or refused, the code is spent
    try:
        body = answer.json() if answer.status_code == 200 else {}
        code = {k: body.get(k) for k in ("authorization_code", "code_challenge", "code_verifier")}
        if not all(isinstance(value, str) and value for value in code.values()):
            return Refused("CA0405", f"The sign-in answered {answer.status_code}.")
        auth = _authenticator()
        record = auth._build_auth_record(auth._exchange_code_for_tokens(code))
    except Exception as error:  # noqa: BLE001 — LiteLLM's or the provider's words
        return Refused("CA0405", f"The sign-in failed: {error}"[:500])
    with redis_client().lock(LOCK, timeout=30, blocking_timeout=30):
        write_atomically(path, record)
    Connection.objects.update_or_create(
        kind="chatgpt", defaults={"name": NAME, "ran_out": False, "models_listed": [MODEL]}
    )
    return "signed-in"
