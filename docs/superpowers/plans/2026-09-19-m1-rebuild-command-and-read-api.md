# M1 part 6 — the rebuild command and the read API: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this
> plan task by task (CLAUDE.md: one agent builds; subagents only review). Steps use checkbox
> (`- [ ]`) syntax for tracking.

**Goal:** `manage.py rebuild_index` fills the index from a folder and exits 0/1/2, and
`GET /api/nodes/{node_id}` serves a node with its needs, goes-deeper, related and derived needed-by.

**Architecture:** Two thin layers over part 5's `rebuild_index` and models, both in
`code_api.content`: a management command, and a Ninja router mounted at `/api/nodes`. No new
models, no migration.

**Tech stack:** Django 6.1 management commands, django-ninja, pytest-django against Compose's
Postgres.

**Spec:** [`2026-09-19-m1-rebuild-command-and-read-api-design.md`](../specs/2026-09-19-m1-rebuild-command-and-read-api-design.md)
(M1P6.1–6.6). Read it with this plan.

## Global constraints

- Branch `m1-part-6-rebuild-command-and-read-api`; never commit to `main`.
- Tests read only `tests/fixtures/salmon/` or copies of it in `tmp_path`, never
  `../comeni-code-content` (R1).
- Only `code_api/config/env.py` reads the environment; the setting is `CODE_CONTENT_ROOT`, from
  `Env.content_root: Path | None = None`.
- `rebuild_index` stays the only writer of the index models; the API is `GET` only.
- Exit codes: 0 applied, 1 refused, 2 could not start.
- 404 detail: `No topic with id '<id>'. It may have been removed or renamed.`; 503 detail:
  `The index has not been built yet.`
- Commits: Conventional Commits with a body, ending
  `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- Before each commit: `uv run ruff check . && uv run ruff format --check . && uv run mypy`, and the
  task's tests. Postgres must be up (`docker compose up -d --wait postgres redis`).

## Files

| File | Responsibility |
|---|---|
| `apps/api/src/code_api/config/env.py` | gains `content_root` |
| `apps/api/src/code_api/config/settings.py` | `CODE_CONTENT_ROOT = ENV.content_root` |
| `.env.example` | the commented `CODE_CONTENT_ROOT` line |
| `apps/api/src/code_api/content/management/__init__.py`, `…/commands/__init__.py` | empty |
| `apps/api/src/code_api/content/management/commands/rebuild_index.py` | the command |
| `apps/api/src/code_api/content/api.py` | the router, its schemas |
| `apps/api/src/code_api/api.py` | mounts the router |
| `apps/api/openapi.json`, `apps/web/src/api/schema.ts` | regenerated |
| `apps/api/tests/test_env.py` | `content_root` defaults to none |
| `apps/api/tests/test_rebuild_command.py` | the command's tests |
| `apps/api/tests/test_nodes_api.py` | the endpoint's tests |
| CLAUDE.md, journal entry, journal README | M1 done |

---

### Task 1: The setting and the command

**Interfaces:**
- Consumes: `code_api.content.index.rebuild_index(root: Path, *, commit: str = "") -> IndexBuild`;
  `IndexBuild.Outcome.APPLIED / REFUSED`, `build.node_count`, `build.digest`, `build.problems`.
- Produces: `settings.CODE_CONTENT_ROOT: Path | None`; the command `rebuild_index` with
  `--root PATH` and `--commit SHA`.

- [ ] **Step 1: The setting's test.** In `apps/api/tests/test_env.py`, add `"CONTENT_ROOT"` to
  the names `_clean_environment` deletes, and to `test_defaults_are_the_safe_ones` add:

```python
    assert env.content_root is None
```

  and a new test after it:

```python
def test_the_content_root_is_a_path(monkeypatch: pytest.MonkeyPatch) -> None:
    env = make_env(
        monkeypatch,
        secret_key=KEY,
        database_url=URL,
        redis_url=REDIS,
        content_root="../comeni-code-content",
    )
    assert env.content_root == Path("../comeni-code-content")
