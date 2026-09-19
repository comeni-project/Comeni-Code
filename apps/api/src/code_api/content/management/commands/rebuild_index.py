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
