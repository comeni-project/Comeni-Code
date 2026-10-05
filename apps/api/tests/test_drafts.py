"""Drafts, revisions and the validated save (M4.4 spec, M4W.1, M4W.3). Needs Compose's Postgres.

The save is driven through `studio.drafts` with the pure edits; the edit routes are M4.4.5's.
"""

from pathlib import Path

import pytest
from django.test import Client

from code_api.accounts.models import User
from code_api.accounts.roles import Role
from code_api.content.index import rebuild_index
from code_api.content.models import IndexBuild
from code_api.studio import drafts
from code_api.studio.models import Draft, Revision
from code_schema import read_content
from code_schema.edits import set_fields

pytestmark = pytest.mark.django_db

FIXTURES = Path(__file__).resolve().parents[3] / "tests" / "fixtures" / "salmon"
TPM = FIXTURES / "transcriptomics" / "tpm"


@pytest.fixture(autouse=True)
def _indexed() -> None:
    rebuild_index(FIXTURES)


def member(role: Role = Role.AUTHOR, email: str = "ada@example.org") -> User:
    return User.objects.create_user(email, role=role)


def signed_in(client: Client, role: Role = Role.AUTHOR, email: str = "ada@example.org") -> User:
    user = member(role, email)
    client.force_login(user)
    return user


def test_a_draft_of_an_indexed_node_starts_as_its_files(client: Client) -> None:
    signed_in(client)
    response = client.post(
        "/api/studio/drafts", {"node_id": "tpm"}, content_type="application/json"
    )
    assert response.status_code == 201, response.content
    body = response.json()
    assert (body["node_id"], body["folder"], body["revision"]) == ("tpm", "transcriptomics/tpm", 1)
    assert body["base_digest"] == IndexBuild.objects.latest("created_at").digest
    files = client.get(f"/api/studio/drafts/{body['public_id']}/revisions/1").json()
    assert files["node_yaml"] == (TPM / "node.yaml").read_text(encoding="utf-8")
    assert files["body_md"] == (TPM / "body.md").read_text(encoding="utf-8")
    assert files["exam_yaml"] == (TPM / "exam.yaml").read_text(encoding="utf-8")


def test_a_draft_reads_as_the_node(client: Client) -> None:
    signed_in(client)
    opened = client.post("/api/studio/drafts", {"node_id": "tpm"}, content_type="application/json")
    body = client.get(f"/api/studio/drafts/{opened.json()['public_id']}").json()
    assert body["node"]["title"] == "What TPM measures"
    assert [question["id"] for question in body["node"]["exam"]] == [
        "tpm-sums-to",
        "tpm-or-count",
        "twice-as-long",
        "tpm-of-a",
    ]
    assert body["contributors"] == [
        {
            "public_id": body["contributors"][0]["public_id"],
            "email": "ada@example.org",
            "name": "",
            "role": "author",
        }
    ]


def test_one_open_draft_per_node(client: Client) -> None:
    signed_in(client)
    first = client.post("/api/studio/drafts", {"node_id": "tpm"}, content_type="application/json")
    second = client.post("/api/studio/drafts", {"node_id": "tpm"}, content_type="application/json")
    assert (second.status_code, second.json()["code"]) == (409, "CA0202")
    assert first.json()["public_id"] in second.json()["detail"]
    client.post(f"/api/studio/drafts/{first.json()['public_id']}/discard")
    again = client.post("/api/studio/drafts", {"node_id": "tpm"}, content_type="application/json")
    assert again.status_code == 201


def test_a_node_not_in_the_index_is_404(client: Client) -> None:
    signed_in(client)
    response = client.post(
        "/api/studio/drafts", {"node_id": "no-such-node"}, content_type="application/json"
    )
    assert (response.status_code, response.json()["code"]) == (404, "CA0204")


def test_a_new_node_opens_in_its_regions_folder(client: Client) -> None:
    signed_in(client)
    new = {
        "node_id": "effective-length",
        "new": {
            "title": "Effective length",
            "claim": "A transcript's effective length counts where a fragment can start.",
            "region": "transcriptomics",
            "level": "intermediate",
            "minutes": 8,
        },
    }
    response = client.post("/api/studio/drafts", new, content_type="application/json")
    assert response.status_code == 201, response.content
    assert (response.json()["folder"], response.json()["base_digest"]) == (
        "transcriptomics/effective-length",
        "",
    )


def test_a_new_node_with_an_indexed_id_is_409(client: Client) -> None:
    signed_in(client)
    new = {
        "node_id": "tpm",
        "new": {
            "title": "T",
            "claim": "A claim.",
            "region": "transcriptomics",
            "level": "intermediate",
            "minutes": 5,
        },
    }
    response = client.post("/api/studio/drafts", new, content_type="application/json")
    assert (response.status_code, response.json()["code"]) == (409, "CA0207")


def test_a_new_node_that_would_not_validate_is_422(client: Client) -> None:
    signed_in(client)
    new = {
        "node_id": "x-node",
        "new": {
            "title": "X",
            "claim": "A claim.",
            "region": "nowhere",
            "level": "intermediate",
            "minutes": 5,
        },
    }
    response = client.post("/api/studio/drafts", new, content_type="application/json")
    assert (response.status_code, response.json()["code"]) == (422, "CA0208")
    assert any("CS0" in problem["text"] for problem in response.json()["problems"])


def test_a_save_makes_the_next_revision() -> None:
    ada = member()
    draft = drafts.open_existing("tpm", by=ada)
    result = drafts.save(
        draft,
        based_on=1,
        edit=lambda node: set_fields(node, title="TPM, briefly"),
        by=ada,
        change="set the title",
    )
    assert (result.revision.number, result.revision.change, result.warnings) == (
        2,
        "set the title",
        [],
    )
    assert "title: TPM, briefly" in result.revision.node_yaml
    assert result.revision.saved_by == ada


