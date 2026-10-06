"""The GitHub client (M4.6 spec, M4L.4), against a local HTTP stub: GitHub is never reached."""

import json
import threading
import time
from collections.abc import Iterator
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any

import jwt
import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa

from code_api.config.landing import GitHubApp
from code_api.studio import github
from code_api.studio.github import Client, GitHubError, Pull

KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)
PEM = KEY.private_bytes(
    serialization.Encoding.PEM,
    serialization.PrivateFormat.PKCS8,
    serialization.NoEncryption(),
).decode()
REPO = "/repos/comeni-project/comeni-code-content"


class Stub:
    """Answers by (method, path); records every request it saw."""

    def __init__(self) -> None:
        self.routes: dict[tuple[str, str], tuple[int, Any]] = {}
        self.seen: list[tuple[str, str, dict[str, str], Any]] = []
        self.delay = 0.0


@pytest.fixture
def stub() -> Iterator[tuple[Stub, GitHubApp]]:
    state = Stub()

    class Handler(BaseHTTPRequestHandler):
        def _answer(self) -> None:
            length = int(self.headers.get("Content-Length") or 0)
            body = json.loads(self.rfile.read(length)) if length else None
            state.seen.append((self.command, self.path, dict(self.headers), body))
            time.sleep(state.delay)
            status, answer = state.routes.get(
                (self.command, self.path), (404, {"message": "Not Found"})
            )
            payload = json.dumps(answer).encode()
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)

        do_GET = do_POST = do_PATCH = do_PUT = do_DELETE = _answer

        def log_message(self, *args: object) -> None:
            pass

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    app = GitHubApp(
        app_id="123",
        installation_id="456",
        private_key=PEM,
        repository="comeni-project/comeni-code-content",
        api_url=f"http://127.0.0.1:{server.server_port}",
    )
    state.routes[("POST", "/app/installations/456/access_tokens")] = (
        201,
        {"token": "ghs_test", "expires_at": "2999-01-01T00:00:00Z"},
    )
    github.forget_tokens()
    yield state, app
    server.shutdown()


def test_the_token_is_traded_for_with_a_signed_jwt_and_kept(stub: tuple[Stub, GitHubApp]) -> None:
    state, app = stub
    state.routes[("GET", f"{REPO}/git/ref/heads/main")] = (200, {"object": {"sha": "c0ffee"}})
    client = Client(app)
    assert client.head() == "c0ffee"
    assert client.head() == "c0ffee"
    exchanges = [seen for seen in state.seen if seen[1].endswith("/access_tokens")]
    assert len(exchanges) == 1  # cached until shortly before it expires
    token = exchanges[0][2]["Authorization"].removeprefix("Bearer ")
    claims = jwt.decode(token, KEY.public_key(), algorithms=["RS256"])
    assert claims["iss"] == "123"
    calls = [seen for seen in state.seen if seen[1].endswith("/heads/main")]
    assert calls[0][2]["Authorization"] == "Bearer ghs_test"


def test_a_commit_is_one_tree_on_the_parents(stub: tuple[Stub, GitHubApp]) -> None:
    state, app = stub
    state.routes[("GET", f"{REPO}/git/commits/p1")] = (200, {"tree": {"sha": "t1"}})
    state.routes[("POST", f"{REPO}/git/trees")] = (201, {"sha": "t2"})
    state.routes[("POST", f"{REPO}/git/commits")] = (201, {"sha": "c2"})
    sha = Client(app).commit(
        parent="p1", files={"a/x/node.yaml": "id: x\n", "a/x/exam.yaml": None}, message="m"
    )
    assert sha == "c2"
    tree = next(body for method, path, _, body in state.seen if path.endswith("/git/trees"))
    assert tree == {
        "base_tree": "t1",
        "tree": [
            {"path": "a/x/exam.yaml", "mode": "100644", "type": "blob", "sha": None},
            {"path": "a/x/node.yaml", "mode": "100644", "type": "blob", "content": "id: x\n"},
        ],
    }
    commit = next(body for method, path, _, body in state.seen if path.endswith("/git/commits"))
    assert commit == {"message": "m", "tree": "t2", "parents": ["p1"]}


def test_a_folders_tree_is_read_from_its_parent(stub: tuple[Stub, GitHubApp]) -> None:
    # #203: compare lists at most 300 files, so staleness compares a folder's tree instead.
    state, app = stub
    state.routes[("GET", f"{REPO}/contents/transcriptomics?ref=c1")] = (
        200,
        [
            {"name": "salmon", "type": "dir", "sha": "tree-s"},
            {"name": "tpm", "type": "dir", "sha": "tree-t"},
        ],
    )
    client = Client(app)
    assert client.folder("transcriptomics/tpm", "c1") == "tree-t"
    assert client.folder("transcriptomics/rpkm", "c1") is None
    assert client.folder("statistics/likelihood", "c1") is None  # the region itself is missing


def test_a_malformed_answer_is_an_error_not_a_crash(stub: tuple[Stub, GitHubApp]) -> None:
    # #203: a 2xx without the fields asked for, or an error body that is a list.
    state, app = stub
    state.routes[("GET", f"{REPO}/git/ref/heads/main")] = (200, {"object": {}})
    with pytest.raises(GitHubError, match="not what Studio expected"):
        Client(app).head()
    state.routes[("POST", f"{REPO}/git/refs")] = (500, ["boom"])
    with pytest.raises(GitHubError, match="answered 500") as raised:
        Client(app).branch("b", "c")
    assert raised.value.status == 500


