"""A node's problem (M6.7 spec, M6PR.3–M6PR.5): `problem.yaml`, read, checked against its kit by
the 20-seed self-test once per text, and its sample computed. Kept as written, as a figure file
is: it is edited whole."""

from __future__ import annotations

from collections.abc import Collection, Mapping
from dataclasses import dataclass, replace

from code_problems import KITS, Case, Dataset, SelfTest, self_test

from code_schema.problems import Problem
from code_schema.yaml_lines import load_mapping

PROBLEM_FILE = "problem.yaml"
_KEYS = (
    "title",
    "rung",
    "statement",
    "given",
    "return",
    "kit",
    "params",
    "sample",
    "hints",
    "mistakes",
    "rationale",
)
_TEXTS = ("title", "statement", "given", "return", "rationale")
# The self-test is deterministic: run once per text and the callouts it is held to (M6PR.4).
_RUNS: dict[tuple[str, frozenset[str]], tuple[ProblemFile | None, tuple[Problem, ...]]] = {}


@dataclass(frozen=True)
class ProblemFile:
    text: str  # the file as written
    title: str
    rung: int
    statement: str
    given: str
    returns: str
    kit: str
    params: Mapping[str, object]
    sample_seed: int
    sample_params: Mapping[str, object]
    hints: tuple[str, ...]
    mistakes: Mapping[str, str]  # a mistake the kit names → a misconception callout's title
    rationale: str
    sample: Case  # computed from the sample's seed and params, never typed


def read_problem(
    text: str, *, file: str, misconceptions: Collection[str]
) -> tuple[ProblemFile | None, list[Problem]]:
    """One problem.yaml, its self-test run once per text. Never raises."""
    key = (text, frozenset(misconceptions))
    if key not in _RUNS:
        read, problems = _read(text, file, misconceptions)
        _RUNS[key] = (read, tuple(problems))
    found, kept = _RUNS[key]
    # Cached without regard to the file: each caller's problems name its own (#419).
    return found, [replace(problem, file=file) for problem in kept]


def _read(
    text: str, file: str, misconceptions: Collection[str]
) -> tuple[ProblemFile | None, list[Problem]]:
    data, lines, problems = load_mapping(text, file=file)
    if data is None:
        return None, problems

    def wrong(code: str, message: str, key: str | None = None) -> None:
        line = None if key is None else lines.get(key)
        problems.append(Problem(file=file, line=line, code=code, message=message))

    for name in data:
        if name not in _KEYS:
            wrong("CS1107", f"unknown key `{name}` in a problem ({', '.join(_KEYS)})", str(name))
    for name in (*_TEXTS, "rung", "kit", "params", "sample"):
        if name not in data:
            wrong("CS1107", f"the problem has no {name}")
    for name in _TEXTS:
        if name in data and (not isinstance(data[name], str) or not str(data[name]).strip()):
            wrong("CS1107", f"{name} must be text", name)
    rung = data.get("rung")
    if "rung" in data and (isinstance(rung, bool) or rung not in (1, 2, 3, 4)):
        wrong("CS1107", f"{rung!r} is not a rung (1 to 4)", "rung")
    given_hints = data.get("hints", [])
    hints = [str(h) for h in given_hints] if isinstance(given_hints, list) else []
    if (
        not isinstance(given_hints, list)
        or not 1 <= len(given_hints) <= 3
        or not all(isinstance(h, str) and h.strip() for h in given_hints)
    ):
        wrong("CS1107", "hints must be a list of one to three lines", "hints")
    sample = data.get("sample")
    if "sample" in data and (
        not isinstance(sample, dict)
        or set(sample) != {"seed", "params"}
        or isinstance(sample["seed"], bool)
        or not isinstance(sample["seed"], int)
        or not 0 <= sample["seed"] < 1 << 64
        or not isinstance(sample["params"], dict)
    ):
        wrong("CS1107", "sample must be a seed (0 to 2⁶⁴ − 1) and its params", "sample")
    if "params" in data and not isinstance(data.get("params"), dict):
        wrong("CS1107", "params must be a mapping", "params")
    given_mistakes = data.get("mistakes", {})
    mistakes: dict[str, str] = {}
    if isinstance(given_mistakes, dict) and all(
        isinstance(k, str) and isinstance(v, str) for k, v in given_mistakes.items()
    ):
        mistakes = {str(k): str(v) for k, v in given_mistakes.items()}
    else:
        wrong("CS1107", "mistakes must map a mistake to a callout's title", "mistakes")
    kit = data.get("kit")
    if "kit" in data and kit not in KITS:
        wrong("CS1106", f"{kit} is not a problem kit ({', '.join(sorted(KITS))})", "kit")
    if problems:
        return None, problems
    assert isinstance(kit, str) and isinstance(sample, dict)
    for mistake, title in mistakes.items():
        if mistake not in KITS[kit].mistakes:
            known = ", ".join(KITS[kit].mistakes)
            wrong("CS1110", f"{kit} names no mistake {mistake} ({known})", "mistakes")
        elif title not in misconceptions:
            wrong("CS1110", f"no misconception callout in the body is titled {title}", "mistakes")
    if problems:
        return None, problems
    params = data["params"]
    assert isinstance(params, dict)
    tested: SelfTest = self_test(kit, params, sample, list(mistakes))
    for found in tested.findings:
        wrong(found.code, f"{found.path}: {found.message}")
    if tested.sample is None:
        return None, problems
    answer = [line for line in tested.sample.answer.splitlines() if line.strip()]
    for hint in hints:
        if any(line in hint for line in answer):
            wrong("CS1111", "a hint holds the sample's answer", "hints")
            return None, problems
    return (
        ProblemFile(
            text=text,
            title=str(data["title"]),
            rung=int(str(rung)),
            statement=str(data["statement"]),
            given=str(data["given"]),
            returns=str(data["return"]),
            kit=kit,
            params=params,
            sample_seed=int(sample["seed"]),
            sample_params=sample["params"],
            hints=tuple(hints),
            mistakes=dict(mistakes),
            rationale=str(data["rationale"]),
            sample=tested.sample,
        ),
        [],
    )


def stored_problem(text: str, sample_dataset: str, sample_output: str) -> ProblemFile:
    """A problem as the index stored it, after it validated, with the sample computed then: no
    self-test, so a kit tightened since cannot make the index unreadable (#420). Whether it still
    validates is for the draft's own read to say."""
    data, _, _ = load_mapping(text, file=PROBLEM_FILE)
    assert data is not None  # the index stores only files that read
    kit, sample, params = str(data["kit"]), data["sample"], data["params"]
    assert isinstance(sample, dict) and isinstance(params, dict)
    seed = int(sample["seed"])
    lines = sample_dataset.splitlines()
    dataset = Dataset(sample_dataset, f"{kit}-{seed}.txt", len(lines))
    hints = data.get("hints", [])
    mistakes = data.get("mistakes", {})
    assert isinstance(hints, list) and isinstance(mistakes, dict)
    return ProblemFile(
        text=text,
        title=str(data["title"]),
        rung=int(str(data["rung"])),
        statement=str(data["statement"]),
        given=str(data["given"]),
        returns=str(data["return"]),
        kit=kit,
        params=params,
        sample_seed=seed,
        sample_params=sample["params"],
        hints=tuple(str(h) for h in hints),
        mistakes={str(k): str(v) for k, v in mistakes.items()},
        rationale=str(data["rationale"]),
        sample=Case(sample["params"], dataset, sample_output),
    )
