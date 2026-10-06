"""Watching a landing's pull request, and closing a failed one (M4.6 spec, M4L.3–M4L.4)."""

from pathlib import Path
from typing import Any

import pytest
from fake_github import FakeGitHub

from code_api.accounts.models import User
from code_api.content.index import rebuild_index
from code_api.studio import drafts, landing, tasks
from code_api.studio.log import record
from code_api.studio.models import Draft, DraftEvent, Landing

pytestmark = pytest.mark.django_db

FIXTURES = Path(__file__).resolve().parents[3] / "tests" / "fixtures" / "salmon"


@pytest.fixture
def opened(
    otto: User, settings: Any, monkeypatch: pytest.MonkeyPatch
) -> tuple[Landing, FakeGitHub]:
    rebuild_index(FIXTURES, commit="base-1")
    settings.CODE_GITHUB_APP = object()
    monkeypatch.setattr("code_api.studio.tasks.land.delay", lambda public_id: None)
    draft = drafts.open_existing("salmon", by=otto)
    Draft.objects.filter(pk=draft.pk).update(state=Draft.State.APPROVED)
    record(draft, DraftEvent.Kind.APPROVED, by=otto, revision=1, reason="r", self_approved=True)
    fake = FakeGitHub()
    return landing.run(landing.start([draft.public_id], by=otto), fake), fake


def test_a_merged_pull_request_makes_the_landing_merged(opened: tuple[Landing, FakeGitHub]) -> None:
    made, fake = opened
    fake.merged.add(made.pull_number or 0)
    assert landing.watch(made, fake).state == "merged"
    assert made.entries.get().live is True  # held until M4.7 marks the draft landed


def test_a_failed_check_makes_it_failed_with_the_checks_link(
    opened: tuple[Landing, FakeGitHub],
) -> None:
    made, fake = opened
    fake.checks[made.pull_number or 0] = (("validate", "https://ci.test/run/9"),)
    watched = landing.watch(made, fake)
    assert watched.state == "failed"
    assert watched.reason == "validate failed: https://ci.test/run/9"
    assert watched.entries.get().live is True  # its pull request can still merge


def test_a_conflict_makes_it_failed(opened: tuple[Landing, FakeGitHub]) -> None:
    made, fake = opened
    fake.conflicts.add(made.pull_number or 0)
    assert landing.watch(made, fake).reason == "The pull request conflicts with main."


def test_a_failed_landing_that_goes_green_is_open_again(opened: tuple[Landing, FakeGitHub]) -> None:
    made, fake = opened
    fake.checks[made.pull_number or 0] = (("validate", "https://ci.test/run/9"),)
    landing.watch(made, fake)
    fake.checks.clear()
    again = landing.watch(made, fake)
    assert (again.state, again.reason) == ("open", "")


def test_closing_a_failed_landing_frees_its_drafts(opened: tuple[Landing, FakeGitHub]) -> None:
    made, fake = opened
    fake.checks[made.pull_number or 0] = (("validate", "https://ci.test/run/9"),)
    landing.watch(made, fake)
    closed = landing.close(made, fake)
    assert closed.state == "closed"
    assert fake.closed == {made.pull_number} and made.branch not in fake.branches
    assert not closed.entries.filter(live=True).exists()


def test_only_a_failed_landing_is_closed(opened: tuple[Landing, FakeGitHub]) -> None:
    made, fake = opened
    with pytest.raises(landing.NotFailed) as raised:
        landing.close(made, fake)
    assert raised.value.state == "open"


def test_a_pull_request_closed_on_github_closes_the_landing(
    opened: tuple[Landing, FakeGitHub],
) -> None:
    made, fake = opened
    fake.closed.add(made.pull_number or 0)
    watched = landing.watch(made, fake)
    assert watched.state == "closed"
    assert not watched.entries.filter(live=True).exists()


def test_the_beat_task_watches_open_and_failed_landings(
    opened: tuple[Landing, FakeGitHub], monkeypatch: pytest.MonkeyPatch
) -> None:
    made, fake = opened
    monkeypatch.setattr("code_api.studio.github.from_settings", lambda: fake)
    fake.merged.add(made.pull_number or 0)
    tasks.watch_landings()
    assert Landing.objects.get(pk=made.pk).state == "merged"


def test_the_landing_task_runs_a_pending_landing(
    otto: User, settings: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    rebuild_index(FIXTURES, commit="base-1")
    settings.CODE_GITHUB_APP = object()
    monkeypatch.setattr("code_api.studio.tasks.land.delay", lambda public_id: None)
    draft = drafts.open_existing("salmon", by=otto)
    Draft.objects.filter(pk=draft.pk).update(state=Draft.State.APPROVED)
    record(draft, DraftEvent.Kind.APPROVED, by=otto, revision=1, reason="r", self_approved=True)
    made = landing.start([draft.public_id], by=otto)
    fake = FakeGitHub()
    monkeypatch.setattr("code_api.studio.github.from_settings", lambda: fake)
    tasks.land(str(made.public_id))
    assert Landing.objects.get(pk=made.pk).state == "open"


def test_a_landing_without_auto_merge_stays_failed_when_checks_go_green(
    otto: User, settings: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    # #203: its pull request would sit open forever if the poller called it open again.
    rebuild_index(FIXTURES, commit="base-1")
    settings.CODE_GITHUB_APP = object()
    monkeypatch.setattr("code_api.studio.tasks.land.delay", lambda public_id: None)
    draft = drafts.open_existing("salmon", by=otto)
    Draft.objects.filter(pk=draft.pk).update(state=Draft.State.APPROVED)
    record(draft, DraftEvent.Kind.APPROVED, by=otto, revision=1, reason="r", self_approved=True)
    fake = FakeGitHub(fail_with="GitHub did not turn on auto-merge: off.", fail_on="auto_merge")
    made = landing.run(landing.start([draft.public_id], by=otto), fake)
    fake.fail_with = None
    watched = landing.watch(made, fake)
    assert (watched.state, watched.reason) == ("failed", "GitHub did not turn on auto-merge: off.")


def test_the_beat_task_runs_a_landing_lost_in_the_queue(
    opened: tuple[Landing, FakeGitHub], otto: User, monkeypatch: pytest.MonkeyPatch
) -> None:
    from datetime import timedelta

    from django.utils import timezone

    _, fake = opened
    draft = drafts.open_existing("tpm", by=otto)
    Draft.objects.filter(pk=draft.pk).update(state=Draft.State.APPROVED)
    record(draft, DraftEvent.Kind.APPROVED, by=otto, revision=1, reason="r", self_approved=True)
    lost = landing.start([draft.public_id], by=otto)
    Landing.objects.filter(pk=lost.pk).update(started_at=timezone.now() - timedelta(hours=1))
    monkeypatch.setattr("code_api.studio.github.from_settings", lambda: fake)
    tasks.watch_landings()
    assert Landing.objects.get(pk=lost.pk).state == "open"
