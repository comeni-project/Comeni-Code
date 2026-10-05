"""The Studio drafts API (M4.4 spec, M4W.4): open, read, list, discard; the edits are M4.4.5's.

Every route is the team's: `studio(Role.AUTHOR)`, so any author or above (M4W.1).
"""

from uuid import UUID

from django.http import HttpRequest
from ninja import Router, Schema, Status

from code_api.accounts.access import studio
from code_api.accounts.api import MemberOut
from code_api.accounts.models import User
from code_api.accounts.roles import Role
from code_api.content.schemas import Message
from code_api.studio import drafts
from code_api.studio.models import Draft
from code_api.studio.schemas import (
    DraftOut,
    DraftSummaryOut,
    FilesOut,
    ProblemOut,
    RefusedOut,
    RevisionOut,
    node_out,
)
from code_schema import Level

router = Router(tags=["studio"], auth=studio(Role.AUTHOR))

_NO_DRAFT = Message(detail="No draft has this id.", code="CA0201")


class NewNodeIn(Schema):
    title: str
    claim: str
    region: str
    level: Level
    minutes: int


class OpenIn(Schema):
    """An indexed node's id; or a new node's id with its first fields."""

    node_id: str
    new: NewNodeIn | None = None


def _member(request: HttpRequest) -> User:
    assert isinstance(request.user, User)  # `studio` let only a signed-in member through
    return request.user


def summary_out(draft: Draft) -> DraftSummaryOut:
    return DraftSummaryOut(
        public_id=draft.public_id,
        node_id=draft.node_id,
        folder=draft.folder,
        state=draft.state,
        base_digest=draft.base_digest,
        revision=drafts.latest(draft).number,
        contributors=[MemberOut.of(user) for user in drafts.contributors(draft)],
    )


def draft_out(draft: Draft) -> DraftOut:
    node, problems = drafts.node_of(draft)
    return DraftOut(
        **summary_out(draft).dict(),
        node=None if node is None else node_out(node),
        problems=[ProblemOut.of(problem) for problem in problems],
    )


def refused(problems: list[object], detail: str) -> RefusedOut:
    return RefusedOut(
        detail=detail,
        code="CA0208",
        problems=[ProblemOut.of(problem) for problem in problems],  # type: ignore[arg-type]
    )


def already_open(held: Draft) -> Message:
    names = ", ".join(user.email for user in drafts.contributors(held)) or "nobody"
    return Message(
        detail=f"{held.node_id} already has an open draft, {held.public_id}, by {names}.",
        code="CA0202",
    )


def find(public_id: UUID) -> Draft | None:
    return Draft.objects.filter(public_id=public_id).first()


@router.post(
    "",
    response={201: DraftOut, 404: Message, 409: Message, 422: RefusedOut},
    summary="Open a draft of a node",
)
def open_draft(
    request: HttpRequest, body: OpenIn
) -> Status[DraftOut] | Status[Message] | Status[RefusedOut]:
    by = _member(request)
    try:
        if body.new is None:
            draft = drafts.open_existing(body.node_id, by=by)
        else:
            draft = drafts.open_new(
                body.node_id,
                title=body.new.title,
                claim=body.new.claim,
                region=body.new.region,
                level=body.new.level,
                minutes=body.new.minutes,
                by=by,
            )
    except drafts.AlreadyOpen as held:
        return Status(409, already_open(held.draft))
    except drafts.NotIndexed:
        detail = f"The index has no node {body.node_id}; open it as a new node instead."
        return Status(404, Message(detail=detail, code="CA0204"))
    except drafts.AlreadyANode:
        detail = f"{body.node_id} is already a node; open a draft of it instead."
        return Status(409, Message(detail=detail, code="CA0207"))
    except drafts.Refused as no:
        detail = (
            "The new node's files would not validate."
            if body.new is not None
            else "This node's files do not validate against the index's registries; "
            "rebuild the index (manage.py rebuild_index), then open it again."
        )
        return Status(422, refused(list(no.problems), detail))
    return Status(201, draft_out(draft))


@router.get("", response=list[DraftSummaryOut], summary="The open drafts")
def open_drafts(request: HttpRequest) -> list[DraftSummaryOut]:
    return [
        summary_out(draft)
        for draft in Draft.objects.filter(state=Draft.State.OPEN).order_by("created_at")
    ]


@router.get("/{public_id}", response={200: DraftOut, 404: Message}, summary="A draft")
def read_draft(request: HttpRequest, public_id: UUID) -> Status[DraftOut] | Status[Message]:
    draft = find(public_id)
    return Status(404, _NO_DRAFT) if draft is None else Status(200, draft_out(draft))


@router.get(
    "/{public_id}/revisions", response={200: list[RevisionOut], 404: Message}, summary="History"
)
def revisions(request: HttpRequest, public_id: UUID) -> Status[list[RevisionOut]] | Status[Message]:
    draft = find(public_id)
    if draft is None:
        return Status(404, _NO_DRAFT)
    return Status(
        200,
        [
            RevisionOut(
                number=revision.number,
                saved_by=None if revision.saved_by is None else MemberOut.of(revision.saved_by),
                saved_at=revision.saved_at,
                change=revision.change,
            )
            for revision in draft.revisions.order_by("number").select_related("saved_by")
        ],
    )


@router.get(
    "/{public_id}/revisions/{number}",
    response={200: FilesOut, 404: Message},
    summary="A revision's files",
)
def revision_files(
    request: HttpRequest, public_id: UUID, number: int
) -> Status[FilesOut] | Status[Message]:
    draft = find(public_id)
    revision = None if draft is None else draft.revisions.filter(number=number).first()
    if revision is None:
        return Status(404, Message(detail="No revision has this number.", code="CA0209"))
    return Status(
        200,
        FilesOut(
            number=revision.number,
            node_yaml=revision.node_yaml,
            body_md=revision.body_md,
            exam_yaml=revision.exam_yaml,
        ),
    )


@router.post(
    "/{public_id}/discard",
    response={200: DraftOut, 403: Message, 404: Message},
    summary="Discard a draft",
)
def discard(request: HttpRequest, public_id: UUID) -> Status[DraftOut] | Status[Message]:
    draft = find(public_id)
    if draft is None or draft.state != Draft.State.OPEN:
        return Status(404, Message(detail="No open draft has this id.", code="CA0201"))
    try:
        draft = drafts.discard(draft, by=_member(request))
    except drafts.NotOpen:
        return Status(404, Message(detail="No open draft has this id.", code="CA0201"))
    except drafts.NotAllowed:
        detail = "Only someone who saved this draft, or an operator, may discard it."
        return Status(403, Message(detail=detail, code="CA0206"))
    return Status(200, draft_out(draft))
