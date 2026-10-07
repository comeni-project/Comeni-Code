"""A landing and its drafts (M4.6 spec, M4L.3). Needs Compose's Postgres."""

from pathlib import Path

import pytest
from django.db import IntegrityError, transaction

from code_api.accounts.models import User
from code_api.content.index import rebuild_index
from code_api.studio import drafts
from code_api.studio.log import AFTER, record, replay
from code_api.studio.models import DraftEvent, Landing, LandingDraft

pytestmark = pytest.mark.django_db

FIXTURES = Path(__file__).resolve().parents[3] / "tests" / "fixtures" / "salmon"


@pytest.fixture(autouse=True)
def _indexed() -> None:
    rebuild_index(FIXTURES)


def test_a_draft_is_in_one_live_landing_at_most(otto: User) -> None:
    draft = drafts.open_existing("tpm", by=otto)
    first = Landing.objects.create(started_by=otto)
    LandingDraft.objects.create(landing=first, draft=draft, revision=1)
    second = Landing.objects.create(started_by=otto)
    with pytest.raises(IntegrityError), transaction.atomic():
        LandingDraft.objects.create(landing=second, draft=draft, revision=1)
    LandingDraft.objects.filter(landing=first).update(live=False)
    LandingDraft.objects.create(landing=second, draft=draft, revision=1)  # freed: allowed


def test_a_landing_event_leaves_the_draft_approved(otto: User) -> None:
    draft = drafts.open_existing("tpm", by=otto)
    landing = Landing.objects.create(started_by=otto)
    record(draft, DraftEvent.Kind.APPROVED, by=otto, revision=1)
    record(draft, DraftEvent.Kind.LANDING, by=otto, revision=1, landing=landing)
    assert AFTER[DraftEvent.Kind.LANDING] == "approved"
    assert replay(draft.events.order_by("id")) == "approved"
    assert draft.events.order_by("id").last().landing == landing  # type: ignore[union-attr]


def test_a_new_landing_is_pending_and_has_a_public_id(otto: User) -> None:
    landing = Landing.objects.create(started_by=otto)
    assert landing.state == "pending"
    assert landing.public_id is not None
    assert Landing.LIVE == ("pending", "open", "failed", "merged")


def test_a_landed_draft_frees_its_node(otto: User) -> None:
    draft = drafts.open_existing("tpm", by=otto)
    record(draft, DraftEvent.Kind.LANDED, by=None, revision=1)
    draft.state = "landed"
    draft.save(update_fields=["state"])
    assert replay(draft.events.order_by("id")) == "landed"
    assert drafts.open_existing("tpm", by=otto).state == "open"  # a new draft of the same node


def test_a_landing_has_a_merge_commit(otto: User) -> None:
    assert Landing.objects.create(started_by=otto).merge_commit == ""
