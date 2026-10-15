# M4.9c — The land screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An operator lands approved drafts from Studio's *Land* page (S10), watches the landing's
steps advance, browses past landings, and closes a failed one.

**Architecture:** The back end gains a ready route (`GET /api/studio/landings/ready`: approved
drafts no landing holds, with region, approver and the files that change, read from Postgres),
`LandingOut.landed` and `IndexOut.follow_seconds`. The web gains `studio/land/`: the views as tabs,
the Ready table with a bulk bar, a row per landing in the other views, and a side panel with the
landing card (polled every 15 s only while the landing moves), the failed cards and the index card.
Three GETs open the page.

**Tech Stack:** Python 3.14, Django 6 + Ninja, Postgres 18; React 19, TanStack Query 5, React
Router, Tailwind, TypeScript 7, vitest + Testing Library, Biome; Node 24.

**Spec:** `docs/superpowers/specs/2026-10-15-m4-land-screen-design.md` (M4LS.1–M4LS.4). It builds
on the archived `2026-10-06-m4-landing-design.md` (M4L.1–M4L.6) and
`2026-10-06-m4-following-design.md` (M4F). Board: `land()` in `.design/build_pages.mjs` (generated
`.design/Land.dc.html`; check the name with `ls .design/*.dc.html`).

## Global Constraints

- Python checks with CI's environment, from the repository root (`$CI_ENV` below):
  `CODE_SECRET_KEY=ci-only-insecure-key-for-github-actions-0000000000000000 CODE_DATABASE_URL=postgresql://code:code@localhost:5433/code CODE_DEBUG=false CODE_ALLOWED_HOSTS=localhost CODE_REDIS_URL=redis://localhost:6380/0`.
  Postgres and Redis: `docker compose up -d --wait postgres redis` (restart them if a run dies with
  connection refused or exit 137). Web checks in `apps/web` on Node 24: `npm run lint`,
  `npm run typecheck`, `npm test`, `npm run build`.
- **Never pipe a check into `tail`/`grep` and trust it**: redirect to a file and keep `$?`.
- After any API change: `$CI_ENV uv run python apps/api/manage.py export_openapi_schema --api code_api.api.api --sorted --indent 2 --output apps/api/openapi.json`, then `npm run api-types` in `apps/web`.
- No new CA codes. Starting answers CA0301–CA0305, closing CA0309–CA0311 (M4L.5).
- Requests stay few: the page opens with three GETs (ready, landings, index). A landing is asked
  for again every 15 s **only while it moves** (pending, open, or merged and not `landed`). A
  write's answer goes into the cache; only the ready list and the landings are asked again after
  a start, a close, or a watched landing settling.
- Land is for operators only: the landing router's guard (`studio(Role.OPERATOR)`) on the API, the
  page's `minRole: "operator"` on the web. A page is added in `studio/pages.ts` and nowhere else.
- No count on the rail entry (invariant 10). Red (`open`) is spent only on the *Failed* tag and a
  dropped draft; blue (`sel`) on the *Landing* tag, links and picked boxes; settled states are grey
  (invariant 11).
- The screen prints the API's own sentence for any refusal (`ErrorNotice`), as `client.ts` does.
- Biome forbids exports from test files: fixtures live in `studio/land/landKit.tsx`.
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; branch
  `feat/m4-9c-land-screen` (the spec is its first commit).

## Review Focus

1. **A landing whose drafts were all dropped**: it is refused, not merged; the card shows its
   reason and the drafts are back in Ready.
2. **The ready route and `/{public_id}`**: `GET /landings/ready` must not be read as a landing id
   (route order), and a stray id still answers CA0310.
3. **The poll after the page leaves**: unmounting the card stops its interval; a landing that
   settles refetches the lists once, not on every later render.
4. **Picked drafts that left the list** (landed elsewhere, sent back): the bulk bar counts and
   sends only rows still listed.
5. **A refusal's problems** (CA0305): each is shown under the row whose folder it names, and a
   problem in no listed folder still shows in the notice.

Each has its test in the task that owns the code.

---

### Task 0: The issues

- [ ] **Step 1:** Create the parent and its steps:

```bash
parent=$(gh issue create --title "M4.9c — the land screen" --body "Slice c of M4.9 (#127). Spec: docs/superpowers/specs/2026-10-15-m4-land-screen-design.md. Plan: docs/superpowers/plans/2026-10-15-m4-land-screen.md." | grep -o '[0-9]*$')
for title in "M4.9c.1 — the ready route" "M4.9c.2 — landed and follow_seconds" "M4.9c.3 — Land's data and place" "M4.9c.4 — Ready to land" "M4.9c.5 — the landings and their card" "M4.9c.6 — the failed card and the index" "M4.9c.7 — the walk and docs"; do
  n=$(gh issue create --title "$title" --body "Step of #$parent." | grep -o '[0-9]*$'); echo "$title #$n"
  gh api repos/comeni-project/Comeni-Code/issues/$parent/sub_issues -X POST -F sub_issue_id=$(gh api repos/comeni-project/Comeni-Code/issues/$n --jq .id) > /dev/null
done
gh api repos/comeni-project/Comeni-Code/issues/127/sub_issues -X POST -F sub_issue_id=$(gh api repos/comeni-project/Comeni-Code/issues/$parent --jq .id) > /dev/null
echo "parent #$parent"
```

Expected: eight issues; each task's commit cites its step's number as `(#<c.N>)`.

---

### Task 1: The ready route

**Files:**
- Modify: `apps/api/src/code_api/studio/landing.py` (add `Ready`, `changes`, `ready`)
- Modify: `apps/api/src/code_api/studio/schemas.py` (add `FileChangeOut`, `ReadyDraftOut` beside `LandingOut`)
- Modify: `apps/api/src/code_api/studio/landing_api.py` (the route, **before** `/{public_id}`)
- Test: `apps/api/tests/test_landing_ready.py`

**Interfaces:**
- Produces: `landing.changes(first: Revision | None, last: Revision) -> list[tuple[str, str]]`;
  `landing.ready() -> list[landing.Ready]`; `Ready(draft, revision, region, approval, files)`;
  `GET /api/studio/landings/ready -> list[ReadyDraftOut]` with fields `public_id, node_id, folder,
  revision, region, approved_by: MemberOut | None, self_approved, files: list[FileChangeOut]`, and
  `FileChangeOut(file: "node"|"body"|"exam", change: "new"|"changed"|"removed")`.

- [ ] **Step 1: Write the failing tests**

```python
"""The drafts ready to land (M4.9c spec, M4LS.1). Needs Compose's Postgres."""

from functools import reduce
from pathlib import Path
from typing import Any

import pytest
from django.test import Client

from code_api.accounts.models import User
from code_api.content.index import rebuild_index
from code_api.content.models import Region
from code_api.studio import drafts, landing
from code_api.studio.log import record
from code_api.studio.models import Draft, DraftEvent
from code_schema import Level, Text
from code_schema.edits import delete_exam_question, set_fields, update_block

pytestmark = pytest.mark.django_db

FIXTURES = Path(__file__).resolve().parents[3] / "tests" / "fixtures" / "salmon"
READY = "/api/studio/landings/ready"


@pytest.fixture(autouse=True)
def _indexed(settings: Any, monkeypatch: pytest.MonkeyPatch) -> None:
    rebuild_index(FIXTURES, commit="base-1")
    settings.CODE_GITHUB_APP = object()
    monkeypatch.setattr("code_api.studio.tasks.land.delay", lambda public_id: None)


def approve(draft: Draft, judge: User) -> Draft:
    number = drafts.latest(draft).number
    Draft.objects.filter(pk=draft.pk).update(state=Draft.State.APPROVED)
    by = draft.created_by
    record(draft, DraftEvent.Kind.APPROVED, by=judge, revision=number, self_approved=by == judge)
    return Draft.objects.get(pk=draft.pk)


def edited(node_id: str, edit: Any, author: User) -> Draft:
    draft = drafts.open_existing(node_id, by=author)
    drafts.save(draft, based_on=1, edit=edit, by=author, change="e")
    return draft


def listed(by: User) -> dict[str, dict[str, Any]]:
    client = Client()
    client.force_login(by)
    answer = client.get(READY)
    assert answer.status_code == 200, answer.content
    return {row["node_id"]: row for row in answer.json()}


def test_approved_drafts_no_landing_holds_in_node_order(ada: User, grace: User, otto: User) -> None:
    tpm = approve(edited("tpm", lambda n: set_fields(n, minutes=n.minutes + 1), ada), grace)
    salmon = approve(edited("salmon", lambda n: set_fields(n, minutes=n.minutes + 1), ada), grace)
    drafts.open_existing("k-mers", by=ada)  # open: not ready
    landing.start([salmon.public_id], by=otto)  # held: not ready
    rows = listed(otto)
    assert list(rows) == ["tpm"]
    row = rows["tpm"]
    assert (row["public_id"], row["revision"], row["folder"]) == (
        str(tpm.public_id),
        2,
        "transcriptomics/tpm",
    )
    assert row["region"] == Region.objects.get(id="transcriptomics").name
    assert (row["approved_by"]["name"], row["self_approved"]) == (grace.name, False)


def test_files_say_what_changes_and_leave_out_the_rest(ada: User, grace: User, otto: User) -> None:
    approve(edited("tpm", lambda n: set_fields(n, minutes=n.minutes + 1), ada), grace)
    body = Text(markdown="Shorter.\n")
    approve(edited("salmon", lambda n: update_block(n, 0, body), ada), grace)
    rows = listed(otto)
    assert rows["tpm"]["files"] == [{"file": "node", "change": "changed"}]
    assert rows["salmon"]["files"] == [{"file": "body", "change": "changed"}]


def test_an_exam_emptied_is_removed(ada: User, grace: User, otto: User) -> None:
    def empty(n: Any) -> Any:
        return reduce(lambda m, q: delete_exam_question(m, q.id), n.exam, n)

    approve(edited("tpm", empty, ada), grace)
    assert listed(otto)["tpm"]["files"] == [{"file": "exam", "change": "removed"}]


def test_a_new_node_is_new_throughout(otto: User) -> None:
    draft = drafts.open_new(
        "bubbles",
        title="Bubbles",
        claim="A claim.",
        region="algorithms",
        level=Level.INTRODUCTORY,
        minutes=10,
        by=otto,
    )
    approve(draft, otto)
    row = listed(otto)["bubbles"]
    assert {"file": "node", "change": "new"} in row["files"]
    assert {each["change"] for each in row["files"]} == {"new"}
    assert row["self_approved"] is True


def test_only_an_operator_reads_it(grace: User) -> None:
    client = Client()
    client.force_login(grace)
    answer = client.get(READY)
    assert (answer.status_code, answer.json()["code"]) == (403, "CA0102")


def test_a_landing_id_still_reads_as_one(otto: User) -> None:
    # Review Focus 2: /ready is not a landing id, and an unknown id is still CA0310.
    client = Client()
    client.force_login(otto)
    answer = client.get("/api/studio/landings/00000000-0000-0000-0000-000000000000")
    assert (answer.status_code, answer.json()["code"]) == (404, "CA0310")
```

