"""Named health checks. Part 4 adds Redis and the worker."""

import logging
import time
from collections.abc import Callable
from dataclasses import dataclass
from typing import Literal

from django.db import connection

from code_api import redis as redis_client
from code_api.health.heartbeat import HEARTBEAT_STALE_AFTER_SECONDS, last_heartbeat

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


def redis() -> None:
    """PING Redis. Raises if it doesn't answer within its timeout."""
    redis_client.client().ping()


def worker() -> None:
    """The heartbeat a worker writes must be recent. Raises with a reason that is only logged."""
    last = last_heartbeat()
    if last is None:
        raise RuntimeError("no heartbeat")
    age = time.time() - last
    if age > HEARTBEAT_STALE_AFTER_SECONDS:
        raise RuntimeError(f"last heartbeat {age:.0f} s ago")


CHECKS: dict[str, Callable[[], None]] = {"database": database, "redis": redis, "worker": worker}


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
