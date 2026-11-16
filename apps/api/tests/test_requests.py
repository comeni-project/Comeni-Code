"""Triage is an explicit, version-checked human decision."""

from datetime import timedelta
from typing import Any

import pytest
from django.utils import timezone

from code_api.studio import requests
from code_api.studio.models import RequestDecision

pytestmark = pytest.mark.django_db


def test_intake_stays_requested_until_a_human_accepts(ada: Any) -> None:
    item = requests.create("DNA", "Explain complementary base pairing.")
    assert item.state == "requested" and item.version == 1
    assert not RequestDecision.objects.exists()
    requests.decide(item.public_id, "accept", expected_version=1, by=ada)
    item.refresh_from_db()
    assert item.state == "accepted" and item.version == 2
    event = item.decisions.get()
    assert event.actor == ada and event.before == "requested" and event.after == "accepted"
    assert event.version == 2


def test_stale_decisions_leave_no_audit_or_change(ada: Any) -> None:
    item = requests.create("DNA", "Explain base pairing.")
    requests.decide(item.public_id, "accept", expected_version=1, by=ada)
    with pytest.raises(requests.RequestError, match="changed"):
        requests.decide(item.public_id, "decline", expected_version=1, by=ada, reason="Duplicate")
    assert item.decisions.count() == 1


@pytest.mark.parametrize("action", ["decline", "merge", "snooze"])
def test_decisions_need_a_reason(ada: Any, action: str) -> None:
    item = requests.create("DNA", "Explain base pairing.")
    with pytest.raises(requests.RequestError, match="reason"):
        requests.decide(item.public_id, action, expected_version=1, by=ada)
    assert not item.decisions.exists()


def test_snooze_needs_a_future_time_and_human_resume(ada: Any) -> None:
    item = requests.create("DNA", "Explain base pairing.")
    with pytest.raises(requests.RequestError, match="future"):
        requests.decide(item.public_id, "snooze", expected_version=1, by=ada, reason="Later")
    requests.decide(
        item.public_id,
        "snooze",
        expected_version=1,
        by=ada,
        reason="Review tomorrow",
        until=timezone.now() + timedelta(days=1),
    )
    item.refresh_from_db()
    assert item.state == "snoozed"
    requests.decide(item.public_id, "resume", expected_version=2, by=ada)
    item.refresh_from_db()
    assert item.state == "requested" and item.snoozed_until is None
    assert item.decisions.count() == 2


def test_merge_requires_a_real_node(ada: Any) -> None:
    item = requests.create("DNA", "Explain base pairing.")
    with pytest.raises(requests.RequestError, match="indexed node"):
        requests.decide(
            item.public_id,
            "merge",
            expected_version=1,
            by=ada,
            reason="Already covered",
            node_id="invented",
        )
    assert not item.decisions.exists()


def test_terminal_request_cannot_be_decided_twice(ada: Any) -> None:
    item = requests.create("DNA", "Explain base pairing.")
    requests.decide(item.public_id, "decline", expected_version=1, by=ada, reason="Out of scope")
    with pytest.raises(requests.RequestError, match="state"):
        requests.decide(item.public_id, "accept", expected_version=2, by=ada)
    assert item.decisions.count() == 1


def test_non_author_cannot_decide(ada: Any) -> None:
    item = requests.create("DNA", "Explain base pairing.")
    ada.role = ""
    ada.save(update_fields=["role"])
    with pytest.raises(requests.RequestError, match="author"):
        requests.decide(item.public_id, "accept", expected_version=1, by=ada)
    assert not item.decisions.exists()
