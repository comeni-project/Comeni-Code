"""M7 keeps human gates while connecting intake, demand, grouping and draft progress."""

import json
import uuid
from pathlib import Path
from typing import Any

import pytest
from django.test import Client

from code_api.ai import gateway
from code_api.ai.gateway import Completion
from code_api.ai.models import Connection, SiteSetting
from code_api.content.index import rebuild_index
from code_api.content.models import Region
from code_api.studio import implementing, request_grouping, requests
from code_api.studio.models import ContentRequest
from code_api.studio.request_api import out
from code_api.studio.requests import RequestError
from code_schema import Level

pytestmark = pytest.mark.django_db


@pytest.fixture
def indexed(settings: Any) -> None:
    settings.CODE_AI_MODEL = None
    settings.CODE_AI_API_KEY = None
    settings.CODE_AI_BASE_URL = None
    rebuild_index(Path(__file__).resolve().parents[3] / "tests/fixtures/salmon")


def post(client: Client, url: str, body: Any) -> Any:
    return client.post(url, data=json.dumps(body), content_type="application/json")


def test_merge_receipts_follow_surviving_request_and_later_disposition(
    client: Client, ada: Any
) -> None:
    one = post(
        client,
        "/api/requests",
        {
            "request_id": str(uuid.uuid4()),
            "title": "DNA pairing",
            "description": "How do bases pair?",
        },
    ).json()
    two = post(
        client,
        "/api/requests",
        {
            "request_id": str(uuid.uuid4()),
            "title": "Base pairs",
            "description": "Complementary bases.",
        },
    ).json()
    source, target = ContentRequest.objects.order_by("pk")
    requests.decide(
        source.public_id,
        "merge",
        expected_version=1,
        by=ada,
        reason="Same learning need",
        target_request=target.public_id,
    )
    assert target.submissions.count() == 2 and source.submissions.count() == 0
    requests.decide(
        target.public_id, "decline", expected_version=1, by=ada, reason="Covered by a planned page."
    )
    for receipt in [one, two]:
        answer = client.get(f"/api/requests/{receipt['receipt']}").json()
        assert answer["state"] == "declined" and answer["reason"] == "Covered by a planned page."
    with pytest.raises(RequestError, match="live request"):
        other = requests.create("DNA", "Explain DNA.")
        requests.decide(
            other.public_id,
            "merge",
            expected_version=1,
            by=ada,
            reason="Duplicate",
            target_request=source.public_id,
        )


def test_missing_goals_keep_available_stops_and_count_actual_route_attempts(
    indexed: None, client: Client
) -> None:
    route = client.get("/api/routes?goal=dna-and-genes&goal=missing-topic")
    assert route.status_code == 200
    assert route.json()["missing_goals"] == ["missing-topic"]
    assert any(stop["id"] == "dna-and-genes" for stop in route.json()["stops"])
    receipt = post(
        client,
        "/api/requests",
        {
            "request_id": str(uuid.uuid4()),
            "title": "Missing topic",
            "description": "Needed for my route",
            "missing_node_id": "missing-topic",
            "route_goals": ["dna-and-genes", "missing-topic"],
        },
    )
    assert receipt.status_code == 200
    item = ContentRequest.objects.get()
    assert out(item).blocked_routes == [["dna-and-genes", "missing-topic"]]


def test_grouping_ignores_invented_targets_and_never_decides(
    indexed: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    source = requests.create("DNA pairing", "Explain DNA bases.")
    target = requests.create("Base pairs", "Complementary DNA bases.")
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
            json.dumps(
                {
                    "suggestions": [
                        {
                            "kind": "request",
                            "target": str(target.public_id),
                            "reason": "Same learning need.",
                        },
                        {"kind": "node", "target": "invented", "reason": "Invalid target."},
                    ]
                }
            ),
            1,
            1,
            None,
        ),
    )
    request_grouping.generate(str(source.public_id))
    source.refresh_from_db()
    assert source.state == "requested" and not source.decisions.exists()
    assert len(source.suggestions) == 1 and source.suggestions[0]["target"] == str(target.public_id)


def test_region_assignment_is_version_checked(indexed: None, ada: Any) -> None:
    item = requests.create("DNA", "Explain bases.")
    region = Region.objects.earliest("position")
    requests.set_region(item.public_id, 1, region.id, by=ada)
    with pytest.raises(RequestError, match="changed"):
        requests.set_region(item.public_id, 1, "", by=ada)


