"""Allowed outlines propose scored stubs; human mapping still enters requested state."""

import json
from pathlib import Path
from typing import Any

import pytest
from django.test import Client

from code_api.ai import gateway
from code_api.ai.gateway import Completion
from code_api.ai.models import Connection, SiteSetting
from code_api.content.index import rebuild_index
from code_api.studio import skeletons
from code_api.studio.models import ContentRequest, SkeletonImport
from code_api.studio.requests import RequestError

pytestmark = pytest.mark.django_db


@pytest.fixture
def imported(ada: Any, settings: Any) -> SkeletonImport:
    settings.CODE_AI_MODEL = None
    settings.CODE_AI_API_KEY = None
    settings.CODE_AI_BASE_URL = None
    rebuild_index(Path(__file__).resolve().parents[3] / "tests/fixtures/salmon")
    return skeletons.create(
        by=ada,
        kind="openstax",
        url="https://openstax.org/books/biology-2e",
        version="2e",
        licence="CC BY",
        outline="DNA: complementary base pairing",
        rights=True,
    )


def proposed(made: SkeletonImport) -> dict[str, Any]:
    return {
        "stubs": [
            {
                "id": "pairing",
                "title": "DNA pairing",
                "claim": "Pair complementary DNA bases.",
                "region": made.candidates["regions"][0],
                "level": "introductory",
                "needs": [],
            }
        ]
    }


def test_forbidden_source_never_creates_an_import(ada: Any) -> None:
    with pytest.raises(RequestError, match="allowed"):
        skeletons.create(
            by=ada,
            kind="openstax",
            url="https://www.khanacademy.org/science",
            version="1",
            licence="unknown",
            outline="DNA",
            rights=True,
        )
    assert SkeletonImport.objects.count() == 0


def test_missing_model_keeps_import_without_requests(imported: SkeletonImport) -> None:
    skeletons.generate(str(imported.public_id))
    imported.refresh_from_db()
    assert imported.state == "refused" and imported.code == "CA0400"
    assert not ContentRequest.objects.exists()


def test_unknown_targets_and_cycles_are_refused(imported: SkeletonImport) -> None:
    value = proposed(imported)
    value["stubs"][0]["needs"] = [{"target": "node/invented", "reason": "Required understanding"}]
    with pytest.raises(RequestError, match="unknown"):
        skeletons.validate(skeletons.SkeletonReply.model_validate(value), imported.candidates)
    value["stubs"][0]["needs"] = [{"target": "stub/second", "reason": "Required understanding"}]
    value["stubs"].append(
        {
            **value["stubs"][0],
            "id": "second",
            "needs": [{"target": "stub/pairing", "reason": "Required understanding"}],
        }
    )
    with pytest.raises(RequestError, match="cycle"):
        skeletons.validate(skeletons.SkeletonReply.model_validate(value), imported.candidates)


def test_low_scores_redraft_once_and_judge_in_fresh_conversations(
    imported: SkeletonImport, monkeypatch: pytest.MonkeyPatch
) -> None:
    connection = Connection.objects.create(
        name="Local", kind="self-hosted", endpoint="http://local/v1"
    )
    SiteSetting.objects.create(
        site="default", same_as_default=False, connection=connection, model="openai/test"
    )
    calls: list[Any] = []

    def answer(route: Any, messages: Any) -> Completion:
        calls.append(messages)
        data = json.loads(messages[-1]["content"])
        if "expected_keys" in data:
            result = {
                "scores": [
                    {
                        "key": key,
                        "score": 2,
                        "reason": "Needs a narrower claim.",
                        "parts": {
                            part: {"score": 2, "reason": "Needs work."}
                            for part in ["accuracy", "scope", "level"]
                        },
                    }
                    for key in data["expected_keys"]
                ]
            }
        else:
            result = proposed(imported)
        return Completion(json.dumps(result), 1, 1, None)

    monkeypatch.setattr(gateway, "transport", answer)
    skeletons.generate(str(imported.public_id))
    skeletons.generate(str(imported.public_id))
    imported.refresh_from_db()
    assert imported.state == "ready" and len(calls) == 4
    assert imported.scores[0]["score"] == 2 and imported.scores[0]["rubric"] == "skeleton@1"
    assert all(len(messages) == 2 for messages in calls)
    assert not ContentRequest.objects.exists()


def test_human_send_is_idempotent_and_never_accepts(imported: SkeletonImport, ada: Any) -> None:
    imported.result = proposed(imported)
    imported.state = "ready"
    imported.save(update_fields=["result", "state"])
    mapping = {"pairing": skeletons.StubMapping(action="new")}
    skeletons.send(imported.public_id, 1, mapping, by=ada, note="Reviewed claim and needs.")
    skeletons.send(imported.public_id, 2, mapping, by=ada, note="Same selection.")
    assert ContentRequest.objects.count() == 1
    request = ContentRequest.objects.get()
    assert request.state == "requested" and request.proposal["source"]["licence"] == "CC BY"


def test_diagnostics_and_author_gate(client: Client, ada: Any) -> None:
    assert client.get("/api/studio/skeletons").status_code == 401
    client.force_login(ada)
    response = client.get("/api/studio/skeletons/00000000-0000-0000-0000-000000000000")
    assert response.status_code == 404 and response.json()["code"] == "CA0603"


def test_sending_requires_prerequisite_selection_and_current_mapping(
    imported: SkeletonImport, ada: Any
) -> None:
    value = proposed(imported)
    value["stubs"][0]["needs"] = [
        {"target": "stub/bases", "reason": "Recognise bases before pairing them."}
    ]
    value["stubs"].append({**value["stubs"][0], "id": "bases", "needs": []})
    imported.result, imported.state = value, "ready"
    imported.save(update_fields=["result", "state"])
    with pytest.raises(RequestError, match="prerequisite"):
        skeletons.send(
            imported.public_id,
            1,
            {"pairing": skeletons.StubMapping(action="new")},
            by=ada,
            note="Reviewed.",
        )
    assert ContentRequest.objects.count() == 0
    made = skeletons.send(
        imported.public_id,
        1,
        {key: skeletons.StubMapping(action="new") for key in ["pairing", "bases"]},
        by=ada,
        note="Reviewed both claims and the prerequisite.",
    )
    assert len(made.sent) == 2 and ContentRequest.objects.filter(state="requested").count() == 2
    with pytest.raises(RequestError, match="changed"):
        skeletons.send(
            imported.public_id,
            1,
            {"pairing": skeletons.StubMapping(action="new")},
            by=ada,
            note="Old page.",
        )
