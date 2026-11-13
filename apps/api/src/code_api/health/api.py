"""GET /api/health: 200 when every check is ok, 503 when any is down."""

from typing import Literal

from django.http import HttpRequest, HttpResponse
from ninja import Router, Schema, Status

from code_api.ai.resolve import ai_configured
from code_api.health import checks

router = Router(tags=["health"])


class CheckOut(Schema):
    name: str
    status: Literal["ok", "down"]
    duration_ms: int


class HealthOut(Schema):
    status: Literal["ok", "down"]
    checks: list[CheckOut]
    # Informational, never down: running with no model is supported (M5.1 spec, M5G.3).
    ai: Literal["configured", "not configured"] = "not configured"


@router.get("", response={200: HealthOut, 503: HealthOut}, summary="Service health")
def health(request: HttpRequest, response: HttpResponse) -> Status[HealthOut]:
    results = checks.run_all()
    down = any(r.status == "down" for r in results)
    response["Cache-Control"] = "no-store"
    body = HealthOut(
        status="down" if down else "ok",
        checks=[CheckOut(name=r.name, status=r.status, duration_ms=r.duration_ms) for r in results],
        ai="configured" if ai_configured() else "not configured",
    )
    return Status(503 if down else 200, body)
