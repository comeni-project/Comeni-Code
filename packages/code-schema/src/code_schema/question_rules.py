"""The rules one exam question is checked by, as the builder lists them (M4.8d spec, M4P.4).

Each rule names the kinds it applies to and the diagnostic codes that break it; a problem found in
the question (`Problem.question`, M4P.2) with one of those codes fails it, and its message is the
detail. A saved question holds only warnings, so on one an item fails only on a warning.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass

from code_schema.exam import ExamQuestion
from code_schema.problems import Problem


@dataclass(frozen=True)
class Rule:
    says: str
    kinds: frozenset[str]  # empty: every kind
    codes: frozenset[str]


@dataclass(frozen=True)
class RuleCheck:
    says: str
    passed: bool
    detail: str


_EVERY: frozenset[str] = frozenset()

QUESTION_RULES = (
    Rule("A title and a stem", _EVERY, frozenset({"CS0815", "CS0816", "CS0823"})),
    Rule(
        "The stem holds only text and sequences",
        _EVERY,
        frozenset({"CS0817", "CS0416", "CS0417", "CS0418"}),
    ),
    Rule("Level within one step of the node's", _EVERY, frozenset({"CS0814"})),
    Rule("No hints", _EVERY, frozenset({"CS0807"})),
    Rule("A rationale", _EVERY, frozenset({"CS0320"})),
    Rule(
        "One right option of three to five",
        frozenset({"choice"}),
        frozenset({"CS0309", "CS0327", "CS0328", "CS0329", "CS0335", "CS0818"}),
    ),
    Rule(
        "Each wrong option names a misconception or is plain",
        frozenset({"choice"}),
        frozenset({"CS0809", "CS0810", "CS0819", "CS0820", "CS0821"}),
    ),
    Rule(
        "A number, with a sound tolerance",
        frozenset({"number"}),
        frozenset({"CS0311", "CS0312", "CS0315"}),
    ),
    Rule(
        "An answer, and accepted answers as text",
        frozenset({"sequence"}),
        frozenset({"CS0330", "CS0331", "CS0332"}),
    ),
    Rule(
        "Three to eight different steps",
        frozenset({"order"}),
        frozenset({"CS0333", "CS0334", "CS0336"}),
    ),
)


def question_checks(question: ExamQuestion, problems: Sequence[Problem]) -> list[RuleCheck]:
    """The rules for the question's kind, each failed by a problem found in it."""
    own = [problem for problem in problems if problem.question == question.id]
    checks = []
    for rule in QUESTION_RULES:
        if rule.kinds and question.kind not in rule.kinds:
            continue
        broken = [problem for problem in own if problem.code in rule.codes]
        checks.append(RuleCheck(rule.says, not broken, "; ".join(p.message for p in broken)))
    return checks
