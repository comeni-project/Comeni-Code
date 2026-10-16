# M4.9a — Verdicts per block Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A reviewer gives a verdict on every block of a submitted draft (singly or as a list),
approves the draft only once every block is approved, and sends a draft back with per-block
requests its author reads on `DraftOut`.

**Architecture:** A pure `studio/keys.py` turns a node into its review keys in reading order. A
`Verdict` table hangs off M4.5's `Review` (one reviewer, one submission). `studio/review.py` gains
`set_verdicts`, reads the review as a `Sheet` of keys, approves by verdicts, and folds reject into
one `send_back` from two states. The API serves the review with its own content (answers hidden
until answered) and adds `requests` to `DraftOut`.

**Tech Stack:** Python 3.14, Django 6 + Django Ninja, Postgres 18 (Compose), pytest, mypy strict,
ruff; the web app only regenerates `schema.ts` (TypeScript 7, vitest, Biome).

**Spec:** `docs/superpowers/specs/2026-10-14-m4-verdicts-per-block-design.md` (M4V.1–M4V.5).
Background: the archived M4.5 spec, `docs/superpowers/specs/archive/2026-10-06-m4-review-design.md`.

## Global Constraints

- Run every Python check with CI's environment, from the repository root:
  `CODE_SECRET_KEY=ci-only-insecure-key-for-github-actions-0000000000000000 CODE_DATABASE_URL=postgresql://code:code@localhost:5433/code CODE_DEBUG=false CODE_ALLOWED_HOSTS=localhost CODE_REDIS_URL=redis://localhost:6380/0`
  (below, `$CI_ENV` stands for that prefix). Postgres and Redis run in Compose:
  `docker compose up -d --wait postgres redis`.
- **Never pipe a check into `tail` or `grep` and trust it**: redirect to a file, keep `$?`.
- `apps/api` writes only `CA` codes (`tests/repo/test_diagnostic_ownership.py`); every code it
  writes is declared in `packages/code-schema/src/code_schema/diagnostics.yml`, and every live code
  is named by a test. New codes sit in the drafts band, CA0200–CA0299.
- Codes are never renumbered: a code out of use gets `retired: "<date> — <why>"`.
- Every review step locks the draft row (`_locked`) and checks its state in one transaction.
- mypy is strict over `apps/api`; `ruff format` also formats Python blocks inside Markdown.
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; one logical change
  per commit; never commit to `main` (work on `design/m4-9-boards`, which holds the boards and spec).
- The review keys, in reading order: `node`; `block/<n>` (text, callout, sequence) or `try/<id>`
  for each body block, `<n>` its position among all body blocks from 0; `resource/<n>`;
  `exam/<id>`. Kinds: `node`, `text`, `callout`, `sequence`, `try`, `resource`, `exam`.
- TPM's draft from the `ready` fixture has exactly these eleven keys:
  `node`, `block/0` text, `block/1` callout, `block/2` text, `resource/0`, then `exam/tpm-sums-to`,
  `exam/tpm-or-count`, `exam/twice-as-long`, `exam/tpm-of-a`, `exam/tpm-steps`, `exam/tpm-unit-name`.

## Review Focus

1. **The same key twice in one list**: applied in order, the last wins, one row stored.
2. **Clearing a verdict that was never given**: nothing happens, no error.
3. **A `changes` note of only spaces**: refused as having no note (CA0221), nothing stored.
4. **Requests after the draft is submitted again**: gone from `DraftOut` (they answered a review
   that no longer counts).
5. **Verdicts given to an earlier submission**: never approve the next one (a resubmission starts
   an empty review).

Each has its test in the task that owns the code (Tasks 3 and 4).

---

### Task 0: The issues

**Files:** none.

- [ ] **Step 1: Create the M4.9a issue and its steps as sub-issues**

```bash
parent=$(gh issue create --title "M4.9a — verdicts per block" --body "Slice a of M4.9 (#127). Spec: docs/superpowers/specs/2026-10-14-m4-verdicts-per-block-design.md. Plan: docs/superpowers/plans/2026-10-14-m4-verdicts-per-block.md." | grep -o '[0-9]*$')
echo "M4.9a is #$parent"
for title in "M4.9a.1 — review keys" "M4.9a.2 — the Verdict model" "M4.9a.3 — setting verdicts" "M4.9a.4 — approve by verdicts; one send back" "M4.9a.5 — the routes, codes and DraftOut.requests" "M4.9a.6 — docs"; do
  n=$(gh issue create --title "$title" --body "Step of #$parent." | grep -o '[0-9]*$')
  echo "$title is #$n"
done
```

Then attach: for the parent under #127 and each step under the parent, get the issue's node id with
`gh api repos/comeni-project/Comeni-Code/issues/<n> --jq .id` and run
`gh api repos/comeni-project/Comeni-Code/issues/<parent-number>/sub_issues -X POST -F sub_issue_id=<id>`.
Write the numbers down: each task's commit cites its step's issue as `(#<n>)`.

Expected: seven new issues; `gh issue view 127` lists M4.9a among its sub-issues.

---

### Task 1: Review keys

**Files:**
- Create: `apps/api/src/code_api/studio/keys.py`
- Test: `apps/api/tests/test_review_keys.py`

**Interfaces:**
- Produces: `Key(key: str, kind: str, content: Content)` (frozen dataclass), `QUESTIONS = ("try", "exam")`,
  `review_keys(node: Node) -> list[Key]`. `Content = Node | Text | Callout | SequenceBlock | Resource | TryQuestion | ExamQuestion`.

- [ ] **Step 1: Write the failing test**

```python
"""A node's review keys (M4.9a spec, M4V.1). Needs Compose's Postgres for the TPM draft."""

from collections.abc import Callable
from pathlib import Path

import pytest

from code_api.accounts.models import User
from code_api.content.index import rebuild_index
from code_api.studio import drafts
from code_api.studio.keys import review_keys
from code_api.studio.models import Draft
from code_schema import Node, NumberAnswer, Try, TryQuestion
from code_schema.edits import insert_block

pytestmark = pytest.mark.django_db

FIXTURES = Path(__file__).resolve().parents[3] / "tests" / "fixtures" / "salmon"
EXAM = [
    "exam/tpm-sums-to",
    "exam/tpm-or-count",
    "exam/twice-as-long",
    "exam/tpm-of-a",
    "exam/tpm-steps",
    "exam/tpm-unit-name",
]


@pytest.fixture(autouse=True)
def _indexed() -> None:
    rebuild_index(FIXTURES)


def tpm(ada: User, ready: Callable[[User], Draft]) -> Node:
    node, problems = drafts.node_of(ready(ada))
    assert node is not None, problems
    return node


def test_tpms_keys_in_reading_order(ada: User, ready: Callable[[User], Draft]) -> None:
    node = tpm(ada, ready)
    keys = review_keys(node)
    assert [(k.key, k.kind) for k in keys] == [
        ("node", "node"),
        ("block/0", "text"),
        ("block/1", "callout"),
        ("block/2", "text"),
        ("resource/0", "resource"),
        *((key, "exam") for key in EXAM),
    ]
    assert keys[0].content is node
    assert keys[2].content == node.blocks[1]
    assert keys[4].content == node.resources[0]
    assert keys[5].content == node.exam[0]


def test_a_try_block_is_keyed_by_its_question_and_holds_it(
    ada: User, ready: Callable[[User], Draft]
) -> None:
    question = TryQuestion(
        id="count-kmers",
        ask="A read of 12 bases holds how many 5-mers?",
        answer=NumberAnswer(value=8),
        hints=("Slide the window one base at a time.",),
        rationale="12 − 5 + 1 = 8.",
    )
    node = insert_block(tpm(ada, ready), 1, Try(question="count-kmers"), question)
    keys = review_keys(node)
    assert [(k.key, k.kind) for k in keys[:5]] == [
        ("node", "node"),
        ("block/0", "text"),
        ("try/count-kmers", "try"),
        ("block/2", "callout"),
        ("block/3", "text"),
    ]
    assert keys[2].content == question
```

- [ ] **Step 2: Run it to see it fail**

Run: `$CI_ENV uv run pytest apps/api/tests/test_review_keys.py -q > /tmp/t1.log 2>&1; echo rc=$?; tail -5 /tmp/t1.log`
Expected: rc=1 (or 2), `ModuleNotFoundError: No module named 'code_api.studio.keys'`.

- [ ] **Step 3: Write `keys.py`**

