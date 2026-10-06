"""The index as a read model (M4.4 spec, M4W.2): a node reads back from it exactly as its files.

A draft starts from the index, so this is what makes that safe: every fixture node goes index →
`Node` → files byte for byte. Reads only the fixtures (R1). Needs Compose's Postgres.
"""

from pathlib import Path

import pytest

from code_api.content.index import rebuild_index
from code_api.content.snapshot import node_from_index, providers_from_index, regions_from_index
from code_schema import read_content
from code_schema.writer import write_exam_yaml, write_node_yaml

pytestmark = pytest.mark.django_db

FIXTURES = Path(__file__).resolve().parents[3] / "tests" / "fixtures" / "salmon"
CONTENT = read_content(FIXTURES)


@pytest.fixture(autouse=True)
def _indexed() -> None:
    rebuild_index(FIXTURES)


@pytest.mark.parametrize("node_id", sorted(CONTENT.nodes))
def test_a_node_reads_back_as_its_files(node_id: str) -> None:
    folder = FIXTURES / CONTENT.folders[node_id]
    node = node_from_index(node_id)
    assert node is not None
    assert write_node_yaml(node) == (folder / "node.yaml").read_text(encoding="utf-8")
    assert node.body == (folder / "body.md").read_text(encoding="utf-8")
    exam = folder / "exam.yaml"
    if exam.is_file():
        assert write_exam_yaml(node) == exam.read_text(encoding="utf-8")
    else:
        assert node.exam == ()


@pytest.mark.parametrize("node_id", sorted(CONTENT.nodes))
def test_a_node_reads_back_equal(node_id: str) -> None:
    assert node_from_index(node_id) == CONTENT.nodes[node_id]


def test_an_unknown_node_is_none() -> None:
    assert node_from_index("no-such-node") is None


def test_the_registries_read_back_whole() -> None:
    assert providers_from_index() == CONTENT.providers
    assert regions_from_index() == CONTENT.regions


# #173: numbers read back as written, exponents and zeros included.


@pytest.mark.parametrize(
    ("written", "value"),
    [("6.022e+23", 6.022e23), ("1.0e-20", 1e-20), ("0.0", 0.0), ("0", 0), ("1000000", 1000000)],
)
def test_a_number_answer_reads_back_as_written(
    tmp_path: Path, written: str, value: float | int
) -> None:
    import shutil

    root = tmp_path / "content"
    shutil.copytree(FIXTURES, root)
    exam = root / "transcriptomics" / "tpm" / "exam.yaml"
    exam.write_text(exam.read_text().replace("answer: 1000000", f"answer: {written}"))
    content = read_content(root)
    assert content.problems == ()
    rebuild_index(root)
    node = node_from_index("tpm")
    assert node == content.nodes["tpm"]
    assert node is not None and node.exam[0].answer.value == value  # type: ignore[union-attr]
    assert type(node.exam[0].answer.value) is type(value)  # type: ignore[union-attr]
    assert write_exam_yaml(node) == exam.read_text()
