"""Draft evidence is private, revision-bound, and separate from the model call log."""

import uuid
from typing import Any

import pytest
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction

from code_api.ai import gateway
from code_api.ai.gateway import Completion
from code_api.ai.models import AICall, Connection, SiteSetting
from code_api.studio.models import Draft, DraftProposal, Revision

pytestmark = pytest.mark.django_db


def revision(node: str) -> Revision:
    draft = Draft.objects.create(node_id=node, folder=node)
    return Revision.objects.create(draft=draft, number=1, node_yaml="", change="test")


def test_a_proposal_cannot_attach_another_drafts_revision() -> None:
    first, second = revision("first"), revision("second")
    proposal = DraftProposal(
        draft=first.draft, base_revision=second, target="block/0", kind="block"
    )
    with pytest.raises(ValidationError):
        proposal.full_clean()
    proposal.base_revision = first
    proposal.accepted_revision = second
    with pytest.raises(ValidationError):
        proposal.full_clean()


def test_duplicate_request_ids_share_one_proposal() -> None:
    base = revision("first")
    identity = uuid.uuid4()
    DraftProposal.objects.create(draft=base.draft, base_revision=base, request_id=identity)
    with pytest.raises(IntegrityError), transaction.atomic():
        DraftProposal.objects.create(draft=base.draft, base_revision=base, request_id=identity)
    assert base.origins == {} and base.provenance is None


def test_call_parameters_are_captured_before_settings_change(
    monkeypatch: pytest.MonkeyPatch, settings: Any
) -> None:
    settings.CODE_AI_MODEL = None
    connection = Connection.objects.create(
        name="Local", kind="self-hosted", endpoint="http://local/v1"
    )
    row = SiteSetting.objects.create(
        site="default",
        same_as_default=False,
        connection=connection,
        model="openai/test",
        temperature=0.7,
        timeout=12,
        reasoning_effort="high",
    )
    monkeypatch.setattr(gateway, "transport", lambda route, messages: Completion("ok", 1, 1, None))
    gateway.call("page-drafting", [{"role": "user", "content": "ok"}], by=None, prompt_id="test@1")
    row.timeout = 99
    row.save()
    assert AICall.objects.get().call_settings == {
        "temperature": 0.7,
        "reasoning_effort": "high",
        "timeout": 12,
    }
