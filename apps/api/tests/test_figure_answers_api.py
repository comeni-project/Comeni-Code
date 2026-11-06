"""Figure answers and figure options through the index, the node API and a draft (M6.6b spec,
M6FA.1, M6FA.3). Needs Compose's Postgres."""

import shutil
from pathlib import Path
from typing import Any

import pytest
from django.test import Client

from code_api.accounts.models import User
from code_api.content.index import rebuild_index
from code_api.content.snapshot import node_from_index
from code_api.studio import drafts

pytestmark = pytest.mark.django_db

FIXTURES = Path(__file__).resolve().parents[3] / "tests" / "fixtures" / "salmon"
DBG = "algorithms/de-bruijn-graphs"
PATH = ["ACG", "CGT", "GTT", "TTA", "TAG"]
TRACE = """component: kmer-graph
alt: A de Bruijn graph of six 3-mers from four reads; one path spells ACGTTAG.
data:
  reads:
    - {sequence: ACGTT}
    - {sequence: CGTTA}
    - {sequence: GTTAG}
    - {sequence: CGTC}
  k: 3
  highlight: none
interact: {task: trace, spells: ACGTTAG}
"""
TRY = """  - id: trace-the-path
    kind: figure
    ask: Trace the path that spells ACGTTAG.
    figure: trace-path
    hints:
      - Each step adds one letter.
    rationale: ACG, then T, T, A and G.
"""


def with_trace(tmp_path: Path) -> Path:
    """The Salmon fixtures, the de Bruijn page holding a trace try after green-path."""
    root = tmp_path / "salmon"
    shutil.copytree(FIXTURES, root)
    folder = root / DBG
    (folder / "figures" / "trace-path.yaml").write_text(TRACE, encoding="utf-8")
    node = (folder / "node.yaml").read_text(encoding="utf-8")
    at = node.index("  - id: assembly-order")
    (folder / "node.yaml").write_text(node[:at] + TRY + node[at:], encoding="utf-8")
    body = (folder / "body.md").read_text(encoding="utf-8")
    body = body.replace(
        ":::{try} green-path\n:::\n", ":::{try} green-path\n:::\n\n:::{try} trace-the-path\n:::\n"
    )
    (folder / "body.md").write_text(body, encoding="utf-8")
    return root


@pytest.fixture
def client(ada: User) -> Client:
    client = Client()
    client.force_login(ada)
    return client


def test_the_node_api_sends_the_task_and_its_answer(tmp_path: Path) -> None:
    build = rebuild_index(with_trace(tmp_path))
    assert build.outcome == "applied", build.problems
    page = Client().get("/api/nodes/de-bruijn-graphs").json()
    figure = next(f for f in page["figures"] if f["stem"] == "trace-path")
    assert figure["interact"] == {"task": "trace", "spells": "ACGTTAG"}
    assert figure["derived"]["answer"]["accept"] == [PATH]
    question = next(q for q in page["questions"] if q["id"] == "trace-the-path")
    assert (question["kind"], question["figure"], question["options"]) == (
        "figure",
        "trace-path",
        None,
    )


def test_the_index_gives_the_node_back_with_its_answers(tmp_path: Path) -> None:
    rebuild_index(with_trace(tmp_path))
    node = node_from_index("de-bruijn-graphs")
    assert node is not None
    answer = next(q for q in node.questions if q.id == "trace-the-path").answer
    assert getattr(answer, "accept", None) == (tuple(PATH),)


def test_figure_options_reach_the_page(tmp_path: Path) -> None:
    root = with_trace(tmp_path)
    folder = root / DBG
    plain = TRACE.replace("interact: {task: trace, spells: ACGTTAG}\n", "")
    (folder / "figures" / "plain-a.yaml").write_text(plain, encoding="utf-8")
    (folder / "figures" / "plain-b.yaml").write_text(
        plain.replace("CGTC", "CGTA"), encoding="utf-8"
    )
    node = (folder / "node.yaml").read_text(encoding="utf-8")
    options = (
        "  - id: which-graph\n    kind: choice\n    ask: Which graph branches at CGT?\n"
        "    options:\n      - {figure: plain-a, right: true}\n      - {figure: plain-b}\n"
        "    hints:\n      - Look for two ways out.\n    rationale: Only one branches.\n"
    )
    (folder / "node.yaml").write_text(
        node + options if node.endswith("\n") else node, encoding="utf-8"
    )
    body = (folder / "body.md").read_text(encoding="utf-8")
    (folder / "body.md").write_text(body + "\n:::{try} which-graph\n:::\n", encoding="utf-8")
    build = rebuild_index(root)
    assert build.outcome == "applied", build.problems
    page = Client().get("/api/nodes/de-bruijn-graphs").json()
    question = next(q for q in page["questions"] if q["id"] == "which-graph")
    assert question["options"] == [
        {"text": "", "right": True, "figure": "plain-a"},
        {"text": "", "right": False, "figure": "plain-b"},
    ]


