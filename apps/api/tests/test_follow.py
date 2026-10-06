"""The index follows main (M4.7 spec, M4F.1–M4F.2). Needs Compose's Postgres."""

import shutil
import tempfile
from pathlib import Path
from typing import Any

import pytest
from django.core.cache import cache
from fake_github import FakeGitHub

from code_api.content.models import IndexBuild, Node
from code_api.studio import follow
from code_api.studio.follow import FolderSource, GitHubSource

pytestmark = pytest.mark.django_db

FIXTURES = Path(__file__).resolve().parents[3] / "tests" / "fixtures" / "salmon"


@pytest.fixture
def broken(tmp_path: Path) -> Path:
    copy = tmp_path / "broken"
    shutil.copytree(FIXTURES, copy)
    shutil.rmtree(copy / "statistics" / "em-algorithm")  # a needed node goes: refused
    return copy


def applied() -> list[str]:
    return list(
        IndexBuild.objects.filter(outcome="applied").order_by("id").values_list("commit", flat=True)
    )


def test_a_new_commit_on_main_is_indexed_with_its_commit() -> None:
    fake = FakeGitHub(main="c1", trees={"c1": FIXTURES})
    done = follow.follow(GitHubSource(fake))
    assert done.build is not None and done.build.commit == "c1"
    assert Node.objects.count() == 26
    assert cache.get(follow.MAIN_KEY)["head"] == "c1"


def test_following_the_same_head_again_builds_nothing() -> None:
    fake = FakeGitHub(main="c1", trees={"c1": FIXTURES})
    follow.follow(GitHubSource(fake))
    again = follow.follow(GitHubSource(fake))
    assert again.build is None and applied() == ["c1"]
    assert fake.calls.count("tarball") == 1


def test_a_refused_commit_leaves_the_old_index_and_is_not_retried(broken: Path) -> None:
    fake = FakeGitHub(main="c1", trees={"c1": FIXTURES, "c2": broken})
    follow.follow(GitHubSource(fake))
    fake.main = "c2"
    refused = follow.follow(GitHubSource(fake)).build
    assert refused is not None and refused.outcome == "refused"
    assert applied() == ["c1"] and Node.objects.count() == 26
    follow.follow(GitHubSource(fake))
    assert fake.calls.count("tarball") == 2  # c2 is not fetched again
    fake.main, fake.trees["c3"] = "c3", FIXTURES
    assert follow.follow(GitHubSource(fake)).build.commit == "c3"  # type: ignore[union-attr]


def test_a_build_from_another_folder_is_put_back_to_main(tmp_path: Path) -> None:
    fake = FakeGitHub(main="c1", trees={"c1": FIXTURES})
    follow.follow(GitHubSource(fake))
    follow.follow(FolderSource(FIXTURES))  # a stray manual rebuild: no commit
    assert applied() == ["c1", ""]
    back = follow.follow(GitHubSource(fake)).build
    assert back is not None and back.commit == "c1"


def test_a_folder_source_builds_every_round() -> None:
    follow.follow(FolderSource(FIXTURES))
    follow.follow(FolderSource(FIXTURES))
    assert applied() == ["", ""]


def test_a_github_error_mid_build_keeps_the_index_and_leaves_no_folder(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    from code_api.studio.github import GitHubError

    fake = FakeGitHub(main="c1", trees={"c1": FIXTURES})
    follow.follow(GitHubSource(fake))
    fake.main, fake.fail_with, fake.fail_on = "c2", "GitHub answered 502: Bad Gateway.", "tarball"
    monkeypatch.setattr(tempfile, "tempdir", str(tmp_path))
    with pytest.raises(GitHubError):
        follow.follow(GitHubSource(fake))
    assert applied() == ["c1"] and list(tmp_path.iterdir()) == []


def test_the_configured_source_follows_the_settings(settings: Any, tmp_path: Path) -> None:
    settings.CODE_GITHUB_APP, settings.CODE_CONTENT_ROOT = None, None
    assert follow.configured_source() is None
    settings.CODE_CONTENT_ROOT = FIXTURES
    assert isinstance(follow.configured_source(), FolderSource)
    from code_api.config.landing import GitHubApp

    settings.CODE_GITHUB_APP = GitHubApp("1", "2", "k", "o/r", "http://127.0.0.1:9")
    assert isinstance(follow.configured_source(), GitHubSource)
