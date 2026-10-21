"""Figures land, are indexed and served (M6.4 spec, M6FG.5). Needs Compose's Postgres."""

import shutil
from pathlib import Path
from typing import Any

import pytest
from django.test import Client
from fake_github import FakeGitHub

from code_api.accounts.models import User
from code_api.content.index import rebuild_index
from code_api.content.models import NodeFigure
from code_api.content.snapshot import figures_from_index, node_from_index
from code_api.studio import drafts, landing
from code_api.studio.log import record
from code_api.studio.models import Draft, DraftEvent
from code_schema.edits import add_figure, set_figure

pytestmark = pytest.mark.django_db

FIXTURES = Path(__file__).resolve().parents[3] / "tests" / "fixtures" / "salmon"
DBG = FIXTURES / "algorithms" / "de-bruijn-graphs"
FIGURE = "algorithms/de-bruijn-graphs/figures/kmers-by-k.yaml"


@pytest.fixture(autouse=True)
def _indexed(settings: Any) -> None:
    rebuild_index(FIXTURES, commit="base-1")
    settings.CODE_GITHUB_APP = object()


def test_the_index_keeps_each_figure_with_its_text() -> None:
    rows = NodeFigure.objects.filter(node_id="de-bruijn-graphs").order_by("position")
    assert [row.stem for row in rows] == [
        "kmer-counts",
        "kmers-by-k",
        "primer-on-exon",
        "salmon-steps",
    ]
    track = rows.get(stem="primer-on-exon")
    assert track.text == (DBG / "figures" / "primer-on-exon.yaml").read_text()
    assert track.derived == {"lanes": [0, 0, 0, 1]}
    assert NodeFigure.objects.filter(node_id="tpm").count() == 1


def test_the_api_sends_a_nodes_figures_beside_its_blocks(client: Client) -> None:
    body = client.get("/api/nodes/de-bruijn-graphs").json()
    placed = [block["file"] for block in body["blocks"] if block["kind"] == "figure"]
    assert placed == ["kmer-counts", "kmers-by-k", "salmon-steps", "primer-on-exon"]
    figures = {figure["stem"]: figure for figure in body["figures"]}
    assert figures["primer-on-exon"]["derived"] == {"lanes": [0, 0, 0, 1]}
    assert figures["kmers-by-k"]["component"] == "chart"
    assert figures["kmers-by-k"]["data"]["encoding"]["x"] == {"field": "k", "type": "quantitative"}
    assert "text" not in figures["kmers-by-k"]  # learners get the data, not the file
    asked = next(q for q in body["questions"] if q["id"] == "kmers-per-read")
    assert asked["figure"] == "kmer-counts"


def test_node_without_figures_reads(client: Client) -> None:
    """Review Focus 4: a node with no figures reads and serves as before."""
    body = client.get("/api/nodes/salmon").json()
    assert body["figures"] == []
    assert all(question.get("figure") is None for question in body["questions"])


def test_a_landed_node_reads_back_with_its_figures_as_written() -> None:
    node = node_from_index("de-bruijn-graphs")
    assert node is not None
    texts = figures_from_index("de-bruijn-graphs")
    assert texts["salmon-steps.yaml"] == (DBG / "figures" / "salmon-steps.yaml").read_text()
    assert {figure.name: figure.text for figure in node.figures} == texts
    assert node.questions[0].figure == "kmer-counts"


def test_a_draft_opens_from_the_index_with_its_figures(ada: User) -> None:
    draft = drafts.open_existing("de-bruijn-graphs", by=ada)
    assert drafts.latest(draft).figures == figures_from_index("de-bruijn-graphs")
    node, problems = drafts.node_of(draft)
    assert [p for p in problems if p.refuses] == [] and node is not None


def _approved_with(ada: User, grace: User, text: str) -> Draft:
    draft = drafts.open_existing("de-bruijn-graphs", by=ada)
    drafts.save(
        draft,
        based_on=1,
        edit=lambda n: set_figure(n, "kmers-by-k", text),
        by=ada,
        change="the chart, retitled",
    )
    Draft.objects.filter(pk=draft.pk).update(state=Draft.State.APPROVED)
    record(draft, DraftEvent.Kind.APPROVED, by=grace, revision=2, answered=0, wrong=0)
    return draft


def test_a_changed_figure_lands_as_its_text_and_an_unchanged_one_is_not_written(
    otto: User, ada: User, grace: User, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr("code_api.studio.tasks.land.delay", lambda public_id: None)
    text = (FIXTURES / FIGURE).read_text().replace("title: distinct k-mers", "title: k-mers")
    draft = _approved_with(ada, grace, text)
    assert ("figures/kmers-by-k.yaml", "changed") in landing.changes(
        draft.revisions.get(number=1), drafts.latest(draft)
    )
    fake = FakeGitHub()
    landing.run(landing.start([draft.public_id], by=otto), fake)
    _, files, _ = fake.commits["commit-1"]
    assert files[FIGURE] == text
    assert "algorithms/de-bruijn-graphs/figures/salmon-steps.yaml" not in files


def test_the_index_follows_a_folder_with_figures(tmp_path: Path) -> None:
    root = tmp_path / "content"
    shutil.copytree(FIXTURES, root)
    (root / "algorithms" / "de-bruijn-graphs" / "figures" / "kmer-counts.yaml").write_text(
        (DBG / "figures" / "kmer-counts.yaml")
        .read_text()
        .replace("[3, 64, 41, 98]", "[3, 65, 41, 98]")
    )
    rebuild_index(root)
    row = NodeFigure.objects.get(node_id="de-bruijn-graphs", stem="kmer-counts")
    assert row.data["rows"][0] == [3, 65, 41, 98]


def test_an_added_figure_lands_as_its_file_and_the_index_serves_it(
    otto: User,
    ada: User,
    grace: User,
    client: Client,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Done when 4 (M6FG.7): an author's new flow lands as figures/flow.yaml, placed in body.md,
    and once the folder is indexed again the API serves it."""
    monkeypatch.setattr("code_api.studio.tasks.land.delay", lambda public_id: None)
    draft = drafts.open_existing("de-bruijn-graphs", by=ada)
    drafts.save(
        draft,
        based_on=1,
        edit=lambda n: add_figure(n, len(n.blocks), "flow", alt="A flow.", caption="Steps."),
        by=ada,
        change="a flow",
    )
    Draft.objects.filter(pk=draft.pk).update(state=Draft.State.APPROVED)
    record(draft, DraftEvent.Kind.APPROVED, by=grace, revision=2, answered=0, wrong=0)
    fake = FakeGitHub()
    landing.run(landing.start([draft.public_id], by=otto), fake)
    _, files, _ = fake.commits["commit-1"]
    written = files["algorithms/de-bruijn-graphs/figures/flow.yaml"]
    assert written == drafts.latest(draft).figures["flow.yaml"]
    body_md = files["algorithms/de-bruijn-graphs/body.md"]
    assert isinstance(body_md, str) and ":::{figure} flow\nSteps.\n:::" in body_md

    root = tmp_path / "content"
    shutil.copytree(FIXTURES, root)
    for path, content in files.items():
        if isinstance(content, str):
            (root / path).write_text(content)
        elif content is not None:
            (root / path).write_bytes(content)
    rebuild_index(root)
    body = client.get("/api/nodes/de-bruijn-graphs").json()
    assert body["blocks"][-1] == {"kind": "figure", "file": "flow", "caption": "Steps.\n"}
    assert {f["stem"]: f["component"] for f in body["figures"]}["flow"] == "flow"
