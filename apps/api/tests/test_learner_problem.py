"""The learner's problem (M6.8a spec, M6LP.2–M6LP.4): what the node's page is sent, its version,
a seed's dataset and the answer checked by the kit. Needs Compose's Postgres."""

from dataclasses import replace
from pathlib import Path
from typing import Any

import pytest
from code_problems import KITS, Case, Dataset, registry
from django.test import Client

from code_api.content import problems
from code_api.content.index import rebuild_index
from code_schema import read_content

pytestmark = pytest.mark.django_db

FIXTURES = Path(__file__).resolve().parents[3] / "tests" / "fixtures" / "salmon"
NODE = "de-bruijn-graphs"
FOLDER = FIXTURES / "algorithms" / NODE


@pytest.fixture
def page() -> dict[str, Any]:
    rebuild_index(FIXTURES)
    body: dict[str, Any] = Client().get(f"/api/nodes/{NODE}").json()
    return body


def test_the_de_bruijn_page_sends_its_problem(page: dict[str, Any]) -> None:
    problem = page["problem"]
    assert problem["title"] == "Construct a de Bruijn graph"
    assert problem["rung"] == 3
    assert problem["kit"] == "de-bruijn-edges"
    assert problem["hints"] == [
        "The same k-mer can come from many reads.",
        "Each read adds one edge for every pair of k-mers next to each other in it.",
    ]
    assert problem["callouts"] == ["Every edge appears once"]
    assert problem["size"] == 2482
    assert problem["given"] == "k on the first line, then the reads, one per line"
    assert problem["returns"].startswith('edges as "A -> B"')
    assert problem["sample_dataset"].startswith("3\n")
    version = problem["version"]
    assert len(version) == 12 and all(ch in "0123456789abcdef" for ch in version)
    for secret in ("text", "params", "mistakes", "rationale", "answer"):
        assert secret not in problem


def test_the_block_is_in_its_place(page: dict[str, Any]) -> None:
    blocks = read_content(FIXTURES).nodes[NODE].blocks
    at = next(i for i, block in enumerate(blocks) if type(block).__name__ == "ProblemBlock")
    assert page["blocks"][at] == {"kind": "problem"}


def test_a_node_without_a_problem_sends_null() -> None:
    rebuild_index(FIXTURES)
    page = Client().get("/api/nodes/salmon").json()
    assert page["problem"] is None
    assert all(block["kind"] != "problem" for block in page["blocks"])


def test_version_follows_the_kit(page: dict[str, Any], monkeypatch: pytest.MonkeyPatch) -> None:
    """A deploy that changes a kit's generate changes the version (M6LP.2)."""
    before = page["problem"]["version"]
    kit = KITS["de-bruijn-edges"]
    original = kit.generate

    def shifted(params: Any, rng: Any) -> Any:
        made = original(params, rng)
        return type(made)(made.text + "ACGTACGT\n", made.name, made.size + 1)

    monkeypatch.setitem(registry.KITS, kit.name, replace(kit, generate=shifted))
    problems.forget()
    after = Client().get(f"/api/nodes/{NODE}").json()["problem"]["version"]
    assert after != before


ANSWER_LIMIT = 1_000_000


def download(client: Client, version: str, seed: str = "42", node: str = NODE) -> Any:
    return client.get(f"/api/nodes/{node}/problem/dataset", {"seed": seed, "version": version})


def send(client: Client, version: str, answer: str, seed: str = "42", node: str = NODE) -> Any:
    return client.post(
        f"/api/nodes/{node}/problem/answer",
        {"seed": seed, "version": version, "answer": answer},
        content_type="application/json",
    )


def solved(text: str) -> str:
    kit = KITS["de-bruijn-edges"]
    return kit.solve(Case({}, Dataset(text, "", 0), ""))


def test_one_seed_one_file(page: dict[str, Any]) -> None:
    client, version = Client(), page["problem"]["version"]
    first, second = download(client, version), download(client, version)
    assert first.status_code == 200
    assert first.content == second.content
    assert first["Content-Type"] == "text/plain; charset=utf-8"
    assert first["Content-Disposition"] == 'attachment; filename="de-bruijn-edges-42.txt"'
    assert first["Cache-Control"] == "private, max-age=86400"
    assert first.content.decode().startswith("4\n")


def test_two_seeds_two_files(page: dict[str, Any]) -> None:
    version = page["problem"]["version"]
    assert download(Client(), version, "1").content != download(Client(), version, "2").content


