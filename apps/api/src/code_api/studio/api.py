"""The Studio drafts API (M4.4 spec, M4W.4): open, read, list, discard, and the content API's edits.

Every route is the team's: `studio(Role.AUTHOR)`, so any author or above (M4W.1).
"""

from typing import Literal
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
    ChecklistOut,
    DraftOut,
    DraftSummaryOut,
    FilesOut,
    ItemOut,
    ProblemOut,
    RefusedOut,
    RevisionOut,
    VerifyOut,
    node_out,
)
from code_schema import (
    Answer,
    Block,
    Callout,
    ChoiceAnswer,
    ExamQuestion,
    Level,
    Link,
    NumberAnswer,
    Option,
    Resource,
    Text,
    Try,
    TryQuestion,
)
from code_schema.edits import (
    EditError,
    Unfaithful,
    add_exam_question,
    delete_block,
    delete_exam_question,
    insert_block,
    move_block,
    set_fields,
    set_links,
    set_resources,
    update_block,
    update_exam_question,
)

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


# ── The content API's edits (M4W.4) ─────────────────────────────────────────────────────────────
# Each edit names the revision it was based on and makes one revision, or none.


class SavedOut(Schema):
    draft: DraftOut
    warnings: list[ProblemOut]


class LinkIn(Schema):
    node: str
    reason: str


class OptionIn(Schema):
    text: str
    right: bool = False
    misconception: str = ""


class AnswerIn(Schema):
    """A question's answer, flat as the files write it: `options` for a choice; `answer`, `unit`
    and `tolerance` for a number."""

    kind: Literal["choice", "number"]
    options: list[OptionIn] | None = None
    answer: float | int | None = None
    unit: str = ""
    tolerance: float | int | None = None


class TryQuestionIn(AnswerIn):
    id: str
    ask: str
    hints: list[str]
    rationale: str


class ExamQuestionIn(AnswerIn):
    id: str
    ask: str
    level: Level | None = None
    rationale: str


class BlockIn(Schema):
    """A block as the node's JSON shows it: `text` (markdown), `try` (question) or `callout`
    (callout, title, markdown)."""

    kind: Literal["text", "try", "callout"]
    markdown: str = ""
    question: str = ""
    callout: str = ""
    title: str = ""


class ResourceIn(Schema):
    kind: str
    provider: str
    url: str
    video: str = ""
    part: str = ""
    covers: str
    licence: str
    display: str
    level: Level


class FieldsIn(Schema):
    revision: int
    title: str | None = None
    claim: str | None = None
    region: str | None = None
    level: Level | None = None
    minutes: int | None = None


class LinksIn(Schema):
    revision: int
    links: list[LinkIn]


class InsertBlockIn(Schema):
    revision: int
    at: int
    block: BlockIn
    question: TryQuestionIn | None = None


class UpdateBlockIn(Schema):
    revision: int
    block: BlockIn
    question: TryQuestionIn | None = None


class MoveBlockIn(Schema):
    revision: int
    to: int


class ResourcesIn(Schema):
    revision: int
    resources: list[ResourceIn]


class ExamIn(Schema):
    revision: int
    question: ExamQuestionIn


def _answer(given: AnswerIn) -> Answer:
    """As written: a choice's options, else a number. Built inside the edit, so a missing answer
    is an EditError; other malformed answers are left for the parse to refuse in its own words."""
    if given.kind == "choice":
        return ChoiceAnswer(
            options=tuple(
                Option(text=o.text, right=o.right, misconception=o.misconception)
                for o in given.options or []
            )
        )
    if given.answer is None:
        raise EditError("a number question needs its answer")
    return NumberAnswer(value=given.answer, unit=given.unit, tolerance=given.tolerance)


def _try_question(given: TryQuestionIn | None) -> TryQuestion | None:
    if given is None:
        return None
    return TryQuestion(
        id=given.id,
        ask=given.ask,
        answer=_answer(given),
        hints=tuple(given.hints),
        rationale=given.rationale,
    )


