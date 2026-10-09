"""Two approvals at once leave one (M4.5 spec, M4R.3). Real transactions, so its own module."""

import threading
import time
from collections.abc import Callable
from pathlib import Path

import pytest
from django.db import connection

from code_api.accounts.models import User
from code_api.content.index import rebuild_index
from code_api.studio import review
from code_api.studio.models import Draft, DraftEvent

FIXTURES = Path(__file__).resolve().parents[3] / "tests" / "fixtures" / "salmon"
TPM_KEYS: dict[str, object] = {
    "tpm-sums-to": 1000000,
    "tpm-or-count": 0,
    "twice-as-long": 0,
    "tpm-of-a": 750000,
    "tpm-steps": [
        "Count the reads on each transcript",
        "Divide each count by the transcript's effective length",
        "Add up the rates across the sample",
        "Scale each rate so the rates add up to a million",
    ],
    "tpm-unit-name": "Transcripts per million",
}


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


@pytest.mark.django_db(transaction=True)
def test_a_review_holds_the_draft_while_it_reads(
    ada: User, grace: User, ready: Callable[[User], Draft], monkeypatch: pytest.MonkeyPatch
) -> None:
    # #189: review_of read the state, the answers and the questions apart, so a withdraw (and an
    # edit and a resubmit) landing between them could grade old answers against new questions.
    rebuild_index(FIXTURES)
    draft = review.submit(ready(ada), revision=2, by=ada)
    reading, order = threading.Event(), []
    real_asked = review.asked

    def slow_asked(d: Draft) -> list[review.Asked]:
        reading.set()
        time.sleep(0.5)
        return real_asked(d)

    monkeypatch.setattr(review, "asked", slow_asked)

    def read() -> None:
        try:
            review.review_of(draft, by=grace)
            order.append("review read")
        finally:
            connection.close()

    def withdraw() -> None:
        try:
            reading.wait()
            review.withdraw(draft, by=ada)
            order.append("withdrawn")
        finally:
            connection.close()

    threads = [threading.Thread(target=read), threading.Thread(target=withdraw)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()
    assert order == ["review read", "withdrawn"]