If `User` has no `name` attribute, compare `approved_by["email"]` with `grace.email` instead, and
ledger the ruling (check `MemberOut.of` in `apps/api/src/code_api/accounts/api.py`).

- [ ] **Step 2: Run them to see them fail**

Run: `$CI_ENV uv run pytest apps/api/tests/test_landing_ready.py -q`
Expected: the first five FAIL (404 for `/ready`, or 422 reading `ready` as a UUID);
`test_a_landing_id_still_reads_as_one` PASSES already (it pins the route order).

- [ ] **Step 3: Add the schemas** in `schemas.py`, after `LandingOut`:

```python
class FileChangeOut(Schema):
    file: str  # node, body or exam
    change: str  # new, changed or removed


class ReadyDraftOut(Schema):
    """An approved draft no landing holds, as Land lists it (M4.9c spec, M4LS.1)."""

    public_id: UUID
    node_id: str
    folder: str
    revision: int
    region: str  # its name; empty when the draft no longer reads against the index
    approved_by: MemberOut | None
    self_approved: bool
    files: list[FileChangeOut]  # only the files that change, in node, body, exam order
```

- [ ] **Step 4: Add `changes` and `ready`** in `landing.py` (imports: `Region` from
  `code_api.content.models`, `Revision` from `code_api.studio.models`; `dataclass` is imported
  already for `BatchFails` — check, and add it if not):

```python
# A revision's files by name, in the order Land shows them (M4LS.1).
_FILES = (("node", "node_yaml"), ("body", "body_md"), ("exam", "exam_yaml"))


def changes(first: Revision | None, last: Revision) -> list[tuple[str, str]]:
    """Which of `last`'s files differ from the draft's first revision, and how. Revision 1 holds
    the live node as the draft started from it; a new node has none, so all it carries is new."""
    found: list[tuple[str, str]] = []
    for name, attribute in _FILES:
        before = "" if first is None else getattr(first, attribute)
        now = getattr(last, attribute)
        if before != now:
            found.append((name, "new" if not before else "removed" if not now else "changed"))
    return found


@dataclass(frozen=True)
class Ready:
    draft: Draft
    revision: int
    region: str
    approval: DraftEvent
    files: list[tuple[str, str]]


def ready() -> list[Ready]:
    """Every approved draft no landing holds, in node order (M4LS.1). Read from Postgres only."""
    held = LandingDraft.objects.filter(live=True).values("draft")
    names = dict(Region.objects.values_list("id", "name"))
    found: list[Ready] = []
    approved = Draft.objects.filter(state=Draft.State.APPROVED).exclude(pk__in=held)
    for draft in approved.order_by("node_id"):
        last = drafts.latest(draft)
        first = draft.revisions.get(number=1) if draft.base_digest else None
        node, _ = drafts.node_of(draft, last)
        region = "" if node is None else names.get(node.region, node.region)
        found.append(Ready(draft, last.number, region, _approval(draft), changes(first, last)))
    return found
```

- [ ] **Step 5: Add the route** in `landing_api.py`, placed **after** `landings` and **before**
  `read` (so `/ready` is never read as an id):

```python
@router.get("/ready", response=list[ReadyDraftOut], summary="Approved drafts no landing holds")
def ready_drafts(request: HttpRequest) -> list[ReadyDraftOut]:
    return [
        ReadyDraftOut(
            public_id=one.draft.public_id,
            node_id=one.draft.node_id,
            folder=one.draft.folder,
            revision=one.revision,
            region=one.region,
            approved_by=None if one.approval.by is None else MemberOut.of(one.approval.by),
            self_approved=one.approval.self_approved,
            files=[FileChangeOut(file=name, change=change) for name, change in one.files],
        )
        for one in landing.ready()
    ]
```

Import `FileChangeOut, ReadyDraftOut` from `code_api.studio.schemas`.

- [ ] **Step 6: Run the tests**

Run: `$CI_ENV uv run pytest apps/api/tests/test_landing_ready.py apps/api/tests/test_landing_api.py -q`
Expected: all PASS.

- [ ] **Step 7: Commit** (after `uv run ruff format apps/api && uv run ruff check apps/api`)

```bash
git add apps/api/src/code_api/studio/landing.py apps/api/src/code_api/studio/schemas.py apps/api/src/code_api/studio/landing_api.py apps/api/tests/test_landing_ready.py
git commit -m "feat(api): the drafts ready to land, with their region, approver and files (#<c.1>)" -m "Land's first GET (M4.9c spec, M4LS.1): approved drafts no landing holds, files compared with revision 1 in Postgres, no GitHub call.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: `landed`, `follow_seconds`, and the API's flow

**Files:**
- Modify: `apps/api/src/code_api/studio/landing.py` (add `landed`)
- Modify: `apps/api/src/code_api/studio/schemas.py` (`LandingOut.landed`, `IndexOut.follow_seconds`)
- Modify: `apps/api/src/code_api/studio/landing_api.py` (`landing_out`)
- Modify: `apps/api/src/code_api/studio/index_api.py`
- Modify: `apps/api/openapi.json`, `apps/web/src/api/schema.ts` (generated)
- Test: `apps/api/tests/test_landing_ready.py` (append), `apps/api/tests/test_index_api.py` (append)

**Interfaces:**
- Consumes: Task 1's ready route.
- Produces: `landing.landed(made: Landing) -> bool`; `LandingOut.landed: bool`;
  `IndexOut.follow_seconds: int`; the web types `ReadyDraftOut`, `FileChangeOut`, `LandingOut`
  (with `landed`), `IndexOut` (with `follow_seconds`) in `schema.ts`.

- [ ] **Step 1: Write the failing tests.** Append to `test_landing_ready.py` (add imports
  `from fake_github import FakeGitHub`; `from code_api.studio import github`):

```python
def land(client: Client, *ids: object) -> dict[str, Any]:
    answer = client.post(
        "/api/studio/landings", {"drafts": [str(i) for i in ids]}, content_type="application/json"
    )
    assert answer.status_code == 202, answer.content
    return answer.json()


def test_a_landing_from_ready_to_landed(ada: User, grace: User, otto: User) -> None:
    # Done when (M4LS.4): two drafts land, one is dropped with its reason, the rest reach the index.
    tpm = approve(edited("tpm", lambda n: set_fields(n, minutes=n.minutes + 1), ada), grace)
    salmon = approve(edited("salmon", lambda n: set_fields(n, minutes=n.minutes + 1), ada), grace)
    client = Client()
    client.force_login(otto)
    assert set(listed(otto)) == {"tpm", "salmon"}
    started = land(client, tpm.public_id, salmon.public_id)
    assert (started["state"], started["landed"]) == ("pending", False)
    assert listed(otto) == {}

    fake = FakeGitHub(since={"base-1": {"transcriptomics/tpm/body.md"}})
    made = landing.run(Landing.objects.get(public_id=started["public_id"]), fake)
    read = client.get(f"/api/studio/landings/{made.public_id}").json()
    assert read["state"] == "open"
    dropped = next(e for e in read["entries"] if e["node_id"] == "tpm")
    assert (dropped["live"], dropped["dropped_code"]) == (False, "CA0306")
    assert set(listed(otto)) == {"tpm"}  # dropped, still approved, ready again

    fake.merged.add(made.pull_number or 0)
    landing.watch(made, fake)
    read = client.get(f"/api/studio/landings/{made.public_id}").json()
    assert (read["state"], read["landed"]) == ("merged", False)

    landing.mark_landed("index-2", lambda ancestor, commit: True)
    read = client.get(f"/api/studio/landings/{made.public_id}").json()
    assert (read["state"], read["landed"]) == ("merged", True)
    assert set(listed(otto)) == {"tpm"}


