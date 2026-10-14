"""The review queue (M4.9b spec, M4RS.1): every submitted draft a reviewer may judge."""

from django.http import HttpRequest
from ninja import Router

from code_api.accounts.access import studio
from code_api.accounts.api import MemberOut
from code_api.accounts.models import User
from code_api.accounts.roles import Role
from code_api.studio import drafts, review
from code_api.studio.keys import label
from code_api.studio.schemas import QueuedDraftOut, QueueKeyOut

router = Router(tags=["studio"], auth=studio(Role.REVIEWER))


@router.get("", response=list[QueuedDraftOut], summary="The drafts to review, and their keys")
def queue(request: HttpRequest) -> list[QueuedDraftOut]:
    assert isinstance(request.user, User)
    return [
        QueuedDraftOut(
            public_id=queued.draft.public_id,
            node_id=queued.draft.node_id,
            title=queued.title,
            revision=queued.revision,
            submitted_at=queued.submitted_at,
            contributors=[MemberOut.of(user) for user in drafts.contributors(queued.draft)],
            reads=queued.reads,
            keys=[
                QueueKeyOut(
                    key=k.key.key,
                    kind=k.key.kind,
                    label=label(k.key),
                    verdict=k.verdict,
                    answered=k.answered,
                )
                for k in queued.keys
            ],
        )
        for queued in review.queue(request.user)
    ]
