"""What the Studio drafts API answers (M4.4 spec, M4W.4). Studio sees everything about a node,
answers and the exam pool included: it is the team's, behind `studio(min_role)`."""

from datetime import datetime
from typing import Literal
from uuid import UUID

from ninja import Schema

from code_api.accounts.api import MemberOut
from code_api.content.schemas import BlockOut, CalloutBlockOut, TextBlockOut, TryBlockOut
from code_api.studio.review import Answered
from code_schema import (
    Answer,
    Callout,
    ChoiceAnswer,
    ExamQuestion,
    Node,
    NumberAnswer,
    Problem,
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


class StudioQuestionOut(Schema):
    """A try question; `options` for a choice, `answer` (with unit and tolerance) for a number."""

    id: str
    kind: str
    ask: str
    options: list[StudioOptionOut] | None
    answer: float | int | None
    unit: str
    tolerance: float | int | None
    hints: list[str]
    rationale: str


class StudioExamQuestionOut(Schema):
    id: str
    kind: str
    ask: str
    level: str | None
    options: list[StudioOptionOut] | None
    answer: float | int | None
    unit: str
    tolerance: float | int | None
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


class DraftOut(DraftSummaryOut):
    """The node, or null with `problems` when its latest revision no longer reads against the
    index's registries (#173)."""

    node: DraftNodeOut | None
    problems: list[ProblemOut]


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

    @staticmethod
    def of(problem: Problem) -> ProblemOut:
        return ProblemOut(
            file=problem.file,
            line=problem.line,
            field=problem.field,
            code=problem.code,
            message=problem.message,
            text=str(problem),
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
    match answer:
        case ChoiceAnswer(options=options):
            return {
                "options": [
                    StudioOptionOut(text=o.text, right=o.right, misconception=o.misconception)
                    for o in options
                ],
                "answer": None,
                "unit": "",
                "tolerance": None,
            }
        case NumberAnswer(value=value, unit=unit, tolerance=tolerance):
            return {"options": None, "answer": value, "unit": unit, "tolerance": tolerance}


def _block_out(block: Text | Try | Callout) -> TextBlockOut | TryBlockOut | CalloutBlockOut:
    match block:
        case Text(markdown=markdown):
            return TextBlockOut(kind="text", markdown=markdown)
        case Callout(kind=kind, title=title, markdown=markdown):
            return CalloutBlockOut(kind="callout", callout=kind, title=title, markdown=markdown)
        case Try(question=question):
            return TryBlockOut(kind="try", question=question)


def _question_out(question: TryQuestion) -> StudioQuestionOut:
    return StudioQuestionOut(
        id=question.id,
        kind=question.kind,
        ask=question.ask,
        hints=list(question.hints),
        rationale=question.rationale,
        **_answer_out(question.answer),  # type: ignore[arg-type]
    )


def _exam_out(question: ExamQuestion) -> StudioExamQuestionOut:
    return StudioExamQuestionOut(
        id=question.id,
        kind=question.kind,
        ask=question.ask,
        level=None if question.level is None else question.level.value,
        rationale=question.rationale,
        **_answer_out(question.answer),  # type: ignore[arg-type]
    )


def node_out(node: Node) -> DraftNodeOut:
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
        resources=[
            StudioResourceOut(
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
            for r in node.resources
        ],
        questions=[_question_out(question) for question in node.questions],
        exam=[_exam_out(question) for question in node.exam],
    )


class VerifyOut(Schema):
    """`clean` when no problem refuses; warnings may still be listed (M4W.5)."""

    clean: bool
    problems: list[ProblemOut]


class ChecklistOut(Schema):
    passed: bool
    items: list[ItemOut]


# ── Review (M4.5 spec, M4R.6) ────────────────────────────────────────────────────────────────────


class ReviewQuestionOut(Schema):
    """One question of the submitted revision, as its reviewer sees it: the key and rationale only
    once they have answered it (M4R.4). A choice is answered by its option's index."""

    id: str
    pool: Literal["try", "exam"]
    kind: str
    ask: str
    options: list[str] | None
    unit: str
    given: float | int | None
    right: bool | None
    right_option: int | None
    value: float | int | None
    tolerance: float | int | None
    rationale: str | None


def review_question_out(answered: Answered) -> ReviewQuestionOut:
    question = answered.asked.question
    shown = answered.given is not None
    right_option = value = tolerance = None
    match question.answer:
        case ChoiceAnswer(options=options):
            texts: list[str] | None = [option.text for option in options]
            unit = ""
            if shown:
                right_option = next(i for i, option in enumerate(options) if option.right)
        case NumberAnswer(value=key, unit=unit, tolerance=within):
            texts = None
            if shown:
                value, tolerance = key, within
    return ReviewQuestionOut(
        id=answered.asked.id,
        pool=answered.asked.pool,
        kind=question.kind,
        ask=question.ask,
        options=texts,
        unit=unit,
        given=answered.given,  # type: ignore[arg-type]
        right=answered.right,
        right_option=right_option,
        value=value,
        tolerance=tolerance,
        rationale=question.rationale if shown else None,
    )


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


class IndexOut(Schema):
    live: BuildOut | None
    latest: BuildOut | None
    main_head: str | None
    checked_at: datetime | None
    behind: bool
