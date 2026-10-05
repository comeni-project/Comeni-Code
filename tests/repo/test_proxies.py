"""The web app's two proxies forward what the API serves (M4.3 spec, M4A.3; M0 P7.2, P8.2).

Vite's dev proxy and the nginx config are kept by hand, so a path one forwards and the other
does not would work in development and fail in the Compose stack, or the reverse. allauth's
endpoints, GitHub's callback among them, all sit under /_allauth/.
"""

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
VITE = (ROOT / "apps" / "web" / "vite.config.ts").read_text(encoding="utf-8")
NGINX = (ROOT / "ops" / "nginx" / "default.conf").read_text(encoding="utf-8")
FORWARDED = ("/api", "/_allauth")


def test_vite_forwards_each_api_path() -> None:
    proxied = set(re.findall(r'"(/[\w/]+)":\s*\{\s*target', VITE))
    assert set(FORWARDED) <= proxied


def test_nginx_forwards_each_api_path() -> None:
    locations = set(re.findall(r"location (/[\w/]+)/ \{", NGINX))
    assert set(FORWARDED) <= locations


def test_nginx_keeps_invite_links_out_of_referers() -> None:
    # An invite's token is in the /join/ path; a Referer must not carry it to another site (#161).
    assert re.search(r"add_header Referrer-Policy same-origin always;", NGINX)
