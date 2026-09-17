"""Named health checks. Part 4 adds Redis and the worker."""

import logging
import time
from collections.abc import Callable
from dataclasses import dataclass
from typing import Literal

from django.db import connection

log = logging.getLogger(__name__)

Status = Literal["ok", "down"]


@dataclass(frozen=True)
class CheckResult:
    name: str
    status: Status
    duration_ms: int


def database() -> None:
    """Open the connection and run a trivial query. Raises if Postgres is unreachable."""
    with connection.cursor() as cursor:
        cursor.execute("SELECT 1")


CHECKS: dict[str, Callable[[], None]] = {"database": database}


def run(name: str, check: Callable[[], None]) -> CheckResult:
    """Run one check. Any exception means down; the reason is logged, never returned."""
    started = time.monotonic()
    try:
        check()
        status: Status = "ok"
    except Exception:
        log.exception("health check %s failed", name)
        status = "down"
    return CheckResult(name, status, round((time.monotonic() - started) * 1000))


def run_all() -> list[CheckResult]:
    return [run(name, check) for name, check in CHECKS.items()]
