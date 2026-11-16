"""Route text is optional, exact-keyed and invalidated by its claim snapshot."""

import json
from pathlib import Path
from typing import Any

import pytest

from code_api.ai import gateway
from code_api.ai.gateway import Completion
from code_api.ai.models import Connection, SiteSetting
from code_api.content.index import rebuild_index
from code_api.content.models import Node
from code_api.studio import connecting
from code_api.studio.connecting_api import out

pytestmark = pytest.mark.django_db


@pytest.fixture
def indexed(settings: Any, monkeypatch: pytest.MonkeyPatch) -> None:
    settings.CODE_AI_MODEL = None
    settings.CODE_AI_API_KEY = None
    settings.CODE_AI_BASE_URL = None
    rebuild_index(Path(__file__).resolve().parents[3] / "tests/fixtures/salmon")
    monkeypatch.setattr(connecting, "enqueue", lambda identity: None)


def test_same_route_shares_one_bundle_and_refusal_keeps_route_usable(indexed: None) -> None:
    first = connecting.request(["dna-and-genes"], [])
    assert connecting.request(["dna-and-genes"], []).pk == first.pk
    connecting.generate(str(first.public_id))
    first.refresh_from_db()
    assert first.state == "refused" and first.code == "CA0400"
    assert all(not item.text for item in first.texts.all())


def test_unknown_or_duplicate_text_keys_refuse_the_entire_reply(
    indexed: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    connection = Connection.objects.create(
        name="Local", kind="self-hosted", endpoint="http://local/v1"
    )
    SiteSetting.objects.create(
        site="default", same_as_default=False, connection=connection, model="openai/test"
    )
    monkeypatch.setattr(
        gateway,
        "transport",
        lambda route, messages: Completion(
            json.dumps({"texts": [{"key": "invented", "text": "Wrong target."}]}), 1, 1, None
        ),
    )
    bundle = connecting.request(["dna-and-genes"], [])
    connecting.generate(str(bundle.public_id))
    bundle.refresh_from_db()
    assert bundle.state == "refused" and bundle.code == "CA0602"
    assert all(not item.text for item in bundle.texts.all())


def test_claim_changes_flag_old_text_and_create_a_fresh_bundle(indexed: None) -> None:
    bundle = connecting.request(["dna-and-genes"], [])
    bundle.texts.update(text="Old explanation.", state="approved")
    Node.objects.filter(id="dna-and-genes").update(claim="A changed claim.")
    assert not connecting.current(bundle)
    assert out(bundle).state == "flagged"
    assert all(item.text == "" for item in out(bundle).texts)
    assert connecting.request(["dna-and-genes"], []).pk != bundle.pk


def test_a_successful_worker_runs_once_and_marks_every_text_unreviewed(
    indexed: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    connection = Connection.objects.create(
        name="Local", kind="self-hosted", endpoint="http://local/v1"
    )
    SiteSetting.objects.create(
        site="default", same_as_default=False, connection=connection, model="openai/test"
    )
    calls = []

    def answer(route: Any, messages: Any) -> Completion:
        calls.append(messages)
        contexts = json.loads(messages[-1]["content"])
        return Completion(
            json.dumps(
                {
                    "texts": [
                        {"key": item["key"], "text": "Connect this claim to the goal."}
                        for item in contexts
                    ]
                }
            ),
            1,
            1,
            None,
        )

    monkeypatch.setattr(gateway, "transport", answer)
    bundle = connecting.request(["dna-and-genes"], [])
    connecting.generate(str(bundle.public_id))
    connecting.generate(str(bundle.public_id))
    bundle.refresh_from_db()
    assert bundle.state == "ready" and len(calls) == 1
    assert all(item.state == "ready" for item in bundle.texts.all())
    assert bundle.call is not None and bundle.call.user_id is None
