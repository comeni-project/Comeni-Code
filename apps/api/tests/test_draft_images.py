"""A draft's images (M6.3 spec, M6IM.3–M6IM.4): added, replaced, removed and served, each one save.
Needs Compose's Postgres."""

from pathlib import Path
from typing import Any

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client

from code_api.accounts.models import User
from code_api.content.index import rebuild_index
from code_api.studio import drafts
from code_api.studio.models import Asset, Draft

pytestmark = pytest.mark.django_db

FIXTURES = Path(__file__).resolve().parents[3] / "tests" / "fixtures" / "salmon"
PNG = b"\x89PNG\r\n\x1a\n" + b"\x01" * 64
PNG2 = b"\x89PNG\r\n\x1a\n" + b"\x02" * 64
SVG = b'<svg xmlns="http://www.w3.org/2000/svg"></svg>'
CREDIT = {
    "alt": "Paths that meet at a few knots.",
    "author": "Ada Lovelace",
    "source": "own work",
    "licence": "CC BY 4.0",
}


@pytest.fixture(autouse=True)
def _indexed() -> None:
    rebuild_index(FIXTURES)


@pytest.fixture
def client(ada: User) -> Client:
    client = Client()
    client.force_login(ada)
    return client


def opened(client: Client) -> str:
    answer = client.post("/api/studio/drafts", {"node_id": "tpm"}, content_type="application/json")
    assert answer.status_code == 201, answer.content
    return str(answer.json()["public_id"])


def add(
    client: Client, draft: str, data: bytes = PNG, name: str = "knots.png", **extra: Any
) -> Any:
    form = {
        "revision": 1,
        "file": name,
        "at": 0,
        "caption": "Where the paths meet.",
        **CREDIT,
        **extra,
        "upload": SimpleUploadedFile(name, data),
    }
    return client.post(f"/api/studio/drafts/{draft}/images", form)


def test_an_upload_adds_the_file_its_record_and_its_block(client: Client) -> None:
    draft = opened(client)
    answer = add(client, draft)
    assert answer.status_code == 200, answer.content
    node = answer.json()["draft"]["node"]
    assert node["blocks"][0] == {
        "kind": "image",
        "file": "knots.png",
        "caption": "Where the paths meet.\n",
    }
    assert node["images"] == [{"file": "knots.png", **CREDIT}]
    served = client.get(f"/api/studio/drafts/{draft}/images/knots.png")
    assert served.status_code == 200
    assert served["Content-Type"] == "image/png"
    assert served.content == PNG
    latest = drafts.latest(Draft.objects.get(public_id=draft))
    assert set(latest.images) == {"knots.png"}
    assert Asset.objects.get(sha256=latest.images["knots.png"]).size == len(PNG)


def test_an_svg_is_refused_with_its_code(client: Client) -> None:
    draft = opened(client)
    answer = add(client, draft, data=SVG)
    assert answer.status_code == 422
    assert "CS0913" in {problem["code"] for problem in answer.json()["problems"]}
    assert drafts.latest(Draft.objects.get(public_id=draft)).number == 1


def test_an_nc_licence_is_refused(client: Client) -> None:
    draft = opened(client)
    answer = add(client, draft, licence="CC BY-NC 4.0")
    assert answer.status_code == 422
    assert "CS0906" in {problem["code"] for problem in answer.json()["problems"]}


def test_a_replaced_file_is_a_new_revision_with_a_new_sha(client: Client) -> None:
    draft = opened(client)
    add(client, draft)
    before = drafts.latest(Draft.objects.get(public_id=draft)).images["knots.png"]
    answer = client.post(
        f"/api/studio/drafts/{draft}/images/knots.png/file",
        {"revision": 2, "upload": SimpleUploadedFile("knots.png", PNG2)},
    )
    assert answer.status_code == 200, answer.content
    latest = drafts.latest(Draft.objects.get(public_id=draft))
    assert (latest.number, latest.images["knots.png"] != before) == (3, True)
    assert client.get(f"/api/studio/drafts/{draft}/images/knots.png").content == PNG2


def test_a_record_is_edited_alone(client: Client) -> None:
    draft = opened(client)
    add(client, draft)
    answer = client.put(
        f"/api/studio/drafts/{draft}/images/knots.png",
        {"revision": 2, **CREDIT, "alt": "Grey paths meeting at three knots."},
        content_type="application/json",
    )
    assert answer.status_code == 200, answer.content
    assert (
        answer.json()["draft"]["node"]["images"][0]["alt"] == "Grey paths meeting at three knots."
    )


def test_removing_an_image_takes_its_block_record_and_file(client: Client) -> None:
    draft = opened(client)
    add(client, draft)
    answer = client.delete(f"/api/studio/drafts/{draft}/images/knots.png?revision=2")
    assert answer.status_code == 200, answer.content
    node = answer.json()["draft"]["node"]
    assert node["images"] == []
    assert all(block["kind"] != "image" for block in node["blocks"])
    assert drafts.latest(Draft.objects.get(public_id=draft)).images == {}


def test_an_image_is_a_review_key_and_a_new_file_changes_it(client: Client) -> None:
    from code_api.studio.keys import review_keys, same

    draft = opened(client)
    add(client, draft)
    row = Draft.objects.get(public_id=draft)

    def image_key() -> Any:
        node, _ = drafts.node_of(row)
        assert node is not None
        [key] = [k for k in review_keys(node, drafts.latest(row).images) if k.kind == "image"]
        return key

    before = image_key()
    assert before.content.record.licence == "CC BY 4.0"
    client.post(
        f"/api/studio/drafts/{draft}/images/knots.png/file",
        {"revision": 2, "upload": SimpleUploadedFile("knots.png", PNG2)},
    )
    assert not same(before, image_key())
