"""A node's review keys (M4.9a spec, M4V.1): what a reviewer gives a verdict on, in reading order.

Pure: a node in, its keys out. M5's scores attach to the same keys. A position counts every body
block, try blocks included; it is stable because a submitted draft is frozen (M4R.3).
"""

from dataclasses import dataclass
from difflib import SequenceMatcher

from code_schema import (
    Callout,
    ExamQuestion,
    Node,
    Resource,
    SequenceBlock,
    Text,
    Try,
    TryQuestion,
)

Content = Node | Text | Callout | SequenceBlock | Resource | TryQuestion | ExamQuestion
QUESTIONS = ("try", "exam")


@dataclass(frozen=True)
class Key:
    key: str
    kind: str  # node, text, callout, sequence, try, resource or exam
    content: Content


def review_keys(node: Node) -> list[Key]:
    asked = {question.id: question for question in node.questions}
    keys = [Key("node", "node", node)]
    for at, block in enumerate(node.blocks):
        match block:
            case Try(question=question_id):
                keys.append(Key(f"try/{question_id}", "try", asked[question_id]))
            case Text():
                keys.append(Key(f"block/{at}", "text", block))
            case Callout():
                keys.append(Key(f"block/{at}", "callout", block))
            case SequenceBlock():
                keys.append(Key(f"block/{at}", "sequence", block))
    keys += [Key(f"resource/{at}", "resource", r) for at, r in enumerate(node.resources)]
    keys += [Key(f"exam/{question.id}", "exam", question) for question in node.exam]
    return keys


BODY = ("text", "callout", "sequence")
LABEL_LENGTH = 60
_FIELDS = ("title", "claim", "region", "level", "minutes", "needs", "goes_deeper", "related")


def _cut(text: str) -> str:
    text = " ".join(text.split())
    return text if len(text) <= LABEL_LENGTH else f"{text[: LABEL_LENGTH - 1].rstrip()}…"


def label(key: Key) -> str:
    """A key in a few words, for the review queue (M4.9b spec, M4RS.1)."""
    content = key.content
    if isinstance(content, Node):
        return "Title, claim, level, links"
    if isinstance(content, Text):
        line = next((line for line in content.markdown.splitlines() if line.strip()), "")
        return _cut(line.lstrip("#>*-+ ").strip())
    if isinstance(content, Callout):
        return _cut(content.title)
    if isinstance(content, SequenceBlock):
        return _cut(content.letters)
    if isinstance(content, TryQuestion):
        return _cut(content.ask)
    if isinstance(content, ExamQuestion):
        return _cut(content.title)
    return f"{content.provider} · {content.kind}"


def same(before: Key, after: Key) -> bool:
    """Whether a matched pair reads the same; `node` compares its fields, not its whole body."""
    if isinstance(before.content, Node) and isinstance(after.content, Node):
        return all(getattr(before.content, f) == getattr(after.content, f) for f in _FIELDS)
    return before.content == after.content


def _signature(key: Key) -> str:
    content = key.content
    if isinstance(content, Text):
        return content.markdown
    if isinstance(content, Callout):
        return f"{content.kind}\n{content.title}\n{content.markdown}"
    if isinstance(content, SequenceBlock):
        return content.letters
    return key.key


def align(before: list[Key], after: list[Key]) -> dict[str, str | None]:
    """Each of `after`'s keys, in reading order, to the `before` key it continues, or None
    (M4.9b spec, M4RS.2). Questions by id, resources by URL, `node` with `node`; body blocks by
    their text, so an inserted block leaves the rest matched, and a block moved unchanged keeps
    its match."""
    found: dict[str, str | None] = {}
    old = [k for k in before if k.kind in BODY]
    new = [k for k in after if k.kind in BODY]
    matcher = SequenceMatcher(
        a=[_signature(k) for k in old], b=[_signature(k) for k in new], autojunk=False
    )
    taken: set[str] = set()
    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        for offset, j in enumerate(range(j1, j2)):
            i = i1 + offset
            pair = old[i].key if tag in ("equal", "replace") and i < i2 else None
            found[new[j].key] = pair
            if pair is not None:
                taken.add(pair)
    # A block moved unchanged comes out as a delete and an insert: pair it by its text.
    loose = {_signature(k): k.key for k in old if k.key not in taken}
    for key in new:
        if found[key.key] is None and (match := loose.pop(_signature(key), None)) is not None:
            found[key.key] = match
    urls = {k.content.url: k.key for k in before if isinstance(k.content, Resource)}
    named = {k.key for k in before if k.kind not in BODY and k.kind != "resource"}
    for key in after:
        if isinstance(key.content, Resource):
            found[key.key] = urls.get(key.content.url)
        elif key.kind not in BODY:
            found[key.key] = key.key if key.key in named else None
    return {key.key: found[key.key] for key in after}
