# M4.9b — The review screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A reviewer reviews submitted drafts block by block in Studio's *Review* page (S6 as M4
builds it), and an author sees the reviewer's requests in the workbench.

**Architecture:** The back end gains a pure `align` (two revisions' keys matched), a queue route
(`GET /api/studio/review`, every draft to review with its keys and your verdicts), `change`/`before`
on each review item, and `now` on each request. The web gains `studio/review/` — a page with the
queue on the left, the open block in the middle, your verdict on the right — through one queue GET,
one review GET per draft opened, and one PUT per verdict whose answer replaces the cache; and the
workbench shows a send back's requests in a banner and beside their blocks.

**Tech Stack:** Python 3.14, Django 6 + Ninja, Postgres 18; React 19, TanStack Query, React Router,
Tailwind, TypeScript 7, vitest + Testing Library, Biome; Node 24.

**Spec:** `docs/superpowers/specs/2026-10-14-m4-review-screen-design.md` (M4RS.1–M4RS.6). It builds
on `docs/superpowers/specs/2026-10-14-m4-verdicts-per-block-design.md` (M4V.1–M4V.5). Board:
`reviewM4()` in `.design/build_pages.mjs` (generated `.design/ReviewM4.dc.html`).

## Global Constraints

- Python checks with CI's environment, from the repository root (`$CI_ENV` below):
  `CODE_SECRET_KEY=ci-only-insecure-key-for-github-actions-0000000000000000 CODE_DATABASE_URL=postgresql://code:code@localhost:5433/code CODE_DEBUG=false CODE_ALLOWED_HOSTS=localhost CODE_REDIS_URL=redis://localhost:6380/0`.
  Postgres and Redis: `docker compose up -d --wait postgres redis` (restart them if a run dies with
  connection refused). Web checks in `apps/web` on Node 24: `npm run lint`, `npm run typecheck`,
  `npm test`, `npm run build`.
- **Never pipe a check into `tail`/`grep` and trust it**: redirect to a file and keep `$?`.
- After any API change: `$CI_ENV uv run python apps/api/manage.py export_openapi_schema --api code_api.api.api --sorted --indent 2 --output apps/api/openapi.json`, then `npm run api-types` in `apps/web`.
- `apps/api` writes only CA codes; no new codes in this part.
- Requests stay few and small: the page opens with one GET (the queue), a draft's review is
  fetched once when one of its blocks is first opened, each verdict is one PUT whose answer
  replaces the cached review and the queue's verdicts. Nothing is refetched after a write.
- The answer key of a question never reaches the screen before the reviewer answered it — not in
  the queue, not in `before` (M4R.4, #189). The review page never fetches `GET …/drafts/{id}`.
- Biome forbids exports from test files: fixtures live in `studio/review/reviewKit.ts(x)`.
- A page is added in `studio/pages.ts` and nowhere else (M4S.4).
- Colours: verdict *approved* is grey (settled spends no colour, invariant 11), *changes* amber
  (`bg-meas-soft text-meas`), selection blue (`sel`), the right answer green (`btn`).
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; branch
  `feat/m4-9b-review-screen` (stacked on #280's `design/m4-9-boards`).
- TPM's review keys from the API tests' `ready` fixture: `node`, `block/0` text, `block/1` callout,
  `block/2` text, `resource/0`, then six `exam/…`. The indexed TPM has no resources, so against
  the live index `resource/0` is `new` and every other key is `same`.

## Review Focus

1. **A block moved, not edited**: `align` pairs it with its old key (unchanged), not new.
2. **An exam question's `before` once answered**: shows its old key only after the reviewer
   answered the current one; before that, neither key shows.
3. **A bulk approval spanning two drafts**: one PUT per draft, and a draft whose PUT is refused
   keeps its other drafts' approvals.
4. **Keyboard keys while typing a note**: A, R, J and K do nothing in a text field.
5. **A request whose block the author deleted**: shows in the banner only, marked *block removed*.

Each has its test in the task that owns the code.

---

### Task 0: The issues

- [ ] **Step 1:** Create the parent and its steps, as M4.9a did:

```bash
parent=$(gh issue create --title "M4.9b — the review screen" --body "Slice b of M4.9 (#127). Spec: docs/superpowers/specs/2026-10-14-m4-review-screen-design.md. Plan: docs/superpowers/plans/2026-10-14-m4-review-screen.md." | grep -o '[0-9]*$')
for title in "M4.9b.1 — align and labels" "M4.9b.2 — changes on the review" "M4.9b.3 — the queue" "M4.9b.4 — requests follow their blocks" "M4.9b.5 — the review page's data and place" "M4.9b.6 — answering in TestQuestion" "M4.9b.7 — the word diff" "M4.9b.8 — the queue on screen" "M4.9b.9 — the open block" "M4.9b.10 — verdicts on screen" "M4.9b.11 — requests in the workbench" "M4.9b.12 — the walk and docs"; do
  n=$(gh issue create --title "$title" --body "Step of #$parent." | grep -o '[0-9]*$'); echo "$title #$n"
  gh api repos/comeni-project/Comeni-Code/issues/$parent/sub_issues -X POST -F sub_issue_id=$(gh api repos/comeni-project/Comeni-Code/issues/$n --jq .id) > /dev/null
done
gh api repos/comeni-project/Comeni-Code/issues/127/sub_issues -X POST -F sub_issue_id=$(gh api repos/comeni-project/Comeni-Code/issues/$parent --jq .id) > /dev/null
echo "parent #$parent"
```

Expected: thirteen issues; each task's commit cites its step's number as `(#<b.N>)`.

---

### Task 1: `align` and labels

**Files:** Modify `apps/api/src/code_api/studio/keys.py`; Test `apps/api/tests/test_review_align.py`.

**Interfaces:**
- Produces: `label(key: Key) -> str`; `same(before: Key, after: Key) -> bool`;
  `align(before: list[Key], after: list[Key]) -> dict[str, str | None]` (every `after` key, in
  reading order, to its `before` key or `None`); `BODY = ("text", "callout", "sequence")`;
  `LABEL_LENGTH = 60`.

- [ ] **Step 1: Write the failing test** — `apps/api/tests/test_review_align.py`:

```python
"""Two revisions' keys matched, and a key's label (M4.9b spec, M4RS.1–M4RS.2). Pure."""

from pathlib import Path

from code_api.studio.keys import align, label, review_keys, same
from code_schema import (
    Callout,
    ExamQuestion,
    Node,
    NumberAnswer,
    Resource,
    Text,
    Try,
    TryQuestion,
    read_node,
    read_regions,
)
from code_schema.edits import delete_block, insert_block, move_block, set_resources, update_block

FIXTURES = Path(__file__).resolve().parents[3] / "tests" / "fixtures" / "salmon"


def tpm() -> Node:
    regions, _ = read_regions(FIXTURES)
    node, problems = read_node(
        FIXTURES / "transcriptomics" / "tpm", regions=set(regions), root=FIXTURES
    )
    assert node is not None, problems
    return node


def matched(before: Node, after: Node) -> dict[str, str | None]:
    return align(review_keys(before), review_keys(after))


def test_the_same_node_matches_itself() -> None:
    node = tpm()
    assert matched(node, node) == {k.key: k.key for k in review_keys(node)}


def test_an_inserted_block_is_new_and_the_rest_keep_their_match() -> None:
    node = tpm()
    later = insert_block(node, 1, Text(markdown="A new paragraph.\n"))
    found = matched(node, later)
    assert found["block/0"] == "block/0"
    assert found["block/1"] is None
    assert (found["block/2"], found["block/3"]) == ("block/1", "block/2")


def test_a_deleted_block_leaves_the_rest_matched() -> None:
    found = matched(tpm(), delete_block(tpm(), 1))
    assert (found["block/0"], found["block/1"]) == ("block/0", "block/2")


def test_an_edited_block_is_paired_and_differs() -> None:
    node = tpm()
    later = update_block(node, 0, Text(markdown="Shorter now.\n"))
    found = matched(node, later)
    assert found["block/0"] == "block/0"
    old = {k.key: k for k in review_keys(node)}["block/0"]
    new = {k.key: k for k in review_keys(later)}["block/0"]
    assert not same(old, new)


def test_a_moved_block_keeps_its_match() -> None:
    # Review Focus 1.
    node = tpm()
    later = move_block(node, 0, 2)
    found = matched(node, later)
    assert found["block/2"] == "block/0"
    assert found["block/0"] == "block/1"


def test_questions_by_id_and_resources_by_url() -> None:
    reading = Resource(
        kind="reading",
        provider="openstax",
        url="https://openstax.org/books/biology-2e/pages/17-1",
        covers="How fragments are read.",
        licence="CC BY 4.0",
        display="link",
        level=tpm().level,
    )
    node = set_resources(tpm(), [reading])
    question = TryQuestion(
        id="count-kmers", ask="How many?", answer=NumberAnswer(value=8), hints=(), rationale="8."
    )
    later = insert_block(node, 0, Try(question="count-kmers"), question)
    found = matched(node, later)
    assert found["resource/0"] == "resource/0"
    assert found["exam/tpm-of-a"] == "exam/tpm-of-a"
    assert found["try/count-kmers"] is None
    assert list(found) == [k.key for k in review_keys(later)]  # reading order


def test_a_new_node_matches_nothing() -> None:
    assert set(align([], review_keys(tpm())).values()) == {None}


def test_node_compares_its_fields_only() -> None:
    node = tpm()
    keyed = {k.key: k for k in review_keys(node)}
    edited = {k.key: k for k in review_keys(update_block(node, 0, Text(markdown="Other.\n")))}
    assert same(keyed["node"], edited["node"])


def test_labels() -> None:
    keys = {k.key: k for k in review_keys(tpm())}
    assert label(keys["node"]) == "Title, claim, level, links"
    assert label(keys["block/1"]) == "TPM is not a count of reads"
    assert label(keys["block/0"]).startswith("A long transcript gives more fragments")
    assert len(label(keys["block/0"])) <= 60 and label(keys["block/0"]).endswith("…")
    exam = keys["exam/tpm-or-count"].content
    assert isinstance(exam, ExamQuestion)
    assert label(keys["exam/tpm-or-count"]) == exam.title
    assert isinstance(keys["block/1"].content, Callout)
```

- [ ] **Step 2: Run it to see it fail**

Run: `$CI_ENV uv run pytest apps/api/tests/test_review_align.py -q > /tmp/b1.log 2>&1; echo rc=$?; grep -m2 Error /tmp/b1.log`
Expected: rc≠0, `ImportError: cannot import name 'align'`.

- [ ] **Step 3: Implement in `keys.py`** — add `from difflib import SequenceMatcher` and:

```python
BODY = ("text", "callout", "sequence")
LABEL_LENGTH = 60
_FIELDS = ("title", "claim", "region", "level", "minutes", "needs", "goes_deeper", "related")


def _cut(text: str) -> str:
    text = " ".join(text.split())
    return text if len(text) <= LABEL_LENGTH else f"{text[: LABEL_LENGTH - 1].rstrip()}…"


def label(key: Key) -> str:
    """A key in a few words, for the review queue (M4RS.1)."""
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
    (M4RS.2). Questions by id, resources by URL, `node` with `node`; body blocks by their text,
    so an inserted block leaves the rest matched, and a block moved unchanged keeps its match."""
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
```

If the moved-block test fails because `get_opcodes` pairs a moved block by `replace`, keep the
`replace` pairing only when the two signatures are not each `equal` elsewhere — run the test, read
which key pairs wrongly, and rule on the smallest fix (ledger it).

- [ ] **Step 4: Run, then mypy and ruff**

Run: `$CI_ENV uv run pytest apps/api/tests/test_review_align.py -q > /tmp/b1.log 2>&1; echo rc=$?; tail -1 /tmp/b1.log` → rc=0, `9 passed`.
Run: `$CI_ENV uv run mypy > /tmp/m.log 2>&1; echo rc=$?` → 0; `uv run ruff check . > /tmp/r.log 2>&1; echo rc=$?` → 0.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/code_api/studio/keys.py apps/api/tests/test_review_align.py
git commit -m "feat(studio): align two revisions' review keys, and a key's label (#<b.1>)

Questions by id, resources by URL, body blocks by their text, so an
insert or a move leaves the rest matched (M4.9b spec, M4RS.1-M4RS.2).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Changes on the review

**Files:** Modify `apps/api/src/code_api/studio/review.py`, `apps/api/src/code_api/studio/schemas.py`;
Test `apps/api/tests/test_review_changes.py`.

**Interfaces:**
- Consumes: `align`, `same` (Task 1); `node_from_index` (`code_api.content.snapshot`).
- Produces: `review.question_of(key) -> Asked | None` (was `_question`; every caller renamed);
  `Reviewed.change: str` (`new`, `changed`, `same`), `Reviewed.before: Key | None` (set only when
  changed); `ReviewContentOut` (`fields`, `block`, `resource`, `question`); `ReviewItemOut` extends
  it with `key`, `kind`, `verdict`, `note`, `change`, `before: ReviewContentOut | None`.

- [ ] **Step 1: Write the failing test** — `apps/api/tests/test_review_changes.py`:

```python
"""What a block was before the draft (M4.9b spec, M4RS.2). Needs Compose's Postgres."""

from collections.abc import Callable
from pathlib import Path
from typing import Any

import pytest
from django.test import Client

from code_api.accounts.models import User
from code_api.content.index import rebuild_index
from code_api.studio import drafts, review
from code_api.studio.models import Draft
from code_schema import Text
from code_schema.edits import insert_block, update_block

pytestmark = pytest.mark.django_db

FIXTURES = Path(__file__).resolve().parents[3] / "tests" / "fixtures" / "salmon"
Ready = Callable[[User], Draft]


@pytest.fixture(autouse=True)
def _indexed() -> None:
    rebuild_index(FIXTURES)


def items(draft: Draft, by: User) -> dict[str, dict[str, Any]]:
    client = Client()
    client.force_login(by)
    response = client.get(f"/api/studio/drafts/{draft.public_id}/review")
    assert response.status_code == 200, response.content
    return {i["key"]: i for i in response.json()["items"]}


def test_against_the_live_node(ada: User, grace: User, ready: Ready) -> None:
    draft = ready(ada)
    drafts.save(
        draft,
        based_on=2,
        edit=lambda n: insert_block(
            update_block(n, 0, Text(markdown="Shorter.\n")), 1, Text(markdown="New.\n")
        ),
        by=ada,
        change="e",
    )
    review.submit(draft, revision=3, by=ada)
    shown = items(draft, grace)
    assert {
        k: i["change"] for k, i in shown.items() if k.startswith(("node", "block", "resource"))
    } == {
        "node": "same",
        "block/0": "changed",
        "block/1": "new",
        "block/2": "same",
        "block/3": "same",
        "resource/0": "new",
    }
    assert shown["block/0"]["before"]["block"]["markdown"].startswith("A long transcript")
    assert shown["block/2"]["before"] is None  # only a changed key carries its before
    assert shown["exam/tpm-of-a"]["change"] == "same"


def test_a_new_node_is_new_throughout(ada: User, grace: User) -> None:
    draft = drafts.open_new(
        "bubbles",
        title="Bubbles",
        claim="A claim.",
        region="algorithms",
        level="introductory",
        minutes=10,
        by=ada,
    )
    Draft.objects.filter(pk=draft.pk).update(state="submitted")
    from code_api.studio.log import record
    from code_api.studio.models import DraftEvent

    record(draft, DraftEvent.Kind.SUBMITTED, by=ada, revision=1)
    assert {i["change"] for i in items(draft, grace).values()} == {"new"}


def test_a_questions_before_hides_its_key_until_answered(
    ada: User, grace: User, ready: Ready
) -> None:
    # Review Focus 2.
    from code_schema.edits import update_exam_question

    draft = ready(ada)
    node, _ = drafts.node_of(draft)
    assert node is not None
    old = next(q for q in node.exam if q.id == "tpm-of-a")
    drafts.save(
        draft,
        based_on=2,
        edit=lambda n: update_exam_question(
            n, "tpm-of-a", type(old)(**{**old.__dict__, "title": "TPM of A, again"})
        ),
        by=ada,
        change="t",
    )
    review.submit(draft, revision=3, by=ada)
    before = items(draft, grace)["exam/tpm-of-a"]
    assert before["change"] == "changed"
    assert before["before"]["question"]["value"] is None
    assert before["question"]["value"] is None
    review.answer(draft, "tpm-of-a", 750000, by=grace)
    after = items(draft, grace)["exam/tpm-of-a"]
    assert after["before"]["question"]["value"] == 750000
```

If `drafts.open_new` takes other parameter names, read its signature in
`apps/api/src/code_api/studio/drafts.py` and use them (ledger nothing: a test detail).

- [ ] **Step 2: Run it to see it fail** — `$CI_ENV uv run pytest apps/api/tests/test_review_changes.py -q > /tmp/b2.log 2>&1; echo rc=$?; grep -m3 -E "KeyError|Error" /tmp/b2.log` → rc=1, `KeyError: 'change'`.

- [ ] **Step 3: Implement**

In `review.py`: rename `_question` to `question_of` (all callers). Import `align, same` from
`code_api.studio.keys` and `node_from_index` from `code_api.content.snapshot`. `Reviewed` gains
`change: str` and `before: Key | None = None`. In `_sheet`, before the loop:

```python
    keys = keys_of(draft)
    live = node_from_index(draft.node_id)
    earlier = [] if live is None else review_keys(live)
    by_key = {key.key: key for key in earlier}
    matched = align(earlier, keys)
```

and per key:

```python
        pair = matched[key.key]
        old = None if pair is None else by_key[pair]
        change = "new" if old is None else "same" if same(old, key) else "changed"
```

passing `change=change, before=old if change == "changed" else None` to `Reviewed`, and iterating
`for key in keys`.

In `schemas.py`, split the content out of `ReviewItemOut`:

```python
class ReviewContentOut(Schema):
    """A key's content, by kind (M4V.4); a question's key only once answered."""

    fields: ReviewFieldsOut | None
    block: BlockOut | None
    resource: StudioResourceOut | None
    question: ReviewQuestionOut | None


class ReviewItemOut(ReviewContentOut):
    """One key of your review (M4V.4): its content, your verdict and note, and what it was before
    this draft when it changed (M4RS.2)."""

    key: str
    kind: str
    verdict: str | None
    note: str
    change: str  # new, changed or same, against the live index
    before: ReviewContentOut | None


def _content(key: Key, given: object | None) -> ReviewContentOut:
    """`given` is the reviewer's answer to the current question: the before's key shows only once
    there is one (M4RS.2, Review Focus 2)."""
    content = key.content
    asked = question_of(key)
    return ReviewContentOut(
        fields=_fields_out(content) if isinstance(content, Node) else None,
        block=_block_out(content) if isinstance(content, Text | Callout | SequenceBlock) else None,
        resource=_resource_out(content) if isinstance(content, Resource) else None,
        question=None if asked is None else review_question_out(Answered(asked, given, None)),
    )


def _review_item_out(item: Reviewed) -> ReviewItemOut:
    given = None if item.answered is None else item.answered.given
    now = _content(item.key, given)
    return ReviewItemOut(
        fields=now.fields,
        block=now.block,
        resource=now.resource,
        # the current question keeps its graded answer
        question=None if item.answered is None else review_question_out(item.answered),
        key=item.key.key,
        kind=item.key.kind,
        verdict=item.verdict,
        note=item.note,
        change=item.change,
        before=None if item.before is None else _content(item.before, given),
    )
```

(Import `Key` from `code_api.studio.keys` and `question_of` from `code_api.studio.review`.)

- [ ] **Step 4: Run the review tests and the checks**

Run: `$CI_ENV uv run pytest apps/api/tests/test_review_changes.py apps/api/tests/test_review_api.py apps/api/tests/test_review_verdicts.py apps/api/tests/test_review_race.py -q > /tmp/b2.log 2>&1; echo rc=$?; tail -1 /tmp/b2.log` → rc=0.
mypy and ruff → 0.

- [ ] **Step 5: Commit** — `feat(api): each review item says what it was before the draft (#<b.2>)`.

---

### Task 3: The queue

**Files:** Modify `review.py`, `schemas.py`, `apps/api/src/code_api/api.py`; Create
`apps/api/src/code_api/studio/review_api.py`; Test `apps/api/tests/test_review_queue.py`.

**Interfaces:**
- Produces: `review.Queued(draft, title, revision, submitted_at, reads, keys: list[QueuedKey])`,
  `review.QueuedKey(key: Key, verdict: str | None, answered: bool | None)`,
  `review.queue(by: User) -> list[Queued]`; `GET /api/studio/review` → `list[QueuedDraftOut]`,
  `QueuedDraftOut{public_id, node_id, title, revision, submitted_at, contributors, reads, keys:
  list[QueueKeyOut{key, kind, label, verdict, answered}]}`. `answered` is `null` for a key that is
  not a question.

- [ ] **Step 1: Write the failing test** — `apps/api/tests/test_review_queue.py`:

```python
"""The review queue (M4.9b spec, M4RS.1). Needs Compose's Postgres."""

from collections.abc import Callable
from pathlib import Path
from typing import Any

import pytest
from django.test import Client

from code_api.accounts.models import User
from code_api.content.index import rebuild_index
from code_api.studio import drafts, review
from code_api.studio.models import Draft
from code_schema.edits import set_fields

pytestmark = pytest.mark.django_db

FIXTURES = Path(__file__).resolve().parents[3] / "tests" / "fixtures" / "salmon"
Ready = Callable[[User], Draft]


@pytest.fixture(autouse=True)
def _indexed() -> None:
    rebuild_index(FIXTURES)


def queue(by: User) -> Any:
    client = Client()
    client.force_login(by)
    return client.get("/api/studio/review")


def test_a_reviewer_sees_each_submitted_draft_with_its_keys(
    ada: User, grace: User, ready: Ready
) -> None:
    draft = review.submit(ready(ada), revision=2, by=ada)
    review.answer(draft, "tpm-or-count", 0, by=grace)
    review.set_verdicts(
        draft, revision=2, verdicts=[review.Given("block/1", "changes", "Shorter.")], by=grace
    )
    response = queue(grace)
    assert response.status_code == 200, response.content
    [shown] = response.json()
    assert (shown["node_id"], shown["title"], shown["revision"], shown["reads"]) == (
        "tpm",
        "What TPM measures",
        2,
        True,
    )
    assert [c["email"] for c in shown["contributors"]] == ["ada@example.org"]
    keys = {k["key"]: k for k in shown["keys"]}
    assert len(keys) == 11
    assert keys["block/1"] == {
        "key": "block/1",
        "kind": "callout",
        "label": "TPM is not a count of reads",
        "verdict": "changes",
        "answered": None,
    }
    assert (keys["exam/tpm-or-count"]["answered"], keys["exam/tpm-of-a"]["answered"]) == (
        True,
        False,
    )
    assert "value" not in keys["exam/tpm-of-a"] and "right_option" not in keys["exam/tpm-of-a"]


def test_drafts_you_wrote_are_left_out_unless_you_are_an_operator(
    ada: User, grace: User, otto: User, ready: Ready
) -> None:
    draft = ready(ada)
    drafts.save(draft, based_on=2, edit=lambda n: set_fields(n, minutes=9), by=grace, change="m")
    review.submit(draft, revision=3, by=ada)
    assert queue(grace).json() == []
    assert [d["node_id"] for d in queue(otto).json()] == ["tpm"]


def test_an_author_may_not_read_the_queue(ada: User) -> None:
    response = queue(ada)
    assert (response.status_code, response.json()["code"]) == (403, "CA0102")


def test_open_and_approved_drafts_are_not_in_it(grace: User, ada: User, ready: Ready) -> None:
    ready(ada)
    assert queue(grace).json() == []
```

- [ ] **Step 2: Run it to see it fail** — rc≠0, 404 for `/api/studio/review`.

- [ ] **Step 3: Implement**

`review.py`:

```python
@dataclass(frozen=True)
class QueuedKey:
    key: Key
    verdict: str | None
    answered: bool | None  # None unless the key is a question


@dataclass(frozen=True)
class Queued:
    draft: Draft
    title: str
    revision: int
    submitted_at: datetime
    reads: bool
    keys: list[QueuedKey]


def queue(by: User) -> list[Queued]:
    """Every submitted draft `by` may judge, oldest submission first, with its keys and `by`'s
    verdicts (M4RS.1). No content: a draft's review is read when one of its blocks is opened."""
    _reviewer(by)
    found = []
    for draft in Draft.objects.filter(state=State.SUBMITTED):
        if by in drafts.contributors(draft) and not by.can_act_as(Role.OPERATOR):
            continue
        submission = _submission(draft)
        mine = Review.objects.filter(submission=submission, reviewer=by).first()
        verdicts = _verdicts(mine)
        given = {} if mine is None else dict(mine.answers)
        node, _ = drafts.node_of(draft)
        keys = [] if node is None else review_keys(node)
        found.append(
            Queued(
                draft=draft,
                title=draft.node_id if node is None else node.title,
                revision=drafts.latest(draft).number,
                submitted_at=submission.at,
                reads=node is not None,
                keys=[
                    QueuedKey(
                        key=key,
                        verdict=None if (v := verdicts.get(key.key)) is None else v.verdict,
                        answered=None if (q := question_of(key)) is None else q.id in given,
                    )
                    for key in keys
                ],
            )
        )
    return sorted(found, key=lambda queued: queued.submitted_at)
```

(`from datetime import datetime`.) `schemas.py`:

```python
class QueueKeyOut(Schema):
    key: str
    kind: str
    label: str
    verdict: str | None
    answered: bool | None  # a question's: whether you answered it; null for other keys


class QueuedDraftOut(Schema):
    """A draft in the review queue (M4RS.1): its keys and your verdicts, no content."""

    public_id: UUID
    node_id: str
    title: str
    revision: int
    submitted_at: datetime
    contributors: list[MemberOut]
    reads: bool
    keys: list[QueueKeyOut]
```

`review_api.py`:

```python
"""The review queue (M4.9b spec, M4RS.1): every submitted draft a reviewer may judge."""

from django.http import HttpRequest
from ninja import Router

from code_api.accounts.access import studio
from code_api.accounts.api import MemberOut
from code_api.accounts.models import User
from code_api.accounts.roles import Role
from code_api.studio import drafts, review
from code_api.studio.keys import label
from code_api.studio.schemas import QueuedDraftOut, QueueKeyOut

router = Router(tags=["studio"], auth=studio(Role.REVIEWER))


@router.get("", response=list[QueuedDraftOut], summary="The drafts to review, and their keys")
def queue(request: HttpRequest) -> list[QueuedDraftOut]:
    assert isinstance(request.user, User)
    return [
        QueuedDraftOut(
            public_id=queued.draft.public_id,
            node_id=queued.draft.node_id,
            title=queued.title,
            revision=queued.revision,
            submitted_at=queued.submitted_at,
            contributors=[MemberOut.of(user) for user in drafts.contributors(queued.draft)],
            reads=queued.reads,
            keys=[
                QueueKeyOut(
                    key=k.key.key,
                    kind=k.key.kind,
                    label=label(k.key),
                    verdict=k.verdict,
                    answered=k.answered,
                )
                for k in queued.keys
            ],
        )
        for queued in review.queue(request.user)
    ]
```

`code_api/api.py`: `from code_api.studio.review_api import router as review_router` and
`api.add_router("/studio/review", review_router)`.

- [ ] **Step 4: Run** the queue tests, the review tests, mypy, ruff → all 0.

- [ ] **Step 5: Commit** — `feat(api): the review queue, every draft to review with its keys (#<b.3>)`.

---

### Task 4: Requests follow their blocks

**Files:** Modify `review.py` (`SentBack`, `sent_back`), `schemas.py` (`RequestOut.now`,
`requests_out`); regenerate `openapi.json` and `schema.ts`; Test: add to `apps/api/tests/test_review.py`.

**Interfaces:** Produces `SentBack.now: dict[str, str | None]` (a request's key → its key in the
latest revision, or None) and `RequestOut.now: str | None`.

- [ ] **Step 1: Write the failing tests** — append to `test_review.py`:

```python
def test_a_request_follows_its_block_through_the_authors_edits(
    ada: User, grace: User, ready: Ready
) -> None:
    from code_schema import Text
    from code_schema.edits import delete_block, insert_block

    draft = review.submit(ready(ada), revision=2, by=ada)
    review.set_verdicts(
        draft,
        revision=2,
        verdicts=[
            review.Given("block/1", "changes", "Say what TPM is not."),
            review.Given("block/2", "changes", "Drop this."),
        ],
        by=grace,
    )
    review.send_back(draft, revision=2, reason="", by=grace)
    drafts.save(
        draft,
        based_on=2,
        edit=lambda n: insert_block(n, 0, Text(markdown="First.\n")),
        by=ada,
        change="i",
    )
    back = review.sent_back(draft)
    assert back is not None
    assert back.now == {"block/1": "block/2", "block/2": "block/3"}
    drafts.save(draft, based_on=3, edit=lambda n: delete_block(n, 3), by=ada, change="d")
    back = review.sent_back(draft)
    assert back is not None
    # Review Focus 5: a deleted block's request stays, pointing nowhere.
    assert back.now == {"block/1": "block/2", "block/2": None}
```

and in `test_review_api.py`'s `test_the_author_reads_the_requests_on_the_draft`, the expected
items gain `now`: `[(r["key"], r["kind"], r["note"], r["now"]) for r in requests["items"]] ==
[("block/1", "callout", "Say what TPM is not.", "block/1"), ("exam/tpm-of-a", "exam", "The key is off by one.", "exam/tpm-of-a")]`.

- [ ] **Step 2: Run them to see them fail** — `AttributeError: 'SentBack' object has no attribute 'now'`.

- [ ] **Step 3: Implement** — `SentBack` gains `now: dict[str, str | None]`. In `sent_back`,
after `asks` are sorted (keep the sort), compute:

```python
    latest, _ = drafts.node_of(draft)
    if node is None or latest is None:
        now: dict[str, str | None] = {verdict.key: None for verdict in asks}
    else:
        onward = {b: a for a, b in align(review_keys(node), review_keys(latest)).items() if b}
        now = {verdict.key: onward.get(verdict.key) for verdict in asks}
    return SentBack(last, asks, now)
```

(the `last.review is None` branch returns `SentBack(last, [], {})`). `RequestOut` gains
`now: str | None`; `requests_out` passes `now=back.now.get(v.key)`.

- [ ] **Step 4: Run** the review tests; regenerate `openapi.json`; in `apps/web` run
`npm run api-types`, `npm run typecheck`, `npm test` → all 0.

- [ ] **Step 5: Commit** — `feat(api): a request follows its block through the author's edits (#<b.4>)`,
including `apps/api/openapi.json` and `apps/web/src/api/schema.ts`.

---

### Task 5: The review page's data and its place in Studio

**Files:** Create `apps/web/src/api/review.ts`; Modify `apps/web/src/api/queries.ts`,
`apps/web/src/studio/pages.ts`, `apps/web/src/studio/Rail.tsx`, `apps/web/src/App.tsx`; Create
`apps/web/src/studio/review/ReviewPage.tsx` (a stub that Task 8 fills), `apps/web/src/studio/review/reviewKit.ts`;
Test `apps/web/src/studio/review/review.test.tsx`, `apps/web/src/studio/pages.test.ts`.

**Interfaces:**
- Produces: `fetchQueue`, `fetchReview`, `putVerdicts(id, revision, verdicts: VerdictIn[])`,
  `putAnswer(id, questionId, given)`, `approveDraft(id, revision, reason)`,
  `sendBack(id, revision, reason)`; `queryKeys.reviewQueue`, `queryKeys.review(id)`;
  `useReviewQueue()`, `useReview(id: string | null)`; `reviewed(client, draftId, review)` (writes a
  review answer into both caches), `decided(client, draft)` (a draft leaves the queue);
  `StudioPage.count?: "review"`; `QUEUE`, `REVIEW` fixtures in `reviewKit.ts`.

- [ ] **Step 1: Write the failing tests**

`studio/pages.test.ts` gains:

```ts
it("offers Review to reviewers and above", () => {
  expect(pagesFor("author").map((p) => p.label)).not.toContain("Review");
  expect(pagesFor("reviewer").map((p) => p.label)).toContain("Review");
  expect(pageAt("/studio/review")?.minRole).toBe("reviewer");
});
```

`studio/review/reviewKit.ts`:

```ts
// The review page's tests (M4.9b): TPM in review, as the queue and the review route answer.
import type { QueuedDraftOut, ReviewItemOut, ReviewOut } from "../../api/schema";

const keyOf = (key: string, kind: string, label: string, answered: boolean | null = null) => ({
  key,
  kind,
  label,
  verdict: null as string | null,
  answered,
});

export const QUEUE: QueuedDraftOut[] = [
  {
    public_id: "d-1",
    node_id: "tpm",
    title: "What TPM measures",
    revision: 2,
    submitted_at: "2026-10-14T09:00:00Z",
    contributors: [{ public_id: "u-2", email: "bo@example.org", name: "Bo", role: "author" }],
    reads: true,
    keys: [
      keyOf("node", "node", "Title, claim, level, links"),
      keyOf("block/0", "text", "A long transcript gives more fragments…"),
      keyOf("block/1", "callout", "TPM is not a count of reads"),
      keyOf("exam/tpm-or-count", "exam", "What does TPM tell you?", false),
    ],
  },
];

const none = { fields: null, block: null, resource: null, question: null };
const item = (key: string, kind: string, content: Partial<ReviewItemOut>): ReviewItemOut => ({
  ...none,
  key,
  kind,
  verdict: null,
  note: "",
  change: "same",
  before: null,
  ...content,
});

export const REVIEW: ReviewOut = {
  revision: 2,
  items: [
    item("node", "node", {
      fields: {
        title: "What TPM measures",
        claim: "TPM is a share of molecules.",
        region: "transcriptomics",
        level: "introductory",
        minutes: 10,
        needs: [],
        goes_deeper: [],
        related: [],
      },
    }),
    item("block/0", "text", {
      block: { kind: "text", markdown: "A long transcript gives more fragments.\n" },
      change: "changed",
      before: { ...none, block: { kind: "text", markdown: "A long transcript gives more reads.\n" } },
    }),
    item("block/1", "callout", {
      block: { kind: "callout", callout: "misconception", title: "TPM is not a count of reads", markdown: "Equal reads, unequal TPM.\n" },
    }),
    item("exam/tpm-or-count", "exam", {
      question: {
        id: "tpm-or-count",
        pool: "exam",
        kind: "choice",
        ask: "What does TPM tell you?",
        stem: [{ kind: "text", markdown: "What does TPM tell you?\n" }],
        options: ["A share of molecules", "A count of reads", "A length"],
        unit: "",
        steps: null,
        hints: [],
        given: null,
        right: null,
        right_option: null,
        right_steps: null,
        value: null,
        tolerance: null,
        rationale: null,
      },
    }),
  ],
};
```

`studio/review/review.test.tsx`:

```tsx
import { screen, within } from "@testing-library/react";
import { Route } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { answering, renderAt, signedInAs } from "../../test-kit";
import { StudioShell } from "../StudioShell";
import { QUEUE } from "./reviewKit";
import { ReviewPage } from "./ReviewPage";

afterEach(() => vi.unstubAllGlobals());

describe("Review in Studio", () => {
  it("is in the rail for a reviewer, with the keys still to review", async () => {
    answering({ "GET /api/me": signedInAs("reviewer"), "GET /api/studio/review": { body: QUEUE } });
    renderAt(
      "/studio/review",
      <Route path="/studio" element={<StudioShell />}>
        <Route path="review" element={<ReviewPage />} />
      </Route>,
    );
    const link = await screen.findByRole("link", { name: /Review/ });
    expect(await within(link).findByText("4")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run** `npm test -- review pages > /tmp/w5.log 2>&1; echo rc=$?` → rc=1 (no
`ReviewPage`, no Review page).

- [ ] **Step 3: Implement**

`api/review.ts`:

```ts
// The review API (M4.9a, M4.9b): the queue, a draft's review, verdicts, answers, and the two
// decisions on a draft. The review page never reads GET …/drafts/{id}: it shows answers (#189).
import { getJson, sendJson } from "./client";
import type { DraftOut, QueuedDraftOut, ReviewOut, ReviewQuestionOut } from "./schema";

const DRAFTS = "/api/studio/drafts";

export interface VerdictIn {
  key: string;
  verdict: "approved" | "changes" | null;
  note?: string;
}

export const fetchQueue = (signal?: AbortSignal) =>
  getJson<QueuedDraftOut[]>("/api/studio/review", signal);

export const fetchReview = (id: string, signal?: AbortSignal) =>
  getJson<ReviewOut>(`${DRAFTS}/${id}/review`, signal);

export const putVerdicts = (id: string, revision: number, verdicts: VerdictIn[]) =>
  sendJson<ReviewOut>("PUT", `${DRAFTS}/${id}/review/verdicts`, { revision, verdicts });

export const putAnswer = (id: string, questionId: string, given: unknown) =>
  sendJson<ReviewQuestionOut>("PUT", `${DRAFTS}/${id}/review/answers/${questionId}`, { given });

export const approveDraft = (id: string, revision: number, reason: string) =>
  sendJson<DraftOut>("POST", `${DRAFTS}/${id}/approve`, { revision, reason });

export const sendBack = (id: string, revision: number, reason: string) =>
  sendJson<DraftOut>("POST", `${DRAFTS}/${id}/send-back`, { revision, reason });
```

`queries.ts`: keys `reviewQueue: ["review-queue"] as const`, `review: (id: string) => ["review", id] as const`;

```ts
export const useReviewQueue = () =>
  useQuery({ queryKey: queryKeys.reviewQueue, queryFn: ({ signal }) => fetchQueue(signal), retry: false });

/** A draft's review, asked once, when one of its blocks is first opened (M4RS.4). */
export const useReview = (id: string | null) =>
  useQuery({
    queryKey: queryKeys.review(id ?? ""),
    queryFn: ({ signal }) => fetchReview(id ?? "", signal),
    enabled: id !== null,
    retry: false,
  });

/** A review a write answered with: in its own cache, and its verdicts and answers in the queue. */
export function reviewed(client: QueryClient, draftId: string, review: ReviewOut) {
  client.setQueryData(queryKeys.review(draftId), review);
  const by = new Map(review.items.map((item) => [item.key, item]));
  client.setQueryData<QueuedDraftOut[]>(queryKeys.reviewQueue, (queue) =>
    queue?.map((draft) =>
      draft.public_id !== draftId
        ? draft
        : {
            ...draft,
            keys: draft.keys.map((key) => {
              const now = by.get(key.key);
              if (now === undefined) return key;
              const answered = now.question === null ? null : now.question.given !== null;
              return { ...key, verdict: now.verdict, answered };
            }),
          },
    ),
  );
}

/** A draft approved or sent back leaves the queue (M4RS.4). */
export function decided(client: QueryClient, draft: DraftOut) {
  client.setQueryData<QueuedDraftOut[]>(queryKeys.reviewQueue, (queue) =>
    queue?.filter((queued) => queued.public_id !== draft.public_id),
  );
  client.removeQueries({ queryKey: queryKeys.review(draft.public_id) });
  return draftMoved(client, draft);
}
```

`pages.ts` — `count?: "review"` on `StudioPage` (*"A count drawn beside the label: the keys still
without your verdict"*), and after Drafts:

```ts
  {
    path: "/studio/review",
    label: "Review",
    icon: "M8 14.5A6.5 6.5 0 1 0 8 1.5a6.5 6.5 0 0 0 0 13zM5 8l2 2 4-4",
    minRole: "reviewer",
    place: "top",
    count: "review",
  },
```

`Rail.tsx` — inside `Item`, after `{page.label}`: `{page.count === "review" && <ToReview />}` with

```tsx
/** The keys still without your verdict, from the one queue GET the page shares. */
function ToReview() {
  const queue = useReviewQueue();
  const left = (queue.data ?? []).flatMap((d) => d.keys).filter((k) => k.verdict === null).length;
  if (left === 0) return null;
  return (
    <span className="ml-auto rounded-pill bg-bg px-[7px] text-[11.5px] text-ink-3 tabular-nums">
      {left}
    </span>
  );
}
```

`ReviewPage.tsx` (stub, filled by Task 8):

```tsx
// S6 as M4 builds it (M4.9b spec, M4RS.4).
export function ReviewPage() {
  return <h1 className="text-[26px] font-semibold tracking-[-0.02em]">Review</h1>;
}
```

`App.tsx`: `<Route path="review" element={<ReviewPage />} />` among Studio's routes.

- [ ] **Step 4: Run** `npm test`, `npm run typecheck`, `npm run lint` → 0.

- [ ] **Step 5: Commit** — `feat(web): Review in Studio's rail, and the review API's hooks (#<b.5>)`.

---

### Task 6: Answering in `TestQuestion`

**Files:** Modify `apps/web/src/node/TestQuestion.tsx`; Test `apps/web/src/node/TestQuestion.test.tsx`.

**Interfaces:** Produces `TestQuestion`'s optional `onAnswer?: (given: number | string | string[]) => void`
and `busy?: boolean`. Without `onAnswer` it draws exactly as now (the builder's preview).

- [ ] **Step 1: Write the failing tests** — append to `TestQuestion.test.tsx` (it already has a
`choice: TestAsk`; reuse it):

```tsx
it("gives a choice's index when answered", async () => {
  const onAnswer = vi.fn();
  render(<TestQuestion ask={choice} number={1} of={1} onAnswer={onAnswer} />);
  const answer = screen.getByRole("button", { name: "Answer" });
  expect(answer).toBeDisabled();
  await userEvent.click(screen.getAllByRole("button", { pressed: false })[1] as HTMLElement);
  await userEvent.click(answer);
  expect(onAnswer).toHaveBeenCalledWith(1);
});

it("gives a number as a number, and refuses what is not one", async () => {
  const onAnswer = vi.fn();
  render(
    <TestQuestion
      ask={{ stem: [], kind: "number", options: [], unit: "TPM", steps: [] }}
      number={1}
      of={1}
      onAnswer={onAnswer}
    />,
  );
  await userEvent.type(screen.getByLabelText("Your answer"), "7.5e5");
  await userEvent.click(screen.getByRole("button", { name: "Answer" }));
  expect(onAnswer).toHaveBeenCalledWith(750000);
});

it("draws no Answer without onAnswer", () => {
  render(<TestQuestion ask={choice} number={1} of={1} />);
  expect(screen.queryByRole("button", { name: "Answer" })).toBeNull();
});
```

(import `userEvent` and `vi` if the file lacks them.)

- [ ] **Step 2: Run** → the first two fail (no *Answer*).

- [ ] **Step 3: Implement** — props `onAnswer` and `busy = false`; after the kind's control:

```tsx
      {onAnswer !== undefined && ask.kind !== "order" && (
        <button
          type="button"
          disabled={busy || answerOf() === null}
          onClick={() => {
            const value = answerOf();
            if (value !== null) onAnswer(value);
          }}
          className="self-start rounded-control border border-border-2 bg-surface px-3.5 py-2 text-[13px] font-semibold disabled:text-ink-3"
        >
          Answer
        </button>
      )}
```

with

```tsx
  const answerOf = (): number | string | null => {
    if (ask.kind === "choice") return picked;
    if (given.trim() === "") return null;
    if (ask.kind === "number") {
      const read = Number(given);
      return Number.isFinite(read) ? read : null;
    }
    return given.trim();
  };
```

and the order control as `<OrderAnswer … onCheck={onAnswer === undefined ? undefined : (order) => onAnswer(order)} />`
(`OrderAnswer` draws its own Check when given `onCheck`). The status line reads *no hints in a test*
only without `onAnswer`; with it, *answer before you see the key*.

- [ ] **Step 4: Run** `npm test -- TestQuestion`, typecheck, lint → 0.

- [ ] **Step 5: Commit** — `feat(web): TestQuestion can take an answer, for review (#<b.6>)`.

---

### Task 7: The word diff

**Files:** Create `apps/web/src/studio/review/diff.ts`; Test `apps/web/src/studio/review/diff.test.ts`.

**Interfaces:** Produces `type Piece = { text: string; kind: "same" | "gone" | "new" }`;
`wordDiff(before: string, after: string): Piece[]` (words and the spaces after them; neighbouring
pieces of one kind joined).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { wordDiff } from "./diff";

describe("wordDiff", () => {
  it("keeps what stayed, and marks what went and what came", () => {
    expect(wordDiff("more reads here", "more fragments here")).toEqual([
      { text: "more ", kind: "same" },
      { text: "reads ", kind: "gone" },
      { text: "fragments ", kind: "new" },
      { text: "here", kind: "same" },
    ]);
  });

  it("is one same piece when nothing changed", () => {
    expect(wordDiff("a b", "a b")).toEqual([{ text: "a b", kind: "same" }]);
  });

  it("is all new from nothing", () => {
    expect(wordDiff("", "new text")).toEqual([{ text: "new text", kind: "new" }]);
  });
});
```

- [ ] **Step 2: Run** → fails (no module).

- [ ] **Step 3: Implement**

```ts
// A word diff for the review's Changes view (M4.9b spec, M4RS.2): the longest run of shared
// words kept, the rest marked gone or new. Blocks are short, so the table is small.
export interface Piece {
  text: string;
  kind: "same" | "gone" | "new";
}

const words = (text: string) => text.match(/\S+\s*/g) ?? [];

export function wordDiff(before: string, after: string): Piece[] {
  const a = words(before);
  const b = words(after);
  const n = a.length;
  const m = b.length;
  // longest[i][j]: the longest shared run of a[i…] and b[j…]
  const longest = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      const row = longest[i] as number[];
      row[j] =
        a[i]?.trim() === b[j]?.trim()
          ? ((longest[i + 1] as number[])[j + 1] as number) + 1
          : Math.max((longest[i + 1] as number[])[j] as number, row[j + 1] as number);
    }
  }
  const out: Piece[] = [];
  const push = (text: string, kind: Piece["kind"]) => {
    const last = out.at(-1);
    if (last?.kind === kind) last.text += text;
    else out.push({ text, kind });
  };
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && a[i]?.trim() === b[j]?.trim()) {
      push(b[j] as string, "same");
      i += 1;
      j += 1;
    } else if (
      j < m &&
      (i === n || ((longest[i] as number[])[j + 1] as number) >= ((longest[i + 1] as number[])[j] as number))
    ) {
      push(b[j] as string, "new");
      j += 1;
    } else {
      push(a[i] as string, "gone");
      i += 1;
    }
  }
  return out;
}
```

If the first test's order comes out *new* before *gone*, swap the two branches' preference
(*gone* first when the runs tie) — the test pins gone-then-new.

- [ ] **Step 4: Run**, typecheck, lint → 0.
- [ ] **Step 5: Commit** — `feat(web): a word diff for the review's Changes (#<b.7>)`.

---

### Task 8: The queue on screen

**Files:** Modify `apps/web/src/studio/review/ReviewPage.tsx`; Create
`apps/web/src/studio/review/QueueList.tsx`; Test `apps/web/src/studio/review/ReviewPage.test.tsx`.

**Interfaces:**
- Produces: `ReviewPage` holding `view: View`, `node: string`, `kind: string`, `open: Opened | null`
  (`{ draft: string; key: string }`), `ticked: Set<string>` (`"<draft>:<key>"`); `QueueList` props
  `{ queue, view, node, kind, open, ticked, onOpen, onTick }`; `View = "To review" | "Changes requested" | "Approved"`;
  `inView(view, verdict)`; `renderReview(extra?)` in `reviewKit.tsx` (rename the kit to `.tsx`).

- [ ] **Step 1: Write the failing tests** — `ReviewPage.test.tsx`:

```tsx
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QUEUE, renderReview } from "./reviewKit";

afterEach(() => vi.unstubAllGlobals());

const row = (label: RegExp) => screen.getByRole("button", { name: label });

describe("ReviewPage — the queue", () => {
  it("groups each draft's blocks, with a placeholder score and nothing reviewed yet", async () => {
    renderReview();
    expect(await screen.findByText("What TPM measures")).toBeInTheDocument();
    expect(screen.getByText("0 of 4")).toBeInTheDocument();
    expect(row(/^TPM is not a count of reads, callout/)).toBeInTheDocument();
    expect(screen.getAllByTitle("Scores arrive with the judge in M5")).toHaveLength(4);
  });

  it("filters by your verdict", async () => {
    const queue = structuredClone(QUEUE);
    (queue[0]?.keys[2] as { verdict: string | null }).verdict = "changes";
    renderReview({ "GET /api/studio/review": { body: queue } });
    await screen.findByText("What TPM measures");
    expect(screen.queryByRole("button", { name: /^TPM is not a count/ })).toBeNull();
    await userEvent.click(screen.getByRole("tab", { name: /Changes requested/ }));
    expect(row(/^TPM is not a count of reads/)).toBeInTheDocument();
  });

  it("opens a block and asks for its draft's review once", async () => {
    const fake = renderReview();
    await userEvent.click(await screen.findByRole("button", { name: /^Title, claim, level, links/ }));
    await userEvent.click(row(/^TPM is not a count of reads/));
    const asked = fake.mock.calls.filter(([url]) => url === "/api/studio/drafts/d-1/review");
    expect(asked).toHaveLength(1);
  });

  it("says when nothing is waiting", async () => {
    renderReview({ "GET /api/studio/review": { body: [] } });
    expect(await screen.findByText("Nothing is waiting for review.")).toBeInTheDocument();
  });
});
```

and in `reviewKit.tsx` (renamed from `.ts`, `git mv`):

```tsx
export function renderReview(extra: Record<string, Answer> = {}, role = "reviewer") {
  const fake = answering({
    "GET /api/me": signedInAs(role),
    "GET /api/studio/review": { body: QUEUE },
    "GET /api/studio/drafts/d-1/review": { body: REVIEW },
    ...extra,
  });
  renderAt("/studio/review", <Route path="/studio/review" element={<ReviewPage />} />);
  return fake;
}
```

- [ ] **Step 2: Run** → fail (the stub draws a heading only).

- [ ] **Step 3: Implement** — `ReviewPage.tsx`:

```tsx
// S6 as M4 builds it (M4.9b spec, M4RS.4): the queue, the open block, your verdict. One GET opens
// it; a draft's review is asked once, when one of its blocks is first opened.
import { useState } from "react";
import { useReviewQueue } from "../../api/queries";
import { ErrorNotice } from "../../layout/ErrorNotice";
import { QueueList, type View, VIEWS } from "./QueueList";

export interface Opened {
  draft: string;
  key: string;
}

export function ReviewPage() {
  const queue = useReviewQueue();
  const [view, setView] = useState<View>("To review");
  const [node, setNode] = useState("");
  const [kind, setKind] = useState("");
  const [open, setOpen] = useState<Opened | null>(null);
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const tick = (id: string) =>
    setTicked((now) => {
      const next = new Set(now);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const drafts = queue.data ?? [];
  return (
    <>
      <div className="flex items-baseline gap-3.5">
        <h1 className="text-[26px] font-semibold tracking-[-0.02em]">Review</h1>
        <span className="text-[13px] text-ink-2">
          Every block of a submitted draft gets your verdict; then you approve the draft.
        </span>
      </div>
      <div role="tablist" aria-label="Review views" className="flex gap-0.5 border-b border-border">
        {VIEWS.map((name) => (
          <button
            key={name}
            type="button"
            role="tab"
            aria-selected={view === name}
            onClick={() => setView(name)}
            className={`px-3.5 py-[9px] text-[13.5px] ${
              view === name ? "font-semibold text-ink shadow-[inset_0_-2px_0_var(--ink)]" : "text-ink-2"
            }`}
          >
            {name}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
        <span className="text-ink-3">Filter</span>
        <select aria-label="Node" value={node} onChange={(e) => setNode(e.target.value)} className="rounded-[7px] border border-border-2 bg-surface px-2 py-1 text-sel">
          <option value="">+ Node</option>
          {drafts.map((d) => (
            <option key={d.public_id} value={d.public_id}>{d.title}</option>
          ))}
        </select>
        <select aria-label="Block type" value={kind} onChange={(e) => setKind(e.target.value)} className="rounded-[7px] border border-border-2 bg-surface px-2 py-1 text-sel">
          <option value="">+ Block type</option>
          {["node", "text", "callout", "sequence", "try", "resource", "exam"].map((k) => (
            <option key={k} value={k}>{k}</option>
          ))}
        </select>
      </div>
      {queue.isError && <ErrorNotice error={queue.error} />}
      {queue.data !== undefined && drafts.length === 0 && (
        <p className="text-[14px] text-ink-2">Nothing is waiting for review.</p>
      )}
      {drafts.length > 0 && (
        <div className="grid min-h-0 items-start gap-4 xl:grid-cols-[400px_minmax(0,1fr)_290px]">
          <QueueList
            queue={drafts}
            view={view}
            node={node}
            kind={kind}
            open={open}
            ticked={ticked}
            onOpen={setOpen}
            onTick={tick}
          />
          {/* Task 9: the open block; Task 10: your verdict and the bulk bar. */}
        </div>
      )}
    </>
  );
}
```

`QueueList.tsx`:

```tsx
// The queue (M4RS.1, M4RS.4): a group per draft, its keys with the score placeholder and your
// verdict, filtered by view, node and block type.
import type { QueuedDraftOut } from "../../api/schema";
import type { Opened } from "./ReviewPage";

export const VIEWS = ["To review", "Changes requested", "Approved"] as const;
export type View = (typeof VIEWS)[number];

export const inView = (view: View, verdict: string | null) =>
  view === "To review" ? verdict === null : view === "Approved" ? verdict === "approved" : verdict === "changes";

const COLS = "grid-cols-[18px_minmax(0,1.2fr)_74px_46px_96px]";

function Verdict({ verdict }: { verdict: string | null }) {
  if (verdict === "approved")
    return <span className="rounded-pill border border-border-2 px-[9px] py-0.5 text-[11.5px] text-ink-2">✓ approved</span>;
  if (verdict === "changes")
    return <span className="rounded-pill bg-meas-soft px-[9px] py-0.5 text-[11.5px] font-semibold text-meas">changes</span>;
  return null;
}

export function QueueList({
  queue,
  view,
  node,
  kind,
  open,
  ticked,
  onOpen,
  onTick,
}: {
  queue: QueuedDraftOut[];
  view: View;
  node: string;
  kind: string;
  open: Opened | null;
  ticked: Set<string>;
  onOpen: (opened: Opened) => void;
  onTick: (id: string) => void;
}) {
  const shown = queue.filter((d) => node === "" || d.public_id === node);
  const total = shown.reduce((n, d) => n + d.keys.length, 0);
  return (
    <section aria-label="Queue" className="flex min-h-0 flex-col overflow-hidden rounded-panel border border-border bg-surface">
      <div className={`grid ${COLS} gap-2.5 px-3 py-[9px] text-[11.5px] text-ink-3`}>
        <span />
        <span>Block</span>
        <span>Type</span>
        <span>Score</span>
        <span className="text-right">Your verdict</span>
      </div>
      {shown.map((draft) => {
        const approved = draft.keys.filter((k) => k.verdict === "approved").length;
        const keys = draft.keys.filter((k) => inView(view, k.verdict) && (kind === "" || k.kind === kind));
        return (
          <div key={draft.public_id} className="flex flex-col">
            <div className="flex items-center justify-between gap-2.5 border-t border-border bg-bg px-3 py-[9px] text-[12px]">
              <span>
                <b className="font-semibold text-ink">{draft.title}</b>
                <span className="text-ink-3">
                  {" "}· rev {draft.revision} · {draft.contributors.map((c) => c.name || c.email).join(", ")}
                </span>
              </span>
              <span className="text-ink-3 tabular-nums">{`${approved} of ${draft.keys.length}`}</span>
            </div>
            {!draft.reads && (
              <p className="border-t border-border px-3 py-2 text-[12.5px] text-open">This draft no longer reads against the index.</p>
            )}
            {keys.map((key) => {
              const id = `${draft.public_id}:${key.key}`;
              const on = open?.draft === draft.public_id && open.key === key.key;
              return (
                <div
                  key={id}
                  className={`grid ${COLS} items-center gap-2.5 border-t border-border px-3 text-[13px] ${
                    on ? "bg-sel-soft shadow-[inset_3px_0_0_var(--sel)]" : ticked.has(id) ? "bg-bg" : ""
                  }`}
                >
                  {key.verdict === "approved" ? (
                    <span />
                  ) : (
                    <input type="checkbox" aria-label={`Tick ${key.label}`} checked={ticked.has(id)} onChange={() => onTick(id)} />
                  )}
                  <button
                    type="button"
                    aria-label={`${key.label}, ${key.kind}`}
                    aria-current={on}
                    onClick={() => onOpen({ draft: draft.public_id, key: key.key })}
                    className="h-11 truncate text-left font-semibold"
                  >
                    {key.label}
                  </button>
                  <span className="font-mono text-[11.5px] text-ink-2">{key.kind}</span>
                  <span title="Scores arrive with the judge in M5" className="font-mono text-[12.5px] text-border-2">—</span>
                  <span className="flex justify-end"><Verdict verdict={key.verdict} /></span>
                </div>
              );
            })}
          </div>
        );
      })}
      <div className="mt-auto border-t border-border px-3 py-2.5 text-[12px] text-ink-3">
        {`${total} blocks in ${shown.length} ${shown.length === 1 ? "draft" : "drafts"} · scores arrive with the judge in M5`}
      </div>
    </section>
  );
}
```

Run `npx biome format --write` on the new files after writing; the snippets are not formatted.

- [ ] **Step 4: Run** `npm test -- review`, typecheck, lint → 0.
- [ ] **Step 5: Commit** — `feat(web): the review queue, grouped by draft, filtered by your verdict (#<b.8>)`.

---

### Task 9: The open block

**Files:** Create `apps/web/src/studio/review/BlockPanel.tsx`, `apps/web/src/studio/review/ReviewQuestion.tsx`;
Modify `ReviewPage.tsx`; Test `apps/web/src/studio/review/BlockPanel.test.tsx`.

**Interfaces:**
- Consumes: `useReview(draftId)`, `putAnswer`, `reviewed`/`setQueryData` (Task 5); `TestQuestion`'s
  `onAnswer` (Task 6); `wordDiff` (Task 7).
- Produces: `BlockPanel({ draft: QueuedDraftOut, item: ReviewItemOut })`;
  `ReviewQuestion({ draftId, question: ReviewQuestionOut })`; `answeredInto(client, draftId,
  question)` in `queries.ts` — writes one answered question into the cached review (key
  `${question.pool}/${question.id}`) and sets the queue key's `answered` to true.

- [ ] **Step 1: Write the failing tests** — `BlockPanel.test.tsx`:

```tsx
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { REVIEW, renderReview } from "./reviewKit";

afterEach(() => vi.unstubAllGlobals());

const openBlock = async (label: RegExp) =>
  userEvent.click(await screen.findByRole("button", { name: label }));

describe("ReviewPage — the open block", () => {
  it("draws a callout as a learner reads it", async () => {
    renderReview();
    await openBlock(/^TPM is not a count of reads/);
    expect(await screen.findByText("Equal reads, unequal TPM.")).toBeInTheDocument();
    expect(screen.getByText("Judge’s score · arrives with M5")).toBeInTheDocument();
  });

  it("shows a changed text block's words, gone and new", async () => {
    renderReview();
    await openBlock(/^A long transcript gives more fragments/);
    await userEvent.click(await screen.findByRole("tab", { name: "Changes" }));
    expect(screen.getByText("reads.", { selector: "del" })).toBeInTheDocument();
    expect(screen.getByText("fragments.", { selector: "ins" })).toBeInTheDocument();
  });

  it("says a block is unchanged, and new for a new one", async () => {
    renderReview();
    await openBlock(/^TPM is not a count of reads/);
    await userEvent.click(await screen.findByRole("tab", { name: "Changes" }));
    expect(screen.getByText("Unchanged since it landed.")).toBeInTheDocument();
  });

  it("asks a question before it shows the key, then shows it", async () => {
    const graded = {
      ...(REVIEW.items[3]?.question as object),
      given: 1,
      right: false,
      right_option: 0,
      rationale: "TPM is a share of molecules.",
    };
    const fake = renderReview({
      "PUT /api/studio/drafts/d-1/review/answers/tpm-or-count": { body: graded },
    });
    await openBlock(/^What does TPM tell you\?/);
    expect(screen.queryByText("TPM is a share of molecules.")).toBeNull();
    await userEvent.click(await screen.findByRole("button", { name: /A count of reads/ }));
    await userEvent.click(screen.getByRole("button", { name: "Answer" }));
    expect(await screen.findByText("TPM is a share of molecules.")).toBeInTheDocument();
    expect(screen.getByText(/Your answer: B · wrong/)).toBeInTheDocument();
    const sent = fake.mock.calls.find(([, init]) => init?.method === "PUT");
    expect(JSON.parse(String(sent?.[1]?.body))).toEqual({ given: 1 });
  });
});
```

- [ ] **Step 2: Run** → fail (nothing drawn in the middle).

- [ ] **Step 3: Implement** — `ReviewQuestion.tsx`:

```tsx
// A question in review (M4R.4, M4RS.4): asked as a test asks it, the key and rationale shown
// only once answered — and whether you were right, which counts but never blocks.
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { answeredInto } from "../../api/queries";
import { putAnswer } from "../../api/review";
import type { ReviewQuestionOut } from "../../api/schema";
import { ErrorNotice } from "../../layout/ErrorNotice";
import { TestQuestion } from "../../node/TestQuestion";

const LETTERS = "ABCDE";

const shownGiven = (q: ReviewQuestionOut) =>
  q.kind === "choice" && typeof q.given === "number"
    ? LETTERS[q.given] ?? String(q.given)
    : Array.isArray(q.given)
      ? q.given.join(" → ")
      : String(q.given);

const theKey = (q: ReviewQuestionOut) =>
  q.kind === "choice" && q.right_option !== null
    ? `${LETTERS[q.right_option]} · ${q.options?.[q.right_option] ?? ""}`
    : q.kind === "order"
      ? (q.right_steps ?? []).join(" → ")
      : `${q.value ?? ""}${q.unit ? ` ${q.unit}` : ""}${q.tolerance ? ` (± ${q.tolerance})` : ""}`;

export function ReviewQuestion({ draftId, question }: { draftId: string; question: ReviewQuestionOut }) {
  const client = useQueryClient();
  const answer = useMutation({
    mutationFn: (given: unknown) => putAnswer(draftId, question.id, given),
    onSuccess: (graded) => answeredInto(client, draftId, graded),
  });
  const ask = {
    stem: question.pool === "exam" ? question.stem : [{ kind: "text" as const, markdown: `${question.ask}\n` }],
    kind: question.kind as "choice" | "number" | "sequence" | "order",
    options: question.options ?? [],
    unit: question.unit,
    steps: question.steps ?? [],
  };
  return (
    <div className="flex max-w-[620px] flex-col gap-2.5">
      {question.given === null ? (
        <TestQuestion ask={ask} number={1} of={1} onAnswer={(given) => answer.mutate(given)} busy={answer.isPending} />
      ) : (
        <div className="flex flex-col gap-2 text-[14px]">
          <p>
            {`Your answer: ${shownGiven(question)} · ${question.right ? "right" : "wrong"}`}
          </p>
          <p className="rounded-[10px] border-2 border-btn bg-line-soft px-3 py-2">
            <span className="text-[12px] text-btn">Right answer · </span>
            {theKey(question)}
          </p>
          {question.rationale && <p className="text-[13.5px] text-ink-2">{question.rationale}</p>}
        </div>
      )}
      {question.hints.length > 0 && (
        <div className="flex flex-col gap-1 rounded-[10px] bg-bg px-3 py-2.5 text-[12.5px] text-ink-2">
          <span className="font-semibold text-ink">Hints the learner sees</span>
          {question.hints.map((hint, at) => (
            <span key={hint}>{`${at + 1} · ${hint}`}</span>
          ))}
        </div>
      )}
      <span className="text-[12px] text-ink-3">
        You answer before the right answer is shown; a wrong answer counts, never blocks.
      </span>
      {answer.error !== null && <ErrorNotice error={answer.error} />}
    </div>
  );
}
```

`answeredInto` in `queries.ts`:

```ts
/** One answered question, into the cached review and the queue (M4RS.4): nothing is asked again. */
export function answeredInto(client: QueryClient, draftId: string, question: ReviewQuestionOut) {
  const key = `${question.pool}/${question.id}`;
  client.setQueryData<ReviewOut>(queryKeys.review(draftId), (review) =>
    review === undefined
      ? review
      : { ...review, items: review.items.map((i) => (i.key === key ? { ...i, question } : i)) },
  );
  client.setQueryData<QueuedDraftOut[]>(queryKeys.reviewQueue, (queue) =>
    queue?.map((d) =>
      d.public_id !== draftId
        ? d
        : { ...d, keys: d.keys.map((k) => (k.key === key ? { ...k, answered: true } : k)) },
    ),
  );
}
```

`BlockPanel.tsx`:

```tsx
// The open block (M4RS.4): as a learner reads it, or what changed since it landed (M4RS.2); a
// question asked before its key shows; the judge's place, empty until M5.
import { useState } from "react";
import type { QueuedDraftOut, ReviewContentOut, ReviewItemOut } from "../../api/schema";
import { Body } from "../../node/Body";
import { wordDiff } from "./diff";
import { ReviewQuestion } from "./ReviewQuestion";

function Content({ content }: { content: ReviewContentOut }) {
  if (content.fields !== null) {
    const f = content.fields;
    const links = (name: string, list: { node: string; reason: string }[]) =>
      list.length === 0 ? null : (
        <p><b className="font-semibold">{name}:</b> {list.map((l) => `${l.node} (${l.reason})`).join("; ")}</p>
      );
    return (
      <div className="flex flex-col gap-1.5 text-[14px] leading-[1.6]">
        <p className="text-[17px] font-semibold">{f.title}</p>
        <p>{f.claim}</p>
        <p className="text-[13px] text-ink-2">{`${f.region} · ${f.level} · ${f.minutes} minutes`}</p>
        {links("Needs", f.needs)}
        {links("Goes deeper", f.goes_deeper)}
        {links("Related", f.related)}
      </div>
    );
  }
  if (content.block !== null) {
    return <div className="flex flex-col gap-2 text-[14px] leading-[1.65]"><Body blocks={[content.block]} questions={[]} /></div>;
  }
  if (content.resource !== null) {
    const r = content.resource;
    return (
      <div className="flex flex-col gap-1 rounded-[10px] bg-bg px-3.5 py-3 text-[13.5px]">
        <span className="font-semibold">{`${r.provider} · ${r.kind}`}</span>
        <a href={r.url} className="break-all text-sel">{r.url}</a>
        <span className="text-ink-2">{r.covers}</span>
        <span className="text-[12.5px] text-ink-3">{`${r.licence} · ${r.display} · ${r.level}`}</span>
      </div>
    );
  }
  if (content.question !== null) return <p className="text-[14px]">{content.question.ask}</p>;
  return null;
}

function Changes({ item }: { item: ReviewItemOut }) {
  if (item.change === "new") return <p className="text-[14px] text-ink-2">New in this draft.</p>;
  if (item.change === "same" || item.before === null)
    return <p className="text-[14px] text-ink-2">Unchanged since it landed.</p>;
  const was = item.before.block;
  const is = item.block;
  if (was?.kind === "text" && is?.kind === "text") {
    return (
      <p className="text-[14px] leading-[1.65] whitespace-pre-wrap">
        {wordDiff(was.markdown, is.markdown).map((piece, at) =>
          piece.kind === "same" ? (
            // biome-ignore lint/suspicious/noArrayIndexKey: pieces have no identity beyond their place
            <span key={at}>{piece.text}</span>
          ) : piece.kind === "gone" ? (
            // biome-ignore lint/suspicious/noArrayIndexKey: as above
            <del key={at} className="bg-open-soft text-open">{piece.text}</del>
          ) : (
            // biome-ignore lint/suspicious/noArrayIndexKey: as above
            <ins key={at} className="bg-line-soft text-btn no-underline">{piece.text}</ins>
          ),
        )}
      </p>
    );
  }
  return (
    <div className="grid gap-3.5 md:grid-cols-2">
      <div className="flex flex-col gap-1.5"><span className="text-[12px] text-ink-3">Before</span><Content content={item.before} /></div>
      <div className="flex flex-col gap-1.5"><span className="text-[12px] text-ink-3">Now</span><Content content={item} /></div>
    </div>
  );
}

export function BlockPanel({ draft, item }: { draft: QueuedDraftOut; item: ReviewItemOut }) {
  const [changes, setChanges] = useState(false);
  const label = draft.keys.find((k) => k.key === item.key)?.label ?? item.key;
  const by = draft.contributors.map((c) => c.name || c.email).join(", ");
  return (
    <section aria-label="Open block" className="flex min-w-0 flex-col gap-3.5 rounded-panel border border-border bg-surface px-5 py-[18px]">
      <div className="flex items-center justify-between gap-2.5">
        <div className="flex flex-col gap-0.5">
          <span className="text-[12px] text-ink-3">{`${draft.title} · ${item.kind} · written by ${by}`}</span>
          <span className="text-[19px] font-semibold">{label}</span>
        </div>
        <div role="tablist" aria-label="Show" className="flex rounded-[10px] border border-border bg-bg p-[3px]">
          {(["Standalone", "Changes"] as const).map((name) => {
            const on = (name === "Changes") === changes;
            return (
              <button key={name} type="button" role="tab" aria-selected={on} onClick={() => setChanges(name === "Changes")}
                className={`rounded-[7px] px-3 py-1 text-[12.5px] ${on ? "bg-surface font-semibold shadow-sm" : "text-ink-2"}`}>
                {name}
              </button>
            );
          })}
        </div>
      </div>
      {changes ? (
        <Changes item={item} />
      ) : item.question !== null ? (
        <ReviewQuestion draftId={draft.public_id} question={item.question} />
      ) : (
        <Content content={item} />
      )}
      <div className="flex flex-col gap-1 rounded-[10px] border-[1.5px] border-dashed border-border-2 px-3.5 py-3 text-[12.5px] text-ink-3">
        <span className="font-semibold text-ink-2">Judge’s score · arrives with M5</span>
        <span>A model from another family scores each block against its rubric; its named parts, reasons and redraft history go here.</span>
      </div>
    </section>
  );
}
```

`ReviewPage.tsx` — replace the Task 9 comment with:

```tsx
          <OpenBlock queue={drafts} open={open} />
```

and add

```tsx
function OpenBlock({ queue, open }: { queue: QueuedDraftOut[]; open: Opened | null }) {
  const review = useReview(open?.draft ?? null);
  const draft = queue.find((d) => d.public_id === open?.draft);
  if (open === null || draft === undefined)
    return <p className="text-[14px] text-ink-2">Choose a block to review it.</p>;
  if (review.isError) return <ErrorNotice error={review.error} />;
  const item = review.data?.items.find((i) => i.key === open.key);
  if (item === undefined) return <p className="text-[14px] text-ink-2">Loading the draft…</p>;
  return <BlockPanel draft={draft} item={item} />;
}
```

(`ReviewContentOut` exists in `schema.ts` from Task 2; if `api-types` named it otherwise, use that
name.) Format with Biome.

- [ ] **Step 4: Run** `npm test -- review`, typecheck, lint → 0.
- [ ] **Step 5: Commit** — `feat(web): the open block, as read, as changed, and asked (#<b.9>)`.

---

### Task 10: Verdicts on screen

**Files:** Create `apps/web/src/studio/review/VerdictPanel.tsx`, `apps/web/src/studio/review/BulkBar.tsx`;
Modify `ReviewPage.tsx`; Test `apps/web/src/studio/review/VerdictPanel.test.tsx`.

**Interfaces:**
- Consumes: `putVerdicts`, `approveDraft`, `sendBack`, `reviewed`, `decided` (Task 5); `useMe`.
- Produces: `VerdictPanel({ draft, item, onNext })`; `BulkBar({ queue, ticked, onDone })`; the
  page's keys A, R, J, K.

- [ ] **Step 1: Write the failing tests** — `VerdictPanel.test.tsx`:

```tsx
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QUEUE, REVIEW, renderReview } from "./reviewKit";

afterEach(() => vi.unstubAllGlobals());

const allApproved = [
  { ...QUEUE[0], keys: QUEUE[0]?.keys.map((k) => ({ ...k, verdict: "approved", answered: k.answered === null ? null : true })) },
];
const withVerdict = (key: string, verdict: string, note = "") => ({
  body: { ...REVIEW, items: REVIEW.items.map((i) => (i.key === key ? { ...i, verdict, note } : i)) },
});
const puts = (fake: ReturnType<typeof renderReview>) =>
  fake.mock.calls
    .filter(([, init]) => init?.method === "PUT")
    .map(([url, init]) => [url, JSON.parse(String(init?.body))]);

describe("ReviewPage — verdicts", () => {
  it("approves the open block with one PUT and marks it in the queue", async () => {
    const fake = renderReview({
      "PUT /api/studio/drafts/d-1/review/verdicts": withVerdict("block/1", "approved"),
    });
    await userEvent.click(await screen.findByRole("button", { name: /^TPM is not a count of reads/ }));
    await userEvent.click(await screen.findByRole("button", { name: "Approve this block" }));
    expect(puts(fake)).toEqual([
      ["/api/studio/drafts/d-1/review/verdicts", { revision: 2, verdicts: [{ key: "block/1", verdict: "approved" }] }],
    ]);
    expect(await screen.findByText("1 of 4")).toBeInTheDocument();
  });

  it("requests a change with a note", async () => {
    const fake = renderReview({
      "PUT /api/studio/drafts/d-1/review/verdicts": withVerdict("block/1", "changes", "Shorter."),
    });
    await userEvent.click(await screen.findByRole("button", { name: /^TPM is not a count of reads/ }));
    await userEvent.click(await screen.findByRole("button", { name: "Request changes…" }));
    await userEvent.type(screen.getByLabelText("What to change"), "Shorter.");
    await userEvent.click(screen.getByRole("button", { name: "Request" }));
    expect(puts(fake)[0]?.[1]).toEqual({ revision: 2, verdicts: [{ key: "block/1", verdict: "changes", note: "Shorter." }] });
  });

  it("does not approve a question before it is answered", async () => {
    renderReview();
    await userEvent.click(await screen.findByRole("button", { name: /^What does TPM tell you\?/ }));
    expect(await screen.findByRole("button", { name: "Approve this block" })).toBeDisabled();
  });

  it("approves ticked blocks together, leaving out an unanswered question", async () => {
    const fake = renderReview({ "PUT /api/studio/drafts/d-1/review/verdicts": { body: REVIEW } });
    await screen.findByText("What TPM measures");
    await userEvent.click(screen.getByLabelText("Tick Title, claim, level, links"));
    await userEvent.click(screen.getByLabelText("Tick TPM is not a count of reads"));
    await userEvent.click(screen.getByLabelText("Tick What does TPM tell you?"));
    expect(screen.getByText("What does TPM tell you? is skipped: answer it first.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Approve 2 blocks" }));
    expect(puts(fake)[0]?.[1]).toEqual({
      revision: 2,
      verdicts: [
        { key: "node", verdict: "approved" },
        { key: "block/1", verdict: "approved" },
      ],
    });
  });

  it("A approves and J moves on, but not while typing a note", async () => {
    // Review Focus 4.
    const fake = renderReview({
      "PUT /api/studio/drafts/d-1/review/verdicts": withVerdict("node", "approved"),
    });
    await userEvent.click(await screen.findByRole("button", { name: /^Title, claim, level, links/ }));
    await userEvent.click(await screen.findByRole("button", { name: "Request changes…" }));
    await userEvent.type(screen.getByLabelText("What to change"), "a");
    expect(puts(fake)).toEqual([]);
    await userEvent.click(screen.getByRole("heading", { name: "Review" }));
    await userEvent.keyboard("a");
    expect(puts(fake)).toHaveLength(1);
  });

  it("approves the draft once every block is, and it leaves the queue", async () => {
    const all = { body: { ...REVIEW, items: REVIEW.items.map((i) => ({ ...i, verdict: "approved" })) } };
    renderReview({
      "GET /api/studio/drafts/d-1/review": all,
      "GET /api/studio/review": { body: allApproved },
      "POST /api/studio/drafts/d-1/approve": { body: { public_id: "d-1", state: "approved" } },
    });
    await userEvent.click(await screen.findByRole("tab", { name: /Approved/ }));
    await userEvent.click(await screen.findByRole("button", { name: /^Title, claim, level, links/ }));
    await userEvent.click(await screen.findByRole("button", { name: "Approve the draft" }));
    expect(await screen.findByText("Nothing is waiting for review.")).toBeInTheDocument();
  });

  it("sends back with the requests and a note", async () => {
    const fake = renderReview({
      "GET /api/studio/drafts/d-1/review": withVerdict("block/1", "changes", "Shorter."),
      "POST /api/studio/drafts/d-1/send-back": { body: { public_id: "d-1", state: "open" } },
    });
    await userEvent.click(await screen.findByRole("button", { name: /^Title, claim, level, links/ }));
    await userEvent.type(await screen.findByLabelText("A note for the author"), "One thing.");
    await userEvent.click(screen.getByRole("button", { name: "Send back · 1 request" }));
    const sent = fake.mock.calls.find(([url]) => String(url).endsWith("/send-back"));
    expect(JSON.parse(String(sent?.[1]?.body))).toEqual({ revision: 2, reason: "One thing." });
  });
});
```

The draft in the approve and send-back answers carries only what `decided` reads (`public_id`).

- [ ] **Step 2: Run** → fail.

- [ ] **Step 3: Implement**

`VerdictPanel.tsx`:

```tsx
// Your verdict on the open block, and the draft's decision (M4.9a M4V.2, M4RS.4).
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { decided, reviewed, useMe, useReview } from "../../api/queries";
import { approveDraft, putVerdicts, sendBack } from "../../api/review";
import type { QueuedDraftOut, ReviewItemOut } from "../../api/schema";
import { ErrorNotice } from "../../layout/ErrorNotice";
import { PRIMARY, SECONDARY } from "../../layout/buttons";

function Condition({ ok, children }: { ok: boolean; children: string }) {
  return (
    <div className={`flex gap-2 text-[12.5px] ${ok ? "text-ink-2" : "font-semibold text-ink"}`}>
      <span aria-hidden="true" className={ok ? "text-ink-2" : "text-open"}>{ok ? "✓" : "✕"}</span>
      {children}
    </div>
  );
}

export function VerdictPanel({ draft, item }: { draft: QueuedDraftOut; item: ReviewItemOut }) {
  const client = useQueryClient();
  const me = useMe();
  const review = useReview(draft.public_id);
  const [asking, setAsking] = useState(false);
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const verdict = useMutation({
    mutationFn: (given: { verdict: "approved" | "changes"; note?: string }) =>
      putVerdicts(draft.public_id, draft.revision, [{ key: item.key, ...given }]),
    onSuccess: (answer) => {
      reviewed(client, draft.public_id, answer);
      setAsking(false);
      setNote("");
    },
  });
  const decide = useMutation({
    mutationFn: (how: "approve" | "send back") =>
      how === "approve"
        ? approveDraft(draft.public_id, draft.revision, reason)
        : sendBack(draft.public_id, draft.revision, reason),
    onSuccess: (moved) => decided(client, moved),
  });
  const own = draft.contributors.some((c) => c.public_id === me.data?.user?.public_id);
  const answered = item.question === null || item.question.given !== null;
  const items = review.data?.items ?? [];
  const approved = items.filter((i) => i.verdict === "approved").length;
  const asks = items.filter((i) => i.verdict === "changes").length;
  const all = items.length > 0 && approved === items.length;
  return (
    <aside aria-label="Your verdict" className="flex flex-col gap-3 rounded-panel border border-border bg-surface p-4">
      <h2 className="text-[14px] font-semibold">Your verdict</h2>
      <div className="flex flex-col gap-[7px]">
        <Condition ok>Read standalone</Condition>
        {item.question !== null && <Condition ok={answered}>Answered it yourself</Condition>}
        <Condition ok={!own}>{own ? "You wrote it: approving the draft needs a reason" : "You didn’t write it"}</Condition>
      </div>
      <button type="button" className={PRIMARY} disabled={!answered || verdict.isPending} onClick={() => verdict.mutate({ verdict: "approved" })}>
        Approve this block
      </button>
      {asking ? (
        <div className="flex flex-col gap-1.5">
          <label className="flex flex-col gap-1 text-[12.5px] font-medium">
            What to change
            <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} className="rounded-control border border-border-2 bg-surface px-2.5 py-2 text-[13px] font-normal" />
          </label>
          <div className="flex gap-1.5">
            <button type="button" className={SECONDARY} disabled={note.trim() === "" || verdict.isPending} onClick={() => verdict.mutate({ verdict: "changes", note })}>
              Request
            </button>
            <button type="button" className="text-[13px] text-ink-2" onClick={() => setAsking(false)}>Cancel</button>
          </div>
        </div>
      ) : (
        <button type="button" className={SECONDARY} onClick={() => setAsking(true)}>Request changes…</button>
      )}
      {verdict.error !== null && <ErrorNotice error={verdict.error} />}
      <div className="flex flex-col gap-2 border-t border-border pt-3">
        <span className="text-[13px] font-semibold">{`This draft · ${approved} of ${items.length} blocks approved`}</span>
        <span className="flex h-1.5 overflow-hidden rounded-[3px] bg-border">
          <span style={{ width: `${(100 * approved) / Math.max(items.length, 1)}%` }} className="bg-ink-2" />
          <span style={{ width: `${(100 * asks) / Math.max(items.length, 1)}%` }} className="bg-meas" />
        </span>
        <label className="flex flex-col gap-1 text-[12.5px] font-medium">
          {own ? "Why you approve your own draft, or a note for the author" : "A note for the author"}
          <textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} className="rounded-control border border-border-2 bg-surface px-2.5 py-2 text-[13px] font-normal" />
        </label>
        <button type="button" className={PRIMARY} disabled={!all || (own && reason.trim() === "") || decide.isPending} onClick={() => decide.mutate("approve")}>
          {all ? "Approve the draft" : `Approve the draft · ${items.length - approved} blocks left`}
        </button>
        <button type="button" className={SECONDARY} disabled={(asks === 0 && reason.trim() === "") || decide.isPending} onClick={() => decide.mutate("send back")}>
          {`Send back · ${asks} ${asks === 1 ? "request" : "requests"}`}
        </button>
        {decide.error !== null && <ErrorNotice error={decide.error} />}
      </div>
      <div className="flex flex-col gap-1 rounded-[10px] border-[1.5px] border-dashed border-border-2 px-3.5 py-3 text-[12.5px] text-ink-3">
        <span className="font-semibold text-ink-2">Was the score right? · M5</span>
        <span>Your answer will measure the judge in Quality.</span>
      </div>
      <div className="mt-auto flex flex-wrap gap-2.5 text-[11.5px] text-ink-3">
        <span><kbd>A</kbd> approve</span><span><kbd>R</kbd> request</span><span><kbd>J</kbd> <kbd>K</kbd> next / previous</span>
      </div>
    </aside>
  );
}
```

`BulkBar.tsx`:

```tsx
// Ticked blocks approved together (M4RS.4): one PUT per draft, all or nothing each; a question you
// have not answered is left out, and the bar says so.
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { reviewed } from "../../api/queries";
import { putVerdicts } from "../../api/review";
import type { QueuedDraftOut } from "../../api/schema";
import { ErrorNotice } from "../../layout/ErrorNotice";

export function BulkBar({ queue, ticked, onDone }: { queue: QueuedDraftOut[]; ticked: Set<string>; onDone: () => void }) {
  const client = useQueryClient();
  const chosen = queue.flatMap((d) => d.keys.filter((k) => ticked.has(`${d.public_id}:${k.key}`)).map((k) => ({ d, k })));
  const skipped = chosen.filter(({ k }) => k.answered === false);
  const sent = chosen.filter(({ k }) => k.answered !== false);
  const approve = useMutation({
    mutationFn: async () => {
      // Review Focus 3: one PUT per draft; a refused one leaves the others' approvals standing.
      for (const draft of queue) {
        const keys = sent.filter(({ d }) => d === draft).map(({ k }) => ({ key: k.key, verdict: "approved" as const }));
        if (keys.length === 0) continue;
        reviewed(client, draft.public_id, await putVerdicts(draft.public_id, draft.revision, keys));
      }
    },
    onSuccess: onDone,
  });
  if (chosen.length === 0) return null;
  return (
    <div role="region" aria-label="Ticked blocks" className="flex flex-col gap-1 rounded-[12px] bg-ink px-3.5 py-2.5 text-bg shadow-float">
      <div className="flex items-center gap-3 text-[13px]">
        <span className="font-semibold">{`${chosen.length} selected`}</span>
        <button type="button" disabled={sent.length === 0 || approve.isPending} onClick={() => approve.mutate()} className="ml-auto rounded-[8px] bg-surface px-[11px] py-[5px] font-semibold text-ink disabled:opacity-60">
          {`Approve ${sent.length} ${sent.length === 1 ? "block" : "blocks"}`}
        </button>
        <button type="button" onClick={onDone} className="opacity-75">Clear</button>
      </div>
      {skipped.map(({ k }) => (
        <span key={k.key} className="text-[11.5px] opacity-75">{`${k.label} is skipped: answer it first.`}</span>
      ))}
      {approve.error !== null && <ErrorNotice error={approve.error} />}
    </div>
  );
}
```

`ReviewPage.tsx`: after `<OpenBlock …/>` render, when an item is open,
`<VerdictPanel draft={draft} item={item} />` (move the item lookup up so both `OpenBlock` and
`VerdictPanel` use it — rename `OpenBlock` to `Opened` returning both panels in a fragment), and
the `BulkBar` under the queue (`<BulkBar queue={drafts} ticked={ticked} onDone={() => setTicked(new Set())} />`).
Keys:

```tsx
  useEffect(() => {
    const keys = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable]")) return; // Review Focus 4
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const flat = drafts.flatMap((d) => d.keys.filter((k) => inView(view, k.verdict)).map((k) => ({ draft: d.public_id, key: k.key })));
      const at = flat.findIndex((o) => o.draft === open?.draft && o.key === open?.key);
      if (event.key === "j" && flat[at + 1]) setOpen(flat[at + 1] as Opened);
      else if (event.key === "k" && at > 0) setOpen(flat[at - 1] as Opened);
      else if (event.key === "a" || event.key === "r") document.dispatchEvent(new CustomEvent(`review:${event.key}`));
    };
    document.addEventListener("keydown", keys);
    return () => document.removeEventListener("keydown", keys);
  }, [drafts, view, open]);
```

and in `VerdictPanel`, a `useEffect` listening for `review:a` (approve when allowed) and `review:r`
(`setAsking(true)`). Format with Biome.

- [ ] **Step 4: Run** `npm test`, typecheck, lint, build → 0.
- [ ] **Step 5: Commit** — `feat(web): verdicts, bulk approval and the draft's decision on screen (#<b.10>)`.

---

### Task 11: Requests in the workbench

**Files:** Create `apps/web/src/studio/workbench/Requests.tsx`; Modify `WorkbenchPage.tsx`,
`BlockList.tsx`, `ResourcesTab.tsx`, `ExamPoolTab.tsx`, `ExamEditor.tsx` (a note above the editor);
Test `apps/web/src/studio/workbench/Requests.test.tsx`; fixtures in `workbench/fixtures.ts`.

**Interfaces:** Produces `RequestsBanner({ draft })`; `RequestNote({ draft, keyNow })` (draws the
notes whose `now` is `keyNow`, nothing otherwise); `tabOf(key: string)` →
`"content" | "resources" | "exam" | "settings"`.

- [ ] **Step 1: Write the failing tests** — `Requests.test.tsx`:

```tsx
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { answering, renderAt, signedInAs, Where } from "../../test-kit";
import { DRAFT, NODE } from "./fixtures";
import { WorkbenchPage } from "./WorkbenchPage";

afterEach(() => vi.unstubAllGlobals());

const REQUESTS = {
  by: { public_id: "u-3", email: "grace@example.org", name: "Grace", role: "reviewer" },
  at: "2026-10-14T10:00:00Z",
  reason: "Two small things.",
  items: [
    { key: "block/0", kind: "text", note: "Say it shorter.", now: "block/0" },
    { key: "block/4", kind: "text", note: "Drop this.", now: null },
  ],
};

function bench(tab = "") {
  answering({
    "GET /api/me": signedInAs("author"),
    "GET /api/studio/drafts/d-1": { body: { ...DRAFT, node: NODE, requests: REQUESTS } },
  });
  renderAt(
    `/studio/drafts/d-1${tab}`,
    <>
      <Route path="/studio/drafts/:id" element={<><WorkbenchPage /><Where /></>} />
    </>,
  );
}

describe("Requests in the workbench", () => {
  it("lists the send back in a banner, a removed block marked", async () => {
    bench();
    expect(await screen.findByText(/Sent back by Grace/)).toBeInTheDocument();
    expect(screen.getByText("Two small things.")).toBeInTheDocument();
    // Review Focus 5.
    expect(screen.getByText(/Drop this\. · block removed/)).toBeInTheDocument();
  });

  it("shows a note beside its block", async () => {
    bench();
    expect(await screen.findAllByText("Say it shorter.")).toHaveLength(2); // banner and block
  });

  it("opens the tab a request is in", async () => {
    bench("?tab=settings");
    await userEvent.click(await screen.findByRole("button", { name: /Say it shorter\./ }));
    expect(screen.getByTestId("where")).toHaveTextContent("/studio/drafts/d-1");
  });
});
```

(`NODE` in `fixtures.ts` must have at least one text block; if it has none, give the test's draft
a node with `blocks: [{ kind: "text", markdown: "One.\n" }]`.)

- [ ] **Step 2: Run** → fail.

- [ ] **Step 3: Implement** — `Requests.tsx`:

```tsx
// A send back's requests in the workbench (M4.9b spec, M4RS.5): a banner, and each note beside the
// block it is now — read only, from the draft the workbench already holds.
import { useSearchParams } from "react-router";
import type { DraftOut } from "../../api/schema";

export const tabOf = (key: string) =>
  key.startsWith("resource/") ? "resources" : key.startsWith("exam/") ? "exam" : key === "node" ? "settings" : "content";

export function RequestsBanner({ draft }: { draft: DraftOut }) {
  const [, setParams] = useSearchParams();
  const back = draft.requests;
  if (back === null || back === undefined) return null;
  const who = back.by === null ? "a reviewer" : back.by.name || back.by.email;
  return (
    <section aria-label="Sent back" className="flex flex-col gap-1.5 rounded-panel border border-meas bg-meas-soft px-4 py-3 text-[13px]">
      <span className="font-semibold">{`Sent back by ${who} · ${back.items.length} ${back.items.length === 1 ? "request" : "requests"}`}</span>
      {back.reason && <span>{back.reason}</span>}
      <ul className="flex flex-col gap-1">
        {back.items.map((r) => (
          <li key={r.key}>
            {r.now === null ? (
              <span className="text-ink-2">{`${r.note} · block removed`}</span>
            ) : (
              <button type="button" className="text-left underline-offset-2 hover:underline" onClick={() => {
                const tab = tabOf(r.now as string);
                setParams(tab === "content" ? {} : { tab }, { replace: true });
              }}>
                {r.note}
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function RequestNote({ draft, keyNow }: { draft: DraftOut; keyNow: string }) {
  const notes = (draft.requests?.items ?? []).filter((r) => r.now === keyNow);
  if (notes.length === 0) return null;
  return (
    <div className="flex flex-col gap-0.5 rounded-[8px] bg-meas-soft px-2.5 py-1.5 text-[12.5px] text-meas">
      {notes.map((r) => (
        <span key={r.key}><b className="font-semibold">Requested:</b> {r.note}</span>
      ))}
    </div>
  );
}
```

`WorkbenchPage.tsx`'s `Bench`: `<RequestsBanner draft={draft} />` right after `<StateLine …/>`.
Pass `draft` (or `draft.requests`) down to `ContentTab` → `BlockList`, `ResourcesTab`, `ExamPoolTab`
through the tab bodies (each `body: (draft, node) => …` already has `draft`), and draw
`<RequestNote draft={draft} keyNow={…} />`: in `BlockList` under each row (`block.kind === "try" ?
\`try/${block.question}\` : \`block/${at}\``), in `ResourcesTab` under each closed card
(`resource/${at}`), in `ExamPoolTab`'s `Row` as a small amber *change requested* line and above
`ExamEditor` (`exam/${id}`), and in `SettingsTab` at the top (`node`). Format with Biome.

- [ ] **Step 4: Run** `npm test`, typecheck, lint, build → 0.
- [ ] **Step 5: Commit** — `feat(web): a send back's requests in the workbench, beside their blocks (#<b.11>)`.

---

### Task 12: The walk, the board and docs

- [ ] **Step 1: Full checks** — Python suite, ruff, ruff format, mypy, Django check, migration
  check; web lint, typecheck, test, build — every rc 0.
- [ ] **Step 2: Walk** in headless Chrome (puppeteer-core over `--remote-debugging-port=9222`,
  a fresh browser context per user) against `runserver` and `npm run dev`, with the index built
  from the fixtures: an author (invited in the shell) opens TPM, adds a resource, submits; a
  reviewer (invited) opens Review, sees TPM's group, answers its exam questions, requests a change
  on `block/1` with a note, sends it back; the author sees the banner and the note beside the
  callout, edits the callout, resubmits; the reviewer ticks the non-question blocks and approves
  them in bulk, approves the questions one by one, approves the draft; Review says *Nothing is
  waiting for review.* Count the requests each step makes (the page opens with one GET; each
  verdict one PUT; no GET after a write).
- [ ] **Step 3: The board** — screenshots of `/studio/review` at 1680 px in light and dark beside
  `.design/ReviewM4.dc.html`; bring the screen closer where it differs without reason; note what
  stays different in the spec's *Notes from the build*.
- [ ] **Step 4: Docs** — CLAUDE.md's layout line: `studio/` gains `review/ (S6: the queue, the
  open block, your verdict)`, `apps/api`'s gains `review_api.py: the queue`; the spec's *Notes from
  the build*; the journal entry `docs/notes/journal/2026-10-14-m4-9b-build.md` (where things stand,
  what changed by commit, decisions, what is next). `tests/repo` → 0.
- [ ] **Step 5: Commit** — `docs: M4.9b — the walk, notes from the build, the journal (#<b.12>)`.

**Done when** (M4RS.6): the walk above passes against the real API, compared with the board in
light and dark; the full checks pass.
