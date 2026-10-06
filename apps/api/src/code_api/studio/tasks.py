"""Studio's background tasks (M4.6 spec, M4L.4): a landing, run by any worker."""

from celery import shared_task

from code_api.studio import github, landing
from code_api.studio.models import Landing


@shared_task(name="code_api.studio.tasks.land")
def land(public_id: str) -> None:
    found = Landing.objects.filter(public_id=public_id).first()
    client = github.from_settings()
    if found is not None and client is not None:
        landing.run(found, client)
