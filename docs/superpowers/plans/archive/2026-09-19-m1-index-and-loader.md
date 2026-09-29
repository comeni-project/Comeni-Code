# M1 part 5: the index and the loader — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task by task, driven by one agent. Subagents are for review only (the operator's rule in CLAUDE.md). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** a Django app, `code_api.content`, whose four models hold the index, and one function,
`rebuild_index(root, *, commit="")`, that fills it from a content folder all or nothing and
records every attempt.

**Architecture:** `rebuild_index` calls `code_schema.read_content` (the same call content CI
makes), digests the files the index is made of, and either records a refusal or replaces
`Region`, `Node` and `Link` in one transaction under an advisory lock. Nothing outside the index
holds a foreign key to it. The tests run against Compose's Postgres and the part 4 fixtures.

**Tech Stack:** Django 6.1, Postgres 18, psycopg 3, pytest-django, mypy strict with django-stubs,
uv workspace (`code-schema` becomes a dependency of `code-api`).

**Spec:** [`docs/superpowers/specs/2026-09-19-m1-index-and-loader-design.md`](../specs/2026-09-19-m1-index-and-loader-design.md)
(agreed 2026-09-19).

## Global Constraints

- **Only `code_api/content/index.py` writes the index models.** No admin, no signals, no other
  module calling `create`, `bulk_create`, `update` or `delete` on them.
- **No foreign key from outside the index into it** (M1P5.3). This part adds none.
- **String columns are `TextField`**, with no length limits (M1P5.4); the validator owns the rules.
- **A refusal returns a build; it never raises.** Only an unexpected failure while applying raises,
  after rolling back.
- **Tests read only `tests/fixtures/salmon/` or copies of it in `tmp_path`** (R1); they need
  Compose's Postgres (`docker compose up -d --wait postgres redis`).
- `code-schema` stays pure: nothing in `packages/` changes.
- Same command set, commit and PR rules as parts 1–4; merge only on a captured `exit=0`.

## File structure

```
apps/api/pyproject.toml                               + code-schema dependency (workspace source)
apps/api/src/code_api/config/settings.py              + "code_api.content" in INSTALLED_APPS
apps/api/src/code_api/content/__init__.py             empty
apps/api/src/code_api/content/apps.py                 ContentConfig
apps/api/src/code_api/content/models.py               Region, Node, Link, IndexBuild
apps/api/src/code_api/content/migrations/0001_initial.py   generated
apps/api/src/code_api/content/index.py                content_digest, rebuild_index — the only writer
apps/api/tests/test_content_index.py                  the tests of M1P5.6
uv.lock                                               relocked
```

---

### Task 1: the app, the models, and a first rebuild

**Files:**
- Modify: `apps/api/pyproject.toml`, `uv.lock`, `apps/api/src/code_api/config/settings.py`
- Create: `apps/api/src/code_api/content/{__init__,apps,models,index}.py`, the migration
- Test: `apps/api/tests/test_content_index.py`

**Interfaces:**
- Consumes: `code_schema.read_content(root: Path) -> Content` with `nodes: dict[str, Node]`,
  `folders: dict[str, str]` (relative to root), `regions: dict[str, Region]` (file order),
  `problems: tuple[Problem, ...]`; `code_schema.Node` fields `id, title, claim, region, level
  (Level, a StrEnum), minutes, body, needs, goes_deeper, related` (tuples of `Link(node, reason)`).
- Produces: `code_api.content.models.{Region, Node, Link, IndexBuild}`,
  `Link.Kind.{NEEDS, GOES_DEEPER, RELATED}`, `IndexBuild.Outcome.{APPLIED, REFUSED}`;
  `code_api.content.index.rebuild_index(root: Path, *, commit: str = "") -> IndexBuild`,
  `content_digest(root: Path, content: Content) -> str`, and the private `_link_rows(content)`
  that Task 3 patches.

- [ ] **Step 1: Make `code-schema` a dependency of the API**

In `apps/api/pyproject.toml`, add `"code-schema"` to `dependencies` and, after `[project]`:

```toml
[tool.uv.sources]
code-schema = { workspace = true }
```

Run: `uv lock && uv sync --locked --all-packages`
Expected: `uv.lock` gains `code-schema` under `code-api`'s dependencies. `Dockerfile.api` copies
`packages/` whole, so the image needs no change.

- [ ] **Step 2: Write the failing tests**

`apps/api/tests/test_content_index.py`:

