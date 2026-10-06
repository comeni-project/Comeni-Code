"""Two landings racing for one draft leave it in one (M4.6 spec, M4L.3). Real transactions."""

import threading
from pathlib import Path
from typing import Any

import pytest
from django.db import connection

from code_api.accounts.models import User
from code_api.content.index import rebuild_index
from code_api.studio import drafts, landing
from code_api.studio.log import record
from code_api.studio.models import Draft, DraftEvent, LandingDraft

FIXTURES = Path(__file__).resolve().parents[3] / "tests" / "fixtures" / "salmon"


@pytest.mark.django_db(transaction=True)
def test_two_landings_racing_for_one_draft_leave_one(otto: User, settings: Any) -> None:
    settings.CODE_GITHUB_APP = object()
    rebuild_index(FIXTURES, commit="base-1")
    draft = drafts.open_existing("tpm", by=otto)
    Draft.objects.filter(pk=draft.pk).update(state=Draft.State.APPROVED)
    record(draft, DraftEvent.Kind.APPROVED, by=otto, revision=1)
    barrier = threading.Barrier(2)
    outcomes: list[str] = []

    def ask() -> None:
        try:
            barrier.wait()
            landing.start([draft.public_id], by=otto)
            outcomes.append("started")
        except landing.AlreadyLanding:
            outcomes.append("found it landing")
        finally:
            connection.close()

    threads = [threading.Thread(target=ask) for _ in range(2)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()
    assert sorted(outcomes) == ["found it landing", "started"]
    assert LandingDraft.objects.filter(draft=draft, live=True).count() == 1
