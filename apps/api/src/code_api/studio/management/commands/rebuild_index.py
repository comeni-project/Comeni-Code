"""manage.py rebuild_index: follow(source) once (M4.7 spec, M4F.2; M1 part 6 spec, M1P6.2).

The source is --root (with --commit), else the configured one: the GitHub App's main, else
CODE_CONTENT_ROOT. The command adds no logic of its own. Exit 0 when the build is applied (or the
index is already at main's head), 1 when it is refused (the validator's messages on stderr, the
old index kept), 2 when it cannot start.
"""

from pathlib import Path
from typing import Any

from django.core.management.base import BaseCommand, CommandError, CommandParser

from code_api.content.models import IndexBuild
from code_api.studio.follow import FolderSource, configured_source, follow
from code_api.studio.github import GitHubError


class Command(BaseCommand):
    help = "Follow the content source once: --root (a folder), else the configured source."

    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument("--root", type=Path, help="the content folder")
        parser.add_argument("--commit", default="", help="the content commit, kept on the build")

    def handle(self, *args: Any, **options: Any) -> None:
        root: Path | None = options["root"]
        if root is not None and not root.is_dir():
            raise CommandError(f"CA0005 {root} is not a folder", returncode=2)
        source = FolderSource(root, options["commit"]) if root else configured_source()
        if source is None:
            raise CommandError("CA0004 set CODE_CONTENT_ROOT or pass --root", returncode=2)
        if isinstance(source, FolderSource) and not source.path.is_dir():
            raise CommandError(f"CA0005 {source.path} is not a folder", returncode=2)
        try:
            done = follow(source)
        except GitHubError as error:
            # Cannot start: the source could not be read. Never refusal's exit 1 (the final review).
            raise CommandError(f"CA0007 {error}", returncode=2) from error
        build = done.build
        if build is None:
            self.stdout.write(
                "Nothing built: the index is at the source's head, or that head was refused before."
                if not done.skipped
                else "Skipped: another follower is running."
            )
            return
        if build.outcome == IndexBuild.Outcome.REFUSED:
            self.stderr.write(f"CA0006 Refused: {len(build.problems)} problems")
            for problem in build.problems:
                self.stderr.write(problem)
            # A refusal is an outcome, not a misuse: exit 1 without CommandError's prefix.
            raise SystemExit(1)
        self.stdout.write(f"Applied: {build.node_count} nodes, digest {build.digest[:12]}")
