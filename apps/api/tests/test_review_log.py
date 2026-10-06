"""The draft's log (M4.5 spec, M4R.5). Needs Compose's Postgres."""

from pathlib import Path

import pytest
from django.db import IntegrityError

from code_api.accounts.models import User
from code_api.accounts.roles import Role
from code_api.content.index import rebuild_index
from code_api.studio import drafts
from code_api.studio.log import AFTER, history, replay
from code_api.studio.models import Draft, DraftEvent

pytestmark = pytest.mark.django_db

FIXTURES = Path(__file__).resolve().parents[3] / "tests" / "fixtures" / "salmon"


@pytest.fixture(autouse=True)
def _indexed() -> None:
    rebuild_index(FIXTURES)


def test_opening_and_discarding_are_logged_in_order() -> None:
    ada = User.objects.create_user("ada@example.org", role=Role.AUTHOR)
    draft = drafts.open_existing("tpm", by=ada)
    drafts.discard(draft, by=ada)
    events = history(draft)
    assert [(e.kind, e.by, e.revision) for e in events] == [
        ("opened", ada, 1),
        ("discarded", ada, 1),
    ]
    assert replay(events) == Draft.objects.get(pk=draft.pk).state == "discarded"


def test_a_node_under_review_takes_no_second_draft() -> None:
    ada = User.objects.create_user("ada@example.org", role=Role.AUTHOR)
    draft = drafts.open_existing("tpm", by=ada)
    Draft.objects.filter(pk=draft.pk).update(state=Draft.State.SUBMITTED)
    with pytest.raises(drafts.AlreadyOpen):
        drafts.open_existing("tpm", by=ada)
    with pytest.raises(IntegrityError):
        Draft.objects.create(node_id="tpm", folder="transcriptomics/tpm", state="approved")


def test_every_kind_leaves_a_state() -> None:
    assert set(DraftEvent.Kind.values) == set(AFTER)
