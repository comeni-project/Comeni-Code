"""Migrations carry an existing index forward (M4.1.2 final review)."""

import pytest
from django.db import connection
from django.db.migrations.executor import MigrationExecutor

BODY = "Lead.\n\n{% try kmers-per-read %}\n\nAfter.\n"


@pytest.mark.django_db(transaction=True)
def test_rows_indexed_before_blocks_get_their_blocks() -> None:
    executor = MigrationExecutor(connection)
    before = [("content", "0003_resource_video")]
    executor.migrate(before)
    old = executor.loader.project_state(before).apps
    region = old.get_model("content", "Region").objects.create(
        id="algorithms", name="Algorithms", position=0
    )
    old.get_model("content", "Node").objects.create(
        id="de-bruijn-graphs",
        title="de Bruijn graphs",
        claim="A claim.",
        region=region,
        level="intermediate",
        minutes=17,
        body=BODY,
        folder="algorithms/de-bruijn-graphs",
    )
    after = [("content", "0004_node_blocks")]
    executor = MigrationExecutor(connection)
    executor.migrate(after)
    new = executor.loader.project_state(after).apps
    assert new.get_model("content", "Node").objects.get(id="de-bruijn-graphs").blocks == [
        {"kind": "text", "markdown": "Lead.\n\n"},
        {"kind": "try", "question": "kmers-per-read"},
        {"kind": "text", "markdown": "\nAfter.\n"},
    ]
    executor.loader.build_graph()
    executor.migrate(executor.loader.graph.leaf_nodes())


@pytest.mark.django_db(transaction=True)
def test_the_index_keeps_no_body_column() -> None:
    # M4.1.3 (spec M4R.4): blocks are the body in the index; the raw body was written, never read.
    with connection.cursor() as cursor:
        columns = connection.introspection.get_table_description(cursor, "content_node")
    assert "body" not in [column.name for column in columns]


@pytest.mark.django_db(transaction=True)
def test_answers_keep_their_values_as_text() -> None:
    # M4.4 (spec M4W.2, #173): answers and tolerances become text, their values kept.
    executor = MigrationExecutor(connection)
    before = [("content", "0006_exam_question")]
    executor.migrate(before)
    old = executor.loader.project_state(before).apps
    region = old.get_model("content", "Region").objects.create(id="r", name="R", position=0)
    node = old.get_model("content", "Node").objects.create(
        id="n",
        title="N",
        claim="A claim.",
        region=region,
        level="intermediate",
        minutes=5,
        folder="r/n",
    )
    old.get_model("content", "Question").objects.create(
        node=node,
        position=0,
        question_id="q",
        kind="number",
        ask="How many?",
        answer=96.0,
        tolerance=0.5,
        rationale="Because.",
    )
    after = [("content", "0007_read_model")]
    executor = MigrationExecutor(connection)
    executor.migrate(after)
    new = executor.loader.project_state(after).apps
    question = new.get_model("content", "Question").objects.get(question_id="q")
    assert (question.answer, question.tolerance) == ("96", "0.5")
    executor.loader.build_graph()
    executor.migrate(executor.loader.graph.leaf_nodes())