```python
"""The index and its rebuild (spec M1P5): all or nothing, the same twice, converging after edits.

Reads only the part 4 fixtures, or copies of them in tmp_path (R1). Needs Compose's Postgres.
"""

import shutil
from pathlib import Path
from typing import Any

import pytest

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


def copy_of_fixtures(tmp_path: Path) -> Path:
    root = tmp_path / "content"
    shutil.copytree(FIXTURES, root)
    return root


def test_the_fixtures_rebuild_into_the_index() -> None:
    content = read_content(FIXTURES)
    links = sum(
        len(node.needs) + len(node.goes_deeper) + len(node.related)
        for node in content.nodes.values()
    )
    build = rebuild_index(FIXTURES, commit="abc123")
    assert build.outcome == IndexBuild.Outcome.APPLIED
    assert (build.node_count, build.problems, build.commit) == (26, [], "abc123")
    assert len(build.digest) == 64
    assert (Node.objects.count(), Region.objects.count(), Link.objects.count()) == (26, 6, links)
    salmon = Node.objects.get(id="salmon")
    assert (salmon.region_id, salmon.level, salmon.folder) == (
        "transcriptomics",
        "intermediate",
        "transcriptomics/salmon",
    )
    assert salmon.body == content.nodes["salmon"].body
    assert list(Region.objects.order_by("position").values_list("id", flat=True)) == list(
        content.regions
    )


def test_two_rebuilds_give_the_same_index() -> None:
    first = rebuild_index(FIXTURES)
    before = dump()
    second = rebuild_index(FIXTURES)
    assert dump() == before
    assert second.digest == first.digest
    assert IndexBuild.objects.filter(outcome=IndexBuild.Outcome.APPLIED).count() == 2


def test_links_keep_the_authors_order() -> None:
    rebuild_index(FIXTURES)
    salmon = read_content(FIXTURES).nodes["salmon"]
    for kind, links in (("needs", salmon.needs), ("goes-deeper", salmon.goes_deeper)):
        stored = (
            Link.objects.filter(source_id="salmon", kind=kind)
            .order_by("position")
            .values_list("target_id", flat=True)
        )
        assert list(stored) == [link.node for link in links], kind
```

- [ ] **Step 3: Run them and see them fail**

Run: `uv run pytest apps/api/tests/test_content_index.py -q`
Expected: collection error, `No module named 'code_api.content'`.

- [ ] **Step 4: The app and the models**

`apps/api/src/code_api/content/__init__.py`: empty.

`apps/api/src/code_api/content/apps.py`:

```python
from django.apps import AppConfig


class ContentConfig(AppConfig):
    name = "code_api.content"
    label = "content"
```

`apps/api/src/code_api/content/models.py`:

```python
"""The index: approved content as tables, derived from the files and never edited (spec M1P5.4).

Only `code_api.content.index` writes these models. Nothing outside the index holds a foreign key
into it — other tables name a node by its id (M1P5.3) — so a rebuild can replace it wholesale.
Strings are TextField: the validator owns every length rule, and a second copy of a rule here
would turn a clean rebuild into a database error the day the two disagree.
"""

from django.db import models

from code_schema import Level


class Region(models.Model):
    id = models.TextField(primary_key=True)
    name = models.TextField()
    # regions.yaml's order, which routes use to break ties (W3.3).
    position = models.PositiveIntegerField()


class Node(models.Model):
    id = models.TextField(primary_key=True)
    title = models.TextField()
    claim = models.TextField()
    region = models.ForeignKey(Region, on_delete=models.PROTECT, related_name="nodes")
    level = models.TextField(choices=[(level.value, level.value) for level in Level])
    minutes = models.PositiveIntegerField()
    body = models.TextField()
    # The node's folder, relative to the content root: for "edit on GitHub" later.
    folder = models.TextField()


class Link(models.Model):
    class Kind(models.TextChoices):
        NEEDS = "needs"
        GOES_DEEPER = "goes-deeper"
        RELATED = "related"

    source = models.ForeignKey(Node, on_delete=models.CASCADE, related_name="links_out")
    target = models.ForeignKey(Node, on_delete=models.CASCADE, related_name="links_in")
    kind = models.TextField(choices=Kind.choices)
    reason = models.TextField()
    # The author's order within one kind of link.
    position = models.PositiveIntegerField()

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["source", "kind", "target"], name="content_link_once")
        ]


class IndexBuild(models.Model):
    """One rebuild attempt, kept. The live index is the latest applied build (M1P5.5)."""

    class Outcome(models.TextChoices):
        APPLIED = "applied"
        REFUSED = "refused"

    created_at = models.DateTimeField(auto_now_add=True)
    outcome = models.TextField(choices=Outcome.choices)
    # SHA-256 of the files the index is made of, in hex.
    digest = models.TextField()
    # The content commit, when the caller knows it; the rebuild never runs git.
    commit = models.TextField(blank=True)
    node_count = models.PositiveIntegerField()
    # The validator's messages, exactly as it words them; empty when applied.
    problems = models.JSONField(default=list)
```

