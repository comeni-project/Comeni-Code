"""A save carries content and origin evidence together, or rolls both back."""

from dataclasses import replace
from pathlib import Path

import pytest

from code_api.accounts.models import User
from code_api.content.index import rebuild_index
from code_api.studio import drafts
from code_schema import Text
from code_schema.edits import EditError, update_block
from code_schema.provenance import attach

pytestmark = pytest.mark.django_db
ROOT = Path(__file__).resolve().parents[3] / "tests/fixtures/salmon"
IDENTITY = "12345678-1234-4234-8234-123456789abc"


def test_a_save_retains_the_baseline_and_refuses_an_unmapped_overwrite(ada: User) -> None:
    rebuild_index(ROOT)
    draft = drafts.open_existing("dna-and-genes", by=ada)
    node, _ = drafts.node_of(draft)
    assert node is not None
    at = next(i for i, block in enumerate(node.blocks) if isinstance(block, Text))
    public = {"model": "openai/local", "prompt_id": "draft-block@1", "settings": {}, "sources": []}
    drafts.save(
        draft,
        based_on=1,
        edit=lambda n: attach(n, f"block/{at}", IDENTITY, public),
        by=ada,
        change="AI origin",
    )
    saved = drafts.save(
        draft,
        based_on=2,
        edit=lambda n: update_block(n, at, Text("A human correction.\n")),
        by=ada,
        change="human",
    )
    assert saved.revision.origins[f"block/{at}"]["baseline"] == IDENTITY
    with pytest.raises(EditError, match="explicit mapping"):
        drafts.save(
            draft,
            based_on=3,
            edit=lambda n: replace(n, body="Overwritten.\n", provenance=None),
            by=ada,
            change="unmapped",
        )
    assert draft.revisions.count() == 3
    with pytest.raises(drafts.Stale):
        drafts.save(draft, based_on=2, edit=lambda n: n, by=ada, change="stale")
