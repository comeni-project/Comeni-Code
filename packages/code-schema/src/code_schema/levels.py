"""The five content levels (tutor spec T10.1).

Its own module so that resources, questions and nodes can all name a level without importing one
another: `node.py` re-exports `Level`, which is where every earlier part imported it from.
"""

from __future__ import annotations

from enum import StrEnum


class Level(StrEnum):
    """T10.1's five. A level describes a node, never a learner."""

    FIRST_STEPS = "first-steps"
    FOUNDATIONS = "foundations"
    INTRODUCTORY = "introductory"
    INTERMEDIATE = "intermediate"
    ADVANCED = "advanced"