In `settings.py`, add `"code_api.content",` after `"code_api.accounts",` in `INSTALLED_APPS`.

Run: `uv run python apps/api/manage.py makemigrations content`
Expected: `apps/api/src/code_api/content/migrations/0001_initial.py` with the four models and the
constraint. Then `uv run python apps/api/manage.py makemigrations --check --dry-run` prints
`No changes detected`.

- [ ] **Step 5: The rebuild**

`apps/api/src/code_api/content/index.py`:

```python
"""Rebuild the index from a content folder, all or nothing (spec M1P5.5).

The only code that writes the index. It reads with `read_content`, the call content CI makes, so
the app and CI never disagree about what a valid node is. It does not run git and does not choose
the folder: the caller passes both.
"""

from __future__ import annotations

import hashlib
from pathlib import Path

from django.db import connection, transaction

from code_api.content.models import IndexBuild, Link, Node, Region
from code_schema import Content, read_content
from code_schema.regions import REGISTRY

# Any fixed number: it names the transaction-scoped lock two rebuilds take in turn.
_LOCK = 5_172_031


def content_digest(root: Path, content: Content) -> str:
    """SHA-256 over regions.yaml and every file inside every node folder, in sorted path order.

    Files outside the nodes (a README, .github/) do not change the index, so they do not change
    the digest. Each file contributes its relative path, its size and its bytes, so no two
    different folders hash alike by moving bytes between files.
    """
    files = [root / REGISTRY] if (root / REGISTRY).is_file() else []
    for folder in content.folders.values():
        for path in (root / folder).rglob("*"):
            relative = path.relative_to(root)
            if path.is_file() and not any(part.startswith(".") for part in relative.parts):
                files.append(path)
    digest = hashlib.sha256()
    for path in sorted(files, key=lambda path: path.relative_to(root).as_posix()):
        data = path.read_bytes()
        digest.update(path.relative_to(root).as_posix().encode() + b"\0")
        digest.update(len(data).to_bytes(8, "big") + data)
    return digest.hexdigest()


def _region_rows(content: Content) -> list[Region]:
    return [
        Region(id=region.id, name=region.name, position=position)
        for position, region in enumerate(content.regions.values())
    ]


def _node_rows(content: Content) -> list[Node]:
    return [
        Node(
            id=node.id,
            title=node.title,
            claim=node.claim,
            region_id=node.region,
            level=node.level.value,
            minutes=node.minutes,
            body=node.body,
            folder=content.folders[node.id],
        )
        for node in content.nodes.values()
    ]


def _link_rows(content: Content) -> list[Link]:
    rows: list[Link] = []
    for node in content.nodes.values():
        for kind, links in (
            (Link.Kind.NEEDS, node.needs),
            (Link.Kind.GOES_DEEPER, node.goes_deeper),
            (Link.Kind.RELATED, node.related),
        ):
            rows.extend(
                Link(
                    source_id=node.id,
                    target_id=link.node,
                    kind=kind,
                    reason=link.reason,
                    position=position,
                )
                for position, link in enumerate(links)
            )
    return rows


def rebuild_index(root: Path, *, commit: str = "") -> IndexBuild:
    """Replace the index with `root`'s content, or change nothing and record why.

    A refusal is an outcome, returned; only an unexpected failure while applying raises, after
    the transaction has rolled back and left the old index standing.
    """
    content = read_content(root)
    digest = content_digest(root, content)
    if content.problems:
        return IndexBuild.objects.create(
            outcome=IndexBuild.Outcome.REFUSED,
            digest=digest,
            commit=commit,
            node_count=len(content.folders),
            problems=[str(problem) for problem in content.problems],
        )
    with transaction.atomic():
        with connection.cursor() as cursor:
            cursor.execute("SELECT pg_advisory_xact_lock(%s)", [_LOCK])
        Link.objects.all().delete()
        Node.objects.all().delete()
        Region.objects.all().delete()
        Region.objects.bulk_create(_region_rows(content))
        Node.objects.bulk_create(_node_rows(content))
        Link.objects.bulk_create(_link_rows(content))
        return IndexBuild.objects.create(
            outcome=IndexBuild.Outcome.APPLIED,
            digest=digest,
            commit=commit,
            node_count=len(content.nodes),
        )
```

