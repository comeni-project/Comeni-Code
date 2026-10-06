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
