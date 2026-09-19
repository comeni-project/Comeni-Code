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
from pytest_django import Settings

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


def test_the_setting_is_used_and_root_wins(settings: Settings, tmp_path: Path) -> None:
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


def test_no_folder_exits_2(settings: Settings) -> None:
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
