"""What the Studio drafts API answers (M4.4 spec, M4W.4). Studio sees everything about a node,
answers and the exam pool included: it is the team's, behind `studio(min_role)`."""

from datetime import datetime
from uuid import UUID

from ninja import Schema

from code_api.accounts.api import MemberOut
from code_api.content.schemas import BlockOut, CalloutBlockOut, TextBlockOut, TryBlockOut
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
    contributors: list[MemberOut]


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


class RefusedOut(Schema):
    """A refused save: why, and every problem its files would have (M4W.3)."""

    detail: str
    code: str
    problems: list[ProblemOut]


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
