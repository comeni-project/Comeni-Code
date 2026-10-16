"""Verify sees every live draft (M6.1 spec, M6LD.1–M6LD.2). Needs Compose's Postgres."""

from dataclasses import replace
from pathlib import Path

import pytest

from code_api.accounts.models import User
from code_api.content.index import rebuild_index
from code_api.studio import drafts
from code_api.studio.models import Draft
from code_schema import Level, Link, Problem
from code_schema.edits import set_links

pytestmark = pytest.mark.django_db

FIXTURES = Path(__file__).resolve().parents[3] / "tests" / "fixtures" / "salmon"


@pytest.fixture(autouse=True)
def _indexed() -> None:
    rebuild_index(FIXTURES)


def new(node_id: str, by: User) -> Draft:
    return drafts.open_new(
        node_id,
        title=node_id.replace("-", " ").capitalize(),
        claim=f"The claim of {node_id}.",
        region="transcriptomics",
        level=Level.FOUNDATIONS,
        minutes=10,
        by=by,
    )


def link(draft: Draft, kind: str, *targets: str, by: User) -> None:
    links = [Link(target, f"A reason to reach {target} for the test.") for target in targets]
    number = drafts.latest(draft).number
    drafts.save(
        draft,
        based_on=number,
        edit=lambda node: set_links(node, kind, links),
        by=by,
        change=f"links {kind}",
    )


def codes(problems: list[Problem]) -> list[str]:
    return [problem.code for problem in problems]


def test_a_link_to_a_live_draft_is_a_warning(ada: User) -> None:
    new("node-a", ada)
    b = new("node-b", ada)
    link(b, "needs", "node-a", by=ada)
    problems = drafts.verify(b)
    [warning] = [problem for problem in problems if problem.code == "CA0224"]
    assert warning.message == "needs node-a, a draft that has not landed"
    assert warning.file == "transcriptomics/node-b/node.yaml"
    assert warning.line is not None
    assert not warning.refuses
    assert not [problem for problem in problems if problem.refuses]


def test_a_goes_deeper_link_is_worded_with_a_space(ada: User) -> None:
    a = new("node-a", ada)
    drafts.save(  # goes deeper never points down: raise node-a above node-b
        a,
        based_on=1,
        edit=lambda node: replace(node, level=Level.ADVANCED),
        by=ada,
        change="level",
    )
    b = new("node-b", ada)
    link(b, "goes-deeper", "node-a", by=ada)
    messages = [p.message for p in drafts.verify(b) if p.code == "CA0224"]
    assert messages == ["goes deeper node-a, a draft that has not landed"]


def test_another_drafts_own_problem_does_not_show(ada: User) -> None:
    a = new("node-a", ada)
    link(a, "goes-deeper", "no-such-node", by=ada)
    b = new("node-b", ada)
    link(b, "needs", "node-a", by=ada)
    assert "CS0501" not in codes(drafts.verify(b))
    assert "CS0501" in codes(drafts.verify(a))


def test_a_problem_a_draft_causes_elsewhere_shows_on_it(ada: User) -> None:
    # salmon (indexed) lists kallisto as related; a draft of kallisto drops salmon, so salmon's
    # written half is now the one alone: CS0502, filed on salmon's file.
    kallisto = drafts.open_existing("kallisto", by=ada)
    link(kallisto, "related", by=ada)
    [problem] = [p for p in drafts.verify(kallisto) if p.code == "CS0502"]
    assert problem.file == "transcriptomics/salmon/node.yaml"


def test_a_cycle_of_two_drafts_shows_on_both(ada: User) -> None:
    a, b = new("node-a", ada), new("node-b", ada)
    link(a, "needs", "node-b", by=ada)
    link(b, "needs", "node-a", by=ada)
    assert "CS0504" in codes(drafts.verify(a))
    assert "CS0504" in codes(drafts.verify(b))


def test_a_discarded_draft_is_not_a_node(ada: User) -> None:
    a = new("node-a", ada)
    b = new("node-b", ada)
    link(b, "needs", "node-a", by=ada)
    drafts.discard(a, by=ada)
    found = drafts.verify(b)
    assert "CS0501" in codes(found)
    assert "CA0224" not in codes(found)


def test_a_live_draft_of_an_indexed_node_is_just_a_node(ada: User) -> None:
    drafts.open_existing("tpm", by=ada)
    b = new("node-b", ada)
    link(b, "needs", "tpm", by=ada)
    assert drafts.verify(b) == []


def test_a_draft_that_does_not_read_stays_out(ada: User) -> None:
    a = new("node-a", ada)
    b = new("node-b", ada)
    link(b, "needs", "node-a", by=ada)
    latest = drafts.latest(a)
    latest.node_yaml = "title: [\n"
    latest.save(update_fields=["node_yaml"])
    found = drafts.verify(b)
    assert "CS0501" in codes(found)


def test_the_checklist_passes_verify_with_a_warning(ada: User) -> None:
    new("node-a", ada)
    b = new("node-b", ada)
    link(b, "needs", "node-a", by=ada)
    [clean] = [item for item in drafts.checklist(b) if item.rule == "verifies clean"]
    assert clean.passed
