"""Redis and worker health, the heartbeat, and a real worker (M0 part 4 spec, P4.3–P4.4)."""

import json
import subprocess
import sys
import time
from collections.abc import Iterator
from typing import cast

import pytest
from celery.contrib.testing.worker import start_worker
from django.conf import settings
from django.test import Client
from redis import Redis

from code_api import redis as redis_client
from code_api.celery import app
from code_api.health import checks
from code_api.health.heartbeat import (
    HEARTBEAT_INTERVAL_SECONDS,
    HEARTBEAT_KEY,
    HEARTBEAT_STALE_AFTER_SECONDS,
    last_heartbeat,
    write_heartbeat,
)
from code_api.health.tasks import heartbeat


@pytest.fixture
def no_heartbeat() -> Iterator[Redis]:
    r = redis_client.client()
    r.delete(HEARTBEAT_KEY)
    yield r
    r.delete(HEARTBEAT_KEY)


def test_the_heartbeat_task_writes_a_fresh_timestamp(no_heartbeat: Redis) -> None:
    heartbeat()
    last = last_heartbeat()
    assert last is not None
    assert time.time() - last < 5
    assert 0 < cast(int, no_heartbeat.ttl(HEARTBEAT_KEY)) <= 300


def test_worker_is_ok_with_a_fresh_heartbeat(no_heartbeat: Redis) -> None:
    write_heartbeat(time.time())
    assert checks.run("worker", checks.worker).status == "ok"


def test_worker_is_down_with_a_stale_heartbeat(no_heartbeat: Redis) -> None:
    write_heartbeat(time.time() - HEARTBEAT_STALE_AFTER_SECONDS - 1)
    assert checks.run("worker", checks.worker).status == "down"


def test_worker_is_down_with_no_heartbeat(no_heartbeat: Redis) -> None:
    assert checks.run("worker", checks.worker).status == "down"


def test_redis_down_makes_health_503(client: Client, monkeypatch: pytest.MonkeyPatch) -> None:
    closed = Redis.from_url("redis://127.0.0.1:1/0", socket_connect_timeout=2, socket_timeout=2)
    monkeypatch.setattr(redis_client, "client", lambda: closed)
    monkeypatch.setitem(checks.CHECKS, "database", lambda: None)
    response = client.get("/api/health")
    assert response.status_code == 503
    statuses = {c["name"]: c["status"] for c in response.json()["checks"]}
    assert statuses == {"database": "ok", "redis": "down", "worker": "down"}


@pytest.mark.django_db
def test_health_lists_database_redis_and_worker_in_order(
    client: Client, no_heartbeat: Redis
) -> None:
    write_heartbeat(time.time())
    response = client.get("/api/health")
    assert response.status_code == 200
    assert [c["name"] for c in response.json()["checks"]] == ["database", "redis", "worker"]


def test_beat_schedules_the_heartbeat() -> None:
    entry = settings.CELERY_BEAT_SCHEDULE["health-heartbeat"]
    assert entry["schedule"] == HEARTBEAT_INTERVAL_SECONDS == 10.0


def test_a_fresh_worker_process_knows_every_scheduled_task() -> None:
    """Load the app as `celery -A code_api worker` does, in a new interpreter.

    In this test process the task module is already imported, which registers its tasks, so
    `app.tasks` here would pass even when a real worker rejects the task as unregistered.
    """
    probe = (
        "import json\n"
        "from code_api.celery import app\n"
        "app.loader.import_default_modules()\n"
        "print(json.dumps(sorted(app.tasks)))\n"
    )
    result = subprocess.run(
        [sys.executable, "-c", probe], capture_output=True, text=True, check=True, timeout=60
    )
    registered = json.loads(result.stdout.strip().splitlines()[-1])
    for entry in settings.CELERY_BEAT_SCHEDULE.values():
        assert entry["task"] in registered, f"a worker would reject {entry['task']}"


@pytest.mark.django_db
def test_a_real_worker_runs_the_heartbeat(client: Client, no_heartbeat: Redis) -> None:
    with start_worker(app, pool="solo", perform_ping_check=False, shutdown_timeout=10):
        heartbeat.delay()
        deadline = time.monotonic() + 10
        while last_heartbeat() is None and time.monotonic() < deadline:
            time.sleep(0.1)
    assert last_heartbeat() is not None, "the worker never ran the heartbeat"
    statuses = {c["name"]: c["status"] for c in client.get("/api/health").json()["checks"]}
    assert statuses["worker"] == "ok"
