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
from code_api.studio import github, landing
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


def _last_good() -> str | None:
    """The commit of the latest applied build that came from a commit, if any."""
    build = (
        IndexBuild.objects.filter(outcome=IndexBuild.Outcome.APPLIED)
        .exclude(commit="")
        .order_by("-id")
        .first()
    )
    return None if build is None else build.commit


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
    if stale and want is not None and _refused_before(want):
        # main's head was refused: keep main's last good build live, never another folder's.
        want = _last_good()
        stale = want is not None and live is not None and live.commit != want
    if stale:
        with source.checkout(want) as folder:
            built = rebuild_index(folder, commit=want or "")
    live = _live()
    landed = (
        0 if live is None or not live.commit else landing.mark_landed(live.commit, source.contains)
    )
    return Followed(build=built, landed=landed)
