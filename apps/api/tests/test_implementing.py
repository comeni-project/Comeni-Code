"""The human gate precedes normal draft creation; stages follow the existing workflow."""

from pathlib import Path
from typing import Any

import pytest

from code_api.content.index import rebuild_index
from code_api.studio import implementing, requests
from code_api.studio.models import Draft
from code_schema import Level

pytestmark = pytest.mark.django_db


def test_start_requires_accept_and_is_idempotent(ada: Any) -> None:
    rebuild_index(Path(__file__).resolve().parents[3] / "tests/fixtures/salmon")
    item = requests.create("DNA pairing", "Explain complementary bases.")
    args: dict[str, Any] = {
        "by": ada,
        "node_id": "dna-pairing",
        "claim": "Pair complementary bases.",
        "region": "foundations",
        "level": Level.INTRODUCTORY,
        "minutes": 5,
    }
    # Pick a real registered region rather than relying on fixture naming.
    from code_api.content.models import Region

    args["region"] = Region.objects.earliest("position").id
    with pytest.raises(requests.RequestError, match="Accept"):
        implementing.start(item.public_id, 1, **args)
    requests.decide(item.public_id, "accept", expected_version=1, by=ada)
    made = implementing.start(item.public_id, 2, **args)
    retry = implementing.start(item.public_id, 2, **args)
    assert made.draft_id == retry.draft_id and Draft.objects.count() == 1
    assert implementing.stage(made) == "writing"
    assert made.draft is not None
    made.draft.state = "submitted"
    assert implementing.stage(made) == "waiting for review"


def test_assignment_rejects_stale_version_and_non_author(ada: Any, grace: Any) -> None:
    item = requests.create("DNA pairing", "Explain complementary bases.")
    requests.decide(item.public_id, "accept", expected_version=1, by=ada)
    implementing.assign(item.public_id, 2, grace.public_id, by=ada)
    with pytest.raises(requests.RequestError, match="changed"):
        implementing.assign(item.public_id, 2, None, by=ada)
    grace.role = ""
    grace.save(update_fields=["role"])
    with pytest.raises(requests.RequestError, match="active author"):
        implementing.assign(item.public_id, 3, grace.public_id, by=ada)
