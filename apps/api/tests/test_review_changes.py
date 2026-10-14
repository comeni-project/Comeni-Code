"""What a block was before the draft (M4.9b spec, M4RS.2). Needs Compose's Postgres."""

from collections.abc import Callable
from dataclasses import replace
from pathlib import Path
from typing import Any

import pytest
from django.test import Client

from code_api.accounts.models import User
from code_api.content.index import rebuild_index
from code_api.studio import drafts, review
from code_api.studio.log import record
from code_api.studio.models import Draft, DraftEvent
from code_schema import Callout, Level, Text
from code_schema.edits import insert_block, update_block, update_exam_question

pytestmark = pytest.mark.django_db

FIXTURES = Path(__file__).resolve().parents[3] / "tests" / "fixtures" / "salmon"
Ready = Callable[[User], Draft]
CAVEAT = Callout(kind="caveat", title="Mind the length", markdown="Short ones vary more.\n")


@pytest.fixture(autouse=True)
def _indexed() -> None:
    rebuild_index(FIXTURES)


def items(draft: Draft, by: User) -> dict[str, dict[str, Any]]:
    client = Client()
    client.force_login(by)
    response = client.get(f"/api/studio/drafts/{draft.public_id}/review")
    assert response.status_code == 200, response.content
    return {i["key"]: i for i in response.json()["items"]}


def test_against_the_live_node(ada: User, grace: User, ready: Ready) -> None:
    draft = ready(ada)
    drafts.save(
        draft,
        based_on=2,
        edit=lambda n: insert_block(update_block(n, 0, Text(markdown="Shorter.\n")), 1, CAVEAT),
        by=ada,
        change="e",
    )
    review.submit(draft, revision=3, by=ada)
    shown = items(draft, grace)
    assert {k: i["change"] for k, i in shown.items() if not k.startswith("exam/")} == {
        "node": "same",
        "block/0": "changed",
        "block/1": "new",
        "block/2": "same",
        "block/3": "same",
        "resource/0": "new",
    }
    assert shown["block/0"]["before"]["block"]["markdown"].startswith("A long transcript")
    assert shown["block/2"]["before"] is None  # only a changed key carries its before
    assert shown["exam/tpm-of-a"]["change"] == "same"


def test_a_new_node_is_new_throughout(ada: User, grace: User) -> None:
    draft = drafts.open_new(
        "bubbles",
        title="Bubbles",
        claim="A claim.",
        region="algorithms",
        level=Level.INTRODUCTORY,
        minutes=10,
        by=ada,
    )
    Draft.objects.filter(pk=draft.pk).update(state="submitted")
    record(draft, DraftEvent.Kind.SUBMITTED, by=ada, revision=1)
    assert {i["change"] for i in items(draft, grace).values()} == {"new"}


def test_a_questions_before_hides_its_key_until_answered(
    ada: User, grace: User, ready: Ready
) -> None:
    # Review Focus 2.
    draft = ready(ada)
    node, _ = drafts.node_of(draft)
    assert node is not None
    old = next(q for q in node.exam if q.id == "tpm-of-a")
    drafts.save(
        draft,
        based_on=2,
        edit=lambda n: update_exam_question(n, "tpm-of-a", replace(old, title="TPM of A, again")),
        by=ada,
        change="t",
    )
    review.submit(draft, revision=3, by=ada)
    before = items(draft, grace)["exam/tpm-of-a"]
    assert before["change"] == "changed"
    assert before["before"]["question"]["value"] is None
    assert before["question"]["value"] is None
    review.answer(draft, "tpm-of-a", 750000, by=grace)
    after = items(draft, grace)["exam/tpm-of-a"]
    assert after["before"]["question"]["value"] == 750000