```python
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
```

If `code_schema` does not export one of these names, import it from its module
(`code_schema.blocks`, `code_schema.questions`, `code_schema.resources`) instead.

- [ ] **Step 4: Run it to see it pass**

Run: `$CI_ENV uv run pytest apps/api/tests/test_review_keys.py -q > /tmp/t1.log 2>&1; echo rc=$?; tail -3 /tmp/t1.log`
Expected: rc=0, `2 passed`. Then `$CI_ENV uv run mypy > /tmp/m.log 2>&1; echo rc=$?` → rc=0.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/code_api/studio/keys.py apps/api/tests/test_review_keys.py
git commit -m "feat(studio): a node's review keys, in reading order (#<a.1>)

Every block, resource and question gets a key a verdict (and later a
score) attaches to (M4.9a spec, M4V.1).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: The Verdict model

**Files:**
- Modify: `apps/api/src/code_api/studio/models.py` (after `class Review`, and `DraftEvent`)
- Modify: `apps/api/src/code_api/studio/log.py` (`record` takes `blocks`)
- Create: `apps/api/src/code_api/studio/migrations/0005_verdict.py` (generated)
- Test: `apps/api/tests/test_review_verdict_model.py`

**Interfaces:**
- Produces: `Verdict` with `Verdict.Given.APPROVED == "approved"`, `Verdict.Given.CHANGES ==
  "changes"`, fields `review` (FK `Review`, `related_name="verdicts"`), `key`, `kind`, `verdict`,
  `note`, `at`; `DraftEvent.blocks: int | None`; `record(..., blocks: int | None = None)`.

- [ ] **Step 1: Write the failing test**

```python
"""The Verdict table (M4.9a spec, M4V.3). Needs Compose's Postgres."""

from collections.abc import Callable
from pathlib import Path

import pytest
from django.db import IntegrityError

from code_api.accounts.models import User
from code_api.content.index import rebuild_index
from code_api.studio import review
from code_api.studio.log import record
from code_api.studio.models import Draft, DraftEvent, Review, Verdict

pytestmark = pytest.mark.django_db

FIXTURES = Path(__file__).resolve().parents[3] / "tests" / "fixtures" / "salmon"


@pytest.fixture(autouse=True)
def _indexed() -> None:
    rebuild_index(FIXTURES)


def test_one_verdict_per_key_per_review(
    ada: User, grace: User, ready: Callable[[User], Draft]
) -> None:
    draft = review.submit(ready(ada), revision=2, by=ada)
    review.answer(draft, "tpm-or-count", 0, by=grace)
    found = Review.objects.get(draft=draft, reviewer=grace)
    Verdict.objects.create(review=found, key="block/0", kind="text", verdict="approved")
    assert [v.key for v in found.verdicts.all()] == ["block/0"]
    with pytest.raises(IntegrityError):
        Verdict.objects.create(review=found, key="block/0", kind="text", verdict="changes")


def test_an_event_records_its_blocks(ada: User, ready: Callable[[User], Draft]) -> None:
    draft = ready(ada)
    event = record(draft, DraftEvent.Kind.APPROVED, by=ada, revision=2, blocks=11)
    assert DraftEvent.objects.get(pk=event.pk).blocks == 11
```

- [ ] **Step 2: Run it to see it fail**

Run: `$CI_ENV uv run pytest apps/api/tests/test_review_verdict_model.py -q > /tmp/t2.log 2>&1; echo rc=$?; tail -5 /tmp/t2.log`
Expected: rc≠0, `ImportError: cannot import name 'Verdict'`.

- [ ] **Step 3: Add the model, the field and `record`'s parameter**

In `models.py`, after `class Review` (before `class DraftEvent`):

```python
class Verdict(models.Model):
    """One reviewer's verdict on one key of one submission (M4.9a spec, M4V.3): approved, or
    changes with a note. Cleared by deleting the row."""

    class Given(models.TextChoices):
        APPROVED = "approved"
        CHANGES = "changes"

    review = models.ForeignKey(Review, on_delete=models.CASCADE, related_name="verdicts")
    key = models.CharField(max_length=200)
    kind = models.CharField(max_length=16)  # the key's kind (M4V.1), kept for M5's analysis
    verdict = models.CharField(max_length=16, choices=Given.choices)
    note = models.TextField(blank=True)
    at = models.DateTimeField(default=timezone.now)

    class Meta:
        constraints: ClassVar = [
            models.UniqueConstraint(fields=["review", "key"], name="studio_one_verdict_per_key")
        ]

    def __str__(self) -> str:
        return f"{self.verdict} {self.key}"
```

In `DraftEvent`, after `wrong = …`:

```python
    blocks = models.PositiveIntegerField(null=True)  # an approval's keys, all approved (M4V.2)
```

In `log.py`, `record` gains `blocks: int | None = None` after `wrong`, and passes `blocks=blocks`
to `DraftEvent.objects.create`.

- [ ] **Step 4: Generate the migration**

Run: `$CI_ENV uv run python apps/api/manage.py makemigrations studio --name verdict > /tmp/mig.log 2>&1; echo rc=$?; cat /tmp/mig.log`
Expected: rc=0, `0005_verdict.py` with `CreateModel Verdict` and `AddField draftevent.blocks`.
Then `$CI_ENV uv run ruff format apps/api/src/code_api/studio/migrations/0005_verdict.py`.

- [ ] **Step 5: Run the tests and the migration check**

Run: `$CI_ENV uv run pytest apps/api/tests/test_review_verdict_model.py apps/api/tests/test_migrations.py -q > /tmp/t2.log 2>&1; echo rc=$?; tail -3 /tmp/t2.log`
Expected: rc=0.
Run: `$CI_ENV uv run python apps/api/manage.py makemigrations --check --dry-run > /tmp/mc.log 2>&1; echo rc=$?`
Expected: rc=0, `No changes detected`.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/code_api/studio/models.py apps/api/src/code_api/studio/log.py apps/api/src/code_api/studio/migrations/0005_verdict.py apps/api/tests/test_review_verdict_model.py
git commit -m "feat(studio): the Verdict table, and an approval's block count (#<a.2>)

One row per reviewer, submission and key, so M5 can ask how people
judged each kind of block (M4.9a spec, M4V.3).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Setting verdicts, and the review as keys

**Files:**
- Modify: `apps/api/src/code_api/studio/review.py`
- Modify: `apps/api/tests/test_review_answers.py` (`review_of` now returns a `Sheet`)
- Modify: `apps/api/tests/test_review_race.py` (the read test patches `keys_of`)
- Test: `apps/api/tests/test_review_verdicts.py`

**Interfaces:**
- Consumes: `Key`, `review_keys`, `QUESTIONS` (Task 1); `Verdict` (Task 2).
- Produces, in `code_api.studio.review`:
  - `keys_of(draft: Draft) -> list[Key]` (raises `drafts.Refused` when the node does not read).
  - `asked(draft: Draft) -> list[Asked]` — now derived from `keys_of`, in reading order.
  - `Reviewed(key: Key, verdict: str | None, note: str, answered: Answered | None)`.
  - `Sheet(revision: int, items: list[Reviewed])`.
  - `review_of(draft, *, by) -> Sheet` (was `list[Answered]`).
  - `Given(key: str, verdict: Literal["approved", "changes"] | None, note: str = "")`.
  - `set_verdicts(draft, *, revision: int, verdicts: Sequence[Given], by: User) -> Sheet`.
  - `Keyed(Exception)` with `.keys: list[str]`; subclasses `NoSuchKey`, `NotAnswered`, `NeedsNote`.
  - private `_question(key) -> Asked | None`, `_verdicts(review) -> dict[str, Verdict]`,
    `_review_for(draft, by) -> Review`, `_refuse(error, keys)`.

- [ ] **Step 1: Write the failing tests**

`apps/api/tests/test_review_verdicts.py`:

