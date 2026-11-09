"""`count-kmers` (M6.7 spec, M6PR.2), rung 1: Given k and reads, Return how many distinct k-mers
they hold. The genome's length is drawn from a range, since a count varies between learners only
if the dataset's size does."""

import json
import re
from pathlib import Path

from code_problems import reads
from code_problems.kit import Case, Dataset, Kit, Params, Verdict
from code_problems.rng import Rng

NAME = "count-kmers"
_WHOLE = re.compile(r"[0-9]{1,3}(,[0-9]{3})*|[0-9]+")
SCHEMA = json.loads(
    (Path(__file__).resolve().parent / "schemas" / f"{NAME}.json").read_text(encoding="utf-8")
)


def _int(params: Params, key: str) -> int:
    value = params[key]
    assert isinstance(value, int)
    return value


def _span(params: Params) -> tuple[int, int]:
    span = params["genome"]
    assert isinstance(span, list)
    return int(span[0]), int(span[1])


def rules(params: Params) -> list[tuple[str, str]]:
    low, high = _span(params)
    found: list[tuple[str, str]] = []
    if low > high:
        found.append(("params.genome", "the shortest length comes first"))
    if _int(params, "read") <= _int(params, "k"):
        found.append(("params.read", "must be longer than k"))
    if _int(params, "read") > low:
        found.append(("params.read", "must be no longer than the shortest genome"))
    return found


def cost(params: Params) -> int:
    n = reads.count(_span(params)[1], _int(params, "read"), _int(params, "coverage"))
    return n * (_int(params, "read") + 1) + len(str(params["k"])) + 1


def generate(params: Params, rng: Rng) -> Dataset:
    low, high = _span(params)
    errors = params["errors"]
    assert isinstance(errors, int | float)
    genome = low + rng.below(high - low + 1)
    drawn = reads.draw(rng, genome, _int(params, "read"), _int(params, "coverage"), errors)
    text = reads.written(_int(params, "k"), drawn)
    return Dataset(text, f"{NAME}-{rng.seed}.txt", len(drawn) + 1)


def _counted_all(case: Case) -> int:
    k, drawn = reads.parse(case.dataset.text)
    return sum(len(read) - k + 1 for read in drawn)


def solve(case: Case) -> str:
    k, drawn = reads.parse(case.dataset.text)
    return str(len({kmer for read in drawn for kmer in reads.kmers_of(read, k)}))


def check(case: Case, given: str) -> Verdict:
    said = given.strip()
    # ASCII digits only, commas only between groups of three (#418): str.isdigit takes ².
    if not _WHOLE.fullmatch(said):
        return Verdict(False, (), "Write one whole number.")
    digits = said.replace(",", "")
    # A count has at most 20 digits; int() refuses past 4,300 (#427).
    if len(digits) > 20:
        return Verdict(False, (), "Write one whole number.")
    value = int(digits)
    if value == int(case.answer):
        return Verdict(True, (), "")
    told = f"Your count is {value:,}."
    if value == _counted_all(case):
        return Verdict(False, ("counted-all",), told)
    _, drawn = reads.parse(case.dataset.text)
    if value == _counted_all(case) - len(drawn):
        return Verdict(False, ("off-by-one",), told)
    return Verdict(False, (), told)


def _off_by_one(case: Case) -> str:
    _, drawn = reads.parse(case.dataset.text)
    return str(_counted_all(case) - len(drawn))


KIT = Kit(
    name=NAME,
    rung=1,
    schema=SCHEMA,
    rules=rules,
    cost=cost,
    generate=generate,
    solve=solve,
    check=check,
    mistakes={"counted-all": lambda case: str(_counted_all(case)), "off-by-one": _off_by_one},
    max_bytes=120_000,
    about="k and some reads; the learner returns how many distinct k-mers the reads hold.",
    says={
        "counted-all": "every read's k-mers summed, not the distinct ones",
        "off-by-one": "L - k k-mers in a read of length L, not L - k + 1",
    },
    example={
        "params": {"k": 8, "genome": [300, 400], "read": 30, "coverage": 8, "errors": 0},
        "sample": {
            "seed": 1,
            "params": {"k": 3, "genome": [7, 9], "read": 5, "coverage": 2, "errors": 0},
        },
    },
)
