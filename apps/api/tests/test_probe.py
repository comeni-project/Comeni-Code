"""The api container's health check (M0 part 8 spec, P8.3)."""

import socket
import threading
from collections.abc import Iterator
from http.server import BaseHTTPRequestHandler, HTTPServer

import pytest

from code_api.health import probe


@pytest.fixture
def answering() -> Iterator[tuple[HTTPServer, list[int]]]:
    """A local server that answers with whatever status the test puts in the list."""
    reply = [200]

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self) -> None:
            self.send_response(reply[0])
            self.end_headers()

        def log_message(self, format: str, *args: object) -> None:
            pass

    server = HTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    yield server, reply
    server.shutdown()
    server.server_close()


def _url(server: HTTPServer) -> str:
    return f"http://127.0.0.1:{server.server_address[1]}/api/health"


@pytest.mark.parametrize(("code", "exit_code"), [(200, 0), (503, 0), (500, 1), (404, 1)])
def test_serving_means_200_or_503(
    answering: tuple[HTTPServer, list[int]], code: int, exit_code: int
) -> None:
    server, reply = answering
    reply[0] = code
    assert probe.main(_url(server)) == exit_code


def test_nothing_listening_is_unhealthy() -> None:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        port = s.getsockname()[1]
    assert probe.main(f"http://127.0.0.1:{port}/api/health") == 1