```python
"""Verdicts per block (M4.9a spec, M4V.2). Needs Compose's Postgres."""

from collections.abc import Callable
from pathlib import Path

import pytest

from code_api.accounts.models import User
from code_api.content.index import rebuild_index
from code_api.studio import drafts, review
from code_api.studio.models import Draft, Verdict
from code_schema.edits import set_fields

pytestmark = pytest.mark.django_db

FIXTURES = Path(__file__).resolve().parents[3] / "tests" / "fixtures" / "salmon"
Ready = Callable[[User], Draft]
TPM_REVIEW = [
    ("node", "node"),
    ("block/0", "text"),
    ("block/1", "callout"),
    ("block/2", "text"),
    ("resource/0", "resource"),
    ("exam/tpm-sums-to", "exam"),
    ("exam/tpm-or-count", "exam"),
    ("exam/twice-as-long", "exam"),
    ("exam/tpm-of-a", "exam"),
    ("exam/tpm-steps", "exam"),
    ("exam/tpm-unit-name", "exam"),
]
Given = review.Given


@pytest.fixture(autouse=True)
def _indexed() -> None:
    rebuild_index(FIXTURES)


def shown(sheet: review.Sheet) -> dict[str, tuple[str | None, str]]:
    return {item.key.key: (item.verdict, item.note) for item in sheet.items}


def test_a_review_lists_every_key_in_reading_order(ada: User, grace: User, ready: Ready) -> None:
    draft = review.submit(ready(ada), revision=2, by=ada)
    sheet = review.review_of(draft, by=grace)
    assert sheet.revision == 2
    assert [(i.key.key, i.key.kind) for i in sheet.items] == TPM_REVIEW
    assert all(i.verdict is None and i.note == "" for i in sheet.items)
    assert [i.answered is not None for i in sheet.items] == [False] * 5 + [True] * 6


def test_verdicts_are_set_as_a_list_and_read_back(ada: User, grace: User, ready: Ready) -> None:
    draft = review.submit(ready(ada), revision=2, by=ada)
    sheet = review.set_verdicts(
        draft,
        revision=2,
        verdicts=[
            Given("node", "approved"),
            Given("block/1", "changes", "  Say what TPM is not. "),
        ],
        by=grace,
    )
    assert shown(sheet)["node"] == ("approved", "")
    assert shown(sheet)["block/1"] == ("changes", "Say what TPM is not.")
    assert shown(review.review_of(draft, by=grace)) == shown(sheet)
    stored = Verdict.objects.get(key="block/1")
    assert (stored.kind, stored.review.reviewer) == ("callout", grace)


def test_a_question_is_approved_only_once_answered(ada: User, grace: User, ready: Ready) -> None:
    draft = review.submit(ready(ada), revision=2, by=ada)
    with pytest.raises(review.NotAnswered) as unanswered:
        review.set_verdicts(
            draft,
            revision=2,
            verdicts=[Given("node", "approved"), Given("exam/tpm-or-count", "approved")],
            by=grace,
        )
    assert unanswered.value.keys == ["exam/tpm-or-count"]
    assert not Verdict.objects.exists()  # all or nothing
    review.set_verdicts(
        draft, revision=2, verdicts=[Given("exam/tpm-or-count", "changes", "Ambiguous.")], by=grace
    )
    review.answer(draft, "tpm-or-count", 1, by=grace)  # wrong: counts, never blocks
    sheet = review.set_verdicts(
        draft, revision=2, verdicts=[Given("exam/tpm-or-count", "approved")], by=grace
    )
    assert shown(sheet)["exam/tpm-or-count"] == ("approved", "")


def test_changes_needs_a_note(ada: User, grace: User, ready: Ready) -> None:
    draft = review.submit(ready(ada), revision=2, by=ada)
    with pytest.raises(review.NeedsNote) as noteless:
        review.set_verdicts(
            draft, revision=2, verdicts=[Given("block/0", "changes", "   ")], by=grace
        )
    assert noteless.value.keys == ["block/0"]
    assert not Verdict.objects.exists()


def test_an_unknown_key_refuses_the_whole_list(ada: User, grace: User, ready: Ready) -> None:
    draft = review.submit(ready(ada), revision=2, by=ada)
    with pytest.raises(review.NoSuchKey) as unknown:
        review.set_verdicts(
            draft,
            revision=2,
            verdicts=[Given("node", "approved"), Given("block/9", "approved")],
            by=grace,
        )
    assert unknown.value.keys == ["block/9"]
    assert not Verdict.objects.exists()


def test_a_verdict_is_changed_and_cleared(ada: User, grace: User, ready: Ready) -> None:
    draft = review.submit(ready(ada), revision=2, by=ada)
    review.set_verdicts(
        draft, revision=2, verdicts=[Given("node", "changes", "Shorter.")], by=grace
    )
    review.set_verdicts(draft, revision=2, verdicts=[Given("node", "approved")], by=grace)
    assert shown(review.review_of(draft, by=grace))["node"] == ("approved", "")
    review.set_verdicts(draft, revision=2, verdicts=[Given("node", None)], by=grace)
    assert shown(review.review_of(draft, by=grace))["node"] == (None, "")
    # Review Focus 2: clearing what was never given does nothing.
    review.set_verdicts(draft, revision=2, verdicts=[Given("block/2", None)], by=grace)
    assert not Verdict.objects.exists()


def test_the_same_key_twice_keeps_the_last(ada: User, grace: User, ready: Ready) -> None:
    # Review Focus 1.
    draft = review.submit(ready(ada), revision=2, by=ada)
    review.set_verdicts(
        draft,
        revision=2,
        verdicts=[Given("node", "approved"), Given("node", "changes", "Second thoughts.")],
        by=grace,
    )
    assert [(v.key, v.verdict) for v in Verdict.objects.all()] == [("node", "changes")]


def test_who_may_give_verdicts(ada: User, grace: User, ready: Ready) -> None:
    draft = review.submit(ready(ada), revision=2, by=ada)
    with pytest.raises(review.RoleTooLow):
        review.set_verdicts(draft, revision=2, verdicts=[Given("node", "approved")], by=ada)
    review.withdraw(draft, by=ada)
    drafts.save(draft, based_on=2, edit=lambda n: set_fields(n, minutes=9), by=grace, change="m")
    review.submit(draft, revision=3, by=ada)
    with pytest.raises(review.Contributor):
        review.set_verdicts(draft, revision=3, verdicts=[Given("node", "approved")], by=grace)


def test_an_operator_gives_verdicts_on_their_own_draft(otto: User, ready: Ready) -> None:
    draft = review.submit(ready(otto), revision=2, by=otto)
    sheet = review.set_verdicts(draft, revision=2, verdicts=[Given("node", "approved")], by=otto)
    assert shown(sheet)["node"] == ("approved", "")


def test_verdicts_name_the_submitted_revision(ada: User, grace: User, ready: Ready) -> None:
    draft = review.submit(ready(ada), revision=2, by=ada)
    with pytest.raises(review.NotSubmittedRevision):
        review.set_verdicts(draft, revision=1, verdicts=[Given("node", "approved")], by=grace)
    review.withdraw(draft, by=ada)
    with pytest.raises(review.WrongState):
        review.set_verdicts(draft, revision=2, verdicts=[Given("node", "approved")], by=grace)


def test_a_resubmission_starts_with_no_verdicts(ada: User, grace: User, ready: Ready) -> None:
    draft = review.submit(ready(ada), revision=2, by=ada)
    review.set_verdicts(draft, revision=2, verdicts=[Given("node", "approved")], by=grace)
    review.withdraw(draft, by=ada)
    review.submit(draft, revision=2, by=ada)
    assert shown(review.review_of(draft, by=grace))["node"] == (None, "")
```

In `apps/api/tests/test_review_answers.py`, add below the fixtures:

```python
def answers(draft: Draft, by: User) -> list[review.Answered]:
    """The questions of `by`'s review, in reading order."""
    return [i.answered for i in review.review_of(draft, by=by).items if i.answered is not None]
```

and replace every `review.review_of(draft, by=X)` used as a list of answers with
`answers(draft, X)` (lines 30, 46, 57, 68, 96, 118 today; `review.review_of(stale, by=grace)` on
line 127 and the calls inside `pytest.raises` on lines 85 and 107 stay as they are).

In `apps/api/tests/test_review_race.py`, `test_a_review_holds_the_draft_while_it_reads` patches
`keys_of`, which the review now reads under the lock:

```python
reading, order = threading.Event(), []
real_keys = review.keys_of


def slow_keys(d: Draft) -> list[Key]:
    reading.set()
    time.sleep(0.5)
    return real_keys(d)


monkeypatch.setattr(review, "keys_of", slow_keys)
```

with `from code_api.studio.keys import Key` among the imports.

- [ ] **Step 2: Run them to see them fail**

