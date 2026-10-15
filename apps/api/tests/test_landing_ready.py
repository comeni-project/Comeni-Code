"""The drafts ready to land (M4.9c spec, M4LS.1). Needs Compose's Postgres."""

from functools import reduce
from pathlib import Path
from typing import Any

import pytest
from django.test import Client

from code_api.accounts.models import User
from code_api.content.index import rebuild_index
from code_api.content.models import Region
from code_api.studio import drafts, landing
from code_api.studio.log import record
from code_api.studio.models import Draft, DraftEvent
from code_schema import Level, Text
from code_schema.edits import delete_exam_question, set_fields, update_block

pytestmark = pytest.mark.django_db

FIXTURES = Path(__file__).resolve().parents[3] / "tests" / "fixtures" / "salmon"
READY = "/api/studio/landings/ready"


@pytest.fixture(autouse=True)
def _indexed(settings: Any, monkeypatch: pytest.MonkeyPatch) -> None:
    rebuild_index(FIXTURES, commit="base-1")
    settings.CODE_GITHUB_APP = object()
    monkeypatch.setattr("code_api.studio.tasks.land.delay", lambda public_id: None)


def approve(draft: Draft, judge: User) -> Draft:
    number = drafts.latest(draft).number
    Draft.objects.filter(pk=draft.pk).update(state=Draft.State.APPROVED)
    by = draft.created_by
    record(draft, DraftEvent.Kind.APPROVED, by=judge, revision=number, self_approved=by == judge)
    return Draft.objects.get(pk=draft.pk)


def edited(node_id: str, edit: Any, author: User) -> Draft:
    draft = drafts.open_existing(node_id, by=author)
    drafts.save(draft, based_on=1, edit=edit, by=author, change="e")
    return draft


def listed(by: User) -> dict[str, dict[str, Any]]:
    client = Client()
    client.force_login(by)
    answer = client.get(READY)
    assert answer.status_code == 200, answer.content
    return {row["node_id"]: row for row in answer.json()}


def test_approved_drafts_no_landing_holds_in_node_order(ada: User, grace: User, otto: User) -> None:
    tpm = approve(edited("tpm", lambda n: set_fields(n, minutes=n.minutes + 1), ada), grace)
    salmon = approve(edited("salmon", lambda n: set_fields(n, minutes=n.minutes + 1), ada), grace)
    drafts.open_existing("k-mers", by=ada)  # open: not ready
    landing.start([salmon.public_id], by=otto)  # held: not ready
    rows = listed(otto)
    assert list(rows) == ["tpm"]
    row = rows["tpm"]
    assert (row["public_id"], row["revision"], row["folder"]) == (
        str(tpm.public_id),
        2,
        "transcriptomics/tpm",
    )
    assert row["region"] == Region.objects.get(id="transcriptomics").name
    assert (row["approved_by"]["name"], row["self_approved"]) == (grace.name, False)


def test_files_say_what_changes_and_leave_out_the_rest(ada: User, grace: User, otto: User) -> None:
    approve(edited("tpm", lambda n: set_fields(n, minutes=n.minutes + 1), ada), grace)
    body = Text(markdown="Shorter.\n")
    approve(edited("salmon", lambda n: update_block(n, 0, body), ada), grace)
    rows = listed(otto)
    assert rows["tpm"]["files"] == [{"file": "node", "change": "changed"}]
    assert rows["salmon"]["files"] == [{"file": "body", "change": "changed"}]


def test_an_exam_emptied_is_removed(ada: User, grace: User, otto: User) -> None:
    def empty(n: Any) -> Any:
        return reduce(lambda m, q: delete_exam_question(m, q.id), n.exam, n)

    approve(edited("tpm", empty, ada), grace)
    assert listed(otto)["tpm"]["files"] == [{"file": "exam", "change": "removed"}]


def test_a_new_node_is_new_throughout(otto: User) -> None:
    draft = drafts.open_new(
        "bubbles",
        title="Bubbles",
        claim="A claim.",
        region="algorithms",
        level=Level.INTRODUCTORY,
        minutes=10,
        by=otto,
    )
    approve(draft, otto)
    row = listed(otto)["bubbles"]
    assert {"file": "node", "change": "new"} in row["files"]
    assert {each["change"] for each in row["files"]} == {"new"}
    assert row["self_approved"] is True


def test_only_an_operator_reads_it(grace: User) -> None:
    client = Client()
    client.force_login(grace)
    answer = client.get(READY)
    assert (answer.status_code, answer.json()["code"]) == (403, "CA0102")


def test_a_landing_id_still_reads_as_one(otto: User) -> None:
    # Review Focus 2: /ready is not a landing id, and an unknown id is still CA0310.
    client = Client()
    client.force_login(otto)
    answer = client.get("/api/studio/landings/00000000-0000-0000-0000-000000000000")
    assert (answer.status_code, answer.json()["code"]) == (404, "CA0310")
