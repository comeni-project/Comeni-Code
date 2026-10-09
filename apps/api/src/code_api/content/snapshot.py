"""The index as a read model (M4.4 spec, M4W.0, M4W.2): rows back into `code-schema`'s types.

The source of truth is the content repository's files; the index is their projection, and this is
its read side for Studio: a draft starts from `node_from_index`, and a draft's files are checked
with `regions_from_index` and `providers_from_index`, as CI checks the files. It is lossless:
every fixture node reads back byte for byte (tests/test_snapshot.py).
"""

from code_api.content import models
from code_api.content.numbers import number_from
from code_schema import (
    Answer,
    ChoiceAnswer,
    ExamQuestion,
    Level,
    Link,
    Node,
    NumberAnswer,
    Option,
    OrderAnswer,
    Provider,
    Region,
    Resource,
    SequenceAnswer,
    TryQuestion,
    block_from_json,
    write_blocks,
)


def regions_from_index() -> dict[str, Region]:
    return {
        row.id: Region(id=row.id, name=row.name)
        for row in models.Region.objects.order_by("position")
    }


def providers_from_index() -> dict[str, Provider]:
    return {
        row.id: Provider(
            id=row.id,
            name=row.name,
            licences=tuple(row.licences),
            embed=row.embed,
            players=tuple(row.players),
        )
        for row in models.Provider.objects.order_by("position")
    }


def _answer(row: models.Question | models.ExamQuestion) -> Answer:
    """A row's answer, by its kind (M4Q.5)."""
    match row.kind:
        case "choice":
            return ChoiceAnswer(
                options=tuple(
                    Option(
                        text=option["text"],
                        right=option["right"],
                        misconception=option.get("misconception", ""),
                        plain=option.get("plain", False),
                    )
                    for option in row.options
                )
            )
        case "sequence":
            assert row.answer is not None  # a sequence question always has its answer
            return SequenceAnswer(value=row.answer, accept=tuple(row.accept), exact=row.exact)
        case "order":
            return OrderAnswer(steps=tuple(row.steps))
    value = number_from(row.answer)
    assert value is not None  # a number question always has its answer
    return NumberAnswer(value=value, unit=row.unit, tolerance=number_from(row.tolerance))


def node_from_index(node_id: str) -> Node | None:
    """The node as its files hold it, or None when the index has no such node."""
    row = models.Node.objects.filter(id=node_id).first()
    if row is None:
        return None
    links: dict[str, list[Link]] = {kind: [] for kind in models.Link.Kind}
    for link in row.links_out.order_by("kind", "position"):
        links[link.kind].append(Link(node=link.target_id, reason=link.reason))
    return Node(
        id=row.id,
        title=row.title,
        claim=row.claim,
        region=row.region_id,
        level=Level(row.level),
        minutes=row.minutes,
        body=write_blocks([block_from_json(block) for block in row.blocks]),
        needs=tuple(links[models.Link.Kind.NEEDS]),
        goes_deeper=tuple(links[models.Link.Kind.GOES_DEEPER]),
        related=tuple(links[models.Link.Kind.RELATED]),
        resources=tuple(
            Resource(
                kind=resource.kind,
                provider=resource.provider_id,
                url=resource.url,
                covers=resource.covers,
                licence=resource.licence,
                display=resource.display,
                level=Level(resource.level),
                part=resource.part,
                video=resource.video,
            )
            for resource in row.resources.order_by("position")
        ),
        questions=tuple(
            TryQuestion(
                id=question.question_id,
                ask=question.ask,
                answer=_answer(question),
                hints=tuple(question.hints),
                rationale=question.rationale,
            )
            for question in row.questions.order_by("position")
        ),
        exam=tuple(
            ExamQuestion(
                id=question.question_id,
                title=question.title,
                claim=question.claim,
                stem=write_blocks([block_from_json(block) for block in question.stem]),
                answer=_answer(question),
                level=None if question.level is None else Level(question.level),
                rationale=question.rationale,
            )
            for question in row.exam.order_by("position")
        ),
    )
