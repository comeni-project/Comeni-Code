"""Proposal generation never saves content; exact-revision author acceptance does."""

import json
import uuid
from pathlib import Path
from typing import Any

import pytest

from code_api.accounts.models import User
from code_api.ai import gateway
from code_api.ai.gateway import Completion
from code_api.ai.models import AICall, Connection, SiteSetting
from code_api.content.index import rebuild_index
from code_api.studio import ai_drafting, drafts
from code_api.studio.ai_schemas import CreateProposalIn, DraftingError
from code_api.studio.models import Draft, DraftProposal
from code_schema import Text
from code_schema.edits import update_block

pytestmark = pytest.mark.django_db
ROOT = Path(__file__).resolve().parents[3] / "tests/fixtures/salmon"


@pytest.fixture
def draft(ada: User) -> Draft:
    rebuild_index(ROOT)
    return drafts.open_existing("dna-and-genes", by=ada)


@pytest.fixture
def configured(settings: Any, monkeypatch: pytest.MonkeyPatch) -> list[object]:
    settings.CODE_AI_MODEL = None
    connection = Connection.objects.create(
        name="Local", kind="self-hosted", endpoint="http://local/v1"
    )
    SiteSetting.objects.create(
        site="default", same_as_default=False, connection=connection, model="openai/test"
    )
    calls: list[object] = []

    def answer(route: Any, messages: Any) -> Completion:
        calls.append(messages)
        return Completion(
            json.dumps(
                {
                    "value": {"kind": "text", "markdown": "A corrected explanation.\n"},
                    "source_ids": [],
                }
            ),
            10,
            5,
            None,
        )

    monkeypatch.setattr(gateway, "transport", answer)
    monkeypatch.setattr(ai_drafting, "enqueue", lambda identity: None)
    return calls


def request(draft: Draft, *, revision: int = 1) -> CreateProposalIn:
    node, _ = drafts.node_of(draft)
    assert node is not None
    at = next(i for i, b in enumerate(node.blocks) if isinstance(b, Text))
    return CreateProposalIn(
        request_id=uuid.uuid4(),
        based_on=revision,
        kind="block",
        target=f"block/{at}",
        instruction="Explain more clearly.",
    )


def test_no_model_does_not_create_a_job_or_call(draft: Draft, ada: User, settings: Any) -> None:
    settings.CODE_AI_MODEL = None
    with pytest.raises(DraftingError, match="No model"):
        ai_drafting.create(draft, request(draft), by=ada)
    assert DraftProposal.objects.count() == AICall.objects.count() == 0


def test_generation_duplicate_delivery_and_acceptance_are_distinct(
    draft: Draft, ada: User, configured: list[object]
) -> None:
    body = request(draft)
    proposal = ai_drafting.create(draft, body, by=ada)
    assert ai_drafting.create(draft, body, by=ada).pk == proposal.pk
    ai_drafting.run(str(proposal.public_id))
    ai_drafting.run(str(proposal.public_id))
    proposal.refresh_from_db()
    assert proposal.state == "ready" and len(configured) == 1
    assert draft.revisions.count() == 1
    ai_drafting.accept(proposal, by=ada, based_on=1, resolutions={})
    ai_drafting.accept(proposal, by=ada, based_on=1, resolutions={})
    assert draft.revisions.count() == 2
    latest = drafts.latest(draft)
    assert latest.provenance is not None
    assert latest.provenance["items"][body.target]["baseline"] == str(proposal.public_id)


def test_a_late_reply_cannot_overwrite_a_manual_save(
    draft: Draft, ada: User, configured: list[object]
) -> None:
    body = request(draft)
    proposal = ai_drafting.create(draft, body, by=ada)
    ai_drafting.run(str(proposal.public_id))
    at = int(body.target[6:])
    drafts.save(
        draft,
        based_on=1,
        edit=lambda n: update_block(n, at, Text("Human wins.\n")),
        by=ada,
        change="manual",
    )
    with pytest.raises(drafts.Stale):
        ai_drafting.accept(proposal, by=ada, based_on=1, resolutions={})
    assert draft.revisions.count() == 2


def test_discarded_and_interrupted_jobs_never_revive(
    draft: Draft, ada: User, configured: list[object]
) -> None:
    proposal = ai_drafting.create(draft, request(draft), by=ada)
    ai_drafting.discard(proposal)
    ai_drafting.run(str(proposal.public_id))
    assert configured == []


def test_enqueue_waits_for_commit_and_broker_failure_is_visible(
    draft: Draft,
    ada: User,
    configured: list[object],
    monkeypatch: pytest.MonkeyPatch,
    django_capture_on_commit_callbacks: Any,
) -> None:
    def unavailable(identity: str) -> None:
        raise RuntimeError("broker unavailable")

    monkeypatch.setattr(ai_drafting, "enqueue", unavailable)
    with django_capture_on_commit_callbacks(execute=True):
        proposal = ai_drafting.create(draft, request(draft), by=ada)
        assert proposal.state == "queued"
    proposal.refresh_from_db()
    assert proposal.state == "failed" and proposal.code == "CA0505"
    assert draft.revisions.count() == 1 and configured == []


@pytest.mark.django_db(transaction=True)
def test_two_workers_claim_one_call_without_holding_a_transaction(
    draft: Draft,
    ada: User,
    configured: list[object],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from concurrent.futures import ThreadPoolExecutor
    from threading import Event

    from django import db

    entered, release = Event(), Event()
    transport = gateway.transport

    def waiting(route: Any, messages: Any) -> Completion:
        assert not db.connection.in_atomic_block
        entered.set()
        assert release.wait(5)
        return transport(route, messages)

    monkeypatch.setattr(gateway, "transport", waiting)
    proposal = ai_drafting.create(draft, request(draft), by=ada)

    def one() -> None:
        try:
            ai_drafting.run(str(proposal.public_id))
        finally:
            db.connections.close_all()

    with ThreadPoolExecutor(max_workers=2) as pool:
        first = pool.submit(one)
        assert entered.wait(5)
        second = pool.submit(one)
        try:
            second.result(timeout=5)
        finally:
            release.set()
        first.result(timeout=5)
    assert len(configured) == 1


def test_discard_during_a_call_keeps_its_evidence_without_reviving_it(
    draft: Draft,
    ada: User,
    configured: list[object],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    proposal = ai_drafting.create(draft, request(draft), by=ada)
    transport = gateway.transport

    def discarded(route: Any, messages: Any) -> Completion:
        ai_drafting.discard(proposal)
        return transport(route, messages)

    monkeypatch.setattr(gateway, "transport", discarded)
    ai_drafting.run(str(proposal.public_id))
    proposal.refresh_from_db()
    assert proposal.state == "discarded" and proposal.call_id is not None
    assert draft.revisions.count() == 1


def test_expired_work_is_not_retried(draft: Draft, ada: User, configured: list[object]) -> None:
    from datetime import timedelta

    from django.utils import timezone

    proposal = ai_drafting.create(draft, request(draft), by=ada)
    DraftProposal.objects.filter(pk=proposal.pk).update(
        created_at=timezone.now() - timedelta(minutes=6)
    )
    assert ai_drafting.expire() == 1
    ai_drafting.run(str(proposal.public_id))
    assert configured == []
