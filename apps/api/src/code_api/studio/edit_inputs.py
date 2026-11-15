"""Validated edit inputs shared by Studio's routes and drafting adapters."""

from typing import Literal

from ninja import Schema

from code_schema import (
    Answer,
    Block,
    Callout,
    ChoiceAnswer,
    Example,
    ExamQuestion,
    Figure,
    FigureAnswer,
    Image,
    Level,
    Math,
    NumberAnswer,
    Option,
    OrderAnswer,
    SequenceAnswer,
    SequenceBlock,
    Text,
    Try,
    TryQuestion,
)
from code_schema.edits import EditError, write_faithfully


class LinkIn(Schema):
    node: str
    reason: str


class OptionIn(Schema):
    """An option's text, or a figure's stem (M6FA.3): one or the other."""

    text: str = ""
    figure: str | None = None
    right: bool = False
    misconception: str = ""
    plain: bool = False


class BlockIn(Schema):
    """A block as the node's JSON shows it: `text` (markdown), `try` (question), `callout`
    (callout, title, markdown), `sequence` (letters), `math` (tex) or `example` (title,
    markdown)."""

    kind: Literal["text", "try", "callout", "sequence", "math", "example", "image", "figure"]
    markdown: str = ""
    letters: str = ""
    tex: str = ""
    file: str = ""
    caption: str = ""
    question: str = ""
    callout: str = ""
    title: str = ""


class AnswerIn(Schema):
    """A question's answer, flat as the files write it (M4Q.3): `options` for a choice; `answer`,
    `unit` and `tolerance` for a number; `answer` as text, `accept` and `exact` for a sequence;
    `steps` for an order; nothing for a figure question, which its figure answers (M6FA.3)."""

    kind: Literal["choice", "number", "sequence", "order", "figure"]
    options: list[OptionIn] | None = None
    answer: float | int | str | None = None
    unit: str = ""
    tolerance: float | int | None = None
    accept: list[str] = []
    exact: bool = False
    steps: list[str] | None = None


class TryQuestionIn(AnswerIn):
    id: str
    ask: str
    hints: list[str]
    rationale: str
    figure: str | None = None  # a figure's stem, drawn above the ask (M6FG.1)


class ExamQuestionIn(AnswerIn):
    id: str
    title: str
    claim: str = ""
    stem: list[BlockIn]  # blocks, as on a page; code-schema writes the MyST (M4P.3)
    level: Level | None = None
    rationale: str


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


def _answer(given: AnswerIn, figure: str | None = None) -> Answer:
    """As written. Built inside the edit, so a missing answer is an EditError; other malformed
    answers — an order's count, repeated texts — are left for the parse to refuse in its words."""
    match given.kind:
        case "choice":
            return ChoiceAnswer(
                options=tuple(
                    Option(
                        text=o.text,
                        right=o.right,
                        misconception=o.misconception,
                        plain=o.plain,
                        figure=o.figure,
                    )
                    for o in given.options or []
                )
            )
        case "sequence":
            if not isinstance(given.answer, str):
                raise EditError("a sequence question needs its answer as text")
            return SequenceAnswer(value=given.answer, accept=tuple(given.accept), exact=given.exact)
        case "order":
            return OrderAnswer(steps=tuple(given.steps or ()))
        case "figure":
            if figure is None:
                raise EditError("a figure question needs the figure it is answered by")
            return FigureAnswer(figure=figure)
    if given.answer is None or isinstance(given.answer, str):
        raise EditError("a number question needs its answer")
    return NumberAnswer(value=given.answer, unit=given.unit, tolerance=given.tolerance)


def _try_question(given: TryQuestionIn | None) -> TryQuestion | None:
    if given is None:
        return None
    return TryQuestion(
        id=given.id,
        ask=given.ask,
        answer=_answer(given, given.figure),
        hints=tuple(given.hints),
        rationale=given.rationale,
        figure=given.figure or None,
    )


def _exam_question(given: ExamQuestionIn) -> ExamQuestion:
    return ExamQuestion(
        id=given.id,
        title=given.title,
        claim=given.claim,
        stem=write_faithfully([_block(block) for block in given.stem], file="exam.yaml"),
        answer=_answer(given, _stem_figure(given.stem)),
        level=given.level,
        rationale=given.rationale,
    )


def _stem_figure(stem: list[BlockIn]) -> str | None:
    """The figure an exam figure question is answered by: its stem's one figure (M6FA.3)."""
    placed = [block.file for block in stem if block.kind == "figure"]
    return placed[0] if len(placed) == 1 else None


def _block(given: BlockIn) -> Block:
    match given.kind:
        case "try":
            return Try(question=given.question)
        case "callout":
            return Callout(kind=given.callout, title=given.title, markdown=given.markdown)  # type: ignore[arg-type]
        case "sequence":
            return SequenceBlock(letters=given.letters)
        case "math":
            return Math(tex=given.tex)
        case "example":
            return Example(title=given.title, markdown=given.markdown)
        case "image":
            return Image(file=given.file, caption=given.caption)
        case "figure":
            return Figure(file=given.file, caption=given.caption)
    return Text(markdown=given.markdown)