**Reviewer: check the advisory lock by eye** — it is the one line M1P5.6 leaves untested. It must
run inside `transaction.atomic()`, before the first delete.

- [ ] **Step 6: Run the tests**

Run: `uv run pytest apps/api/tests/test_content_index.py -q && uv run mypy`
Expected: 3 passed; mypy clean.

- [ ] **Step 7: Commit**

```bash
git add apps/api uv.lock
git commit  # feat(content): the index models and rebuild_index
```

---

### Task 2: refusals and the digest

**Files:** Test: `apps/api/tests/test_content_index.py`

**Interfaces:** Consumes `rebuild_index`, `content_digest`, `dump`, `copy_of_fixtures`.

- [ ] **Step 1: Write the tests**

Add `content_digest` to the import from `code_api.content.index`, then:

```python
def test_a_folder_with_problems_changes_nothing(tmp_path: Path) -> None:
    rebuild_index(FIXTURES)
    before = dump()
    root = copy_of_fixtures(tmp_path)
    shutil.rmtree(root / "statistics" / "em-algorithm")
    expected = [str(problem) for problem in read_content(root).problems]
    assert expected  # salmon, kallisto and variational-bayes-em now point at nothing

    build = rebuild_index(root)

    assert build.outcome == IndexBuild.Outcome.REFUSED
    assert (build.problems, build.node_count) == (expected, 25)
    assert dump() == before
    assert IndexBuild.objects.filter(outcome=IndexBuild.Outcome.APPLIED).count() == 1


def test_the_digest_tracks_the_index_only(tmp_path: Path) -> None:
    root = copy_of_fixtures(tmp_path)
    first = content_digest(root, read_content(root))
    (root / "README.md").write_text("A readme is not part of the index.\n", encoding="utf-8")
    assert content_digest(root, read_content(root)) == first
    body = root / "statistics" / "likelihood" / "body.md"
    body.write_text(body.read_text(encoding="utf-8") + "One more line.\n", encoding="utf-8")
    assert content_digest(root, read_content(root)) != first
```

- [ ] **Step 2: Run them**

Run: `uv run pytest apps/api/tests/test_content_index.py -q`
Expected: 5 passed. These pin behaviour Task 1 already built, so they pass on first run. **Prove
each can fail:** temporarily change `if content.problems:` to `if False:` — the refusal test fails
(the broken folder is applied, so the dump changes — Postgres checks Django's foreign keys only at
commit, which a test never reaches); restore it. Temporarily hash every file under the root
(`root.rglob("*")`) instead of the node folders' files — the README assertion fails; restore it.

- [ ] **Step 3: Commit**

```bash
git add apps/api/tests/test_content_index.py
git commit  # test(content): a refusal changes nothing; the digest tracks the index only
```

---

### Task 3: all or nothing, and converging after edits

**Files:** Test: `apps/api/tests/test_content_index.py`

**Interfaces:** Consumes `code_api.content.index._link_rows` (patched), `code_schema.read_node`,
`write_node_folder`, `Level`, and the schema's `Node` and `Link` (imported as `SchemaNode`,
`SchemaLink` to avoid the models' names).

- [ ] **Step 1: Write the tests**

Add to the imports:

```python
from dataclasses import replace

from code_api.content import index
from code_schema import Level, read_node, write_node_folder
from code_schema import Link as SchemaLink
from code_schema import Node as SchemaNode
```

Then:

