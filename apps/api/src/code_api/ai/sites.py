"""Every place Code calls a model, declared once (M5.1 spec, M5G.2; invariant 7). The list is
fixed: adding a call site is a reviewed code change. The M7 sites are enabled with their
screens and bounded workers."""

from dataclasses import dataclass
from typing import Literal


@dataclass(frozen=True)
class Site:
    key: str
    label: str
    who: str  # who calls it, as the page says
    refused: str  # what the site does when the gateway refuses, in the page's words
    default_cap: int | None  # calls a day; None: no cap
    wired: Literal["M5", "M7", "ready"]


SITES: tuple[Site, ...] = (
    Site("default", "Default", "—", "no fallback", None, "M5"),
    Site("goal-suggestions", "Goal suggestions", "learners", "plain search", 500, "M5"),
    Site("page-drafting", "Page drafting", "authors", "stop and say so", 200, "M5"),
    Site("figure-data", "Figure data and problems", "authors", "stop and say so", 100, "M5"),
    Site("resource-suggestion", "Resource suggestion", "authors", "search by hand", 100, "M5"),
    Site(
        "block-evaluation", "Block evaluation (judge)", "every draft", "leave unscored", 400, "M5"
    ),
    Site("assistant", "Assistant chats", "team", "stop and say so", 200, "M5"),
    Site("connecting-text", "Connecting text", "weaving", "leave it out", 500, "ready"),
    Site("request-grouping", "Request grouping", "new requests", "leave ungrouped", 100, "ready"),
    Site("skeleton-drafting", "Skeleton drafting", "authors", "stop and say so", 50, "ready"),
)

_BY_KEY = {s.key: s for s in SITES}


def site(key: str) -> Site:
    """The declared site; a KeyError for any other key, so no undeclared site is ever called."""
    return _BY_KEY[key]
