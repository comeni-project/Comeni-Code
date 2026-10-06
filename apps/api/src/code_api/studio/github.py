"""Studio's GitHub client (M4.6 spec, M4L.2, M4L.4): the few calls a landing makes, as the app.

No checkout: a commit is a tree built on `main`'s, through the Git Data API. The app signs a JWT
with its key and trades it for an installation token, kept until shortly before it expires. Every
call has a timeout, and every failure is a `GitHubError` whose message is a sentence.
"""

import threading
import time
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Protocol

import jwt
import requests
from django.conf import settings

from code_api.config.landing import GitHubApp

TIMEOUT: float = 10
API_VERSION = "2022-11-28"
_EARLY = 300  # a token is renewed five minutes before it expires


class GitHubError(Exception):
    """A step GitHub did not complete; the message is a sentence."""


@dataclass(frozen=True)
class Pull:
    number: int
    url: str
    node_id: str


@dataclass(frozen=True)
class PullState:
    merged: bool
    closed: bool
    conflict: bool
    failed: tuple[tuple[str, str], ...]  # each failed check's name and link


class GitHub(Protocol):
    def head(self) -> str: ...
    def changed(self, base: str, head: str) -> set[str]: ...
    def exists(self, path: str, ref: str) -> bool: ...
    def commit(self, *, parent: str, files: dict[str, str | None], message: str) -> str: ...
    def branch(self, name: str, sha: str) -> None: ...
    def delete_branch(self, name: str) -> None: ...
    def open_pull(self, *, branch: str, title: str, body: str) -> Pull: ...
    def auto_merge(self, pull: Pull) -> None: ...
    def pull_state(self, number: int) -> PullState: ...
    def close_pull(self, number: int) -> None: ...


_tokens: dict[str, tuple[str, float]] = {}
_tokens_lock = threading.Lock()


def forget_tokens() -> None:
    """For tests: the next call trades for a new token."""
    with _tokens_lock:
        _tokens.clear()


FAILED = {"failure", "timed_out", "cancelled", "action_required", "startup_failure"}


class Client:
    def __init__(self, app: GitHubApp) -> None:
        self.app = app
        self.repo = f"{app.api_url}/repos/{app.repository}"

    # ── transport ──────────────────────────────────────────────────────────────────────────────

    def _send(self, method: str, url: str, token: str, body: object = None) -> Any:
        try:
            answer = requests.request(
                method,
                url,
                json=body,
                timeout=TIMEOUT,
                headers={
                    "Authorization": f"Bearer {token}",
                    "Accept": "application/vnd.github+json",
                    "X-GitHub-Api-Version": API_VERSION,
                },
            )
        except requests.Timeout as error:
            raise GitHubError(f"GitHub did not answer within {TIMEOUT} seconds.") from error
        except requests.RequestException as error:
            raise GitHubError(f"GitHub could not be reached: {error}.") from error
        if answer.status_code == 204:
            return None
        try:
            data = answer.json()
        except ValueError:
            data = {}
        if answer.status_code >= 400:
            message = str(data.get("message") or answer.reason).rstrip(".")
            raise GitHubError(f"GitHub answered {answer.status_code}: {message}.")
        return data

    def _token(self) -> str:
        with _tokens_lock:
            kept = _tokens.get(self.app.installation_id)
            if kept is not None and kept[1] - _EARLY > time.time():
                return kept[0]
            now = int(time.time())
            signed = jwt.encode(
                {"iat": now - 60, "exp": now + 540, "iss": self.app.app_id},
                self.app.private_key,
                algorithm="RS256",
            )
            url = f"{self.app.api_url}/app/installations/{self.app.installation_id}/access_tokens"
            data = self._send("POST", url, signed)
            expires = datetime.fromisoformat(data["expires_at"]).timestamp()
            _tokens[self.app.installation_id] = (data["token"], expires)
            return str(data["token"])

    def _call(self, method: str, path: str, body: object = None) -> Any:
        return self._send(method, f"{self.repo}{path}", self._token(), body)

    # ── the calls a landing makes ───────────────────────────────────────────────────────────────

    def head(self) -> str:
        return str(self._call("GET", "/git/ref/heads/main")["object"]["sha"])

    def changed(self, base: str, head: str) -> set[str]:
        paths: set[str] = set()
        page = 1
        while True:
            data = self._call("GET", f"/compare/{base}...{head}?per_page=100&page={page}")
            files = data.get("files") or []
            for each in files:
                paths.add(each["filename"])
                if each.get("previous_filename"):
                    paths.add(each["previous_filename"])
            if len(files) < 100:
                return paths
            page += 1

    def exists(self, path: str, ref: str) -> bool:
        try:
            self._call("GET", f"/contents/{path}?ref={ref}")
        except GitHubError as error:
            if "answered 404" in str(error):
                return False
            raise
        return True

    def commit(self, *, parent: str, files: dict[str, str | None], message: str) -> str:
        base_tree = self._call("GET", f"/git/commits/{parent}")["tree"]["sha"]
        entries: list[dict[str, object]] = []
        for path, text in sorted(files.items()):
            entry: dict[str, object] = {"path": path, "mode": "100644", "type": "blob"}
            entry.update({"sha": None} if text is None else {"content": text})
            entries.append(entry)
        tree = self._call("POST", "/git/trees", {"base_tree": base_tree, "tree": entries})
        made = self._call(
            "POST", "/git/commits", {"message": message, "tree": tree["sha"], "parents": [parent]}
        )
        return str(made["sha"])

    def branch(self, name: str, sha: str) -> None:
        self._call("POST", "/git/refs", {"ref": f"refs/heads/{name}", "sha": sha})

    def delete_branch(self, name: str) -> None:
        self._call("DELETE", f"/git/refs/heads/{name}")

    def open_pull(self, *, branch: str, title: str, body: str) -> Pull:
        data = self._call(
            "POST", "/pulls", {"title": title, "body": body, "head": branch, "base": "main"}
        )
        return Pull(number=int(data["number"]), url=str(data["html_url"]), node_id=data["node_id"])

    def auto_merge(self, pull: Pull) -> None:
        query = (
            "mutation($id: ID!) { enablePullRequestAutoMerge("
            "input: {pullRequestId: $id, mergeMethod: SQUASH}) { clientMutationId } }"
        )
        data = self._send(
            "POST",
            f"{self.app.api_url}/graphql",
            self._token(),
            {"query": query, "variables": {"id": pull.node_id}},
        )
        if data.get("errors"):
            message = str(data["errors"][0].get("message", "an error")).rstrip(".")
            raise GitHubError(f"GitHub did not turn on auto-merge: {message}.")

    def pull_state(self, number: int) -> PullState:
        pull = self._call("GET", f"/pulls/{number}")
        runs = self._call("GET", f"/commits/{pull['head']['sha']}/check-runs?per_page=100")
        failed = tuple(
            (run["name"], run["html_url"])
            for run in runs.get("check_runs", [])
            if run.get("conclusion") in FAILED
        )
        return PullState(
            merged=bool(pull["merged"]),
            closed=pull["state"] == "closed" and not pull["merged"],
            conflict=pull.get("mergeable") is False,
            failed=failed,
        )

    def close_pull(self, number: int) -> None:
        self._call("PATCH", f"/pulls/{number}", {"state": "closed"})


def from_settings() -> GitHub | None:
    app: GitHubApp | None = settings.CODE_GITHUB_APP
    return None if app is None else Client(app)
