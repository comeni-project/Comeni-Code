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
    rebuild_index(ROOT, commit="base-1")
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


def test_private_source_evidence_is_not_in_landing_files_or_pr_text(
    draft: Draft,
    ada: User,
    grace: User,
    otto: User,
    configured: list[object],
    settings: Any,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from fake_github import FakeGitHub

    from code_api.studio import landing
    from code_api.studio.ai_schemas import SourceIn
    from code_api.studio.log import record
    from code_api.studio.models import DraftEvent

    body = request(draft)
    body.sources = [
        SourceIn(
            id="private",
            title="Private note",
            url="https://private.example.org/note",
            licence="Author permission",
            excerpt="PRIVATE SOURCE EXCERPT",
            public=False,
        )
    ]
    proposal = ai_drafting.create(draft, body, by=ada)
    ai_drafting.run(str(proposal.public_id))
    ai_drafting.accept(proposal, by=ada, based_on=1, resolutions={})
    Draft.objects.filter(pk=draft.pk).update(state=Draft.State.APPROVED)
    record(draft, DraftEvent.Kind.APPROVED, by=grace, revision=2, answered=0, wrong=0)
    settings.CODE_GITHUB_APP = object()
    monkeypatch.setattr("code_api.studio.tasks.land.delay", lambda identity: None)
    fake = FakeGitHub()
    made = landing.start([draft.public_id], by=otto)
    landing.run(made, fake)
    made.refresh_from_db()
    assert "commit-1" in fake.commits, (
        made.reason,
        list(made.entries.values("dropped_reason", "dropped_code")),
        fake.calls,
    )
    _, files, _ = fake.commits["commit-1"]
    public = files[f"{draft.folder}/provenance.json"]
    assert isinstance(public, str) and proposal.prompt_id in public
    exported = public + str(fake.pulls)
    for secret in ("PRIVATE SOURCE EXCERPT", "private.example.org", ada.email):
        assert secret not in exported
    proposal.refresh_from_db()
    assert proposal.sources[0]["excerpt"] == "PRIVATE SOURCE EXCERPT"


def test_figure_receipt_is_consumed_only_by_successful_normal_save(
    draft: Draft, ada: User, configured: list[object], monkeypatch: pytest.MonkeyPatch
) -> None:
    import yaml

    from code_api.ai.gateway import Completion
    from code_figures import COMPONENTS
    from code_schema.edits import add_figure

    component = COMPONENTS["kmer-graph"]
    assert component is not None
    text = yaml.safe_dump(
        {"component": "kmer-graph", "alt": "Reads as a graph.", "data": component.starter}
    )
    body = CreateProposalIn(
        request_id=uuid.uuid4(),
        based_on=1,
        kind="figure",
        target="figure/new",
        instruction="Keep these data.",
        copy_text=text,
        copy_digest=ai_drafting.text_digest(text),
        figure_at=0,
    )
    monkeypatch.setattr(
        gateway,
        "transport",
        lambda *a: Completion(
            json.dumps({"value": yaml.safe_load(text), "source_ids": []}), 10, 5, None
        ),
    )
    proposal = ai_drafting.create(draft, body, by=ada)
    ai_drafting.run(str(proposal.public_id))
    proposal.refresh_from_db()
    assert proposal.state == "ready"
    saved = ai_drafting.save_figure(
        draft,
        based_on=1,
        by=ada,
        edit=lambda n: add_figure(n, 0, text=text, caption="A graph.\n"),
        change="added figure",
        association={
            "proposal_id": str(proposal.public_id),
            "copy_digest": body.copy_digest,
            "resolutions": {},
        },
        target="figure/new",
        at=0,
        question=None,
    )
    proposal.refresh_from_db()
    assert proposal.state == "accepted" and proposal.accepted_revision_id == saved.revision.pk
    assert saved.revision.provenance is not None
    assert any(k.startswith("figure/") for k in saved.revision.provenance["items"])


@pytest.mark.parametrize(
    "reply,code",
    [
        ({"value": {"kind": "image", "file": "x"}}, "CA0500"),
        ({"value": {"kind": "text", "markdown": "Fine.\n"}, "source_ids": ["invented"]}, "CA0501"),
        ({"value": {"kind": "text", "markdown": ":::"}}, "CA0502"),
    ],
)
def test_invalid_model_edits_are_visible_without_saves(
    draft: Draft,
    ada: User,
    configured: list[object],
    monkeypatch: pytest.MonkeyPatch,
    reply: dict[str, Any],
    code: str,
) -> None:
    monkeypatch.setattr(gateway, "transport", lambda *a: Completion(json.dumps(reply), 10, 5, None))
    p = ai_drafting.create(draft, request(draft), by=ada)
    ai_drafting.run(str(p.public_id))
    p.refresh_from_db()
    assert p.state == "refused" and p.code == code
    assert p.call_id is not None and draft.revisions.count() == 1


def test_imported_origin_needs_an_explicit_resolution_and_no_model_baseline_is_invented(
    draft: Draft, ada: User, configured: list[object]
) -> None:
    from code_schema.provenance import attach

    identity = str(uuid.uuid4())
    body = request(draft)
    public = {"model": "old/model", "prompt_id": "draft-block@1", "settings": {}, "sources": []}
    drafts.save(
        draft,
        based_on=1,
        edit=lambda n: attach(n, body.target, identity, public),
        by=ada,
        change="imported",
    )
    body.based_on = 2
    p = ai_drafting.create(draft, body, by=ada)
    ai_drafting.run(str(p.public_id))
    p.refresh_from_db()
    assert p.state == "ready" and p.code == "CA0504" and p.conflicts[0]["base_present"] is False
    with pytest.raises(DraftingError) as missing:
        ai_drafting.accept(p, by=ada, based_on=2, resolutions={})
    assert missing.value.code == "CA0503" and draft.revisions.count() == 2
    ai_drafting.accept(p, by=ada, based_on=2, resolutions={"": {"choice": "human"}})
    assert draft.revisions.count() == 3


def test_stale_figure_copy_and_not_ready_are_diagnostics(
    draft: Draft, ada: User, configured: list[object]
) -> None:
    body = request(draft)
    body.kind, body.target, body.copy_text = "figure", "figure/new", "component: kmer-graph"
    with pytest.raises(DraftingError) as mismatch:
        ai_drafting.create(draft, body, by=ada)
    assert mismatch.value.code == "CA0506"
    p = ai_drafting.create(draft, request(draft), by=ada)
    with pytest.raises(DraftingError) as unready:
        ai_drafting.chosen(p, {})
    assert unready.value.code == "CA0507"


@pytest.mark.parametrize("change", ["deactivate", "delete", "submit", "discard", "no-model"])
def test_a_claim_refuses_a_requester_draft_or_route_that_is_no_longer_available(
    draft: Draft, ada: User, configured: list[object], change: str
) -> None:
    p = ai_drafting.create(draft, request(draft), by=ada)
    if change == "deactivate":
        User.objects.filter(pk=ada.pk).update(is_active=False)
    elif change == "delete":
        ada.delete()
    elif change in {"submit", "discard"}:
        Draft.objects.filter(pk=draft.pk).update(
            state="submitted" if change == "submit" else "discarded"
        )
    else:
        SiteSetting.objects.all().delete()
    ai_drafting.run(str(p.public_id))
    p.refresh_from_db()
    assert p.state == "refused" and p.call_id is None and configured == []
    assert draft.revisions.count() == 1


def test_an_invalid_figure_working_copy_is_a_diagnostic(
    draft: Draft, ada: User, configured: list[object]
) -> None:
    body = request(draft)
    body.kind, body.target, body.copy_text = "figure", "figure/new", "component: ["
    body.copy_digest = ai_drafting.text_digest(body.copy_text)
    with pytest.raises(DraftingError) as invalid:
        ai_drafting.create(draft, body, by=ada)
    assert invalid.value.code == "CA0502" and DraftProposal.objects.count() == 0


@pytest.mark.parametrize("placement", ["body", "question"])
def test_figure_saves_keep_receipts_on_failure_shared_files_and_human_changes(
    draft: Draft,
    ada: User,
    configured: list[object],
    monkeypatch: pytest.MonkeyPatch,
    placement: str,
) -> None:
    import yaml
    from django.test import Client

    from code_api.studio.ai_edits import payload
    from code_figures import COMPONENTS
    from code_schema.edits import add_figure

    value: dict[str, Any] = {
        "component": "kmer-graph",
        "alt": "Reads as a graph.",
        "data": COMPONENTS["kmer-graph"].starter,
    }
    if placement == "question":
        value["data"] = {**value["data"], "highlight": "none"}
        value["interact"] = {"task": "trace", "spells": "ACGTTAG"}
    text = yaml.safe_dump(value)
    node, _ = drafts.node_of(draft)
    assert node is not None
    question = node.questions[0].id if placement == "question" else None

    def place(n: Any) -> Any:
        from code_schema import Figure
        from code_schema.edits import insert_block

        made = add_figure(
            n, 0 if question is None else None, text=text, caption="Graph.\n", question=question
        )
        return (
            made
            if question
            else insert_block(
                made, len(made.blocks), Figure(made.figures[0].stem, "Shared graph.\n")
            )
        )

    initial = drafts.save(draft, based_on=1, by=ada, change="placed figure", edit=place)
    node, _ = drafts.node_of(draft)
    assert node is not None
    stem = node.figures[0].stem
    body = CreateProposalIn(
        request_id=uuid.uuid4(),
        based_on=initial.revision.number,
        kind="figure",
        target=f"figure/{stem}",
        instruction="Improve alt.",
        copy_text=text,
        copy_digest=ai_drafting.text_digest(text),
    )
    value["alt"] = "An improved graph."
    monkeypatch.setattr(
        gateway, "transport", lambda *a: Completion(json.dumps({"value": value}), 10, 5, None)
    )
    p = ai_drafting.create(draft, body, by=ada)
    ai_drafting.run(str(p.public_id))
    p.refresh_from_db()
    assert p.state == "ready"
    client = Client()
    client.force_login(ada)
    url = f"/api/studio/drafts/{draft.public_id}/figures/{stem}"
    association = {
        "proposal_id": str(p.public_id),
        "copy_digest": body.copy_digest,
        "resolutions": {},
    }
    # A malformed file makes no receipt or revision; the same association remains usable.
    invalid = client.put(
        url,
        {"revision": 2, "text": "component: [", "ai_proposal": association},
        content_type="application/json",
    )
    assert invalid.status_code == 422
    p.refresh_from_db()
    assert p.state == "ready" and draft.revisions.count() == 2
    forged = client.put(
        url,
        {
            "revision": 2,
            "text": yaml.safe_dump(value),
            "ai_proposal": {**association, "copy_digest": "a" * 64},
        },
        content_type="application/json",
    )
    assert forged.status_code == 422 and forged.json()["code"] == "CA0506"
    value["alt"] = "A human correction after Use."
    result = client.put(
        url,
        {"revision": 2, "text": yaml.safe_dump(value), "ai_proposal": association},
        content_type="application/json",
    )
    assert result.status_code == 200, result.content
    p.refresh_from_db()
    assert p.state == "accepted" and draft.revisions.count() == 3
    final, _ = drafts.node_of(draft)
    assert final is not None
    assert payload(final, f"figure/{stem}")["alt"] == value["alt"]
    assert final.provenance is not None
    placed_key = f"try/{question}" if question else "block/0"
    assert str(p.public_id) in final.provenance["items"][placed_key]["receipts"]
    if question is None:
        assert (
            str(p.public_id)
            in final.provenance["items"][f"block/{len(final.blocks) - 1}"]["receipts"]
        )
    # A repeated normal Save cannot consume the association a second time.
    again = client.put(
        url,
        {"revision": 3, "text": yaml.safe_dump(value), "ai_proposal": association},
        content_type="application/json",
    )
    assert again.status_code == 409 and draft.revisions.count() == 3


@pytest.mark.django_db(transaction=True)
def test_concurrent_creation_of_one_request_enqueues_one_proposal(
    draft: Draft, ada: User, configured: list[object]
) -> None:
    from concurrent.futures import ThreadPoolExecutor
    from threading import Barrier

    from django import db

    body = request(draft)
    barrier = Barrier(2)

    def one() -> str:
        try:
            barrier.wait(timeout=5)
            return str(ai_drafting.create(draft, body, by=ada).public_id)
        finally:
            db.connections.close_all()

    with ThreadPoolExecutor(max_workers=2) as pool:
        left, right = pool.submit(one), pool.submit(one)
        assert left.result(timeout=10) == right.result(timeout=10)
    assert DraftProposal.objects.count() == 1
