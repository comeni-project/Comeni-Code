"""What the team sees of the index (M4F.5). Needs Compose's Postgres."""

import shutil
from pathlib import Path

import pytest
from django.test import Client
from fake_github import FakeGitHub

from code_api.accounts.models import User
from code_api.studio import follow
from code_api.studio.follow import GitHubSource

pytestmark = pytest.mark.django_db

FIXTURES = Path(__file__).resolve().parents[3] / "tests" / "fixtures" / "salmon"


def signed_in(user: User) -> Client:
    client = Client()
    client.force_login(user)
    return client


def test_the_index_route_reports_the_live_build_and_main(ada: User) -> None:
    follow.follow(GitHubSource(FakeGitHub(main="c1", trees={"c1": FIXTURES})))
    body = signed_in(ada).get("/api/studio/index").json()
    assert body["live"]["commit"] == "c1" and body["live"]["node_count"] == 26
    assert (body["main_head"], body["behind"]) == ("c1", False)


def test_a_refused_head_shows_its_problems_and_behind(ada: User, tmp_path: Path) -> None:
    broken = tmp_path / "broken"
    shutil.copytree(FIXTURES, broken)
    shutil.rmtree(broken / "statistics" / "em-algorithm")
    fake = FakeGitHub(main="c1", trees={"c1": FIXTURES, "c2": broken})
    follow.follow(GitHubSource(fake))
    fake.main = "c2"
    follow.follow(GitHubSource(fake))
    body = signed_in(ada).get("/api/studio/index").json()
    assert body["live"]["commit"] == "c1"
    assert body["latest"]["outcome"] == "refused" and body["latest"]["problems"]
    assert (body["main_head"], body["behind"]) == ("c2", True)


def test_an_empty_index_answers_with_nothing(ada: User) -> None:
    body = signed_in(ada).get("/api/studio/index").json()
    assert body == {
        "live": None,
        "latest": None,
        "main_head": None,
        "checked_at": None,
        "behind": False,
    }


def test_the_index_route_is_the_teams(client: Client) -> None:
    assert client.get("/api/studio/index").json()["code"] == "CA0101"