Run: `$CI_ENV uv run pytest apps/api/tests/test_review_verdicts.py apps/api/tests/test_review_answers.py apps/api/tests/test_review_race.py -q > /tmp/t3.log 2>&1; echo rc=$?; tail -8 /tmp/t3.log`
Expected: rc=1; `AttributeError: module 'code_api.studio.review' has no attribute 'Given'` (and
`Sheet`, `keys_of`).

- [ ] **Step 3: Implement in `review.py`**

Imports: add `from collections.abc import Sequence`, `from django.utils import timezone`,
`from code_api.studio.keys import Key, review_keys`, `Verdict` to the models import, and
`ExamQuestion, TryQuestion` stay imported from `code_schema`.

Replace `asked` with:

```python
def keys_of(draft: Draft) -> list[Key]:
    """The latest revision's review keys, in reading order (M4.9a spec, M4V.1)."""
    node, problems = drafts.node_of(draft)
    if node is None:
        raise drafts.Refused(problems)
    return review_keys(node)


def _question(key: Key) -> Asked | None:
    if isinstance(key.content, TryQuestion):
        return Asked(key.content.id, "try", key.content)
    if isinstance(key.content, ExamQuestion):
        return Asked(key.content.id, "exam", key.content)
    return None


def asked(draft: Draft) -> list[Asked]:
    """Every question the latest revision asks, in reading order: its try blocks, then its pool."""
    return [question for key in keys_of(draft) if (question := _question(key)) is not None]
```

Below `_review`, add:

```python
def _review_for(draft: Draft, by: User) -> Review:
    """`by`'s review of the submission, started if it has none."""
    found, _ = Review.objects.get_or_create(
        submission=_submission(draft),
        reviewer=by,
        defaults={"draft": draft, "number": drafts.latest(draft).number},
    )
    return found


def _verdicts(found: Review | None) -> dict[str, Verdict]:
    return {} if found is None else {verdict.key: verdict for verdict in found.verdicts.all()}
```

Replace `review_of` with:

```python
@dataclass(frozen=True)
class Reviewed:
    """One key of a review: its verdict and note, and a question's answer (M4V.4)."""

    key: Key
    verdict: str | None
    note: str
    answered: Answered | None  # None unless the key is a question


@dataclass(frozen=True)
class Sheet:
    revision: int
    items: list[Reviewed]


def _sheet(draft: Draft, by: User) -> Sheet:
    """Read under the caller's row lock, so a resubmission cannot land between the parts (#189)."""
    found = _review(draft, by)
    given = {} if found is None else dict(found.answers)
    verdicts = _verdicts(found)
    items = []
    for key in keys_of(draft):
        question = _question(key)
        verdict = verdicts.get(key.key)
        items.append(
            Reviewed(
                key=key,
                verdict=None if verdict is None else verdict.verdict,
                note="" if verdict is None else verdict.note,
                answered=None if question is None else _graded(question, given.get(question.id)),
            )
        )
    return Sheet(drafts.latest(draft).number, items)


def review_of(draft: Draft, *, by: User) -> Sheet:
    """`by`'s review of the submitted revision; a key is theirs to see only once answered."""
    _reviewer(by)
    with transaction.atomic():
        now = _locked(draft)  # its state now, not the caller's copy (#188)
        _need(now, State.SUBMITTED)
        return _sheet(now, by)
```

In `answer`, replace the `Review.objects.get_or_create(...)` block with `review = _review_for(locked, by)`.

Add after `answer`:

```python
# ── Verdicts (M4.9a spec, M4V.2) ────────────────────────────────────────────────────────────────


class Keyed(Exception):
    """A refusal naming review keys."""

    def __init__(self, keys: list[str]) -> None:
        super().__init__(", ".join(keys))
        self.keys = keys


class NoSuchKey(Keyed):
    """Keys the submitted revision does not have (CA0219)."""


class NotAnswered(Keyed):
    """Questions approved before this reviewer answered them (CA0220)."""


class NeedsNote(Keyed):
    """`changes` verdicts without a note (CA0221)."""


def _refuse(error: type[Keyed], keys: list[str]) -> None:
    if keys:
        raise error(keys)


@dataclass(frozen=True)
class Given:
    key: str
    verdict: Literal["approved", "changes"] | None  # None clears it
    note: str = ""


def set_verdicts(draft: Draft, *, revision: int, verdicts: Sequence[Given], by: User) -> Sheet:
    """Set, change or clear verdicts on the submitted revision, all or nothing, in order."""
    with transaction.atomic():
        locked = _locked(draft)
        _need(locked, State.SUBMITTED)
        _judge(locked, by)
        _submitted(locked, revision)
        keys = {key.key: key for key in keys_of(locked)}
        _refuse(NoSuchKey, [g.key for g in verdicts if g.key not in keys])
        given = _given(locked, by)
        _refuse(
            NotAnswered,
            [
                g.key
                for g in verdicts
                if g.verdict == Verdict.Given.APPROVED
                and (question := _question(keys[g.key])) is not None
                and question.id not in given
            ],
        )
        _refuse(
            NeedsNote,
            [g.key for g in verdicts if g.verdict == Verdict.Given.CHANGES and not g.note.strip()],
        )
        found = _review_for(locked, by)
        for g in verdicts:
            if g.verdict is None:
                Verdict.objects.filter(review=found, key=g.key).delete()
                continue
            Verdict.objects.update_or_create(
                review=found,
                key=g.key,
                defaults={
                    "kind": keys[g.key].kind,
                    "verdict": g.verdict,
                    "note": g.note.strip() if g.verdict == Verdict.Given.CHANGES else "",
                    "at": timezone.now(),
                },
            )
        return _sheet(locked, by)
```

`approve` still checks `Unanswered` until Task 4; leave it.

- [ ] **Step 4: Run the review tests**

Run: `$CI_ENV uv run pytest apps/api/tests/test_review_verdicts.py apps/api/tests/test_review_answers.py apps/api/tests/test_review_race.py apps/api/tests/test_review_approve.py apps/api/tests/test_review.py -q > /tmp/t3.log 2>&1; echo rc=$?; tail -5 /tmp/t3.log`
Expected: rc=0. `test_review_api.py` fails at the GET review route until Task 5 (it expects a list);
confirm only that file fails:
`$CI_ENV uv run pytest apps/api/tests -q > /tmp/all.log 2>&1; echo rc=$?; grep -E "^FAILED" /tmp/all.log`
Expected: every FAILED line is in `test_review_api.py`. Then `uv run mypy > /tmp/m.log 2>&1; echo rc=$?` → 1 at
`api.py`'s `review_question_out(each) for each in answered` (it now iterates a `Sheet`); fix it now
with the smallest change, `for each in answered.items if each.answered is not None` →
`review_question_out(each.answered)`, so the branch stays typed. Task 5 replaces the route.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/code_api/studio/review.py apps/api/src/code_api/studio/api.py apps/api/tests/test_review_verdicts.py apps/api/tests/test_review_answers.py apps/api/tests/test_review_race.py
git commit -m "feat(studio): verdicts per key, set as a list, all or nothing (#<a.3>)

A question is approved only once answered; changes needs a note; the
review reads back as every key in reading order (M4.9a spec, M4V.2).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Approve by verdicts; one send back

**Files:**
- Modify: `apps/api/src/code_api/studio/review.py`
- Modify: `apps/api/src/code_api/studio/api.py` (only so it still imports: drop the `reject` route and the `Unanswered` case; Task 5 finishes the routes)
- Modify: `apps/api/tests/test_review.py`, `apps/api/tests/test_review_approve.py`,
  `apps/api/tests/test_review_answers.py`, `apps/api/tests/test_review_race.py`

**Interfaces:**
- Consumes: Task 3's `keys_of`, `_question`, `_verdicts`, `_refuse`, `Keyed`, `Given`, `set_verdicts`.
- Produces, in `code_api.studio.review`:
  - `NotApproved(Keyed)` (CA0222); `NothingToSendBack(Exception)` (CA0223).
  - `approve(...)` unchanged signature; records `blocks=len(keys)`.
  - `send_back(draft, *, reason: str, by: User, revision: int | None = None) -> Draft`, from
    submitted or approved.
  - `SentBack(event: DraftEvent, requests: list[Verdict])`; `sent_back(draft: Draft) -> SentBack | None`.
  - Removed: `reject`, `Unanswered`.

- [ ] **Step 1: Change the tests first**

`test_review_approve.py` — after `answered_all`, add:

