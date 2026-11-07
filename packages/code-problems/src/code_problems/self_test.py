"""The 20-seed self-test (M6.7 spec, M6PR.4). For the sample and seeds 0–19: the params fit,
the cost is within the kit's limit before anything runs, the checker accepts the solver's answer,
each mistake a problem maps is caught as that mistake, and the answers differ between learners.
Findings carry CS1101–CS1105, declared in code-schema's registry, as code-figures' do."""

from collections.abc import Iterable, Mapping
from dataclasses import dataclass

from code_figures.findings import Finding
from code_figures.schema import validate
from code_problems import registry
from code_problems.kit import Case, Kit, Params
from code_problems.rng import Rng

PARAMS = "CS1101"  # params outside the kit's schema or rules
COST = "CS1102"  # a dataset past the kit's limit
REFUSED = "CS1103"  # the solver's answer refused by the checker
UNCAUGHT = "CS1104"  # a mapped mistake not caught as itself
ALIKE = "CS1105"  # answers alike between learners
CODES = frozenset({PARAMS, COST, REFUSED, UNCAUGHT, ALIKE})
SEEDS = range(20)
DISTINCT = 18  # of the 20 answers, at least this many different


@dataclass(frozen=True)
class SelfTest:
    findings: list[Finding]
    sample: Case | None


def _fits(kit: Kit, params: Params, path: str) -> list[Finding]:
    found = [Finding(PARAMS, f.path, f.message) for f in validate(kit.schema, params, path)]
    if found:
        return found
    return [
        Finding(PARAMS, where.replace("params", path, 1), message)
        for where, message in kit.rules(params)
    ]


def case_at(kit: Kit, params: Params, seed: int) -> Case:
    dataset = kit.generate(params, Rng(seed))
    return Case(params, dataset, kit.solve(Case(params, dataset, "")))


def _seed(
    kit: Kit, params: Params, at: int, mapped: list[str]
) -> tuple[Case | None, list[Finding]]:
    """One seed's run. A kit's bug never escapes: it is CS1103 for that seed (#417)."""
    found: list[Finding] = []
    try:
        case = case_at(kit, params, at)
        if not kit.check(case, case.answer).right:
            return None, [Finding(REFUSED, "kit", f"seed {at}: the solver's own answer is refused")]
        for name in mapped:
            if name not in kit.mistakes:
                continue  # a mistake the kit does not declare is for code-schema to say
            verdict = kit.check(case, kit.mistakes[name](case))
            if verdict.right or name not in verdict.mistakes:
                said = f"seed {at}: the mistake {name} is not caught as itself"
                found.append(Finding(UNCAUGHT, f"mistakes.{name}", said))
    except Exception as error:  # noqa: BLE001 — any kit failure is reported, never raised
        return None, [Finding(REFUSED, "kit", f"seed {at}: the kit failed ({error})")]
    return case, found


def self_test(
    kit_name: str, params: Params, sample: Mapping[str, object], mapped: Iterable[str]
) -> SelfTest:
    kit = registry.KITS[kit_name]
    seed, small = sample["seed"], sample["params"]
    assert isinstance(seed, int) and isinstance(small, Mapping)
    found = _fits(kit, params, "params") + _fits(kit, small, "sample.params")
    if found:
        return SelfTest(found, None)
    for where, what in (("params", params), ("sample.params", small)):
        if kit.cost(what) > kit.max_bytes:
            said = f"asks for {kit.cost(what):,} bytes; {kit.name} makes at most {kit.max_bytes:,}"
            found.append(Finding(COST, where, said))
    if found:
        return SelfTest(found, None)
    names = list(mapped)
    cases: list[Case] = []
    for what, at in [(small, seed)] + [(params, s) for s in SEEDS]:
        case, seen = _seed(kit, what, at, names)
        found += seen
        if case is not None:
            cases.append(case)
    answers = {case.answer for case in cases[1:]}
    if not found and len(answers) < DISTINCT:
        said_alike = (
            f"seeds 0–19 give {len(answers)} different answers; at least {DISTINCT} are needed"
        )
        found.append(Finding(ALIKE, "params", said_alike))
    return SelfTest(found, cases[0] if not found else None)