```

  (`from pathlib import Path` at the top.)

- [ ] **Step 2: The command's tests.** Create `apps/api/tests/test_rebuild_command.py`:

```python
"""manage.py rebuild_index (spec M1P6.2): the folder from --root or CODE_CONTENT_ROOT, the build's
outcome as the exit code — 0 applied, 1 refused, 2 could not start.

Reads only the part 4 fixtures, or copies of them in tmp_path (R1). Needs Compose's Postgres.
"""

import shutil
from io import StringIO
from pathlib import Path
from typing import Any

import pytest
from django.core.management import CommandError, call_command
from pytest_django.fixtures import SettingsWrapper

from code_api.content.index import rebuild_index
from code_api.content.models import IndexBuild, Link, Node, Region
from code_schema import read_content

FIXTURES = Path(__file__).resolve().parents[3] / "tests" / "fixtures" / "salmon"

pytestmark = pytest.mark.django_db


def dump() -> tuple[list[Any], ...]:
    """Every row of the three index tables, sorted: two equal dumps are the same index."""
    return (
        sorted(Region.objects.values_list("id", "name", "position")),
        sorted(
            Node.objects.values_list(
                "id", "title", "claim", "region_id", "level", "minutes", "body", "folder"
            )
        ),
        sorted(Link.objects.values_list("source_id", "kind", "position", "target_id", "reason")),
    )


def run(*args: str) -> tuple[str, str]:
    out, err = StringIO(), StringIO()
    call_command("rebuild_index", *args, stdout=out, stderr=err)
    return out.getvalue(), err.getvalue()


def test_the_command_rebuilds_from_files_alone() -> None:
    out, err = run("--root", str(FIXTURES))
    build = IndexBuild.objects.get()
    assert out == f"Applied: 26 nodes, digest {build.digest[:12]}\n"
    assert err == ""
    from_command = dump()
    rebuild_index(FIXTURES)
    assert dump() == from_command


def test_the_setting_is_used_and_root_wins(settings: SettingsWrapper, tmp_path: Path) -> None:
    settings.CODE_CONTENT_ROOT = FIXTURES
    run()
    assert Node.objects.count() == 26
    settings.CODE_CONTENT_ROOT = tmp_path / "not-there"
    run("--root", str(FIXTURES))
    assert IndexBuild.objects.filter(outcome=IndexBuild.Outcome.APPLIED).count() == 2


def test_the_commit_is_recorded() -> None:
    run("--root", str(FIXTURES), "--commit", "abc123")
    assert IndexBuild.objects.get().commit == "abc123"


def test_a_refusal_exits_1_and_changes_nothing(tmp_path: Path) -> None:
    run("--root", str(FIXTURES))
    before = dump()
    broken = tmp_path / "content"
    shutil.copytree(FIXTURES, broken)
    shutil.rmtree(broken / "statistics" / "em-algorithm")
    problems = [str(p) for p in read_content(broken).problems]
    assert problems
    err = StringIO()
    with pytest.raises(SystemExit) as caught:
        call_command("rebuild_index", "--root", str(broken), stdout=StringIO(), stderr=err)
    assert caught.value.code == 1
    assert err.getvalue().splitlines() == [f"Refused: {len(problems)} problems", *problems]
    assert dump() == before


def test_no_folder_exits_2(settings: SettingsWrapper) -> None:
    run("--root", str(FIXTURES))
    before = dump()
    settings.CODE_CONTENT_ROOT = None
    with pytest.raises(CommandError, match="set CODE_CONTENT_ROOT or pass --root") as caught:
        run()
    assert caught.value.returncode == 2
    assert (IndexBuild.objects.count(), dump()) == (1, before)


@pytest.mark.parametrize("name", ["not-there", "a-file"])
def test_a_path_that_is_not_a_folder_exits_2(tmp_path: Path, name: str) -> None:
    (tmp_path / "a-file").write_text("not content\n")
    run("--root", str(FIXTURES))
    before = dump()
    path = tmp_path / name
    with pytest.raises(CommandError, match="is not a folder") as caught:
        run("--root", str(path))
    assert caught.value.returncode == 2
    assert str(path) in str(caught.value)
    assert (IndexBuild.objects.count(), dump()) == (1, before)