def test_a_closed_landing_gives_its_drafts_back(
    ada: User, grace: User, otto: User, monkeypatch: pytest.MonkeyPatch
) -> None:
    fake = FakeGitHub()
    monkeypatch.setattr(github, "from_settings", lambda: fake)
    salmon = approve(edited("salmon", lambda n: set_fields(n, minutes=n.minutes + 1), ada), grace)
    client = Client()
    client.force_login(otto)
    made = landing.run(
        Landing.objects.get(public_id=land(client, salmon.public_id)["public_id"]), fake
    )
    fake.checks[made.pull_number or 0] = (("validate", "https://ci.test/1"),)
    landing.watch(made, fake)
    assert listed(otto) == {}  # a failed landing holds its drafts
    answer = client.post(f"/api/studio/landings/{made.public_id}/close")
    assert (answer.status_code, answer.json()["landed"]) == (200, False)
    assert set(listed(otto)) == {"salmon"}


def test_a_landing_whose_drafts_were_all_dropped_is_refused_and_gives_them_back(
    ada: User, grace: User, otto: User
) -> None:
    # Review Focus 1.
    tpm = approve(edited("tpm", lambda n: set_fields(n, minutes=n.minutes + 1), ada), grace)
    client = Client()
    client.force_login(otto)
    started = land(client, tpm.public_id)
    fake = FakeGitHub(since={"base-1": {"transcriptomics/tpm/body.md"}})
    landing.run(Landing.objects.get(public_id=started["public_id"]), fake)
    read = client.get(f"/api/studio/landings/{started['public_id']}").json()
    assert (read["state"], read["landed"]) == ("refused", False)
    assert read["reason"]
    assert set(listed(otto)) == {"tpm"}
```

Add `Landing` to the test's import from `code_api.studio.models`. Append to `test_index_api.py`:

```python
def test_the_index_route_says_how_often_main_is_followed(ada: User, settings: Any) -> None:
    settings.FOLLOW_SECONDS = 300
    assert signed_in(ada).get("/api/studio/index").json()["follow_seconds"] == 300
```

(add `from typing import Any` if missing).

- [ ] **Step 2: Run them to see them fail**

Run: `$CI_ENV uv run pytest apps/api/tests/test_landing_ready.py apps/api/tests/test_index_api.py -q`
Expected: the four new tests FAIL with `KeyError: 'landed'` / `'follow_seconds'`. If the
all-dropped landing is not `refused`, read `_land` in `landing.py` and say what it is: the spec's
Review Focus 1 expects the drafts back in Ready either way; ledger a ruling if the state differs.

- [ ] **Step 3: Implement.** In `landing.py`:

```python
def landed(made: Landing) -> bool:
    """Merged, and every draft it kept is in the index (M4.9c spec, M4LS.1)."""
    if made.state != Landing.State.MERGED:
        return False
    kept = made.entries.filter(dropped_code="")
    return not kept.exclude(draft__state=Draft.State.LANDED).exists()
```

In `schemas.py`, `LandingOut` gains `landed: bool` (after `reason`), and `IndexOut` gains
`follow_seconds: int` (before `regions`). In `landing_api.landing_out`, pass
`landed=landing.landed(made)`. In `index_api.index`, pass
`follow_seconds=settings.FOLLOW_SECONDS` (`from django.conf import settings`).

- [ ] **Step 4: Run them**

Run: `$CI_ENV uv run pytest apps/api/tests -q -k "landing or index" > /tmp/claude-1000/land-t2.log 2>&1; echo rc=$?`
Expected: rc=0.

- [ ] **Step 5: Regenerate the schema and the web types**

```bash
$CI_ENV uv run python apps/api/manage.py export_openapi_schema --api code_api.api.api --sorted --indent 2 --output apps/api/openapi.json
cd apps/web && npm run api-types && npm run typecheck; echo rc=$?
```

Expected: rc=0; `schema.ts` exports `ReadyDraftOut` and `FileChangeOut`. If the web's test
fixtures build `LandingOut` or `IndexOut` literals, typecheck names them: add `landed: false` /
`follow_seconds: 300` there.

- [ ] **Step 6: Commit** (after `uv run ruff format apps/api && uv run ruff check apps/api && $CI_ENV uv run mypy`)

```bash
git add apps/api apps/web/src/api/schema.ts apps/web/src
git commit -m "feat(api): a landing says when it is in the index, the index how often it follows (#<c.2>)" -m "LandingOut.landed and IndexOut.follow_seconds (M4.9c spec, M4LS.1), and the API's flow from ready to landed, closed and refused.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Land's data and place

**Files:**
- Create: `apps/web/src/api/landing.ts`
- Modify: `apps/web/src/api/queries.ts`
- Create: `apps/web/src/studio/land/views.ts`, `apps/web/src/studio/land/views.test.ts`
- Create: `apps/web/src/studio/land/words.ts`, `apps/web/src/studio/land/words.test.ts`
- Create: `apps/web/src/studio/land/LandPage.tsx`, `apps/web/src/studio/land/landKit.tsx`, `apps/web/src/studio/land/LandPage.test.tsx`
- Modify: `apps/web/src/studio/pages.ts`, `apps/web/src/studio/pages.test.ts`, `apps/web/src/App.tsx`

**Interfaces:**
- Consumes: Task 2's types.
- Produces:
  - `api/landing.ts`: `fetchReady`, `fetchLandings`, `fetchLanding(id)`, `startLanding(ids)`,
    `closeLanding(id)`, `moving(l: LandingOut): boolean`.
  - `queries.ts`: keys `landReady`, `landings`, `landing(id)`; `LANDING_POLL_MS = 15_000`;
    `useReadyDrafts()`, `useLandings()`, `useStudioIndex()`, `useLanding(listed)`,
    `landingMoved(client, made)`.
  - `views.ts`: `VIEWS`, `type View`, `landingsIn(view, landings)`, `STEPS`, `type Step`,
    `stepsOf(landing): Step[]`.
  - `words.ts`: `ago(iso, now?)`, `every(seconds)`, `who(member)`, `fileLabel(file)`.
  - `landKit.tsx`: `READY`, `LANDINGS`, `INDEX`, `landingOf(overrides)`, `renderLand(extra)`.

- [ ] **Step 1: Write the failing pure tests.** `views.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { landingOf } from "./landKit";
import { landingsIn, stepsOf } from "./views";

describe("Land's views", () => {
  const all = [
    landingOf({ public_id: "p", state: "pending" }),
    landingOf({ public_id: "o", state: "open" }),
    landingOf({ public_id: "m", state: "merged", landed: false }),
    landingOf({ public_id: "l", state: "merged", landed: true }),
    landingOf({ public_id: "c", state: "closed" }),
    landingOf({ public_id: "f", state: "failed" }),
    landingOf({ public_id: "r", state: "refused" }),
  ];
  const ids = (view: Parameters<typeof landingsIn>[0]) =>
    landingsIn(view, all).map((l) => l.public_id);

  it("puts each landing in one view", () => {
    expect(ids("Landing")).toEqual(["p", "o", "m"]);
    expect(ids("Landed")).toEqual(["l"]);
    expect(ids("Failed")).toEqual(["f", "c", "r"]);
    expect(ids("Ready to land")).toEqual([]);
  });

  it("marks the steps a landing has passed", () => {
    expect(stepsOf(landingOf({ state: "pending" }))).toEqual(["on", "todo", "todo", "todo", "todo"]);
    expect(stepsOf(landingOf({ state: "open" }))).toEqual(["done", "done", "on", "todo", "todo"]);
    expect(stepsOf(landingOf({ state: "merged", landed: false }))).toEqual([
      "done", "done", "done", "done", "on",
    ]);
    expect(stepsOf(landingOf({ state: "merged", landed: true }))).toEqual([
      "done", "done", "done", "done", "done",
    ]);
  });
});
```

`words.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { ago, every, fileLabel, who } from "./words";

const NOW = Date.parse("2026-10-15T12:00:00Z");

describe("Land's words", () => {
  it("says how long ago", () => {
    expect(ago("2026-10-15T11:59:40Z", NOW)).toBe("just now");
    expect(ago("2026-10-15T11:56:00Z", NOW)).toBe("4 min ago");
    expect(ago("2026-10-15T09:00:00Z", NOW)).toBe("3 h ago");
    expect(ago("2026-10-14T09:00:00Z", NOW)).toBe("yesterday");
    expect(ago("2026-10-11T09:00:00Z", NOW)).toBe("4 days ago");
  });

  it("says how often", () => {
    expect(every(300)).toBe("every 5 minutes");
    expect(every(60)).toBe("every minute");
    expect(every(45)).toBe("every 45 seconds");
  });

  it("names a person and a file", () => {
    expect(who({ public_id: "u", email: "g@example.org", name: "Grace", role: "reviewer" })).toBe("Grace");
    expect(who({ public_id: "u", email: "g@example.org", name: "", role: "reviewer" })).toBe("g@example.org");
    expect(who(null)).toBe("a former member");
    expect(fileLabel({ file: "body", change: "changed" })).toBe("~body");
    expect(fileLabel({ file: "exam", change: "removed" })).toBe("-exam");
    expect(fileLabel({ file: "node", change: "new" })).toBe("+node");
  });
});
```