def _exam_question(given: ExamQuestionIn) -> ExamQuestion:
    return ExamQuestion(
        id=given.id,
        ask=given.ask,
        answer=_answer(given),
        level=given.level,
        rationale=given.rationale,
    )


def _block(given: BlockIn) -> Block:
    match given.kind:
        case "try":
            return Try(question=given.question)
        case "callout":
            return Callout(kind=given.callout, title=given.title, markdown=given.markdown)  # type: ignore[arg-type]
    return Text(markdown=given.markdown)


SaveAnswer = Status[SavedOut] | Status[Message] | Status[RefusedOut]
_EDIT_RESPONSES = {200: SavedOut, 404: Message, 409: Message, 422: RefusedOut}


def _edit(
    request: HttpRequest, public_id: UUID, based_on: int, edit: drafts.Edit, change: str
) -> SaveAnswer:
    """One save through `drafts.save`, each outcome in the API's words."""
    draft = Draft.objects.filter(public_id=public_id, state=Draft.State.OPEN).first()
    if draft is None:
        return Status(404, Message(detail="No open draft has this id.", code="CA0201"))
    try:
        saved = drafts.save(draft, based_on=based_on, edit=edit, by=_member(request), change=change)
    except drafts.NotOpen:
        return Status(404, Message(detail="No open draft has this id.", code="CA0201"))
    except drafts.Stale as stale:
        who = "nobody" if stale.latest.saved_by is None else stale.latest.saved_by.email
        detail = (
            f"This draft is at revision {stale.latest.number}, saved by {who}; "
            "reload it and make the change again."
        )
        return Status(409, Message(detail=detail, code="CA0203"))
    except drafts.Garbled:
        detail = (
            "The save's files would read back as something else than was sent: a title holds "
            "a newline, or a block's text holds a ::: line. Nothing was stored."
        )
        return Status(422, RefusedOut(detail=detail, code="CA0210", problems=[]))
    except Unfaithful:
        detail = (
            "The save's files would read back as something else than was sent: keep a title on "
            "one line, and keep ::: lines out of a block's text. Nothing was stored."
        )
        return Status(422, RefusedOut(detail=detail, code="CA0210", problems=[]))
    except EditError as wrong:
        return Status(
            422,
            RefusedOut(
                detail=f"{str(wrong)[:1].upper()}{str(wrong)[1:]}.", code="CA0205", problems=[]
            ),
        )
    except drafts.Refused as no:
        return Status(422, refused(list(no.problems), "The save's files would not validate."))
    return Status(
        200,
        SavedOut(
            draft=draft_out(draft),
            warnings=[ProblemOut.of(problem) for problem in saved.warnings],
        ),
    )


@router.patch("/{public_id}/fields", response=_EDIT_RESPONSES, summary="Set fields")
def edit_fields(request: HttpRequest, public_id: UUID, body: FieldsIn) -> SaveAnswer:
    given = body.dict(exclude={"revision"}, exclude_none=True)
    return _edit(
        request,
        public_id,
        body.revision,
        lambda node: set_fields(node, **given),
        f"set {', '.join(given) or 'nothing'}",
    )


@router.put("/{public_id}/links/{kind}", response=_EDIT_RESPONSES, summary="Replace a link list")
def edit_links(request: HttpRequest, public_id: UUID, kind: str, body: LinksIn) -> SaveAnswer:
    links = [Link(node=link.node, reason=link.reason) for link in body.links]
    return _edit(
        request,
        public_id,
        body.revision,
        lambda node: set_links(node, kind, links),
        f"replaced the {kind} links",
    )


@router.post("/{public_id}/blocks", response=_EDIT_RESPONSES, summary="Insert a block")
def insert(request: HttpRequest, public_id: UUID, body: InsertBlockIn) -> SaveAnswer:
    block = _block(body.block)
    return _edit(
        request,
        public_id,
        body.revision,
        lambda node: insert_block(node, body.at, block, _try_question(body.question)),
        f"inserted a {body.block.kind} block at {body.at}",
    )