```

- [ ] **Step 3: Run them; they fail.**
  `uv run pytest apps/api/tests/test_env.py apps/api/tests/test_rebuild_command.py -q`.
  Expected: the env tests fail on `content_root` (no attribute / extra ignored); every command test
  fails with `CommandError: Unknown command: 'rebuild_index'`.

- [ ] **Step 4: The setting.** In `env.py`, after `static_root`:

```python
    # The content folder `manage.py rebuild_index` reads (M1 part 6 spec, M1P6.2). Optional: only
    # the command needs a content checkout, so the API, worker and beat start without one.
    content_root: Path | None = None
```

  In `settings.py`, after `STATIC_ROOT = ENV.static_root`:

```python
# The content folder `manage.py rebuild_index` reads; `--root` overrides it (M1P6.2).
CODE_CONTENT_ROOT = ENV.content_root
```

  In `.env.example`, at the end:

```
# The content folder manage.py rebuild_index reads; or pass --root. Never used by tests.
# CODE_CONTENT_ROOT=../comeni-code-content
```

- [ ] **Step 5: The command.** Create empty `apps/api/src/code_api/content/management/__init__.py`
  and `apps/api/src/code_api/content/management/commands/__init__.py`, then
  `apps/api/src/code_api/content/management/commands/rebuild_index.py`:

```python
"""manage.py rebuild_index: rebuild the index from a content folder (M1 part 6 spec, M1P6.2).

The folder is --root, else CODE_CONTENT_ROOT. Exit 0 when the build is applied, 1 when it is
refused (the validator's messages on stderr, the old index kept), 2 when it cannot start.
"""

from pathlib import Path
from typing import Any

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError, CommandParser

from code_api.content.index import rebuild_index
from code_api.content.models import IndexBuild


class Command(BaseCommand):
    help = "Rebuild the content index from a folder: --root, else CODE_CONTENT_ROOT."

    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument("--root", type=Path, help="the content folder")
        parser.add_argument("--commit", default="", help="the content commit, kept on the build")

    def handle(self, *args: Any, **options: Any) -> None:
        root: Path | None = options["root"] or settings.CODE_CONTENT_ROOT
        if root is None:
            raise CommandError("set CODE_CONTENT_ROOT or pass --root", returncode=2)
        # read_content would stop on a missing folder with a traceback; say what is wrong instead.
        if not root.is_dir():
            raise CommandError(f"{root} is not a folder", returncode=2)
        build = rebuild_index(root, commit=options["commit"])
        if build.outcome == IndexBuild.Outcome.REFUSED:
            self.stderr.write(f"Refused: {len(build.problems)} problems")
            for problem in build.problems:
                self.stderr.write(problem)
            # A refusal is an outcome, not a misuse: exit 1 without CommandError's prefix.
            raise SystemExit(1)
        self.stdout.write(f"Applied: {build.node_count} nodes, digest {build.digest[:12]}")
```

- [ ] **Step 6: Run them; they pass.** Same command as step 3. Then by hand:
  `uv run python apps/api/manage.py rebuild_index --root tests/fixtures/salmon; echo "exit=$?"` →
  `Applied: 26 nodes, digest …` and `exit=0`;
  `uv run python apps/api/manage.py rebuild_index --root /nowhere; echo "exit=$?"` →
  `CommandError: /nowhere is not a folder` and `exit=2`.

- [ ] **Step 7: See the folder check fail.** Comment out the two `is_dir` lines; the parametrized
  test fails (a traceback, not `CommandError`). Restore; `git diff --quiet` on the command file
  after restoring shows only the intended change.

- [ ] **Step 8: Commit.**

```bash
git add .env.example apps/api/src/code_api/config apps/api/src/code_api/content/management \
  apps/api/tests/test_env.py apps/api/tests/test_rebuild_command.py
git commit -F - <<'EOF'
feat(content): manage.py rebuild_index