Check `MemberOut`'s fields in `schema.ts` and match the literal to them.

- [ ] **Step 2: Write `landKit.tsx`** (fixtures, needed for the tests to compile):

```tsx
// Land's tests (M4.9c): two drafts ready, landings in each state, the index, as the API answers.
import { Route } from "react-router";
import type { IndexOut, LandingOut, ReadyDraftOut } from "../../api/schema";
import { type Answer, answering, renderAt, signedInAs } from "../../test-kit";
import { LandPage } from "./LandPage";

const GRACE = { public_id: "u-2", email: "grace@example.org", name: "Grace", role: "reviewer" };
const OTTO = { public_id: "u-3", email: "otto@example.org", name: "Otto", role: "operator" };

export const READY: ReadyDraftOut[] = [
  {
    public_id: "d-1",
    node_id: "salmon",
    folder: "transcriptomics/salmon",
    revision: 4,
    region: "Transcriptomics",
    approved_by: GRACE,
    self_approved: false,
    files: [
      { file: "node", change: "changed" },
      { file: "body", change: "changed" },
    ],
  },
  {
    public_id: "d-2",
    node_id: "tpm",
    folder: "transcriptomics/tpm",
    revision: 3,
    region: "Transcriptomics",
    approved_by: OTTO,
    self_approved: true,
    files: [{ file: "exam", change: "removed" }],
  },
];

export const landingOf = (overrides: Partial<LandingOut> = {}): LandingOut => ({
  public_id: "l-1",
  state: "open",
  started_by: OTTO,
  started_at: "2026-10-15T11:56:00Z",
  main_head: "a1b2c3d4e5f6",
  branch: "studio/land-7f3a",
  pull_number: 42,
  pull_url: "https://github.com/comeni-project/comeni-code-content/pull/42",
  reason: "",
  landed: false,
  entries: [
    { draft: "d-9", node_id: "k-mers", revision: 6, live: true, dropped_code: "", dropped_reason: "" },
  ],
  ...overrides,
});

export const LANDINGS: LandingOut[] = [
  landingOf({ public_id: "l-2", pull_number: 41, state: "merged", landed: true }),
];

export const INDEX: IndexOut = {
  live: {
    commit: "a1b2c3d4e5f6",
    digest: "x",
    outcome: "applied",
    node_count: 26,
    created_at: "2026-10-15T11:57:00Z",
    problems: [],
  },
  latest: null,
  main_head: "a1b2c3d4e5f6",
  checked_at: "2026-10-15T11:57:00Z",
  behind: false,
  follow_seconds: 300,
  regions: [],
};

export function renderLand(extra: Record<string, Answer | ((init?: RequestInit) => Answer)> = {}) {
  const fake = answering({
    "GET /api/me": signedInAs("operator"),
    "GET /api/studio/landings/ready": { body: READY },
    "GET /api/studio/landings": { body: LANDINGS },
    "GET /api/studio/index": { body: INDEX },
    ...extra,
  });
  renderAt("/studio/land", <Route path="/studio/land" element={<LandPage />} />);
  return fake;
}
```

- [ ] **Step 3: Write the page's failing tests.** `LandPage.test.tsx`:

```tsx
import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderLand } from "./landKit";

afterEach(() => vi.unstubAllGlobals());

describe("LandPage — its place", () => {
  it("opens with three questions and counts each view", async () => {
    const fake = renderLand();
    expect(await screen.findByRole("tab", { name: /Ready to land 2/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Landed 1/ })).toBeInTheDocument();
    const asked = fake.mock.calls.map(([url]) => url).filter((url) => url !== "/api/me");
    expect(asked.sort()).toEqual([
      "/api/studio/index",
      "/api/studio/landings",
      "/api/studio/landings/ready",
    ]);
  });
});
```

In `pages.test.ts`, change the operator list to `["Drafts", "Review", "Land", "Team"]` and add:

```ts
  it("offers Land to operators only", () => {
    expect(pagesFor("reviewer").map((p) => p.label)).not.toContain("Land");
    expect(pageAt("/studio/land")?.minRole).toBe("operator");
  });
```

- [ ] **Step 4: Run them to see them fail**

Run: `cd apps/web && npx vitest run src/studio/land src/studio/pages.test.ts`
Expected: FAIL — `./views`, `./words`, `./LandPage` not found; pages lists no Land.

- [ ] **Step 5: Write `api/landing.ts`:**

```ts
// Landing (M4.6, M4.9c): the drafts ready to land, the landings, one landing, start and close.
import { getJson, sendJson } from "./client";
import type { LandingOut, ReadyDraftOut } from "./schema";

const LANDINGS = "/api/studio/landings";

export const fetchReady = (signal?: AbortSignal) =>
  getJson<ReadyDraftOut[]>(`${LANDINGS}/ready`, signal);

export const fetchLandings = (signal?: AbortSignal) => getJson<LandingOut[]>(LANDINGS, signal);

export const fetchLanding = (id: string, signal?: AbortSignal) =>
  getJson<LandingOut>(`${LANDINGS}/${id}`, signal);

export const startLanding = (drafts: string[]) =>
  sendJson<LandingOut>("POST", LANDINGS, { drafts });

export const closeLanding = (id: string) => sendJson<LandingOut>("POST", `${LANDINGS}/${id}/close`);

/** Still on its way: pending, open, or merged and not yet in the index (M4.9c spec, M4LS.2). */
export const moving = (landing: LandingOut) =>
  landing.state === "pending" ||
  landing.state === "open" ||
  (landing.state === "merged" && !landing.landed);
```

- [ ] **Step 6: Add the queries** to `queries.ts`. Keys, inside `queryKeys`:

```ts
  landReady: ["land", "ready"] as const,
  landings: ["land", "landings"] as const,
  landing: (id: string) => ["land", "landing", id] as const,
```

Imports: `useEffect, useRef` from `react`; `fetchLanding, fetchLandings, fetchReady, moving` from
`./landing`; `LandingOut` from `./schema`. Then:

```ts
/** A landing is asked for again this often, only while it moves (M4.9c spec, M4LS.2). */
export const LANDING_POLL_MS = 15_000;

/** Approved drafts no landing holds: Land's table (M4LS.1). */
export const useReadyDrafts = () =>
  useQuery({ queryKey: queryKeys.landReady, queryFn: ({ signal }) => fetchReady(signal), retry: false });

/** Every landing, newest first: Land's other views, filtered here. */
export const useLandings = () =>
  useQuery({ queryKey: queryKeys.landings, queryFn: ({ signal }) => fetchLandings(signal), retry: false });

/** The index and main, whole; `useRegions` reads the same entry. */
export const useStudioIndex = () =>
  useQuery({
    queryKey: queryKeys.studioIndex,
    queryFn: ({ signal }) => getJson<IndexOut>("/api/studio/index", signal),
    retry: false,
  });

/** The ready list and the landings asked again: a landing started, closed or settled. */
function landChanged(client: QueryClient) {
  void client.invalidateQueries({ queryKey: queryKeys.landReady });
  void client.invalidateQueries({ queryKey: queryKeys.landings });
  void client.invalidateQueries({ queryKey: ["drafts"] });
}

/** A write's answer in place, and the lists asked again. */
export function landingMoved(client: QueryClient, made: LandingOut) {
  client.setQueryData(queryKeys.landing(made.public_id), made);
  landChanged(client);
}

/**
 * One landing, starting from the list's copy (no GET on open), asked again every 15 s while it
 * moves. When it settles, the lists are asked once. Key the component by the landing's id, so a
 * new landing starts its own watch.
 */
export function useLanding(listed: LandingOut) {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: queryKeys.landing(listed.public_id),
    queryFn: ({ signal }) => fetchLanding(listed.public_id, signal),
    initialData: listed,
    staleTime: Number.POSITIVE_INFINITY,
    refetchInterval: (q) =>
      q.state.data !== undefined && moving(q.state.data) ? LANDING_POLL_MS : false,
    retry: false,
  });
  const was = useRef(moving(query.data));
  useEffect(() => {
    const now = moving(query.data);
    if (was.current && !now) landChanged(client);
    was.current = now;
  }, [query.data, client]);
  return query;
}
```

- [ ] **Step 7: Write `views.ts` and `words.ts`:**

```ts
// Land's views and a landing's steps (M4.9c spec, M4LS.3), worked out from what the API says.
import { moving } from "../../api/landing";
import type { LandingOut } from "../../api/schema";

export const VIEWS = ["Ready to land", "Landing", "Landed", "Failed"] as const;
export type View = (typeof VIEWS)[number];

const ENDED = new Set(["refused", "closed"]);

export function landingsIn(view: View, landings: LandingOut[]): LandingOut[] {
  if (view === "Landing") return landings.filter(moving);
  if (view === "Landed") return landings.filter((l) => l.state === "merged" && l.landed);
  if (view === "Failed")
    // Failed ones hold their drafts until closed, so they come first; then the ended ones.
    return [
      ...landings.filter((l) => l.state === "failed"),
      ...landings.filter((l) => ENDED.has(l.state)),
    ];
  return [];
}

export const STEPS = [
  ["Checked in place against the index", ""],
  ["One commit, opened as a pull request", "by Comeni Code Studio, auto-merge on"],
  ["Its checks are running", "validate · review"],
  ["Merged into main", ""],
  ["The index follows main", "then learners see it"],
] as const;

export type Step = "done" | "on" | "todo";

/** Every step before the current one is done. A failed landing stops at its checks. */
export function stepsOf(landing: LandingOut): Step[] {
  const at =
    landing.state === "pending" ? 0 : landing.state === "merged" ? (landing.landed ? 5 : 4) : 2;
  return STEPS.map((_, i) => (i < at ? "done" : i === at ? "on" : "todo"));
}
```

