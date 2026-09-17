"""Background tasks for health. Beat schedules `heartbeat`; a worker runs it."""

import time

from celery import shared_task

from code_api.health.heartbeat import write_heartbeat


@shared_task(name="code_api.health.tasks.heartbeat")
def heartbeat() -> None:
    write_heartbeat(time.time())