```python
TPM_REVIEW_KEYS = [
    "node",
    "block/0",
    "block/1",
    "block/2",
    "resource/0",
    *(f"exam/{question_id}" for question_id in TPM_KEYS),
]


def approved_all(draft: Draft, by: User, wrong: str | None = None) -> None:
    """Every question answered, then every key approved, as the review screen would."""
    answered_all(draft, by, wrong)
    review.set_verdicts(
        draft,
        revision=drafts.latest(draft).number,
        verdicts=[review.Given(key, "approved") for key in TPM_REVIEW_KEYS],
        by=by,
    )
```

then:
- `test_a_reviewer_who_answered_everything_approves`: `approved_all(draft, grace, wrong="twice-as-long")`;
  add `assert event.blocks == 11`.
- `test_an_operator_self_approves_only_with_a_reason`, `test_an_approved_draft_cannot_be_edited_in_place`,
  `test_a_second_approval_finds_it_approved` (both judges),
  `test_a_send_back_and_the_same_revision_resubmitted_needs_fresh_answers`: `answered_all` →
  `approved_all`; in the last, `pytest.raises(review.Unanswered)` → `pytest.raises(review.NotApproved)`
  (Review Focus 5).
- `test_answers_to_an_earlier_submission_do_not_count`: `answered_all` → `approved_all`, and
  `review.Unanswered` → `review.NotApproved`.
- Replace `test_approval_waits_for_every_answer` with:

```python
def test_approval_waits_for_every_key(ada: User, grace: User, ready: Ready) -> None:
    draft = review.submit(ready(ada), revision=2, by=ada)
    answered_all(draft, grace)
    review.set_verdicts(
        draft,
        revision=2,
        verdicts=[review.Given(key, "approved") for key in TPM_REVIEW_KEYS[:-2]]
        + [review.Given("exam/tpm-steps", "changes", "Steps 2 and 3 overlap.")],
        by=grace,
    )
    with pytest.raises(review.NotApproved) as left:
        review.approve(draft, revision=2, reason="", by=grace)
    assert left.value.keys == ["exam/tpm-steps", "exam/tpm-unit-name"]
```

- `test_an_operator_who_contributed_may_reject` becomes:

```python
def test_an_operator_who_contributed_may_send_it_back(otto: User, ready: Ready) -> None:
    draft = review.submit(ready(otto), revision=2, by=otto)
    assert review.send_back(draft, revision=2, reason="Not ready.", by=otto).state == "open"
```

`test_review.py` — replace the three reject tests and the log test's reject:

```python
def test_a_send_back_from_review_needs_a_request_or_a_note(
    ada: User, grace: User, ready: Ready
) -> None:
    draft = review.submit(ready(ada), revision=2, by=ada)
    with pytest.raises(review.RoleTooLow):
        review.send_back(draft, revision=2, reason="No.", by=ada)
    with pytest.raises(review.NothingToSendBack):
        review.send_back(draft, revision=2, reason="  ", by=grace)
    back = review.send_back(draft, revision=2, reason="The key of tpm-of-a is wrong.", by=grace)
    assert back.state == "open"
    event = history(draft)[-1]
    assert (event.kind, event.reason) == ("sent_back", "The key of tpm-of-a is wrong.")


def test_a_reviewer_who_contributed_may_not_send_it_back(
    ada: User, grace: User, ready: Ready
) -> None:
    draft = ready(ada)
    drafts.save(draft, based_on=2, edit=lambda n: set_fields(n, minutes=9), by=grace, change="m")
    review.submit(draft, revision=3, by=ada)
    with pytest.raises(review.Contributor):
        review.send_back(draft, revision=3, reason="Mine.", by=grace)


def test_a_send_back_from_review_names_the_submitted_revision(
    ada: User, grace: User, ready: Ready
) -> None:
    draft = review.submit(ready(ada), revision=2, by=ada)
    with pytest.raises(review.NotSubmittedRevision) as wrong:
        review.send_back(draft, revision=1, reason="Old.", by=grace)
    assert wrong.value.submitted == 2
    with pytest.raises(review.NotSubmittedRevision):
        review.send_back(draft, reason="No revision named.", by=grace)


def test_a_send_back_carries_the_requests(ada: User, grace: User, ready: Ready) -> None:
    draft = review.submit(ready(ada), revision=2, by=ada)
    review.set_verdicts(
        draft,
        revision=2,
        verdicts=[
            review.Given("block/1", "changes", "Say what TPM is not."),
            review.Given("exam/tpm-of-a", "changes", "The key is off by one."),
            review.Given("node", "approved"),
        ],
        by=grace,
    )
    review.send_back(draft, revision=2, reason="", by=grace)
    back = review.sent_back(draft)
    assert back is not None
    assert (back.event.by, back.event.reason) == (grace, "")
    assert [(v.key, v.kind, v.note) for v in back.requests] == [
        ("block/1", "callout", "Say what TPM is not."),
        ("exam/tpm-of-a", "exam", "The key is off by one."),
    ]


def test_requests_go_once_the_draft_is_submitted_again(
    ada: User, grace: User, ready: Ready
) -> None:
    # Review Focus 4.
    draft = review.submit(ready(ada), revision=2, by=ada)
    assert review.sent_back(draft) is None
    review.send_back(draft, revision=2, reason="Shorter, please.", by=grace)
    assert review.sent_back(draft) is not None
    review.submit(draft, revision=2, by=ada)
    assert review.sent_back(draft) is None


def test_an_approved_draft_sent_back_has_a_reason_and_no_requests(
    ada: User, otto: User, ready: Ready
) -> None:
    draft = review.submit(ready(ada), revision=2, by=ada)
    Draft.objects.filter(pk=draft.pk).update(state="approved")
    review.send_back(draft, reason="A typo in the claim.", by=otto)
    back = review.sent_back(draft)
    assert back is not None
    assert (back.event.reason, back.requests) == ("A typo in the claim.", [])
```

and in `test_the_log_reads_back_in_order_and_replays_to_the_state`:
`review.reject(draft, revision=2, reason="Too long.", by=grace)` →
`review.send_back(draft, revision=2, reason="Too long.", by=grace)`, and the expected
`("rejected", grace, 2)` → `("sent_back", grace, 2)`.

`test_review_answers.py`, `test_submitting_the_same_revision_again_starts_a_fresh_review`:
`review.reject(...)` → `review.send_back(draft, revision=2, reason="The key of tpm-of-a is wrong.", by=grace)`.

`test_review_race.py`, `test_two_approvals_racing_leave_one`: after each judge's answers, add

```python
review.set_verdicts(
    draft,
    revision=2,
    verdicts=[
        review.Given(item.key.key, "approved") for item in review.review_of(draft, by=judge).items
    ],
    by=judge,
)
```

- [ ] **Step 2: Run them to see them fail**

Run: `$CI_ENV uv run pytest apps/api/tests/test_review.py apps/api/tests/test_review_approve.py apps/api/tests/test_review_answers.py apps/api/tests/test_review_race.py -q > /tmp/t4.log 2>&1; echo rc=$?; grep -E "FAILED|Error" /tmp/t4.log | head`
Expected: rc=1: `NotApproved`, `NothingToSendBack`, `sent_back` missing; `send_back() got an
unexpected keyword argument 'revision'`; `event.blocks` is None.

- [ ] **Step 3: Implement**

In `review.py`, delete `reject` and `Unanswered`. Replace `send_back`:

```python
class NothingToSendBack(Exception):
    """A send back from review with no `changes` verdict and no note (CA0223)."""


def send_back(draft: Draft, *, reason: str, by: User, revision: int | None = None) -> Draft:
    """Back to its author (M4.9a spec, M4V.2): from review, by whoever may approve, with this
    reviewer's requests or a note; from approved, by an operator, with a reason (M4R.3)."""
    with transaction.atomic():
        locked = _locked(draft)
        _need(locked, State.SUBMITTED, State.APPROVED)
        if locked.state == State.APPROVED:
            if not by.can_act_as(Role.OPERATOR):
                raise RoleTooLow()
            entry = LandingDraft.objects.filter(draft=locked, live=True).select_related("landing")
            held = entry.first()
            if held is not None:
                raise AlreadyLanding(locked, held.landing)
            why = _reason(reason)
            _move(locked, State.OPEN)
            record(locked, Kind.SENT_BACK, by=by, revision=drafts.latest(locked).number, reason=why)
            return locked
        _judge(locked, by)
        current = _submitted(locked, -1 if revision is None else revision)
        found = _review(locked, by)
        asks = [v for v in _verdicts(found).values() if v.verdict == Verdict.Given.CHANGES]
        why = reason.strip()
        if not asks and not why:
            raise NothingToSendBack()
        _move(locked, State.OPEN)
        record(locked, Kind.SENT_BACK, by=by, revision=current.number, reason=why, review=found)
    return locked


@dataclass(frozen=True)
class SentBack:
    event: DraftEvent
    requests: list[Verdict]  # the `changes` verdicts, in the order given


def sent_back(draft: Draft) -> SentBack | None:
    """The last send back, while the draft has not been submitted again since (M4V.4)."""
    last = draft.events.filter(kind__in=[Kind.SUBMITTED, Kind.SENT_BACK]).order_by("-id").first()
    if last is None or last.kind != Kind.SENT_BACK:
        return None
    asks = (
        []
        if last.review is None
        else list(last.review.verdicts.filter(verdict=Verdict.Given.CHANGES).order_by("id"))
    )
    return SentBack(last, asks)
```

