"""A reviewer answers a figure question, graded by its computed selections (M6.6b spec, M6FA.3;
M4.5 spec, M4R.4). Needs Compose's Postgres."""

from collections.abc import Callable
from dataclasses import replace
from pathlib import Path

import pytest
from django.test import Client

from code_api.accounts.models import User
from code_api.content.index import rebuild_index
from code_api.content.snapshot import node_from_index
from code_api.studio import drafts, review
from code_api.studio.models import Draft
from code_schema.blocks import Try
from code_schema.edits import insert_block
from code_schema.figures import read_figure
from code_schema.grading import NotAnAnswer
from code_schema.node import Node
from code_schema.questions import FigureAnswer, TryQuestion

pytestmark = pytest.mark.django_db

FIXTURES = Path(__file__).resolve().parents[3] / "tests" / "fixtures" / "salmon"
Ready = Callable[[User], Draft]
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


@pytest.fixture(autouse=True)
def _indexed() -> None:
    rebuild_index(FIXTURES)


def with_trace(node: Node) -> Node:
    figure, problems = read_figure("trace-path", TRACE, file="figures/trace-path.yaml")
    assert figure is not None, problems
    question = TryQuestion(
        id="trace-the-path",
        ask="Trace the path that spells ACGTTAG.",
        answer=FigureAnswer(figure="trace-path"),
        hints=("Each step adds one letter.",),
        rationale="ACG, then T, T, A and G.",
        figure="trace-path",
    )
    added = replace(node, figures=tuple(sorted((*node.figures, figure), key=lambda f: f.name)))
    return insert_block(added, 0, Try("trace-the-path"), question)


def submitted(ready: Ready, ada: User) -> Draft:
    draft = ready(ada)
    drafts.save(draft, based_on=2, edit=with_trace, by=ada, change="a trace")
    return review.submit(draft, revision=3, by=ada)


def test_a_figure_answer_is_graded_by_its_selections(ada: User, grace: User, ready: Ready) -> None:
    draft = submitted(ready, ada)
    assert review.answer(draft, "trace-the-path", PATH, by=grace).right is True
    assert review.answer(draft, "trace-the-path", ["ACG", "CGT", "GTC"], by=grace).right is False


def test_a_figure_answer_that_is_not_a_selection(ada: User, grace: User, ready: Ready) -> None:
    """Review Focus 4: a string or numbers are NotAnAnswer, and through the API a 422."""
    draft = submitted(ready, ada)
    for given in ("ACG", [1, 2]):
        with pytest.raises(NotAnAnswer):
            review.answer(draft, "trace-the-path", given, by=grace)
    client = Client()
    client.force_login(grace)
    answered = client.put(
        f"/api/studio/drafts/{draft.public_id}/review/answers/trace-the-path",
        {"given": "ACG"},
        content_type="application/json",
    )
    assert answered.status_code == 422, answered.content
    unknown = client.put(
        f"/api/studio/drafts/{draft.public_id}/review/answers/trace-the-path",
        {"given": ["AAA", "AAC"]},
        content_type="application/json",
    )
    assert unknown.status_code == 200 and unknown.json()["right"] is False


def test_the_review_sends_the_figure_and_once_answered_its_path(
    ada: User, grace: User, ready: Ready
) -> None:
    draft = submitted(ready, ada)
    client = Client()
    client.force_login(grace)
    answered = client.put(
        f"/api/studio/drafts/{draft.public_id}/review/answers/trace-the-path",
        {"given": PATH},
        content_type="application/json",
    ).json()
    assert (answered["kind"], answered["figure"], answered["right_selections"]) == (
        "figure",
        "trace-path",
        [PATH],
    )


def test_a_question_key_carries_its_option_figures() -> None:
    """A reviewer sees the figures an option is (M6FA.3), as a key shows a try's figure."""
    from code_api.studio.keys import review_keys
    from code_schema.questions import ChoiceAnswer, Option

    node = node_from_index("de-bruijn-graphs")
    assert node is not None
    asked = next(q for q in node.questions if q.id == "green-path")
    options = (
        Option(text="", right=True, figure="graph-artifacts"),
        Option(text="Neither drawing"),
    )
    changed = replace(asked, answer=ChoiceAnswer(options=options))
    node = replace(node, questions=tuple(changed if q is asked else q for q in node.questions))
    key = next(k for k in review_keys(node) if k.key == "try/green-path")
    assert [f.stem for f in key.figures] == ["kmer-path", "graph-artifacts"]


def test_the_review_does_not_send_a_figure_questions_key_before_it_is_answered(
    ada: User, grace: User, ready: Ready
) -> None:
    """#414: right_selections waits for the reviewer's answer, so the figure beside it does too."""
    draft = submitted(ready, ada)
    client = Client()
    client.force_login(grace)
    review_page = client.get(f"/api/studio/drafts/{draft.public_id}/review").json()
    item = next(i for i in review_page["items"] if i["key"] == "try/trace-the-path")
    (figure,) = item["figures"]
    assert figure["interact"] == {"task": "trace", "spells": "ACGTTAG"}
    assert "edges" in figure["derived"] and "answer" not in figure["derived"]