def test_a_save_on_a_stale_revision_is_refused() -> None:
    ada, grace = member(), member(email="grace@example.org")
    draft = drafts.open_existing("tpm", by=ada)
    drafts.save(draft, based_on=1, edit=lambda n: set_fields(n, minutes=11), by=grace, change="m")
    with pytest.raises(drafts.Stale) as stale:
        drafts.save(draft, based_on=1, edit=lambda n: set_fields(n, minutes=12), by=ada, change="m")
    assert (stale.value.latest.number, stale.value.latest.saved_by) == (2, grace)


def test_a_save_that_makes_an_error_stores_nothing() -> None:
    ada = member()
    draft = drafts.open_existing("tpm", by=ada)
    with pytest.raises(drafts.Refused) as refused:
        drafts.save(
            draft,
            based_on=1,
            edit=lambda n: set_fields(n, region="nowhere"),
            by=ada,
            change="moved",
        )
    (problem,) = refused.value.problems
    assert (problem.file, problem.line, problem.field, problem.code) == (
        "transcriptomics/tpm/node.yaml",
        4,
        "region",
        "CS0016",
    )
    assert Revision.objects.filter(draft=draft).count() == 1


def test_a_save_with_only_a_warning_is_stored_with_it() -> None:
    from code_schema.edits import delete_exam_question

    ada = member()
    draft = drafts.open_existing("tpm", by=ada)
    result = drafts.save(
        draft,
        based_on=1,
        edit=lambda n: delete_exam_question(n, "tpm-of-a"),
        by=ada,
        change="dropped a question",
    )
    assert result.revision.number == 2
    assert [problem.code for problem in result.warnings] == ["CS0813"]


def test_contributors_are_everyone_who_saved() -> None:
    ada, grace = member(), member(email="grace@example.org")
    draft = drafts.open_existing("tpm", by=ada)
    drafts.save(draft, based_on=1, edit=lambda n: set_fields(n, minutes=11), by=grace, change="m")
    drafts.save(draft, based_on=2, edit=lambda n: set_fields(n, minutes=12), by=ada, change="m")
    assert drafts.contributors(draft) == [ada, grace]


def test_any_author_or_above_may_open_and_read(client: Client) -> None:
    signed_in(client, Role.REVIEWER)
    response = client.post(
        "/api/studio/drafts", {"node_id": "tpm"}, content_type="application/json"
    )
    assert response.status_code == 201
    assert Client().get("/api/studio/drafts").status_code == 401


def test_a_contributor_or_an_operator_may_discard(client: Client) -> None:
    ada = member()
    draft = drafts.open_existing("tpm", by=ada)
    signed_in(client, Role.AUTHOR, "outsider@example.org")
    refused = client.post(f"/api/studio/drafts/{draft.public_id}/discard")
    assert (refused.status_code, refused.json()["code"]) == (403, "CA0206")
    operator = Client()
    operator.force_login(member(Role.OPERATOR, "op@example.org"))
    assert operator.post(f"/api/studio/drafts/{draft.public_id}/discard").json()["state"] == (
        "discarded"
    )


def test_an_unknown_draft_is_404(client: Client) -> None:
    signed_in(client)
    response = client.get("/api/studio/drafts/00000000-0000-0000-0000-000000000000")
    assert (response.status_code, response.json()["code"]) == (404, "CA0201")


def test_open_drafts_are_listed(client: Client) -> None:
    signed_in(client)
    client.post("/api/studio/drafts", {"node_id": "tpm"}, content_type="application/json")
    client.post("/api/studio/drafts", {"node_id": "salmon"}, content_type="application/json")
    assert sorted(d["node_id"] for d in client.get("/api/studio/drafts").json()) == [
        "salmon",
        "tpm",
    ]


def test_revisions_are_listed_with_who_saved_them() -> None:
    ada = member()
    draft = drafts.open_existing("tpm", by=ada)
    drafts.save(draft, based_on=1, edit=lambda n: set_fields(n, minutes=11), by=ada, change="m")
    client = Client()
    client.force_login(ada)
    listed = client.get(f"/api/studio/drafts/{draft.public_id}/revisions").json()
    assert [(r["number"], r["change"], r["saved_by"]["email"]) for r in listed] == [
        (1, "opened from the index", "ada@example.org"),
        (2, "m", "ada@example.org"),
    ]


def test_the_database_holds_one_open_draft_per_node() -> None:
    from django.db import IntegrityError, transaction

    ada = member()
    Draft.objects.create(node_id="tpm", folder="transcriptomics/tpm", created_by=ada)
    with pytest.raises(IntegrityError), transaction.atomic():
        Draft.objects.create(node_id="tpm", folder="transcriptomics/tpm", created_by=ada)


def test_a_draft_of_every_fixture_node_opens(client: Client) -> None:
    # The read model is lossless (M4.4.1), so every fixture opens clean, with no problems.
    ada = member()
    for node_id in read_content(FIXTURES).nodes:
        draft = drafts.open_existing(node_id, by=ada)
        assert drafts.latest(draft).number == 1


def test_an_unknown_revision_is_404(client: Client) -> None:
    signed_in(client)
    opened = client.post("/api/studio/drafts", {"node_id": "tpm"}, content_type="application/json")
    response = client.get(f"/api/studio/drafts/{opened.json()['public_id']}/revisions/7")
    assert (response.status_code, response.json()["code"]) == (404, "CA0209")