def save_question(client: Client, draft: str, question: dict[str, Any], revision: int) -> Any:
    """Replace the trace try's block with `question`, through the content API."""
    page = client.get(f"/api/studio/drafts/{draft}").json()
    at = next(
        i for i, b in enumerate(page["node"]["blocks"]) if b.get("question") == "trace-the-path"
    )
    return client.put(
        f"/api/studio/drafts/{draft}/blocks/{at}",
        {
            "revision": revision,
            "block": {"kind": "try", "question": question["id"]},
            "question": question,
        },
        content_type="application/json",
    )


def test_a_draft_saves_a_figure_question(client: Client, ada: User, tmp_path: Path) -> None:
    rebuild_index(with_trace(tmp_path))
    draft = drafts.open_existing("de-bruijn-graphs", by=ada)
    question = {
        "id": "trace-the-path",
        "kind": "figure",
        "ask": "Trace the path that spells ACGTTAG, k-mer by k-mer.",
        "figure": "trace-path",
        "hints": ["Each step adds one letter."],
        "rationale": "ACG, then T, T, A and G.",
    }
    saved = save_question(client, str(draft.public_id), question, revision=1)
    assert saved.status_code == 200, saved.content
    got = client.get(f"/api/studio/drafts/{draft.public_id}").json()
    asked = next(q for q in got["node"]["questions"] if q["id"] == "trace-the-path")
    assert (asked["kind"], asked["figure"], asked["ask"]) == (
        "figure",
        "trace-path",
        question["ask"],
    )
    figure = next(f for f in got["node"]["figures"] if f["stem"] == "trace-path")
    assert figure["derived"]["answer"]["accept"] == [PATH]


def test_a_draft_saves_figure_options(client: Client, ada: User, tmp_path: Path) -> None:
    rebuild_index(with_trace(tmp_path))
    draft = drafts.open_existing("de-bruijn-graphs", by=ada)
    question = {
        "id": "trace-the-path",
        "kind": "choice",
        "ask": "Which drawing is the reads' own graph?",
        "options": [{"figure": "kmer-path", "right": True}, {"text": "Neither drawing"}],
        "hints": ["Look for two ways out."],
        "rationale": "Only one branches.",
    }
    saved = save_question(client, str(draft.public_id), question, revision=1)
    assert saved.status_code == 200, saved.content
    got = client.get(f"/api/studio/drafts/{draft.public_id}").json()
    asked = next(q for q in got["node"]["questions"] if q["id"] == "trace-the-path")
    assert [(o["text"], o["figure"], o["right"]) for o in asked["options"]] == [
        ("", "kmer-path", True),
        ("Neither drawing", None, False),
    ]


def test_a_figure_is_made_for_a_question(client: Client, ada: User) -> None:
    """M6FA.7: the composer's New figure for a question adds the file and answers it, no block."""
    rebuild_index(FIXTURES)
    draft = drafts.open_existing("de-bruijn-graphs", by=ada)
    added = client.post(
        f"/api/studio/drafts/{draft.public_id}/figures",
        {"revision": 1, "text": TRACE, "question": "spell-the-path"},
        content_type="application/json",
    )
    assert added.status_code == 200, added.content
    node = added.json()["draft"]["node"]
    asked = next(q for q in node["questions"] if q["id"] == "spell-the-path")
    assert (asked["kind"], asked["figure"]) == ("figure", "kmer-graph")
    assert not any(b.get("file") == "kmer-graph" for b in node["blocks"])
