"""Words to candidate goals, with no model (spec M3P2.2).

W3.3's step 1 has two halves: a model reads what someone typed, and a search answers when there
is no model or the model is unsure. This is that search, and M5's model sits in front of it
without changing it.

A target is not a `Topic`: the weave carries no prose, and search is nothing but prose. The
caller builds the cards, as it does for a route's stops.
"""

from __future__ import annotations

import re
from collections.abc import Iterable
from dataclasses import dataclass

# Words that say how a question is asked rather than what it is about. Apostrophes are removed
# before this list is applied, so "don't" is looked up as "dont".
STOP_WORDS = frozenset(
    [
        "a",
        "and",
        "are",
        "arent",
        "as",
        "at",
        "be",
        "but",
        "by",
        "cant",
        "do",
        "does",
        "doesnt",
        "dont",
        "for",
        "from",
        "how",
        "i",
        "im",
        "in",
        "is",
        "isnt",
        "it",
        "its",
        "ive",
        "me",
        "my",
        "no",
        "not",
        "of",
        "on",
        "or",
        "that",
        "the",
        "this",
        "to",
        "was",
        "wasnt",
        "what",
        "when",
        "where",
        "which",
        "who",
        "why",
        "with",
        "wont",
        "you",
        "your",
        "youre",
    ]
)

ID, TITLE, CLAIM = 3, 2, 1
ID_BONUS, TITLE_BONUS = 4, 2

_WORDS = re.compile(r"[a-z0-9]+")


@dataclass(frozen=True)
class Target:
    """A topic as search sees it. Bodies are not searched: a goal is a topic (M3P2.1)."""

    id: str
    title: str
    claim: str


@dataclass(frozen=True)
class Found:
    words: tuple[str, ...]
    ids: tuple[str, ...]
    unmatched: tuple[str, ...]


def _words(text: str) -> tuple[str, ...]:
    """Folded, split on anything but letters and digits, stopped — unless that leaves nothing.

    Apostrophes go first, so "don't" is one word to stop rather than "don" and a stray "t".
    """
    plain = text.casefold().replace("'", "").replace("\u2019", "")
    found = tuple(_WORDS.findall(plain))
    kept = tuple(word for word in found if word not in STOP_WORDS)
    return kept or found


def _hits(word: str, among: tuple[str, ...]) -> bool:
    """A one-letter word matches exactly; anything else is a prefix, with a plural trimmed."""
    if len(word) == 1:
        return word in among
    stem = word[:-1] if len(word) > 3 and word.endswith("s") else word
    return any(other.startswith(stem) for other in among)


def find(targets: Iterable[Target], words: str, limit: int = 10) -> Found:
    """The best `limit` candidates for `words`, and the words that matched nothing anywhere."""
    asked = _words(words)
    if not asked:
        return Found(words=(), ids=(), unmatched=())

    joined = "-".join(asked)
    phrase = " ".join(asked)
    scored: list[tuple[int, int, str, str]] = []
    matched_anywhere: set[str] = set()

    for target in targets:
        fields = (
            (ID, _words(target.id)),
            (TITLE, _words(target.title)),
            (CLAIM, _words(target.claim)),
        )
        score = 0
        matched = 0
        for word in asked:
            best = max((weight for weight, among in fields if _hits(word, among)), default=0)
            if best:
                matched += 1
                score += best
                matched_anywhere.add(word)
        if not matched:
            continue
        if target.id == joined:
            score += ID_BONUS
        if " ".join(_words(target.title)) == phrase:
            score += TITLE_BONUS
        scored.append((-matched, -score, target.title.casefold(), target.id))

    scored.sort()
    return Found(
        words=asked,
        ids=tuple(identifier for _, _, _, identifier in scored[:limit]),
        unmatched=tuple(word for word in asked if word not in matched_anywhere),
    )
