"""A fake of the GitHub API behind Studio's client (M4.6 spec, M4L.7): commits, branches and pull
requests in memory. Tests set `files` on `main`, then read what a landing made."""

from dataclasses import dataclass, field

from code_api.studio.github import GitHubError, Pull, PullState


@dataclass
class FakeGitHub:
    files: dict[str, str] = field(default_factory=dict)  # main's files, by path
    main: str = "main-0"
    # The paths changed on main since a commit: {commit: paths}; a commit not here changed nothing.
    since: dict[str, set[str]] = field(default_factory=dict)
    fail_with: str | None = None
    fail_on: str | None = None  # the one method that fails, when set with fail_with
    commits: dict[str, tuple[str, dict[str, str | None], str]] = field(default_factory=dict)
    branches: dict[str, str] = field(default_factory=dict)
    pulls: dict[int, tuple[str, str, str]] = field(default_factory=dict)  # branch, title, body
    auto_merged: set[int] = field(default_factory=set)
    merged: set[int] = field(default_factory=set)
    checks: dict[int, tuple[tuple[str, str], ...]] = field(default_factory=dict)
    conflicts: set[int] = field(default_factory=set)
    closed: set[int] = field(default_factory=set)
    calls: list[str] = field(default_factory=list)

    def _step(self, name: str) -> None:
        self.calls.append(name)
        if self.fail_with is not None and self.fail_on in (None, name):
            raise GitHubError(self.fail_with)

    def head(self) -> str:
        self._step("head")
        return self.main

    def changed(self, base: str, head: str) -> set[str]:
        self._step("changed")
        return set(self.since.get(base, set()))

    def exists(self, path: str, ref: str) -> bool:
        self._step("exists")
        return any(each == path or each.startswith(f"{path}/") for each in self.files)

    def commit(self, *, parent: str, files: dict[str, str | None], message: str) -> str:
        self._step("commit")
        for path, text in files.items():
            if text is None and path not in self.files:
                raise GitHubError(f"GitHub answered 422: {path} is not in the tree.")
        sha = f"commit-{len(self.commits) + 1}"
        self.commits[sha] = (parent, dict(files), message)
        return sha

    def branch(self, name: str, sha: str) -> None:
        self._step("branch")
        if name in self.branches:
            raise GitHubError("GitHub answered 422: Reference already exists.")
        self.branches[name] = sha

    def delete_branch(self, name: str) -> None:
        self._step("delete_branch")
        self.branches.pop(name, None)

    def open_pull(self, *, branch: str, title: str, body: str) -> Pull:
        self._step("open_pull")
        number = len(self.pulls) + 1
        self.pulls[number] = (branch, title, body)
        return Pull(number=number, url=f"https://github.test/pull/{number}", node_id=f"PR_{number}")

    def auto_merge(self, pull: Pull) -> None:
        self._step("auto_merge")
        self.auto_merged.add(pull.number)

    def pull_state(self, number: int) -> PullState:
        self._step("pull_state")
        return PullState(
            merged=number in self.merged,
            closed=number in self.closed and number not in self.merged,
            conflict=number in self.conflicts,
            failed=self.checks.get(number, ()),
        )

    def close_pull(self, number: int) -> None:
        self._step("close_pull")
        self.closed.add(number)
