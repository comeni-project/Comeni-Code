"""The three Studio roles of W7.1, ranked (M4.3 spec, M4A.1).

An operator can do anything a reviewer can, and a reviewer anything an author can. One check,
`can_act_as`, holds that rank; nothing else compares roles. *Nobody approves what they drafted*
is a rule about items, enforced where approving is (M4.5), not here.
"""

from django.db import models


class Role(models.TextChoices):
    """In rank order: each role includes the ones before it."""

    AUTHOR = "author"
    REVIEWER = "reviewer"
    OPERATOR = "operator"


_RANK = {role.value: rank for rank, role in enumerate(Role)}


def can_act_as(held: str, wanted: Role) -> bool:
    """Whether a member holding `held` may do what `wanted` may. No role (blank) acts as none."""
    return held in _RANK and _RANK[held] >= _RANK[wanted.value]
