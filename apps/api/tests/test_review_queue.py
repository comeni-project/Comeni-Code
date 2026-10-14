"""The review queue (M4.9b spec, M4RS.1). Needs Compose's Postgres."""

from collections.abc import Callable
from pathlib import Path
from typing import Any

import pytest
from django.test import Client

from code_api.accounts.models import User
from code_api.content.index import rebuild_index
from code_api.studio import drafts, review
from code_api.studio.models import Draft
from code_schema.edits import set_fields

pytestmark = pytest.mark.django_db

FIXTURES = Path(__file__).resolve().parents[3] / "tests" / "fixtures" / "salmon"
Ready = Callable[[User], Draft]


@pytest.fixture(autouse=True)
def _indexed() -> None:
    rebuild_index(FIXTURES)


def queue(by: User) -> Any:
    client = Client()
    client.force_login(by)
    return client.get("/api/studio/review")


def test_a_reviewer_sees_each_submitted_draft_with_its_keys(
    ada: User, grace: User, ready: Ready
) -> None:
    draft = review.submit(ready(ada), revision=2, by=ada)
    review.answer(draft, "tpm-or-count", 0, by=grace)
    review.set_verdicts(
        draft, revision=2, verdicts=[review.Given("block/1", "changes", "Shorter.")], by=grace
    )
    response = queue(grace)
    assert response.status_code == 200, response.content
    [shown] = response.json()
    assert (shown["node_id"], shown["title"], shown["revision"], shown["reads"]) == (
        "tpm",
        "What TPM measures",
        2,
        True,
    )
    assert [c["email"] for c in shown["contributors"]] == ["ada@example.org"]
    keys = {k["key"]: k for k in shown["keys"]}
    assert len(keys) == 11
    assert keys["block/1"] == {
        "key": "block/1",
        "kind": "callout",
        "label": "TPM is not a count of reads",
        "verdict": "changes",
        "answered": None,
    }
    assert (keys["exam/tpm-or-count"]["answered"], keys["exam/tpm-of-a"]["answered"]) == (
        True,
        False,
    )
    assert "value" not in keys["exam/tpm-of-a"] and "right_option" not in keys["exam/tpm-of-a"]


def test_drafts_you_wrote_are_left_out_unless_you_are_an_operator(
    ada: User, grace: User, otto: User, ready: Ready
) -> None:
    draft = ready(ada)
    drafts.save(draft, based_on=2, edit=lambda n: set_fields(n, minutes=9), by=grace, change="m")
    review.submit(draft, revision=3, by=ada)
    assert queue(grace).json() == []
    assert [d["node_id"] for d in queue(otto).json()] == ["tpm"]


def test_an_author_may_not_read_the_queue(ada: User) -> None:
    response = queue(ada)
    assert (response.status_code, response.json()["code"]) == (403, "CA0102")


def test_open_and_approved_drafts_are_not_in_it(grace: User, ada: User, ready: Ready) -> None:
    ready(ada)
    assert queue(grace).json() == []
