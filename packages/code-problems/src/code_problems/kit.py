"""What a problem kit is (M6.7 spec, M6PR.1): a Strategy that costs its params before anything
runs, generates a learner's dataset, solves it, checks a given answer and names the mistakes it
recognises, each of which it can also make on purpose, for the self-test."""

from collections.abc import Callable, Mapping
from dataclasses import dataclass

from code_problems.rng import Rng

Params = Mapping[str, object]


@dataclass(frozen=True)
class Dataset:
    text: str
    name: str  # what a learner's download is called: <kit>-<seed>.txt
    size: int  # lines


@dataclass(frozen=True)
class Case:
    """A dataset and its answer: what a checker and a mistake maker see (M6PR.1)."""

    params: Params
    dataset: Dataset
    answer: str


@dataclass(frozen=True)
class Verdict:
    right: bool
    mistakes: tuple[str, ...]  # the names the kit declares, in its order
    said: str  # one sentence, counts not answers


@dataclass(frozen=True)
class Kit:
    name: str
    rung: int
    schema: Mapping[str, object]
    rules: Callable[[Params], list[tuple[str, str]]]  # (path, message) beyond the schema
    cost: Callable[[Params], int]  # the dataset's bytes, worked out before anything runs
    generate: Callable[[Params, Rng], Dataset]
    solve: Callable[[Case], str]
    check: Callable[[Case, str], Verdict]
    mistakes: Mapping[str, Callable[[Case], str]]
    max_bytes: int
    # What the builder shows (M6.8b spec, M6PB.4): one line on the kit, one per mistake, and an
    # example a new problem starts from (its params and its sample, which pass the self-test).
    about: str
    says: Mapping[str, str]
    example: Mapping[str, Mapping[str, object]]


def lines_of(text: str) -> list[str]:
    """A given answer read loosely: CRLF, surrounding spaces and blank lines forgiven."""
    return [line.strip() for line in text.splitlines() if line.strip()]
