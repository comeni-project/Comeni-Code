"""The heartbeat: its timing, shared by beat's schedule, the task and the worker check (P4.3).

Reads and writes go through these two functions, so redis-py's loose return types (one
annotation for its sync and async clients) are narrowed in one place.
"""

from typing import cast

from code_api import redis

HEARTBEAT_KEY = "code:health:heartbeat"
HEARTBEAT_INTERVAL_SECONDS = 10.0
# Three missed beats mean the worker (or beat) is down.
HEARTBEAT_STALE_AFTER_SECONDS = 3 * HEARTBEAT_INTERVAL_SECONDS
# An abandoned key doesn't outlive the setup.
HEARTBEAT_EXPIRES_SECONDS = 300


def write_heartbeat(at: float) -> None:
    redis.client().set(HEARTBEAT_KEY, at, ex=HEARTBEAT_EXPIRES_SECONDS)


def last_heartbeat() -> float | None:
    raw = cast(bytes | None, redis.client().get(HEARTBEAT_KEY))
    return None if raw is None else float(raw)
