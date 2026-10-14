"""The Verdict table (M4.9a spec, M4V.3). Needs Compose's Postgres."""

from collections.abc import Callable
from pathlib import Path

import pytest
from django.db import IntegrityError

from code_api.accounts.models import User
from code_api.content.index import rebuild_index
from code_api.studio import review
from code_api.studio.log import record
from code_api.studio.models import Draft, DraftEvent, Review, Verdict

pytestmark = pytest.mark.django_db

FIXTURES = Path(__file__).resolve().parents[3] / "tests" / "fixtures" / "salmon"


@pytest.fixture(autouse=True)
def _indexed() -> None:
    rebuild_index(FIXTURES)


def test_one_verdict_per_key_per_review(
    ada: User, grace: User, ready: Callable[[User], Draft]
) -> None:
    draft = review.submit(ready(ada), revision=2, by=ada)
    review.answer(draft, "tpm-or-count", 0, by=grace)
    found = Review.objects.get(draft=draft, reviewer=grace)
    Verdict.objects.create(review=found, key="block/0", kind="text", verdict="approved")
    assert [v.key for v in found.verdicts.all()] == ["block/0"]
    with pytest.raises(IntegrityError):
        Verdict.objects.create(review=found, key="block/0", kind="text", verdict="changes")


def test_an_event_records_its_blocks(ada: User, ready: Callable[[User], Draft]) -> None:
    draft = ready(ada)
    event = record(draft, DraftEvent.Kind.APPROVED, by=ada, revision=2, blocks=11)
    assert DraftEvent.objects.get(pk=event.pk).blocks == 11