Rebuilds the index from --root, else CODE_CONTENT_ROOT, and exits 0 when
applied, 1 when refused (with the validator's messages), 2 when there is no
folder. The setting is optional so only the command needs a content checkout.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
```

---

### Task 2: The read endpoint

**Interfaces:**
- Consumes: models `Node` (`region` FK, `links_out`, `links_in`), `Link` (`Kind.NEEDS`,
  `Kind.GOES_DEEPER`, `Kind.RELATED`, `source`, `target`, `reason`, `position`), `IndexBuild`;
  `rebuild_index` for test setup.
- Produces: `code_api.content.api.router`; `GET /api/nodes/{node_id}`.

- [ ] **Step 1: The tests.** Create `apps/api/tests/test_nodes_api.py`:

```python
"""GET /api/nodes/{node_id} (spec M1P6.3, M1P6.4): a node and its neighbours, from the index.

Reads only the part 4 fixtures, or copies of them in tmp_path (R1). Needs Compose's Postgres.
"""

import shutil
from collections.abc import Sequence
from pathlib import Path
from typing import Any

import pytest
from django.test import Client
from pytest_django import DjangoAssertNumQueries

from code_api.content.index import rebuild_index
from code_schema import Link, Node, read_content

FIXTURES = Path(__file__).resolve().parents[3] / "tests" / "fixtures" / "salmon"
CONTENT = read_content(FIXTURES)

pytestmark = pytest.mark.django_db


def cards(links: Sequence[Link]) -> list[dict[str, str]]:
    """The cards the API should give for links written in the files, in their order."""
    return [
        {
            "id": link.node,
            "title": CONTENT.nodes[link.node].title,
            "level": CONTENT.nodes[link.node].level,
            "reason": link.reason,
        }
        for link in links
    ]


def get(client: Client, node_id: str) -> Any:
    return client.get(f"/api/nodes/{node_id}")


def test_a_node_comes_with_the_three_kinds_of_link(client: Client) -> None:
    rebuild_index(FIXTURES)
    salmon: Node = CONTENT.nodes["salmon"]
    response = get(client, "salmon")
    assert response.status_code == 200
    body = response.json()
    assert body == {
        "id": "salmon",
        "title": "Salmon",
        "claim": salmon.claim,
        "region": {"id": "transcriptomics", "name": "Transcriptomics"},
        "level": "intermediate",
        "minutes": 15,
        "body": salmon.body,
        "folder": "transcriptomics/salmon",
        "needs": cards(salmon.needs),
        "goes_deeper": cards(salmon.goes_deeper),
        "related": cards(salmon.related),
        "needed_by": [],
    }
    assert [card["id"] for card in body["needs"]][0] == "rna-seq-libraries"
    assert len(body["goes_deeper"]) == 5
    assert [card["id"] for card in body["related"]] == ["kallisto"]


def test_needed_by_is_derived_with_the_needing_nodes_reason(client: Client) -> None:
    rebuild_index(FIXTURES)
    body = get(client, "em-algorithm").json()
    # Sorted by title ignoring case: kallisto, Salmon, Variational Bayesian EM.
    expected = []
    for source in ("kallisto", "salmon", "variational-bayes-em"):
        node = CONTENT.nodes[source]
        (reason,) = [link.reason for link in node.needs if link.node == "em-algorithm"]
        expected.append({"id": source, "title": node.title, "level": node.level, "reason": reason})
    assert body["needed_by"] == expected


def test_a_first_steps_node_needs_nothing(client: Client) -> None:
    rebuild_index(FIXTURES)
    body = get(client, "probability").json()
    assert (body["level"], body["needs"]) == ("first-steps", [])
    assert [card["id"] for card in body["needed_by"]] == ["likelihood"]


@pytest.mark.parametrize("node_id", ["no-such-topic", "Bad_ID"])
def test_an_id_not_in_the_index_is_404(client: Client, node_id: str) -> None:
    rebuild_index(FIXTURES)
    response = get(client, node_id)
    assert response.status_code == 404
    assert response.json() == {
        "detail": f"No topic with id '{node_id}'. It may have been removed or renamed."
    }


def test_no_index_yet_is_503(client: Client) -> None:
    response = get(client, "salmon")
    assert response.status_code == 503
    assert response.json() == {"detail": "The index has not been built yet."}


def test_refused_builds_are_no_index(client: Client, tmp_path: Path) -> None:
    broken = tmp_path / "content"
    shutil.copytree(FIXTURES, broken)
    shutil.rmtree(broken / "statistics" / "em-algorithm")
    assert rebuild_index(broken).outcome == "refused"
    assert get(client, "salmon").status_code == 503


def test_a_node_costs_three_queries(
    client: Client, django_assert_num_queries: DjangoAssertNumQueries
) -> None:
    rebuild_index(FIXTURES)
    with django_assert_num_queries(3):
        assert get(client, "salmon").status_code == 200


def test_the_schema_lists_the_node_route(client: Client) -> None:
    operation = client.get("/api/openapi.json").json()["paths"]["/api/nodes/{node_id}"]["get"]
    assert set(operation["responses"]) == {"200", "404", "503"}
```

  If `pytest_django` does not export `DjangoAssertNumQueries` in the installed version, import it
  from `pytest_django.fixtures`; mypy says which.

- [ ] **Step 2: Run them; they fail.** `uv run pytest apps/api/tests/test_nodes_api.py -q`.
  Expected: every request answers 404 from Django (no route), so the 200 and 503 tests fail, the
  schema test fails with `KeyError`. The 404 tests fail too: Django's 404 body is not the JSON
  above.

- [ ] **Step 3: The router.** Create `apps/api/src/code_api/content/api.py`:

```python
"""GET /api/nodes/{node_id}: one node from the index, with its neighbours (M1 part 6 spec, M1P6.3).

Read-only: the index is written only by `rebuild_index`. Three queries per node, whatever its
size. An id not in the index is a normal case (M1P5.3): 404, or 503 when no build was ever applied.
"""

from django.http import HttpRequest
from ninja import Router, Schema, Status

from code_api.content.models import IndexBuild, Link, Node

router = Router(tags=["content"])


class RegionOut(Schema):
    id: str
    name: str


class NeighbourOut(Schema):
    """A neighbour as a card: enough for a node page's side panel (L5) without another request."""

    id: str
    title: str
    level: str
    reason: str


class NodeOut(Schema):
    id: str
    title: str
    claim: str
    region: RegionOut
    level: str
    minutes: int
    body: str
    folder: str
    needs: list[NeighbourOut]
    goes_deeper: list[NeighbourOut]
    related: list[NeighbourOut]
    needed_by: list[NeighbourOut]


class Message(Schema):
    detail: str


def _card(node: Node, reason: str) -> NeighbourOut:
    return NeighbourOut(id=node.id, title=node.title, level=node.level, reason=reason)


@router.get(
    "/{node_id}",
    response={200: NodeOut, 404: Message, 503: Message},
    summary="A node and its neighbours",
)
def node(request: HttpRequest, node_id: str) -> Status[NodeOut] | Status[Message]:
    found = Node.objects.select_related("region").filter(id=node_id).first()
    if found is None:
        # Only a miss pays for this query.
        if not IndexBuild.objects.filter(outcome=IndexBuild.Outcome.APPLIED).exists():
            return Status(503, Message(detail="The index has not been built yet."))
        detail = f"No topic with id '{node_id}'. It may have been removed or renamed."
        return Status(404, Message(detail=detail))
    out: dict[str, list[NeighbourOut]] = {kind: [] for kind in Link.Kind.values}
    for link in found.links_out.select_related("target").order_by("kind", "position"):
        out[link.kind].append(_card(link.target, link.reason))
    incoming = found.links_in.filter(kind=Link.Kind.NEEDS).select_related("source")
    # Sorted here, not by the database: Postgres's collation and Python's differ on case.
    needed_by = sorted(incoming, key=lambda link: (link.source.title.casefold(), link.source.id))
    return Status(
        200,
        NodeOut(
            id=found.id,
            title=found.title,
            claim=found.claim,
            region=RegionOut(id=found.region.id, name=found.region.name),
            level=found.level,
            minutes=found.minutes,
            body=found.body,
            folder=found.folder,
            needs=out[Link.Kind.NEEDS],
            goes_deeper=out[Link.Kind.GOES_DEEPER],
            related=out[Link.Kind.RELATED],
            needed_by=[_card(link.source, link.reason) for link in needed_by],
        ),
    )
```

  In `apps/api/src/code_api/api.py`, import and mount it after health:

```python
from code_api.content.api import router as content_router
from code_api.health.api import router as health_router

api = NinjaAPI(title="Comeni Code API", version="0.1.0")
api.add_router("/health", health_router)
api.add_router("/nodes", content_router)
```

- [ ] **Step 4: Run them; they pass.** `uv run pytest apps/api/tests/test_nodes_api.py -q`.

- [ ] **Step 5: Regenerate the schemas.**

```bash
uv run python apps/api/manage.py export_openapi_schema --api code_api.api.api --sorted --indent 2 --output apps/api/openapi.json
export PATH="$HOME/.local/node24/bin:$PATH"   # Node 24 (CLAUDE.md)
(cd apps/web && npm run api-types && npm run lint && npm run typecheck && npm test)
uv run pytest apps/api/tests/test_openapi_and_docs.py -q
```

- [ ] **Step 6: See the pins fail.** One at a time, then restore each:
  - drop `order_by("kind", "position")` to `order_by("kind", "-position")`: the Salmon test fails;
  - drop `.casefold()` from the sort key: the needed-by test fails (Python puts *Salmon* before
    *kallisto*);
  - replace `select_related("target")` with nothing: the query-count test fails.
  After restoring, `git diff` on `api.py` against the version from step 3 shows nothing.

- [ ] **Step 7: The whole command set.**
  `uv run ruff check . && uv run ruff format --check . && uv run mypy && uv run pytest -q`, and
  `uv run python apps/api/manage.py check`.

- [ ] **Step 8: Commit.**

```bash
git add apps/api/src/code_api/api.py apps/api/src/code_api/content/api.py apps/api/openapi.json \
  apps/api/tests/test_nodes_api.py apps/web/src/api/schema.ts
git commit -F - <<'EOF'
feat(content): GET /api/nodes/{node_id}

One node from the index with its needs, goes-deeper and related in the
author's order, and needed-by derived from incoming needs links, each
neighbour a card with its reason. Three queries per node. A miss is 404,
or 503 while no build has ever been applied.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
```

---

### Task 3: M1 is done — the record, and the pull request

- [ ] **Step 1: Check M1's done-when** (M1P6.6), each command run and its output kept for the
  journal:

```bash
uv run code-schema validate tests/fixtures/salmon          # 26 nodes, no problems
uv run pytest tests/schema -q -k "missing or unknown or fixtures"   # part 3's messages, part 4's shape
uv run pytest apps/api/tests/test_rebuild_command.py -q -k files_alone
```

- [ ] **Step 2: CLAUDE.md.** Status: M1 done — the node format, links, `code-schema validate`, the
  Salmon fixtures, the index, `manage.py rebuild_index` and `GET /api/nodes/{node_id}`; next is M2,
  the weaver. Commands, after `collectstatic`:

```
uv run python apps/api/manage.py rebuild_index --root tests/fixtures/salmon   # fill a local index; exit 0/1/2
```

  Layout: `apps/api/` line gains `content/ — the index, rebuild_index, /api/nodes`.

- [ ] **Step 3: The journal.** `docs/notes/journal/2026-09-19-m1-part-6-command-and-api.md`, in
  part 5's shape: where things stand (a check per claim, the M1 done-when's three checks), what
  changed (the commits), decisions (the four answers, the case-insensitive sort), departures from
  the plan, what is next (M2 parts list; the master's seeds when the operator sends them; the
  fixtures into `comeni-code-content` then), open questions (`IndexBuild` pruning, carried), traps.
  Update the README's box and table to point to it.

- [ ] **Step 4: Commit, push, pull request.**

```bash
git add CLAUDE.md docs/notes/journal
git commit -F - <<'EOF'
docs: M1 part 6 done, and M1 with it

The journal entry records the command, the endpoint and M1's done-when
checks; CLAUDE.md's status moves to M2.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
git push -u origin m1-part-6-rebuild-command-and-read-api
gh pr create --title "M1 part 6: rebuild_index and GET /api/nodes/{node_id}" --body-file <body>
```

  The body summarises the spec's decisions and the tests, and ends with
  `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

- [ ] **Step 5: Merge only on green.**

```bash
gh pr checks <n> --watch > /tmp/…/checks.log 2>&1; echo $? > /tmp/…/checks.rc
```

  Merge only if the file holds `0`; never through a pipe. Then pull `main`.
