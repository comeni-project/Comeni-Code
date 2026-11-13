"""The ChatGPT plan's token and sign-in (M5.1 spec, M5G.4): the gateway owns the token so LiteLLM
never signs in inside a call; the page drives the sign-in one poll at a time; the token is written
atomically under a lock. HTTP is faked; Redis is Compose's."""

import json
import threading
import time
from pathlib import Path
from typing import Any, cast

import pytest

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
    redis_client().delete(chatgpt.ATTEMPT, chatgpt.LOCK)
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
