"""A node's review keys (M4.9a spec, M4V.1): what a reviewer gives a verdict on, in reading order.

Pure: a node in, its keys out. M5's scores attach to the same keys. A position counts every body
block, try blocks included; it is stable because a submitted draft is frozen (M4R.3).
"""

from collections import defaultdict
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
    opcodes = matcher.get_opcodes()
    paired: dict[int, int] = {}  # new index → old index
    for tag, i1, _, j1, j2 in opcodes:
        if tag == "equal":
            paired.update({j: i1 + (j - j1) for j in range(j1, j2)})
    # Then the same text anywhere: a block moved unchanged keeps its match, before any guess by
    # position can take it (#295); identical blocks pair in order.
    loose: dict[str, list[int]] = defaultdict(list)
    for at, key in enumerate(old):
        if at not in paired.values():
            loose[_signature(key)].append(at)
    for at, key in enumerate(new):
        if at not in paired and loose[_signature(key)]:
            paired[at] = loose[_signature(key)].pop(0)
    # Last, an edited block: by position, among what is still unmatched in its replace span.
    taken = set(paired.values())
    for tag, i1, i2, j1, j2 in opcodes:
        if tag != "replace":
            continue
        olds = [at for at in range(i1, i2) if at not in taken]
        for at in (at for at in range(j1, j2) if at not in paired):
            if not olds:
                break
            paired[at] = olds.pop(0)
            taken.add(paired[at])
    for at, key in enumerate(new):
        found[key.key] = old[paired[at]].key if at in paired else None
    urls = {k.content.url: k.key for k in before if isinstance(k.content, Resource)}
    named = {k.key for k in before if k.kind not in BODY and k.kind != "resource"}
    for key in after:
        if isinstance(key.content, Resource):
            found[key.key] = urls.get(key.content.url)
        elif key.kind not in BODY:
            found[key.key] = key.key if key.key in named else None
    return {key.key: found[key.key] for key in after}
