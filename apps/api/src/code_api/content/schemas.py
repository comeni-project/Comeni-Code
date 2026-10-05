"""Every answer the content endpoints give, in one place (spec M4R.4).

The views import their schemas from here, never from one another. The names are the API's: they are
what openapi.json and the web app's generated types call them.
"""

from typing import Annotated, Literal

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

    Exam questions (T7.1) are scored, and their answers never leave the server.
    """

    id: str
    kind: str
    ask: str
    options: list[OptionOut] | None
    answer: float | None
    unit: str | None
    tolerance: float | None
    hints: list[str]
    rationale: str


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


BlockOut = Annotated[TextBlockOut | TryBlockOut | CalloutBlockOut, Field(discriminator="kind")]


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
