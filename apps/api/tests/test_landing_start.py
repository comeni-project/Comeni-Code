"""Asking for a landing (M4.6 spec, M4L.3): checked in place, against the index, before any
GitHub call. Needs Compose's Postgres."""

import uuid
from collections.abc import Callable
from pathlib import Path
from typing import Any

import pytest

from code_api.accounts.models import User
from code_api.content.index import rebuild_index
from code_api.studio import drafts, landing, review
from code_api.studio.log import record
from code_api.studio.models import Draft, DraftEvent, Landing
from code_schema import Link
from code_schema.edits import set_links

pytestmark = pytest.mark.django_db

FIXTURES = Path(__file__).resolve().parents[3] / "tests" / "fixtures" / "salmon"
APP_ON = object()  # any non-None value: start() only asks whether landing is configured


@pytest.fixture(autouse=True)
def _indexed(settings: Any) -> None:
    rebuild_index(FIXTURES, commit="base-1")
    settings.CODE_GITHUB_APP = APP_ON


def approved(node_id: str, by: User, edit: Callable[..., Any] | None = None) -> Draft:
    """A draft of an indexed node, approved without the review's steps (M4.5 tests those)."""
    draft = drafts.open_existing(node_id, by=by)
    if edit is not None:
        drafts.save(draft, based_on=1, edit=edit, by=by, change="edit")
    draft.state = Draft.State.APPROVED
    draft.save(update_fields=["state"])
    record(draft, DraftEvent.Kind.APPROVED, by=by, revision=drafts.latest(draft).number)
    return draft


def test_a_batch_is_pending_with_its_drafts_at_their_revisions(
    otto: User, django_capture_on_commit_callbacks: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    queued: list[str] = []
    monkeypatch.setattr("code_api.studio.tasks.land.delay", queued.append)
    tpm, salmon = approved("tpm", otto), approved("salmon", otto)
    with django_capture_on_commit_callbacks(execute=True):
        made = landing.start([tpm.public_id, salmon.public_id], by=otto)
    assert made.state == "pending"
    assert sorted((e.draft.node_id, e.revision, e.live) for e in made.entries.all()) == [
        ("salmon", 1, True),
        ("tpm", 1, True),
    ]
    assert queued == [str(made.public_id)]
    assert landing.live_landing(tpm) == made


def test_landing_is_refused_while_it_is_not_configured(otto: User, settings: Any) -> None:
    settings.CODE_GITHUB_APP = None
    with pytest.raises(landing.NotConfigured):
        landing.start([approved("tpm", otto).public_id], by=otto)


def test_an_empty_batch_is_refused(otto: User) -> None:
    with pytest.raises(landing.EmptyBatch):
        landing.start([], by=otto)


def test_an_unknown_draft_is_named(otto: User) -> None:
    missing = uuid.uuid4()
    with pytest.raises(landing.NoSuchDraft) as raised:
        landing.start([missing], by=otto)
    assert raised.value.public_id == missing


def test_an_open_draft_is_not_landed(otto: User) -> None:
    draft = drafts.open_existing("tpm", by=otto)
    with pytest.raises(landing.NotApproved) as raised:
        landing.start([draft.public_id], by=otto)
    assert raised.value.draft == draft
    assert not Landing.objects.exists()


def test_a_draft_already_landing_is_refused(otto: User) -> None:
    draft = approved("tpm", otto)
    first = landing.start([draft.public_id], by=otto)
    with pytest.raises(landing.AlreadyLanding) as raised:
        landing.start([draft.public_id], by=otto)
    assert raised.value.landing == first


def test_a_related_link_needs_its_partner_in_the_batch(otto: User) -> None:
    # Two nodes with no link between them: a related link is written on both (CS0502).
    tie = Link(node="probability", reason="A quality score is a probability of error.")
    back = Link(node="fastq-and-quality-scores", reason="Quality scores are error probabilities.")
    fastq = approved(
        "fastq-and-quality-scores", otto, edit=lambda n: set_links(n, "related", [tie])
    )
    with pytest.raises(landing.BatchFails) as raised:
        landing.start([fastq.public_id], by=otto)
    assert "CS0502" in {problem.code for problem in raised.value.problems}
    assert not Landing.objects.exists()
    probability = approved("probability", otto, edit=lambda n: set_links(n, "related", [back]))
    made = landing.start([fastq.public_id, probability.public_id], by=otto)
    assert made.state == "pending"


def test_an_approved_draft_in_a_landing_is_not_sent_back(otto: User) -> None:
    draft = approved("tpm", otto)
    landing.start([draft.public_id], by=otto)
    with pytest.raises(landing.AlreadyLanding):
        review.send_back(draft, reason="not yet", by=otto)
