"""What the Studio drafts API answers (M4.4 spec, M4W.4). Studio sees everything about a node,
answers and the exam pool included: it is the team's, behind `studio(min_role)`."""

from collections.abc import Mapping
from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from ninja import Schema

from code_api.accounts.api import MemberOut
from code_api.content.schemas import (
    BlockOut,
    CalloutBlockOut,
    SequenceBlockOut,
    TextBlockOut,
    TryBlockOut,
)
from code_api.studio.keys import Key
from code_api.studio.review import Answered, Reviewed, SentBack, Sheet, question_of
from code_schema import (
    Answer,
    Callout,
    ChoiceAnswer,
    ExamQuestion,
    Node,
    NumberAnswer,
    OrderAnswer,
    Problem,
    Resource,
    SequenceAnswer,
    SequenceBlock,
    Text,
    Try,
    TryQuestion,
)


class LinkOut(Schema):
    node: str
    reason: str


class StudioResourceOut(Schema):
    kind: str
    provider: str
    url: str
    video: str
    part: str
    covers: str
    licence: str
    display: str
    level: str


class StudioOptionOut(Schema):
    text: str
    right: bool
    misconception: str
    plain: bool


class StudioQuestionOut(Schema):
    """A try question; `options` for a choice, `answer` with unit and tolerance for a number, or
    as text with `accept` and `exact` for a sequence; `steps` for an order (M4Q.5)."""

    id: str
    kind: str
    ask: str
    options: list[StudioOptionOut] | None
    answer: float | int | str | None
    unit: str
    tolerance: float | int | None
    accept: list[str]
    exact: bool
    steps: list[str] | None
    hints: list[str]
    rationale: str


class StudioExamQuestionOut(Schema):
    """An exam question as the builder edits it (M4Q.5): its stem as blocks and as the text the
    file holds, and whether the live index holds it unchanged."""

    id: str
    kind: str
    title: str
    claim: str
    stem: list[BlockOut]
    stem_text: str
    state: Literal["approved", "draft"]
    level: str | None
    options: list[StudioOptionOut] | None
    answer: float | int | str | None
    unit: str
    tolerance: float | int | None
    accept: list[str]
    exact: bool
    steps: list[str] | None
    rationale: str


class DraftNodeOut(Schema):
    title: str
    claim: str
    region: str
    level: str
    minutes: int
    needs: list[LinkOut]
    goes_deeper: list[LinkOut]
    related: list[LinkOut]
    blocks: list[BlockOut]
    resources: list[StudioResourceOut]
    questions: list[StudioQuestionOut]
    exam: list[StudioExamQuestionOut]


class DraftSummaryOut(Schema):
    public_id: UUID
    node_id: str
    folder: str
    state: str
    base_digest: str
    revision: int
    # The revision under review or approved; null while open or discarded (M4R.6).
    submitted_revision: int | None
    contributors: list[MemberOut]
    # The live landing the draft is in, if any (M4.6 spec, M4L.5).
    landing: UUID | None = None


class RequestOut(Schema):
    key: str
    kind: str
    note: str


class RequestsOut(Schema):
    """The last send back, while the draft has not been submitted again (M4.9a spec, M4V.4)."""

    by: MemberOut | None
    at: datetime
    reason: str
    items: list[RequestOut]


def requests_out(back: SentBack | None) -> RequestsOut | None:
    if back is None:
        return None
    return RequestsOut(
        by=None if back.event.by is None else MemberOut.of(back.event.by),
        at=back.event.at,
        reason=back.event.reason,
        items=[RequestOut(key=v.key, kind=v.kind, note=v.note) for v in back.requests],
    )


class DraftOut(DraftSummaryOut):
    """The node, or null with `problems` when its latest revision no longer reads against the
    index's registries (#173)."""

    node: DraftNodeOut | None
    problems: list[ProblemOut]
    requests: RequestsOut | None = None


class RevisionOut(Schema):
    number: int
    saved_by: MemberOut | None
    saved_at: datetime
    change: str


