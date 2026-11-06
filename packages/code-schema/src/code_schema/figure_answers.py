"""Where a figure that asks a question may go, and the selections that answer it (M6.6b spec,
M6FA.1, M6FA.3).

A figure whose file has a task is a question's: the figure of a `kind: figure` question and nothing
else. A figure question's figure must have one. Each `FigureAnswer` takes its `accept` from what
the figure's component computes, so grading needs nothing but the answer.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import replace

from code_figures import derived
from code_schema.blocks import Block, Figure
from code_schema.exam import EXAM_FILE, ExamQuestion
from code_schema.figures import FigureFile
from code_schema.problems import Problem
from code_schema.questions import Answer, ChoiceAnswer, FigureAnswer, TryQuestion

BODY_FILE = "body.md"
NODE_FILE = "node.yaml"
ASKS = "CS1029"  # a figure with a task placed where nothing answers it


def _accept(figure: FigureFile) -> tuple[tuple[str, ...], ...]:
    assert figure.interact is not None
    answer = derived(figure.component, figure.data, figure.interact)["answer"]
    assert isinstance(answer, dict)
    return tuple(tuple(selection) for selection in answer["accept"])


def _options(answer: Answer) -> list[str]:
    if not isinstance(answer, ChoiceAnswer):
        return []
    return [option.figure for option in answer.options if option.figure is not None]


def placements(
    blocks: Sequence[Block], questions: Sequence[TryQuestion], exam: Sequence[ExamQuestion]
) -> set[str]:
    """The stems a node places: by its body, its try questions, its exam stems (M6FG.1) and the
    options that are figures, in either pool (M6FA.3)."""
    stems = [block for question in exam for block in question.blocks]
    placed = {b.file for b in (*blocks, *stems) if isinstance(b, Figure)}
    placed |= {q.figure for q in questions if q.figure is not None}
    answers = [q.answer for q in questions] + [q.answer for q in exam]
    return placed | {stem for answer in answers for stem in _options(answer)}


def figure_answers(
    blocks: Sequence[Block],
    questions: Sequence[TryQuestion],
    exam: Sequence[ExamQuestion],
    figures: Sequence[FigureFile],
    *,
    where: str,
) -> tuple[tuple[TryQuestion, ...], tuple[ExamQuestion, ...], list[Problem]]:
    """The questions with each figure answer's `accept` filled, and every misplaced task figure."""
    tasked = {figure.stem: figure for figure in figures if figure.interact is not None}
    read = {figure.stem for figure in figures}
    problems: list[Problem] = []

    def asks(stem: str, file: str, question: str | None = None) -> None:
        problems.append(
            Problem(
                file=f"{where}{file}",
                code=ASKS,
                message=f"{stem} asks a question (it has a task): it can only be a figure "
                "question's figure",
                question=question,
            )
        )

    for block in blocks:
        if isinstance(block, Figure) and block.file in tasked:
            asks(block.file, BODY_FILE)

    tries: list[TryQuestion] = []
    for question in questions:
        answer = question.answer
        if isinstance(answer, FigureAnswer):
            if answer.figure in tasked:
                answer = replace(answer, accept=_accept(tasked[answer.figure]))
            elif answer.figure in read:
                problems.append(
                    Problem(
                        file=f"{where}{NODE_FILE}",
                        code="CS0338",
                        message=f"{answer.figure} has no task: give it one in the composer's "
                        "Interaction step",
                        question=question.id,
                    )
                )
        elif question.figure in tasked:
            asks(question.figure, NODE_FILE, question.id)
        for stem in _options(answer):
            if stem in tasked:
                asks(stem, NODE_FILE, question.id)
        tries.append(replace(question, answer=answer))

    pool: list[ExamQuestion] = []
    for asked in exam:
        answer = asked.answer
        if isinstance(answer, FigureAnswer):
            if answer.figure in tasked:
                answer = replace(answer, accept=_accept(tasked[answer.figure]))
            elif answer.figure in read:
                problems.append(
                    Problem(
                        file=f"{where}{EXAM_FILE}",
                        code="CS0824",
                        message=f"{answer.figure} has no task: give it one in the composer's "
                        "Interaction step",
                        question=asked.id,
                    )
                )
        else:
            for block in asked.blocks:
                if isinstance(block, Figure) and block.file in tasked:
                    asks(block.file, EXAM_FILE, asked.id)
        for stem in _options(answer):
            if stem in tasked:
                asks(stem, EXAM_FILE, asked.id)
        pool.append(replace(asked, answer=answer))
    return tuple(tries), tuple(pool), problems