```ts
// Land's small words: how long ago, how often, who, which file.
import type { FileChangeOut, MemberOut } from "../../api/schema";

export function ago(iso: string, now = Date.now()): string {
  const minutes = Math.floor((now - Date.parse(iso)) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}

export function every(seconds: number): string {
  if (seconds % 60 !== 0) return `every ${seconds} seconds`;
  const minutes = seconds / 60;
  return minutes === 1 ? "every minute" : `every ${minutes} minutes`;
}

export const who = (member: MemberOut | null) =>
  member === null ? "a former member" : member.name || member.email;

const MARK = { new: "+", changed: "~", removed: "-" } as Record<string, string>;
export const fileLabel = (file: FileChangeOut) => `${MARK[file.change] ?? ""}${file.file}`;
```

`ago("2026-10-14T09:00:00Z")` from noon the next day is 27 h → 1 day → *yesterday*.

- [ ] **Step 8: Write the page's frame** `LandPage.tsx` (the views and their counts; the tables
  and cards come in Tasks 4–6):

```tsx
// S10 · Land (M4.9c spec, M4LS.3): approved drafts go out as one pull request; the landings and
// the index beside them. Three GETs open it.
import { useState } from "react";
import { useLandings, useReadyDrafts } from "../../api/queries";
import { ErrorNotice } from "../../layout/ErrorNotice";
import { landingsIn, VIEWS, type View } from "./views";

export function LandPage() {
  const ready = useReadyDrafts();
  const landings = useLandings();
  const [view, setView] = useState<View>("Ready to land");
  const all = landings.data ?? [];
  const count = (name: View) =>
    name === "Ready to land" ? ready.data?.length : landings.data && landingsIn(name, all).length;
  return (
    <>
      <div className="flex flex-wrap items-baseline gap-3.5">
        <h1 className="text-[26px] font-semibold tracking-[-0.02em]">Land</h1>
        <span className="text-[13px] text-ink-2">
          Approved drafts go to comeni-code-content as one pull request; it merges when its checks
          pass.
        </span>
      </div>
      <div role="tablist" aria-label="Land views" className="flex gap-0.5 border-b border-border">
        {VIEWS.map((name) => (
          <button
            key={name}
            type="button"
            role="tab"
            aria-selected={view === name}
            onClick={() => setView(name)}
            className={`flex items-center gap-1.5 px-3.5 py-[9px] text-[13.5px] ${
              view === name
                ? "font-semibold text-ink shadow-[inset_0_-2px_0_var(--ink)]"
                : "text-ink-2"
            }`}
          >
            {name}
            {count(name) !== undefined && (
              <span className="text-[12px] font-normal text-ink-3 tabular-nums">{count(name)}</span>
            )}
          </button>
        ))}
      </div>
      {ready.isError && <ErrorNotice error={ready.error} />}
      {landings.isError && <ErrorNotice error={landings.error} />}
    </>
  );
}
```

The page's third question is the index card's. Task 6 fills the card; for now create
`studio/land/IndexCard.tsx` as a stub that asks and draws nothing, and render `<IndexCard />` at
the end of the page:

```tsx
// Main and the index (M4.9c spec, M4LS.3); filled in Task 6.
import { useStudioIndex } from "../../api/queries";

export function IndexCard() {
  useStudioIndex();
  return null;
}
```

- [ ] **Step 9: The page's place.** In `pages.ts`, after Review:

```ts
  {
    path: "/studio/land",
    label: "Land",
    icon: "M8 10.5V2M4.5 5.5 8 2l3.5 3.5M2 10v3.5h12V10",
    minRole: "operator",
    place: "top",
  },
```

In `App.tsx`: `import { LandPage } from "./studio/land/LandPage";` and
`<Route path="land" element={<LandPage />} />` after the review route.

- [ ] **Step 10: Run them**

Run: `cd apps/web && npx vitest run src/studio > /tmp/claude-1000/land-t3.log 2>&1; echo rc=$?`
Expected: rc=0. If a shell or rail test counts the operator's pages, update its count to four.

- [ ] **Step 11: Commit**