def test_reviewer_assignment_and_receipt_progress_follow_the_real_draft(
    indexed: None, ada: Any, grace: Any, client: Client
) -> None:
    receipt = post(
        client,
        "/api/requests",
        {"request_id": str(uuid.uuid4()), "title": "DNA pairing", "description": "Explain bases."},
    ).json()
    item = ContentRequest.objects.get()
    requests.decide(item.public_id, "accept", expected_version=1, by=ada)
    with pytest.raises(RequestError, match="Assign an active reviewer"):
        implementing.assign(item.public_id, 2, ada.public_id, by=ada, reviewing=True)
    implementing.assign(item.public_id, 2, grace.public_id, by=ada, reviewing=True)
    made = implementing.start(
        item.public_id,
        3,
        by=ada,
        node_id="new-dna-pairing",
        claim="Pair bases.",
        region=Region.objects.earliest("position").id,
        level=Level.INTRODUCTORY,
        minutes=5,
    )
    assert made.draft is not None
    made.draft.state = "approved"
    made.draft.save(update_fields=["state"])
    assert client.get(f"/api/requests/{receipt['receipt']}").json()["state"] == "approved"
    assert client.get(f"/api/requests/{receipt['receipt']}").json()["state"] != "live"


TPM_ANSWERS: dict[str, object] = {
    "tpm-sums-to": 1000000,
    "tpm-or-count": 0,
    "twice-as-long": 0,
    "tpm-of-a": 750000,
    "tpm-steps": [
        "Count the reads on each transcript",
        "Divide each count by the transcript's effective length",
        "Add up the rates across the sample",
        "Scale each rate so the rates add up to a million",
    ],
    "tpm-unit-name": "Transcripts per million",
}


def test_a_learner_request_reaches_an_approved_draft_through_every_human_gate(
    indexed: None, ada: Any, grace: Any, client: Client
) -> None:
    """M7's local acceptance: intake, triage, assignment, a new node's draft, submission, a
    reviewer's verdicts and approval. Approval is not landing; the receipt never says live."""
    from dataclasses import replace

    from code_api.studio import drafts, review
    from code_api.studio.keys import review_keys
    from code_schema import Resource
    from code_schema.content import read_content
    from code_schema.edits import set_resources

    receipt = post(
        client,
        "/api/requests",
        {"request_id": str(uuid.uuid4()), "title": "TPM again", "description": "A second TPM."},
    ).json()
    item = ContentRequest.objects.get()
    assert item.state == "requested" and item.draft is None

    item = requests.decide(item.public_id, "accept", expected_version=1, by=ada)
    assert item.draft is None  # accepting makes no draft
    item = implementing.assign(item.public_id, item.version, ada.public_id, by=ada)
    item = implementing.assign(
        item.public_id, item.version, grace.public_id, by=ada, reviewing=True
    )
    item = implementing.start(
        item.public_id,
        item.version,
        by=ada,
        node_id="tpm-again",
        claim="TPM makes expression comparable across transcripts.",
        region=Region.objects.earliest("position").id,
        level=Level.FOUNDATIONS,
        minutes=10,
    )
    draft = item.draft
    assert draft is not None and implementing.stage(item) == "writing"

    tpm = read_content(Path(__file__).resolve().parents[3] / "tests/fixtures/salmon").nodes["tpm"]
    reading = Resource(
        kind="reading",
        provider="openstax",
        url="https://openstax.org/books/biology-2e/pages/17-1",
        covers="How fragments are read from transcripts.",
        licence="CC BY 4.0",
        display="link",
        level=Level.FOUNDATIONS,
    )
    drafts.save(
        draft,
        based_on=1,
        edit=lambda n: set_resources(
            replace(n, body=tpm.body, exam=tpm.exam, figures=tpm.figures), [reading]
        ),
        by=ada,
        change="write it",
    )
    assert all(entry.passed for entry in drafts.checklist(draft))

    revision = drafts.latest(draft).number
    review.submit(draft, revision=revision, by=ada)
    item.refresh_from_db()
    assert implementing.stage(item) == "waiting for review"

    with pytest.raises((review.RoleTooLow, review.Contributor)):
        review.approve(draft, revision=revision, reason="", by=ada)  # nobody approves their own
    for question in tpm.exam:
        review.answer(draft, question.id, TPM_ANSWERS[question.id], by=grace)
    node, _ = drafts.node_of(draft)
    assert node is not None
    review.set_verdicts(
        draft,
        revision=revision,
        verdicts=[review.Given(key.key, "approved") for key in review_keys(node)],
        by=grace,
    )
    review.approve(draft, revision=revision, reason="", by=grace)

    item.refresh_from_db()
    assert implementing.stage(item) == "approved"
    state = client.get(f"/api/requests/{receipt['receipt']}").json()["state"]
    assert state == "approved"  # a local approval is never reported as a landing
