"""Publication requires current approved prose; edits and graph changes revoke discovery."""

from pathlib import Path
from typing import Any

import pytest
from django.test import Client

from code_api.content.index import rebuild_index
from code_api.content.models import Node
from code_api.studio import connecting, tracks
from code_api.studio.models import NamedTrack, RouteBundle
from code_api.studio.requests import RequestError

pytestmark = pytest.mark.django_db


@pytest.fixture
def bundle(settings: Any) -> RouteBundle:
    settings.CODE_AI_MODEL = None
    settings.CODE_AI_API_KEY = None
    rebuild_index(Path(__file__).resolve().parents[3] / "tests/fixtures/salmon")
    made = connecting.request(["dna-and-genes"], [])
    made.state = "refused"
    made.save(update_fields=["state"])
    return made


def approve_all(bundle: RouteBundle, grace: Any) -> None:
    for item in bundle.texts.all():
        edited = tracks.review(
            bundle.public_id,
            item.key,
            item.version,
            "edit",
            by=grace,
            text="Connect the permitted claims to this learning goal.",
        )
        tracks.review(bundle.public_id, item.key, edited.version, "approve", by=grace)
    bundle.refresh_from_db()


def test_authors_cannot_approve_and_unreviewed_cannot_publish(
    bundle: RouteBundle, ada: Any, grace: Any
) -> None:
    item = bundle.texts.first()
    assert item is not None
    with pytest.raises(RequestError, match="reviewer"):
        tracks.review(bundle.public_id, item.key, 1, "approve", by=ada)
    with pytest.raises(RequestError, match="every text"):
        tracks.publish(bundle.public_id, "DNA", by=grace)


def test_flagged_text_needs_a_note_and_stale_decision_is_refused(
    bundle: RouteBundle, grace: Any
) -> None:
    item = bundle.texts.earliest("pk")
    edited = tracks.review(
        bundle.public_id,
        item.key,
        1,
        "edit",
        by=grace,
        text="This claim needs 987654 steps to reach the goal.",
    )
    assert edited.flags
    with pytest.raises(RequestError, match="note"):
        tracks.review(bundle.public_id, item.key, edited.version, "approve", by=grace)
    approved = tracks.review(
        bundle.public_id,
        item.key,
        edited.version,
        "approve",
        by=grace,
        note="Reviewed the flagged figure.",
    )
    with pytest.raises(RequestError, match="changed"):
        tracks.review(
            bundle.public_id, item.key, edited.version, "approve", by=grace, note="Old tab"
        )
    assert approved.events.count() == 2


def test_publication_shares_target_set_and_edits_remove_discovery(
    bundle: RouteBundle, grace: Any, client: Client
) -> None:
    approve_all(bundle, grace)
    first = tracks.publish(bundle.public_id, "DNA basics", by=grace)
    assert tracks.publish(bundle.public_id, "DNA", by=grace).pk == first.pk
    assert NamedTrack.objects.count() == 1
    assert len(client.get("/api/tracks").json()) == 1
    item = bundle.texts.earliest("pk")
    tracks.review(
        bundle.public_id,
        item.key,
        item.version,
        "edit",
        by=grace,
        text="An updated explanation of the permitted goal claims.",
    )
    assert client.get("/api/tracks").json() == []


def test_changed_claim_removes_track_and_forbids_old_approval(
    bundle: RouteBundle, grace: Any, client: Client
) -> None:
    approve_all(bundle, grace)
    tracks.publish(bundle.public_id, "DNA", by=grace)
    Node.objects.filter(id="dna-and-genes").update(claim="An updated DNA claim.")
    assert client.get("/api/tracks").json() == []
    item = bundle.texts.earliest("pk")
    with pytest.raises(RequestError, match="route changed"):
        tracks.review(bundle.public_id, item.key, item.version, "approve", by=grace)


def test_refused_rewrite_preserves_text_and_recovers_state(bundle: RouteBundle, grace: Any) -> None:
    item = bundle.texts.earliest("pk")
    edited = tracks.review(
        bundle.public_id,
        item.key,
        1,
        "edit",
        by=grace,
        text="Connect the permitted claims to this goal.",
    )
    with pytest.raises(RequestError, match="unavailable"):
        tracks.rewrite(bundle.public_id, item.key, edited.version, by=grace, note="Make it clearer")
    item.refresh_from_db()
    assert item.state == "ready" and item.text == edited.text
