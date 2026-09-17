"""GET /api/health: 200 when every check is ok, 503 when any is down."""

from typing import Literal

from django.http import HttpRequest, HttpResponse
from ninja import Router, Schema, Status

from code_api.health import checks

router = Router(tags=["health"])


class CheckOut(Schema):
    name: str
    status: Literal["ok", "down"]
    duration_ms: int


class HealthOut(Schema):
    status: Literal["ok", "down"]
    checks: list[CheckOut]


@router.get("", response={200: HealthOut, 503: HealthOut}, summary="Service health")
def health(request: HttpRequest, response: HttpResponse) -> Status[HealthOut]:
    results = checks.run_all()
    down = any(r.status == "down" for r in results)
    response["Cache-Control"] = "no-store"
    body = HealthOut(
        status="down" if down else "ok",
        checks=[CheckOut(name=r.name, status=r.status, duration_ms=r.duration_ms) for r in results],
    )
    return Status(503 if down else 200, body)
