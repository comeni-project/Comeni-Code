"""The worker's steps (M4.6 spec, M4L.3–M4L.4), against a fake GitHub. Needs Compose's Postgres."""

from collections.abc import Callable
from datetime import timedelta
from pathlib import Path
from typing import Any

import pytest
from allauth.socialaccount.models import SocialAccount
from django.utils import timezone
from fake_github import FakeGitHub

from code_api.accounts.models import User
from code_api.content.index import rebuild_index
from code_api.content.models import IndexBuild
from code_api.studio import drafts, landing
from code_api.studio.log import history, record
from code_api.studio.models import Draft, DraftEvent, Landing
from code_schema.edits import set_fields

pytestmark = pytest.mark.django_db

FIXTURES = Path(__file__).resolve().parents[3] / "tests" / "fixtures" / "salmon"


@pytest.fixture(autouse=True)
def _indexed(settings: Any) -> None:
    rebuild_index(FIXTURES, commit="base-1")
    settings.CODE_GITHUB_APP = object()


@pytest.fixture
def queued(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("code_api.studio.tasks.land.delay", lambda public_id: None)


def approved(node_id: str, author: User, judge: User, *, reason: str = "") -> Draft:
    draft = drafts.open_existing(node_id, by=author)
    drafts.save(
        draft,
        based_on=1,
        edit=lambda n: set_fields(n, minutes=n.minutes + 1),
        by=author,
        change="a minute more",
    )
    Draft.objects.filter(pk=draft.pk).update(state=Draft.State.APPROVED)
    record(
        draft,
        DraftEvent.Kind.APPROVED,
        by=judge,
        revision=2,
        reason=reason,
        self_approved=author == judge,
        answered=4,
        wrong=1,
    )
    return Draft.objects.get(pk=draft.pk)


Ready = Callable[..., Landing]


@pytest.fixture
def batch(otto: User, ada: User, grace: User, queued: None) -> Ready:
    def make(*node_ids: str) -> Landing:
        made = [approved(node_id, ada, grace) for node_id in node_ids]
        return landing.start([draft.public_id for draft in made], by=otto)

    return make


def test_two_drafts_are_one_commit_one_branch_one_pull_request(batch: Ready) -> None:
    fake = FakeGitHub(files={"transcriptomics/tpm/exam.yaml": "x"})
    landed = landing.run(batch("tpm", "salmon"), fake)
    assert landed.state == "open"
    assert len(fake.commits) == 1
    parent, files, message = fake.commits["commit-1"]
    assert parent == "main-0" == landed.main_head
    assert message == "content: land 2 nodes (salmon, tpm)"
    assert set(files) == {
        "transcriptomics/salmon/node.yaml",
        "transcriptomics/salmon/body.md",
        "transcriptomics/tpm/node.yaml",
        "transcriptomics/tpm/body.md",
        "transcriptomics/tpm/exam.yaml",
    }
    tpm = Draft.objects.get(node_id="tpm", state="approved")
    assert files["transcriptomics/tpm/node.yaml"] == drafts.latest(tpm).node_yaml
    assert fake.branches == {landed.branch: "commit-1"}
    assert landed.branch.startswith("studio/landing-")
    assert list(fake.pulls) == [landed.pull_number] and fake.auto_merged == {1}
    assert landed.pull_url == "https://github.test/pull/1"
    assert [event.kind for event in history(tpm)][-1] == "landing"
    assert history(tpm)[-1].landing == landed
    assert tpm.state == "approved"  # M4.7 moves it on


def test_the_provenance_names_people_never_their_email(
    batch: Ready, ada: User, grace: User
) -> None:
    SocialAccount.objects.create(
        user=ada, provider="github", uid="1", extra_data={"login": "ada-l"}
    )
    grace.name = "Grace H."
    grace.save()
    fake = FakeGitHub()
    landing.run(batch("salmon"), fake)
    _, title, body = fake.pulls[1]
    assert title == "content: land 1 node (salmon)"
    assert "### salmon — Salmon (changed)" in body
    assert "Drafted by @ada-l" in body
    assert "Approved by Grace H., at revision 2" in body
    assert "4 questions answered, 1 wrong" in body
    assert "@example.org" not in body
    assert body.rstrip().endswith(
        f"<!-- comeni-studio landing {Landing.objects.get().public_id} -->"
    )


def test_a_self_approval_is_said_with_its_reason(otto: User, queued: None) -> None:
    draft = approved("salmon", otto, otto, reason="Alone on the team this week.")
    fake = FakeGitHub()
    landing.run(landing.start([draft.public_id], by=otto), fake)
    body = fake.pulls[1][2]
    assert "**Self-approved**: Alone on the team this week." in body


def test_a_draft_whose_node_changed_on_main_is_dropped_and_the_rest_land(batch: Ready) -> None:
    fake = FakeGitHub(since={"base-1": {"transcriptomics/tpm/body.md"}})
    landed = landing.run(batch("tpm", "salmon"), fake)
    assert landed.state == "open"
    dropped = landed.entries.get(draft__node_id="tpm")
    assert (dropped.live, dropped.dropped_code) == (False, "CA0306")
    assert "changed on main" in dropped.dropped_reason
    assert set(fake.commits["commit-1"][1]) == {
        "transcriptomics/salmon/node.yaml",
        "transcriptomics/salmon/body.md",
    }


def test_a_draft_without_a_starting_commit_is_dropped(batch: Ready) -> None:
    made = batch("tpm")
    IndexBuild.objects.update(commit="")  # as a local rebuild records it, before M4.7
    landed = landing.run(made, FakeGitHub())
    assert landed.state == "refused"
    assert landed.entries.get().dropped_code == "CA0308"
    assert "every draft was dropped" in landed.reason


def test_a_new_nodes_folder_that_exists_on_main_is_dropped(otto: User, queued: None) -> None:
    from code_schema import Level

    draft = drafts.open_new(
        "rpkm",
        title="RPKM",
        claim="RPKM normalises by length and depth.",
        region="transcriptomics",
        level=Level.INTRODUCTORY,
        minutes=5,
        by=otto,
    )
    Draft.objects.filter(pk=draft.pk).update(state=Draft.State.APPROVED)
    record(draft, DraftEvent.Kind.APPROVED, by=otto, revision=1, reason="r", self_approved=True)
    made = landing.start([draft.public_id], by=otto)
    fake = FakeGitHub(files={"transcriptomics/rpkm/node.yaml": "id: rpkm\n"})
    landed = landing.run(made, fake)
    assert landed.entries.get().dropped_code == "CA0307"
    assert landed.state == "refused"
    assert fake.commits == {}


def test_an_exam_pool_is_deleted_only_where_it_exists(batch: Ready) -> None:
    fake = FakeGitHub()  # salmon has no exam pool, and none on main
    landing.run(batch("salmon"), fake)
    assert "transcriptomics/salmon/exam.yaml" not in fake.commits["commit-1"][1]


def test_a_github_error_refuses_the_landing_in_words_and_frees_its_drafts(batch: Ready) -> None:
    made = batch("salmon")
    fake = FakeGitHub(fail_with="GitHub answered 422: Reference already exists.", fail_on="branch")
    landed = landing.run(made, fake)
    assert landed.state == "refused"
    assert landed.reason == "GitHub answered 422: Reference already exists."
    assert not landed.entries.filter(live=True).exists()


def test_a_landing_run_twice_runs_once(batch: Ready) -> None:
    made = batch("salmon")
    fake = FakeGitHub()
    landing.run(made, fake)
    landing.run(Landing.objects.get(pk=made.pk), fake)
    assert len(fake.commits) == 1 and len(fake.pulls) == 1


def test_auto_merge_refused_leaves_the_landing_failed_holding_its_drafts(batch: Ready) -> None:
    # Plan ruling: the pull request exists, so the landing is failed, not refused, until closed.
    made = batch("salmon")
    fake = FakeGitHub(fail_with="GitHub did not turn on auto-merge: off.", fail_on="auto_merge")
    landed = landing.run(made, fake)
    assert (landed.state, landed.reason) == ("failed", "GitHub did not turn on auto-merge: off.")
    assert landed.pull_number == 1 and list(fake.pulls) == [1]
    assert landed.entries.filter(live=True).count() == 1


# ── #203: every failure ends the landing, and leaves nothing behind it cannot close ─────────────


def test_a_crash_after_the_branch_deletes_it_and_refuses(batch: Ready) -> None:
    made = batch("salmon")
    fake = FakeGitHub(explode_on="open_pull")
    landed = landing.run(made, fake)
    assert landed.state == "refused"
    assert "RuntimeError" in landed.reason
    assert fake.branches == {}
    assert not landed.entries.filter(live=True).exists()


def test_a_pull_request_made_despite_an_error_leaves_the_landing_failed(batch: Ready) -> None:
    made = batch("salmon")
    fake = FakeGitHub(
        fail_with="GitHub did not answer within 10 seconds.", fail_on="open_pull", pull_anyway=True
    )
    landed = landing.run(made, fake)
    assert (landed.state, landed.pull_number) == ("failed", 1)
    assert landed.reason == "GitHub did not answer within 10 seconds."
    assert landed.entries.filter(live=True).count() == 1
    assert history(Draft.objects.get(node_id="salmon", state="approved"))[-1].kind == "landing"


def test_a_landing_claimed_moments_ago_is_left_to_its_worker(batch: Ready) -> None:
    made = batch("salmon")
    Landing.objects.filter(pk=made.pk).update(branch="studio/landing-x", claimed_at=timezone.now())
    fake = FakeGitHub()
    assert landing.run(Landing.objects.get(pk=made.pk), fake).state == "pending"
    assert fake.calls == []


def test_an_interrupted_landing_with_a_pull_request_is_failed(batch: Ready) -> None:
    made = batch("salmon")
    long_ago = timezone.now() - landing.STUCK_AFTER - timedelta(minutes=1)
    Landing.objects.filter(pk=made.pk).update(branch="studio/landing-x", claimed_at=long_ago)
    fake = FakeGitHub(branches={"studio/landing-x": "c"}, pulls={1: ("studio/landing-x", "t", "b")})
    landed = landing.run(Landing.objects.get(pk=made.pk), fake)
    assert (landed.state, landed.pull_number) == ("failed", 1)
    assert "stopped mid-landing" in landed.reason


def test_an_interrupted_landing_without_one_is_refused_and_its_branch_deleted(batch: Ready) -> None:
    made = batch("salmon")
    long_ago = timezone.now() - landing.STUCK_AFTER - timedelta(minutes=1)
    Landing.objects.filter(pk=made.pk).update(branch="studio/landing-x", claimed_at=long_ago)
    fake = FakeGitHub(branches={"studio/landing-x": "c"})
    landed = landing.run(Landing.objects.get(pk=made.pk), fake)
    assert landed.state == "refused"
    assert fake.branches == {}
    assert not landed.entries.filter(live=True).exists()


def test_a_worker_without_the_app_refuses_the_landing(
    batch: Ready, monkeypatch: pytest.MonkeyPatch
) -> None:
    from code_api.studio import tasks

    made = batch("salmon")
    monkeypatch.setattr("code_api.studio.github.from_settings", lambda: None)
    tasks.land(str(made.public_id))
    refused = Landing.objects.get(pk=made.pk)
    assert refused.state == "refused"
    assert "not configured on the worker" in refused.reason
