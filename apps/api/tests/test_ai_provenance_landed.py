"""Public evidence survives the content pipeline; private sources stay in Studio."""

import json
import shutil
from dataclasses import replace
from pathlib import Path

import pytest

from code_api.accounts.models import User
from code_api.content.index import rebuild_index
from code_api.content.snapshot import node_from_index
from code_api.studio import drafts
from code_schema import read_node, write_node_folder
from code_schema.provenance import attach

pytestmark = pytest.mark.django_db
ROOT = Path(__file__).resolve().parents[3] / "tests/fixtures/salmon"
IDENTITY = "12345678-1234-4234-8234-123456789abc"


def test_a_public_receipt_survives_index_and_a_new_draft(tmp_path: Path, ada: User) -> None:
    root = tmp_path / "content"
    shutil.copytree(ROOT, root)
    folder = root / "molecular-biology/dna-and-genes"
    # The fixture's actual folder is discovered, not inferred from its region label.
    folder = next(p.parent for p in root.rglob("node.yaml") if p.parent.name == "dna-and-genes")
    from code_schema.content import read_content

    content = read_content(root)
    node = content.nodes["dna-and-genes"]
    public = {
        "model": "openai/test",
        "prompt_id": "draft-block@1",
        "settings": {},
        "sources": [{"hash": "a" * 64}],
    }
    node = attach(node, "block/0", IDENTITY, public)
    assert node.provenance is not None
    write_node_folder(node, folder)
    first = rebuild_index(root)
    indexed = node_from_index("dna-and-genes")
    assert indexed is not None and indexed.provenance == node.provenance
    draft = drafts.open_existing("dna-and-genes", by=ada)
    assert drafts.latest(draft).provenance == node.provenance
    assert drafts.latest(draft).origins["block/0"]["baseline"] == IDENTITY
    # A provenance-only change matters to the follower's digest.
    changed = replace(
        node,
        provenance={
            **node.provenance,
            "receipts": {IDENTITY: {**public, "prompt_id": "draft-block@2"}},
        },
    )
    write_node_folder(changed, folder)
    assert rebuild_index(root).digest != first.digest
    again, problems = read_node(
        folder, regions=set(content.regions), providers=content.providers, root=root
    )
    assert again is not None and not any(p.refuses for p in problems)
    broken = json.loads((folder / "provenance.json").read_text())
    broken["receipts"][IDENTITY]["excerpt"] = "PRIVATE"
    (folder / "provenance.json").write_text(json.dumps(broken))
    assert rebuild_index(root).outcome == "refused"
    survived = node_from_index("dna-and-genes")
    assert survived is not None and "PRIVATE" not in json.dumps(survived.provenance)