Replace `approve`'s body after `_passes(locked)`:

```python
        keys = keys_of(locked)
        found = _review(locked, by)
        verdicts = _verdicts(found)
        _refuse(
            NotApproved,
            [
                key.key
                for key in keys
                if (verdict := verdicts.get(key.key)) is None
                or verdict.verdict != Verdict.Given.APPROVED
            ],
        )
        questions = [question for key in keys if (question := _question(key)) is not None]
        given = _given(locked, by)
        wrong = sum(not is_right(q.question.answer, given[q.id]) for q in questions)
        _move(locked, State.APPROVED)
        record(
            locked,
            Kind.APPROVED,
            by=by,
            revision=current.number,
            reason=why,
            self_approved=own,
            review=found,
            answered=len(questions),
            wrong=wrong,
            blocks=len(keys),
        )
    return locked
```

with, beside the other `Keyed` refusals:

```python
class NotApproved(Keyed):
    """Keys this reviewer has not approved, at approval (CA0222)."""
```

Update `approve`'s docstring: *"Approve the submitted revision: a judge who approved every key (a
question only once answered), the checklist still passing; an operator's own draft only with a
reason, marked self-approved."* and the module docstring's first line: *"Review (M4.5 spec,
M4R.3–M4R.4; M4.9a spec, M4V.2): submit, withdraw, approve and send back, the reviewer's answers
and their verdicts per key."*

In `api.py`, so the module still imports: delete the `reject` route and `RejectIn`; delete the
`case review.Unanswered(...)` arm and `review.Unanswered` from `_REFUSALS`; give `SendBackIn`
`revision: int | None = None` and `reason: str = ""`, and pass `revision=body.revision` in the
`send_back` route. Task 5 adds the new refusals.

- [ ] **Step 4: Run the review tests**

Run: `$CI_ENV uv run pytest apps/api/tests/test_review.py apps/api/tests/test_review_approve.py apps/api/tests/test_review_answers.py apps/api/tests/test_review_race.py apps/api/tests/test_review_verdicts.py apps/api/tests/test_review_log.py -q > /tmp/t4.log 2>&1; echo rc=$?; tail -3 /tmp/t4.log`
Expected: rc=0. Then `uv run mypy > /tmp/m.log 2>&1; echo rc=$?` → rc=0 and
`uv run ruff check . > /tmp/r.log 2>&1; echo rc=$?` → rc=0.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/code_api/studio/review.py apps/api/src/code_api/studio/api.py apps/api/tests/test_review.py apps/api/tests/test_review_approve.py apps/api/tests/test_review_answers.py apps/api/tests/test_review_race.py
git commit -m "feat(studio): approve by verdicts; one send back from review or approval (#<a.4>)

The draft is approved once every key is; reject becomes the send back
from review, carrying the reviewer's requests (M4.9a spec, M4V.2).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: The routes, the codes and `DraftOut.requests`

**Files:**
- Modify: `apps/api/src/code_api/studio/schemas.py`, `apps/api/src/code_api/studio/api.py`
- Modify: `packages/code-schema/src/code_schema/diagnostics.yml`; regenerate `docs/reference/diagnostics.md`
- Regenerate: `apps/api/openapi.json`, `apps/web/src/api/schema.ts`
- Modify: `apps/api/tests/test_review_api.py`

**Interfaces:**
- Consumes: Tasks 3–4 (`review_of`, `set_verdicts`, `Given`, `Sheet`, `Reviewed`, the refusals,
  `send_back`, `sent_back`).
- Produces: `GET …/review` → `ReviewOut{revision, items: [ReviewItemOut]}`; `PUT …/review/verdicts`
  with `VerdictsIn{revision, verdicts: [{key, verdict, note}]}` → `ReviewOut`; `POST …/send-back`
  with `{revision?, reason?}`; `DraftOut.requests: RequestsOut | None`; `EventOut.blocks`;
  `ReviewQuestionOut.hints`. These are what M4.9b's screen reads.

- [ ] **Step 1: Change the API tests first**

In `test_review_api.py`, add helpers below `code_of`:

```python
TPM_REVIEW_KEYS = [
    "node",
    "block/0",
    "block/1",
    "block/2",
    "resource/0",
    *(f"exam/{question_id}" for question_id in TPM_KEYS),
]


def items(draft: Draft, by: User) -> list[dict[str, Any]]:
    response = call(by, "get", at(draft, "/review"))
    assert response.status_code == 200, response.content
    return response.json()["items"]


def question(draft: Draft, by: User, question_id: str) -> dict[str, Any]:
    return next(i["question"] for i in items(draft, by) if i["key"] == f"exam/{question_id}")


def verdicts(draft: Draft, by: User, given: list[dict[str, Any]], revision: int = 2) -> Any:
    return call(by, "put", at(draft, "/review/verdicts"), {"revision": revision, "verdicts": given})


def approve_every_key(draft: Draft, by: User) -> None:
    response = verdicts(draft, by, [{"key": k, "verdict": "approved"} for k in TPM_REVIEW_KEYS])
    assert response.status_code == 200, response.content
```

Then:
- `test_the_whole_walk_through_the_api`: `unanswered = [i["question"] for i in items(draft, grace) if i["question"]]`;
  the expected dict for `unanswered[1]` gains `"hints": []`; after `answer_all(draft, grace)` add
  `approve_every_key(draft, grace)`; the final tally assertion also checks `events[-1]["blocks"] == 11`.
- `test_reject_and_withdraw_and_send_back` → `test_send_back_from_review_withdraw_and_send_back`:
  the first call is `call(grace, "post", at(draft, "/send-back"), {"revision": 2, "reason": "Too long."})`;
  add `approve_every_key(draft, grace)` after `answer_all(draft, grace)`.
- `test_an_operator_self_approves_with_a_reason`, `test_approving_another_revision_is_ca0216`,
  `test_a_reviewer_who_contributed_is_ca0213`: add `approve_every_key(draft, otto)` /
  `(draft, grace)` after `answer_all` (for CA0213 the verdicts call itself is refused CA0213 —
  assert that instead: `assert code_of(verdicts(draft, grace, [{"key": "node", "verdict": "approved"}], revision=3)) == (403, "CA0213")`,
  then keep the approve assertion).
- `test_a_rejection_without_a_reason_is_ca0214` → two tests:

```python
def test_a_send_back_from_review_with_nothing_to_say_is_ca0223(
    ada: User, grace: User, ready: Ready
) -> None:
    draft = submitted(ada, ready)
    response = call(grace, "post", at(draft, "/send-back"), {"revision": 2, "reason": " "})
    assert code_of(response) == (422, "CA0223")


def test_sending_back_an_approval_without_a_reason_is_ca0214(
    ada: User, otto: User, ready: Ready
) -> None:
    draft = submitted(ada, ready)
    Draft.objects.filter(pk=draft.pk).update(state="approved")
    assert code_of(call(otto, "post", at(draft, "/send-back"), {"reason": ""})) == (422, "CA0214")
```

- Replace `test_approving_with_questions_unanswered_is_ca0215` with:

