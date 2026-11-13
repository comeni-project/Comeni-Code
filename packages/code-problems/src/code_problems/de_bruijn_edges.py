"""`de-bruijn-edges` (M6.7 spec, M6PR.2), rung 3: Given k and reads, Return every edge of the de
Bruijn graph with k-mers as nodes, one `A -> B` per line, sorted, no duplicates. An edge joins two
k-mers that follow each other in a read (M6DC.1)."""

import json
import re
from pathlib import Path

from code_problems import reads
from code_problems.kit import Case, Dataset, Kit, Params, Verdict, lines_of
from code_problems.rng import Rng

NAME = "de-bruijn-edges"
_EDGE = re.compile(r"^[ACGT]+ -> [ACGT]+$")
SCHEMA = json.loads(
    (Path(__file__).resolve().parent / "schemas" / f"{NAME}.json").read_text(encoding="utf-8")
)


def _int(params: Params, key: str) -> int:
    value = params[key]
    assert isinstance(value, int)
    return value


def rules(params: Params) -> list[tuple[str, str]]:
    found: list[tuple[str, str]] = []
    if _int(params, "read") <= _int(params, "k"):
        found.append(("params.read", "must be longer than k: a read of k letters has no edge"))
    if _int(params, "read") > _int(params, "genome"):
        found.append(("params.read", "must be no longer than the genome it is drawn from"))
    return found


def cost(params: Params) -> int:
    n = reads.count(_int(params, "genome"), _int(params, "read"), _int(params, "coverage"))
    return n * (_int(params, "read") + 1) + len(str(params["k"])) + 1


def generate(params: Params, rng: Rng) -> Dataset:
    errors = params["errors"]
    assert isinstance(errors, int | float)
    drawn = reads.draw(
        rng, _int(params, "genome"), _int(params, "read"), _int(params, "coverage"), errors
    )
    return Dataset(
        reads.written(_int(params, "k"), drawn), f"{NAME}-{rng.seed}.txt", len(drawn) + 1
    )


def solve(case: Case) -> str:
    k, drawn = reads.parse(case.dataset.text)
    edges = {
        f"{a} -> {b}"
        for read in drawn
        for a, b in zip(reads.kmers_of(read, k), reads.kmers_of(read, k)[1:], strict=False)
    }
    return "\n".join(sorted(edges))


def _swap(line: str) -> str:
    a, b = line.split(" -> ")
    return f"{b} -> {a}"


def check(case: Case, given: str) -> Verdict:
    expected = case.answer.splitlines()
    lines = lines_of(given)
    told = f"Your list has {len(lines):,} lines; the answer has {len(expected):,}."
    if not all(_EDGE.match(line) for line in lines):
        return Verdict(
            False, (), "Write each edge as A -> B, one per line, with a space either side."
        )
    if lines == expected:
        return Verdict(True, (), "")
    have, want = set(lines), set(expected)
    found: list[str] = []
    if {_swap(line) for line in have} == want:
        found.append("reversed")
    if len(lines) != len(have):
        found.append("duplicates")
    if "reversed" not in found:
        if have - want:
            found.append("extra")
        if want - have:
            found.append("missing")
    if have == want and len(lines) == len(have) and lines != sorted(lines):
        found.append("unsorted")
    return Verdict(False, tuple(found), told)


def _missing(case: Case) -> str:
    return "\n".join(case.answer.splitlines()[1:])


def _duplicates(case: Case) -> str:
    lines = case.answer.splitlines()
    return "\n".join([lines[0], *lines])


def _extra(case: Case) -> str:
    """An edge no read can hold: AAA… to CCC… do not overlap by k − 1 (#417)."""
    k, _ = reads.parse(case.dataset.text)
    return "\n".join(sorted([*case.answer.splitlines(), f"{'A' * k} -> {'C' * k}"]))


def _unsorted(case: Case) -> str:
    return "\n".join(reversed(case.answer.splitlines()))


def _reversed(case: Case) -> str:
    return "\n".join(sorted(_swap(line) for line in case.answer.splitlines()))


KIT = Kit(
    name=NAME,
    rung=3,
    schema=SCHEMA,
    rules=rules,
    cost=cost,
    generate=generate,
    solve=solve,
    check=check,
    mistakes={
        "duplicates": _duplicates,
        "missing": _missing,
        "extra": _extra,
        "unsorted": _unsorted,
        "reversed": _reversed,
    },
    max_bytes=120_000,
    about="k and some reads; the learner returns every edge of their de Bruijn graph, once each.",
    says={
        "duplicates": "an edge listed more than once",
        "missing": "edges left out",
        "extra": "an edge no read holds",
        "unsorted": "the right edges, out of order",
        "reversed": "B -> A for A -> B",
    },
    example={
        "params": {"k": 4, "genome": 300, "read": 30, "coverage": 8, "errors": 0},
        "sample": {
            "seed": 1,
            "params": {"k": 3, "genome": 7, "read": 5, "coverage": 2, "errors": 0},
        },
    },
)
