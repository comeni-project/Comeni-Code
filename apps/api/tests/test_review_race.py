"""Two approvals at once leave one (M4.5 spec, M4R.3). Real transactions, so its own module."""

import threading
from collections.abc import Callable
from pathlib import Path

import pytest
from django.db import connection

from code_api.accounts.models import User
from code_api.content.index import rebuild_index
from code_api.studio import review
from code_api.studio.models import Draft, DraftEvent

FIXTURES = Path(__file__).resolve().parents[3] / "tests" / "fixtures" / "salmon"
TPM_KEYS = {"tpm-sums-to": 1000000, "tpm-or-count": 0, "twice-as-long": 0, "tpm-of-a": 750000}


@pytest.mark.django_db(transaction=True)
def test_two_approvals_racing_leave_one(
    ada: User, grace: User, otto: User, ready: Callable[[User], Draft]
) -> None:
    rebuild_index(FIXTURES)
    draft = review.submit(ready(ada), revision=2, by=ada)
    for judge in (grace, otto):
        for question_id, key in TPM_KEYS.items():
            review.answer(draft, question_id, key, by=judge)
    barrier = threading.Barrier(2)
    outcomes: dict[str, str] = {}

    def approve(judge: User) -> None:
        try:
            barrier.wait()
            review.approve(draft, revision=2, reason="", by=judge)
            outcomes[judge.email] = "approved"
        except review.WrongState:
            outcomes[judge.email] = "found it approved"
        finally:
            connection.close()

    threads = [threading.Thread(target=approve, args=(judge,)) for judge in (grace, otto)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()
    assert sorted(outcomes.values()) == ["approved", "found it approved"]
    assert DraftEvent.objects.filter(draft=draft, kind="approved").count() == 1