class FilesOut(Schema):
    """A revision's files, exactly as they would land; `exam_yaml` is empty without a pool."""

    number: int
    node_yaml: str
    body_md: str
    exam_yaml: str


class ProblemOut(Schema):
    """One problem, as `code-schema validate` reports it; `text` is its printed line."""

    file: str
    line: int | None
    field: str | None
    code: str
    message: str
    text: str
    question: str | None = None  # the question it was found in (M4P.2)

    @staticmethod
    def of(problem: Problem) -> ProblemOut:
        return ProblemOut(
            file=problem.file,
            line=problem.line,
            field=problem.field,
            code=problem.code,
            message=problem.message,
            text=str(problem),
            question=problem.question,
        )


class ItemOut(Schema):
    rule: str
    passed: bool
    detail: str


class RefusedOut(Schema):
    """A refusal: why, every problem the draft's files would have (M4W.3), and for a checklist
    that fails, its items (M4.5 spec, M4R.6)."""

    detail: str
    code: str
    problems: list[ProblemOut]
    items: list[ItemOut] = []


def _answer_out(answer: Answer) -> dict[str, object]:
    """Each kind fills its own fields; the rest are empty (M4Q.5)."""
    empty: dict[str, object] = {
        "options": None,
        "answer": None,
        "unit": "",
        "tolerance": None,
        "accept": [],
        "exact": False,
        "steps": None,
    }
    match answer:
        case ChoiceAnswer(options=options):
            return empty | {
                "options": [
                    StudioOptionOut(
                        text=o.text, right=o.right, misconception=o.misconception, plain=o.plain
                    )
                    for o in options
                ]
            }
        case NumberAnswer(value=value, unit=unit, tolerance=tolerance):
            return empty | {"answer": value, "unit": unit, "tolerance": tolerance}
        case SequenceAnswer(value=text, accept=accept, exact=exact):
            return empty | {"answer": text, "accept": list(accept), "exact": exact}
        case OrderAnswer(steps=steps):
            return empty | {"steps": list(steps)}


def _block_out(
    block: Text | Try | Callout | SequenceBlock,
) -> TextBlockOut | TryBlockOut | CalloutBlockOut | SequenceBlockOut:
    match block:
        case Text(markdown=markdown):
            return TextBlockOut(kind="text", markdown=markdown)
        case Callout(kind=kind, title=title, markdown=markdown):
            return CalloutBlockOut(kind="callout", callout=kind, title=title, markdown=markdown)
        case Try(question=question):
            return TryBlockOut(kind="try", question=question)
        case SequenceBlock(letters=letters):
            return SequenceBlockOut(kind="sequence", letters=letters)


def _question_out(question: TryQuestion) -> StudioQuestionOut:
    return StudioQuestionOut(
        id=question.id,
        kind=question.kind,
        ask=question.ask,
        hints=list(question.hints),
        rationale=question.rationale,
        **_answer_out(question.answer),  # type: ignore[arg-type]
    )


def _exam_out(question: ExamQuestion, live: Mapping[str, ExamQuestion]) -> StudioExamQuestionOut:
    """Approved when the live index holds this question unchanged; else a draft (M4Q.5)."""
    return StudioExamQuestionOut(
        id=question.id,
        kind=question.kind,
        title=question.title,
        claim=question.claim,
        stem=[_block_out(block) for block in question.blocks],
        stem_text=question.stem,
        state="approved" if live.get(question.id) == question else "draft",
        level=None if question.level is None else question.level.value,
        rationale=question.rationale,
        **_answer_out(question.answer),  # type: ignore[arg-type]
    )


def _resource_out(r: Resource) -> StudioResourceOut:
    return StudioResourceOut(
        kind=r.kind,
        provider=r.provider,
        url=r.url,
        video=r.video,
        part=r.part,
        covers=r.covers,
        licence=r.licence,
        display=r.display,
        level=r.level.value,
    )


