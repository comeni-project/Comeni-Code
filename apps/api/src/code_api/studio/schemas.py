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
from code_api.studio.review import Answered
from code_schema import (
    Answer,
    Callout,
    ChoiceAnswer,
    ExamQuestion,
    Node,
    NumberAnswer,
    OrderAnswer,
    Problem,
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
        exam=[_exam_out(question, live or {}) for question in node.exam],
    )


class VerifyOut(Schema):
    """`clean` when no problem refuses; warnings may still be listed (M4W.5)."""

    clean: bool
    problems: list[ProblemOut]


class ChecklistOut(Schema):
    """The checklist, and the problems behind it, so Checks is one request (M4K.6)."""

    passed: bool
    items: list[ItemOut]
    problems: list[ProblemOut] = []


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
    steps: list[str] | None  # an order's steps, sorted, so the right order never shows first
    given: Any
    right: bool | None
    right_option: int | None
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
        given=answered.given,
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
