"""Drafts become landed once the live build contains their landing's merge (M4F.3)."""

import shutil
from pathlib import Path
from typing import Any

import pytest
from fake_github import FakeGitHub

from code_api.accounts.models import User
from code_api.content.index import rebuild_index
from code_api.studio import drafts, follow, landing
from code_api.studio.follow import GitHubSource
from code_api.studio.log import history, record
from code_api.studio.models import Draft, DraftEvent, Landing

pytestmark = pytest.mark.django_db

FIXTURES = Path(__file__).resolve().parents[3] / "tests" / "fixtures" / "salmon"


@pytest.fixture
def merged(
    otto: User, settings: Any, monkeypatch: pytest.MonkeyPatch
) -> tuple[Landing, FakeGitHub]:
    """salmon's draft, landed and merged as merge-1; main is c0, indexed."""
    queued: list[str] = []
    monkeypatch.setattr("code_api.studio.tasks.land.delay", lambda public_id: None)
    monkeypatch.setattr("code_api.studio.tasks.follow_main.delay", lambda: queued.append("follow"))
    settings.CODE_GITHUB_APP = object()
    fake = FakeGitHub(main="c0", trees={"c0": FIXTURES})
    follow.follow(GitHubSource(fake))
    draft = drafts.open_existing("salmon", by=otto)
    Draft.objects.filter(pk=draft.pk).update(state=Draft.State.APPROVED)
    record(draft, DraftEvent.Kind.APPROVED, by=otto, revision=1, reason="r", self_approved=True)
    made = landing.run(landing.start([draft.public_id], by=otto), fake)
    fake.merged.add(made.pull_number or 0)
    watched = landing.watch(made, fake)
    assert watched.merge_commit == "merge-1"
    return watched, fake


def test_a_merge_queues_a_follow(
    otto: User,
    settings: Any,
    monkeypatch: pytest.MonkeyPatch,
    django_capture_on_commit_callbacks: Any,
) -> None:
    queued: list[str] = []
    monkeypatch.setattr("code_api.studio.tasks.land.delay", lambda public_id: None)
    monkeypatch.setattr("code_api.studio.tasks.follow_main.delay", lambda: queued.append("follow"))
    settings.CODE_GITHUB_APP = object()
    rebuild_index(FIXTURES, commit="c0")
    draft = drafts.open_existing("salmon", by=otto)
    Draft.objects.filter(pk=draft.pk).update(state=Draft.State.APPROVED)
    record(draft, DraftEvent.Kind.APPROVED, by=otto, revision=1, reason="r", self_approved=True)
    fake = FakeGitHub()
    made = landing.run(landing.start([draft.public_id], by=otto), fake)
    fake.merged.add(made.pull_number or 0)
    with django_capture_on_commit_callbacks(execute=True):
        landing.watch(made, fake)
    assert queued == ["follow"]


def test_drafts_land_once_the_live_build_contains_the_merge(
    merged: tuple[Landing, FakeGitHub],
) -> None:
    made, fake = merged
    fake.main, fake.trees["c1"] = "c1", FIXTURES
    fake.ancestry.add(("merge-1", "c1"))
    done = follow.follow(GitHubSource(fake))
    assert done.landed == 1
    draft = Draft.objects.get(node_id="salmon", state="landed")
    assert history(draft)[-1].kind == "landed"
    assert not made.entries.filter(live=True).exists()
    assert drafts.open_existing("salmon", by=draft.created_by).state == "open"  # type: ignore[arg-type]


def test_a_refused_build_lands_nothing(merged: tuple[Landing, FakeGitHub], tmp_path: Path) -> None:
    made, fake = merged
    broken = tmp_path / "broken"
    shutil.copytree(FIXTURES, broken)
    shutil.rmtree(broken / "statistics" / "em-algorithm")
    fake.main, fake.trees["c1"] = "c1", broken
    fake.ancestry.add(("merge-1", "c1"))
    assert follow.follow(GitHubSource(fake)).landed == 0
    assert Draft.objects.get(node_id="salmon").state == "approved"
    assert made.entries.filter(live=True).count() == 1


def test_landing_is_safe_to_repeat(merged: tuple[Landing, FakeGitHub]) -> None:
    _, fake = merged
    fake.main, fake.trees["c1"] = "c1", FIXTURES
    fake.ancestry.add(("merge-1", "c1"))
    assert follow.follow(GitHubSource(fake)).landed == 1
    assert follow.follow(GitHubSource(fake)).landed == 0
    assert DraftEvent.objects.filter(kind="landed").count() == 1


def test_a_landing_merged_through_close_records_its_merge(
    otto: User, settings: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr("code_api.studio.tasks.land.delay", lambda public_id: None)
    monkeypatch.setattr("code_api.studio.tasks.follow_main.delay", lambda: None)
    settings.CODE_GITHUB_APP = object()
    rebuild_index(FIXTURES, commit="c0")
    draft = drafts.open_existing("salmon", by=otto)
    Draft.objects.filter(pk=draft.pk).update(state=Draft.State.APPROVED)
    record(draft, DraftEvent.Kind.APPROVED, by=otto, revision=1, reason="r", self_approved=True)
    fake = FakeGitHub()
    made = landing.run(landing.start([draft.public_id], by=otto), fake)
    fake.checks[made.pull_number or 0] = (("validate", "https://ci.test/1"),)
    landing.watch(made, fake)
    fake.checks.clear()
    fake.merged.add(made.pull_number or 0)
    with pytest.raises(landing.NotFailed):
        landing.close(Landing.objects.get(pk=made.pk), fake)
    assert Landing.objects.get(pk=made.pk).merge_commit == "merge-1"
