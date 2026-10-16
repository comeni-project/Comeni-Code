"""What the team sees of the index (M4F.5). Needs Compose's Postgres."""

import shutil
from pathlib import Path
from typing import Any

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
        "follow_seconds": 300,
        "regions": [],
    }


def test_the_index_route_is_the_teams(client: Client) -> None:
    assert client.get("/api/studio/index").json()["code"] == "CA0101"


def test_the_index_route_lists_the_regions_in_order(ada: User) -> None:
    follow.follow(GitHubSource(FakeGitHub(main="c1", trees={"c1": FIXTURES})))
    regions = signed_in(ada).get("/api/studio/index").json()["regions"]
    assert len(regions) == 6
    assert set(regions[0]) == {"id", "name"}


def test_the_index_route_says_how_often_main_is_followed(ada: User, settings: Any) -> None:
    settings.FOLLOW_SECONDS = 300
    assert signed_in(ada).get("/api/studio/index").json()["follow_seconds"] == 300


def test_link_targets_list_nodes_and_drafts(ada: User) -> None:
    from code_api.content.index import rebuild_index
    from code_api.studio import drafts
    from code_schema import Level

    rebuild_index(FIXTURES)

    def opened(node_id: str) -> None:
        drafts.open_new(
            node_id,
            title=f"Title of {node_id}",
            claim=f"The claim of {node_id}.",
            region="transcriptomics",
            level=Level.FOUNDATIONS,
            minutes=10,
            by=ada,
        )

    opened("base")
    opened("gone")
    gone = drafts.live_drafts()["gone"]
    drafts.discard(gone, by=ada)
    drafts.open_existing("tpm", by=ada)  # a draft of an indexed node is listed once, as a node
    targets = signed_in(ada).get("/api/studio/index/nodes").json()
    assert [t["id"] for t in targets] == sorted(t["id"] for t in targets)
    assert len([t for t in targets if not t["draft"]]) == 26
    assert [t for t in targets if t["draft"]] == [
        {"id": "base", "title": "Title of base", "draft": True}
    ]
    assert {"id": "tpm", "title": "What TPM measures", "draft": False} in targets