```python
def test_a_failure_while_writing_leaves_the_old_index(monkeypatch: pytest.MonkeyPatch) -> None:
    rebuild_index(FIXTURES)
    before = dump()

    def fail(content: object) -> list[Link]:
        raise RuntimeError("the database went away")

    monkeypatch.setattr(index, "_link_rows", fail)
    with pytest.raises(RuntimeError):
        rebuild_index(FIXTURES)
    assert dump() == before
    assert IndexBuild.objects.count() == 1


def edit(root: Path) -> None:
    """A claim changed, a node removed with the link to it, a node added, needs reordered."""
    regions = set(read_content(root).regions)

    def node(folder: str) -> SchemaNode:
        read, problems = read_node(root / folder, regions=regions, root=root)
        assert read is not None and problems == []
        return read

    likelihood = node("statistics/likelihood")
    write_node_folder(
        replace(likelihood, claim="Likelihood is how probable a model makes the data you saw."),
        root / "statistics" / "likelihood",
    )
    salmon = node("transcriptomics/salmon")
    write_node_folder(
        replace(
            salmon,
            needs=tuple(reversed(salmon.needs)),
            goes_deeper=tuple(
                link for link in salmon.goes_deeper if link.node != "abundance-uncertainty"
            ),
        ),
        root / "transcriptomics" / "salmon",
    )
    shutil.rmtree(root / "statistics" / "abundance-uncertainty")
    write_node_folder(
        SchemaNode(
            id="paired-end-reads",
            title="Paired-end reads",
            claim="Paired-end reads are the two ends of one fragment, read towards each other.",
            region="sequencing",
            level=Level.FOUNDATIONS,
            minutes=8,
            body="Both ends of a fragment are read, which pins down where it came from.\n",
            needs=(
                SchemaLink(
                    node="short-read-sequencing",
                    reason="Paired-end reads come from a short-read sequencer.",
                ),
            ),
        ),
        root / "sequencing" / "paired-end-reads",
    )


def test_a_rebuild_after_an_edit_equals_a_fresh_build(tmp_path: Path) -> None:
    root = copy_of_fixtures(tmp_path)
    rebuild_index(root)
    edit(root)
    assert read_content(root).problems == ()

    rebuild_index(root)
    after_edit = dump()
    Link.objects.all().delete()
    Node.objects.all().delete()
    Region.objects.all().delete()
    rebuild_index(root)

    assert dump() == after_edit
    assert Node.objects.get(id="likelihood").claim.startswith("Likelihood is how probable")
    assert not Node.objects.filter(id="abundance-uncertainty").exists()
    assert Node.objects.filter(id="paired-end-reads").exists()
    needs = (
        Link.objects.filter(source_id="salmon", kind="needs")
        .order_by("position")
        .values_list("target_id", flat=True)
    )
    assert list(needs) == [
        link.node for link in reversed(read_content(FIXTURES).nodes["salmon"].needs)
    ]
```

(The test's own deletes simulate *an empty index*; they are test setup, not a second writer.)

- [ ] **Step 2: Run them, and prove the rollback test can fail**

Run: `uv run pytest apps/api/tests/test_content_index.py -q`
Expected: 7 passed. Then temporarily remove `with transaction.atomic():` (dedent its body): the
rollback test fails, because the deletes stand. Restore it.

*Why the test's own transaction does not hide this:* pytest-django wraps each test in a
transaction, so `atomic()` inside becomes a savepoint, and a raised error rolls back to it — the
same all-or-nothing the real transaction gives.

- [ ] **Step 3: Commit**

```bash
git add apps/api/tests/test_content_index.py
git commit  # test(content): all or nothing, and converging after edits
```

---

### Task 4: the record, and the pull request

**Files:**
- Modify: `CLAUDE.md` (status; layout gains `apps/api/.../content/`)
- Create: `docs/notes/journal/2026-09-19-m1-part-5-index.md`
- Modify: `docs/notes/journal/README.md` (the box and the table)

- [ ] **Step 1: The whole command set**

Run:
`uv run ruff check . && uv run ruff format --check . && uv run mypy && uv run python apps/api/manage.py makemigrations --check --dry-run && uv run pytest`
Expected: all pass (273 tests).

- [ ] **Step 2: Status, journal, README box**

CLAUDE.md's status: parts 1–5 of 6 built; the index is `code_api.content`, rebuilt by
`rebuild_index`. The journal entry follows the README's six headings: what M1P5.1's done-when is
proved by, the commits, the decisions (with the operator's scaling note, M1P5.7), the two spec
corrections made while planning (no admin to test; the dump covers three tables), what is next
(part 6), and the traps (the advisory lock is untested; the tests need Postgres).

- [ ] **Step 3: Commit, pull request, merge on green**

```bash
git add -A && git commit  # docs: M1 part 5 done — journal and status
git push -u origin docs/m1-part-5-index
gh pr create ...
gh pr checks <n> --watch > checks.log 2>&1; echo "exit=$?" > checks.exit
```

Merge only when the captured exit is 0.