def test_the_solvers_answer_is_right(page: dict[str, Any]) -> None:
    version = page["problem"]["version"]
    answer = solved(download(Client(), version).content.decode())
    for given in (answer, answer.replace("\n", "\r\n") + "\r\n", "﻿" + answer):
        verdict = send(Client(), version, given)
        assert verdict.status_code == 200, verdict.content
        assert verdict.json() == {
            "right": True,
            "said": verdict.json()["said"],
            "callouts": [],
            "rationale": (
                "Each read adds the edges between its consecutive k-mers, "
                "and the graph keeps each edge once, sorted."
            ),
        }


def test_a_duplicated_edge_names_its_callout(page: dict[str, Any]) -> None:
    version = page["problem"]["version"]
    answer = solved(download(Client(), version).content.decode())
    lines = answer.splitlines()
    wrong = "\n".join(sorted([*lines, lines[0]]))
    verdict = send(Client(), version, wrong)
    body = verdict.json()
    assert (body["right"], body["callouts"], body["rationale"]) == (
        False,
        ["Every edge appears once"],
        None,
    )
    assert lines[1] not in verdict.content.decode()


def test_a_missing_edge_gives_the_sentence_alone(page: dict[str, Any]) -> None:
    version = page["problem"]["version"]
    answer = solved(download(Client(), version).content.decode())
    body = send(Client(), version, "\n".join(answer.splitlines()[1:])).json()
    assert (body["right"], body["callouts"], body["rationale"]) == (False, [], None)
    assert body["said"] != ""


@pytest.mark.parametrize(
    "given",
    ["\x00\xff", "12²", "A" * 900_000, "", "   "],
    ids=["bytes", "squared", "long", "empty", "blank"],
)
def test_garbage_is_a_sentence(page: dict[str, Any], given: str) -> None:
    verdict = send(Client(), page["problem"]["version"], given)
    assert verdict.status_code == 200
    assert verdict.json()["right"] is False
    assert verdict.json()["said"] != ""


@pytest.mark.parametrize(
    ("node", "seed", "answer", "stale", "status", "code"),
    [
        ("no-such-node", "42", "x", False, 404, "CA0002"),
        ("salmon", "42", "x", False, 404, "CA0009"),
        (NODE, "-1", "x", False, 422, "CA0011"),
        (NODE, "1e3", "x", False, 422, "CA0011"),
        (NODE, str(2**64), "x", False, 422, "CA0011"),
        (NODE, "", "x", False, 422, "CA0011"),
        (NODE, "42", "x" * (ANSWER_LIMIT + 1), False, 422, "CA0012"),
        (NODE, "42", "x", True, 409, "CA0010"),
    ],
    ids=["no-node", "no-problem", "negative", "exp", "too-big", "empty", "huge-answer", "stale"],
)
def test_errors(
    page: dict[str, Any], node: str, seed: str, answer: str, stale: bool, status: int, code: str
) -> None:
    version = "000000000000" if stale else page["problem"]["version"]
    posted = send(Client(), version, answer, seed, node)
    assert (posted.status_code, posted.json()["code"]) == (status, code)
    if code != "CA0012":
        got = download(Client(), version, seed, node)
        assert (got.status_code, got.json()["code"]) == (status, code)


def test_an_answer_needs_no_csrf_token(page: dict[str, Any]) -> None:
    client = Client(enforce_csrf_checks=True)
    assert send(client, page["problem"]["version"], "x").status_code == 200


def test_the_largest_seed_is_taken(page: dict[str, Any]) -> None:
    assert download(Client(), page["problem"]["version"], str(2**64 - 1)).status_code == 200


def test_a_lone_surrogate_is_a_sentence(page: dict[str, Any]) -> None:
    """#429: a JSON escape no UTF-8 holds is garbage like any other."""
    version = page["problem"]["version"]
    body = '{"seed": "42", "version": "' + version + '", "answer": "\\ud800"}'
    sent = Client().post(f"/api/nodes/{NODE}/problem/answer", body, content_type="application/json")
    assert sent.status_code == 200
    assert sent.json()["right"] is False


def test_a_kit_that_cannot_run_leaves_the_page_readable(
    page: dict[str, Any], monkeypatch: pytest.MonkeyPatch
) -> None:
    """#428: the node reads without its problem when its kit is gone or refuses its params."""
    monkeypatch.delitem(registry.KITS, "de-bruijn-edges")
    problems.forget()
    after = Client().get(f"/api/nodes/{NODE}")
    assert after.status_code == 200
    assert after.json()["problem"] is None
