"""Landing's routes (M4.6 spec, M4L.5). Needs Compose's Postgres."""

import uuid
from pathlib import Path
from typing import Any

import pytest
from django.test import Client
from fake_github import FakeGitHub

from code_api.accounts.models import User
from code_api.content.index import rebuild_index
from code_api.studio import drafts, landing
from code_api.studio.log import record
from code_api.studio.models import Draft, DraftEvent

pytestmark = pytest.mark.django_db

FIXTURES = Path(__file__).resolve().parents[3] / "tests" / "fixtures" / "salmon"
BASE = "/api/studio/landings"


@pytest.fixture(autouse=True)
def _ready(settings: Any, monkeypatch: pytest.MonkeyPatch) -> None:
    rebuild_index(FIXTURES, commit="base-1")
    settings.CODE_GITHUB_APP = object()
    monkeypatch.setattr("code_api.studio.tasks.land.delay", lambda public_id: None)


def approved(node_id: str, by: User) -> Draft:
    draft = drafts.open_existing(node_id, by=by)
    Draft.objects.filter(pk=draft.pk).update(state=Draft.State.APPROVED)
    record(draft, DraftEvent.Kind.APPROVED, by=by, revision=1, reason="r", self_approved=True)
    return Draft.objects.get(pk=draft.pk)


def signed_in(user: User) -> Client:
    client = Client()
    client.force_login(user)
    return client


def test_an_operator_starts_a_landing(otto: User) -> None:
    draft = approved("salmon", otto)
    answer = signed_in(otto).post(
        BASE, {"drafts": [str(draft.public_id)]}, content_type="application/json"
    )
    assert answer.status_code == 202
    body = answer.json()
    assert body["state"] == "pending"
    assert body["entries"][0]["node_id"] == "salmon"
    listed = signed_in(otto).get("/api/studio/drafts?state=approved").json()
    assert listed[0]["landing"] == body["public_id"]


def test_a_reviewer_cannot_land(grace: User, otto: User) -> None:
    draft = approved("salmon", otto)
    answer = signed_in(grace).post(
        BASE, {"drafts": [str(draft.public_id)]}, content_type="application/json"
    )
    assert (answer.status_code, answer.json()["code"]) == (403, "CA0102")


@pytest.mark.parametrize(
    ("case", "status", "code"),
    [
        ("off", 503, "CA0301"),
        ("open", 409, "CA0302"),
        ("twice", 409, "CA0303"),
        ("empty", 422, "CA0304"),
        ("unknown", 404, "CA0201"),
    ],
)
def test_a_refused_batch_names_its_code(
    otto: User, settings: Any, case: str, status: int, code: str
) -> None:
    ids: list[str] = []
    if case == "off":
        settings.CODE_GITHUB_APP = None
        ids = [str(approved("salmon", otto).public_id)]
    elif case == "open":
        ids = [str(drafts.open_existing("salmon", by=otto).public_id)]
    elif case == "twice":
        draft = approved("salmon", otto)
        landing.start([draft.public_id], by=otto)
        ids = [str(draft.public_id)]
    elif case == "unknown":
        ids = [str(uuid.uuid4())]
    answer = signed_in(otto).post(BASE, {"drafts": ids}, content_type="application/json")
    assert (answer.status_code, answer.json()["code"]) == (status, code)


def test_a_batch_that_fails_in_place_lists_its_problems(otto: User) -> None:
    from code_schema import Link
    from code_schema.edits import set_links

    draft = drafts.open_existing("tpm", by=otto)
    tie = Link(node="kallisto", reason="Both quantify from TPM.")
    drafts.save(
        draft, based_on=1, edit=lambda n: set_links(n, "related", [tie]), by=otto, change="t"
    )
    Draft.objects.filter(pk=draft.pk).update(state=Draft.State.APPROVED)
    record(draft, DraftEvent.Kind.APPROVED, by=otto, revision=2, reason="r", self_approved=True)
    answer = signed_in(otto).post(
        BASE, {"drafts": [str(draft.public_id)]}, content_type="application/json"
    )
    assert (answer.status_code, answer.json()["code"]) == (422, "CA0305")
    assert "CS0502" in {problem["code"] for problem in answer.json()["problems"]}


def test_a_landing_reads_back_with_its_dropped_drafts(otto: User) -> None:
    made = landing.start([approved("salmon", otto).public_id], by=otto)
    landing.run(made, FakeGitHub(since={"base-1": {"transcriptomics/salmon/node.yaml"}}))
    body = signed_in(otto).get(f"{BASE}/{made.public_id}").json()
    assert body["state"] == "refused"
    entry = body["entries"][0]
    assert (entry["node_id"], entry["live"], entry["dropped_code"]) == ("salmon", False, "CA0306")
    assert signed_in(otto).get(BASE).json()[0]["public_id"] == str(made.public_id)
    assert signed_in(otto).get(f"{BASE}/{uuid.uuid4()}").json()["code"] == "CA0310"


def test_closing_answers_for_each_state(otto: User, monkeypatch: pytest.MonkeyPatch) -> None:
    fake = FakeGitHub()
    monkeypatch.setattr("code_api.studio.github.from_settings", lambda: fake)
    made = landing.run(landing.start([approved("salmon", otto).public_id], by=otto), fake)
    answer = signed_in(otto).post(f"{BASE}/{made.public_id}/close")
    assert (answer.status_code, answer.json()["code"]) == (409, "CA0309")
    fake.checks[made.pull_number or 0] = (("validate", "https://ci.test/1"),)
    landing.watch(made, fake)
    fake.fail_with, fake.fail_on = "GitHub answered 502: Bad Gateway.", "close_pull"
    answer = signed_in(otto).post(f"{BASE}/{made.public_id}/close")
    assert (answer.status_code, answer.json()["code"]) == (502, "CA0311")
    fake.fail_with = None
    answer = signed_in(otto).post(f"{BASE}/{made.public_id}/close")
    assert (answer.status_code, answer.json()["state"]) == (200, "closed")


def test_sending_back_a_draft_in_a_landing_is_ca0303(otto: User) -> None:
    draft = approved("salmon", otto)
    landing.start([draft.public_id], by=otto)
    answer = signed_in(otto).post(
        f"/api/studio/drafts/{draft.public_id}/send-back",
        {"reason": "not yet"},
        content_type="application/json",
    )
    assert (answer.status_code, answer.json()["code"]) == (409, "CA0303")