@router.put("/{public_id}/blocks/{at}", response=_EDIT_RESPONSES, summary="Update a block")
def update(request: HttpRequest, public_id: UUID, at: int, body: UpdateBlockIn) -> SaveAnswer:
    block = _block(body.block)
    return _edit(
        request,
        public_id,
        body.revision,
        lambda node: update_block(node, at, block, _try_question(body.question)),
        f"updated block {at}",
    )


@router.post("/{public_id}/blocks/{at}/move", response=_EDIT_RESPONSES, summary="Move a block")
def move(request: HttpRequest, public_id: UUID, at: int, body: MoveBlockIn) -> SaveAnswer:
    return _edit(
        request,
        public_id,
        body.revision,
        lambda node: move_block(node, at, body.to),
        f"moved block {at} to {body.to}",
    )


@router.delete("/{public_id}/blocks/{at}", response=_EDIT_RESPONSES, summary="Delete a block")
def delete(request: HttpRequest, public_id: UUID, at: int, revision: int) -> SaveAnswer:
    return _edit(
        request, public_id, revision, lambda node: delete_block(node, at), f"deleted block {at}"
    )


@router.put("/{public_id}/resources", response=_EDIT_RESPONSES, summary="Replace the resources")
def edit_resources(request: HttpRequest, public_id: UUID, body: ResourcesIn) -> SaveAnswer:
    resources = [Resource(**resource.dict()) for resource in body.resources]
    return _edit(
        request,
        public_id,
        body.revision,
        lambda node: set_resources(node, resources),
        "replaced the resources",
    )


@router.post("/{public_id}/exam", response=_EDIT_RESPONSES, summary="Add an exam question")
def exam_add(request: HttpRequest, public_id: UUID, body: ExamIn) -> SaveAnswer:
    return _edit(
        request,
        public_id,
        body.revision,
        lambda node: add_exam_question(node, _exam_question(body.question)),
        f"added exam question {body.question.id}",
    )


@router.put(
    "/{public_id}/exam/{question_id}", response=_EDIT_RESPONSES, summary="Update an exam question"
)
def exam_update(
    request: HttpRequest, public_id: UUID, question_id: str, body: ExamIn
) -> SaveAnswer:
    return _edit(
        request,
        public_id,
        body.revision,
        lambda node: update_exam_question(node, question_id, _exam_question(body.question)),
        f"updated exam question {question_id}",
    )


@router.delete(
    "/{public_id}/exam/{question_id}", response=_EDIT_RESPONSES, summary="Delete an exam question"
)
def exam_delete(
    request: HttpRequest, public_id: UUID, question_id: str, revision: int
) -> SaveAnswer:
    return _edit(
        request,
        public_id,
        revision,
        lambda node: delete_exam_question(node, question_id),
        f"deleted exam question {question_id}",
    )


# ── Verify and the checklist (M4W.5) ─────────────────────────────────────────────────────────────


@router.get(
    "/{public_id}/verify",
    response={200: VerifyOut, 404: Message},
    summary="Check against the graph",
)
def verify(request: HttpRequest, public_id: UUID) -> Status[VerifyOut] | Status[Message]:
    draft = find(public_id)
    if draft is None or draft.state != Draft.State.OPEN:
        return Status(404, Message(detail="No open draft has this id.", code="CA0201"))
    problems = drafts.verify(draft)
    return Status(
        200,
        VerifyOut(
            clean=not any(problem.refuses for problem in problems),
            problems=[ProblemOut.of(problem) for problem in problems],
        ),
    )


@router.get(
    "/{public_id}/checklist", response={200: ChecklistOut, 404: Message}, summary="M4's bar"
)
def checklist(request: HttpRequest, public_id: UUID) -> Status[ChecklistOut] | Status[Message]:
    draft = find(public_id)
    if draft is None or draft.state != Draft.State.OPEN:
        return Status(404, Message(detail="No open draft has this id.", code="CA0201"))
    items = drafts.checklist(draft)
    return Status(
        200,
        ChecklistOut(
            passed=all(item.passed for item in items),
            items=[
                ItemOut(rule=item.rule, passed=item.passed, detail=item.detail) for item in items
            ],
        ),
    )
