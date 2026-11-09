"""A node's problem for its page (M6.8a spec, M6LP.2–M6LP.4): what the page shows, the version a
dataset is made from, a seed's dataset, and a learner's answer checked by the problem's kit.

The kit runs here, in the request; nothing about the learner is stored. The answer is never sent.
"""

import hashlib
import re

from code_problems import Case, Dataset, Rng, registry
from code_problems.kit import Kit

from code_api.content.models import NodeProblem
from code_api.content.schemas import AnswerOut, ProblemShownOut
from code_schema.problem_file import ProblemFile, stored_problem

# A version per problem text and kit, within this process: a deploy restarts it (M6LP.2).
_VERSIONS: dict[tuple[str, int], str] = {}
_DIGITS = re.compile(r"[0-9]{1,20}")


def stored(row: NodeProblem) -> ProblemFile:
    """The problem as the index stored it, with no self-test (#420)."""
    return stored_problem(row.text, row.sample_dataset, row.sample_output)


def _kit(problem: ProblemFile) -> Kit:
    return registry.KITS[problem.kit]


def callouts(problem: ProblemFile, named: tuple[str, ...] | None = None) -> list[str]:
    """The callout titles the file maps mistakes to, in the kit's order, each once; only those
    `named` mistakes when given."""
    titles: list[str] = []
    for mistake in _kit(problem).mistakes:
        if named is not None and mistake not in named:
            continue
        title = problem.mistakes.get(mistake)
        if title is not None and title not in titles:
            titles.append(title)
    return titles


def shown(problem: ProblemFile) -> ProblemShownOut:
    """What a page shows of a problem: never its params, its mistakes'
    names, its rationale or an answer."""
    return ProblemShownOut(
        title=problem.title,
        rung=problem.rung,
        statement=problem.statement,
        given=problem.given,
        returns=problem.returns,
        sample_dataset=problem.sample.dataset.text,
        sample_output=problem.sample.answer,
        hints=list(problem.hints),
        callouts=callouts(problem),
        kit=problem.kit,
        size=_kit(problem).cost(problem.params),
    )


def dataset(problem: ProblemFile, seed: int) -> Dataset:
    return _kit(problem).generate(problem.params, Rng(seed))


def version(problem: ProblemFile) -> str:
    """The text and the kit's own run at seed 0, hashed: a changed kit is a changed version."""
    kit = _kit(problem)
    key = (problem.text, id(kit))
    if key not in _VERSIONS:
        made = kit.generate(problem.params, Rng(0))
        answer = kit.solve(Case(problem.params, made, ""))
        whole = "\0".join((problem.text, made.text, answer))
        _VERSIONS[key] = hashlib.sha256(whole.encode()).hexdigest()[:12]
    return _VERSIONS[key]


def seed_of(text: str) -> int | None:
    """A seed as the page sends it: digits, below 2**64 (M6LP.1); None otherwise."""
    if not _DIGITS.fullmatch(text):
        return None
    seed = int(text)
    return seed if seed < 2**64 else None


def verdict(problem: ProblemFile, seed: int, given: str) -> AnswerOut:
    """The kit's check of an answer to this seed's dataset: never the answer, the rationale only
    when right (M6LP.4). A byte-order mark a Windows editor wrote is dropped first."""
    kit = _kit(problem)
    made = dataset(problem, seed)
    answer = kit.solve(Case(problem.params, made, ""))
    found = kit.check(Case(problem.params, made, answer), given.removeprefix("\ufeff"))
    return AnswerOut(
        right=found.right,
        said=found.said,
        callouts=callouts(problem, found.mistakes),
        rationale=problem.rationale if found.right else None,
    )


def forget() -> None:
    """Drop the kept versions (a test that swaps a kit)."""
    _VERSIONS.clear()
