"""The OpenAPI schema is committed and current; the docs page loads from our own files (P3.3)."""

import json
import re
from pathlib import Path

from django.core.management import call_command
from django.test import Client, override_settings

from code_api.api import api

SCHEMA_FILE = Path(__file__).resolve().parents[1] / "openapi.json"
REGENERATE = (
    "uv run python apps/api/manage.py export_openapi_schema --api code_api.api.api "
    "--sorted --indent 2 --output apps/api/openapi.json"
)


def test_the_committed_schema_is_current() -> None:
    committed = json.loads(SCHEMA_FILE.read_text())
    assert committed == json.loads(json.dumps(api.get_openapi_schema())), (
        f"apps/api/openapi.json is stale. Regenerate it:\n  {REGENERATE}"
    )


def test_the_schema_lists_health_with_200_and_503(client: Client) -> None:
    response = client.get("/api/openapi.json")
    assert response.status_code == 200
    responses = response.json()["paths"]["/api/health"]["get"]["responses"]
    assert {"200", "503"} <= set(responses)


def test_the_docs_page_uses_no_cdn(client: Client) -> None:
    response = client.get("/api/docs")
    assert response.status_code == 200
    html = response.content.decode()
    assert "/static/ninja/swagger-ui-bundle.js" in html
    assert not re.search(r"""(src|href)=["']https?://""", html)


def test_every_docs_asset_loads_with_debug_off(tmp_path: Path) -> None:
    with override_settings(STATIC_ROOT=tmp_path, DEBUG=False):
        call_command("collectstatic", interactive=False, verbosity=0)
        client = Client()
        html = client.get("/api/docs").content.decode()
        assets = re.findall(r"""(?:src|href)=["'](/static/[^"']+)""", html)
        assert assets
        for asset in assets:
            assert client.get(asset).status_code == 200, asset
