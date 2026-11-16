"""The assistant stores private turns and makes only normal, revision-bound proposals."""

import json
import uuid
from pathlib import Path
from typing import Any

import pytest
from django.test import Client

from code_api.ai import gateway
from code_api.ai.gateway import Completion
from code_api.ai.models import AICall, Connection, SiteSetting
from code_api.content.index import rebuild_index
from code_api.studio import ai_drafting, drafts
from code_api.studio.models import AssistantAction, AssistantSession, AssistantTurn, DraftProposal

pytestmark = pytest.mark.django_db
ROOT = Path(__file__).resolve().parents[3] / "tests/fixtures/salmon"


@pytest.fixture
def draft(client: Client, ada: Any, settings: Any) -> tuple[Any, Any]:
    settings.CODE_AI_MODEL = None
    settings.CODE_AI_API_KEY = None
    settings.CODE_AI_BASE_URL = None
    rebuild_index(ROOT, commit="assistant")
    opened = drafts.open_existing("salmon", by=ada)
    client.force_login(ada)
    return opened, ada


def configured() -> None:
    connection = Connection.objects.create(
        name="Local", kind="self-hosted", endpoint="http://local/v1"
    )
    SiteSetting.objects.create(
        site="default", same_as_default=False, connection=connection, model="openai/test"
    )


def create_session(client: Client, draft: Any) -> Any:
    response = client.post(
        "/api/studio/assistant/sessions",
        data=json.dumps({"draft_id": str(draft.public_id)}),
        content_type="application/json",
    )
    assert response.status_code == 200
    return response.json()


def send(client: Client, session: str, request_id: uuid.UUID | None = None) -> Any:
    return client.post(
        f"/api/studio/assistant/sessions/{session}/turns",
        data=json.dumps(
            {
                "request_id": str(request_id or uuid.uuid4()),
                "text": "Make the explanation clearer.",
            }
        ),
        content_type="application/json",
    )


def test_an_assistant_turn_creates_a_normal_proposal_once(
    client: Client,
    draft: tuple[Any, Any],
    monkeypatch: pytest.MonkeyPatch,
    django_capture_on_commit_callbacks: Any,
) -> None:
    opened, ada = draft
    configured()
    calls: list[list[dict[str, str]]] = []
    queued: list[str] = []

    def answer(route: Any, messages: list[dict[str, str]]) -> Completion:
        calls.append(messages)
        return Completion(
            json.dumps(
                {
                    "answer": "I can clarify that block.",
                    "actions": [
                        {"target": "block/0", "instruction": "Use shorter sentences."},
                        {"target": "block/0", "instruction": "Duplicate target."},
                        {"target": "block/999", "instruction": "Invented target."},
                    ],
                }
            ),
            8,
            3,
            None,
        )

    monkeypatch.setattr(gateway, "transport", answer)
    monkeypatch.setattr(ai_drafting, "enqueue", lambda identity: queued.append(identity))
    session = create_session(client, opened)
    request_id = uuid.uuid4()
    with django_capture_on_commit_callbacks(execute=True):
        first = send(client, session["public_id"], request_id)
        second = send(client, session["public_id"], request_id)

    assert first.status_code == second.status_code == 200
    body = first.json()
    assert body["turns"][0]["state"] == "ready"
    assert body["turns"][0]["answer"] == "I can clarify that block."
    action = body["turns"][0]["actions"][0]
    assert action["target"] == "block/0"
    assert action["proposal_state"] == "queued"
    assert AssistantAction.objects.count() == DraftProposal.objects.count() == 1
    assert len(calls) == len(queued) == 1
    record = AICall.objects.get(site="assistant")
    assert record.user_id == ada.pk and record.draft == opened.public_id
    assert record.prompt_id == "author-assistant@1"
    assert "user_text" not in {field.name for field in AICall._meta.fields}


def test_provider_refusal_keeps_the_chat_available_without_an_action(
    client: Client,
    draft: tuple[Any, Any],
) -> None:
    opened, _ = draft
    session = create_session(client, opened)
    response = send(client, session["public_id"])
    assert response.status_code == 200
    turn = response.json()["turns"][0]
    assert turn["state"] == "refused" and turn["code"] == "CA0400"
    assert "No proposals were created" in turn["answer"]
    assert AssistantAction.objects.count() == DraftProposal.objects.count() == 0


def test_malformed_replies_create_no_proposal(
    client: Client,
    draft: tuple[Any, Any],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    opened, _ = draft
    configured()
    monkeypatch.setattr(
        gateway,
        "transport",
        lambda route, messages: Completion("not JSON", 1, 1, None),
    )
    session = create_session(client, opened)
    turn = send(client, session["public_id"]).json()["turns"][0]
    assert turn["state"] == "refused" and turn["code"] == "CA0406"
    assert AssistantAction.objects.count() == DraftProposal.objects.count() == 0


def test_sessions_are_private_to_their_creator(
    client: Client,
    draft: tuple[Any, Any],
    grace: Any,
) -> None:
    opened, _ = draft
    session = create_session(client, opened)
    client.force_login(grace)
    response = client.get(f"/api/studio/assistant/sessions/{session['public_id']}")
    assert response.status_code == 404
    assert AssistantSession.objects.count() == 1


def test_closed_drafts_cannot_receive_new_turns(
    client: Client,
    draft: tuple[Any, Any],
) -> None:
    opened, _ = draft
    session = create_session(client, opened)
    opened.state = "submitted"
    opened.save(update_fields=["state"])
    response = send(client, session["public_id"])
    assert response.status_code == 409
    assert response.json()["code"] == "CA0211"
    assert AssistantTurn.objects.count() == 0


def test_only_one_turn_can_run_per_session(
    client: Client,
    draft: tuple[Any, Any],
) -> None:
    opened, _ = draft
    session = create_session(client, opened)
    AssistantTurn.objects.create(
        session=AssistantSession.objects.get(public_id=session["public_id"]),
        number=1,
        request_id=uuid.uuid4(),
        user_text="The first request is still running.",
        state="running",
    )
    response = send(client, session["public_id"])
    assert response.status_code == 409
    assert response.json()["code"] == "CA0410"
    assert AICall.objects.count() == 0
