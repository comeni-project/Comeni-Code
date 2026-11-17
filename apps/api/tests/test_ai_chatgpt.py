"""The ChatGPT plan's token and sign-in (M5.1 spec, M5G.4): the gateway owns the token so LiteLLM
never signs in inside a call; the page drives the sign-in one poll at a time; the token is written
atomically under a lock. HTTP is faked; Redis is Compose's."""

import json
import os
import threading
import time
from pathlib import Path
from typing import Any, cast

import pytest
from django import db
from redis.exceptions import ConnectionError as RedisConnectionError

from code_api.ai import chatgpt, gateway
from code_api.ai.models import AICall, Connection, SiteSetting
from code_api.ai.resolve import Refused
from code_api.redis import client as redis_client

pytestmark = pytest.mark.django_db
ASK = [{"role": "user", "content": "say ok"}]


@pytest.fixture(autouse=True)
def _folder(settings: Any, tmp_path: Path) -> Path:
    settings.CODE_AI_MODEL = None
    settings.CODE_AI_CHATGPT_DIR = tmp_path
    redis_client().delete(chatgpt.ATTEMPT, chatgpt.LOCK, chatgpt.POLL_LOCK)
    return tmp_path


def write_token(folder: Path, *, expires_in: float, access: str = "tok-1") -> None:
    (folder / "auth.json").write_text(
        json.dumps(
            {
                "access_token": access,
                "refresh_token": "ref-1",
                "id_token": "id-1",
                "expires_at": time.time() + expires_in,
                "account_id": "acct",
            }
        )
    )


class FakeResponse:
    def __init__(self, status: int, body: dict[str, Any]) -> None:
        self.status_code = status
        self._body = body

    def json(self) -> dict[str, Any]:
        return self._body


def test_no_token_refuses_without_calling_litellm(monkeypatch: pytest.MonkeyPatch) -> None:
    plan = Connection.objects.create(name="ChatGPT plan", kind="chatgpt")
    SiteSetting.objects.create(
        site="default", same_as_default=False, connection=plan, model="chatgpt/gpt-6.1-sol"
    )

    def never(*args: Any, **kwargs: Any) -> Any:
        raise AssertionError("LiteLLM was called")

    monkeypatch.setattr(gateway, "transport", never)
    out = gateway.call("page-drafting", ASK, by=None, prompt_id="p@1")
    assert isinstance(out, Refused) and out.code == "CA0403"
    assert AICall.objects.get().outcome == "refused"


def test_a_fresh_token_is_used_as_it_is(_folder: Path) -> None:
    write_token(_folder, expires_in=3600)
    assert chatgpt.fresh_token() == "tok-1"


