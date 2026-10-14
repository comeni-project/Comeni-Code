"""A node's review keys (M4.9a spec, M4V.1): what a reviewer gives a verdict on, in reading order.

Pure: a node in, its keys out. M5's scores attach to the same keys. A position counts every body
block, try blocks included; it is stable because a submitted draft is frozen (M4R.3).
"""

from dataclasses import dataclass

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
