"""Anonymous receipts reveal disposition; staff triage is atomic and gated."""

import json
import uuid
from typing import Any

import pytest
from django.test import Client

from code_api.studio import requests
from code_api.studio.models import ContentRequest, RequestDecision

pytestmark = pytest.mark.django_db


def post(client: Client, url: str, body: Any) -> Any:
    return client.post(url, data=json.dumps(body), content_type="application/json")


def test_intake_replay_groups_demand_and_keeps_receipts_private(client: Client) -> None:
    body = {"request_id": str(uuid.uuid4()), "title": "DNA", "description": "Explain pairing."}
    first = post(client, "/api/requests", body)
    assert first.status_code == 200
    assert post(client, "/api/requests", body).json() == first.json()
    second = post(
        client, "/api/requests", {**body, "request_id": str(uuid.uuid4()), "title": "dna"}
    )
    assert ContentRequest.objects.count() == 1
    assert ContentRequest.objects.get().submissions.count() == 2
    assert second.json()["receipt"] != first.json()["receipt"]
    assert set(first.json()) == {"receipt", "title", "state", "reason", "node_id"}
    item = ContentRequest.objects.get()
    missing = client.get(f"/api/requests/{item.public_id}")
    assert missing.status_code == 404 and missing.json()["code"] == "CA0600"


def test_anonymous_cannot_read_staff_queue_or_decide(client: Client) -> None:
    assert client.get("/api/studio/requests").status_code == 401
    assert post(client, "/api/studio/requests/decisions", {"decisions": []}).status_code == 401


def test_bulk_stale_decision_rolls_back_the_whole_batch(client: Client, ada: Any) -> None:
    first = requests.create("DNA", "Pairing.")
    second = requests.create("RNA", "Transcription.")
    client.force_login(ada)
    response = post(
        client,
        "/api/studio/requests/decisions",
        {
            "decisions": [
                {"identity": str(first.public_id), "version": 1, "action": "accept"},
                {"identity": str(second.public_id), "version": 2, "action": "accept"},
            ]
        },
    )
    assert response.status_code == 409 and response.json()["code"] == "CA0600"
    first.refresh_from_db()
    assert first.state == "requested" and RequestDecision.objects.count() == 0


def test_receipt_shows_decline_reason_but_not_actor(client: Client, ada: Any) -> None:
    made = post(
        client,
        "/api/requests",
        {
            "request_id": str(uuid.uuid4()),
            "title": "DNA",
            "description": "Pairing.",
        },
    ).json()
    item = ContentRequest.objects.get()
    requests.decide(
        item.public_id, "decline", expected_version=1, by=ada, reason="Covered already."
    )
    answer = client.get(f"/api/requests/{made['receipt']}").json()
    assert answer["reason"] == "Covered already." and "actor" not in answer


def test_intake_is_bounded(client: Client) -> None:
    for at in range(21):
        response = post(
            client,
            "/api/requests",
            {
                "request_id": str(uuid.uuid4()),
                "title": f"DNA {at}",
                "description": "Pairing.",
            },
        )
    assert response.status_code == 429 and response.json()["code"] == "CA0601"
