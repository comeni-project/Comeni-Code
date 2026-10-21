"""The app's Content Security Policy (M6.4 spec, M6FG.4; #365): sent by nginx on the app's paths,
forbidding eval, inline scripts and outside connections, and naming every embed host the page
builds. A backstop for the whole app, charts first."""

import re
from pathlib import Path

from code_schema.providers import PLAYERS

ROOT = Path(__file__).resolve().parents[2]
CONF = (ROOT / "ops" / "nginx" / "default.conf").read_text(encoding="utf-8")
EMBED = (ROOT / "apps" / "web" / "src" / "node" / "embed.ts").read_text(encoding="utf-8")


def app_location() -> str:
    start = CONF.index("location / {")
    return CONF[start : CONF.index("}", start)]


def policy() -> dict[str, list[str]]:
    found = re.search(r'add_header Content-Security-Policy "([^"]+)" always;', app_location())
    assert found, "location / sends no Content-Security-Policy"
    directives = [part.split() for part in found.group(1).split(";") if part.strip()]
    return {name: values for name, *values in directives}


def test_the_app_forbids_eval_inline_scripts_and_outside_connections() -> None:
    csp = policy()
    assert csp["default-src"] == ["'self'"]
    assert csp["script-src"] == ["'self'"]  # no 'unsafe-eval' or 'unsafe-inline'
    assert csp["connect-src"] == ["'self'"]
    assert csp["object-src"] == ["'none'"]
    assert csp["base-uri"] == ["'self'"]
    assert csp["frame-ancestors"] == ["'none'"]


def test_every_embed_host_the_page_builds_is_a_frame_source() -> None:
    hosts = set(re.findall(r"https://([a-z0-9.-]+)/embed", EMBED))
    assert len(hosts) >= len(PLAYERS), "each player in PLAYERS has a host in embed.ts"
    assert {f"https://{host}" for host in hosts} <= set(policy()["frame-src"])


def test_a_location_with_its_own_headers_repeats_the_servers() -> None:
    # nginx drops a server's add_header in any location that has its own (M6FG.4).
    assert "add_header Referrer-Policy same-origin always;" in app_location()


def test_the_api_paths_send_no_policy() -> None:
    for path in ("/api/", "/_allauth/", "/static/"):
        start = CONF.index(f"location {path} {{")
        assert "Content-Security-Policy" not in CONF[start : CONF.index("}", start)]