```bash
cd apps/web && npm run lint && npm run typecheck && cd ../..
git add apps/web/src
git commit -m "feat(web): Land's place, its questions and its views (#<c.3>)" -m "Land in the rail for operators, three GETs, the four views with their counts, and the 15 s watch of a moving landing (M4.9c spec, M4LS.2–M4LS.3).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Ready to land

**Files:**
- Create: `apps/web/src/studio/land/ReadyTable.tsx`
- Modify: `apps/web/src/studio/land/LandPage.tsx`, `apps/web/src/studio/land/LandPage.test.tsx`

**Interfaces:**
- Consumes: `useReadyDrafts`, `startLanding`, `landingMoved`, `who`, `fileLabel`.
- Produces: `ReadyTable({ rows, loaded, onLanded })` with `onLanded: (made: LandingOut) => void`;
  `LandPage` state `picked: string | null` (a landing id), set by `onLanded`, which also switches
  the view to *Landing*.

- [ ] **Step 1: Write the failing tests** (append to `LandPage.test.tsx`; import `userEvent` and
  `landingOf, READY` from `./landKit`):

```tsx
describe("LandPage — ready to land", () => {
  it("lists each draft with its region, approver and files", async () => {
    renderLand();
    expect(await screen.findByRole("link", { name: "salmon" })).toHaveAttribute(
      "href",
      "/studio/drafts/d-1",
    );
    expect(screen.getByText("~node ~body")).toBeInTheDocument();
    expect(screen.getByText("Otto · self-approved")).toBeInTheDocument();
    expect(screen.getByText("-exam")).toBeInTheDocument();
  });

  it("lands the picked drafts as one pull request and shows the landing", async () => {
    const made = landingOf({ public_id: "l-9", state: "pending", pull_number: null });
    const fake = renderLand({ "POST /api/studio/landings": { status: 202, body: made } });
    await userEvent.click(await screen.findByRole("checkbox", { name: "Pick salmon" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Pick tpm" }));
    await userEvent.click(screen.getByRole("button", { name: "Land 2 drafts as one pull request" }));
    const sent = fake.mock.calls.find(([, init]) => init?.method === "POST");
    expect(JSON.parse(String(sent?.[1]?.body))).toEqual({ drafts: ["d-1", "d-2"] });
    expect(await screen.findByRole("tab", { name: /Landing/, selected: true })).toBeInTheDocument();
  });

  it("says a refusal, each problem under the draft it names", async () => {
    // Review Focus 5.
    const problem = (file: string, text: string) => ({
      file, line: 3, field: null, code: "CS0011", message: text, text,
    });
    renderLand({
      "POST /api/studio/landings": {
        status: 422,
        body: {
          detail: "The batch does not validate in place.",
          code: "CA0305",
          problems: [
            problem("transcriptomics/tpm/node.yaml", "tpm needs a node that is gone"),
            problem("graph", "a cycle through k-mers"),
          ],
        },
      },
    });
    await userEvent.click(await screen.findByRole("checkbox", { name: "Pick tpm" }));
    await userEvent.click(screen.getByRole("button", { name: "Land 1 draft as one pull request" }));
    expect(await screen.findByText("The batch does not validate in place.")).toBeInTheDocument();
    const row = screen.getByRole("row", { name: /tpm/ });
    expect(row).toHaveTextContent("tpm needs a node that is gone");
    expect(screen.getByText("a cycle through k-mers")).toBeInTheDocument();
  });

  it("sends only the picked drafts still listed", async () => {
    // Review Focus 4: salmon left the list (landed from another tab) after it was picked.
    function Shrinking() {
      const [rows, setRows] = useState(READY);
      return (
        <>
          <button type="button" onClick={() => setRows(READY.slice(1))}>
            shrink
          </button>
          <ReadyTable rows={rows} loaded onLanded={() => {}} />
        </>
      );
    }
    const fake = answering({
      "POST /api/studio/landings": { status: 202, body: landingOf({ state: "pending" }) },
    });
    renderAt("/", <Route path="/" element={<Shrinking />} />);
    await userEvent.click(screen.getByRole("checkbox", { name: "Pick salmon" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Pick tpm" }));
    await userEvent.click(screen.getByRole("button", { name: "shrink" }));
    await userEvent.click(screen.getByRole("button", { name: "Land 1 draft as one pull request" }));
    const sent = fake.mock.calls.find(([, init]) => init?.method === "POST");
    expect(JSON.parse(String(sent?.[1]?.body))).toEqual({ drafts: ["d-2"] });
  });

  it("says when nothing is ready", async () => {
    renderLand({ "GET /api/studio/landings/ready": { body: [] } });
    expect(await screen.findByText("No approved drafts are waiting to land.")).toBeInTheDocument();
  });
});
```

Imports for this block: `useState` from `react`; `Route` from `react-router`; `answering,
renderAt` from `../../test-kit`; `ReadyTable` from `./ReadyTable`.

- [ ] **Step 2: Run them to see them fail**

Run: `cd apps/web && npx vitest run src/studio/land/LandPage.test.tsx`
Expected: the new tests FAIL (no link, no checkbox).

- [ ] **Step 3: Write `ReadyTable.tsx`:**

```tsx
// Ready to land (M4.9c spec, M4LS.3): approved drafts no landing holds; the picked ones land as
// one pull request. A refusal is said in the API's words, each problem under its draft.
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router";
import { ApiUnreachable } from "../../api/client";
import { startLanding } from "../../api/landing";
import { landingMoved } from "../../api/queries";
import type { LandingOut, ProblemOut, ReadyDraftOut } from "../../api/schema";
import { ErrorNotice } from "../../layout/ErrorNotice";
import { fileLabel, who } from "./words";

const COLS = "grid-cols-[26px_minmax(0,1fr)_120px_64px_minmax(0,1fr)_150px]";

function problemsOf(error: Error | null): ProblemOut[] {
  if (!(error instanceof ApiUnreachable)) return [];
  const body = error.body as { problems?: ProblemOut[] } | undefined;
  return body?.problems ?? [];
}

export function ReadyTable({
  rows,
  loaded,
  onLanded,
}: {
  rows: ReadyDraftOut[];
  loaded: boolean;
  onLanded: (made: LandingOut) => void;
}) {
  const client = useQueryClient();
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  // Only rows still listed are counted and sent (Review Focus 4).
  const picked = rows.filter((row) => ticked.has(row.public_id)).map((row) => row.public_id);
  const land = useMutation({
    mutationFn: () => startLanding(picked),
    onSuccess: (made) => {
      setTicked(new Set());
      landingMoved(client, made);
      onLanded(made);
    },
  });
  const problems = problemsOf(land.error);
  const under = (row: ReadyDraftOut) => problems.filter((p) => p.file.startsWith(`${row.folder}/`));
  const elsewhere = problems.filter((p) => !rows.some((row) => under(row).includes(p)));
  const tick = (id: string) =>
    setTicked((now) => {
      const next = new Set(now);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  if (loaded && rows.length === 0)
    return <p className="text-[14px] text-ink-2">No approved drafts are waiting to land.</p>;
  return (
    <>
      <div role="table" aria-label="Ready to land" className="overflow-hidden rounded-panel border border-border bg-surface">
        <div role="row" className={`grid ${COLS} gap-3 px-3.5 py-2.5 text-[11.5px] text-ink-3`}>
          <span />
          <span role="columnheader">Node</span>
          <span role="columnheader">Region</span>
          <span role="columnheader">Revision</span>
          <span role="columnheader">Approved by</span>
          <span role="columnheader" className="text-right">Files</span>
        </div>
        {rows.map((row) => (
          <div
            key={row.public_id}
            role="row"
            className={`border-t border-border px-3.5 text-[13.5px] ${ticked.has(row.public_id) ? "bg-bg" : ""}`}
          >
            <div className={`grid ${COLS} h-[52px] items-center gap-3`}>
              <input
                type="checkbox"
                aria-label={`Pick ${row.node_id}`}
                checked={ticked.has(row.public_id)}
                onChange={() => tick(row.public_id)}
                className="size-[15px] accent-sel"
              />
              <Link
                to={`/studio/drafts/${row.public_id}`}
                className="truncate font-mono text-[13px] font-medium text-sel"
              >
                {row.node_id}
              </Link>
              <span className="text-ink-2">{row.region}</span>
              <span className="text-ink-3 tabular-nums">{`rev ${row.revision}`}</span>
              <span className="truncate text-ink-2">
                {row.self_approved ? `${who(row.approved_by)} · self-approved` : who(row.approved_by)}
              </span>
              <span className="text-right font-mono text-[12px] text-ink-2">
                {row.files.map(fileLabel).join(" ")}
              </span>
            </div>
            {under(row).map((p) => (
              <p key={`${p.file}:${p.text}`} className="pb-2 pl-[38px] text-[12px] text-open">
                {p.text}
              </p>
            ))}
          </div>
        ))}
      </div>
      <span className="text-[12.5px] text-ink-3">
        The batch is checked in place against the index before anything is sent; a draft whose
        folder changed on main is dropped, with the reason.
      </span>
      {land.error !== null && <ErrorNotice error={land.error} />}
      {elsewhere.map((p) => (
        <p key={`${p.file}:${p.text}`} className="text-[12px] text-open">
          {p.text}
        </p>
      ))}
      {picked.length > 0 && (
        <section
          aria-label="Picked drafts"
          className="flex items-center gap-3 self-start rounded-[12px] bg-ink px-3.5 py-2.5 text-[13px] text-bg shadow-float"
        >
          <span className="font-semibold">{`${picked.length} selected`}</span>
          <button
            type="button"
            disabled={land.isPending}
            onClick={() => land.mutate()}
            className="rounded-[8px] bg-surface px-[11px] py-[5px] font-semibold text-ink disabled:opacity-60"
          >
            {`Land ${picked.length} ${picked.length === 1 ? "draft" : "drafts"} as one pull request`}
          </button>
          <button type="button" onClick={() => setTicked(new Set())} className="opacity-75">
            Clear
          </button>
        </section>
      )}
    </>
  );
}
```

Check the class names against `tokens.css` and the review page (`rounded-panel`, `text-open`,
`accent-sel`); use what the review screen uses where they differ, and ledger it.

- [ ] **Step 4: Use it in `LandPage.tsx`.** Add `const [picked, setPicked] = useState<string | null>(null);`
  and, below the notices:

```tsx
      <div className="grid min-h-0 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
        <section className="flex min-w-0 flex-col gap-3">
          {view === "Ready to land" && (
            <ReadyTable
              rows={ready.data ?? []}
              loaded={ready.data !== undefined}
              onLanded={(made) => {
                setPicked(made.public_id);
                setView("Landing");
              }}
            />
          )}
        </section>
        <aside className="flex flex-col gap-4">
          <IndexCard />
        </aside>
      </div>
```

(move `<IndexCard />` from the page's end into the aside). `picked` is read in Task 5.

- [ ] **Step 5: Run them**

Run: `cd apps/web && npx vitest run src/studio/land > /tmp/claude-1000/land-t4.log 2>&1; echo rc=$?`
Expected: rc=0.

- [ ] **Step 6: Commit**

```bash
cd apps/web && npm run lint && npm run typecheck && cd ../..
git add apps/web/src/studio/land
git commit -m "feat(web): Ready to land: the table, picking, landing, refusals (#<c.4>)" -m "M4.9c spec, M4LS.3: the board's table, one POST for the picked drafts still listed, each refusal problem under the draft whose folder it names.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: The landings and their card

**Files:**
- Create: `apps/web/src/studio/land/LandingRows.tsx`, `apps/web/src/studio/land/LandingCard.tsx`, `apps/web/src/studio/land/StateTag.tsx`
- Modify: `apps/web/src/studio/land/LandPage.tsx`, `apps/web/src/studio/land/LandPage.test.tsx`

**Interfaces:**
- Consumes: `landingsIn`, `stepsOf`, `STEPS`, `useLanding`, `moving`, `ago`, `who`.
- Produces: `StateTag({ landing })`; `LandingRows({ landings, picked, onPick })`;
  `LandingCard({ landing })` (keyed by `public_id` by its caller).

- [ ] **Step 1: Write the failing tests** (append; import `vi`, `act` from `@testing-library/react`
  if needed):

```tsx
describe("LandPage — the landings", () => {
  const dropped = {
    draft: "d-8", node_id: "de-bruijn-graphs", revision: 2, live: false,
    dropped_code: "CA0306", dropped_reason: "de-bruijn-graphs changed on main since this draft was opened.",
  };

  it("lists a view's landings and shows the one picked", async () => {
    renderLand();
    await userEvent.click(await screen.findByRole("tab", { name: /Landed/ }));
    await userEvent.click(screen.getByRole("button", { name: /#41/ }));
    expect(screen.getByText("1 node in one pull request")).toBeInTheDocument();
    expect(screen.getAllByText("The index follows main")).toHaveLength(1);
  });

  it("shows the moving landing's steps and what was dropped", async () => {
    const live = landingOf({ entries: [...landingOf().entries, dropped] });
    renderLand({ "GET /api/studio/landings": { body: [live] } });
    expect(await screen.findByText("Its checks are running")).toHaveAttribute("aria-current", "step");
    expect(screen.getByText(/de-bruijn-graphs/, { selector: "b" }).parentElement).toHaveTextContent(
      "dropped: de-bruijn-graphs changed on main since this draft was opened. (CA0306)",
    );
    expect(screen.getByText("k-mers · rev 6")).toBeInTheDocument();
  });

  it("says a refused landing's reason in place of its steps", async () => {
    const refused = landingOf({ state: "refused", pull_number: null, reason: "Every draft was dropped." });
    renderLand({ "GET /api/studio/landings": { body: [refused] } });
    await userEvent.click(await screen.findByRole("tab", { name: /Failed/ }));
    await userEvent.click(screen.getByRole("button", { name: /no pull request/ }));
    expect(screen.getByText("Every draft was dropped.")).toBeInTheDocument();
    expect(screen.queryByText("Merged into main")).toBeNull();
  });

  it("asks for a moving landing every 15 s and stops once it settles", async () => {
    // Review Focus 3.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      let polls = 0;
      const fake = renderLand({
        "GET /api/studio/landings": { body: [landingOf()] },
        "GET /api/studio/landings/l-1": () => {
          polls += 1;
          return { body: landingOf({ state: "merged", landed: true }) };
        },
      });
      await screen.findByText("Its checks are running");
      await vi.advanceTimersByTimeAsync(15_000);
      expect(polls).toBe(1);
      const lists = () =>
        fake.mock.calls.filter(([url]) => url === "/api/studio/landings/ready").length;
      await vi.waitFor(() => expect(lists()).toBe(2)); // asked once more when it settled
      await vi.advanceTimersByTimeAsync(45_000);
      expect(polls).toBe(1);
      expect(lists()).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `cd apps/web && npx vitest run src/studio/land/LandPage.test.tsx`
Expected: the four new tests FAIL (no rows, no card).

- [ ] **Step 3: Write `StateTag.tsx`:**

```tsx
// A landing's state as a tag (M4.9c spec, M4LS.3): blue while it moves, red when it failed and
// holds its drafts, grey once settled (invariant 11).
import { moving } from "../../api/landing";
import type { LandingOut } from "../../api/schema";

const TAG = "inline-flex rounded-pill px-[9px] py-0.5 text-[11.5px] font-semibold whitespace-nowrap";

export function StateTag({ landing }: { landing: LandingOut }) {
  if (moving(landing)) return <span className={`${TAG} bg-sel-soft text-sel`}>Landing</span>;
  if (landing.state === "failed") return <span className={`${TAG} bg-open-soft text-open`}>Failed</span>;
  const word = landing.state === "merged" ? "Landed" : landing.state === "refused" ? "Refused" : "Closed";
  return <span className={`${TAG} border border-border-2 font-medium text-ink-2`}>{word}</span>;
}
```

- [ ] **Step 4: Write `LandingRows.tsx`:**

```tsx
// The landings of one view, a row each (M4.9c spec, M4LS.3); picking one shows its card.
import type { LandingOut } from "../../api/schema";
import { StateTag } from "./StateTag";
import { ago, who } from "./words";

const COLS = "grid-cols-[90px_minmax(0,1.4fr)_minmax(0,1fr)_110px_90px]";

export function LandingRows({
  landings,
  picked,
  onPick,
}: {
  landings: LandingOut[];
  picked: string | null;
  onPick: (id: string) => void;
}) {
  if (landings.length === 0) return <p className="text-[14px] text-ink-2">No landings here.</p>;
  return (
    <div className="overflow-hidden rounded-panel border border-border bg-surface">
      <div className={`grid ${COLS} gap-3 px-3.5 py-2.5 text-[11.5px] text-ink-3`}>
        <span>Pull request</span>
        <span>Nodes</span>
        <span>Started by</span>
        <span>When</span>
        <span>State</span>
      </div>
      {landings.map((landing) => (
        <button
          key={landing.public_id}
          type="button"
          aria-current={picked === landing.public_id}
          onClick={() => onPick(landing.public_id)}
          className={`grid w-full ${COLS} h-[52px] items-center gap-3 border-t border-border px-3.5 text-left text-[13.5px] ${
            picked === landing.public_id ? "bg-sel-soft shadow-[inset_3px_0_0_var(--sel)]" : ""
          }`}
        >
          <span className="font-mono text-[13px] text-ink-2">
            {landing.pull_number === null ? "no pull request" : `#${landing.pull_number}`}
          </span>
          <span className="truncate font-mono text-[12.5px]">
            {landing.entries.map((e) => e.node_id).join(" · ")}
          </span>
          <span className="truncate text-ink-2">{who(landing.started_by)}</span>
          <span className="text-ink-3">{ago(landing.started_at)}</span>
          <StateTag landing={landing} />
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Write `LandingCard.tsx`:**

```tsx
// One landing (M4.9c spec, M4LS.3): its five steps from its state, what it holds and what was
// dropped. Asked again every 15 s while it moves (useLanding); keyed by id by its caller.
import { moving } from "../../api/landing";
import { useLanding } from "../../api/queries";
import type { LandingOut } from "../../api/schema";
import { StateTag } from "./StateTag";
import { STEPS, stepsOf } from "./views";
import { ago, who } from "./words";

function Mark({ step }: { step: string }) {
  if (step === "done")
    return (
      <span className="flex size-5 flex-none items-center justify-center rounded-full border border-border-2 bg-bg text-[11px] text-ink-2">
        ✓
      </span>
    );
  if (step === "on") return <span className="size-5 flex-none rounded-full border-2 border-sel" />;
  return <span className="size-5 flex-none rounded-full border-[1.5px] border-dashed border-border-2" />;
}

export function LandingCard({ landing: listed }: { landing: LandingOut }) {
  const { data } = useLanding(listed);
  const landing = data ?? listed;
  const kept = landing.entries.filter((e) => e.dropped_code === "");
  const dropped = landing.entries.filter((e) => e.dropped_code !== "");
  const ended = landing.state === "refused" || landing.state === "closed";
  const steps = stepsOf(landing);
  return (
    <section aria-label="The landing" className="flex flex-col gap-3 rounded-panel border border-border bg-surface p-[18px]">
      <div className="flex items-center justify-between">
        <StateTag landing={landing} />
        <span className="text-[12px] text-ink-3">
          {`started ${ago(landing.started_at)} by ${who(landing.started_by)}`}
        </span>
      </div>
      <span className="text-[16px] font-semibold">
        {`${kept.length} ${kept.length === 1 ? "node" : "nodes"} in one pull request`}
      </span>
      {landing.pull_number !== null && (
        <a href={landing.pull_url} className="font-mono text-[12.5px] text-sel">
          {`comeni-code-content#${landing.pull_number} · ${landing.branch}`}
        </a>
      )}
      {ended || landing.state === "failed" ? (
        <p className="text-[13px] leading-normal text-ink-2">{landing.reason}</p>
      ) : null}
      {!ended && (
        <ol className="flex flex-col gap-[9px] pt-1">
          {STEPS.map(([label, note], i) => (
            <li key={label} className="flex items-start gap-2.5 text-[13px]">
              <Mark step={steps[i] ?? "todo"} />
              <span className="flex flex-col gap-px">
                <span
                  aria-current={steps[i] === "on" && moving(landing) ? "step" : undefined}
                  className={steps[i] === "on" ? "font-semibold" : steps[i] === "done" ? "text-ink-2" : "text-ink-3"}
                >
                  {label}
                </span>
                {note !== "" && <span className="text-[12px] text-ink-3">{note}</span>}
              </span>
            </li>
          ))}
        </ol>
      )}
      <div className="flex flex-col gap-[5px] border-t border-border pt-2.5">
        <span className="text-[12.5px] font-semibold">In this landing</span>
        <span className="font-mono text-[12.5px] text-ink-2">
          {kept.map((e) => `${e.node_id} · rev ${e.revision}`).join("   ")}
        </span>
        {dropped.map((e) => (
          <span key={e.draft} className="text-[12px] text-open">
            <b className="font-mono font-medium">{e.node_id}</b>
            {` dropped: ${e.dropped_reason} (${e.dropped_code}). It stays approved; open a new draft.`}
          </span>
        ))}
      </div>
    </section>
  );
}
```

The test's `getByText("k-mers · rev 6")` matches the span only when one draft is kept; with more,
match with a regex. Keep the test as written (one kept draft).

- [ ] **Step 6: Wire them into `LandPage.tsx`:**

```tsx
  const live = all.find(moving);
  const shown = all.find((l) => l.public_id === picked) ?? live;
```

In the section, after the Ready table:

```tsx
          {view !== "Ready to land" && (
            <LandingRows
              landings={landingsIn(view, all)}
              picked={shown?.public_id ?? null}
              onPick={setPicked}
            />
          )}
```

In the aside, before `<IndexCard />`:

```tsx
          {shown !== undefined && shown.state !== "failed" && (
            <LandingCard key={shown.public_id} landing={shown} />
          )}
```

(a failed landing is shown by its own card, Task 6.)

- [ ] **Step 7: Run them**

Run: `cd apps/web && npx vitest run src/studio/land > /tmp/claude-1000/land-t5.log 2>&1; echo rc=$?`
Expected: rc=0. If the poll test's list count is off by one because `invalidateQueries` on
`["drafts"]` or the index adds calls, count only `/api/studio/landings/ready` as written.

- [ ] **Step 8: Commit**

```bash
cd apps/web && npm run lint && npm run typecheck && cd ../..
git add apps/web/src/studio/land
git commit -m "feat(web): the landings, a row each, and the landing card's steps (#<c.5>)" -m "M4.9c spec, M4LS.2–M4LS.3: Landing, Landed and Failed list landings; the card shows the five steps and what was dropped, and asks again every 15 s only while the landing moves.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: The failed card and the index

**Files:**
- Create: `apps/web/src/studio/land/FailedCard.tsx`
- Modify: `apps/web/src/studio/land/IndexCard.tsx` (the stub from Task 3)
- Modify: `apps/web/src/studio/land/LandPage.tsx`, `apps/web/src/studio/land/LandPage.test.tsx`

**Interfaces:**
- Consumes: `closeLanding`, `landingMoved`, `useStudioIndex`, `every`, `ago`.
- Produces: `FailedCard({ landing })`, `IndexCard()`.

- [ ] **Step 1: Write the failing tests** (append):

```tsx
describe("LandPage — the failed card and the index", () => {
  const failed = landingOf({
    public_id: "l-4", pull_number: 41, state: "failed",
    reason: "validate failed: https://ci.test/run/9",
  });

  it("closes a failed landing and asks for the lists again", async () => {
    const fake = renderLand({
      "GET /api/studio/landings": { body: [failed] },
      "POST /api/studio/landings/l-4/close": { body: { ...failed, state: "closed" } },
    });
    expect(await screen.findByText("validate failed: https://ci.test/run/9")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Close the landing" }));
    const asked = () => fake.mock.calls.filter(([url]) => url === "/api/studio/landings/ready").length;
    await vi.waitFor(() => expect(asked()).toBe(2));
  });

  it("says main, the live build and how often main is followed", async () => {
    renderLand();
    const card = await screen.findByRole("region", { name: "Main and the index" });
    expect(card).toHaveTextContent("a1b2c3d");
    expect(card).toHaveTextContent("26 nodes");
    expect(card).toHaveTextContent("every 5 minutes, and on a merge");
    expect(card).toHaveTextContent("Up to date.");
  });

  it("says when the index is behind main", async () => {
    renderLand({ "GET /api/studio/index": { body: { ...INDEX, behind: true, main_head: "ffff000" } } });
    expect(await screen.findByText("Behind main.")).toBeInTheDocument();
  });
});
```

(import `INDEX` from `./landKit`.)

- [ ] **Step 2: Run them to see them fail**

Run: `cd apps/web && npx vitest run src/studio/land/LandPage.test.tsx`
Expected: the three new tests FAIL.

- [ ] **Step 3: Write `FailedCard.tsx`:**

```tsx
// A failed landing (M4.9c spec, M4LS.3): it holds its drafts until an operator closes it; closing
// closes its pull request and gives the drafts back to Ready.
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { closeLanding } from "../../api/landing";
import { landingMoved } from "../../api/queries";
import type { LandingOut } from "../../api/schema";
import { ErrorNotice } from "../../layout/ErrorNotice";
import { StateTag } from "./StateTag";
import { ago } from "./words";

export function FailedCard({ landing }: { landing: LandingOut }) {
  const client = useQueryClient();
  const close = useMutation({
    mutationFn: () => closeLanding(landing.public_id),
    onSuccess: (made) => landingMoved(client, made),
  });
  const pull = landing.pull_number === null ? "" : ` · #${landing.pull_number}`;
  return (
    <section aria-label="A failed landing" className="flex flex-col gap-2.5 rounded-panel border border-border bg-surface p-[18px]">
      <div className="flex items-center justify-between">
        <StateTag landing={landing} />
        <span className="text-[12px] text-ink-3">{`${ago(landing.started_at)}${pull}`}</span>
      </div>
      <span className="text-[13px] leading-normal text-ink-2">{landing.reason}</span>
      <span className="text-[12px] text-ink-3">Its drafts are held until you close it.</span>
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          disabled={close.isPending}
          onClick={() => close.mutate()}
          className="rounded-control border border-border-2 bg-surface px-3 py-1.5 text-[13px] font-semibold disabled:opacity-60"
        >
          Close the landing
        </button>
        <span className="text-[12px] text-ink-3">
          {landing.pull_number === null ? "its drafts stay approved" : `closes #${landing.pull_number}; its drafts stay approved`}
        </span>
      </div>
      {close.error !== null && <ErrorNotice error={close.error} />}
    </section>
  );
}
```

Use the secondary-button classes from `layout/buttons.ts` if it exports them; ledger it.

- [ ] **Step 4: Fill `IndexCard.tsx`:**

```tsx
// Main and the index (M4.9c spec, M4LS.3): main's head, the live build, how often it follows.
import { useStudioIndex } from "../../api/queries";
import { ago, every } from "./words";

function Fact({ name, value }: { name: string; value: string }) {
  return (
    <div className="flex justify-between gap-2.5 text-[12.5px]">
      <span className="text-ink-3">{name}</span>
      <span className="text-right text-ink-2">{value}</span>
    </div>
  );
}

export function IndexCard() {
  const { data: index } = useStudioIndex();
  if (index === undefined) return null;
  const short = (commit: string) => commit.slice(0, 7);
  return (
    <section aria-label="Main and the index" className="flex flex-col gap-2 rounded-panel border border-border bg-surface p-[18px]">
      <span className="text-[14px] font-semibold">Main and the index</span>
      <Fact
        name="main"
        value={index.main_head === null ? "not seen yet" : `${short(index.main_head)}${index.checked_at === null ? "" : ` · ${ago(index.checked_at)}`}`}
      />
      <Fact
        name="Live build"
        value={index.live === null ? "none yet" : `${short(index.live.commit)} · ${index.live.node_count} nodes`}
      />
      <Fact name="Follows main" value={`${every(index.follow_seconds)}, and on a merge`} />
      <span className="text-[12px] text-ink-3">{index.behind ? "Behind main." : "Up to date."}</span>
    </section>
  );
}
```

- [ ] **Step 5: Wire the failed cards** in `LandPage.tsx`'s aside, between the landing card and
  the index card:

```tsx
          {all
            .filter((l) => l.state === "failed")
            .map((l) => (
              <FailedCard key={l.public_id} landing={l} />
            ))}
```

- [ ] **Step 6: Run the web checks**

```bash
cd apps/web
npm run lint > /tmp/claude-1000/land-lint.log 2>&1; echo lint=$?
npm run typecheck > /tmp/claude-1000/land-tc.log 2>&1; echo tc=$?
npm test > /tmp/claude-1000/land-test.log 2>&1; echo test=$?
npm run build > /tmp/claude-1000/land-build.log 2>&1; echo build=$?
```

Expected: all 0.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/studio/land
git commit -m "feat(web): close a failed landing; main and the index beside it (#<c.6>)" -m "M4.9c spec, M4LS.3: a failed landing's card with Close, which gives its drafts back; the index card from IndexOut, its cadence from FOLLOW_SECONDS.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: The walk and docs

**Files:**
- Modify: `docs/superpowers/specs/2026-10-15-m4-land-screen-design.md` (status; notes from the build)
- Modify: `CLAUDE.md` (the layout line for `apps/web/` and `landing.py`)
- Create: `docs/notes/journal/2026-10-15-m4-9c-build.md`

- [ ] **Step 1: The full Python checks** with CI's environment, each to a file with its exit
  code: `uv run ruff check .`, `uv run ruff format --check .`, `uv run mypy`, `manage.py check`,
  `makemigrations --check --dry-run`, `uv run pytest`. Expected: all 0, no migration.

- [ ] **Step 2: Seed the walk.** Run `runserver` and `npm run dev` (`apps/web`), then in
  `uv run python apps/api/manage.py shell`, make landings in each state on fixture nodes (open
  existing drafts by `drafts.open_existing`, mark them approved with a `record(...APPROVED...)`
  event, then create `Landing` and `LandingDraft` rows directly):

  - **pending**: one draft, entry live;
  - **open**: `pull_number=42`, `pull_url`, `branch="studio/land-7f3a"`, two drafts live and one
    entry dropped with `CA0306` and its reason;
  - **merged and landed**: `merge_commit` set, its draft `state=landed`, entry not live;
  - **failed**: `reason="validate failed: …"`, entry live;
  - **refused**: `reason`, entry not live.

  Keep TPM approved and in no landing, so Ready has it with real files.

- [ ] **Step 3: Walk it** in Chrome as an operator, a fresh browser context: Land in the rail
  (not for a reviewer); Ready lists TPM with its files and approver; pick it and land: CA0301's
  sentence shows (the app is not configured). Each view's rows; the open landing's steps and its
  dropped draft; the refused landing's reason; the failed card. Compare with the board at
  1680 px, light and dark. Each defect: an issue first, then fixed test-first.

- [ ] **Step 4: Remove the seeded landings** (the dev DB keeps only what the walk began with):
  delete the seeded `Landing` rows and their drafts' entries, and send the seeded drafts back
  to open or discard them, in the shell.

- [ ] **Step 5: Docs.** The spec's status becomes *built*, with *Notes from the build* (rulings
  that changed what it says). `CLAUDE.md`'s layout: `landing.py` gains *the drafts ready to land*;
  `studio/` in `apps/web` gains *land/ — S10: the drafts ready to land, the landings and their
  steps, a failed landing's Close, main and the index*. Then the journal entry, in the house shape
  (*Where things stand · What changed · Decisions, and why · What is next*), short: `now.md` is
  at its limit and the journal holds four pending entries with this one, so the next part's close
  compacts them.

- [ ] **Step 6: Commit**

```bash
uv run pytest tests/repo -q; echo rc=$?
git add docs CLAUDE.md
git commit -m "docs: M4.9c — the journal, the spec's notes, the layout (#<c.7>)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Then the final whole-branch review, its fixes test-first, and the pull request only on the
operator's yes.