def test_a_pull_request_is_found_by_its_branch(stub: tuple[Stub, GitHubApp]) -> None:
    state, app = stub
    path = f"{REPO}/pulls?head=comeni-project:studio/landing-ab12&state=open"
    state.routes[("GET", path)] = (
        200,
        [{"number": 9, "html_url": "https://github.com/x/pull/9", "node_id": "PR_9"}],
    )
    none = f"{REPO}/pulls?head=comeni-project:studio/landing-none&state=open"
    state.routes[("GET", none)] = (200, [])
    client = Client(app)
    assert client.find_pull("studio/landing-ab12") == Pull(
        number=9, url="https://github.com/x/pull/9", node_id="PR_9"
    )
    assert client.find_pull("studio/landing-none") is None


def test_a_pull_request_is_opened_and_set_to_merge(stub: tuple[Stub, GitHubApp]) -> None:
    state, app = stub
    state.routes[("POST", f"{REPO}/pulls")] = (
        201,
        {"number": 7, "html_url": "https://github.com/x/pull/7", "node_id": "PR_7"},
    )
    state.routes[("POST", "/graphql")] = (200, {"data": {"enablePullRequestAutoMerge": {}}})
    client = Client(app)
    pull = client.open_pull(branch="studio/landing-ab12", title="t", body="b")
    assert pull == Pull(number=7, url="https://github.com/x/pull/7", node_id="PR_7")
    client.auto_merge(pull)
    query = next(body for method, path, _, body in state.seen if path == "/graphql")
    assert query["variables"] == {"id": "PR_7"}
    assert "SQUASH" in query["query"]


def test_a_graphql_error_is_an_error(stub: tuple[Stub, GitHubApp]) -> None:
    state, app = stub
    state.routes[("POST", "/graphql")] = (200, {"errors": [{"message": "auto-merge is off"}]})
    with pytest.raises(GitHubError, match="auto-merge is off"):
        Client(app).auto_merge(Pull(number=7, url="u", node_id="PR_7"))


def test_a_pull_requests_state_names_its_failed_checks(stub: tuple[Stub, GitHubApp]) -> None:
    state, app = stub
    state.routes[("GET", f"{REPO}/pulls/7")] = (
        200,
        {"merged": False, "state": "open", "mergeable": True, "head": {"sha": "h7"}},
    )
    state.routes[("GET", f"{REPO}/commits/h7/check-runs?per_page=100")] = (
        200,
        {
            "check_runs": [
                {"name": "validate", "conclusion": "failure", "html_url": "https://ci/1"},
                {"name": "review", "conclusion": "success", "html_url": "https://ci/2"},
                {"name": "slow", "conclusion": None, "html_url": "https://ci/3"},
            ]
        },
    )
    state.routes[("GET", f"{REPO}/commits/h7/status")] = (200, {"statuses": []})
    found = Client(app).pull_state(7)
    assert (found.merged, found.closed, found.conflict) == (False, False, False)
    assert found.failed == (("validate", "https://ci/1"),)


def test_an_error_is_a_sentence_from_github(stub: tuple[Stub, GitHubApp]) -> None:
    state, app = stub
    state.routes[("POST", f"{REPO}/git/refs")] = (422, {"message": "Reference already exists"})
    with pytest.raises(GitHubError, match=r"^GitHub answered 422: Reference already exists\.$"):
        Client(app).branch("studio/landing-ab12", "c2")


def test_a_slow_github_is_a_timeout_not_a_hang(
    stub: tuple[Stub, GitHubApp], monkeypatch: pytest.MonkeyPatch
) -> None:
    state, app = stub
    monkeypatch.setattr(github, "TIMEOUT", 0.2)
    state.delay = 1.0
    with pytest.raises(GitHubError, match="did not answer"):
        Client(app).head()


def test_landing_is_off_without_the_app(settings: Any) -> None:
    settings.CODE_GITHUB_APP = None
    assert github.from_settings() is None


def test_a_failing_commit_status_counts_as_a_failed_check(stub: tuple[Stub, GitHubApp]) -> None:
    # The final review: the content repository's `review` is a commit status, not a check run.
    state, app = stub
    state.routes[("GET", f"{REPO}/pulls/7")] = (
        200,
        {"merged": False, "state": "open", "mergeable": True, "head": {"sha": "h7"}},
    )
    state.routes[("GET", f"{REPO}/commits/h7/check-runs?per_page=100")] = (200, {"check_runs": []})
    state.routes[("GET", f"{REPO}/commits/h7/status")] = (
        200,
        {
            "statuses": [
                {"context": "review", "state": "failure", "target_url": "https://ci/r"},
                {"context": "other", "state": "success", "target_url": "https://ci/o"},
            ]
        },
    )
    assert Client(app).pull_state(7).failed == (("review", "https://ci/r"),)


def test_a_key_github_cannot_use_is_an_error_in_words(stub: tuple[Stub, GitHubApp]) -> None:
    # The final review: a bad PEM raised PyJWT's own error, past every handler.
    _, app = stub
    broken = GitHubApp(
        app_id=app.app_id,
        installation_id="999",
        private_key="not a key",
        repository=app.repository,
        api_url=app.api_url,
    )
    with pytest.raises(GitHubError, match="could not sign in to GitHub as the app"):
        Client(broken).head()
