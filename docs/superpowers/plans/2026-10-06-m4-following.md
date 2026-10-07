# M4.7 Following — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The index follows `comeni-code-content`'s `main` through one reconciler, `follow(source)`;
a manual rebuild is the same method over a folder; drafts become `landed` once the live build
contains their landing's merge; the team reads the index's state at `GET /api/studio/index`.

**Architecture:** `code_api/studio/follow.py` holds a `Source` interface (`head`, `checkout`,
`contains`) with `GitHubSource` (tarballs through M4.6's client) and `FolderSource`, a
`configured_source()` factory, and `follow()`: compare `main`'s head with the live build, build if
they differ, then mark landed. One Postgres try-lock keeps it single. Beat runs it every five
minutes and the landing poller queues it on a merge. The `rebuild_index` command moves into the
studio app and wraps `follow`.

**Tech Stack:** Python 3.14, Django 6.1, Django Ninja, Celery, Postgres 18, `tarfile` (the `data`
filter), `requests`, pytest.

**Spec:** `docs/superpowers/specs/2026-10-06-m4-following-design.md` (M4F.1–M4F.6). M4.6's spec is
archived: `docs/superpowers/specs/archive/2026-10-06-m4-landing-design.md`.

## Global Constraints

- **Nothing reaches GitHub in tests**: `FakeGitHub` (`apps/api/tests/fake_github.py`) for
  `GitHubSource`; the local HTTP stub for the client. No test reads the real content repository.
- **One method**: every build of the index goes through `follow(source)` except tests that call
  `rebuild_index` directly; the command adds no logic of its own (M4F.2).
- **Each round is safe to repeat**: following the same head twice builds once; `landed` is final.
- The command keeps its contract: exit 0 applied, 1 refused (`CA0006` and the problems on stderr),
  2 cannot start (`CA0004`, `CA0005`); `--root`, `--commit`; same output lines.
- Tarballs: at most `MAX_TARBALL = 50 * 1024 * 1024` bytes, unpacked with `filter="data"`.
- Tests marked `django_db` need `podman start code-dev-postgres code-dev-redis`.
- Before every push: the suite with CI's env (`CODE_SECRET_KEY=ci-only-insecure-key-for-github-actions-0000000000000000
  CODE_DATABASE_URL=postgresql://code:code@localhost:5433/code CODE_DEBUG=false
  CODE_ALLOWED_HOSTS=localhost CODE_REDIS_URL=redis://localhost:6380/0 uv run pytest`) and
  `uv run ruff format --check .`.
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; one logical change
  per commit; each closes its sub-issue of #125 (M4.7.1–M4.7.8 are #207–#214).

## Review Focus

1. **A follow that dies mid-build** (a killed worker, a GitHub error during the tarball): the old
   index stands, the temporary folder is gone, the lock is released, and the next round tries again
   (Task 3).
2. **`main` moving between `head()` and `checkout()`**: the build is recorded at the head that was
   read and checked out by that same commit, never a mix (Task 3: `checkout(want)` takes the commit).
3. **A merged landing whose merge is not yet in any applied build** (a refused commit came after
   it): its drafts stay approved and held; they land on the first applied build that contains the
   merge (Task 4).
4. **A landing merged through close()** (the final review's I5 path) must record its merge commit
   and queue a follow too, or its drafts never land (Task 4).
5. **A tarball with a path out of its folder, a link out, or past the size cap**: refused as a
   `GitHubError`, nothing written outside (Task 1).

---

### Task 1: The client's tarball, `contains`, and the merge commit (M4.7.1)

**Files:**
- Modify: `apps/api/src/code_api/studio/github.py`, `apps/api/tests/fake_github.py`
- Test: `apps/api/tests/test_github_client.py`

**Interfaces:**
- Produces, in `code_api.studio.github`: `MAX_TARBALL = 50 * 1024 * 1024`;
  `PullState.merge_commit: str` (empty unless merged);
  `GitHub.tarball(self, commit: str, into: Path) -> Path` (the content's root inside `into`);
  `GitHub.contains(self, ancestor: str, commit: str) -> bool`.
- Produces, in `FakeGitHub`: `trees: dict[str, Path]` (a commit's content folder),
  `ancestry: set[tuple[str, str]]` (`(ancestor, commit)` pairs that hold besides equality);
  `pull_state` reports `merge_commit=f"merge-{number}"` for a merged pull request.

- [x] **Step 1: Write the failing tests** — append to `apps/api/tests/test_github_client.py`. The
  stub learns raw bytes: in `Stub.__init__` add `self.raw: dict[tuple[str, str], bytes] = {}`, and
  in `_answer`, before the JSON route lookup:

```python
            if (self.command, self.path) in state.raw:
                payload = state.raw[(self.command, self.path)]
                self.send_response(200)
                self.send_header("Content-Type", "application/x-gzip")
                self.send_header("Content-Length", str(len(payload)))
                self.end_headers()
                self.wfile.write(payload)
                return
```

then the tests:

```python
def _tar(members: dict[str, bytes], links: dict[str, str] | None = None) -> bytes:
    buffer = io.BytesIO()
    with tarfile.open(fileobj=buffer, mode="w:gz") as archive:
        for name, data in members.items():
            info = tarfile.TarInfo(name)
            info.size = len(data)
            archive.addfile(info, io.BytesIO(data))
        for name, target in (links or {}).items():
            info = tarfile.TarInfo(name)
            info.type, info.linkname = tarfile.SYMTYPE, target
            archive.addfile(info)
    return buffer.getvalue()


def test_a_tarball_is_unpacked_to_its_root(stub: tuple[Stub, GitHubApp], tmp_path: Path) -> None:
    state, app = stub
    state.raw[("GET", f"{REPO}/tarball/c1")] = _tar(
        {"owner-repo-c1/regions.yaml": b"regions: []\n", "owner-repo-c1/a/b/node.yaml": b"id: b\n"}
    )
    root = Client(app).tarball("c1", tmp_path)
    assert root == tmp_path / "owner-repo-c1"
    assert (root / "a" / "b" / "node.yaml").read_text() == "id: b\n"


@pytest.mark.parametrize(
    "members, links",
    [
        ({"owner-repo-c1/../../evil": b"x"}, None),
        ({"/etc/evil": b"x"}, None),
        ({"owner-repo-c1/ok": b"x"}, {"owner-repo-c1/out": "/etc/passwd"}),
    ],
    ids=["dot-dot", "absolute", "link-out"],
)
def test_a_tarball_that_leaves_its_folder_is_refused(
    stub: tuple[Stub, GitHubApp],
    tmp_path: Path,
    members: dict[str, bytes],
    links: dict[str, str] | None,
) -> None:
    state, app = stub
    state.raw[("GET", f"{REPO}/tarball/c1")] = _tar(members, links)
    into = tmp_path / "into"
    into.mkdir()
    with pytest.raises(GitHubError, match="tarball"):
        Client(app).tarball("c1", into)
    assert not (tmp_path / "evil").exists()


def test_a_tarball_past_the_cap_is_refused(
    stub: tuple[Stub, GitHubApp], tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    state, app = stub
    monkeypatch.setattr(github, "MAX_TARBALL", 10)
    state.raw[("GET", f"{REPO}/tarball/c1")] = _tar({"owner-repo-c1/big": b"x" * 1000})
    with pytest.raises(GitHubError, match="larger than"):
        Client(app).tarball("c1", tmp_path)


@pytest.mark.parametrize(
    "status, held", [("identical", True), ("ahead", True), ("behind", False), ("diverged", False)]
)
def test_contains_reads_compares_status(
    stub: tuple[Stub, GitHubApp], status: str, held: bool
) -> None:
    state, app = stub
    state.routes[("GET", f"{REPO}/compare/m1...h1")] = (200, {"status": status, "files": []})
    assert Client(app).contains("m1", "h1") is held


def test_a_merged_pull_request_names_its_merge_commit(stub: tuple[Stub, GitHubApp]) -> None:
    state, app = stub
    state.routes[("GET", f"{REPO}/pulls/7")] = (
        200,
        {
            "merged": True,
            "state": "closed",
            "mergeable": None,
            "merge_commit_sha": "m7",
            "head": {"sha": "h7"},
        },
    )
    state.routes[("GET", f"{REPO}/commits/h7/check-runs?per_page=100")] = (200, {"check_runs": []})
    state.routes[("GET", f"{REPO}/commits/h7/status")] = (200, {"statuses": []})
    assert Client(app).pull_state(7).merge_commit == "m7"
```

(Imports to add: `import io`, `import tarfile`, `from pathlib import Path`.)

- [x] **Step 2: Run them to verify they fail**

Run: `uv run pytest apps/api/tests/test_github_client.py -q`
Expected: FAIL — `AttributeError: 'Client' object has no attribute 'tarball'` (and `contains`,
`merge_commit`).

- [x] **Step 3: Implement** — in `github.py`: `merge_commit: str = ""` as the last field of
  `PullState`; `merge_commit=str(pull.get("merge_commit_sha") or "") if pull["merged"] else ""` in
  `pull_state`; the two protocol methods; and on `Client`:

```python
def tarball(self, commit: str, into: Path) -> Path:
    """A commit's content, unpacked in `into`; its root folder is returned. GitHub answers
    with a redirect to a signed download, which `requests` follows without our token. The
    archive is capped in size and unpacked with tarfile's `data` filter, which refuses
    absolute paths, `..` and links that leave the folder (M4F.2)."""
    url = f"{self.repo}/tarball/{commit}"
    archive = into / f"{commit}.tar.gz"
    try:
        with requests.get(
            url,
            stream=True,
            timeout=TIMEOUT,
            headers={
                "Authorization": f"Bearer {self._token()}",
                "X-GitHub-Api-Version": API_VERSION,
            },
        ) as answer:
            if answer.status_code >= 400:
                raise GitHubError(
                    f"GitHub answered {answer.status_code} for the tarball of {commit}.",
                    answer.status_code,
                )
            size = 0
            with archive.open("wb") as out:
                for chunk in answer.iter_content(chunk_size=1 << 16):
                    size += len(chunk)
                    if size > MAX_TARBALL:
                        raise GitHubError(
                            f"The tarball of {commit} is larger than {MAX_TARBALL} bytes."
                        )
                    out.write(chunk)
    except requests.Timeout as error:
        raise GitHubError(f"GitHub did not answer within {TIMEOUT} seconds.") from error
    except requests.RequestException as error:
        raise GitHubError(f"GitHub could not be reached: {error}.") from error
    try:
        with tarfile.open(archive) as unpacked:
            roots = {Path(member.name).parts[0] for member in unpacked.getmembers()}
            unpacked.extractall(into, filter="data")
    except (tarfile.TarError, OSError) as error:
        raise GitHubError(f"The tarball of {commit} could not be unpacked: {error}.") from error
    finally:
        archive.unlink(missing_ok=True)
    if len(roots) != 1:
        raise GitHubError(f"The tarball of {commit} has {len(roots)} top folders, not one.")
    return into / roots.pop()


@_expected
def contains(self, ancestor: str, commit: str) -> bool:
    """Whether `commit` has `ancestor` in its history: compare's status only, never its file
    list (which stops at 300 files)."""
    status = self._call("GET", f"/compare/{ancestor}...{commit}")["status"]
    return status in ("identical", "ahead")
```

(`import tarfile`, `from pathlib import Path`.) The `data` filter raises `tarfile.FilterError`
(a `TarError`) for each case in the parametrized test. In `fake_github.py`:

```python
trees: dict[str, Path] = field(default_factory=dict)  # a commit's content folder
ancestry: set[tuple[str, str]] = field(default_factory=set)  # (ancestor, commit) besides ==


def tarball(self, commit: str, into: Path) -> Path:
    self._step("tarball")
    root = into / f"repo-{commit}"
    shutil.copytree(self.trees[commit], root)
    return root


def contains(self, ancestor: str, commit: str) -> bool:
    self._step("contains")
    return ancestor == commit or (ancestor, commit) in self.ancestry
```

and in its `pull_state`, `merge_commit=f"merge-{number}" if number in self.merged else ""`.

- [x] **Step 4: Run them to verify they pass**

Run: `uv run pytest apps/api/tests/test_github_client.py -q && uv run mypy`
Expected: PASS; mypy clean.

- [x] **Step 5: Commit**

```bash
git add apps/api/src/code_api/studio/github.py apps/api/tests/fake_github.py apps/api/tests/test_github_client.py
git commit -m "feat(studio): the client reads tarballs, ancestry and merge commits — M4.7.1"
```

---

### Task 2: `landed`, and a landing's merge commit (M4.7.2)

**Files:**
- Modify: `apps/api/src/code_api/studio/models.py`, `apps/api/src/code_api/studio/log.py`,
  `apps/api/src/code_api/studio/api.py` (the list's `state` literal)
- Create: `apps/api/src/code_api/studio/migrations/0004_landed.py` (generated)
- Test: `apps/api/tests/test_landing_models.py`

**Interfaces:**
- Produces: `Draft.State.LANDED = "landed"` (not in `LIVE_STATES`);
  `DraftEvent.Kind.LANDED = "landed"`; `AFTER[LANDED] = landed`;
  `Landing.merge_commit = models.TextField(blank=True)`; the drafts list accepts
  `?state=landed`.

- [x] **Step 1: Write the failing tests** — append to `apps/api/tests/test_landing_models.py`:

```python
def test_a_landed_draft_frees_its_node(otto: User) -> None:
    draft = drafts.open_existing("tpm", by=otto)
    record(draft, DraftEvent.Kind.LANDED, by=None, revision=1)
    draft.state = "landed"
    draft.save(update_fields=["state"])
    assert replay(draft.events.order_by("id")) == "landed"
    assert drafts.open_existing("tpm", by=otto).state == "open"  # a new draft of the same node


def test_a_landing_has_a_merge_commit(otto: User) -> None:
    assert Landing.objects.create(started_by=otto).merge_commit == ""
```

- [x] **Step 2: Run them to verify they fail**

Run: `uv run pytest apps/api/tests/test_landing_models.py -q`
Expected: FAIL — `KeyError: 'landed'` in `replay`, and no `merge_commit`.

- [x] **Step 3: Implement** — `LANDED = "landed"` in `Draft.State` (after `APPROVED`) and in
  `DraftEvent.Kind`; in `Landing`, after `pull_url`:

```python
    # GitHub's merge commit, once merged: a build containing it lands the drafts (M4F.3).
    merge_commit = models.TextField(blank=True)
```

`Kind.LANDED: Draft.State.LANDED` in `log.AFTER`; `Literal["open", "submitted", "approved",
"landed"]` for the drafts list's `state`. Then
`uv run python apps/api/manage.py makemigrations studio --name landed`, and
`uv run ruff check --fix` on the migration.

- [x] **Step 4: Run them to verify they pass**

Run: `uv run pytest apps/api/tests/test_landing_models.py apps/api/tests/test_review_log.py apps/api/tests/test_drafts.py -q && uv run python apps/api/manage.py makemigrations --check --dry-run`
Expected: PASS; "No changes detected".

- [x] **Step 5: Commit**

```bash
git add apps/api/src/code_api/studio apps/api/tests/test_landing_models.py
git commit -m "feat(studio): landed drafts and a landing's merge commit — M4.7.2"
```

---

### Task 3: `follow(source)`: the reconciler and its sources (M4.7.3)

**Files:**
- Create: `apps/api/src/code_api/studio/follow.py`
- Test: `apps/api/tests/test_follow.py`, `apps/api/tests/test_follow_lock.py`

**Interfaces:**
- Consumes: `GitHub.head`, `tarball`, `contains` (Task 1); `rebuild_index`, `IndexBuild`.
- Produces, in `code_api.studio.follow`:
  - `class Source(Protocol)`: `head(self) -> str | None`;
    `checkout(self, head: str | None) -> AbstractContextManager[Path]`;
    `contains(self, ancestor: str, commit: str) -> bool`;
  - `FolderSource(path: Path, commit: str = "")` — `head()` is `commit or None`;
  - `GitHubSource(client: GitHub)`;
  - `configured_source() -> Source | None`;
  - `@dataclass(frozen=True) class Followed: build: IndexBuild | None; landed: int; skipped: bool`
    (`build` is the build this round made, `None` when nothing was built);
  - `follow(source: Source) -> Followed`;
  - `FOLLOW_LOCK = 5_172_032`; `MAIN_KEY = "studio:follow:main"` (cache: `{"head", "checked_at"}`).
- Task 4 fills step 3 (`landing.mark_landed`); here `landed` is always 0.

- [x] **Step 1: Write the failing tests** — `apps/api/tests/test_follow.py`:

```python
"""The index follows main (M4.7 spec, M4F.1–M4F.2). Needs Compose's Postgres."""

import shutil
from pathlib import Path
from typing import Any

import pytest
from django.core.cache import cache

from code_api.content.models import IndexBuild, Node
from code_api.studio import follow
from code_api.studio.follow import FolderSource, GitHubSource
from fake_github import FakeGitHub

pytestmark = pytest.mark.django_db

FIXTURES = Path(__file__).resolve().parents[3] / "tests" / "fixtures" / "salmon"


@pytest.fixture
def broken(tmp_path: Path) -> Path:
    copy = tmp_path / "broken"
    shutil.copytree(FIXTURES, copy)
    shutil.rmtree(copy / "statistics" / "em-algorithm")  # a needed node goes: refused
    return copy


def applied() -> list[str]:
    return list(
        IndexBuild.objects.filter(outcome="applied").order_by("id").values_list("commit", flat=True)
    )


def test_a_new_commit_on_main_is_indexed_with_its_commit() -> None:
    fake = FakeGitHub(main="c1", trees={"c1": FIXTURES})
    done = follow.follow(GitHubSource(fake))
    assert done.build is not None and done.build.commit == "c1"
    assert Node.objects.count() == 26
    assert cache.get(follow.MAIN_KEY)["head"] == "c1"


def test_following_the_same_head_again_builds_nothing() -> None:
    fake = FakeGitHub(main="c1", trees={"c1": FIXTURES})
    follow.follow(GitHubSource(fake))
    again = follow.follow(GitHubSource(fake))
    assert again.build is None and applied() == ["c1"]
    assert fake.calls.count("tarball") == 1


def test_a_refused_commit_leaves_the_old_index_and_is_not_retried(broken: Path) -> None:
    fake = FakeGitHub(main="c1", trees={"c1": FIXTURES, "c2": broken})
    follow.follow(GitHubSource(fake))
    fake.main = "c2"
    refused = follow.follow(GitHubSource(fake)).build
    assert refused is not None and refused.outcome == "refused"
    assert applied() == ["c1"] and Node.objects.count() == 26
    follow.follow(GitHubSource(fake))
    assert fake.calls.count("tarball") == 2  # c2 is not fetched again
    fake.main, fake.trees["c3"] = "c3", FIXTURES
    assert follow.follow(GitHubSource(fake)).build.commit == "c3"  # type: ignore[union-attr]


def test_a_build_from_another_folder_is_put_back_to_main(tmp_path: Path) -> None:
    fake = FakeGitHub(main="c1", trees={"c1": FIXTURES})
    follow.follow(GitHubSource(fake))
    follow.follow(FolderSource(FIXTURES))  # a stray manual rebuild: no commit
    assert applied() == ["c1", ""]
    back = follow.follow(GitHubSource(fake)).build
    assert back is not None and back.commit == "c1"


def test_a_folder_source_builds_every_round() -> None:
    follow.follow(FolderSource(FIXTURES))
    follow.follow(FolderSource(FIXTURES))
    assert applied() == ["", ""]


def test_a_github_error_mid_build_keeps_the_index_and_leaves_no_folder(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    from code_api.studio.github import GitHubError

    fake = FakeGitHub(main="c1", trees={"c1": FIXTURES})
    follow.follow(GitHubSource(fake))
    fake.main, fake.fail_with, fake.fail_on = "c2", "GitHub answered 502: Bad Gateway.", "tarball"
    monkeypatch.setattr(follow.tempfile, "tempdir", str(tmp_path))
    with pytest.raises(GitHubError):
        follow.follow(GitHubSource(fake))
    assert applied() == ["c1"] and list(tmp_path.iterdir()) == []


def test_the_configured_source_follows_the_settings(settings: Any, tmp_path: Path) -> None:
    settings.CODE_GITHUB_APP, settings.CODE_CONTENT_ROOT = None, None
    assert follow.configured_source() is None
    settings.CODE_CONTENT_ROOT = FIXTURES
    assert isinstance(follow.configured_source(), FolderSource)
    from code_api.config.landing import GitHubApp

    settings.CODE_GITHUB_APP = GitHubApp("1", "2", "k", "o/r", "http://127.0.0.1:9")
    assert isinstance(follow.configured_source(), GitHubSource)
```

and `apps/api/tests/test_follow_lock.py`:

```python
"""One follower at a time (M4F.1): a second round while one runs skips. Real transactions."""

import threading
from pathlib import Path

import pytest
from django.db import connection

from code_api.content.models import IndexBuild
from code_api.studio import follow
from code_api.studio.follow import FolderSource

FIXTURES = Path(__file__).resolve().parents[3] / "tests" / "fixtures" / "salmon"


@pytest.mark.django_db(transaction=True)
def test_a_second_follow_while_one_runs_skips() -> None:
    held, release = threading.Event(), threading.Event()

    def hold() -> None:
        with connection.cursor() as cursor:
            cursor.execute("SELECT pg_advisory_lock(%s)", [follow.FOLLOW_LOCK])
            held.set()
            release.wait(10)
            cursor.execute("SELECT pg_advisory_unlock(%s)", [follow.FOLLOW_LOCK])
        connection.close()

    holder = threading.Thread(target=hold)
    holder.start()
    held.wait(10)
    try:
        done = follow.follow(FolderSource(FIXTURES))
    finally:
        release.set()
        holder.join()
    assert done.skipped and IndexBuild.objects.count() == 0
    assert follow.follow(FolderSource(FIXTURES)).build is not None  # free again
```

- [x] **Step 2: Run them to verify they fail**

Run: `uv run pytest apps/api/tests/test_follow.py apps/api/tests/test_follow_lock.py -q`
Expected: FAIL — `ImportError: cannot import name 'follow' from 'code_api.studio'`.

- [x] **Step 3: Implement** — `apps/api/src/code_api/studio/follow.py`:

```python
"""The index follows the content repository's main (M4.7 spec, M4F.1–M4F.2).

One method, `follow(source)`, a reconciler: what should be (the source's head) against what is
(the live build's commit); build if they differ; then mark landed. Only where content comes from
varies: `GitHubSource` reads main through the app, `FolderSource` a local folder, and
`configured_source()` picks one from the settings. Each round is safe to repeat.
"""

import tempfile
from collections.abc import Iterator
from contextlib import AbstractContextManager, contextmanager
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

from django.conf import settings
from django.core.cache import cache
from django.db import connection
from django.utils import timezone

from code_api.content.index import rebuild_index
from code_api.content.models import IndexBuild
from code_api.studio import github
from code_api.studio.github import GitHub

FOLLOW_LOCK = 5_172_032
MAIN_KEY = "studio:follow:main"


class Source(Protocol):
    def head(self) -> str | None: ...
    def checkout(self, head: str | None) -> AbstractContextManager[Path]: ...
    def contains(self, ancestor: str, commit: str) -> bool: ...


@dataclass(frozen=True)
class FolderSource:
    """A local folder (a development stack, the tests). Its head is unknown unless given, so every
    round builds; nothing lands from it."""

    path: Path
    commit: str = ""

    def head(self) -> str | None:
        return self.commit or None

    @contextmanager
    def checkout(self, head: str | None) -> Iterator[Path]:
        yield self.path

    def contains(self, ancestor: str, commit: str) -> bool:
        return False


@dataclass(frozen=True)
class GitHubSource:
    """main on GitHub, through the app's client: a commit's tarball, unpacked to a temporary
    folder deleted afterwards."""

    client: GitHub

    def head(self) -> str | None:
        return self.client.head()

    @contextmanager
    def checkout(self, head: str | None) -> Iterator[Path]:
        assert head is not None
        with tempfile.TemporaryDirectory(prefix="code-follow-") as folder:
            yield self.client.tarball(head, Path(folder))

    def contains(self, ancestor: str, commit: str) -> bool:
        return self.client.contains(ancestor, commit)


def configured_source() -> Source | None:
    """The GitHub App when it is configured (M4.6), else CODE_CONTENT_ROOT, else none."""
    client = github.from_settings()
    if client is not None:
        return GitHubSource(client)
    root: Path | None = settings.CODE_CONTENT_ROOT
    return None if root is None else FolderSource(root)


@dataclass(frozen=True)
class Followed:
    build: IndexBuild | None  # the build this round made; None when nothing was built
    landed: int
    skipped: bool = False  # another follower held the lock


def _live() -> IndexBuild | None:
    return IndexBuild.objects.filter(outcome=IndexBuild.Outcome.APPLIED).order_by("-id").first()


def _refused_before(head: str) -> bool:
    last = IndexBuild.objects.filter(commit=head).order_by("-id").first()
    return last is not None and last.outcome == IndexBuild.Outcome.REFUSED


def follow(source: Source) -> Followed:
    with connection.cursor() as cursor:
        cursor.execute("SELECT pg_try_advisory_lock(%s)", [FOLLOW_LOCK])
        if not cursor.fetchone()[0]:
            return Followed(build=None, landed=0, skipped=True)
    try:
        return _round(source)
    finally:
        with connection.cursor() as cursor:
            cursor.execute("SELECT pg_advisory_unlock(%s)", [FOLLOW_LOCK])


def _round(source: Source) -> Followed:
    want = source.head()
    if want is not None:
        cache.set(MAIN_KEY, {"head": want, "checked_at": timezone.now().isoformat()}, None)
    live = _live()
    built: IndexBuild | None = None
    stale = want is None or live is None or live.commit != want
    if stale and not (want is not None and _refused_before(want)):
        with source.checkout(want) as folder:
            built = rebuild_index(folder, commit=want or "")
    return Followed(build=built, landed=0)
```

- [x] **Step 4: Run them to verify they pass**

Run: `uv run pytest apps/api/tests/test_follow.py apps/api/tests/test_follow_lock.py -q && uv run mypy`
Expected: PASS; mypy clean.

- [x] **Step 5: Watch the lock guard fail**: make `follow` skip the try-lock (call `_round`
  directly), run `test_follow_lock.py` — Expected: FAIL (a build is made while the lock is held).
  Restore; PASS.

- [x] **Step 6: Commit**

```bash
git add apps/api/src/code_api/studio/follow.py apps/api/tests/test_follow.py apps/api/tests/test_follow_lock.py
git commit -m "feat(studio): follow(source), the index follows main — M4.7.3"
```

---

### Task 4: Landed: the merge recorded, the drafts marked (M4.7.4)

**Files:**
- Modify: `apps/api/src/code_api/studio/landing.py` (`watch`, `close`, `mark_landed`),
  `apps/api/src/code_api/studio/follow.py` (step 3)
- Test: `apps/api/tests/test_follow_landed.py`

**Interfaces:**
- Consumes: `PullState.merge_commit`, `Source.contains`, `Draft.State.LANDED`.
- Produces, in `code_api.studio.landing`: `mark_landed(commit: str, contains: Callable[[str, str],
  bool]) -> int` — the number of drafts marked; `watch` and `close` record `merge_commit` when
  they see a merge and queue `tasks.follow_main` on commit.

- [x] **Step 1: Write the failing tests** — `apps/api/tests/test_follow_landed.py`:

```python
"""Drafts become landed once the live build contains their landing's merge (M4F.3)."""

import shutil
from pathlib import Path
from typing import Any

import pytest

from code_api.accounts.models import User
from code_api.content.index import rebuild_index
from code_api.studio import drafts, follow, landing
from code_api.studio.follow import GitHubSource
from code_api.studio.log import history, record
from code_api.studio.models import Draft, DraftEvent, Landing
from fake_github import FakeGitHub

pytestmark = pytest.mark.django_db

FIXTURES = Path(__file__).resolve().parents[3] / "tests" / "fixtures" / "salmon"


@pytest.fixture
def merged(
    otto: User, settings: Any, monkeypatch: pytest.MonkeyPatch
) -> tuple[Landing, FakeGitHub]:
    """salmon's draft, landed and merged as merge-1; main is c0, indexed."""
    queued: list[str] = []
    monkeypatch.setattr("code_api.studio.tasks.land.delay", lambda public_id: None)
    monkeypatch.setattr("code_api.studio.tasks.follow_main.delay", lambda: queued.append("follow"))
    settings.CODE_GITHUB_APP = object()
    fake = FakeGitHub(main="c0", trees={"c0": FIXTURES})
    follow.follow(GitHubSource(fake))
    draft = drafts.open_existing("salmon", by=otto)
    Draft.objects.filter(pk=draft.pk).update(state=Draft.State.APPROVED)
    record(draft, DraftEvent.Kind.APPROVED, by=otto, revision=1, reason="r", self_approved=True)
    made = landing.run(landing.start([draft.public_id], by=otto), fake)
    fake.merged.add(made.pull_number or 0)
    watched = landing.watch(made, fake)
    assert watched.merge_commit == "merge-1"
    return watched, fake


def test_a_merge_queues_a_follow(
    otto: User,
    settings: Any,
    monkeypatch: pytest.MonkeyPatch,
    django_capture_on_commit_callbacks: Any,
) -> None:
    queued: list[str] = []
    monkeypatch.setattr("code_api.studio.tasks.land.delay", lambda public_id: None)
    monkeypatch.setattr("code_api.studio.tasks.follow_main.delay", lambda: queued.append("follow"))
    settings.CODE_GITHUB_APP = object()
    rebuild_index(FIXTURES, commit="c0")
    draft = drafts.open_existing("salmon", by=otto)
    Draft.objects.filter(pk=draft.pk).update(state=Draft.State.APPROVED)
    record(draft, DraftEvent.Kind.APPROVED, by=otto, revision=1, reason="r", self_approved=True)
    fake = FakeGitHub()
    made = landing.run(landing.start([draft.public_id], by=otto), fake)
    fake.merged.add(made.pull_number or 0)
    with django_capture_on_commit_callbacks(execute=True):
        landing.watch(made, fake)
    assert queued == ["follow"]


def test_drafts_land_once_the_live_build_contains_the_merge(
    merged: tuple[Landing, FakeGitHub],
) -> None:
    made, fake = merged
    fake.main, fake.trees["c1"] = "c1", FIXTURES
    fake.ancestry.add(("merge-1", "c1"))
    done = follow.follow(GitHubSource(fake))
    assert done.landed == 1
    draft = Draft.objects.get(node_id="salmon", state="landed")
    assert history(draft)[-1].kind == "landed"
    assert not made.entries.filter(live=True).exists()
    assert drafts.open_existing("salmon", by=draft.created_by).state == "open"  # type: ignore[arg-type]


def test_a_refused_build_lands_nothing(merged: tuple[Landing, FakeGitHub], tmp_path: Path) -> None:
    made, fake = merged
    broken = tmp_path / "broken"
    shutil.copytree(FIXTURES, broken)
    shutil.rmtree(broken / "statistics" / "em-algorithm")
    fake.main, fake.trees["c1"] = "c1", broken
    fake.ancestry.add(("merge-1", "c1"))
    assert follow.follow(GitHubSource(fake)).landed == 0
    assert Draft.objects.get(node_id="salmon").state == "approved"
    assert made.entries.filter(live=True).count() == 1


def test_landing_is_safe_to_repeat(merged: tuple[Landing, FakeGitHub]) -> None:
    _, fake = merged
    fake.main, fake.trees["c1"] = "c1", FIXTURES
    fake.ancestry.add(("merge-1", "c1"))
    assert follow.follow(GitHubSource(fake)).landed == 1
    assert follow.follow(GitHubSource(fake)).landed == 0
    assert DraftEvent.objects.filter(kind="landed").count() == 1


def test_a_landing_merged_through_close_records_its_merge(
    otto: User, settings: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr("code_api.studio.tasks.land.delay", lambda public_id: None)
    monkeypatch.setattr("code_api.studio.tasks.follow_main.delay", lambda: None)
    settings.CODE_GITHUB_APP = object()
    rebuild_index(FIXTURES, commit="c0")
    draft = drafts.open_existing("salmon", by=otto)
    Draft.objects.filter(pk=draft.pk).update(state=Draft.State.APPROVED)
    record(draft, DraftEvent.Kind.APPROVED, by=otto, revision=1, reason="r", self_approved=True)
    fake = FakeGitHub()
    made = landing.run(landing.start([draft.public_id], by=otto), fake)
    fake.checks[made.pull_number or 0] = (("validate", "https://ci.test/1"),)
    landing.watch(made, fake)
    fake.checks.clear()
    fake.merged.add(made.pull_number or 0)
    with pytest.raises(landing.NotFailed):
        landing.close(Landing.objects.get(pk=made.pk), fake)
    assert Landing.objects.get(pk=made.pk).merge_commit == "merge-1"
```

- [x] **Step 2: Run them to verify they fail**

Run: `uv run pytest apps/api/tests/test_follow_landed.py -q`
Expected: FAIL — `merge_commit == ""`, and `tasks.follow_main` does not exist.

- [x] **Step 3: Implement** — in `landing.py`:

```python
def _merged(locked: Landing, merge_commit: str) -> None:
    """Record a merge and ask the follower to look at main now (M4F.4)."""
    locked.state, locked.reason, locked.merge_commit = Landing.State.MERGED, "", merge_commit
    locked.save(update_fields=["state", "reason", "merge_commit"])
    transaction.on_commit(_follow_now)


def _follow_now() -> None:
    from code_api.studio import tasks  # the tasks module imports this one

    tasks.follow_main.delay()


def mark_landed(commit: str, contains: Callable[[str, str], bool]) -> int:
    """Every merged landing whose merge commit `commit` contains: its held drafts become landed,
    and it lets them go (M4F.3). Safe to repeat: a landed draft is no longer held."""
    count = 0
    held = Landing.objects.filter(state=Landing.State.MERGED, entries__live=True).exclude(
        merge_commit=""
    )
    for made in held.distinct():
        if not contains(made.merge_commit, commit):
            continue
        with transaction.atomic():
            for entry in made.entries.filter(live=True).select_related("draft"):
                draft = Draft.objects.select_for_update().get(pk=entry.draft.pk)
                draft.state = Draft.State.LANDED
                draft.save(update_fields=["state"])
                record(
                    draft,
                    DraftEvent.Kind.LANDED,
                    by=None,
                    revision=entry.revision,
                    reason=f"in the index at {commit[:12]}",
                    landing=made,
                )
                count += 1
            made.entries.filter(live=True).update(live=False)
    return count
```

In `watch`, replace `locked.state, locked.reason = Landing.State.MERGED, ""` with
`_merged(locked, found.merge_commit)` followed by `return locked` (it saves itself). In `close`,
replace the merged branch's two lines with `_merged(locked, found.merge_commit)`. In
`follow._round`, before the return:

```python
    live = _live()
    landed = 0 if live is None or not live.commit else landing.mark_landed(live.commit, source.contains)
    return Followed(build=built, landed=landed)
```

(`from code_api.studio import github, landing` in `follow.py`; `from collections.abc import
Callable` in `landing.py`.) In `tasks.py`:

```python
@shared_task(name="code_api.studio.tasks.follow_main")
def follow_main() -> None:
    source = follow.configured_source()
    if source is not None:
        follow.follow(source)
```

(`from code_api.studio import follow, github, landing`.)

- [x] **Step 4: Run them to verify they pass**

Run: `uv run pytest apps/api/tests/test_follow_landed.py apps/api/tests/test_follow.py apps/api/tests/test_landing_watch.py apps/api/tests/test_landing_run.py -q && uv run mypy`
Expected: PASS; mypy clean.

- [x] **Step 5: Commit**

```bash
git add apps/api/src/code_api/studio apps/api/tests/test_follow_landed.py
git commit -m "feat(studio): drafts land once the live build contains their merge — M4.7.4"
```

**Checkpoint:** a fresh reviewer reads the branch so far, with this plan's Review Focus; findings in
a sub-issue of #125, Critical and Important fixed test-first before Task 5.

---

### Task 5: The command wraps `follow`, and beat follows (M4.7.5)

**Files:**
- Move: `apps/api/src/code_api/content/management/commands/rebuild_index.py` →
  `apps/api/src/code_api/studio/management/commands/rebuild_index.py` (create
  `studio/management/__init__.py` and `studio/management/commands/__init__.py`; delete the
  content app's `management/` package if nothing else is in it)
- Modify: `apps/api/src/code_api/config/settings.py` (beat), `apps/api/tests/test_rebuild_command.py`
- Test: `apps/api/tests/test_rebuild_command.py`, `apps/api/tests/test_follow.py`

**Interfaces:**
- Consumes: `follow`, `FolderSource`, `configured_source` (Task 3).
- Produces: `CELERY_BEAT_SCHEDULE["studio-follow-main"]` every `FOLLOW_SECONDS = 300`.

- [x] **Step 1: Write the failing tests** — append to `test_rebuild_command.py`:

```python
def test_the_command_follows_the_configured_source(settings: Settings) -> None:
    # No --root: the command is follow(configured_source()) — here the folder setting.
    settings.CODE_GITHUB_APP, settings.CODE_CONTENT_ROOT = None, FIXTURES
    run()
    assert IndexBuild.objects.get().outcome == "applied"


def test_the_command_lives_beside_follow() -> None:
    from django.core.management import get_commands

    assert get_commands()["rebuild_index"] == "code_api.studio"
```

and to `test_follow.py`:

```python
def test_beat_follows_main_every_five_minutes(settings: Any) -> None:
    entry = settings.CELERY_BEAT_SCHEDULE["studio-follow-main"]
    assert (entry["task"], entry["schedule"]) == ("code_api.studio.tasks.follow_main", 300)
```

- [x] **Step 2: Run them to verify they fail**

Run: `uv run pytest apps/api/tests/test_rebuild_command.py apps/api/tests/test_follow.py -q`
Expected: FAIL — the command is `code_api.content`'s; no beat entry.

- [x] **Step 3: Implement** — `git mv` the command into the studio app and make its `handle`:

```python
def handle(self, *args: Any, **options: Any) -> None:
    root: Path | None = options["root"]
    if root is not None and not root.is_dir():
        raise CommandError(f"CA0005 {root} is not a folder", returncode=2)
    source = FolderSource(root, options["commit"]) if root else configured_source()
    if source is None:
        raise CommandError("CA0004 set CODE_CONTENT_ROOT or pass --root", returncode=2)
    if isinstance(source, FolderSource) and not source.path.is_dir():
        raise CommandError(f"CA0005 {source.path} is not a folder", returncode=2)
    done = follow(source)
    build = done.build
    if build is None:
        self.stdout.write(
            "Up to date: the index is at main's head."
            if not done.skipped
            else "Skipped: another follower is running."
        )
        return
    if build.outcome == IndexBuild.Outcome.REFUSED:
        self.stderr.write(f"CA0006 Refused: {len(build.problems)} problems")
        for problem in build.problems:
            self.stderr.write(problem)
        raise SystemExit(1)
    self.stdout.write(f"Applied: {build.node_count} nodes, digest {build.digest[:12]}")
```

with its docstring saying it is `follow` over `--root` (with `--commit`) or the configured source
(M4F.2), and imports from `code_api.studio.follow`. In `settings.py`, beside
`WATCH_LANDINGS_SECONDS`: `FOLLOW_SECONDS = 300  # between looks at main (M4F.4)` and the beat entry
`"studio-follow-main": {"task": "code_api.studio.tasks.follow_main", "schedule": FOLLOW_SECONDS}`.

- [x] **Step 4: Run them to verify they pass**

Run: `uv run pytest apps/api/tests/test_rebuild_command.py apps/api/tests/test_follow.py -q && uv run mypy`
Expected: PASS, every earlier command test unchanged and green.

- [x] **Step 5: Commit**

```bash
git add -A apps/api
git commit -m "feat(studio): rebuild_index wraps follow, and beat follows main — M4.7.5"
```

---

### Task 6: `GET /api/studio/index` (M4.7.6)

**Files:**
- Create: `apps/api/src/code_api/studio/index_api.py`
- Modify: `apps/api/src/code_api/api.py`, `apps/api/src/code_api/studio/schemas.py`,
  `apps/api/openapi.json`, `apps/web/src/api/schema.ts`
- Test: `apps/api/tests/test_index_api.py`

**Interfaces:**
- Produces: `BuildOut` (`commit`, `digest`, `outcome`, `node_count`, `created_at`, `problems`) and
  `IndexOut` (`live: BuildOut | None`, `latest: BuildOut | None`, `main_head: str | None`,
  `checked_at: datetime | None`, `behind: bool`); router at `/api/studio/index`,
  `studio(Role.AUTHOR)`.

- [x] **Step 1: Write the failing tests** — `apps/api/tests/test_index_api.py`:

```python
"""What the team sees of the index (M4F.5). Needs Compose's Postgres."""

import shutil
from pathlib import Path

import pytest
from django.test import Client

from code_api.accounts.models import User
from code_api.studio import follow
from code_api.studio.follow import GitHubSource
from fake_github import FakeGitHub

pytestmark = pytest.mark.django_db

FIXTURES = Path(__file__).resolve().parents[3] / "tests" / "fixtures" / "salmon"


def signed_in(user: User) -> Client:
    client = Client()
    client.force_login(user)
    return client


def test_the_index_route_reports_the_live_build_and_main(ada: User) -> None:
    follow.follow(GitHubSource(FakeGitHub(main="c1", trees={"c1": FIXTURES})))
    body = signed_in(ada).get("/api/studio/index").json()
    assert body["live"]["commit"] == "c1" and body["live"]["node_count"] == 26
    assert (body["main_head"], body["behind"]) == ("c1", False)


def test_a_refused_head_shows_its_problems_and_behind(ada: User, tmp_path: Path) -> None:
    broken = tmp_path / "broken"
    shutil.copytree(FIXTURES, broken)
    shutil.rmtree(broken / "statistics" / "em-algorithm")
    fake = FakeGitHub(main="c1", trees={"c1": FIXTURES, "c2": broken})
    follow.follow(GitHubSource(fake))
    fake.main = "c2"
    follow.follow(GitHubSource(fake))
    body = signed_in(ada).get("/api/studio/index").json()
    assert body["live"]["commit"] == "c1"
    assert body["latest"]["outcome"] == "refused" and body["latest"]["problems"]
    assert (body["main_head"], body["behind"]) == ("c2", True)


def test_an_empty_index_answers_with_nothing(ada: User) -> None:
    body = signed_in(ada).get("/api/studio/index").json()
    assert body == {
        "live": None,
        "latest": None,
        "main_head": None,
        "checked_at": None,
        "behind": False,
    }


def test_the_index_route_is_the_teams(client: Client) -> None:
    assert client.get("/api/studio/index").json()["code"] == "CA0101"
```

- [x] **Step 2: Run them to verify they fail**

Run: `uv run pytest apps/api/tests/test_index_api.py -q`
Expected: FAIL — 404.

- [x] **Step 3: Implement** — schemas in `studio/schemas.py`:

```python
class BuildOut(Schema):
    commit: str
    digest: str
    outcome: str
    node_count: int
    created_at: datetime
    problems: list[str]


class IndexOut(Schema):
    live: BuildOut | None
    latest: BuildOut | None
    main_head: str | None
    checked_at: datetime | None
    behind: bool
```

and `studio/index_api.py`:

```python
"""What the team sees of the index (M4.7 spec, M4F.5): the live build, the latest attempt with
its problems, and main's last-seen head. Asks GitHub nothing: the follower writes the head."""

from datetime import datetime

from django.core.cache import cache
from django.http import HttpRequest
from ninja import Router

from code_api.accounts.access import studio
from code_api.accounts.roles import Role
from code_api.content.models import IndexBuild
from code_api.studio.follow import MAIN_KEY
from code_api.studio.schemas import BuildOut, IndexOut

router = Router(tags=["studio"], auth=studio(Role.AUTHOR))


def _out(build: IndexBuild | None) -> BuildOut | None:
    if build is None:
        return None
    return BuildOut(
        commit=build.commit,
        digest=build.digest,
        outcome=build.outcome,
        node_count=build.node_count,
        created_at=build.created_at,
        problems=list(build.problems),
    )


@router.get("", response=IndexOut, summary="The index and main")
def index(request: HttpRequest) -> IndexOut:
    live = IndexBuild.objects.filter(outcome=IndexBuild.Outcome.APPLIED).order_by("-id").first()
    latest = IndexBuild.objects.order_by("-id").first()
    seen = cache.get(MAIN_KEY) or {}
    head = seen.get("head")
    checked = seen.get("checked_at")
    return IndexOut(
        live=_out(live),
        latest=_out(latest),
        main_head=head,
        checked_at=None if checked is None else datetime.fromisoformat(checked),
        behind=head is not None and (live is None or live.commit != head),
    )
```

Mount it in `code_api/api.py`: `api.add_router("/studio/index", index_router)`. Regenerate
`openapi.json` and the web's types (in `node:24-alpine`, `npm ci` then `npm run api-types`).

- [x] **Step 4: Run them to verify they pass**

Run: `uv run pytest apps/api/tests/test_index_api.py apps/api/tests/test_openapi_and_docs.py -q && uv run mypy`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add apps/api apps/web/src/api/schema.ts
git commit -m "feat(studio): GET /api/studio/index, the index and main — M4.7.6"
```

---

### Task 7: The whole suite with CI's env, and the web's checks (M4.7.7)

- [x] **Step 1:** run every check CI runs (the suite with CI's env to a file, ruff, format, mypy,
  `check`, `makemigrations --check`, and the web's lint, typecheck, test and build in
  `node:24-alpine`); every exit code 0, read from the file, never through a pipe.
- [x] **Step 2:** commit any fix with its own test, citing its sub-issue.

---

### Task 8: Docs, the journal, and the pull request (M4.7.8)

- [x] **Step 1:** `CLAUDE.md`'s layout line: the content app's `rebuild_index` moves to studio;
  add "follow.py: the index follows main (a reconciler over a GitHub or folder source)".
- [x] **Step 2:** the spec's **Notes from the build**, for every ruling taken.
- [x] **Step 3:** #125's check reworded (M4F.6).
- [x] **Step 4:** the journal entry.
- [x] **Step 5:** the final whole-branch review (fresh reviewer, most capable model, this plan's
  Review Focus); findings in a sub-issue of #125, Critical and Important fixed test-first.
- [ ] **Step 6:** push, open the pull request (closing #125 and its sub-issues, **one `Closes`
  keyword per issue**), watch CI without blocking, and report. Merge only on the operator's yes.
