"""Every answer the content endpoints give, in one place (spec M4R.4).

The views import their schemas from here, never from one another. The names are the API's: they are
what openapi.json and the web app's generated types call them.
"""

from typing import Annotated, Any, Literal

from ninja import Schema
from pydantic import Field


class RegionOut(Schema):
    id: str
    name: str


class NeighbourOut(Schema):
    """A neighbour as a card: enough for a node page's side panel (L5) without another request."""

    id: str
    title: str
    level: str
    reason: str


class SideCardOut(NeighbourOut):
    """A neighbour on the node page, with its time: the L5 side column's *level · N min*."""

    minutes: int


class ProviderOut(Schema):
    id: str
    name: str


class ResourceOut(Schema):
    """One entry of the Learn it section (M3P1.2). Our sentence and a link, never their text."""

    kind: str
    provider: ProviderOut
    url: str
    video: str | None  # player:id, which the page plays in place (M3P5.3)
    part: str
    covers: str
    licence: str
    display: str
    level: str


class OptionOut(Schema):
    text: str
    right: bool


class QuestionOut(Schema):
    """A try question, its answer included: it is formative, and the page checks it (M3P1.4).

    `options` for a choice; `answer`, a number with its unit and tolerance or a sequence's text
    with what else it accepts; `steps` for an order, in the right order — the page shuffles them
    (M4.8c spec, M4Q.5). Exam questions (T7.1) are scored, and their answers never leave the
    server.
    """

    id: str
    kind: str
    ask: str
    options: list[OptionOut] | None
    answer: float | str | None
    unit: str | None
    tolerance: float | None
    accept: list[str]
    exact: bool
    steps: list[str] | None
    hints: list[str]
    rationale: str
    figure: str | None = None  # a figure's stem, drawn above the ask (M6FG.1)


class TextBlockOut(Schema):
    kind: Literal["text"]
    markdown: str


class TryBlockOut(Schema):
    """Where a try question sits; the question itself is in `questions`."""

    kind: Literal["try"]
    question: str


class CalloutBlockOut(Schema):
    kind: Literal["callout"]
    callout: Literal["misconception", "caveat", "convention"]
    title: str
    markdown: str


class SequenceBlockOut(Schema):
    """DNA, RNA or protein letters, drawn in groups of ten (M4.8c spec, M4Q.2)."""

    kind: Literal["sequence"]
    letters: str


class MathBlockOut(Schema):
    """A display formula in TeX (M6.2 spec, M6MX.1)."""

    kind: Literal["math"]
    tex: str


class ExampleBlockOut(Schema):
    """A worked example: its title and Markdown (M6MX.2)."""

    kind: Literal["example"]
    title: str
    markdown: str


class ImageBlockOut(Schema):
    """An image from the node's images/ folder, and its caption (M6.3 spec, M6IM.1)."""

    kind: Literal["image"]
    file: str
    caption: str


class FigureBlockOut(Schema):
    """A figure from the node's figures/ folder, by its stem, and its caption (M6.4 spec, M6FG.1);
    the page joins it to the node's figures by stem, as images are joined to their records."""

    kind: Literal["figure"]
    file: str
    caption: str


class FigureSourceOut(Schema):
    """Where a figure's data came from, when it came from elsewhere (M6FG.1)."""

    title: str
    url: str | None


class FigureOut(Schema):
    """A figure's file, read: its component, alt text and data, and what its component computes
    from the data (`derived`, as a track's lanes); a figure block names it by stem (M6FG.5)."""

    stem: str
    component: str
    alt: str
    data: dict[str, Any]
    derived: dict[str, Any]
    source: FigureSourceOut | None


class ImageRecordOut(Schema):
    """An image's credit, as node.yaml records it (M6IM.1)."""

    file: str
    alt: str
    author: str
    source: str | None  # optional (#360)
    licence: str


AnyBlockOut = (
    TextBlockOut
    | TryBlockOut
    | CalloutBlockOut
    | SequenceBlockOut
    | MathBlockOut
    | ExampleBlockOut
    | ImageBlockOut
    | FigureBlockOut
)
BlockOut = Annotated[AnyBlockOut, Field(discriminator="kind")]


class NodeOut(Schema):
    id: str
    title: str
    claim: str
    region: RegionOut
    level: str
    minutes: int
    blocks: list[BlockOut]
    folder: str
    needs: list[SideCardOut]
    goes_deeper: list[SideCardOut]
    related: list[SideCardOut]
    needed_by: list[SideCardOut]
    resources: list[ResourceOut]
    questions: list[QuestionOut]
    images: list[ImageRecordOut] = []  # each file's credit; the file at /images/{file} (M6IM.5)
    figures: list[FigureOut] = []  # each figure, read; a figure block names one by stem (M6FG.5)


class Message(Schema):
    """An error answer: the sentence a person reads, and its diagnostic code (spec M4D.4)."""

    detail: str
    code: str


class StopOut(Schema):
    """A stop as the Route board draws it (L4), with why it is on this route (M2P2.2)."""

    id: str
    title: str
    # The panel's first line, and the page's outcome sentence when the stop is the goal (M3P4.1).
    claim: str
    level: str
    minutes: int
    region: RegionOut
    needed_by: list[NeighbourOut]


class SpanOut(Schema):
    lowest: str
    highest: str


class RouteOut(Schema):
    goals: list[str]
    known: list[str]
    stops: list[StopOut]
    span: SpanOut
    minutes: int


class ResultOut(Schema):
    """A candidate as the Start board's *Is this what you mean?* panel shows it (L1)."""

    id: str
    title: str
    claim: str
    level: str
    minutes: int
    region: RegionOut


class SearchOut(Schema):
    query: str
    # The words that matched nothing anywhere, so the page can name them (M3P2.2).
    unmatched: list[str]
    results: list[ResultOut]