def node_out(node: Node, live: Mapping[str, ExamQuestion] | None = None) -> DraftNodeOut:
    return DraftNodeOut(
        title=node.title,
        claim=node.claim,
        region=node.region,
        level=node.level.value,
        minutes=node.minutes,
        needs=[LinkOut(node=link.node, reason=link.reason) for link in node.needs],
        goes_deeper=[LinkOut(node=link.node, reason=link.reason) for link in node.goes_deeper],
        related=[LinkOut(node=link.node, reason=link.reason) for link in node.related],
        blocks=[_block_out(block) for block in node.blocks],
        resources=[_resource_out(r) for r in node.resources],
        questions=[_question_out(question) for question in node.questions],
        exam=[_exam_out(question, live or {}) for question in node.exam],
    )


class VerifyOut(Schema):
    """`clean` when no problem refuses; warnings may still be listed (M4W.5)."""

    clean: bool
    problems: list[ProblemOut]


class QuestionChecksOut(Schema):
    """One exam question's checks (M4P.4)."""

    id: str
    items: list[ItemOut]


class ChecklistOut(Schema):
    """The checklist, the problems behind it and each exam question's checks, so Checks is one
    request (M4K.6, M4P.4)."""

    passed: bool
    items: list[ItemOut]
    problems: list[ProblemOut] = []
    questions: list[QuestionChecksOut] = []


# ── Review (M4.5 spec, M4R.6) ────────────────────────────────────────────────────────────────────


class ReviewQuestionOut(Schema):
    """One question of the submitted revision, as its reviewer sees it: the key and rationale only
    once they have answered it (M4R.4). A choice is answered by its option's index."""

    id: str
    pool: Literal["try", "exam"]
    kind: str
    ask: str  # an exam question's title
    stem: list[BlockOut]  # an exam question's stem; a try question has none
    options: list[str] | None
    unit: str
    # An order's steps by their text, not as written; once answered, `right_steps` (#264).
    steps: list[str] | None
    hints: list[str]  # a try question's; an exam question has none
    given: Any
    right: bool | None
    right_option: int | None
    right_steps: list[str] | None
    value: float | int | str | None
    tolerance: float | int | None
    rationale: str | None


def review_question_out(answered: Answered) -> ReviewQuestionOut:
    question = answered.asked.question
    shown = answered.given is not None
    right_option = tolerance = None
    value: float | int | str | None = None
    texts: list[str] | None = None
    steps: list[str] | None = None
    right_steps: list[str] | None = None
    unit = ""
    match question.answer:
        case ChoiceAnswer(options=options):
            texts = [option.text for option in options]
            if shown:
                right_option = next(i for i, option in enumerate(options) if option.right)
        case NumberAnswer(value=key, unit=unit, tolerance=within):
            if shown:
                value, tolerance = key, within
        case SequenceAnswer(value=typed):
            if shown:
                value = typed
        case OrderAnswer(steps=written):
            steps = sorted(written, key=str.casefold)
            if shown:
                right_steps = list(written)
    exam = isinstance(question, ExamQuestion)
    return ReviewQuestionOut(
        id=answered.asked.id,
        pool=answered.asked.pool,
        kind=question.kind,
        ask=question.title if exam else question.ask,  # type: ignore[union-attr]
        stem=[_block_out(block) for block in question.blocks] if exam else [],  # type: ignore[union-attr]
        options=texts,
        unit=unit,
        steps=steps,
        hints=[] if exam else list(question.hints),  # type: ignore[union-attr]
        given=answered.given,
        right=answered.right,
        right_option=right_option,
        right_steps=right_steps,
        value=value,
        tolerance=tolerance,
        rationale=question.rationale if shown else None,
    )


class ReviewFieldsOut(Schema):
    """The `node` key's content: the node's own fields and its links (M4V.1)."""

    title: str
    claim: str
    region: str
    level: str
    minutes: int
    needs: list[LinkOut]
    goes_deeper: list[LinkOut]
    related: list[LinkOut]


class ReviewContentOut(Schema):
    """A key's content, by kind (M4V.4); a question's key only once answered."""

    fields: ReviewFieldsOut | None
    block: BlockOut | None
    resource: StudioResourceOut | None
    question: ReviewQuestionOut | None


