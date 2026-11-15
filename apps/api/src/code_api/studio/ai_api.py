"""Author-visible proposal and receipt routes, scoped to one Studio draft."""

from collections.abc import Callable
from typing import Any, Literal, cast
from uuid import UUID

from django.http import HttpRequest
from ninja import Router, Schema, Status

from code_api.accounts.access import studio
from code_api.accounts.models import User
from code_api.accounts.roles import Role
from code_api.studio import ai_drafting, drafts
from code_api.studio.ai_schemas import (
    AcceptProposalIn,
    CreateProposalIn,
    DraftingError,
    DraftingFailure,
    ProposalOut,
)
from code_api.studio.models import Draft, DraftProposal
from code_api.studio.schemas import DraftOut, ProblemOut

router = Router(tags=["studio"], auth=studio(Role.AUTHOR))
ERRORS = {404: DraftingFailure, 409: DraftingFailure, 422: DraftingFailure}


class AppliedProposalOut(Schema):
    draft: DraftOut
    proposal: ProposalOut
    warnings: list[ProblemOut]


def shown(proposal: DraftProposal) -> ProposalOut:
    call = proposal.call
    receipt = (
        None
        if call is None
        else {
            "call_id": call.pk,
            "model": call.model,
            "connection": call.connection_name,
            "prompt_id": call.prompt_id,
            "settings": call.call_settings,
            "tokens_in": call.tokens_in,
            "tokens_out": call.tokens_out,
            "cost": None if call.cost is None else str(call.cost),
            "duration_ms": call.duration_ms,
            "outcome": call.outcome,
        }
    )
    return ProposalOut(
        public_id=proposal.public_id,
        kind=cast(Literal["block", "resource", "figure"], proposal.kind),
        target=proposal.target,
        base_revision=proposal.base_revision.number,
        state=cast(
            Literal["queued", "running", "ready", "refused", "failed", "accepted", "discarded"],
            proposal.state,
        ),
        instruction=proposal.instruction,
        current=proposal.context.get("current", {}),
        raw=proposal.raw,
        candidate=proposal.candidate,
        sources=proposal.sources,
        candidates=proposal.candidates,
        conflicts=proposal.conflicts,
        findings=proposal.findings,
        code=proposal.code,
        detail=proposal.detail,
        receipt=receipt,
        copy_digest=proposal.copy_digest,
        accepted_revision=None
        if proposal.accepted_revision is None
        else proposal.accepted_revision.number,
        created_at=proposal.created_at,
    )


def handled(action: Callable[[], Any]) -> Any:
    try:
        return action()
    except DraftingError as error:
        return Status(
            422, DraftingFailure(code=error.code, detail=error.detail, findings=error.findings)
        )
    except drafts.Stale as error:
        return Status(
            409,
            DraftingFailure(
                code="CA0203",
                detail=f"This draft is at revision {error.latest.number}; reload before applying.",
            ),
        )
    except drafts.NotOpen:
        return Status(
            409, DraftingFailure(code="CA0211", detail="This draft is no longer open for editing.")
        )
    except drafts.Refused as error:
        return Status(
            422,
            DraftingFailure(
                code="CA0502",
                detail="The content does not validate.",
                findings=[{"code": p.code, "message": p.message} for p in error.problems],
            ),
        )
    except (ValueError, TypeError, KeyError, IndexError, StopIteration) as error:
        return Status(
            422,
            DraftingFailure(code="CA0502", detail=f"The proposed edit is invalid: {error}"[:500]),
        )


def _find(draft_id: UUID, identity: UUID) -> DraftProposal | None:
    return (
        DraftProposal.objects.select_related("base_revision", "accepted_revision", "call")
        .filter(draft__public_id=draft_id, public_id=identity)
        .first()
    )


def missing() -> Status[DraftingFailure]:
    return Status(
        404, DraftingFailure(code="CA0201", detail="No proposal in this draft has that id.")
    )


@router.get("/{draft_id}/ai/proposals", response={200: list[ProposalOut], **ERRORS})
def list_proposals(request: HttpRequest, draft_id: UUID, target: str = "") -> Any:
    if not Draft.objects.filter(public_id=draft_id).exists():
        return missing()
    proposals = DraftProposal.objects.filter(draft__public_id=draft_id).select_related(
        "base_revision", "accepted_revision", "call"
    )
    if target:
        proposals = proposals.filter(target=target)
    return [shown(p) for p in proposals.order_by("-created_at", "-pk")[:30]]


@router.post("/{draft_id}/ai/proposals", response={200: ProposalOut, **ERRORS})
def create_proposal(request: HttpRequest, draft_id: UUID, body: CreateProposalIn) -> Any:
    draft = Draft.objects.filter(public_id=draft_id).first()
    if draft is None:
        return missing()
    assert isinstance(request.user, User)
    by = request.user
    return handled(lambda: shown(ai_drafting.create(draft, body, by=by)))


@router.get("/{draft_id}/ai/proposals/{identity}", response={200: ProposalOut, **ERRORS})
def read_proposal(request: HttpRequest, draft_id: UUID, identity: UUID) -> Any:
    proposal = _find(draft_id, identity)
    return missing() if proposal is None else shown(proposal)


@router.post(
    "/{draft_id}/ai/proposals/{identity}/accept", response={200: AppliedProposalOut, **ERRORS}
)
def accept_proposal(
    request: HttpRequest, draft_id: UUID, identity: UUID, body: AcceptProposalIn
) -> Any:
    proposal = _find(draft_id, identity)
    if proposal is None:
        return missing()
    assert isinstance(request.user, User)
    by = request.user

    def apply() -> AppliedProposalOut:
        from code_api.studio.api import draft_out

        ai_drafting.accept(proposal, by=by, based_on=body.based_on, resolutions=body.resolutions)
        proposal.refresh_from_db()
        _, findings = drafts.node_of(proposal.draft)
        return AppliedProposalOut(
            draft=draft_out(proposal.draft),
            proposal=shown(proposal),
            warnings=[ProblemOut.of(p) for p in findings],
        )

    return handled(apply)


@router.post("/{draft_id}/ai/proposals/{identity}/discard", response={200: ProposalOut, **ERRORS})
def discard_proposal(request: HttpRequest, draft_id: UUID, identity: UUID) -> Any:
    proposal = _find(draft_id, identity)
    if proposal is None:
        return missing()

    def discard() -> ProposalOut:
        ai_drafting.discard(proposal)
        proposal.refresh_from_db()
        return shown(proposal)

    return handled(discard)