def test_two_processes_refresh_once(_folder: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """Review Focus 1: under the lock, the second reads the token the first wrote."""
    write_token(_folder, expires_in=-10)
    asked: list[str] = []

    def post(url: str, body: dict[str, Any]) -> FakeResponse:
        asked.append(url)
        time.sleep(0.3)
        return FakeResponse(200, {"access_token": "tok-2", "id_token": "id-2"})

    monkeypatch.setattr(chatgpt, "_post", post)
    got: list[object] = []
    threads = [threading.Thread(target=lambda: got.append(chatgpt.fresh_token())) for _ in range(2)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()
    assert got == ["tok-2", "tok-2"]
    assert len(asked) == 1
    kept = json.loads((_folder / "auth.json").read_text())
    assert kept["access_token"] == "tok-2" and kept["refresh_token"] == "ref-1"


def test_a_failed_refresh_marks_the_sign_in_run_out(
    _folder: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    Connection.objects.create(name="ChatGPT plan", kind="chatgpt")
    write_token(_folder, expires_in=-10)
    monkeypatch.setattr(chatgpt, "_post", lambda url, body: FakeResponse(401, {}))
    out = chatgpt.fresh_token()
    assert isinstance(out, Refused) and out.code == "CA0403"
    assert Connection.objects.get().ran_out is True


def test_the_sign_in_starts_waits_and_signs_in(
    _folder: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    class Auth:
        def _request_device_code(self) -> dict[str, str]:
            return {"device_auth_id": "dev-1", "user_code": "K7QF-9MZD", "interval": "5"}

        def _exchange_code_for_tokens(self, code: dict[str, str]) -> dict[str, str]:
            assert code["authorization_code"] == "auth-1"
            return {"access_token": "tok-9", "refresh_token": "ref-9", "id_token": "id-9"}

        def _build_auth_record(self, tokens: dict[str, str]) -> dict[str, object]:
            return {**tokens, "expires_at": time.time() + 3600, "account_id": "acct"}

    monkeypatch.setattr(chatgpt, "_authenticator", Auth)
    started = chatgpt.start()
    assert not isinstance(started, Refused)
    assert started.user_code == "K7QF-9MZD"
    assert started.link == "https://auth.openai.com/codex/device"
    answers = iter(
        [
            FakeResponse(403, {}),
            FakeResponse(
                200, {"authorization_code": "auth-1", "code_challenge": "c", "code_verifier": "v"}
            ),
        ]
    )
    monkeypatch.setattr(chatgpt, "_post", lambda url, body: next(answers))
    assert chatgpt.poll() == "waiting"
    assert chatgpt.poll() == "signed-in"
    assert json.loads((_folder / "auth.json").read_text())["access_token"] == "tok-9"
    plan = Connection.objects.get(kind="chatgpt")
    assert (plan.name, plan.ran_out) == ("ChatGPT plan", False)
    assert plan.models_listed == ["chatgpt/gpt-6.1-sol"]  # #457: there to choose at once


def test_an_attempt_left_behind_ends_and_a_new_one_starts(monkeypatch: pytest.MonkeyPatch) -> None:
    """Review Focus 5."""
    out = chatgpt.poll()
    assert isinstance(out, Refused) and out.code == "CA0403"

    class Auth:
        n = 0

        def _request_device_code(self) -> dict[str, str]:
            Auth.n += 1
            return {
                "device_auth_id": f"dev-{Auth.n}",
                "user_code": f"CODE-{Auth.n}",
                "interval": "5",
            }

    monkeypatch.setattr(chatgpt, "_authenticator", Auth)
    first = chatgpt.start()
    second = chatgpt.start()
    assert not isinstance(first, Refused) and not isinstance(second, Refused)
    assert second.user_code == "CODE-2"
    kept = cast(bytes | None, redis_client().get(chatgpt.ATTEMPT))
    assert json.loads(kept or b"{}")["user_code"] == "CODE-2"
    assert 0 < cast(int, redis_client().ttl(chatgpt.ATTEMPT)) <= 15 * 60


def test_no_folder_greys_the_plan(settings: Any) -> None:
    settings.CODE_AI_CHATGPT_DIR = None
    out = chatgpt.start()
    assert isinstance(out, Refused) and "CODE_AI_CHATGPT_DIR" in out.sentence


def test_a_lock_or_redis_failure_is_refused_not_raised(
    _folder: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """#454: call never raises; a token it cannot get is the plan's refusal."""
    import redis

    plan = Connection.objects.create(name="ChatGPT plan", kind="chatgpt")
    SiteSetting.objects.create(
        site="default", same_as_default=False, connection=plan, model="chatgpt/gpt-6.1-sol"
    )
    write_token(_folder, expires_in=-10)
    errors: list[Exception] = [
        redis.exceptions.LockError(),  # type: ignore[no-untyped-call]
        redis.exceptions.ConnectionError("down"),
    ]
    for error in errors:

        class Failing:
            def lock(self, *args: Any, error: Exception = error, **kwargs: Any) -> Any:
                raise error

        monkeypatch.setattr(chatgpt, "redis_client", Failing)
        out = gateway.call("page-drafting", ASK, by=None, prompt_id="p@1")
        assert isinstance(out, Refused) and out.code == "CA0403"
    assert AICall.objects.filter(outcome="refused").count() == 2


APPROVED = {"authorization_code": "auth-1", "code_challenge": "c", "code_verifier": "v"}


def _waiting_attempt(monkeypatch: pytest.MonkeyPatch, auth: type) -> None:
    monkeypatch.setattr(chatgpt, "_authenticator", auth)
    assert not isinstance(chatgpt.start(), Refused)


class Asks:
    def _request_device_code(self) -> dict[str, str]:
        return {"device_auth_id": "dev-1", "user_code": "K7QF-9MZD", "interval": "5"}


def test_a_failed_exchange_or_a_reply_not_json_is_refused(monkeypatch: pytest.MonkeyPatch) -> None:
    """#455: the poll answers in Code's words, never a 500."""

    class Refuses(Asks):
        def _exchange_code_for_tokens(self, code: dict[str, str]) -> dict[str, str]:
            raise RuntimeError("Failed to exchange authorization code")

    _waiting_attempt(monkeypatch, Refuses)
    monkeypatch.setattr(chatgpt, "_post", lambda url, body: FakeResponse(200, APPROVED))
    out = chatgpt.poll()
    assert isinstance(out, Refused) and out.code == "CA0405"
    assert redis_client().get(chatgpt.ATTEMPT) is None  # the code is spent: start again

    class NotJson(FakeResponse):
        def json(self) -> dict[str, Any]:
            raise ValueError("Expecting value")

    _waiting_attempt(monkeypatch, Refuses)
    monkeypatch.setattr(chatgpt, "_post", lambda url, body: NotJson(200, {}))
    out = chatgpt.poll()
    assert isinstance(out, Refused) and out.code == "CA0405"


@pytest.mark.django_db(transaction=True)  # the threads write the connection
def test_a_poll_while_another_is_asking_waits(monkeypatch: pytest.MonkeyPatch) -> None:
    """#455: two polls at once exchange the code once; the other one says waiting."""
    exchanged: list[str] = []

    class Approves(Asks):
        def _exchange_code_for_tokens(self, code: dict[str, str]) -> dict[str, str]:
            exchanged.append(code["authorization_code"])
            return {"access_token": "tok-9", "refresh_token": "ref-9", "id_token": "id-9"}

        def _build_auth_record(self, tokens: dict[str, str]) -> dict[str, object]:
            return {**tokens, "expires_at": time.time() + 3600}

    _waiting_attempt(monkeypatch, Approves)

    def slow(url: str, body: dict[str, Any]) -> FakeResponse:
        time.sleep(0.3)
        return FakeResponse(200, APPROVED)

    monkeypatch.setattr(chatgpt, "_post", slow)
    got: list[object] = []

    def one_poll() -> None:
        try:
            got.append(chatgpt.poll())
        finally:
            db.connection.close()  # a thread's own connection, or the test database stays open

    threads = [threading.Thread(target=one_poll) for _ in range(2)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()
    assert sorted(map(str, got)) == ["signed-in", "waiting"]
    assert exchanged == ["auth-1"]


def test_start_refuses_when_redis_cannot_keep_the_attempt(monkeypatch: pytest.MonkeyPatch) -> None:
    """#464: a requested code without stored state must not be presented as usable."""
    monkeypatch.setattr(chatgpt, "_authenticator", Asks)

    class Down:
        def set(self, *args: Any, **kwargs: Any) -> None:
            raise RedisConnectionError("down")

    monkeypatch.setattr(chatgpt, "redis_client", Down)
    out = chatgpt.start()
    assert isinstance(out, Refused) and out.code == "CA0405"


@pytest.mark.parametrize("at", ["get", "delete", "lock", "write"])
def test_poll_refuses_when_sign_in_cannot_be_kept(monkeypatch: pytest.MonkeyPatch, at: str) -> None:
    """#464: Redis loss and an unwritable token folder are refusals, never server errors."""

    class Approves(Asks):
        def _exchange_code_for_tokens(self, code: dict[str, str]) -> dict[str, str]:
            return {"access_token": "tok-9"}

        def _build_auth_record(self, tokens: dict[str, str]) -> dict[str, object]:
            return {**tokens, "expires_at": time.time() + 3600}

    _waiting_attempt(monkeypatch, Approves)
    monkeypatch.setattr(chatgpt, "_post", lambda url, body: FakeResponse(200, APPROVED))
    client = redis_client()

    def down(*args: Any, **kwargs: Any) -> Any:
        raise RedisConnectionError("down")

    if at in ("get", "delete"):
        monkeypatch.setattr(client, at, down)
    elif at == "lock":
        lock = client.lock

        def token_lock(name: str, **kwargs: Any) -> Any:
            return down() if name == chatgpt.LOCK else lock(name, **kwargs)

        monkeypatch.setattr(client, "lock", token_lock)
    else:

        def unwritable(*args: Any, **kwargs: Any) -> None:
            raise PermissionError("read-only folder")

        monkeypatch.setattr(chatgpt, "write_atomically", unwritable)
    out = chatgpt.poll()
    assert isinstance(out, Refused) and out.code == "CA0405"
    assert not Connection.objects.filter(kind="chatgpt").exists()


def test_refresh_refuses_when_the_token_cannot_be_written(
    _folder: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """#464: gateway callers need no file-system exception handling."""
    write_token(_folder, expires_in=-10)
    monkeypatch.setattr(
        chatgpt,
        "_post",
        lambda url, body: FakeResponse(
            200,
            {
                "access_token": "tok-2",
                "id_token": "id-2",
            },
        ),
    )

    def unwritable(*args: Any, **kwargs: Any) -> None:
        raise PermissionError("read-only folder")

    monkeypatch.setattr(chatgpt, "write_atomically", unwritable)
    out = chatgpt.fresh_token()
    assert isinstance(out, Refused) and out.code == "CA0403"


def test_a_failed_atomic_replace_leaves_no_temporary_token(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """#464: a failed replacement leaves the previous complete token and no secret temp file."""
    target = tmp_path / "auth.json"
    target.write_text('{"access_token": "old"}')

    def unwritable(*args: Any, **kwargs: Any) -> None:
        raise PermissionError("read-only folder")

    monkeypatch.setattr(os, "replace", unwritable)
    with pytest.raises(PermissionError):
        chatgpt.write_atomically(target, {"access_token": "new"})
    assert json.loads(target.read_text()) == {"access_token": "old"}
    assert list(tmp_path.iterdir()) == [target]