```python
def test_approving_with_keys_not_approved_is_ca0222(ada: User, grace: User, ready: Ready) -> None:
    draft = submitted(ada, ready)
    answer_all(draft, grace)
    verdicts(draft, grace, [{"key": k, "verdict": "approved"} for k in TPM_REVIEW_KEYS[2:]])
    response = call(grace, "post", at(draft, "/approve"), {"revision": 2})
    assert code_of(response) == (422, "CA0222")
    assert "node, block/0" in response.json()["detail"]


def test_a_key_the_revision_lacks_is_ca0219(ada: User, grace: User, ready: Ready) -> None:
    draft = submitted(ada, ready)
    response = verdicts(draft, grace, [{"key": "block/9", "verdict": "approved"}])
    assert code_of(response) == (404, "CA0219")
    assert "block/9" in response.json()["detail"]


def test_approving_a_question_not_answered_is_ca0220(ada: User, grace: User, ready: Ready) -> None:
    draft = submitted(ada, ready)
    response = verdicts(draft, grace, [{"key": "exam/tpm-of-a", "verdict": "approved"}])
    assert code_of(response) == (422, "CA0220")
    assert "exam/tpm-of-a" in response.json()["detail"]


def test_changes_without_a_note_is_ca0221(ada: User, grace: User, ready: Ready) -> None:
    draft = submitted(ada, ready)
    response = verdicts(draft, grace, [{"key": "node", "verdict": "changes", "note": ""}])
    assert code_of(response) == (422, "CA0221")


def test_the_review_carries_each_keys_content(ada: User, grace: User, ready: Ready) -> None:
    draft = submitted(ada, ready)
    shown = {i["key"]: i for i in items(draft, grace)}
    assert list(shown) == TPM_REVIEW_KEYS
    assert shown["node"]["fields"]["title"] == "What TPM measures"
    assert shown["block/1"]["block"]["kind"] == "callout"
    assert shown["resource/0"]["resource"]["provider"] == "openstax"
    assert shown["exam/tpm-of-a"]["question"]["value"] is None  # hidden until answered
    assert all(i["verdict"] is None and i["note"] == "" for i in shown.values())


def test_verdicts_come_back_with_the_review(ada: User, grace: User, ready: Ready) -> None:
    draft = submitted(ada, ready)
    response = verdicts(
        draft, grace, [{"key": "block/0", "verdict": "changes", "note": "Too long."}]
    )
    assert response.status_code == 200, response.content
    item = next(i for i in response.json()["items"] if i["key"] == "block/0")
    assert (item["verdict"], item["note"]) == ("changes", "Too long.")
    cleared = verdicts(draft, grace, [{"key": "block/0", "verdict": None}])
    assert next(i for i in cleared.json()["items"] if i["key"] == "block/0")["verdict"] is None


def test_the_author_reads_the_requests_on_the_draft(ada: User, grace: User, ready: Ready) -> None:
    draft = submitted(ada, ready)
    verdicts(
        draft,
        grace,
        [
            {"key": "block/1", "verdict": "changes", "note": "Say what TPM is not."},
            {"key": "exam/tpm-of-a", "verdict": "changes", "note": "The key is off by one."},
        ],
    )
    call(grace, "post", at(draft, "/send-back"), {"revision": 2, "reason": "Two small things."})
    requests = call(ada, "get", at(draft)).json()["requests"]
    assert (requests["by"]["email"], requests["reason"]) == (
        "grace@example.org",
        "Two small things.",
    )
    assert [(r["key"], r["kind"], r["note"]) for r in requests["items"]] == [
        ("block/1", "callout", "Say what TPM is not."),
        ("exam/tpm-of-a", "exam", "The key is off by one."),
    ]
    call(ada, "post", at(draft, "/submit"), {"revision": 2})
    assert call(ada, "get", at(draft)).json()["requests"] is None
```

- `test_an_order_shows_its_written_steps_once_answered`: `before = question(draft, grace, "tpm-steps")`.
- `test_an_answer_of_the_wrong_kind_is_ca0218_and_not_stored`: the last line becomes
  `assert all(i["question"]["given"] is None for i in items(draft, grace) if i["question"])`.

- [ ] **Step 2: Run them to see them fail**

Run: `$CI_ENV uv run pytest apps/api/tests/test_review_api.py -q > /tmp/t5.log 2>&1; echo rc=$?; grep -cE "^FAILED" /tmp/t5.log`
Expected: rc=1; failures for the review shape, `/review/verdicts` (404/405), `requests`, `blocks`,
`hints`, and the new codes.

- [ ] **Step 3: The schemas**

In `schemas.py`: import `Sheet, Reviewed, SentBack` from `code_api.studio.review` beside
`Answered`, `Node, Resource, Text, Callout, SequenceBlock` from `code_schema`. Extract the resource
builder from `node_out` and use it there:

```python
def _resource_out(r: Resource) -> StudioResourceOut:
    return StudioResourceOut(
        kind=r.kind,
        provider=r.provider,
        url=r.url,
        video=r.video,
        part=r.part,
        covers=r.covers,
        licence=r.licence,
        display=r.display,
        level=r.level.value,
    )
```

