"""Comeni Code's problem kits (M6.7 spec, M6PR.1). Pure: no web framework, HTTP client or model
library. A problem names a kit and fills its params; the kit generates a learner's dataset from a
seed, solves it, and checks an answer, naming the mistakes it recognises."""

from code_problems.kit import Case, Dataset, Kit, Verdict
from code_problems.registry import KITS
from code_problems.rng import Rng
from code_problems.self_test import CODES, SelfTest, self_test

__all__ = ["CODES", "KITS", "Case", "Dataset", "Kit", "Rng", "SelfTest", "Verdict", "self_test"]
