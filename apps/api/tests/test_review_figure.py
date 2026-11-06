"""A reviewer answers a figure question, graded by its computed selections (M6.6b spec, M6FA.3;
M4.5 spec, M4R.4). Needs Compose's Postgres."""

from collections.abc import Callable
from dataclasses import replace
from pathlib import Path

import pytest
from django.test import Client

from code_api.accounts.models import User
from code_api.content.index import rebuild_index
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