class ReviewItemOut(ReviewContentOut):
    """One key of your review (M4V.4): its content, your verdict and note, and what it was before
    this draft when it changed (M4.9b spec, M4RS.2)."""

    key: str
    kind: str
    verdict: str | None
    note: str
    change: str  # new, changed or same, against the live index
    before: ReviewContentOut | None


class QueueKeyOut(Schema):
    key: str
    kind: str
    label: str
    verdict: str | None
    answered: bool | None  # a question's: whether you answered it; null for other keys


class QueuedDraftOut(Schema):
    """A draft in the review queue (M4.9b spec, M4RS.1): its keys and your verdicts, no content."""

    public_id: UUID
    node_id: str
    title: str
    revision: int
    submitted_at: datetime
    contributors: list[MemberOut]
    reads: bool
    keys: list[QueueKeyOut]


class ReviewOut(Schema):
    revision: int
    items: list[ReviewItemOut]


def _fields_out(node: Node) -> ReviewFieldsOut:
    return ReviewFieldsOut(
        title=node.title,
        claim=node.claim,
        region=node.region,
        level=node.level.value,
        minutes=node.minutes,
        needs=[LinkOut(node=link.node, reason=link.reason) for link in node.needs],
        goes_deeper=[LinkOut(node=link.node, reason=link.reason) for link in node.goes_deeper],
        related=[LinkOut(node=link.node, reason=link.reason) for link in node.related],
    )


def _content(key: Key, given: object | None) -> ReviewContentOut:
    """`given` is the reviewer's answer to the current question: the before's key shows only once
    there is one (M4RS.2)."""
    content = key.content
    asked = question_of(key)
    return ReviewContentOut(
        fields=_fields_out(content) if isinstance(content, Node) else None,
        block=_block_out(content) if isinstance(content, Text | Callout | SequenceBlock) else None,
        resource=_resource_out(content) if isinstance(content, Resource) else None,
        question=None if asked is None else review_question_out(Answered(asked, given, None)),
    )


def _review_item_out(item: Reviewed) -> ReviewItemOut:
    given = None if item.answered is None else item.answered.given
    now = _content(item.key, given)
    return ReviewItemOut(
        fields=now.fields,
        block=now.block,
        resource=now.resource,
        # the current question keeps its graded answer
        question=None if item.answered is None else review_question_out(item.answered),
        key=item.key.key,
        kind=item.key.kind,
        verdict=item.verdict,
        note=item.note,
        change=item.change,
        before=None if item.before is None else _content(item.before, given),
    )


def review_out(sheet: Sheet) -> ReviewOut:
    return ReviewOut(revision=sheet.revision, items=[_review_item_out(i) for i in sheet.items])


class EventOut(Schema):
    """One entry of a draft's log (M4R.5)."""

    kind: str
    by: MemberOut | None
    at: datetime
    revision: int | None
    reason: str
    self_approved: bool
    answered: int | None
    wrong: int | None
    blocks: int | None


# ── Landing (M4.6 spec, M4L.5) ──────────────────────────────────────────────────────────────────


class LandingEntryOut(Schema):
    draft: UUID
    node_id: str
    revision: int
    live: bool
    dropped_code: str
    dropped_reason: str


class LandingOut(Schema):
    public_id: UUID
    state: str
    started_by: MemberOut | None
    started_at: datetime
    main_head: str
    branch: str
    pull_number: int | None
    pull_url: str
    reason: str
    entries: list[LandingEntryOut]


# ── The index (M4.7 spec, M4F.5) ────────────────────────────────────────────────────────────────


class BuildOut(Schema):
    commit: str
    digest: str
    outcome: str
    node_count: int
    created_at: datetime
    problems: list[str]


class RegionChoiceOut(Schema):
    id: str
    name: str


class IndexOut(Schema):
    live: BuildOut | None
    latest: BuildOut | None
    main_head: str | None
    checked_at: datetime | None
    behind: bool
    # The regions a node can be in, in regions.yaml's order, for the workbench (M4K.6).
    regions: list[RegionChoiceOut]