(`node_out`'s `resources=[_resource_out(r) for r in node.resources]`.)

`ReviewQuestionOut` gains `hints: list[str]  # a try question's; an exam question has none` after
`steps`, and `review_question_out` passes `hints=list(question.hints) if not exam else []` (compute
`exam` before the `ReviewQuestionOut(...)` call, as now).

Add after `review_question_out`:

```python
class ReviewFieldsOut(Schema):
    """The `node` key's content: the node's own fields and its links (M4V.1)."""

    title: str
    claim: str
    region: str
    level: str
    minutes: int
    needs: list[LinkOut]
    goes_deeper: list[LinkOut]
    related: list[LinkOut]


class ReviewItemOut(Schema):
    """One key of your review (M4V.4): its content by kind, and your verdict and note."""

    key: str
    kind: str
    verdict: str | None
    note: str
    fields: ReviewFieldsOut | None
    block: BlockOut | None
    resource: StudioResourceOut | None
    question: ReviewQuestionOut | None  # its key and rationale only once answered


class ReviewOut(Schema):
    revision: int
    items: list[ReviewItemOut]


def _fields_out(node: Node) -> ReviewFieldsOut:
    return ReviewFieldsOut(
        title=node.title,
        claim=node.claim,
        region=node.region,
        level=node.level.value,
        minutes=node.minutes,
        needs=[LinkOut(node=link.node, reason=link.reason) for link in node.needs],
        goes_deeper=[LinkOut(node=link.node, reason=link.reason) for link in node.goes_deeper],
        related=[LinkOut(node=link.node, reason=link.reason) for link in node.related],
    )


def _review_item_out(item: Reviewed) -> ReviewItemOut:
    content = item.key.content
    return ReviewItemOut(
        key=item.key.key,
        kind=item.key.kind,
        verdict=item.verdict,
        note=item.note,
        fields=_fields_out(content) if isinstance(content, Node) else None,
        block=_block_out(content) if isinstance(content, Text | Callout | SequenceBlock) else None,
        resource=_resource_out(content) if isinstance(content, Resource) else None,
        question=None if item.answered is None else review_question_out(item.answered),
    )


def review_out(sheet: Sheet) -> ReviewOut:
    return ReviewOut(revision=sheet.revision, items=[_review_item_out(i) for i in sheet.items])


class RequestOut(Schema):
    key: str
    kind: str
    note: str


class RequestsOut(Schema):
    """The last send back, while the draft has not been submitted again (M4V.4)."""

    by: MemberOut | None
    at: datetime
    reason: str
    items: list[RequestOut]


def requests_out(back: SentBack | None) -> RequestsOut | None:
    if back is None:
        return None
    return RequestsOut(
        by=None if back.event.by is None else MemberOut.of(back.event.by),
        at=back.event.at,
        reason=back.event.reason,
        items=[RequestOut(key=v.key, kind=v.kind, note=v.note) for v in back.requests],
    )
```

`DraftOut` gains `requests: RequestsOut | None = None` (define `RequestOut`/`RequestsOut` above
`DraftOut`, and `requests_out` anywhere after them). `EventOut` gains `blocks: int | None`.

- [ ] **Step 4: The routes and refusals**

In `api.py`:
- `draft_out` passes `requests=requests_out(review.sent_back(draft))`.
- The events route passes `blocks=event.blocks`.
- The `GET …/review` route returns `Status(200, review_out(review.review_of(draft, by=_member(request))))`
  with `response={200: ReviewOut, …}` and `ReviewAnswer = Status[ReviewOut] | Status[Message] | Status[RefusedOut]`.
- Add:

```python
class VerdictIn(Schema):
    key: str
    verdict: Literal["approved", "changes"] | None  # null clears it
    note: str = ""


class VerdictsIn(Schema):
    revision: int
    verdicts: list[VerdictIn]


@router.put(
    "/{public_id}/review/verdicts",
    response={200: ReviewOut, 403: Message, 404: Message, 409: Message, 422: RefusedOut},
    summary="Set verdicts, all or nothing",
)
def set_verdicts(request: HttpRequest, public_id: UUID, body: VerdictsIn) -> ReviewAnswer:
    draft = find(public_id)
    if draft is None:
        return Status(404, _NO_DRAFT)
    given = [review.Given(v.key, v.verdict, v.note) for v in body.verdicts]
    try:
        sheet = review.set_verdicts(
            draft, revision=body.revision, verdicts=given, by=_member(request)
        )
    except _REFUSALS as error:
        return _refusal(error)
    return Status(200, review_out(sheet))
```

- `_refusal` gains, before the `NotSubmittedRevision` arm:

```python
        case review.NoSuchKey(keys=keys):
            detail = f"The submitted revision has no {', '.join(keys)}."
            return Status(404, Message(detail=detail, code="CA0219"))
        case review.NotAnswered(keys=keys):
            detail = f"Answer each question before approving it: {', '.join(keys)}."
            return Status(422, RefusedOut(detail=detail, code="CA0220", problems=[]))
        case review.NeedsNote(keys=keys):
            detail = f"Say what to change: {', '.join(keys)}."
            return Status(422, RefusedOut(detail=detail, code="CA0221", problems=[]))
        case review.NotApproved(keys=keys):
            detail = f"Approve every block first; not approved: {', '.join(keys)}."
            return Status(422, RefusedOut(detail=detail, code="CA0222", problems=[]))
        case review.NothingToSendBack():
            detail = "Request a change on a block, or say why, to send it back."
            return Status(422, RefusedOut(detail=detail, code="CA0223", problems=[]))
```

  and `_REFUSALS` gains `review.NoSuchKey, review.NotAnswered, review.NeedsNote,
  review.NotApproved, review.NothingToSendBack`.
- The send-back route's summary becomes `"Send back to its author"`.
- `Literal` joins the `typing` import.

- [ ] **Step 5: The codes**

In `diagnostics.yml`, after `CA0218` (inside the drafts band):

```yaml
  CA0219:
    emitted_by: api
    concern: drafts
    says: a review key the submitted revision does not have
    refuses: true
    fix: |
      Reload the review and use the keys it lists.
    explanation: |
      A verdict is on one key of the submitted revision — node, block/<n>, try/<id>,
      resource/<n>, exam/<id> — and a list is all or nothing (M4.9a spec, M4V.1–M4V.2).

  CA0220:
    emitted_by: api
    concern: drafts
    says: a question is approved before it is answered
    refuses: true
    fix: |
      Answer the question the message names, then approve it.
    explanation: |
      The reviewer answers the node's own questions before approving them, S6's defence against
      rubber-stamping (M4R.1, M4V.2). A wrong answer counts, never blocks.

  CA0221:
    emitted_by: api
    concern: drafts
    says: a changes verdict has no note
    refuses: true
    fix: |
      Say what to change; the author reads it beside the block.
    explanation: |
      A request is only useful if it says what to change (M4.9a spec, M4V.2).

  CA0222:
    emitted_by: api
    concern: drafts
    says: approving the draft with keys not approved
    refuses: true
    fix: |
      Approve each key the message names, or send the draft back with your requests.
    explanation: |
      The draft is approved once every block, resource and question is, by the same reviewer
      (M4.9a spec, M4V.2).

  CA0223:
    emitted_by: api
    concern: drafts
    says: a send back from review with nothing to say
    refuses: true
    fix: |
      Request a change on a block, or say why in a sentence.
    explanation: |
      The author reads why their draft came back: the reviewer's requests, a note, or both
      (M4.9a spec, M4V.2).
```

`CA0215` gains `retired: "2026-10-14 — approving needs every key approved, and a question is approved only once answered; CA0222 says it (M4.9a spec, M4V.2)"`.
`CA0211`'s fix: *"Read the draft's state: submit an open draft, approve or send back a submitted
one, send back an approved one. An edit or a discard needs the draft open: withdraw it first."*
`CA0213`'s says: *"a contributor decides their own draft"*. `CA0214`'s explanation: *"A send back
from approval and a self-approval are read later, by the author and in the landing pull request,
so each carries its reason (M4R.3)."*

Run: `uv run code-schema diagnostics --write docs/reference/diagnostics.md > /tmp/d.log 2>&1; echo rc=$?`
Expected: rc=0.

- [ ] **Step 6: Regenerate the OpenAPI and the web types**

```bash
$CI_ENV uv run python apps/api/manage.py export_openapi_schema --api code_api.api.api --sorted --indent 2 --output apps/api/openapi.json > /tmp/o.log 2>&1; echo rc=$?
(cd apps/web && npm run api-types > /tmp/at.log 2>&1; echo rc=$?)
(cd apps/web && npm run typecheck > /tmp/tc.log 2>&1; echo rc=$?)
(cd apps/web && npm test > /tmp/wt.log 2>&1; echo rc=$?)
(cd apps/web && npm run lint > /tmp/wl.log 2>&1; echo rc=$?)
```

Expected: every rc=0 (nothing in the web calls `reject`; `requests` is optional in `DraftOut`). If
a web fixture fails typecheck on `DraftOut`, give it `requests: null`.

- [ ] **Step 7: Run the whole suite and the checks**

```bash
$CI_ENV uv run pytest > /tmp/all.log 2>&1; echo rc=$?; tail -3 /tmp/all.log
uv run ruff check . > /tmp/r.log 2>&1; echo rc=$?
uv run ruff format --check . > /tmp/f.log 2>&1; echo rc=$?
$CI_ENV uv run mypy > /tmp/m.log 2>&1; echo rc=$?
$CI_ENV uv run python apps/api/manage.py check > /tmp/c.log 2>&1; echo rc=$?
```

Expected: every rc=0; `tests/repo/test_diagnostic_ownership.py` and `tests/schema/test_diagnostics.py`
pass (CA0219–CA0223 written and named by tests, CA0215 retired).

- [ ] **Step 8: Commit**

```bash
git add apps/api packages/code-schema/src/code_schema/diagnostics.yml docs/reference/diagnostics.md apps/web/src/api/schema.ts
git commit -m "feat(api): the review by key, verdicts, one send back, the author's requests (#<a.5>)

GET review carries each key's content with answers hidden until
answered; PUT review/verdicts sets a list all or nothing; DraftOut
carries the last send back's requests. CA0219-CA0223 are new and CA0215
is retired (M4.9a spec, M4V.4).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Docs

**Files:**
- Modify: `CLAUDE.md` (Words; the layout line for `studio/`)
- Modify: `docs/superpowers/specs/2026-10-14-m4-verdicts-per-block-design.md` (*Notes from the build*, only if rulings were made)
- Create: `docs/notes/journal/2026-10-14-m4-9a-build.md`

- [ ] **Step 1: CLAUDE.md**

In *Words*, after **step back**'s sentence, add: `**send back** (a draft returned to its author,
with the reviewer's requests per block or a reason);`. In *Layout*, in the `apps/api/` line, replace
`review.py: submit, approve, the reviewer's answers;` with `review.py: submit, verdicts per block
(keys.py: a node's review keys), approve, send back, the reviewer's answers;`.

Run: `$CI_ENV uv run pytest tests/repo -q > /tmp/repo.log 2>&1; echo rc=$?` → rc=0 (CLAUDE.md ≤ 300 lines).

- [ ] **Step 2: The journal entry**

Write `docs/notes/journal/2026-10-14-m4-9a-build.md` with *Where things stand* (what is built,
the checks with their counts), *What changed* (one line per commit with its hash), *Decisions, and
why* (every ruling made while building), *What is next* (the pull request on the operator's yes;
M4.9b's spec).

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md docs/notes/journal/2026-10-14-m4-9a-build.md docs/superpowers/specs/2026-10-14-m4-verdicts-per-block-design.md
git commit -m "docs: M4.9a — send back in the words, the layout, the journal (#<a.6>)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Done when** (spec M4V.5): through the API, in `test_review_api.py`, a reviewer gives verdicts to
every key one at a time and as a list and approves; CA0220, CA0221 and CA0222 refuse; a draft sent
back with two requests shows them on `DraftOut`; a resubmission starts an empty review
(`test_review_verdicts.py`); an operator's own draft is approved only with a reason. The full
checks pass with CI's environment.
