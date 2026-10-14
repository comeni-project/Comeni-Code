"""A node's review keys (M4.9a spec, M4V.1). Needs Compose's Postgres for the TPM draft."""

from collections.abc import Callable
from pathlib import Path

import pytest

from code_api.accounts.models import User
from code_api.content.index import rebuild_index
from code_api.studio import drafts
from code_api.studio.keys import review_keys
from code_api.studio.models import Draft
from code_schema import Node, NumberAnswer, Try, TryQuestion
from code_schema.edits import insert_block

pytestmark = pytest.mark.django_db

FIXTURES = Path(__file__).resolve().parents[3] / "tests" / "fixtures" / "salmon"
EXAM = [
    "exam/tpm-sums-to",
    "exam/tpm-or-count",
    "exam/twice-as-long",
    "exam/tpm-of-a",
    "exam/tpm-steps",
    "exam/tpm-unit-name",
]


@pytest.fixture(autouse=True)
def _indexed() -> None:
    rebuild_index(FIXTURES)


def tpm(ada: User, ready: Callable[[User], Draft]) -> Node:
    node, problems = drafts.node_of(ready(ada))
    assert node is not None, problems
    return node


def test_tpms_keys_in_reading_order(ada: User, ready: Callable[[User], Draft]) -> None:
    node = tpm(ada, ready)
    keys = review_keys(node)
    assert [(k.key, k.kind) for k in keys] == [
        ("node", "node"),
        ("block/0", "text"),
        ("block/1", "callout"),
        ("block/2", "text"),
        ("resource/0", "resource"),
        *((key, "exam") for key in EXAM),
    ]
    assert keys[0].content is node
    assert keys[2].content == node.blocks[1]
    assert keys[4].content == node.resources[0]
    assert keys[5].content == node.exam[0]


def test_a_try_block_is_keyed_by_its_question_and_holds_it(
    ada: User, ready: Callable[[User], Draft]
) -> None:
    question = TryQuestion(
        id="count-kmers",
        ask="A read of 12 bases holds how many 5-mers?",
        answer=NumberAnswer(value=8),
        hints=("Slide the window one base at a time.",),
        rationale="12 − 5 + 1 = 8.",
    )
    node = insert_block(tpm(ada, ready), 1, Try(question="count-kmers"), question)
    keys = review_keys(node)
    assert [(k.key, k.kind) for k in keys[:5]] == [
        ("node", "node"),
        ("block/0", "text"),
        ("try/count-kmers", "try"),
        ("block/2", "callout"),
        ("block/3", "text"),
    ]
    assert keys[2].content == question
